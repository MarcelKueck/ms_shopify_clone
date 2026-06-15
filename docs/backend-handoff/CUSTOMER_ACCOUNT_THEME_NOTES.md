# Customer Account (tier 3) — theme → backend handoff

> Written by the Shopify theme snapshot while wiring tier-3 sign-in + signed-in
> conversation history into the chat widget (`assets/ms-chat-widget.js` +
> `assets/ms-chat-widget.css`). Everything the widget actually *calls* is already
> in `docs/ai-advisor/{CUSTOMER_ACCOUNT,API_CONTRACT}.md`; this file records the
> implementation choices the contract left open and the **two things the widget
> needs the backend to confirm or add**. None of it blocks the anonymous /
> email-only flows, which are unchanged.

## What the widget implemented (all from the existing contract)

- **Already-signed-in detection** (updated 10E-2). On **every panel open** (and
  again when the tab becomes visible while not signed in) the widget calls the
  **App Proxy** detection `GET /apps/chat/whoami?session={sid}` (same-origin;
  Shopify signs `logged_in_customer_id`, `CUSTOMER_ACCOUNT.md §3) **first** — so a
  customer signed in via the **shop's own** account icon is recognised, not only
  the chatbot-OAuth path. The proxy subpath defaults to `/apps/chat/whoami` and
  is overridable via `MS_CHAT_CONFIG.whoamiPath`. If the proxy isn't configured
  yet (a storefront 404 / non-JSON page) or reports logged-out, the widget falls
  back to `GET /api/auth/me?session={sid}` (guards `x-ms-chat-key` +
  `x-ms-session`) — and then only when a local "was signed in on this device"
  hint says it's worth a call. A not-signed-in result settles the anonymous UX
  **unchanged**; anonymous / email-only paths render byte-identically (the only
  visible effect of detection is replacing the login affordances with the
  signed-in identity when a customer is found).
- **Sign-in initiation** = top-level redirect to
  `GET /api/auth/shopify/login?session={sid}&return_url={window.location.href}`,
  driven by one button on an in-chat benefits card (no fake login form).
- **Return handling** reads + strips `?ms_auth=` (`ok` → probe `/api/auth/me` and
  show signed-in; `login_required` → show the one-click affordance;
  `logged_out`/`error` → stay anonymous). The **same** conversation re-hydrates
  from the unchanged `session_id` localStorage thread.
- **History** uses `GET /api/account/conversations`, `GET/PATCH/DELETE
  /api/account/conversations/{id}`, and `POST /api/account/erase` exactly as
  documented (fail-closed on 401, honest per-chat vs erase-all wording).
- The session id is **never rotated** while signed in (it is the identity link,
  `CUSTOMER_ACCOUNT.md §1`).

## Decision: prompt=none silent check is intentionally NOT used

The contract allows a silent `prompt=none` redirect to auto-detect an existing
Shopify login, but notes it's a best-effort optimisation with a documented
**one-click fallback**. Because `prompt=none` is still a *full-page* redirect, we
chose the fallback as the default: it would be jarring to bounce the whole
storefront page on first chat open. So the widget relies on `/api/auth/me`
(no redirect) for re-detection and shows a subtle "Anmelden" affordance
otherwise. **No backend change required** — just confirming we deliberately did
not wire `prompt=none`.

## ❓ NEEDS CONFIRMATION — multi-conversation under a stable session_id

The widget models the **active conversation as the local `messages` array**, and
relies on the backend to resolve the active thread from `session_id` (per
`API_CONTRACT.md §2`, `/api/chat` is effectively stateless replay of the sent
messages). Because we must not rotate `session_id` while signed in:

- **"Neue Beratung"** clears the local thread but keeps `session_id`.
- **Opening a past conversation** fetches its transcript and loads it into the
  local view; the next `/api/chat` turn sends that transcript under the same
  `session_id`.

Please confirm how the backend distinguishes / persists **separate
conversations for one customer when `session_id` is stable**, so the history
list (`/api/account/conversations`) reflects multiple threads rather than one
ever-growing row. If the intended mechanism is a per-request `conversationId`
(or "start a new conversation" signal) on `/api/chat`, tell us the field and
we'll send it — it is a small additive change on the widget side.

## ❓ NEEDS AN ENDPOINT (or docs) — signed-in logout initiation

`CUSTOMER_ACCOUNT.md §5` describes logout as the widget sending the top-level
window to **Shopify's `end_session_endpoint`** with a `post_logout_redirect_uri`
of `/api/auth/shopify/logout/return`. The widget has **no way to construct that
Shopify OIDC URL** from the documented contract (it never sees discovery
metadata or tokens). Today the widget therefore does a **local sign-out only**
(hides the signed-in UI on this device; the server session is left to expire).

Requested: a backend-initiated logout route mirroring login, e.g.
`GET /api/auth/shopify/logout?session={sid}&return_url={storefront}` that performs
the `end_session` redirect server-side and bounces back with `?ms_auth=logged_out`.
Then the widget can offer a true sign-out. (Erase — `POST /api/account/erase` —
already works and is wired.)

## Origins / config

`return_url` is `window.location.href` (a storefront origin), matching the
open-redirect allowlist. The auth/account base URL is the same configurable
`apiBase` the widget already uses (`settings.ai_advisor_backend_url`); no new
theme setting was added.

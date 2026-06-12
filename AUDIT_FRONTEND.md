# Frontend (widget) audit — alignment with the backend ground-truth spec

**Date:** 2026-06-12 · **Scope:** `assets/ms-chat-widget.js`, `assets/ms-chat-widget.css`,
`snippets/ms-chat-widget.liquid`, `config/settings_schema.json` (AI Advisor section),
`layout/theme.liquid` (include), checked against `docs/AUDIT_BACKEND.md` **Section 2**
(authoritative — code-derived) and `docs/API_CONTRACT.md` / `docs/WIDGET_SPEC.md` /
`docs/BEHAVIOR_REFERENCE.md`. Read-only audit; **no widget code was changed**.

---

## VERDICT: ⚠️ ISSUES — all LOW/INFO; no high-severity misalignment

The widget is in very good shape against the backend's ground truth. Critically, it
implements the **real AI-SDK chunk protocol** (`text-delta`, `tool-input-available`,
`tool-output-available`, …) rather than the stale "assembled parts" wire description in
the docs — so backend finding **A1 (HIGH)** does *not* manifest in this widget; the widget
is ahead of its own spec there. All eight backend tools are handled (six rendered, two
consumed silently), every consent rule holds exactly (canonical backend copy, verbatim
`consentTextShown` echo, transactional pre-checked / marketing never pre-ticked), the
`context` shapes are contract-valid, and the documented error envelopes are handled.
What remains is a stale default base URL, a few error-handling gaps at the edges, one
session-long cache-poisoning quirk, and several doc-staleness items in `WIDGET_SPEC.md`.

| # | Severity | File | Finding |
|---|----------|------|---------|
| F1 | LOW | `ms-chat-widget.js:21`, `ms-chat-widget.liquid:48`, `settings_schema.json` | Default `apiBase` is `https://motionsports-chatbot.vercel.app`, not the documented production base `https://chat.motionsports.de` |
| F2 | LOW | `ms-chat-widget.js:951-962` | Contact form has no 429 branch — shows the backend's raw English message, ignores `Retry-After` |
| F3 | LOW | `ms-chat-widget.js:1190-1199` | Capture form shows the 429 hint but re-enables submit immediately (no `Retry-After` lockout) |
| F4 | LOW | `ms-chat-widget.js:493-502` | Transient `/api/products` failures (429/network) are cached as `null` for the whole session → tool cards permanently render nothing |
| F5 | LOW | `ms-chat-widget.js:2063-2066, 1928-1930` | Stream `error` chunk is swallowed when any content already rendered — spec says show the friendly retry message |
| F6 | LOW (doc) | `docs/WIDGET_SPEC.md` §5 | Spec still describes the stream as "parse each `data:` JSON event into a *part*" — inherits backend finding A1; widget code is correct, the spec is wrong |
| F7 | LOW (doc) | `docs/WIDGET_SPEC.md` §6 + checklist | "Cart action … link to `product.shopifyCartUrl`" is stale — widget (correctly, per backend) uses the top-level `cartUrl` |
| F8 | INFO | `ms-chat-widget.js:1219, 2054-2057` | Capture card never consumes the tool result's `output.consentCopy` — it always re-fetches `GET /api/consent-copy` (extra request; payloads identical) |
| F9 | INFO | `ms-chat-widget.js:1830-1833` | Replayed history tool parts carry synthesized `state: "output-available"` with **no** `output` field — works today, brittle if the backend ever validates UIMessages strictly |
| F10 | INFO | `ms-chat-widget.js:2328-2347`, `ms-chat-widget.liquid:61` | Product-page CTA sends the **numeric** Shopify `product.id` as `context.productId` → dropped server-side (documented + mitigated; the handle is available and unused on this path) |
| F11 | INFO | `ms-chat-widget.js:1059-1060` | `email_capture_declined` also fires for the header-entry form (no preceding server-side `ask_shown`; empty `data`); `askNumber` never sent |
| F12 | INFO | `ms-chat-widget.js:2099-2101` | Cross-origin readability of `Retry-After` requires `Access-Control-Expose-Headers`, which no doc confirms — widget likely always falls back to its 30 s default |
| F13 | INFO | `ms-chat-widget.js:2077-2089` | A 403 from a non-allowlisted origin arrives without CORS headers → surfaces as a fetch rejection, so the widget's dedicated 403 branch never runs (still handled gracefully) |
| F14 | INFO (doc) | `docs/API_CONTRACT.md` §2 vs `docs/BEHAVIOR_REFERENCE.md` §2.1 | `show_product` card omits `shortDescription`; contract says render it, BEHAVIOR_REFERENCE's layout omits it — the two docs disagree, widget follows BEHAVIOR_REFERENCE |

---

## 1. Endpoint calls — method / path / headers / request shape

All verified against `AUDIT_BACKEND.md` §§2.0–2.8.

| Endpoint | Verdict |
|---|---|
| `POST /api/chat` | ✅ `Content-Type` + `x-ms-chat-key` + `x-ms-session` (`ms-chat-widget.js:1954-1957`); full `messages` history each turn; optional `context`; `customer.email` only after in-session capture, in memory only |
| `POST /api/capture-email` | ✅ same headers (`:1165-1168`); body `{ sessionId, email, transactionalConsent: true, marketingConsent, consentTextShown, trigger? }` exactly per §2.7 |
| `GET /api/products` | ✅ `?ids=` form, `x-ms-session`, batches chunked to the 10-id cap (`:483-508`) |
| `POST /api/kpi` | ✅ no secret, `Content-Type` + `x-ms-session`, `{ event, sessionId, timestamp (ISO string — accepted), data: object }` (`:151-171`) |
| `GET /api/consent-copy` | ✅ no secret, `x-ms-session`, 60 s in-memory cache matching the endpoint's `Cache-Control`, payload validated, never persisted (`:518-554`) |
| `POST /api/contact` | ✅ headers + body shape per §2.5; `name`/`email`/`message`/org validation mirrors the server's |

Session id: generated once via `crypto.randomUUID()` (with fallback), persisted as
`ms-chat-sid`, sent on **every** request including kpi/consent-copy — matches §2.0,
including the load-bearing requirement that chat and capture share one session id.

### F1 (LOW) — Default backend URL doesn't match the documented production base

`AUDIT_BACKEND.md:280` and `API_CONTRACT.md:9` state the production base URL is
`https://chat.motionsports.de` (also the `WIDGET_SPEC.md` §2 config example). The widget's
hard default (`assets/ms-chat-widget.js:21`), the snippet's `default:` filter
(`snippets/ms-chat-widget.liquid:48`) and the theme setting default
(`config/settings_schema.json`, `ai_advisor_backend_url`) are all
`https://motionsports-chatbot.vercel.app`. Operator-overridable, so LOW — but a fresh
install talks to the Vercel host while every doc names the custom domain. One of the two
(widget defaults or docs) is stale; they should agree.

### F2 (LOW) — Contact form: no 429 handling

`buildContactForm`'s error branch (`ms-chat-widget.js:951-962`) special-cases only
`upstream_unavailable`/502. On `429 rate_limited` (the contact endpoint shares the chat
bucket, §2.5) the user sees the backend's raw `error.message` ("Too many requests",
English) and the submit button is immediately re-enabled — no `Retry-After` honoring, no
German hint. The capture form and the chat path both special-case 429; the contact form
should too (backend spec §2.0: "429 carries `Retry-After` — disable input for that long").

### F3 (LOW) — Capture form ignores `Retry-After` on 429

`ms-chat-widget.js:1190-1199` shows the correct German hint but re-enables the submit
button immediately, allowing instant re-submission into the same rate-limit window.
Backend spec §2.0 instructs disabling input for the `Retry-After` duration (the chat path
does this correctly via `lockRateLimit`).

---

## 2. Streamed tool parts / chunk protocol

The widget's `handleEvent` (`ms-chat-widget.js:2003-2074`) matches the **empirically
verified chunk vocabulary** of `AUDIT_BACKEND.md` §2.2 exactly:

- `start` / `start-step` / `finish-step` ignored; `finish` and the literal `[DONE]` (and
  socket close) all idempotently finalize ✅
- `text-start` / `text-delta(delta)` / `text-end` → one bubble per text run, deltas
  appended ✅
- `tool-input-start` records `toolCallId → toolName`; `tool-input-delta` ignored;
  `tool-input-available` renders the card (dispatch on **bare** `toolName`, keyed by
  `toolCallId`, duplicate chunks replace in place via the `inputKey` check) ✅
- `tool-output-available` consumed silently except `offer_email_summary`, whose
  `output.consentCopy` seeds the consent-copy cache ✅
- `error` → flag set (see F5); `tool-output-error`, `data-*`, `reasoning-*` and unknown
  types ignored defensively ✅
- SSE parsing via `fetch` + `getReader()` + `TextDecoder`, line-buffered, `\r` and
  comment/keep-alive lines tolerated, non-200 checked **before** streaming ✅
- No client timeout is imposed (route `maxDuration` 300 s) ✅

**Tool coverage is exact.** The backend can emit 8 tools; the widget renders
`show_product`, `compare_products`, `add_to_cart`, `suggest_showroom`,
`show_contact_form`, renders `offer_email_summary` as the capture form, and silently
consumes `update_customer_profile` + `search_products` (including its streamed output).
No tool the backend can emit is unhandled; no handled tool no longer exists. Input
fields read by each card match `AUDIT_BACKEND.md` §2.3 field-for-field, including the
`add_to_cart` normalisation (`productIds ?? [productId]`), the top-level `cartUrl` for
the checkout button, hiding/degrading when `cartUrl` is null, the sold-out row marking,
the ≥2 guard on compare, the ≥1 guard on showroom, and the 7-value contact reason enum.

### F5 (LOW) — `error` chunk swallowed after partial content

Spec (§2.2): `error` chunk → "show the friendly retry message". The widget sets
`streamErrored` (`ms-chat-widget.js:2063-2066`) but `finalizeStream` surfaces the message
only when **nothing** rendered (`streamErrored && !gotContent`, `:1928-1930`). A
mid-stream model error after some text/cards leaves the user with a silently truncated
answer (console-only error). Low impact, but it is a documented chunk → action mapping
the widget doesn't fully honor.

### F8 (INFO) — Tool-result `consentCopy` effectively unused

The capture card is built at `tool-input-available` (`buildToolCard`,
`ms-chat-widget.js:1219`) and immediately calls `fetchConsentCopy()` → a fresh
`GET /api/consent-copy`. The load-bearing `output.consentCopy` from the
`tool-output-available` chunk (§2.3) arrives moments later and only back-fills the cache
(`:2054-2057`) — usually after the GET is already in flight. Both paths are canonical and
serve byte-identical payloads, so this is compliant; it just spends an extra request per
offer and means the "seeded from the tool result" path in `WIDGET_SPEC.md` §6a rarely
actually supplies the rendered copy.

### F9 (INFO) — History tool parts: synthesized state, missing `output`

`accumulatePart` (`ms-chat-widget.js:1830-1833`) stores replayed tool parts as
`{ type: "tool-<name>", toolCallId, state: "output-available", input }` — `state` is set
to `output-available` as soon as `input` exists (before/without any output chunk) and the
`output` field is never persisted. A genuine `useChat`-assembled history would carry
`output` for completed calls. The backend demonstrably replays `update_customer_profile`
inputs from history today, but if it ever runs strict UIMessage validation (AI SDK's
`validateUIMessages` expects `output` when `state === "output-available"`), every
restored conversation would start failing. Cheap hardening: store `output` from
`tool-output-available`, or use `state: "input-available"`.

---

## 3. Consent form (legally load-bearing) — ✅ PASS on every rule

Checked against `AUDIT_BACKEND.md` §2.10 + §2.7:

1. **Canonical copy, never hard-coded** ✅ — the widget's `CONSENT_COPY` object holds UI
   chrome only (title/buttons/error strings); `transactionalLabel`, `marketingLabel`,
   `marketingBenefitHint`, `imprintUrl`/`privacyUrl`, `consentTextShown` come exclusively
   from the backend (tool result seed + `GET /api/consent-copy`), payload-validated
   (`validConsentCopy`), cached ≤60 s in memory, never persisted.
2. **Submit impossible without served copy** ✅ — button disabled until `renderConsent`
   runs; load failure → inline error + retry; no fallback text path exists
   (`ms-chat-widget.js:1042-1043, 1120-1139`).
3. **`consentTextShown` echoed verbatim** ✅ — `payload.consentTextShown =
   copy.consentTextShown` (`:1155`), never recomposed.
4. **Two separate checkboxes; transactional pre-checked (permitted), marketing always
   unchecked** ✅ — `consentRow(true, …)` / `consentRow(false, …)` (`:1098, 1106`), with
   the benefit hint beneath the marketing label and prominent styling
   (`.ms-chat-consent--marketing`, CSS `:932-951`) — prominence, never a pre-tick.
5. **Imprint/privacy links** ✅ — backend-served URLs, scheme-checked via `safeHref`,
   `target="_blank" rel="noopener noreferrer"` (`:1111-1115`).
6. **`email_capture_declined` exactly once on dismissal** ✅ — decline button replaces the
   card body, so it can't double-fire (`:1058-1066`); no widget-side
   shown/submitted/opted-in/confirmed events (server-side only) ✅.
7. **Success branching** ✅ — DOI hint appended only when
   `marketing.status === "pending"`; success unlocks in-memory-only
   `customer.email` attachment (never localStorage, reset on navigation) ✅.
8. **Error states** ✅ — 429 / 502+503 `upstream_unavailable` / network / generic all
   branch to the documented copy, form kept populated for retry (modulo F3).

### F11 (INFO) — Declined event semantics for the header entry point

The same card serves the header "Per E-Mail teilen" entry point, where there is no
`offer_email_summary` ask and no server-side `email_capture_ask_shown`. Declining that
card still emits `email_capture_declined` with empty `data` (`:1059-1060`), which
inflates declines relative to asks in the funnel. Also, `askNumber` (optional per §2.6)
is never populated. Cosmetic for analytics; no contract violation.

---

## 4. The `context` field — ✅ shape matches

- **Product context** `{ type: "product", productId, productTitle, recentlyViewed? }` —
  sent by the product CTA, the nudge, and product starters ✅.
- **Browsing context** `{ type: "browsing", recentlyViewed }` with entries
  `{ type: "product", id, name }` / `{ type: "category", id?, name }` — collection trail
  entries correctly remapped to `type: "category"` ✅; client pre-caps at 3 products +
  2 categories matching the server cap ✅; a lead category may transiently make 3 category
  entries but the server keeps the first 2, lead first — graceful ✅.
- No bare `type: "category"` context is ever sent (correctly avoided, `:1482-1491`) ✅.
- `messages: [] + context` fresh-open greeting implemented (`sendContextGreeting`) and
  used by the nudge ✅; context sent only with user-initiated requests, trail never
  transmitted as a heartbeat ✅.

### F10 (INFO) — Numeric product id on the CTA path

`openWithProduct` receives the theme's numeric `product.id`
(`snippets/ms-chat-widget.liquid:61`, `ms-chat-widget.js:2328-2347`) while the catalog
ids are slugs — the backend validates and silently drops the context's product part. This
is a *documented, deliberate* trade-off (`WIDGET_SPEC.md` §9a: the primer message carries
the title in text). Note the snippet already injects `productHandle` and the
nudge/starter paths use it (`PAGE_CTX.productHandle || productId`) — the CTA's
data-attribute path is the only one that doesn't, so the context grounding (specs/stock
in the pre-retrieved block) is lost precisely on the highest-intent entry point.
Low-cost improvement when code changes are allowed.

---

## 5. Error envelopes / statuses — `/api/chat` and general

`handleChatHttpError` (`ms-chat-widget.js:2093-2132`):

- **429** → rollback, `Retry-After` parsed (default 30 s), input locked for the window,
  documented German hint ✅
- **401 / 403** → console diagnosis for the operator + generic "Chat ist gerade nicht
  verfügbar." ✅
- **400 `payload_too_large`** → "start a new chat" notice; the action clears persisted
  history **and rotates the session id** ✅ (§2.1 / `WIDGET_SPEC` §8)
- **5xx / `upstream_unavailable` / `internal_error` / network / aborted stream** →
  friendly retry message; the user's typed text is restored on rollback ✅
- Status checked before reading the body as a stream ✅; partial-content network failures
  keep the partial content ✅.

### F4 (LOW) — Transient hydration failure poisons the product cache

`hydrate()` writes `productCache[id] = null` on **any** non-OK response or network error
(`ms-chat-widget.js:493-502`), and the cache is consulted before every future fetch. The
contract reserves `null` for *unknown ids*; here a single 429 burst (products bucket
60/60 s) or a network blip marks every id in the batch unknown for the rest of the page
session — `show_product`/`compare_products`/`suggest_showroom` then hit their
render-nothing guards permanently, with no retry path. Distinguishing "failed" (don't
cache / retry later) from "unknown" (cache `null`) would fix it. (`buildAddToCart`'s own
fetch also warms the cache with `null`s on partial data, `:756-759`, same effect.)

### F12 / F13 (INFO) — CORS edge realities

- `Retry-After` is not a CORS-safelisted response header; unless the backend adds
  `Access-Control-Expose-Headers: Retry-After` (not documented in `AUDIT_BACKEND.md`
  §2.0's CORS inventory), `res.headers.get('Retry-After')` returns `null` cross-origin
  and the widget always locks for its 30 s fallback (`:2099-2101`). Behavior degrades
  safely; worth confirming backend-side.
- §2.0 documents that a non-allowlisted origin gets the 403 envelope **without** CORS
  headers — the browser then rejects the fetch, so the widget's explicit 403 branch
  (`:2110-2115`) is unreachable in the real misconfig scenario; the network-error path
  handles it with the generic retry message instead of the "unavailable" message +
  operator console hint. Graceful either way; the dedicated branch only fires for
  same-origin/proxied setups.

---

## 6. KPI telemetry

- Widget-emitted funnel event is **only** `email_capture_declined` ✅; the four
  server-side funnel events are never duplicated ✅ (explicit comments at `:1162-1163`).
- All other events (`chat_opened`, `chat_closed`, `message_sent`,
  `product_cta_clicked/opened`, `add_to_cart_clicked`, `showroom_clicked`, `nudge_*`,
  `starter_*`, `launcher_attention_played`) match the `WIDGET_SPEC` §9b inventory
  exactly; names ≤120 chars; `data` always a plain object; no message text or browsed
  product names ✅.
- Fail-silent `fetch` + `keepalive`, response never read; `sendBeacon` only as a
  no-`fetch` last resort (cannot set the documented headers — practically unreachable
  in any browser that runs the rest of the widget) ✅.

---

## 7. `WIDGET_SPEC.md` vs the widget (spec drift)

### F6 (LOW, doc) — §5 still documents the wrong wire protocol

`WIDGET_SPEC.md` §5 steps 3–4 instruct parsing "each `data:` JSON event into a *part*"
and dispatching on part types per `BEHAVIOR_REFERENCE` — the inherited backend finding
**A1**: the wire carries chunks, not parts. The widget code is **correct** (it implements
the chunk protocol of `AUDIT_BACKEND.md` §2.2 and even tolerates legacy part shapes for
restored history); only the spec text is stale. Same for `BEHAVIOR_REFERENCE.md` §1's
`-partial`/`-result` suffix description (backend finding A2 — those types never occur;
the widget's `startsWith` matching is harmless).

### F7 (LOW, doc) — §6 cart-link description contradicts itself and the backend

`WIDGET_SPEC.md` §6 ("Cart action: the `add_to_cart` button is a **link to
`product.shopifyCartUrl`**"), the §6 CTA-labels paragraph, and the acceptance checklist
("cart button links to `shopifyCartUrl`") predate the multi-product cart. The backend
ground truth (§2.3) and `API_CONTRACT.md` §2 both mandate the **top-level `cartUrl`** —
which is what the widget correctly does (`buildAddToCart`, dedicated fetch to obtain the
combined permalink, `:738-812`). Spec text should be re-synced. Related minor staleness:
§6 maps `show_product`/`add_to_cart` to the `?id=` form; the widget always uses the
equivalent `?ids=` form (explicitly equivalent per contract — cosmetic).

### F14 (INFO, doc) — `show_product` card contents: contract vs behavior-reference disagree

`API_CONTRACT.md` §2's `show_product` widget action says render `shortDescription`;
`BEHAVIOR_REFERENCE.md` §2.1's authoritative card layout (image, series badge, name,
tags, price, 4 specs, reason, delivery footer) does **not** include it. The widget
follows BEHAVIOR_REFERENCE (no `shortDescription`; `reason` placed after the specs rather
than "below the price"). Resolve in the docs; no widget behavior is clearly wrong.

### Verified as matching (spec → widget, no action)

- Snippet form factor: single Liquid snippet, asset-file layout, `MS_CHAT_CONFIG`
  injection, included once before `</body>` (`layout/theme.liquid:258`); gated by
  `ai_advisor_enabled`; `/cart` + `checkout` hard-excluded; operator excluded-templates
  setting honored; graceful no-launcher + console warning when `chatKey` is empty.
- Session/persistence (§3): `ms-chat-sid`, history keyed per sid, restored on init,
  trimmed to 40, cleared + sid rotated on new chat, silent in-memory fallback.
- Welcome state, starters (context-seeded, contract-valid contexts, disabled while
  streaming/rate-locked), nudge frequency/dismissal/trigger rules, launcher attention
  once per session, reduced-motion handling, share-button visibility rules,
  view-mode persistence + `ms-chat-expanded` migration — all per §§4, 9c.
- Markdown subset: exact documented regex, DOM-node rendering (no `innerHTML` on model
  text), scheme-checked links, newline → paragraph.
- Hydration: in-session cache, 10-id chunking, partial results, sold-out badge +
  "Ausverkauft — nicht im Warenkorb" row note, comparison table built from
  `specifications`/price/`deliveryTime` only (no dimensions/targetGroup), horizontal
  scroll.
- Privacy posture: trail localStorage-only, capped 5 / pruned 3 d, never transmitted
  outside user-initiated chat requests; KPI events carry no names/text; `customer.email`
  in memory only.

---

**Recommended fix set (when changes are allowed), smallest first:** align the default
`apiBase` (F1); add a 429/`Retry-After` branch to the contact form and a lockout to the
capture form (F2/F3); stop caching transient hydration failures as `null` (F4); surface
the stream `error` chunk even after partial content (F5); pass `productHandle` through
the product CTA (F10); persist tool `output` in history (F9); re-sync `WIDGET_SPEC.md`
§5/§6 with the real chunk protocol and `cartUrl` semantics (F6/F7).

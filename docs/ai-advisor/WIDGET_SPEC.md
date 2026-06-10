# Widget spec — motionsports.de Shopify chat widget

The deliverable: a **floating chat widget** for the motionsports.de
Shopify storefront. It talks to the headless chat backend documented in
`API_CONTRACT.md` and renders exactly the behavior documented in
`BEHAVIOR_REFERENCE.md`.

You do **not** have the backend repo. Everything you need about the wire
protocol is in `API_CONTRACT.md`; everything you need about rendering is
in `BEHAVIOR_REFERENCE.md`. This file specifies the *shipping form* of
the widget and the requirements it must meet.

---

## 1. Form factor & constraints

- **A Shopify theme snippet.** Ship a single Liquid snippet (e.g.
  `snippets/ms-chat-widget.liquid`) that the theme includes near the end
  of `theme.liquid` (before `</body>`), gated by an `ai_advisor_enabled`
  theme setting so it can be toggled without code changes. It contains
  the widget's markup root, its CSS, and its JS — or links to asset files
  (see below).
- **Page exclusions.** The widget MUST NOT render on `/cart` or any
  `/checkout` route. Gate this in the snippet via Liquid (e.g.
  `{% unless template contains 'cart' %}…{% endunless %}`). Additionally,
  expose a theme setting for an **excluded-templates list** so the
  operator can hide the widget from further templates (e.g. specific
  landing or contact pages) without code changes. Note that Shopify's
  checkout is not a normal theme template on most plans and the widget
  cannot reach it anyway; the meaningful exclusion is `/cart`.
- **Vanilla JS + CSS. No framework, no build step.** No React, no Vue, no
  bundler, no npm. Plain ES modules / a single IIFE script and hand-written
  CSS. It must run by dropping the snippet into a theme — nothing to
  compile.
- **Self-contained & isolated.** The widget must not collide with theme
  styles. Scope every selector under a single root (e.g. `.ms-chat`
  prefix on all classes) — or, preferably, render inside a **Shadow DOM**
  root so storefront CSS can't leak in and the widget CSS can't leak out.
  All injected DOM lives under one container element appended to
  `<body>`.
- **Asset layout** (recommended): keep CSS and JS in
  `assets/ms-chat-widget.css` and `assets/ms-chat-widget.js`, and have
  the snippet `{{ 'ms-chat-widget.css' | asset_url | stylesheet_tag }}` /
  `<script src="{{ 'ms-chat-widget.js' | asset_url }}" defer>`. The only
  thing that *must* live in the Liquid snippet itself is the injected
  config (§2). Inlining everything in the snippet is acceptable too.
- **No external runtime dependencies.** No CDN libraries. The SSE parsing,
  markdown subset, and DOM building are all hand-rolled. (The icons in the
  old UI came from `lucide-react`; reproduce them as small inline SVGs or
  a lightweight unicode/emoji fallback.)

---

## 2. Configuration injected via Liquid

The snippet reads settings from Liquid and hands them to the JS. At
minimum:

```liquid
<script>
  window.MS_CHAT_CONFIG = {
    apiBase: "https://chat.motionsports.de",
    chatKey: {{ settings.ms_chat_shared_secret | json }},
    // optional overrides:
    allowedFromTheme: true
  };
</script>
```

- `apiBase` — the backend origin (`https://chat.motionsports.de`).
- `chatKey` — the shared secret, read from a **theme/app setting**
  (`settings.ms_chat_shared_secret`, configured in `settings_schema.json`
  so a non-developer can paste it in the theme editor). This becomes the
  `x-ms-chat-key` header on every `/api/chat` and `/api/contact` request.
  See the security note in §9.

The JS must fail gracefully (log a warning, not throw, don't render the
launcher) if `chatKey` is empty.

---

## 3. Session id and conversation persistence

On first interaction, generate and persist a stable session id, exactly
as in `API_CONTRACT.md` §5:

```js
let sid = localStorage.getItem("ms-chat-sid");
if (!sid) { sid = crypto.randomUUID(); localStorage.setItem("ms-chat-sid", sid); }
```

Send it as the `x-ms-session` header on **every** request to `/api/chat`,
`/api/contact`, and `/api/products`. (Products doesn't require the chat
key but should still carry the session id for rate-limit keying.)

Conversation state lives **only** in the widget (the backend persists
nothing). **The widget MUST persist the message history to
`localStorage`** keyed by session id, so the conversation survives page
navigation across the storefront. Shoppers routinely navigate between
product pages mid-conversation; a chat that resets on every nav is a
poor experience and not acceptable.

Persistence rules:

- Restore the message list from `localStorage` on widget init; if a
  history exists, skip the welcome state and show the messages.
- Persist after every user send and after every completed assistant
  message (don't write on every streamed token — too noisy).
- Clear the persisted history when the user **explicitly starts a new
  chat** (e.g. via the start-new-chat affordance after the 40-message
  cap, §8). Rotate the session id at the same time so rate-limit windows
  reset cleanly.
- Cap the persisted payload (e.g. trim to the last 40 messages, matching
  the backend's cap) to keep `localStorage` writes cheap.
- If `localStorage` is unavailable (private browsing, quota exceeded),
  fall back silently to in-memory state for the page session — never
  throw.

---

## 4. UI structure & states

### 4.1 Launcher button

- A floating circular button, fixed to a bottom corner (bottom-right by
  default), above storefront content (high `z-index`, but below modals if
  the theme has any). Frame colors come from theme tokens (white surface +
  2px accent/black border), do not hardcode a hex. The button shows the
  **animated brand mark** (§4.1a) in its **full-motion** variant, filling
  the button edge-to-edge, plus a soft pulsing halo — the launcher is the
  one place where drawing the eye is the goal.
- Clicking it toggles the panel open/closed. While the panel is open the
  launcher is hidden (the close (×) lives in the panel header).
- **Beta badge (feature 10):** a small, subtle "Beta" pill sits on the
  launcher's top edge (accent fill, uppercase, ~0.6rem) so users know the
  advisor is in development. It lives *inside* the launcher button
  (decorative, `aria-hidden`; the launcher's `aria-label` is
  "Chat öffnen (Beta)"), so it hides with the launcher while the panel is
  open, never blocks the click, and stays within the launcher's safe-area
  offsets on mobile.

### 4.1a The animated brand mark (`.ms-chat-logo`)

- The Mo logo is **no longer an image asset**: it is a self-contained,
  pure-CSS, Siri-style **orb** — soft, glowing multi-color light ribbons
  (sky blue, violet, pink, teal, plus a warm amber accent) that gently
  flow and breathe over a dark rounded bubble. Implementation: the
  `.ms-chat-logo` root span carries the dark bubble (radial gradient,
  `overflow: hidden`, pill radius); two pseudo-elements carry the light
  layers — a slowly rotating conic-gradient **ribbon ring** (cropped by a
  radial `mask-image`) and a counter-rotating set of drifting radial
  **glows** — softened with `filter: blur(...)`. No image file, no
  external request, no library; drop the class on any empty `<span>`.
- **Seamless loop:** the ribbon rotates a full 360° linearly and the glow
  layer uses symmetric keyframes, so there is no visible loop seam.
- **Crisp at any size:** everything is gradient-based, so the mark scales
  from the 68px launcher down to the 36px avatar/CTA. Two custom
  properties tune it per context: `--msc-logo-dur` (base loop duration;
  longer = calmer) and `--msc-logo-blur` (glow softness; scale roughly
  with rendered size). The component intentionally does not depend on the
  `--msc-*` theme tokens, so it also works outside `.ms-chat-root` (the
  product-page CTA).
- **Placement rules — animated where it helps, calm where it doesn't:**
  - **Launcher:** full motion (~9s base loop) + a soft pulsing outer halo.
  - **Product-page CTA:** the same orb slowed to a gentle ~22s loop, so it
    reads as alive without being noisy next to body copy.
  - **In-chat assistant avatar:** **static** — animation disabled, leaving
    a still gradient frame. A constantly-moving element next to every
    message would hurt readability.
- **Reduced motion:** under `prefers-reduced-motion: reduce` **all**
  variants (launcher, halo, CTA) freeze to the static gradient frame.
- The previous artwork (`assets/ms-chat-logo-v2.svg`) is no longer
  referenced by the widget or the product template.

### 4.2 Expandable panel

- An anchored panel that expands from the launcher: a header, a scrollable
  message area, and an input row — i.e. the same three-part chat layout
  the old full-page UI had, shrunk into a panel.
- **Header**: the chatbot's name "**Mo**" (feature 11 — same wordmark type
  treatment, bold accent; replaces the "**motion**sports" wordmark, which
  remains in the welcome state) + header buttons: a **"Per E-Mail teilen"
  text button** (feature 7 — opens the email-summary capture form on demand,
  see §6a; hidden until the first user message, see below), an
  **expand/enlarge toggle** (diagonal-double-arrow icon, desktop only — see
  §7), a new-chat button, and a close button.
- **Share button visibility (feature 7):** in a new conversation with no
  message sent the share button is **hidden**. As soon as the first user
  message is sent (and whenever a non-empty history is restored from
  `localStorage`), it appears in the header with a subtle fade/scale
  blend-in (~420ms, disabled under `prefers-reduced-motion`) and stays
  available for the rest of the conversation. It is a real `<button>`,
  keyboard-focusable, with an `aria-label`; clicking it does exactly what
  the old share icon did (`openCaptureForm()`).
- **Message area**: shows the **welcome state** (`BEHAVIOR_REFERENCE` §4)
  until the first message **and** when no persisted history exists. If a
  history was restored from `localStorage`, render it directly and skip
  the welcome state.
- **Bubble styling** (feature 7): **user** messages take the subtle grey
  fill (the theme's foreground token at low alpha); **assistant** messages
  are **unfilled** with a solid 1.5px foreground/black border, and are
  preceded by a small **logo avatar** (the **static** variant of the
  animated brand mark, §4.1a — calm by design next to message text). The typing
  indicator uses the same unfilled-bordered treatment.
- **Input row**: growing textarea, Enter-to-send (Shift+Enter = newline),
  an optional **voice-input mic button**, the send button, and the
  `"KI-Fitnessberater – Antworten können Fehler enthalten"` disclaimer. Input
  disabled while a response streams.
- **Voice input** (Web Speech API): a mic button left of send dictates German
  (`de-DE`) speech into the textarea, with live interim text and append-to-typed
  behaviour; tap again (or send) to stop. It is **feature-detected** — only
  rendered where `SpeechRecognition`/`webkitSpeechRecognition` exists
  (Chrome/Edge/Android); on unsupported browsers (Firefox, some iOS) the button
  is simply absent and typing is unaffected. The mic shows a recording state
  (accent fill + pulse) and is disabled alongside the rest of the composer while
  streaming/rate-limited. Audio is processed by the browser's own speech service
  — **no audio reaches our backend**. Mic-permission denial surfaces an inline
  notice.
- **Typing indicator**: three-dot bounce in an assistant bubble while
  submitted but no visible assistant content yet.

### 4.3 Desktop vs mobile (see §7).

### 4.4 Enlarge / expand (feature 6)

- The header expand toggle switches the **desktop** panel between its
  normal size and a larger size, capped to the viewport via sensible
  `max-width`/`max-height`. The icon flips between an expand
  (diagonal-double-arrow) and a shrink glyph.
- **Desktop heights are viewport-relative:** the default panel keeps its
  width (410px) at **~2/3 of the viewport height** (`66dvh`); the enlarged
  panel keeps its width (560px) at **the full available viewport height**
  minus the design's 20px top/bottom safe margin
  (`calc(100dvh - 40px)`, matching the existing `max-height`). The message
  area scrolls within these heights and the input row stays pinned.
- The chosen size is **persisted for the session** (`localStorage` key
  `ms-chat-expanded`) and re-applied on init.
- **No effect on mobile**: the expanded rule is scoped to a desktop media
  query, so on narrow viewports the near-full-screen inset (§7) always
  wins.

### 4.5 Backdrop (feature 8)

- While the panel is **open**, a semi-transparent dark **backdrop**
  (`rgba(0,0,0,0.4)`) is rendered over the storefront so the chat comes
  into focus like a modal. `backdrop-filter: blur(6px)` (feature 5 — raised
  ~50% from the original 4px) is layered on as a **progressive
  enhancement** that degrades to just-dim where unsupported.
- **Clicking the backdrop closes the panel.**
- **z-index ordering**: storefront < backdrop < panel; the launcher is
  hidden while open. The backdrop also provides the dimmed surround that
  shows around the mobile inset (§7).

---

## 5. Chat flow (SSE consumption of `/api/chat`)

For each user send:

1. Append the user message to local state and render it.
2. POST to `${apiBase}/api/chat` with:
   - headers: `Content-Type: application/json`, `x-ms-chat-key: <chatKey>`,
     `x-ms-session: <sid>`.
   - body: `{ messages: UIMessage[] }` — the **entire** conversation so
     far (the backend reconstructs the customer profile from full history
     each turn; see `API_CONTRACT.md` §2). Each message is
     `{ id, role, parts: [{ type: "text", text }] }`.
3. Read the response as a **stream** and parse the AI SDK UI-message
   stream (SSE). Use `fetch` + `response.body.getReader()` +
   `TextDecoder`, buffering by lines and parsing each `data:` JSON event
   into a *part*. (Do **not** use `EventSource` — it can't send custom
   headers or a POST body.)
4. Maintain a "current assistant message" and apply each incoming part:
   - text part → append `text` to the assistant bubble (re-render the
     markdown subset, `BEHAVIOR_REFERENCE` §3).
   - tool part → dispatch per `BEHAVIOR_REFERENCE` §2, keyed by
     `toolCallId` (update in place, render only once `input` exists, skip
     the two silent tools).
5. On stream end, finalize the assistant message, persist the updated
   history to `localStorage` (§3), and re-enable input.

Treat malformed/partial JSON lines defensively (buffer until a full line
arrives; ignore keep-alive/empty lines).

---

## 6. Product hydration & tool cards

Tool cards reference products by id only; the widget hydrates them from
`GET ${apiBase}/api/products` (`API_CONTRACT.md` §3):

- `show_product`, `add_to_cart` → `?id=<id>` (single).
- `compare_products`, `suggest_showroom`, `show_contact_form` (when
  `productIds` present) → `?ids=a,b,c`.
- Cap **10 ids/request**; unknown ids come back as `null` at their index
  — render partial results, never abort.
- Response is cacheable (60s); a small in-memory cache keyed by id avoids
  refetching the same product within a session.
- Render each card exactly per `BEHAVIOR_REFERENCE` §2, including the
  "render nothing" guards (missing product → no card; compare needs ≥2;
  showroom needs ≥1). Remember the comparison table **omits**
  dimensions/weight/target-group rows (not in the public response).
- **Card styling.** All five tool cards (product, compare, quick-checkout/
  add-to-cart, showroom, contact/email-capture) share Mo's **light-blue
  accent background** — the same low-alpha tint of the theme secondary token
  used by the assistant message bubbles — so they read as part of the
  assistant's response rather than disconnected white panels. Card body text
  uses the **same font size as the chat messages** (the reduced chat body
  size). Legibility is preserved with inner white surfaces behind the product
  image, comparison table, and form inputs; the primary CTA stays the dark
  accent pill and the secondary button keeps a solid (non-transparent) surface
  so both stay distinct and tappable against the blue.

Cart action: the `add_to_cart` button is a **link to
`product.shopifyCartUrl`** opening in a new tab — it does not call any
API. Product/showroom links go to `shopifyUrl` /
`https://motionsports.de/pages/showroom-munchen-grobenzell`, new tab,
`rel="noopener noreferrer"`.

**Prominent in-chat CTAs (feature 2 / KPI driver).** The primary action
in each tool card is a clearly styled **primary button** (theme pill,
brand color, prominent/full-width), not a subtle text link — these are the
highest-value clicks and must look tappable. Labels: `"Zum Produkt"`
(product card + each comparison column), `"In den Warenkorb"`
(add-to-cart, links to `shopifyCartUrl`), `"Showroom ansehen"` (showroom).
The render-nothing guards and link targets from `BEHAVIOR_REFERENCE` are
unchanged — only the visual prominence.

---

## 6a. Email-summary capture form (GDPR double opt-in)

The widget can email the shopper a summary of the conversation plus a
prefilled cart, gated behind a GDPR-compliant consent flow. The wire
protocol is `API_CONTRACT.md` §7 (`POST /api/capture-email` +
`GET /api/confirm-marketing`). All UI lives in
`assets/ms-chat-widget.{js,css}` (every selector prefixed `.ms-chat*`).

### Two entry points, one form

The **same** capture card is rendered from two places:

1. **Assistant offer** — when the chat stream contains the
   `offer_email_summary` tool part (`API_CONTRACT.md` §2), the widget renders
   the card inline in the assistant message, using the tool's `message` as the
   intro and its advisory `productIds` as a cart preview. It is added to
   `VISIBLE_TOOLS` and keyed by `toolCallId` like the other tool cards.
2. **"Per E-Mail teilen" header button** — the text button in the panel
   header (`§4.2`; visible once the first user message is sent) calls
   `openCaptureForm()`, which opens the panel and drops the same card into the
   message area with a default intro, so the user can request the summary at
   any time. A not-yet-submitted card already on screen is reused rather than
   stacked. Also exposed as `window.MS_CHAT.openEmailSummary()`.

### Card contents

- An **email** input (real `<label for>` + `<input type="email">`),
  client-side validated with `^[^@\s]+@[^@\s]+\.[^@\s]+$` before sending.
- A **transactional** consent checkbox — *required* to submit; you can't email
  a summary without consent to email it. The user can submit with **only** this
  box ticked (get the summary without opting into marketing).
- A **separate marketing** consent checkbox — **UNCHECKED by default**, never
  pre-ticked, never bundled into the transactional control.
- A submit button, an inline error line, and a privacy caption.

**Legal copy.** The consent strings are PLACEHOLDER pending lawyer approval and
live in **one place** — the `CONSENT_COPY` object near the top of
`ms-chat-widget.js`. The exact `transactionalLabel` and `marketingLabel` shown
to the user are sent verbatim (joined by `" | "`) as `consentTextShown` for
Art. 7 proof, so editing the labels keeps the audit trail in sync.

### Accessibility

- Each checkbox is a real `<label>` wrapping a real `<input type="checkbox">`
  (clicking the text toggles it), keyboard-operable with a visible focus ring.
- The marketing consent text wraps freely and is **never truncated**
  (`overflow-wrap: anywhere`), so the full legal text is always readable.
- Tap targets and inputs are sized for mobile; the card flows within the panel.

### Submit behaviour

On submit the widget POSTs to `${apiBase}/api/capture-email` with headers
`Content-Type`, `x-ms-chat-key`, `x-ms-session`, and body:

```jsonc
{ "sessionId", "email", "transactionalConsent": true, "marketingConsent", "consentTextShown" }
```

- On **success** (`200`): replace the form with a success state —
  *"Zusammenfassung gesendet! Falls du Angebote abonniert hast, bestätige bitte
  den Link in der E-Mail."*
- On **error**: show an inline message and **keep the form populated for
  retry** (re-enable the submit button). `429 rate_limited` →
  *"Zu viele Anfragen — bitte kurz warten."*; `502/503 upstream_unavailable`
  and network failures → *"Senden gerade nicht möglich — bitte später erneut
  versuchen."*; otherwise the backend's user-safe message or a generic fallback.
- Fires `track('email_capture_submitted', { marketing: <bool> })`
  (fail-silent telemetry per §9b).

---

## 7. Mobile responsiveness

- On narrow viewports (≈ ≤ 640px) the panel goes **near-full-screen**
  (feature 8) — **not** true full-screen: a small inset/margin on **all
  sides** (respecting `env(safe-area-inset-*)`) so a sliver of the dimmed
  storefront backdrop (§4.5) shows around the edges, matching the
  modal-in-focus look. The panel keeps a rounded corner + border. The
  close button stays reachable.
- The launcher stays out of the way of Shopify's own sticky elements
  (cart drawer, mobile nav). Respect safe-area insets
  (`env(safe-area-inset-*)`) so it isn't hidden behind the iOS home bar.
- Tap targets ≥ 44px; the input must not be obscured by the mobile
  keyboard (let the panel scroll / use `dvh` units).
- The comparison table scrolls horizontally inside the panel rather than
  overflowing it.

---

## 8. Error & edge-case handling

The backend uses a stable error envelope
(`{ "error": { "code, message } }`); handle these gracefully:

- **429 `rate_limited`** (chat bucket 20/60s, products 60/60s). Read the
  `Retry-After` header (seconds), **disable the input** for that long,
  and show the hint *"Zu viele Anfragen — bitte kurz warten."* Re-enable
  when the window passes.
- **401 `unauthorized`** — wrong/missing `x-ms-chat-key`. This is a
  **misconfiguration** (the theme setting is wrong), not a user error.
  Show a generic *"Chat ist gerade nicht verfügbar."* to the shopper and
  `console.error` the real cause for the operator. Don't retry in a loop.
- **403 `forbidden`** — origin not allowlisted. Same treatment as 401
  (config/deploy issue): generic unavailable message + console error.
- **400 `payload_too_large`** on `/api/chat` — the 40-message cap was
  hit. Surface a **"start a new chat"** affordance: a message explaining
  the chat got long, and a button that clears the local conversation
  (clearing the persisted history per §3 and rotating the session id) so
  the user can continue fresh.
- **400 `bad_request`** — shouldn't happen with correct payloads; show
  the generic unavailable message and log.
- **5xx / `upstream_unavailable` / `internal_error`** and **network
  errors / fetch rejection / aborted stream** — show a friendly
  *"Es gab ein Problem. Bitte versuch es gleich nochmal."* in the message
  area, re-enable input so the user can retry. Don't lose what the user
  typed.
- **Contact form** errors (`/api/contact`, `API_CONTRACT.md` §4): show
  the inline error, keep the form populated for retry; on `502
  upstream_unavailable` use *"Senden gerade nicht möglich — bitte später
  erneut versuchen."*

For non-streaming responses, detect errors by `!response.ok` and parse
the JSON envelope to branch on `error.code`. For the chat stream, a
non-200 status returns the JSON envelope (not a stream) — check status
before starting to read the body as a stream.

---

## 9. Security note (must be honored)

The `x-ms-chat-key` shared secret is injected into the storefront via
Liquid and is therefore **visible to anyone who views the page source or
network traffic**. This is **expected and acceptable** for a public
storefront widget — but only because the backend pairs the secret with
two other controls that are already implemented server-side
(`API_CONTRACT.md` §1):

- an **origin allowlist** (requests are only honored from
  `https://www.motionsports.de` / `https://motionsports.de`), and
- **rate limiting** (sliding window keyed by `x-ms-session`/IP), plus
  hard spend caps.

So the secret is **not** an authentication boundary; it's one factor that
— combined with the origin check and rate limit — forces an abuser to
forge the Origin **and** know the key **and** distribute across IPs.
**The widget MUST therefore be deployed only on the allowlisted
storefront origin, and the shared secret MUST never be presented as
real auth.** Do not add client-side "hiding" of the key (obfuscation
gives false assurance); rely on the documented server-side controls. If
the storefront origin ever changes, the backend's `ALLOWED_ORIGINS` must
be updated in lockstep or the widget will get `403 forbidden`.

`GET /api/products` deliberately does **not** require the secret (it
exposes only storefront-visible fields), so product hydration works even
where the key isn't sent.

---

## 9a. Product-page CTA & public API (feature 2)

The widget exposes a global so a storefront template can open the chat
primed about a specific product:

```js
window.MS_CHAT.openWithProduct(productId, productTitle)
```

- It **opens the panel** and sends a short **product-primed user message**
  (e.g. *"Ich interessiere mich für „<Titel>". Kannst du mich zu diesem
  Produkt beraten?"*) so the assistant advises about that product. This is
  a normal chat turn, so it works whether the conversation is **fresh or
  already going** and **never wipes existing history**. The request also
  carries a `context: { type: "product", productId, productTitle }` field
  (the backend may use it; it is ignored otherwise). *(The current backend
  requires a non-empty prompt — an empty-`messages` "context-only" greeting
  is rejected with `Invalid prompt: messages must not be empty` — hence the
  primer message.)*
- It fires `track('product_cta_opened', { productId })` (see §9b).
- The product detail template (`templates/product.json`, the "USPs" /
  Kurzinfo block) renders an **outlined/bordered** button immediately
  **below the product bullet points**: the animated brand mark (the
  slow ~22s orb variant, §4.1a — gently alive, never noisy) + the
  text *"Detaillierte Beratung zu diesem Produkt"*, calling
  `openWithProduct(product.id, product.title)`. It is gated by
  `settings.ai_advisor_enabled` and styled distinct from (secondary to)
  the black Add-to-cart button above it.

## 9b. Telemetry (Phase 3 prep)

A tiny **fail-silent** helper `track(event, data)` sends a fire-and-forget
beacon of `{ event, sessionId, timestamp, data }` to `${apiBase}/api/kpi`
via `navigator.sendBeacon` (with a `fetch(mode:'no-cors')` fallback). Using
a beacon avoids a CORS **preflight** and produces **no console errors**, so
it harmlessly no-ops until the backend endpoint exists. The session id rides
in the **body** (beacons can't set an `x-ms-session` header). It sends
**event names + ids only — never message text**. Events: `chat_opened`,
`chat_closed`, `message_sent`, `product_cta_clicked` (`productId`),
`add_to_cart_clicked` (`productId`), `showroom_clicked` (`productIds`),
`product_cta_opened` (`productId`). This is pseudonymous analytics keyed
by the random session id.

## 10. Acceptance checklist

- [ ] Drops into a Shopify theme as a snippet; no build step; works with
      JS-only + CSS-only assets.
- [ ] Snippet is gated by an `ai_advisor_enabled` theme setting and is
      not rendered on `/cart` or `/checkout`; an excluded-templates
      theme setting lets the operator hide it on further templates.
- [ ] Brand colors come from theme tokens, not hardcoded hexes.
- [ ] Launcher + expandable panel; welcome state on first open with no
      persisted history.
- [ ] Animated CSS logo orb (§4.1a): full motion + halo on the launcher,
      slow variant on the product CTA, static avatar in chat; all variants
      freeze under `prefers-reduced-motion: reduce`.
- [ ] Generates/persists `x-ms-session`; sends it + `x-ms-chat-key` on
      the right requests.
- [ ] Conversation history is persisted to `localStorage` and restored
      on init so the chat survives page navigation across the
      storefront; cleared on "start new chat" with a session-id
      rotation; falls back to in-memory if `localStorage` is unavailable.
- [ ] Streams `/api/chat` over SSE via fetch+reader (not `EventSource`);
      concatenates text, renders the markdown subset safely (no
      innerHTML on untrusted strings).
- [ ] Renders all five tool cards per `BEHAVIOR_REFERENCE`, keyed by
      `toolCallId`, with the render-nothing guards; silently consumes
      `search_products` + `update_customer_profile`.
- [ ] Hydrates products via `GET /api/products`; cart button links to
      `shopifyCartUrl`.
- [ ] Inline contact form posts to `/api/contact`; success + error +
      retry states.
- [ ] Email-summary capture form (§6a) renders from both the
      `offer_email_summary` tool part and the header "Per E-Mail teilen"
      button (hidden until the first user message); two
      SEPARATE consents with the marketing box unchecked by default; posts
      to `/api/capture-email`; success + error + retry states; fires
      `email_capture_submitted`.
- [ ] Mobile full-screen behavior; safe-area aware; horizontal-scroll
      comparison table.
- [ ] Handles 429 (Retry-After), 401/403 (config), 400 payload_too_large
      (start-new-chat clears persisted history), 5xx + network errors —
      all without throwing.
- [ ] Secret only ever shipped to the allowlisted storefront origin;
      no false-auth claims; relies on backend origin allowlist + rate
      limit.
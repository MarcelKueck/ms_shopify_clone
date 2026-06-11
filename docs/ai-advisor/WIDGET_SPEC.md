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
  the theme has any). It is styled as a **liquid-glass button**: a thin
  light keyline over a barely-there translucent fill with a strong frosted
  `backdrop-filter: blur + saturate` (degrading to the faint translucent
  fill alone where unsupported). The **animated brand mark** (§4.1a) in
  its **full-motion** variant fills it edge-to-edge, so the button IS the
  clear glass sphere with the light-strands floating inside, plus a soft
  pulsing halo. The launcher is the prime place where drawing the eye is
  the goal.
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
  Siri-style **liquid-glass sphere** — a CLEAR frosted bubble (no dark
  fill) with a **chromatic rim light** (mint at the top, red bottom-left,
  blue bottom-right, via layered inset shadows) and a bundle of **true
  sine waves** flowing left-to-right inside. Implementation: the
  `.ms-chat-logo` root span carries the glass in pure CSS (a faint
  translucent fill + `backdrop-filter: blur + saturate` frost + the rim,
  `overflow: hidden`, pill radius); the waves are a tiny **inline SVG**
  (`LOGO_WAVES` in the JS — injected by `logoEl()` and, for the
  server-rendered product-CTA span, at `init()`): cubic-bézier
  **S-curves** that all start at `(0, 50)` and end at `(100, 50)` — the
  **same two anchor points** on the bubble's midline — and crest/trough
  in between with different amplitudes and phases. The cool bundle
  (blue → cyan → mint, 3 strands + a wide faint glow copy) crests left
  and troughs right; the warm bundle (cream → amber → orange → red,
  2 strands + glow) is mirrored, so the bundles cross like the reference.
  Strokes are painted by horizontal gradients that fade out at both ends
  (the bundle converges and dissolves at its shared origins); only a
  sub-pixel `blur(...)` is applied, so the strands stay **distinct**.
  No image file, no external request, no library.
- **Pinned-anchor motion / seamless loop:** the two `<g>` bundles are
  animated with CSS keyframes; the animation reads as the waves flowing
  left-to-right while staying attached at both ends. Only `scaleY`
  (amplitude breathing) and `skewX` (crest lean) are animated, about the
  viewBox centre (`transform-box: view-box`) — both transforms leave the
  midline, and therefore both anchor points, mathematically fixed. Three
  unevenly spaced keyframe stops per loop, two different bundle speeds
  and an offset phase make the wavelength/amplitude/phase drift feel
  random and organic, while symmetric keyframes (0% == 100%) keep each
  loop seamless; a `hue-rotate` swing shifts the colors as they move.
- **Crisp at any size:** everything is vector- and gradient-based (the
  SVG scales with its span; stroke widths are viewBox-relative), so the
  mark scales
  from the 96px welcome hero down to the 36px avatar/CTA. Custom
  properties tune it per context: `--msc-logo-dur` (wave cycle; longer =
  calmer), `--msc-logo-blur` (strand softness — keep small),
  `--msc-logo-rim` (rim-light thickness — scale roughly with rendered
  size) and `--msc-logo-base` (the translucent glass fill). The component
  intentionally does not depend on the `--msc-*` theme tokens, so it also
  works outside `.ms-chat-root` (the product-page CTA, which re-asserts
  the rim `box-shadow` past the kurzinfo block's reset).
- **Placement rules — animated where it helps, calm where it doesn't:**
  - **Launcher:** full motion (~7s base cycle) + a soft pulsing outer halo.
  - **Welcome state (empty chat):** a 96px full-motion orb is the hero of
    the panel — there is nothing to read yet, so motion is welcome here.
  - **Product-page CTA:** the same orb slowed to a gentle ~22s cycle, so it
    reads as alive without being noisy next to body copy.
  - **In-chat assistant avatar:** **static** — animation disabled, leaving
    a still gradient frame. A constantly-moving element next to every
    message would hurt readability.
- **Reduced motion:** under `prefers-reduced-motion: reduce` **all**
  variants (launcher, halo, welcome, CTA) freeze to the static frame.
- The previous artwork (`assets/ms-chat-logo-v2.svg`) is no longer
  referenced by the widget or the product template.

### 4.2 Expandable panel

- An anchored panel that expands from the launcher: a header, a scrollable
  message area, and an input row — i.e. the same three-part chat layout
  the old full-page UI had, shrunk into a panel.
- **Header**: the chatbot's name "**Mo**" (feature 11 — same wordmark type
  treatment, bold accent; replaces the "**motion**sports" wordmark) +
  header buttons: a **"Per E-Mail teilen"
  text button** (feature 7 — opens the email-summary capture form on demand,
  see §6a; hidden until the first user message, see below), a
  **layout-mode toggle** (desktop only — switches sidebar ⇄ centered modal,
  see §4.4; hidden on mobile), a new-chat button, and a close button.
- **Share button visibility (feature 7):** in a new conversation with no
  message sent the share button is **hidden**. As soon as the first user
  message is sent (and whenever a non-empty history is restored from
  `localStorage`), it appears in the header with a subtle fade/scale
  blend-in (~420ms, disabled under `prefers-reduced-motion`) and stays
  available for the rest of the conversation. It is a real `<button>`,
  keyboard-focusable, with an `aria-label`; clicking it does exactly what
  the old share icon did (`openCaptureForm()`).
- **Message area**: shows the **welcome state** until the first message
  **and** when no persisted history exists. The welcome state is the
  **96px animated brand orb** (§4.1a, full motion) with a single subtle
  prompt line beneath it ("Wie kann ich dir helfen?") — no wordmark, no
  further copy (visual replacement for the `BEHAVIOR_REFERENCE` §4
  text-based welcome). If a history was restored from `localStorage`,
  render it directly and skip the welcome state.
- **Bubble styling** (feature 7): **user** messages take the subtle grey
  fill (the theme's foreground token at low alpha); **assistant** messages
  are **unfilled** with a solid 1.5px foreground/black border, and are
  preceded by a small **logo avatar** (the **static** variant of the
  animated brand mark, §4.1a — calm by design next to message text). The typing
  indicator uses the same unfilled-bordered treatment.
- **Input area — unified composer** (supersedes the earlier "input row"
  and the compressed-view input tweak; identical in sidebar, modal and
  mobile fullscreen):
  - **One unified container:** the textarea and the action buttons live
    inside a SINGLE rounded surface with ONE shared border
    (`.ms-chat-composer`) — not a bordered textarea plus separate buttons.
    The textarea itself is **borderless and transparent** on the
    container's light surface; the focus ring is on the container
    (`:focus-within` accent border + soft glow), not the field. Clicking
    the container's padding focuses the textarea.
  - **Two-row internal layout:** the text sits on top (full width); a
    bottom control row holds the right-aligned actions — the mic
    (when Web Speech is supported) and the send button. The bottom row
    keeps a stable height whether or not send is shown.
  - **Soft large radius + generous padding:** corner radius is the block
    radius token + 8px (≈24px — soft, not a pill, not sharp) with
    comfortable internal padding; light theme tokens throughout (no dark
    input).
  - **Send appears on typing:** with an EMPTY input there is no visible
    send button (the mic is the persistent action). As soon as the input
    has ≥1 non-whitespace character the send button blends in (subtle
    fade/scale, ~160ms, collapsed-width so the mic glides over); emptying
    the input hides it again. Toggled centrally in `autoGrow()`
    (`.ms-chat-send--hidden`), so typing, voice dictation, send-clear and
    error-restore all stay in sync. Hidden = `visibility:hidden`, so it
    also leaves the tab order. Transition disabled under
    `prefers-reduced-motion`.
  - **Capped auto-grow + internal scroll:** the textarea auto-grows with
    typed lines up to a max height (120px ≈ 5 lines, the JS cap matches
    the CSS `max-height`), after which the container STOPS growing and
    the textarea scrolls internally (`overflow-y: auto`). It never grows
    unbounded and never pushes the panel layout.
  - **Quiet chrome:** muted placeholder, low-contrast ghost mic (accent
    fill + pulse only while recording), the dark accent send circle (↑)
    as the single strong element.
  - Enter sends, Shift+Enter inserts a newline; the whole composer is
    disabled while a response streams. The
    `"KI-Fitnessberater – Antworten können Fehler enthalten"` disclaimer
    sits centered directly beneath the container.
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

### 4.4 Desktop layout modes (feature 6, reworked)

> Supersedes the earlier enlarge/expand spec (410px × `66dvh` default,
> 560px enlarged, `ms-chat-expanded` key). The desktop panel now has two
> **layout modes** instead of two sizes.

- **MODE 1 — COMPACT = docked sidebar** (the default for new users): the
  panel docks to the **right edge**, **full viewport height**, compact
  width (410px). **No backdrop, no blur** — the storefront stays visible
  and interactive. The **page makes room**: while the sidebar is open the
  JS puts `ms-chat-page-shift` on `<html>` (`margin-right: 410px` +
  `overflow-x: hidden`), so the storefront reflows next to the chat with a
  smooth margin transition (an `ms-chat-page-anim` class is present only
  around the change, so a closed chat leaves `<html>` untouched). Sticky
  elements (the theme's desktop header is `position: sticky`) reflow with
  the layout; in the 641–749px band, where the theme switches its header
  to `position: fixed`, a companion rule pins the header's right edge to
  the sidebar so it shifts too. *(Fallback: if page reflow ever causes
  unresolvable layout breakage on the live theme, drop the page-shift
  rules and let the sidebar float over the right edge as an overlay.)*
- **MODE 2 — FULL = centered modal**: centered, near-fullscreen with a
  generous margin (`min(900px, 100vw - 128px)` × `calc(100dvh - 112px)`)
  so the **blurred + dimmed backdrop** (§4.5) shows at the edges and is
  **click-to-close**. The site is not interactive behind it.
- The header **mode toggle** switches sidebar ⇄ modal; its icon shows the
  *target* layout (a centered-window glyph in sidebar mode, a docked-panel
  glyph in modal mode), so it reads as a mode switch, not a zoom.
- The chosen mode is **persisted** (`localStorage` key
  `ms-chat-view-mode`, values `sidebar` | `modal`; a legacy
  `ms-chat-expanded=1` migrates to `modal`) and the launcher reopens the
  chat in the last-used mode. Toggling mid-conversation preserves the
  message-list scroll position (distance from the bottom is kept across
  the relayout).
- In both modes the message area scrolls inside the panel and the input
  row stays pinned. **No effect on mobile** (mode classes are scoped to a
  ≥641px media query and the toggle button is hidden on mobile).

### 4.5 Backdrop (feature 8, reworked)

- The backdrop (`rgba(0,0,0,0.4)` + `backdrop-filter: blur(6px)` as a
  progressive enhancement, degrading to just-dim) now appears **only
  behind the desktop centered modal** (§4.4 MODE 2). Clicking it closes
  the panel.
- The **sidebar mode renders no backdrop** — the storefront must stay
  interactive next to the docked panel.
- **Mobile renders no backdrop** — the fullscreen panel (§7) covers the
  site completely, so dim/blur would be invisible work and tap-outside
  cannot exist (close = the header X).
- **z-index ordering** unchanged: storefront < backdrop < panel; the
  launcher is hidden while open.

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

> Supersedes the earlier "near-full-screen with a small inset" spec: on
> mobile the panel is now **true fullscreen** with visual-viewport
> keyboard handling.

- On narrow viewports (≤ 640px) the panel is **TRUE fullscreen**: edge to
  edge, **no margin, no rounded corner, no visible storefront behind, no
  backdrop/blur** (§4.5). Close only via the header **X**. While open,
  `ms-chat-mobile-open` on `<html>` freezes page scrolling behind the
  chat (scoped to the mobile media query).
- **Keyboard handling (visual viewport):** the panel's height tracks the
  **visual viewport** — `100vh` → `100dvh` as CSS fallbacks, and while
  open the JS pins an inline px height from the `visualViewport` API
  (listening to its `resize`/`scroll` events) plus a
  `translateY(visualViewport.offsetTop)` re-pin for iOS's
  focus-auto-scroll. When the on-screen keyboard opens, the **input row
  stays just above the keyboard and the message list shrinks** and
  remains scrollable — the panel is never pushed up with the site showing
  through. If the user was reading the bottom, the list re-pins so the
  latest message + input stay in view (sending keeps both visible).
- **Safe areas:** the header keeps its `env(safe-area-inset-top)` padding
  (notch), the input bar its `env(safe-area-inset-bottom)` padding (home
  bar), and the fullscreen panel pads `env(safe-area-inset-left/right)`
  for landscape notches — nothing is clipped or hidden.
- **UX tuning:** tap targets ≥ 44px (header icon buttons are enlarged to
  44px on mobile), momentum scrolling in the message list
  (`-webkit-overflow-scrolling: touch`) with `overscroll-behavior:
  contain` so scrolling never chains to the page.
- The launcher stays out of the way of Shopify's own sticky elements
  (cart drawer, mobile nav). Respect safe-area insets
  (`env(safe-area-inset-*)`) so it isn't hidden behind the iOS home bar.
- The comparison table scrolls horizontally inside the panel rather than
  overflowing it; all tool cards, the capture form and the share button
  work unchanged in fullscreen.

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
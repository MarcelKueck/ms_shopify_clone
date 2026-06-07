# AI Advisor widget — file manifest & install guide

This is the authoritative list of every file the AI Advisor chat widget adds
or changes. Copy these into the live motionsports.de development theme exactly
as listed. New files are safe to upload as-is; the two modified files changed
by only the lines shown below, so you can hand-edit the live files instead of
overwriting them if you prefer.

The widget talks to the already-deployed headless backend (configured via the
**Backend URL** theme setting) and renders per
`docs/ai-advisor/{API_CONTRACT,BEHAVIOR_REFERENCE,WIDGET_SPEC}.md`.

---

## ⭐ Session update (2026-06-07) — voice input (Web Speech API) in the composer

Adds an optional **mic button** to the chat input row that dictates German
speech into the textarea. Pure front-end (browser Web Speech API) — **no
backend/API change**, no audio sent to our servers. **Re-upload both widget
assets**; the spec is docs-only.

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.js` | **MODIFIED** | ✅ Yes |
| `assets/ms-chat-widget.css` | **MODIFIED** | ✅ Yes |
| `docs/ai-advisor/WIDGET_SPEC.md` | **MODIFIED** | ❌ No (docs only — §4.2 input row) |

> **Browser support:** the mic button is **feature-detected** and only appears
> where `SpeechRecognition`/`webkitSpeechRecognition` exists (Chrome, Edge,
> Android Chrome). On Firefox and some iOS Safari versions it is simply not
> rendered — typed input is unchanged. Voice recognition runs through the
> **browser's own speech service** (in Chrome that means Google's); no audio is
> sent to the motionsports backend.

### `assets/ms-chat-widget.js` — what changed
- New `mic` SVG in the `ICONS` table; new module var `micBtn`.
- Mic button inserted **left of the send button** in `.ms-chat-input-controls`,
  created **only when `voiceSupported()`** is true.
- Voice block: `startVoice()` / `stopVoice()` / `toggleVoice()` / `setMicState()`
  using `SpeechRecognition` (`lang: 'de-DE'`, `interimResults: true`,
  `continuous: false`). Dictation **appends** to whatever is already typed, shows
  **live interim** text, and re-sizes the textarea via `autoGrow()`. `onend`
  resets the button and refocuses the textarea; `onerror` resets state and shows
  an inline **mic-permission-denied** notice for `not-allowed` /
  `service-not-allowed`.
- `updateInputState()` now also disables the mic and calls `stopVoice()` while
  streaming/rate-locked; `onSend()` calls `stopVoice()` so dictation can't keep
  writing after a message is sent.

### `assets/ms-chat-widget.css` — what changed
- `.ms-chat-mic` (44px round, outlined secondary surface so it doesn't compete
  with the accent send button) + hover/focus/disabled states.
- `.ms-chat-mic--recording` (accent fill + `ms-chat-mic-pulse` keyframes) for the
  live state; pulse disabled under `prefers-reduced-motion`.

### Dev-theme test checklist (this session)
1. **Button appears (supported browser)** — in Chrome/Edge/Android, open the
   panel: a round mic button sits just left of the send button.
2. **Dictation** — tap the mic, allow the permission prompt, speak in German →
   words appear live in the textarea (interim updates, then finalised). Tap the
   mic again to stop; the text remains, ready to edit/send.
3. **Append behaviour** — type some text first, then dictate → speech is appended
   after the typed text (not overwritten).
4. **Send stops it** — start dictating, then press send/Enter → the message sends
   and the mic stops (no leftover dictation writing into the next message).
5. **Recording state** — while listening the mic shows the accent fill + pulse;
   the pulse is absent if the OS has reduce-motion enabled.
6. **Permission denied** — block the mic permission → an inline notice explains
   to allow it; the button returns to idle.
7. **Disabled while streaming** — send a message; during the streamed reply the
   mic (like the textarea/send) is disabled and any active dictation stops.
8. **Unsupported browser** — in Firefox (or an iOS Safari without the API) the
   mic button is **absent** and typing works exactly as before.
9. **Sizes/mobile** — confirm the mic fits the input row in the compressed and
   enlarged desktop panels and the mobile near-full-screen panel.

---

## ⭐ Session update (2026-06-06b) — tool cards adopt the light-blue accent + chat font size

CSS-only polish so the in-chat **tool cards** stop looking disconnected from
the rest of the (now blue-tinted) chat. **One theme file to re-upload**, plus a
docs-only spec note.

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.css` | **MODIFIED** | ✅ Yes |
| `docs/ai-advisor/WIDGET_SPEC.md` | **MODIFIED** | ❌ No (docs only — §6 card-styling note) |

> No JS change was needed: all five tool cards (product, compare,
> quick-checkout/add-to-cart, showroom, contact/email-capture) already share the
> single `.ms-chat-card` wrapper, so styling them once covers them all.

### `assets/ms-chat-widget.css` — what changed
- **Card background → Mo's light-blue accent.** `.ms-chat-card` now fills with
  `rgb(var(--msc-secondary) / 14%)` — the **exact same** token/alpha used by
  `.ms-chat-bubble--assistant` (no new hardcoded hex) — with a matching
  `rgb(var(--msc-secondary) / 22%)` border. Applies to all five cards at once.
- **Font size matched to the chat.** `.ms-chat-card` is pinned to
  `font-size: 0.85rem; line-height: 1.45` (same as `.ms-chat-bubble`).
  Oversized bits scaled down proportionally: product name `1rem → 0.92rem`,
  prices `1.2rem → 1.05rem`, strike price `0.95 → 0.85rem`, reason/“why” blurb
  `0.88 → 0.85rem`, card body text `0.9 → 0.85rem`, form inputs `0.9 → 0.85rem`.
- **Buttons stay distinct/tappable on the blue.** Primary CTA is unchanged
  (dark accent pill, pops on the blue). The **secondary** button was transparent
  (would blend into the blue) → now a **solid** `rgb(var(--msc-bg))` surface with
  its border, so it reads as a real tappable control.
- **Legibility preserved with inner white surfaces.** Product image, comparison
  thumbs, checkout thumbs and form inputs already sit on white (`#fff`/`--msc-bg`)
  surfaces, so image/price/text contrast is kept. The **comparison table** now
  has solid cells (`--msc-bg`) with a slightly darker header row
  (`rgb(var(--msc-secondary) / 12%)`) so the table reads as a clean inset panel
  on the blue card (header row, borders, cells all readable).
- All values are `rem`/token-based, so it holds in the compressed and enlarged
  desktop panel sizes and in the mobile near-full-screen view.

### Dev-theme test checklist (this session)
1. **Product card is blue** — ask for a product; the product card background is
   the same light-blue as Mo's bubbles (not white), text/specs readable, the
   product image still sits on its white tile.
2. **Quick-checkout card is blue** — drive a quick-checkout / “Jetzt direkt
   bestellen” card; it’s the same light-blue, the name + price line is readable.
3. **Buttons stand out** — the primary CTA (e.g. “Zum Produkt”, “In den
   Warenkorb”) is the dark pill; any secondary button is a solid white-surfaced
   button — neither blends into the blue, both look tappable.
4. **Font matches** — card text is the same size as the chat bubbles (no card
   looks larger); prices/name still mildly emphasized but balanced.
5. **Compare table** — trigger a comparison; the table is readable on the blue
   (white cells, tinted header, visible borders) and still scrolls horizontally.
6. **Sizes/mobile** — confirm 1–5 hold in the compressed panel, the enlarged
   desktop panel, and the mobile near-full-screen panel.

---

## ⭐ Session update (2026-06-06) — "Mo" rebrand, new avatar, bubble/font/input polish, multi-product checkout

Seven changes across **three theme files** (re-upload all three) plus the
already-replaced logo asset.

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-logo.svg` | **REPLACED** (new multi-color face avatar) | ✅ Yes |
| `assets/ms-chat-widget.css` | **MODIFIED** | ✅ Yes |
| `assets/ms-chat-widget.js` | **MODIFIED** | ✅ Yes |
| `templates/product.json` | **MODIFIED** | ✅ Yes (default product template) |
| `assets/ms-chat-logo-white.svg` | **REMOVE** (no longer referenced) | 🗑️ Delete from theme |
| `assets/ms-chat-logo-black.svg` | **REMOVE** (no longer referenced) | 🗑️ Delete from theme |

> **Logo change:** the black/white contrast variants are gone; there is now a
> single full-color `ms-chat-logo.svg` (a multi-color human-face avatar). It is
> shown **AS-IS in full color** (no `currentColor`/mask tint) for both the
> launcher and the assistant avatar. Upload the new `ms-chat-logo.svg` and delete
> the two old `-white`/`-black` variants from the dev theme so nothing references
> the missing files.

### Task-by-task

1. **"MOIA" → "Mo".** There are **no user-visible "MOIA" strings inside the
   widget assets** — the assistant's greetings/messages come from the **backend**
   (not in this repo), and the panel header is the "**motion**sports" wordmark.
   The only "MOIA" reference in the theme was a code **comment** in
   `templates/product.json`, now renamed to "Mo". ⚠️ **Action for the backend
   team:** rename the assistant from "MOIA" to "Mo" in the backend system
   prompt/greetings — that copy is not shippable from this theme repo.
2. **New logo (full color).** CSS `--msc-logo` now points at `ms-chat-logo.svg`;
   `.ms-chat-logo` uses `background-size: cover` (crisp when scaled down). The
   launcher logo fills the round button as a circular avatar; the assistant
   avatar is a 36px circle. No masking/tinting — the multi-color artwork shows
   as-is.
3. **Bubble colors (filled).** User bubbles keep the grey fill;
   **assistant (Mo) bubbles dropped the black border** for a **light-blue fill**
   = `rgb(var(--msc-secondary) / 14%)`, a low-alpha tint of the theme accent
   (the brand blue `--button-secondary-background` = `#008ccb`; not hardcoded).
   Dark foreground text keeps contrast. Typing indicator matches.
4. **Smaller chat font.** `.ms-chat-bubble` font-size `0.95rem → 0.85rem`,
   `line-height: 1.45`, padding `10/14 → 8/12`; typing padding scaled too. Still
   ≥ ~13.6px for mobile readability.
5. **Product-page CTA → subtle clickable bullet.** The big outlined button is
   gone. The CTA now renders as the **final clickable bullet** appended to the
   product highlight list (`.product-kurzinfo`), inheriting that list's bullet
   typography: a small Mo logo + underlined "Detaillierte Beratung zu diesem
   Produkt", `cursor:pointer` + hover (accent blue). It still calls the **same**
   `window.MS_CHAT.openWithProduct(product.id, product.title)` via the existing
   `.ms-chat-product-cta` data-attributes + delegated handler — identical
   behavior. *(Chosen presentation: a real `<li>` in the highlight list so it
   reads as "one more bullet", with the disc marker for list membership and the
   logo as the interactive affordance. If the metafield list is empty the bullet
   renders on its own in the same `.product-kurzinfo` box.)*
6. **Compressed-view input.** The textarea now sits cleanly on **one line** by
   default (`min-height: 44px` to match the round send button on the same row),
   modern pill radius (`22px`), font `0.9rem`, and grows up to `max-height: 120px`
   then scrolls internally (never the panel). `init()` calls `autoGrow()` so the
   height is correct on first paint. The disclaimer below stays in the
   fixed-height input bar (no panel scroll). Works in both compressed and
   enlarged panel sizes.
7. **Multi-product checkout card.** `buildAddToCart` now reads
   `input.productIds ?? [input.productId]`, fetches `/api/products?ids=…` for the
   whole set, and renders **ONE** card listing every resolved product
   (thumb + name + price) with **ONE** checkout button → the response's top-level
   **`cartUrl`** (the combined single-cart permalink — not stitched client-side).
   Single-product still works (`cartUrl` == that product's permalink). Degrades
   gracefully when `cartUrl` is null (per-product `shopifyUrl` links); unknown
   ids are skipped. New CSS: `.ms-chat-checkout-item` / `-thumb` / `-meta`.

### Dev-theme test checklist (this session)
1. **Mo rename** — assistant no longer calls itself "MOIA" anywhere user-visible.
   *(Greeting text is backend-driven; verify after the backend is updated.)*
2. **New logo everywhere** — the launcher shows the full-color face avatar
   (circular, crisp), and the same avatar sits next to every assistant (Mo)
   message. No tinting/monochrome; no broken-image icons (old `-white`/`-black`
   files deleted).
3. **Bubbles** — your messages = grey fill; Mo's messages = **light-blue** fill,
   **no black border**; text stays clearly readable; typing dots match.
4. **Smaller font** — chat text is noticeably smaller/tighter but still
   comfortable on a phone.
5. **Product-page bullet CTA** — on a product page, the highlight list ends with
   a discreet clickable bullet (Mo logo + "Detaillierte Beratung zu diesem
   Produkt"); hover shows it's interactive; clicking opens the chat **primed
   about that product** (same behavior as the old button). The old big button is
   gone.
6. **One-line input (compressed)** — open the panel at default size: the input is
   a clean single line aligned with the send button; typing several lines grows
   it to a cap then scrolls inside the box (panel doesn't scroll); the disclaimer
   stays visible. Repeat with the panel **enlarged** — still clean.
7. **Multi-product checkout** — drive the assistant to recommend buying **two**
   products together ("beides nehme ich"): a **single** card lists both products
   with **one** "Alle in den Warenkorb" button that opens a combined cart with
   both. Single-product checkout still shows one product + "In den Warenkorb".

---

## ⭐ Session update (2026-06-04) — in-chat email-capture form (GDPR double opt-in)

Builds the in-chat consent UI for the backend's email-capture flow
(`API_CONTRACT.md` §7: `POST /api/capture-email` + `GET /api/confirm-marketing`,
plus the assistant's `offer_email_summary` tool). **Two theme files changed**
(re-upload both); the spec is docs-only.

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.js` | **MODIFIED** | ✅ Yes |
| `assets/ms-chat-widget.css` | **MODIFIED** | ✅ Yes |
| `docs/ai-advisor/WIDGET_SPEC.md` | **MODIFIED** | ❌ No (docs only — new §6a) |

> **Legal note for whoever copies this over:** the two consents are **separate**
> and the **marketing checkbox is unchecked by default** — never pre-tick it and
> never merge the two into one control. The placeholder consent copy lives in the
> **`CONSENT_COPY` object near the top of `assets/ms-chat-widget.js`**; update it
> there (and only there) when legal signs off. The exact labels shown are sent
> verbatim to the backend as `consentTextShown` (audit proof), so editing the
> strings keeps the audit trail in sync automatically.

### `assets/ms-chat-widget.js` — what changed
- **`CONSENT_COPY`** placeholder string table near the top of the file (title,
  intro, email + both consent labels, submit/sending, privacy caption, all
  error/success messages) — the single place legal edits.
- **`buildCaptureCard(opts)`** — the GDPR capture card: email input (real
  `<label for>`), a **required transactional** consent checkbox, a **separate
  marketing** checkbox **unchecked by default**, submit + inline error + privacy
  caption. Client-side email validation (`^[^@\s]+@[^@\s]+\.[^@\s]+$`); requires
  the transactional box; POSTs `{ sessionId, email, transactionalConsent,
  marketingConsent, consentTextShown }` to `/api/capture-email` with the
  `x-ms-chat-key` + `x-ms-session` headers. Success → replaces the form with the
  "Zusammenfassung gesendet! …" state; error (429 / 502 / 503 / network /
  generic) → inline message, **form stays populated** for retry. Fires
  `track('email_capture_submitted', { marketing })` (fail-silent).
- **Entry point (a):** `offer_email_summary` added to `VISIBLE_TOOLS` and to the
  `buildToolCard` switch, so the assistant's tool part renders the card inline
  (using the tool `message` as intro and `productIds` as an advisory cart
  preview), keyed by `toolCallId` like the other cards.
- **Entry point (b):** a **share icon** in the panel header calls
  `openCaptureForm()`, which opens the panel and drops the same card into the
  message area (reusing an unsubmitted one rather than stacking). Also exposed as
  `window.MS_CHAT.openEmailSummary()`. New `share` SVG in the `ICONS` table.

### `assets/ms-chat-widget.css` — what changed
- New `.ms-chat-consent` / `.ms-chat-consent-text` rules: two separate
  `<label>+<input>` checkbox rows, comfortable tap target, accent focus ring,
  and consent text that **wraps freely and is never truncated**. No other
  selectors touched.

### Dev-theme test checklist (this session)
1. **Trigger via the assistant** — chat until the assistant offers to email the
   summary (the `offer_email_summary` tool); the capture card renders inline with
   the email field, the transactional checkbox, and a **separate, unchecked**
   marketing checkbox, plus the assistant's intro text.
2. **Trigger via the share icon** — click the share icon in the panel header; the
   **same** capture form appears in the message area (with the default intro).
3. **Marketing box default** — confirm the marketing checkbox is **unchecked** on
   first render in both entry points, and that the two boxes are visually/behaviour
   ally independent (ticking one never ticks the other).
4. **Transactional-only submit** — enter a valid email, tick **only** the
   transactional box, submit → success state "Zusammenfassung gesendet! …".
   Confirm the **summary email arrives** and contains the cart link (no DOI link,
   since marketing wasn't selected).
5. **Transactional + marketing submit** — enter a valid email, tick **both**
   boxes, submit → success. Confirm the summary email arrives **and** a separate
   double-opt-in confirmation email arrives; click its **confirmation link** and
   verify it lands on "Danke, deine Anmeldung ist bestätigt." (`/api/confirm-marketing`).
6. **Validation** — empty/invalid email shows "Bitte gib eine gültige E-Mail…";
   submitting without the transactional box shows the transactional error; the
   form is never sent until both pass.
7. **Error + retry** — block `/api/capture-email` in DevTools and submit → inline
   error appears, the **form stays populated** (email + checkbox states kept), and
   the submit button re-enables for retry.
8. **Accessibility / mobile** — both checkboxes are reachable and toggleable by
   keyboard (Tab + Space), the full marketing text is visible (not truncated), and
   the card fits the panel on a ≤640px viewport.

---

## ⭐ Session update (2026-06-02) — styling/UX (features 5–8 + prominent buttons) + product-page CTA

This session changed **4 files**. Re-upload the three theme files below to the
dev theme; the spec is docs-only.

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.css` | **MODIFIED** | ✅ Yes |
| `assets/ms-chat-widget.js` | **MODIFIED** | ✅ Yes |
| `templates/product.json` | **MODIFIED** | ✅ Yes (default product template) |
| `assets/ms-chat-logo-white.svg` | (added) | ✅ Yes — launcher logo (white, for the dark accent button) |
| `assets/ms-chat-logo-black.svg` | (added) | ✅ Yes — assistant avatar + product CTA logo (black, for light backgrounds) |
| `docs/ai-advisor/WIDGET_SPEC.md` | **MODIFIED** | ❌ No (docs only) |

> **Logo update:** the single `ms-chat-logo.svg` was replaced by black/white
> contrast variants. The logo is now shown as **real artwork** (no CSS mask):
> white on the dark launcher, black on the light panel avatar and the product
> CTA. Make sure **both** new SVGs are uploaded.

The widget **snippet was not touched** — the logos are referenced from CSS
(relative `url('ms-chat-logo-white.svg')` / `url('ms-chat-logo-black.svg')`,
resolving to `/assets/…` on Shopify's CDN) and from the product template via
`{{ 'ms-chat-logo-black.svg' | asset_url }}`.

### `assets/ms-chat-widget.css` — what changed
- `--msc-logo` token + `.ms-chat-logo` / `.ms-chat-launcher-logo` /
  `.ms-chat-avatar` helpers (real logo artwork: white on the launcher, black
  on the avatar — `--msc-logo-white` / `--msc-logo-black`).
- **Feature 7 bubble swap**: `.ms-chat-bubble--user` = grey fill;
  `.ms-chat-bubble--assistant` = unfilled + 1.5px foreground/black border;
  assistant rows are now `row` layout with avatar + `.ms-chat-asst-content`;
  typing indicator matches the bordered look.
- **Feature 8 backdrop**: `.ms-chat-backdrop` (dim + `backdrop-filter` blur,
  progressive); panel `z-index` → `calc(var(--msc-z) + 1)`.
- **Feature 6 expand**: `@media (min-width:641px) .ms-chat-panel--expanded`
  (560×780, capped to viewport) — desktop only.
- **Feature 8 mobile inset**: the `max-width:640px` block is now
  near-full-screen (safe-area inset all sides, rounded + bordered, `dvh`
  height anchored to bottom so the keyboard never covers the input).

### `assets/ms-chat-widget.js` — what changed
- `track(event, data)` fail-silent KPI POST → `${apiBase}/api/kpi`
  (`{event, sessionId, timestamp, data}`, `x-ms-session`, all errors
  swallowed; **no message text**). Fired on: `chat_opened`, `chat_closed`,
  `message_sent`, `product_cta_clicked`, `add_to_cart_clicked`,
  `showroom_clicked`, `product_cta_opened`.
- Launcher + assistant avatar use the logo artwork (`logoEl`, `assistantRow`).
- Prominent CTAs: `productButton()` primary pill replaces the subtle "Zum
  Produkt" text link (product card + each comparison column); add-to-cart =
  "In den Warenkorb"; showroom promoted to primary "Showroom ansehen".
- Header **expand toggle** (persisted `ms-chat-expanded`), **backdrop**
  element + open/close wiring, `openPanel` guarded so telemetry fires once.
- **Public API** `window.MS_CHAT.openWithProduct(id, title)`: opens panel;
  fresh chat → product greeting (`requestAssistant`, no user bubble); mid-chat
  → queues `pendingContext` for the next send (history preserved).
  `sendMessage`/`requestAssistant` share `startStream(opts)`, which adds the
  `context` field to the `/api/chat` body.

### `templates/product.json` — exact added lines (hand-paste)
Added to the **"USPs" custom_liquid block** (`custom_liquid_BGU8Mt`, which
renders the bullet points as `.product-kurzinfo`), **immediately below the
bullets** (right after that block's `{% endif %}`):

```liquid
{%- comment -%} AI Advisor (MOIA) product CTA — opens the chat primed about this product {%- endcomment -%}
{%- if settings.ai_advisor_enabled -%}
<button type="button" class="ms-chat-product-cta" onclick="if(window.MS_CHAT&&window.MS_CHAT.openWithProduct){window.MS_CHAT.openWithProduct({{ product.id | json }}, {{ product.title | json }});}return false;">
  <span class="ms-chat-product-cta__logo" aria-hidden="true"></span>
  <span class="ms-chat-product-cta__label">Detaillierte Beratung zu diesem Produkt</span>
</button>
<style>
  .ms-chat-product-cta{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;margin:0 0 16px 0;padding:12px 16px;background:transparent;color:rgb(var(--color-base-foreground,0 0 0));border:1.5px solid rgb(var(--color-base-foreground,0 0 0));border-radius:var(--button-corner-radius,64px);font-family:var(--button-font-family,inherit);font-weight:var(--button-font-weight,600);font-size:0.9rem;line-height:1.2;text-align:center;cursor:pointer;-webkit-appearance:none;appearance:none;}
  .ms-chat-product-cta:hover{background:rgb(var(--color-base-foreground,0 0 0) / 6%);}
  .ms-chat-product-cta__logo{width:22px;height:22px;flex:0 0 auto;display:inline-block;background:url("{{ 'ms-chat-logo-black.svg' | asset_url }}") center / contain no-repeat;}
</style>
{%- endif -%}
```

Notes: passes **`product.id`** + **`product.title`** per the brief (swap
`product.id` → `product.handle` if the backend matches products by handle;
first-variant id would be `product.selected_or_first_available_variant.id`).
Gated by `settings.ai_advisor_enabled`. The CTA shows the **black** logo
variant for contrast on the light outlined button. `product.produkt-new.json`
also has a Kurzinfo block but was **not** edited (brief said one template);
re-apply the same snippet there if you want the CTA on it too.

### Dev-theme test checklist (this session)
1. **Launcher logo** — launcher shows the MOIA logo, brand-tinted.
2. **Swapped bubbles** — user = grey fill; assistant = unfilled + black
   border with a small logo avatar; typing dots bordered.
3. **Prominent buttons** — product card "Zum Produkt" pill; comparison "Zum
   Produkt" per column; add-to-cart "In den Warenkorb"; showroom "Showroom
   ansehen" — all look tappable.
4. **Expand** — header diagonal-arrow enlarges the desktop panel, icon flips,
   size remembered after reload; no effect on mobile width.
5. **Desktop backdrop + click-to-close** — storefront dims/blurs behind the
   open panel, launcher hidden, click outside closes it.
6. **Mobile inset** — near-full-screen with a margin all sides (dimmed
   storefront sliver), rounded/bordered, close reachable, comparison table
   scrolls horizontally, input stays above the keyboard.
7. **Product CTA — fresh** — on a product page, the bordered CTA below the
   bullets opens the chat with a greeting **about that product** (no user
   bubble). *(needs backend `context` support)*
8. **Product CTA — mid-chat** — with an existing conversation, the CTA opens
   the panel, **keeps history**, and primes the next message with the product.
9. **Telemetry no-op** — with no `/api/kpi` yet, nothing throws; KPI POSTs
   fail silently (visible as failed requests in the Network tab).

---

## CREATED files (upload as-is)

| Path | Purpose |
| --- | --- |
| `snippets/ms-chat-widget.liquid` | Mount point. Gates rendering (`ai_advisor_enabled` + never `/cart` or `/checkout` + operator exclusion list), injects `window.MS_CHAT_CONFIG` from theme settings, and loads the CSS/JS assets. |
| `assets/ms-chat-widget.css` | All widget styling, every selector prefixed `.ms-chat*`. Pulls colors/fonts/radii from this theme's CSS custom properties; no Shadow DOM. |
| `assets/ms-chat-widget.js` | The widget itself: launcher + panel, SSE streaming of `/api/chat` (fetch + reader), session id + conversation persistence, the five tool cards, silent-tool consumption, XSS-safe markdown, product hydration via `/api/products`, inline contact form, and all error handling. Vanilla JS, no dependencies. **⚠️ Re-upload required — see "Changelog" below.** |
| `MANIFEST.md` | This file. |

### Changelog

- **`assets/ms-chat-widget.js` (stream-parser fix):** the SSE parser was reading
  the older v4-style event shape (`type: "text"`, `type: "tool-<name>"`) and
  silently dropped every event, so the assistant reply never appeared (typing
  indicator hung). It now parses the **Vercel AI SDK v5 UI-message stream**:
  `text-start` / `text-delta` (concatenated by `id`) / `text-end`, the tool
  lifecycle (`tool-input-start` → `tool-input-delta` → `tool-input-available`,
  rendering the card on full input, keyed by `toolCallId`), the framing events
  (`start` / `start-step` / `finish-step`, with `finish` and `[DONE]` ending the
  stream + persisting the message), and logs unknown event types via
  `console.debug`. Tool-rendering behavior (the five cards, render-nothing
  guards, silent tools) is unchanged. **If you already uploaded an earlier copy
  of this file to the live theme, re-upload `assets/ms-chat-widget.js`.** No
  other file changed for this fix.

- **`assets/ms-chat-widget.css` (panel layout fixes):** three layout-only fixes
  (no copy/color/font changes). **Re-upload `assets/ms-chat-widget.css` to the
  live theme.**
  1. *Horizontal overflow in the message area.* Tool cards are now constrained
     to the panel width: card root `max-width: min(28rem, 100%)` + `box-sizing`,
     inner grid/flex children `min-width: 0; max-width: 100%`, the product spec
     grid uses `minmax(0, 1fr)` columns with `overflow-wrap: anywhere` so long
     values (e.g. metaobject GID strings) wrap instead of widening the card, the
     message area has `overflow-x: hidden`, and the comparison table keeps its
     horizontal scroll inside its own `max-width: 100%` container. No horizontal
     scrollbar can appear in the message area anymore.
  2. *Textarea native controls.* The input textarea now sets
     `appearance: none` (+ vendor prefixes) and `background-image: none` to
     suppress browser/theme-leaked spinner controls; the scrollbar only appears
     once the box reaches its `max-height` (height is auto-sized by JS below that).
  3. *Launcher peeking behind the panel.* The open-state `--hidden` class now
     fully removes the launcher (`display: none !important`), and the launcher's
     `z-index` sits one below the panel as a backstop so it can never overlap an
     open panel (desktop or mobile full-screen).
  4. *Add-to-cart button proportions.* The primary button's long label (full
     product name + "in den Warenkorb", uppercased by the theme) wrapped to two
     lines and looked oversized; tightened to `font-size: 0.85rem`,
     `line-height: 1.2`, `padding: 11px 16px` so the multi-line CTA stays
     proportional. (The add-to-cart *link target* is unchanged — it still points
     at `shopifyCartUrl`; the "Cannot find variant" error is a backend data
     issue where `shopifyCartUrl` carries a SKU instead of a numeric variant ID,
     fixed server-side.)
  CSS-only — no DOM/JS change was needed (the spec grid and comparison-table
  wrappers already existed).

- **`assets/ms-chat-widget.js` + `assets/ms-chat-widget.css` (add_to_cart →
  quick-checkout reframe):** the backend changed the meaning of `add_to_cart` —
  `shopifyCartUrl` is now a one-unit Shopify **checkout permalink**
  (`/cart/<variantId>:1`) and is optional. The card (still keyed off the
  unchanged `tool-add_to_cart` part id) was reframed from "add to cart" to a
  direct quick-checkout CTA: button label **"Jetzt direkt bestellen"** (plain
  link to `shopifyCartUrl`, `target="_blank" rel="noopener noreferrer"`, no
  in-page fetch), a compact product **name + price** line so the shopper sees
  what one click buys, the assistant `message` kept as the bold top line, and
  the caption changed to **"Direkt zur sicheren Kasse bei motionsports.de"**
  (old "… in den Warenkorb" / "Du wirst zu motionsports.de weitergeleitet" copy
  removed). Graceful degrade: if `shopifyCartUrl` is missing/null it falls back
  to a "Zum Produkt" link to `shopifyUrl`, or renders no button if the product
  can't be hydrated — never a broken checkout link. New CSS classes
  `.ms-chat-checkout-summary` / `.ms-chat-checkout-name`. **Re-upload both
  `assets/ms-chat-widget.js` and `assets/ms-chat-widget.css`.** No other tool
  card or request/response contract changed.

---

## MODIFIED files

### 1. `config/settings_schema.json`

**What changed:** Added one new section `"AI Advisor"` at the end of the
settings array (4 settings + 1 paragraph). Nothing else touched.

**Exact change:** the previous last section (Social media) used to close with:

```json
    ]
  }
]
```

It now closes with `]\n  },` and the following new object is inserted before
the final `]`:

```json
  {
    "name": "AI Advisor",
    "settings": [
      {
        "type": "paragraph",
        "content": "AI-powered chat widget that talks to the headless backend. Paste the shared secret below, then enable the widget."
      },
      {
        "type": "checkbox",
        "id": "ai_advisor_enabled",
        "label": "Enable AI advisor chat widget",
        "default": false
      },
      {
        "type": "text",
        "id": "ai_advisor_backend_url",
        "label": "Backend URL",
        "info": "Origin of the chat backend. Change only if the backend is deployed elsewhere.",
        "default": "https://motionsports-chatbot.vercel.app"
      },
      {
        "type": "text",
        "id": "ms_chat_shared_secret",
        "label": "Shared secret (x-ms-chat-key)",
        "info": "Paste the CHAT_SHARED_SECRET value. This is sent as the x-ms-chat-key header. It is visible in page source by design; security comes from the backend origin allowlist + rate limiting."
      },
      {
        "type": "textarea",
        "id": "ai_advisor_excluded_templates",
        "label": "Hide widget on these templates",
        "info": "Comma- or newline-separated template names (e.g. cart, page.contact). /cart and /checkout are always excluded regardless of this list.",
        "default": "cart"
      }
    ]
  }
```

> If hand-editing the live file: add a comma after the closing `}` of the last
> existing section, then paste the object above just before the file's final `]`.

### 2. `layout/theme.liquid`

**What changed:** Added exactly **one** line immediately before `</body>`,
right after the existing inline support-menu `<script>` block. Nothing else
touched. The enable/exclusion gating lives inside the snippet, so this stays a
single include line.

**Exact line added:**

```liquid
    {% render 'ms-chat-widget' %}
```

It sits between `</script>` (the support-toggle script that ends the body) and
`</body>`.

---

## How to install on a Shopify development theme

Do this on the **development theme** (not live). Order matters only in that the
schema/settings should exist before you flip the toggle.

1. **Upload the two assets.** In the theme code editor, create:
   - `assets/ms-chat-widget.css` → paste the file contents.
   - `assets/ms-chat-widget.js` → paste the file contents.
2. **Add the snippet.** Create `snippets/ms-chat-widget.liquid` → paste contents.
3. **Add the settings section.** Edit `config/settings_schema.json` and add the
   `"AI Advisor"` section (see modified-file diff above), or overwrite the file
   with the version from this branch. Save.
4. **Add the include.** Edit `layout/theme.liquid` and add the single
   `{% render 'ms-chat-widget' %}` line immediately before `</body>` (see above).
   Save.
5. **Configure in the theme editor.** Open **Customize → Theme settings →
   AI Advisor**:
   - Paste the backend's `CHAT_SHARED_SECRET` value into **Shared secret
     (x-ms-chat-key)**.
   - Leave **Backend URL** as `https://motionsports-chatbot.vercel.app` for now
     (the custom domain's DNS is not live yet). Switch it to
     `https://chat.motionsports.de` once DNS is configured.
   - **Hide widget on these templates** defaults to `cart`; add more template
     names (comma- or newline-separated, e.g. `page.contact`) if you want.
   - Tick **Enable AI advisor chat widget**.
   - Save.

### Confirm it works — desktop

- On the storefront home or a product page, a round black launcher button
  appears bottom-right. Click it → the panel opens with the **motion**sports
  wordmark, the welcome heading "Wie kann ich dir helfen?" and the input.
- Send a product question (e.g. *"Ich suche ein leises Laufband, Budget 1500 €"*).
  You should see the typing dots, then streamed text, then product / compare /
  add-to-cart / showroom / contact cards as the assistant calls tools.
- Click a product card's **Zum Produkt** link → opens the product in a new tab.
- Click an **… in den Warenkorb** button → opens the Shopify cart-add URL in a
  new tab.
- Trigger a contact form (ask for studio/leasing advice), fill it, submit →
  "Vielen Dank!" confirmation.
- Navigate to another page mid-conversation → reopen the launcher → the
  conversation is still there (localStorage persistence).
- Click the **↻ (new chat)** icon in the header → conversation clears back to
  the welcome state (and the session id rotates).
- Visit `/cart` → the launcher must **not** appear.

### Confirm it works — mobile

- On a phone (or DevTools device emulation ≤ 640px wide), open the panel → it
  goes **full-screen**; the close (×) stays reachable in the header.
- The launcher and panel respect safe-area insets (not hidden behind the iOS
  home bar).
- The comparison table scrolls horizontally inside the panel without breaking
  the layout.
- Tapping the input does not get permanently hidden by the keyboard.

### Confirm the error states surface

You can force these to verify the UI (use DevTools → Network throttling/blocking
or a temporary bad setting):

- **401 unauthorized** — put a wrong value in **Shared secret** and send a
  message. Shopper sees *"Chat ist gerade nicht verfügbar."*; the real cause is
  logged to the browser console (`console.error`). Restore the correct secret
  afterward.
- **403 forbidden** — happens if the storefront origin isn't in the backend's
  `ALLOWED_ORIGINS`. Same shopper message + console error. (Fix is server-side:
  add the origin to `ALLOWED_ORIGINS`.)
- **429 rate_limited** — send many messages quickly. The input disables and a
  *"Zu viele Anfragen — bitte kurz warten."* hint shows; it re-enables after the
  `Retry-After` window.
- **400 payload_too_large** — reach the 40-message cap (long conversation). A
  *"Dieser Chat ist ziemlich lang geworden…"* notice appears with a **Neuen Chat
  starten** button that clears the persisted history and rotates the session id.
- **5xx / network** — block the request in DevTools and send. A friendly
  *"Es gab ein Problem. Bitte versuch es gleich nochmal."* appears and input
  re-enables; what you typed is restored so you can retry.

### Note on the shared secret

The `x-ms-chat-key` secret is intentionally visible in page source. That is
expected and acceptable for a public storefront widget: the backend pairs it
with an **origin allowlist** and **rate limiting**. Do not try to hide it. The
widget must only ever be deployed on the allowlisted storefront origin
(`https://www.motionsports.de` / `https://motionsports.de`); if the origin
changes, the backend's `ALLOWED_ORIGINS` must be updated in lockstep or the
widget will get `403 forbidden`.

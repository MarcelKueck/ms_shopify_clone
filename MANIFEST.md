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

## ⭐ Session update (2026-07-27, latest) — marketing opt-in push: starters removed, prominent sign-in card, Accept/Decline consent gate

Conversion-focused rework of the widget's marketing-consent funnel (2 opt-ins
from 1000+ chats → the checkbox was invisible, especially on mobile). Consent
stays GDPR-clean: served-copy-only, `lawyerApproved`-gated, DOI unchanged, no
pre-selection anywhere.

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.js` | **MODIFIED** (starters removed; sign-in card copy; consent gate; opt-in card button-consent) | ✅ Yes |
| `assets/ms-chat-widget.css` | **MODIFIED** (`.ms-chat-gate*`, `.ms-chat-signin-*` accents; `.ms-chat-starter*` removed) | ✅ Yes |
| `snippets/ms-chat-widget.liquid` | **MODIFIED** (comment only — starters no longer read pageContext) | ✅ Yes |
| `docs/backend-handoff/CONSENT_GATE_THEME_NOTES.md` | **CREATED** (backend contract for the anonymous gate) | ❌ No (not a theme asset) |

### Changes

- **Starter prompt chips REMOVED** from the welcome state (unused, often
  nonsensical, and they pushed the sign-in surface below the mobile fold).
  `starter_shown` / `starter_clicked` KPIs no longer fire.
- **Sign-in card promoted to the welcome hero slot**: accent-gradient border,
  benefit copy incl. "Persönliche Angebote & Aktionen zuerst sehen", full-width
  "Jetzt anmelden" CTA + "Kein Konto? Einfach lostippen" reassurance.
- **NEW marketing consent gate**: an Accept/Decline dialog (bottom sheet on
  mobile) shown once per session right after the user's first message; the
  reply streams behind it and is never conditional on the choice. Signed-in →
  served `surface=signin` copy + existing `/api/account/marketing-opt-in`.
  Anonymous → served `surface=chat` copy + `POST /api/chat-marketing-opt-in`
  with a typed email — **fail-closed (renders nothing) until the backend ships
  that surface** (see the handoff note). Accept is remembered forever
  (device), decline snoozes 24h, backdrop/Esc defers to the next session.
- **At-sign-in opt-in card converted to the same button-consent mechanic**
  (served statement fully visible + explicit accept tap; checkbox removed).
  The email-capture form is unchanged (its audit string covers both consents).
- New KPIs: `consent_gate_shown` / `_accepted` / `_declined` / `_dismissed`
  (`{ surface }`).

---

## ⭐ Session update (2026-06-21) — final pre-launch cleanup: removed the last unused widget asset (the widget code is already dead-code-clean)

Final, behavior-preserving pre-launch sweep of the widget. The widget's code was
already cleaned in the **2026-06-14** dead-code pass below, so this round found
**nothing dead left in the JS/CSS/snippet** — the only cruft remaining was one
orphaned image asset, now removed. **No shipped behavior changed for any identity
tier (anonymous · email-only capture · signed-in) or any locale (`/de` default ·
`/en`).** The three widget code files were **not edited** this round, so those
paths are byte-for-byte identical.

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-logo-v2.svg` | **DELETED** (unused — see below) | 🗑️ Delete from the live theme if it was ever uploaded |
| `assets/ms-chat-widget.js` | UNCHANGED | ❌ No |
| `assets/ms-chat-widget.css` | UNCHANGED | ❌ No |
| `snippets/ms-chat-widget.liquid` | UNCHANGED | ❌ No |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |

### REMOVED (unused asset — behavior-preserving)

- **`assets/ms-chat-logo-v2.svg` (≈536 KB).** The brand orb has been a tiny
  **inline** SVG injected by the JS (`LOGO_BLOBS` → every `.ms-chat-logo` span)
  since the orb rework — no image asset, no network request. Nothing in any
  deployable theme file (`assets/`, `snippets/`, `sections/`, `layout/`,
  `templates/`, `config/`) referenced this file; it was already flagged
  **"NO LONGER REFERENCED"** in the 2026-06-10b orb entry below and kept only as
  history. Git history still preserves the artwork, so it is dropped from the
  snapshot here and should be deleted from the live theme. Revert: `git restore`
  the file.

### Confirmed CLEAN (no change needed — verification only)

- **No stale backend URLs / old hosts — everything points at `mo.motionsports.de`.**
  Repo-wide there is **no** `…vercel.app`, `chat.motionsports.de`, `localhost`,
  `127.0.0.1`, `ngrok`, or `herokuapp` in any deployable file. The backend base is
  resolved in exactly three places, all consistent: the snippet default
  (`ms-chat-widget.liquid:48` → `'https://mo.motionsports.de'`), the JS fallback
  (`ms-chat-widget.js:21` → `'https://mo.motionsports.de'`), and the theme-setting
  default (`settings_schema.json` `ai_advisor_backend_url` →
  `https://mo.motionsports.de`). `settings_data.json` sets **no** override, so the
  live default is `mo.motionsports.de`. (This closes `AUDIT_FRONTEND.md` **F1** —
  the old Vercel default is fully gone.) The only other absolute URLs in the JS are
  the showroom link and the `motionsports.de` checkout caption — both intentional.
- **No leftover `console.log` / `debugger`.** There are **zero** `console.log` and
  **zero** `debugger` statements. The 12 remaining `console.*` calls are all
  intentional, namespaced (`[ms-chat]`) and `try/catch`-guarded **diagnostics** that
  fire only on real conditions — operator misconfig (`console.warn` for an empty
  `ms_chat_shared_secret`; `console.error` for 401 "check the shared secret" / 403
  "origin not allowlisted") and error envelopes / unhandled-stream-event protocol
  drift (`console.debug`). These are kept on purpose (removing them would lose
  launch-day diagnosability and change observable console output); none are debug
  cruft.
- **No dead code, no commented-out blocks.** Every one of the **225** named
  functions, **83** module-level vars, and **163** `.ms-chat-*` CSS selectors is
  referenced; an independent second-pass audit found **no** transitive dead islands,
  write-only vars, orphan listeners, or orphan CSS, and **no** half-removed remnants
  of the orb reworks, the EN-locale add, or streaming voice mode. The only block
  comments are intentional design documentation (e.g. the orb/liquid-glass notes,
  the "no `.ms-chat-launcher svg` size rule" note) and are left intact.
- **Identity tiers + locale unchanged.** No edits to the JS/CSS/snippet, so the
  **anonymous**, **email-only** (in-session `capture-email`), and **signed-in**
  (`/api/auth/me` + storefront `/api/account/*`) paths and the **`/de`** default /
  **`/en`** overlay (`msNormLocale` → default `de`, only `/en` or an `en`-prefixed
  `CFG.locale` flips to English) are byte-for-byte identical to the shipped,
  lawyer-approved widget.

### Kept on purpose (NOT removed)

- **The legacy `ms-chat-expanded=1 → modal` view-mode migration** (`loadViewMode`).
  Reading the old localStorage key is **behavior-bearing** (a returning visitor who
  last used "modal" keeps it); removing it would change behavior, so it stays —
  exactly as the 2026-06-14 pass decided.
- **All `console.warn/error/debug` diagnostics** (see above) and the **design-doc
  comments** in the CSS/JS — documentation, not dead code.

---

## ⭐ Session update (2026-06-21) — chat tab's cart UI auto-refreshes after quick-checkout (no manual reload)

**Bug.** When the shopper uses quick-checkout from the chat (the `add_to_cart`
card's **"Zur Kasse"** button), the combined cart permalink opens in a **new
tab** (`target="_blank"`) and the cart is populated server-side over there. The
**original chat tab** kept its stale, server-rendered cart UI — the header count
badge (`#CartBubble`) and the cart drawer (`<cart-modal>`) still showed the old
(often empty) cart until a manual page reload.

**Fix.** The widget now re-fetches the live Shopify cart and reconciles the
theme's own cart UI **in place** (no full page reload) when the chat tab regains
focus / becomes visible — and, as a belt-and-braces fallback, for a few seconds
after the checkout button is clicked. It is **display-only**: it only ever does a
`GET /cart.js` (plus a Section Rendering re-render of the cart sections),
**never** POSTs, so it can never double-add, and the chat conversation/state is
untouched. **Re-upload the one modified theme file.**

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.js` | **MODIFIED** (storefront cart auto-refresh on focus/visibility + post-checkout poll) | ✅ Yes |
| `assets/ms-chat-widget.css` | UNCHANGED | ❌ No |
| `snippets/ms-chat-widget.liquid` | UNCHANGED | ❌ No |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |

### What changed in `ms-chat-widget.js`

- **New `refreshCartUI()`** — a single-flight `GET /cart.js` (via the theme's
  locale-aware `window.routes.cart_url`, falling back to `/cart.js`). It always
  reconciles the header badge and, **only when `item_count` actually changed**,
  re-renders the drawer and (if the shopper is on it) the cart page — so an open
  drawer is never disturbed unless its contents really differ.
- **Reuses the theme's own primitives** — updates `#CartBubble` with the same
  hidden/empty semantics the theme's own updater uses; refreshes the drawer by
  calling `document.querySelector('cart-modal').reloadContent()` **directly** (the
  same Section Rendering fetch the theme runs after its own adds) so the drawer
  refreshes silently — no notification, no auto-open; re-renders the cart **page**
  (`.section-main-cart`) via `?section_id=` exactly as the theme does.
- **Triggers** — `visibilitychange` (on becoming visible; folded into the
  existing handler), `window` `focus`, and `pageshow` (bfcache restore). Plus a
  bounded **post-checkout poll** (`+1.2 / 2.5 / 4.5 / 7 s`) armed when "Zur Kasse"
  is clicked, covering the case where this tab keeps focus (permalink opened in a
  background tab / popup blocked). Every tick routes through the same idempotent,
  change-gated `refreshCartUI()`.
- **No double-add, no chat disturbance** — purely a re-fetch + display reconcile:
  no `/cart/add` call, and no change to the conversation, messages, voice mode, or
  auth flow.

---

## ⭐ Session update (2026-06-21) — streaming-TTS splitter mirrors the contract's canonical `splitIntoTtsChunks()`

The streaming voice mode added on 2026-06-14 (TTS audio that plays **while** the
text streams, through an in-order playback queue) already shipped. This session
brings the widget's **sentence splitter** into faithful alignment with the
now-canonicalised `docs/ai-advisor/API_CONTRACT.md` §8.3, which formalises a
reference splitter (`splitIntoTtsChunks()` / `src/lib/tts-text.mjs`) the widget
must mirror so its chunk boundaries match what the server synthesizes. The old
widget splitter was a simpler sentence scan; it could let a **long opening
sentence stall the first audio** (it had no length cap) and could **mis-split**
German abbreviations, decimals, and URLs. **Re-upload the one modified theme
file.**

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.js` | **MODIFIED** (splitter now mirrors the canonical `splitIntoTtsChunks()`) | ✅ Yes |
| `assets/ms-chat-widget.css` | UNCHANGED | ❌ No |
| `snippets/ms-chat-widget.liquid` | UNCHANGED | ❌ No |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |

### What changed in `ms-chat-widget.js`

- **New pure `splitIntoTtsChunks(buf, { flush })`** (mirrors the backend
  reference) returns `{ chunks, rest }` — the emitted chunks in stream order plus
  the unterminated tail to carry into the next delta. It:
  - emits the moment a sentence terminator (`. ! ? …`) **or a newline** completes
    a sentence, so the **first** audio starts right after the first sentence;
  - **coalesces** fragments shorter than `minChars` (now the contract default
    **40**, down from 60, measured after Markdown stripping) into the next
    sentence, so a one- or two-word clip is never synthesized;
  - **force-cuts** any run longer than `maxChars` (**220**) at the last clause
    boundary (`, ; : – —`) or space — **new**: this is what guarantees a long
    opening sentence can't stall the ~1 s first-audio start.
- **New `isTtsSentenceEnd()` + `TTS_ABBR`** guard German abbreviations
  (`z. B.`, `usw.`, `ca.`, …, plus any single-letter token / initial), decimals
  (`3.5`) and mid-token dots (`google.com`) so none of those split a sentence —
  matching the contract's abbreviation/decimal/URL rules.
- **`streamTtsDrain(flush)` is now a thin driver** over the splitter: it runs
  `splitIntoTtsChunks(pending, { flush })`, keeps `rest` as the new `pending`, and
  fires `streamTtsEmit()` once per chunk in order. The per-sentence request,
  in-order playback **queue**, `seq` echo handling, and KPI all stay as before.

### Voice tone (faster + more energetic) — server-side, no widget change

Per API_CONTRACT.md §8.3 the brisker, more energetic delivery is a **backend**
default (`TTS_VOICE=coral`, `TTS_SPEED=1.1`, energetic German steering
instruction — all env-overridable). The widget never sends voice/speed, so no
theme change is needed for it; it is noted here for completeness.

### Unchanged / out of scope (verified)

- **Playback queue, in-order (`seq`) playback, gap/overlap-free single-element
  reuse, the play-after-complete fallback, the `429`/`502`→`speechSynthesis`
  chain, interrupt teardown in `endSpeaking()`, and `voiceAfterReply()`** are all
  untouched — only the chunk-boundary logic changed.
- **iOS autoplay** keeps working — the queue still reuses the `ttsAudio` element
  that `enableVoiceMode() → unlockAudio()` unlocks inside the click gesture.
- **Reduced-motion and voice-unsupported behavior are untouched** — the splitter
  is pure text logic inside voice mode, adds no animation, and touches no
  `prefers-reduced-motion` path.

### Verified

- `node --check` passes on `ms-chat-widget.js`.
- The shipped `splitIntoTtsChunks()` / `isTtsSentenceEnd()` (extracted from the
  file and run under node) emit the first sentence then hold the tail; keep
  `z. B.`, `3.5` and `google.com` inside their sentence; coalesce a short
  fragment until flush; and force-cut a 200-plus-char terminator-less opener at
  the last clause boundary (`≤ 220` chars).

---

## ⭐ Session update (2026-06-16) — quieter styling for the data-export & delete-all footer buttons

Restyled the signed-in account-drawer footer buttons **"Meine Daten herunterladen"**
(export) and **"Alle meine Daten löschen"** (erase) to match the composer's
unobtrusive **"Feedback geben"** link — smaller (0.72rem), normal weight, muted,
and **no longer red** — so these sensitive data actions are less likely to be
clicked by accident. Behaviour is unchanged (the erase keeps its two-step
confirm). **Abmelden** (logout) keeps its slightly more prominent style.

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.js` | **MODIFIED** (both buttons now use `ms-chat-history-link--quiet`) | ✅ Yes |
| `assets/ms-chat-widget.css` | **MODIFIED** (new `.ms-chat-history-link--quiet`; removed the unused red `.ms-chat-history-erase-btn`) | ✅ Yes |

### Verified

- `node --check` passes on `ms-chat-widget.js`.
- No `ms-chat-history-erase-btn` references remain.

---

## ⭐ Session update (2026-06-16) — REMOVE the § 7(3) UWG Bestandskunden notice (client request)

Per the client, the **§ 7 Abs. 3 UWG "at the time of collection" notice is
removed entirely** (it had been added earlier the same day in #49). This reverts
**only** that notice — the **"Meine Daten herunterladen" data export (Art. 15/20)
stays**, as it is a separate data-subject right, not part of the Bestandskunden
marketing feature. No backend code is involved.

| Path | Status | Action on the live theme |
| --- | --- | --- |
| `snippets/cart-side-inner.liquid` | **REVERTED** to pre-#49 (notice render removed) | ✅ Re-upload |
| `sections/cart-modal.liquid` | **REVERTED** to pre-#49 (notice render removed) | ✅ Re-upload |
| `snippets/cart-marketing-objection-notice.liquid` | **DELETED** | 🗑 Delete from the live theme if it was uploaded |
| `docs/backend-handoff/UWG_7_3_NOTICE_THEME_NOTES.md` | **DELETED** | ❌ No (doc, not a theme asset) |
| `assets/ms-chat-widget.js` / `.css` | UNCHANGED here (data export from #49 stays) | ❌ No (already shipped with #49) |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |

After this, the cart shows **no** § 7(3) notice and nothing is needed in Shopify
Admin for it (the lawyer / launch-gate / Widerspruch-mailbox steps are all moot).
The data-export button is unaffected.

### Verified

- `git diff` of the two cart files against pre-#49 (`24d7d94`) is empty — they are
  byte-identical to their original state.
- No `cart-marketing-objection-notice` / `widerspruch@` / "Abs. 3 UWG" references
  remain in `*.liquid` / `*.js` / `*.css`.

---

## ⭐ Session update (2026-06-16) — GDPR remediation (storefront): "Meine Daten herunterladen" data export + § 7(3) UWG at-collection notice

> ⚠ **Superseded in part:** the § 7(3) UWG notice described in this entry was
> **removed** on the client's request — see the entry above. The data export
> below remains in place.

Two storefront-side changes completing the backend GDPR remediation. **(1)** A
signed-in **data export** ("Meine Daten herunterladen", GDPR Art. 15/20) in the
chat widget's account drawer, mirroring the existing summary-download fetch +
download + error pattern. The matching **erase** ("Alle meine Daten löschen",
`POST /api/account/erase`) already existed and is unchanged. **(2)** The § 7
Abs. 3 UWG **"at the time of collection" objection notice** at the point of
purchase. Anonymous + email-only widget paths are **byte-identical** (the export
control is built into the signed-in-only history drawer and is inert otherwise).

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.js` | **MODIFIED** (export copy in `ACCOUNT_COPY`, `buildExportControl()`, drawer-footer wiring) | ✅ Yes |
| `assets/ms-chat-widget.css` | **MODIFIED** (`.ms-chat-history-link:disabled`, `.ms-chat-export-msg`) | ✅ Yes |
| `snippets/cart-marketing-objection-notice.liquid` | **CREATED** (§ 7(3) notice copy — one place) | ✅ Yes |
| `snippets/cart-side-inner.liquid` | **MODIFIED** (renders the notice — cart page) | ✅ Yes |
| `sections/cart-modal.liquid` | **MODIFIED** (renders the notice — cart drawer) | ✅ Yes |
| `docs/backend-handoff/UWG_7_3_NOTICE_THEME_NOTES.md` | **CREATED** (operator: exact Admin copy + placement) | ❌ No (doc, not a theme asset) |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |
| `snippets/ms-chat-widget.liquid` | UNCHANGED | ❌ No |

### TASK 1 — data export (`ms-chat-widget.js` / `.css`)

- **`buildExportControl(wrap)`** in the history-drawer footer, between **Abmelden**
  and the existing **Alle meine Daten löschen**. Signed-in only (same gate as the
  drawer). A plain `.ms-chat-history-link` button "Meine Daten herunterladen".
- On click: `GET /api/account/export` with the **same guard headers** as the
  summary download (`accountHeaders()` → `x-ms-chat-key` + `x-ms-session`; Origin
  is automatic). Reads `res.blob()`, then `URL.createObjectURL` → a temporary
  `<a download="motionsports-meine-daten.json">` click → `revokeObjectURL`.
- **Loading state** (button disabled + "Wird vorbereitet…"); **401** silently
  drops to anonymous (`accountUnauthorized()`); any other non-200 (e.g. **503**)
  shows the friendly German error **"Download fehlgeschlagen — bitte später
  erneut versuchen."** No confirm step (a safe read, unlike erase). New KPI
  events `account_export_started` / `account_exported`.

### TASK 2 — § 7(3) UWG at-collection notice (cart)

- New snippet `cart-marketing-objection-notice.liquid` holds the German copy
  (one source of truth) and is rendered at the **foot of the cart summary,
  directly under the checkout button**, on the cart **page**
  (`cart-side-inner.liquid`) and in the cart **drawer** (`cart-modal.liquid`) —
  visible, not collapsed, not in the T&Cs.
- ⚠ **Lawyer must confirm the exact wording before launch**, and this is a
  **launch gate**: the backend keeps § 7(3) sends disabled until the notice is
  live. The copy is phrased as a future possibility ("ggf. auch") and does not
  present existing-customer marketing as active.
- **Checkout is NOT customizable from this repo** (no `checkout.liquid`, no
  Checkout UI extension). The two **legally-mandatory** surfaces — the **checkout
  contact/email step** and the **order-confirmation notification email** — must
  be added in **Shopify Admin**. Exact copy + placement:
  `docs/backend-handoff/UWG_7_3_NOTICE_THEME_NOTES.md`. The cart notice is the
  in-repo reinforcement, not a substitute for those.

### Verified

- `node --check` passes on `ms-chat-widget.js`.
- Export mirrors the existing `downloadSummary` fetch/download/error pattern and
  reuses `accountHeaders()` / `accountUnauthorized()`; it is built only inside the
  signed-in history drawer, so tiers 1–2 (anonymous + email-only) are unchanged.
- Cart notice renders via a shared snippet in both cart surfaces; no new CSS file
  for it (reuses theme utility classes).

---

## ⭐ Session update (2026-06-14) — unobtrusive Feedback entry point in the chat widget

Added a small, optional **Feedback** affordance to the widget per the feedback
submit contract (`docs/ai-advisor/API_CONTRACT.md` §9). It's a quiet text link
in the composer footer (next to the AI disclaimer) → a short text box →
`POST /api/feedback` → a friendly thanks state. Available to **all tiers**, no
PII required: an email is attached **only** for an already-identified user (a
captured email-only contact); a signed-in customer is linked by the session id,
never by sending the address. **Re-upload the two modified theme files.**

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.js` | **MODIFIED** (`FEEDBACK_COPY`, `feedback` icon, footer link, `buildFeedbackCard()` / `openFeedbackCard()`) | ✅ Yes |
| `assets/ms-chat-widget.css` | **MODIFIED** (`.ms-chat-footer`, `.ms-chat-feedback-link`, `.ms-chat-feedback-actions`) | ✅ Yes |
| `snippets/ms-chat-widget.liquid` | UNCHANGED | ❌ No |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |

### What changed in `ms-chat-widget.js`

- **New `FEEDBACK_COPY`** chrome strings (German): entry-link label, card
  title/intro, textarea placeholder, submit/cancel, error + thanks copy. No
  legal/consent copy is involved — feedback collects no consent.
- **New `feedback` ICONS entry** (a speech bubble) for the card head.
- **Footer entry point.** The plain disclaimer line is now an `.ms-chat-footer`
  row holding the same AI disclaimer plus a subtle underlined
  **"Feedback geben"** text link (`.ms-chat-feedback-link`). Deliberately quiet
  so it never competes with the composer; always available while the panel is
  open.
- **`buildFeedbackCard()`** renders a compact card (reusing `.ms-chat-card` /
  `.ms-chat-form` / `.ms-chat-form-success`): a single textarea (`maxlength`
  4000), Cancel + Absenden. On submit it POSTs to `/api/feedback` with the same
  guards as chat (`x-ms-chat-key` + `x-ms-session`). Only `message` is required;
  optional **context** is sent when known — `sessionId` (the session id),
  `conversationId` (the active signed-in thread), a coarse telemetry-grade
  `tier` hint (`signed-in` / `email` / `anonymous`), `email` (only for an
  identified user — `capturedEmail`), and `page` (`location.pathname`).
- **States handled:** empty/over-length are caught client-side; `200` swaps the
  body for the check-mark **"Danke!"** thanks state; `413` → length error; `429`
  honors `Retry-After` (keeps submit locked for the window); other errors keep
  the comment for retry. Cancel removes the card.
- **`openFeedbackCard()`** opens the panel, clears the welcome state, drops the
  card into the message area and focuses the textarea; an already-open,
  not-yet-submitted card is reused instead of stacked.

### `ms-chat-widget.css`

- Added `.ms-chat-footer` (centered flex row), `.ms-chat-footer-sep`,
  `.ms-chat-feedback-link` (muted underlined text button with hover/focus
  states) and `.ms-chat-feedback-actions` (Cancel + Submit side by side). The
  disclaimer rule lost its now-redundant `margin-top` (the footer owns it).
  Everything else reuses existing card/form/success tokens.

### Verified

- `node --check` passes on `ms-chat-widget.js`.
- Entry point is unobtrusive (small muted link in the footer, not a button in
  the crowded header) and present for all tiers; the email field is never shown
  and is only attached as context when an identified email already exists.

---

## ⭐ Session update (2026-06-14) — render Markdown nicely in chat bubbles (no raw asterisks/hashes) (UX polish item 4)

Assistant messages used to show **raw Markdown** — `**asterisks**`, `#` hashes,
`-` dashes — because the widget only understood `**bold**` and `[label](url)`
and wrapped every line in its own `<p>`. They now render as **formatted text**:
bold, italic, inline code, links, headings, bulleted/numbered lists,
blockquotes, fenced code, paragraphs and soft line breaks — styled to match the
widget (Montserrat via `--msc-font`, brand tokens). This is the **theme half**
of UX-polish item 4 (chat bubbles); admin-side summaries/drafts are out of scope
for this snapshot repo. **Re-upload the two modified theme files.**

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.js` | **MODIFIED** (tiny safe Markdown→DOM renderer) | ✅ Yes |
| `assets/ms-chat-widget.css` | **MODIFIED** (`.ms-chat-md-*` styles) | ✅ Yes |
| `snippets/ms-chat-widget.liquid` | UNCHANGED | ❌ No |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |

### What changed in `ms-chat-widget.js`

- **Replaced the 2-rule inline renderer with a small Markdown→DOM renderer**
  (no library; ~140 lines) that builds **real DOM nodes** via
  `createElement` / `createTextNode` — **never `innerHTML` on model text**, so
  the model can't inject HTML. XSS-safe by construction: model text always
  becomes text nodes, and only an **allowlist** of tags is ever created
  (`p br strong em code a h3–h6 ul ol li blockquote pre`). `safeHref()` (kept)
  still gates link schemes to `http(s):` / `mailto:`; anything else renders as
  literal text.
  - `renderBlocks()` — block grammar: `#`…`######` headings (→ `h3`–`h6` at
    chat scale), `-`/`*`/`+` and `1.`/`1)` lists, `>` blockquotes (recursive),
    ```` ``` ```` fenced code, and paragraphs (blank line = new paragraph,
    single newline = soft `<br>`).
  - `appendInline()` — inline grammar: `**bold**`, `*italic*`, `` `code` ``,
    `[label](url)`. A marker with no closer is rendered as literal characters.
  - **Underscores are intentionally NOT emphasis** so identifiers like
    `update_customer_profile` / `my_var` render intact (a real bug with naive
    `_emphasis_` parsers).
- **Streaming stays smooth — no half-Markdown flash.** `renderMarkdownInto()`
  takes a `streaming` flag; while the reply streams, `streamingSafeText()`
  **withholds an incomplete trailing token** (an unclosed `**`, `*`, `` ` ``,
  `[`/`[..](`, an open ```` ``` ```` fence, or a bare block marker still being
  typed) so partial syntax never shows; the held tail appears a token later
  once it completes. The run is then re-rendered **in full** on `text-end` and
  again in `finalizeStream()` (covers a stream that closes without a trailing
  `text-end`), and restored history always renders in full (`state.streaming`
  is false there).
- **Tool cards / product cards are untouched** — they render through
  `buildToolCard()`, a separate path; only assistant *text* runs go through the
  Markdown renderer.

### `ms-chat-widget.css`

- Added `.ms-chat-md-*` rules (`-h`, `-list`, `-quote`, `-code`, `-pre`) plus a
  `.ms-chat-bubble em` rule, all using existing tokens (`--msc-heading`,
  `--msc-surface`, `--msc-border`, `--msc-muted`, `--msc-input-radius`). First/
  last child margins are collapsed so the document-style assistant text keeps
  its tight vertical rhythm. No other rules touched.

### Verified

- `node --check` passes; the renderer was exercised with a DOM-mock harness:
  bold/italic/code/links/lists/headings/quotes/fenced code all render correctly;
  `snake_case` identifiers stay intact; `javascript:` links and raw
  `<script>` / `<img onerror>` are escaped to text (never live nodes); and
  streamed snapshots withhold incomplete `**`, `*`, and `[..](..` until they
  close, then render fully.

---

## ⭐ Session update (2026-06-14) — streaming voice mode: TTS audio plays WHILE the text streams (UX polish item 3)

Voice mode used to wait for the **whole** reply before it called `/api/tts`
once — so spoken audio only started after generation finished. Now the widget
streams TTS the ChatGPT way: as sentences arrive in the chat stream it requests
their audio per-sentence and plays them through an in-order **playback queue**,
so speech begins **~1 s into the stream** instead of after completion. This is
the **theme half** of UX-polish item 3; the backend half (`/api/tts` streaming
mode: `{ stream: true, seq }`, the `tts-stream` rate-limit bucket, the
`X-MS-TTS-Seq` echo header) is already deployed and specified in
`docs/ai-advisor/API_CONTRACT.md` §8. **Re-upload the one modified theme file.**

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.js` | **MODIFIED** (per-sentence streaming TTS + playback queue) | ✅ Yes |
| `assets/ms-chat-widget.css` | UNCHANGED | ❌ No |
| `snippets/ms-chat-widget.liquid` | UNCHANGED | ❌ No |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |

### What changed in `ms-chat-widget.js`

- **New streaming-TTS module** (a `streamTts` session object + helpers, added
  right after `ttsUnavailable()`):
  - `startStreamTts()` — opens a session on the first text-delta of a voice-mode
    reply; bumps `speakSeq` (supersedes any in-flight single-shot callback) and
    sets `isSpeaking` so the mic loop stays parked while the reply is spoken.
  - `streamTtsFeed(delta)` — accumulates chat tokens; hooked into the
    `text-delta` SSE handler, guarded by `if (voiceMode)` so it is a strict
    no-op outside voice mode.
  - `streamTtsDrain(flush)` — splits accumulated text on sentence terminators
    (`. ! ? … \n`), **coalesces fragments < 60 chars** with the next sentence so
    audio isn't choppy, and holds the trailing partial until the next terminator
    (or, on `flush` at stream end, emits whatever remains).
  - `streamTtsEmit(text)` — `POST /api/tts` with `{ text, stream: true, seq }`
    (monotonic `seq` from 0), Markdown pre-stripped via the existing
    `stripMarkdownForSpeech()`; stores each clip in the queue at its own `seq`.
  - `streamTtsPump()` / `streamTtsAdvance()` — **play strictly in `seq` order**:
    requests finish out of order, so later-but-ready clips are buffered and
    playback only advances when the next-in-order clip has arrived. Clips reuse
    the **same unlocked `ttsAudio` element** (one src-swap at a time → no
    overlap, iOS autoplay unlock still valid) and each blob URL is revoked as it
    finishes. KPI `voice_reply_played` fires **once per reply**, not per clip.
  - `streamTtsFinish()` — whole reply spoken → tear down and re-arm the mic.
- **Fallback preserved (the existing play-after-complete path is unchanged).**
  Any chunk failure (`429` / `502` / network / `play()` rejection) calls
  `streamTtsFallback()`, which stops the per-sentence path and moves the text of
  every **emitted-but-unplayed** clip back in front of `pending`, then hands the
  **unspoken remainder** to `speakReply()` — the same single-shot →
  `speechSynthesis` chain as before. A `429` records the shared
  `ttsBackoffUntil`; if voice mode is already inside a backoff window, no
  streaming session opens at all and the reply uses the single-shot fallback
  directly (straight to `speechSynthesis` while backed off).
- **`voiceAfterReply()` is now streaming-aware** — when a session is live it
  marks it `done`, flushes the trailing partial as the final chunk, and lets the
  queue drain (finishing playback re-arms the mic); a tool-only reply, an
  errored stream, or no speakable text fall through to the prior behavior.
- **`endSpeaking()` tears the queue down cleanly** — interrupting (tap on the
  voice-mode button, sending text, a new spoken turn, disabling voice mode, or
  the tab going hidden) stops playback and revokes every buffered clip, so
  nothing keeps speaking after an interrupt.
- **`onPlaybackEnded()` dispatches** — advances the queue when a streaming clip
  ends, otherwise behaves exactly as before (single-shot reply end → re-listen).

### Unchanged / out of scope (verified)

- **Reduced-motion and voice-unsupported behavior are untouched** — streaming
  TTS lives entirely inside voice mode (which only renders when the mic API
  exists) and adds no animation; `prefers-reduced-motion` paths are not touched.
- **iOS autoplay** keeps working — the queue reuses the `ttsAudio` element that
  `enableVoiceMode() → unlockAudio()` already unlocks inside the click gesture.
- **No CSS/snippet/markup changes**; no new dependencies; same auth headers
  (`x-ms-chat-key`, `x-ms-session`) and same `API_BASE`.

---

## ⭐ Session update (2026-06-14) — pre-launch cleanup & hardening: dead-code removal only (no behavior change)

Behavior-preserving cleanup pass. Removed genuinely dead widget code only —
no observable behavior changed for any of the three identity tiers (anonymous,
email-only capture, signed-in). The shipped behavior stays byte-for-byte
equivalent to the lawyer-approved version. **Re-upload the two modified theme
files.**

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.js` | **MODIFIED** (removed unused `productLink()`; removed 3 unreferenced ICONS entries) | ✅ Yes |
| `assets/ms-chat-widget.css` | **MODIFIED** (removed 4 unused/orphan rule blocks) | ✅ Yes |
| `snippets/ms-chat-widget.liquid` | UNCHANGED | ❌ No |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |

### REMOVED (dead code — all behavior-preserving; revert each independently)

- **`ms-chat-widget.js` — `productLink()` function.** Unreferenced helper
  (0 call sites); superseded by `productButton()` when tool-card CTAs became
  prominent primary buttons (feature 2). Revert: re-add the function.
- **`ms-chat-widget.js` — ICONS `chat`, `share`, `truck`.** Three unreferenced
  inline-SVG registry entries: `chat` (old launcher icon — launcher now renders
  the animated `logoEl()` orb), `share` (old share icon — feature 7 replaced it
  with the "Per E-Mail teilen" *text* button), `truck` (delivery icon — delivery
  time moved to the product page off the compact card). Revert: re-add the keys.
- **`ms-chat-widget.css` — `.ms-chat-link` / `:hover` / ` svg`.** Only ever
  styled the now-removed `productLink`. Revert: re-add the three rules.
- **`ms-chat-widget.css` — `.ms-chat-checkout-summary`.** Orphan rule from a
  superseded checkout-row layout (current rows use `.ms-chat-checkout-item` /
  `-meta` / `-name`). Revert: re-add the rule.
- **`ms-chat-widget.css` — `.ms-chat-visually-hidden`.** Screen-reader utility
  class never applied in markup (the widget uses `aria-label` directly). Revert:
  re-add the rule.
- **`ms-chat-widget.css` — `.ms-chat-wordmark span`.** Remnant of the old
  "**motion**sports" two-part wordmark; the header now renders only `<b>Mo</b>`
  (no `<span>`). Revert: re-add the rule.

### SKIPPED (protected / out of scope)

- **No WELCOME_DISCOUNT remnants exist in the widget** (JS/CSS/snippet) — nothing
  to remove. (`bulk_discount` in `REASON_LABELS` is the unrelated, retained
  "Mengenrabatt anfragen" contact reason.)
- **"MOIA" → "Mo" naming already reconciled** in all theme assets in a prior
  session; the only remaining "MOIA" strings are historical entries inside this
  changelog and are left intact as a record.
- **Stale default `apiBase` (`…vercel.app`)** left untouched — it is the operative
  configured default and changing it would change behavior (see `AUDIT_FRONTEND.md`
  F1). The legacy `ms-chat-expanded=1 → modal` migration is likewise kept
  (documented, behavior-bearing).

---

## Session update (2026-06-12) — alignment with the updated API_CONTRACT.md: browsing-trail handoff, fresh-open greeting, customer memory, capture decline event, contract-exact KPI, sold-out badges

Re-sync against the reworked `API_CONTRACT.md` (context `recentlyViewed` +
`type: "browsing"`, `messages: []` fresh-open greeting, `customer.email`
memory, `email_capture_declined`, `/api/kpi` required headers, `inStock`).
**Re-upload all three theme files.**

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.js` | **MODIFIED** (context shapes, greeting, customer memory, decline, track(), sold-out) | ✅ Yes |
| `assets/ms-chat-widget.css` | **MODIFIED** (sold-out badge/note, capture decline link) | ✅ Yes |
| `snippets/ms-chat-widget.liquid` | **MODIFIED** (adds `productHandle` to `pageContext`) | ✅ Yes |
| `docs/WIDGET_SPEC.md` | **MODIFIED** (§6, §6a, §9a, §9b, §9c re-synced) | ❌ No (not a theme asset) |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |

### What changed (each item = a contract §2/§3/§5/§7 alignment)

- **Category starter context fixed (was dead on arrival).** Starters seeded
  from a category sent `context: { type: "category", … }` — a type the
  contract ignores wholesale. They now send `type: "browsing"` with the
  seeding category leading `recentlyViewed`.
- **Browsing-trail handoff implemented.** The localStorage trail now maps to
  the contract's `recentlyViewed` wire shape (3 products + 2 categories,
  most recent first, product ids = **handles**) and rides along on product
  starters, category starters, the product CTA and the nudge greeting —
  only ever inside a user-initiated chat request, never per-turn.
- **Fresh-open greeting on nudge click.** Clicking the nudge with a fresh
  conversation POSTs `messages: []` + context and renders the streamed
  contextual greeting (no fake user primer). With existing history it just
  opens, as before. The product CTA deliberately KEEPS its primer message:
  the theme passes the numeric `product.id`, whose validity against the
  catalog's slug ids is unconfirmed — the primer carries the title in text
  and works either way.
- **Returning-customer memory.** After a successful `/api/capture-email`,
  the widget attaches `customer: { email }` to subsequent `/api/chat`
  requests — **in-memory only**, this page's session only, never persisted
  (contract §2 privacy gate).
- **`email_capture_declined`.** The capture card gained a quiet "Nein danke,
  vielleicht später" link: collapses the card, fires the one widget-side
  funnel event (`trigger` only), releases the header entry point.
- **Capture success copy branches** on the response: the "bitte bestätige"
  line shows only when `marketing.status === "pending"`.
- **`track()` is now contract-exact** (§5): `fetch` with
  `Content-Type: application/json` + `x-ms-session` header +
  `keepalive: true` (sendBeacon could set neither header and sent
  `text/plain`; it remains only as a last-resort fallback).
- **Sold-out rendering** (§3): `inStock: false` → "Ausverkauft" badge on the
  product card; quick-checkout rows flag sold-out items because the
  server-built `cartUrl` excludes them.

### ⚠️ Verify during testing (two open questions)

1. **Catalog id space:** the widget sends Shopify **handles** as
   context/trail product ids (best match for the contract's slug-shaped
   ids, e.g. `atx-treadmill-pro-fold`). If the backend catalog's ids differ
   from Shopify handles, trail products are dropped silently (categories
   still match by name) — check the backend logs/behavior and tell me the
   canonical id source if it mismatches.
2. **KPI CORS:** `track()` now sends JSON + headers, which triggers a CORS
   preflight — fine per the contract's allowlist, but verify beacons land
   from the live storefront origin (network tab → `/api/kpi` → 202).

### Test checklist (after copying to the live theme)

- [ ] **Category starter grounding:** after browsing a collection, tap a
      category starter — the request body shows
      `context: { type: "browsing", recentlyViewed: [...] }` and the answer
      is category-specific.
- [ ] **Trail rides along:** with 2-3 products viewed, a product starter /
      CTA request carries `recentlyViewed` (≤3 products + ≤2 categories,
      handles as ids); no chat request ever carries the trail without a
      user action.
- [ ] **Nudge greeting:** fresh session, let the nudge fire on a product
      page, click it — the chat opens and Mo streams a greeting about that
      product (request had `messages: []` + context). With existing history
      the click just opens the panel.
- [ ] **Customer memory:** submit the capture form, send another message —
      the request carries `customer: { email }`; reload the page and send
      again — it does NOT (in-memory only).
- [ ] **Decline:** open the capture form, click "Nein danke" — card
      collapses, one `email_capture_declined` KPI beacon with the trigger;
      the header button can open a fresh form afterwards.
- [ ] **Success copy:** submit with marketing ticked → success text includes
      the DOI confirm line; without marketing → it doesn't.
- [ ] **KPI wire shape:** `/api/kpi` requests carry
      `Content-Type: application/json` + `x-ms-session` and return 202 (also
      for events fired right before navigation, e.g. checkout clicks).
- [ ] **Sold-out:** a product with `inStock: false` renders the card with an
      "Ausverkauft" badge; in a multi-product checkout card the sold-out row
      is flagged and the cart link only contains the in-stock items.

---

## ⭐ Session update (2026-06-12, later) — context-aware engagement layer: browsing trail, contextual nudge, context-seeded starters, one-time launcher attention, new KPI events

An ambient, client-side engagement layer that makes opening Mo more likely
**without an interrupting popup**. Everything is gathered client-side and
used only in-session; the browsing trail lives only in the user's
`localStorage` and is **never transmitted** (the only backend call remains
the existing fail-silent `/api/kpi` beacon — event names + page type,
never browsed product names, never message text). Spec: new §9c in
`docs/WIDGET_SPEC.md`. **Re-upload both widget assets AND the snippet.**

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.js` | **MODIFIED** (page context + trail, nudge, starters, attention motion, new KPI events) | ✅ Yes |
| `assets/ms-chat-widget.css` | **MODIFIED** (`.ms-chat-nudge*`, `.ms-chat-starter*`, `.ms-chat-launcher--attn`, reduced-motion guards) | ✅ Yes |
| `snippets/ms-chat-widget.liquid` | **MODIFIED** (adds `pageContext` to `window.MS_CHAT_CONFIG` — see below) | ✅ Yes |
| `docs/WIDGET_SPEC.md` | **MODIFIED** (new §9c; §4.2 welcome note; §9b events; checklist) | ❌ No (not a theme asset) |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |

### Snippet edit (the only Liquid change)

`snippets/ms-chat-widget.liquid` now injects a `pageContext` object into
`window.MS_CHAT_CONFIG`: `pageType` (`request.page_type`) always, plus
`productId`/`productTitle`/`productType` on product pages and
`collectionTitle`/`collectionHandle` on collection pages. Server-rendered
page facts only — no user data. If you hand-edit instead of overwriting,
add the `pageContext: { … }` block after `allowedFromTheme: true,`.

### What changed

- **Page context + browsing trail (client-side only).** The JS normalizes
  `pageContext` to product / collection / cart / home / other (+ category =
  product type or collection title) and keeps a trail of the last **5**
  products/collections viewed (`ms-chat-trail` in `localStorage`:
  id + name + type + category + timestamp, deduped, pruned after ~3 days).
- **Contextual proactive nudge** — a small dismissible speech bubble above
  the launcher (never a blocking overlay). Copy by priority, all grammar-safe
  (names quoted): product page → „Fragen zum Produkt „X“? Ich helf dir gern
  weiter.“; collection page → „Unsicher, was aus „X“ zu dir passt? Lass es
  uns klären.“; ≥2 trail products in one category → „Du schaust dir ein paar
  Produkte aus „X“ an — soll ich beim Vergleich helfen?“; otherwise a
  friendly generic offer. **Triggers** (first one wins): dwell ~24s on
  product/collection pages, scroll past ~85% of a product page, exit intent
  (desktop only — mobile degrades to dwell/scroll). **Frequency:** once per
  session; dismissing (the small ×) persists forever
  (`ms-chat-nudge-dismissed`); never shown once the chat was opened this
  session; clicking the bubble opens the chat.
- **Context-seeded starter prompts** in the welcome state: 3 tappable chips
  under the orb, seeded current/last product → category (collection page or
  trail streak) → strong general starters. Tapping sends the text as the
  first user message carrying the same `context` shape `openWithProduct`
  already sends (smart backend handling of it is BE-NUDGE, separate).
- **One-time launcher attention animation:** a single gentle bounce ~1.4s
  after load, once per session (in-session navigation never replays it),
  skipped under `prefers-reduced-motion`.
- **New KPI events** (existing fail-silent `track()` → `POST /api/kpi`,
  session-keyed, no personal data): `nudge_shown` (pageType, contextual,
  trigger), `nudge_dismissed`, `nudge_clicked`, `starter_shown` (variant,
  count), `starter_clicked` (variant, index), `launcher_attention_played`.
- **Unchanged on purpose:** the nudge and starters never ask for an email —
  the email ask stays in the capture form (§6a, after value). The
  consent/canonical-copy rework from the earlier session entry below is
  untouched.

### Test checklist (after copying to the live theme)

- [ ] **Contextual message per page type:** on a product page the nudge says
      „Fragen zum Produkt „<Titel>“?…“; on a collection page „Unsicher, was
      aus „<Kategorie>“ zu dir passt?…“; after viewing ≥2 products of one
      category, on a context-free page (e.g. home) it offers comparison help
      for that category; otherwise the generic greeting.
- [ ] **Each trigger fires:** stay ~24s on a product/collection page (nudge
      appears); reload a fresh session and instead scroll to the bottom of a
      product page; reload again and on desktop move the pointer up out of
      the viewport (exit intent). On mobile, exit intent never fires —
      dwell/scroll still do.
- [ ] **Frequency rules:** the nudge appears at most once per tab session;
      after clicking its ×, it never appears again (also after reload —
      `ms-chat-nudge-dismissed` in localStorage); it never appears once the
      chat was opened this session; opening the panel removes a visible
      nudge; clicking the bubble opens the chat.
- [ ] **Context-seeded starters:** with an empty conversation, the welcome
      state shows 3 tappable chips matching the context (product on/after a
      product page, category after browsing a collection/category, strong
      general ones otherwise); tapping one sends it as the first user
      message and the assistant answers about that product/category.
- [ ] **Trail privacy:** `ms-chat-trail` in localStorage holds ≤5 entries;
      watch the network tab — no request ever contains the trail; the only
      new requests are the `/api/kpi` beacons; product context goes out only
      inside `/api/chat` when a starter (or product CTA) message is sent.
- [ ] **Launcher animates once:** one gentle bounce shortly after load; not
      again on the next page navigation in the same tab; with
      "Reduce motion" enabled it never plays (and no
      `launcher_attention_played` beacon fires).
- [ ] **KPI events fire** (fail-silent): `nudge_shown` / `nudge_dismissed` /
      `nudge_clicked` with pageType + contextual flag, `starter_shown` /
      `starter_clicked` with variant, `launcher_attention_played` — visible
      as `/api/kpi` beacons; no console errors when the endpoint is absent.
- [ ] **Nothing asks for email:** neither the nudge nor any starter mentions
      email/newsletter; the capture form still only appears via the
      assistant's offer or the header "Per E-Mail teilen" button.
- [ ] **Modes:** nudge + starters work in desktop sidebar AND modal modes and
      in mobile fullscreen; the nudge never overlaps the open panel.

---

## ⭐ Session update (2026-06-12) — capture form: canonical consent copy from the backend (Art. 7), benefit hint, pre-checked transactional box, prominent marketing box, imprint/privacy links

GDPR/legal rework of the email-capture form per the re-synced root docs
(`docs/API_CONTRACT.md` §2 + §7, `docs/CONSENT_FLOW.md`). The widget **no
longer hard-codes any consent strings** — the consent checkbox labels, the
new marketing benefit hint, the imprint/privacy link targets and the
`consentTextShown` audit string all come from the backend, so the stored
Art. 7 proof can never diverge from what was displayed. **Re-upload both
widget assets.**

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.js` | **MODIFIED** (consent copy fetched from backend; capture-card rework; trigger echo) | ✅ Yes |
| `assets/ms-chat-widget.css` | **MODIFIED** (marketing-prominence block, benefit hint, loading line, legal links) | ✅ Yes |
| `docs/WIDGET_SPEC.md` | **MODIFIED** (§6a rewritten + checklist) | ❌ No (not a theme asset) |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |

### What changed

- **Canonical consent copy from the backend (legally load-bearing).** The
  hard-coded `transactionalLabel`/`marketingLabel` strings were removed from
  the JS. The capture card now renders the backend-served strings: the
  `offer_email_summary` tool **result** seeds an in-memory cache as it streams
  in, and `GET /api/consent-copy` covers every other path (share-button entry
  point, restored history, cache expiry; 60s TTL matching the endpoint's
  `Cache-Control`, never persisted). While the copy loads the card shows
  "Einwilligungstexte werden geladen…" and **submit is disabled**; a load
  failure shows an error + "Erneut versuchen" — the form can never submit
  fallback/stale consent text.
- **`consentTextShown` is now the backend's pre-composed audit string echoed
  back verbatim** (it was previously composed client-side by joining the two
  hard-coded labels) — byte-for-byte what the user saw.
- **Marketing benefit hint** (`marketingBenefitHint`) renders as a small
  supporting line directly beneath the marketing label, inside the same
  consent block (it is part of the served `consentTextShown`).
- **Transactional box is PRE-CHECKED by default** — contractually permitted:
  it is the requested service (Art. 6(1)(b)), not marketing; submitting the
  form is the affirmative request.
- **Marketing box is PROMINENT but stays UNCHECKED** — highlighted block
  (surface tint, accent left edge, bolder label) + the benefit hint. Never
  pre-checked: deliberate, documented legal decision (CJEU *Planet49*, UWG
  Abmahnung risk) — noted as a code comment in both JS and CSS. The two
  consents remain separate/unbundled; submit works with only the
  transactional box.
- **Imprint/Datenschutz links** next to the form (below the privacy caption),
  pointing at the backend-served `imprintUrl`/`privacyUrl`
  (`target="_blank" rel="noopener noreferrer"`).
- **`trigger` echoed to `/api/capture-email`** when the form came from an
  `offer_email_summary` call (telemetry-only, per contract §7.1).
- **Removed the widget-side `email_capture_submitted` KPI event** — the
  contract (§5) records it server-side and forbids widget duplicates.

### Test checklist (after copying to the live theme)

- [ ] **Canonical marketing label:** trigger the capture form (ask Mo for an
      email summary, or the header "Per E-Mail teilen" button) — the marketing
      checkbox label matches the canonical backend string EXACTLY (compare
      with `GET /api/consent-copy`; welcome-discount framing, "Mo darf sich
      mich merken…"), not the old hard-coded copy.
- [ ] **Benefit hint shows:** the "Dein Vorteil: …" line renders directly
      beneath the marketing label as a small supporting line inside the same
      highlighted block.
- [ ] **Checkbox defaults:** transactional box is PRE-CHECKED; marketing box
      is UNCHECKED (also after reload/restored history and via the share
      button). Marketing block is visually prominent but never pre-ticked.
- [ ] **Unbundled:** submitting with only the transactional box ticked works
      (summary email arrives, no DOI email); unticking transactional blocks
      submit with the inline error.
- [ ] **Imprint/privacy links:** "Impressum" and "Datenschutz" links render
      next to the form and open the backend-provided targets in a new tab.
- [ ] **Audit string:** submit the form and verify (backend DB/logs) the
      stored `consentTextShown` equals the displayed strings — i.e. the
      served `consentTextShown` (labels + benefit hint), echoed verbatim.
- [ ] **Loading/failure path:** with the network throttled/blocked, the card
      shows the loading line then the error + "Erneut versuchen"; submit stays
      disabled until the copy loads; retry recovers.
- [ ] **Trigger echo:** a tool-triggered submit sends the offer's `trigger`
      in the POST body (check the request payload in DevTools).

---

## ⭐ Session update (2026-06-11k) — monochrome tool cards (blue fill removed)

Follow-up to 2026-06-11j after client review: the tool cards still had the
light-blue accent background, clashing with the new borderless look. Cards
are now black & white. CSS-only — **re-upload `assets/ms-chat-widget.css`
only** (the JS did not change in this update).

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.css` | **MODIFIED** (card surface/border, product image hairline, compare header row, secondary-button comment) | ✅ Yes |
| `assets/ms-chat-widget.js` | unchanged in this update | ❌ No (unless still pending from 2026-06-11j) |
| `docs/ai-advisor/WIDGET_SPEC.md` | **MODIFIED** (§4.2 + §6 card styling → monochrome) | ❌ No (not a theme asset) |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |

### What changed

- **Card surface:** all five tool cards (product, compare, checkout,
  showroom, contact/email-capture) drop the light-blue fill + blue border
  for a clean **white surface with a hairline neutral border**
  (`--msc-border`, foreground at 12%). The hairline alone separates a card
  from the plain-text flow.
- **Product card:** the image area gets a hairline bottom border (the blue
  body fill used to provide that separation on an all-white card).
- **Compare table:** the header row's blue tint becomes the neutral grey
  surface token (foreground at 4%).
- Buttons unchanged in form: the dark accent pill stays the single strong
  element; the secondary button stays bordered. Semantic tag colors
  (Bestseller/Neu/Sale…) and the sale-price red are kept — they're product
  information, not card chrome.

### Test checklist (after copying to the live theme)

- [ ] Ask Mo for a product / a comparison / checkout / showroom / the
      contact and email forms: every card is white with a thin grey border —
      no blue anywhere in the card chrome.
- [ ] Product card: image area and body are visually separated by the
      hairline; the black "Zum Produkt" pill stands out.
- [ ] Compare table: header row is light grey, cells white, still scrolls
      horizontally on mobile.
- [ ] Forms (contact + email capture): inputs/checkboxes still clearly
      visible (bordered) on the white card; error/success states unchanged.
- [ ] Cards still read cleanly in sidebar, modal and mobile fullscreen next
      to the borderless messages.

---

## ⭐ Session update (2026-06-11j) — borderless document-style messages, new generating animation, mobile view-switch button removed

Visual polish only — streaming logic, tool cards' internal design and all
behavior untouched. **Re-upload both widget assets.**

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.css` | **MODIFIED** (message/bubble block rewritten; typing-dots block → `.ms-chat-row--gen` orb animation; mobile `.ms-chat-mode` hide fixed; reduced-motion list updated) | ✅ Yes |
| `assets/ms-chat-widget.js` | **MODIFIED** (`showTyping()` renders the animated-avatar generating row instead of three dots) | ✅ Yes |
| `docs/ai-advisor/WIDGET_SPEC.md` | **MODIFIED** (§4.1a avatar exception, §4.2 message styling + generating indicator, §6 card styling) | ❌ No (not a theme asset) |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |

### What changed

- **Mobile view-switch button actually hidden (bug fix):** the sidebar ⇄
  modal toggle does nothing on mobile (always fullscreen) but still rendered
  as a dead header button. Root cause: the mobile
  `.ms-chat-mode { display: none }` rule was overridden by the LATER
  `.ms-chat-iconbtn { display: flex }` base rule (equal single-class
  specificity → source order wins). The hide rule is now
  `.ms-chat-iconbtn.ms-chat-mode` (doubled class out-specifies the base
  rule). Desktop unchanged; the header flex row simply closes the gap, so
  share / new-chat / X keep their placement.
- **Borderless document-style messages** (intentionally REPLACES the filled
  light-blue/grey bubble design): assistant (Mo) messages are now plain
  flowing text directly on the panel surface — no fill, no border — with the
  small static logo avatar as the speaker marker. User messages keep only a
  very light low-contrast fill (foreground at 6%, soft 18px radius, no
  corner tail), right-aligned. Turn spacing widened (12 → 20px), line-height
  eased to 1.55, and the assistant column gets a 7px top inset so the first
  text line optically centers on the avatar. Tool cards keep their light-blue
  styling and now read as the only filled blocks in the assistant flow.
- **New generating animation** (replaces the three bouncing dots): while a
  reply is pending, the assistant-slot avatar itself animates — the brand
  orb's wave bundles run at a calm 3.6s pace plus a gentle breathing pulse
  (`.ms-chat-row--gen`). The row carries `role="status"` /
  `aria-label="Mo antwortet"`. When the first tokens stream in, the row is
  swapped in place for the regular static-avatar message row, so the orb
  reads as settling beside the text. `prefers-reduced-motion` freezes it to
  the static orb (selectors added to the reduced-motion block).

### Test checklist (after copying to the live theme)

- [ ] **Mobile header:** on a phone / ≤640px viewport the view-switch button
      is GONE (only share-when-visible, new-chat and X remain); the X stays
      correctly placed at the right edge and all targets are still ≥44px.
      On desktop (both sidebar and modal) the toggle still shows and works.
- [ ] **Assistant messages:** Mo's replies render as plain text on the panel
      surface — no fill, no border — with the static orb avatar beside them;
      links/bold inside replies still styled.
- [ ] **User messages:** right-aligned with only a faint grey rounded
      surface; clearly distinguishable from Mo's plain text but never a
      heavy bubble.
- [ ] **All three views:** the borderless look is identical in the docked
      sidebar, the centered modal and mobile fullscreen, with readable
      contrast and generous spacing between turns.
- [ ] **Tool cards:** product / compare / checkout / showroom / contact /
      email-capture cards keep their light-blue card styling and sit cleanly
      in the new flow (restored history included).
- [ ] **Generating animation:** send a message → the avatar orb in the
      pending row animates (calm waves + gentle pulse), no dots; when the
      first tokens arrive it transitions smoothly into the streamed text
      with the static avatar (no jump in position).
- [ ] **Reduced motion:** with `prefers-reduced-motion: reduce` the
      generating orb is frozen (static frame), everything else still works.

---

## ⭐ Session update (2026-06-11i) — composer polish: placeholder = welcome prompt, no scrollbar UI

Small follow-up to 2026-06-11h. **Re-upload both widget assets.**

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.css` | **MODIFIED** (welcome hint rule removed; textarea scrollbar hidden) | ✅ Yes |
| `assets/ms-chat-widget.js` | **MODIFIED** (placeholder text, welcome hint removed, re-measure on open) | ✅ Yes |
| `docs/ai-advisor/WIDGET_SPEC.md` | **MODIFIED** (§4.2 welcome + composer bullets) | ❌ No (not a theme asset) |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |

### What changed

- **"Wie kann ich dir helfen?" moved into the composer:** the welcome state
  is now the 96px orb alone (the hint line below it is gone, incl. its CSS
  rule); the prompt is the textarea placeholder (replaces "Frag mich
  etwas …").
- **No scrollbar UI in the composer:** `scrollbar-width: none` +
  `::-webkit-scrollbar { display: none }` on the textarea — past the
  120px cap it still scrolls (wheel/touch/caret), just without the bar.
- **Stray scrollbar on first open fixed at the root:** init-time
  `autoGrow()` measured the textarea inside the still-hidden panel
  (scrollHeight 0 → mis-sized, internally overflowing field, which showed
  scrollbar arrows until the next keystroke). `openPanel()` now re-runs
  `autoGrow()` once the panel is visible.

### Test checklist

- [ ] Fresh chat: welcome area shows ONLY the orb; the input shows the
      muted "Wie kann ich dir helfen?" placeholder.
- [ ] Reload the page → open the chat via the launcher: no scrollbar
      arrows/track in the input, before typing anything (the screenshot
      bug).
- [ ] Paste many lines: field caps at ~5 lines and scrolls internally
      with NO visible scrollbar; wheel/touch/arrow keys still scroll it.
- [ ] Sidebar, modal and mobile fullscreen all show the same clean field.

---

## ⭐ Session update (2026-06-11h) — unified chat composer (Claude/ChatGPT-style input area)

Contained restyle of the chat INPUT AREA only — message list, tool cards,
streaming and all logic untouched. **Re-upload both widget assets.**
Supersedes the earlier compressed-view input tweak; the composer is identical
in sidebar, modal and mobile fullscreen.

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.css` | **MODIFIED** (input-area block rewritten: `.ms-chat-composer` + send/mic restyle) | ✅ Yes |
| `assets/ms-chat-widget.js` | **MODIFIED** (composer DOM in `buildShell`, send toggle in `autoGrow`, ↑ send icon) | ✅ Yes |
| `docs/ai-advisor/WIDGET_SPEC.md` | **MODIFIED** (§4.2 input bullet rewritten as "unified composer") | ❌ No (not a theme asset) |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |

### What changed

- **One unified container:** textarea + actions now live inside a single
  rounded surface with one shared border (`.ms-chat-composer`); the textarea
  is borderless/transparent inside it. Focus ring moved to the container
  (`:focus-within`). The old divider line above the input bar is gone.
- **Two-row layout:** text on top (full width); bottom row holds the
  right-aligned mic + send. Buttons shrank to quiet in-composer size
  (36px desktop / 40px mobile); the mic is now a low-contrast ghost button
  (recording state unchanged: accent fill + pulse).
- **Send appears on typing:** empty input → no send button (mic stays). ≥1
  non-whitespace char → send fades/scales in (~160ms); emptying hides it
  again. Toggled in `autoGrow()` so typing, voice dictation, send-clear and
  error-restore stay in sync; hidden state leaves the tab order; reduced
  motion disables the transition. Send icon is now an ↑ arrow.
- **Capped auto-grow:** unchanged 120px cap, now documented as the contract —
  the textarea grows to ~5 lines then scrolls internally; the panel never
  grows. Light theme tokens only; Enter/Shift+Enter and the
  streaming-disabled state preserved; disclaimer sits beneath the container.

### Test checklist (after copying to the live theme)

- [ ] **Unified look:** input reads as ONE rounded bordered surface — no
      inner border around the text field, no separator line above the bar;
      clicking anywhere on the surface focuses the text; focus shows the
      accent ring on the container.
- [ ] **Appear-on-type send:** open fresh → only the mic shows (flush
      right). Type one character → send blends in next to the mic. Delete
      everything (also: whitespace only) → send hides again. Dictating via
      mic also reveals it.
- [ ] **Grow then scroll:** type/paste many lines → composer grows a few
      lines (to ~120px), then STOPS and the text scrolls inside; the panel,
      message list and disclaimer don't move further. Sending resets it to
      one line.
- [ ] **Keys:** Enter sends; Shift+Enter inserts a newline; while a reply
      streams the whole composer (text, mic, send) is disabled.
- [ ] **All three views:** composer looks and behaves the same in the docked
      sidebar, the centered modal, and mobile fullscreen.
- [ ] **Mobile keyboard:** focus the input on a phone → the composer stays
      pinned just above the keyboard; multi-line input still caps + scrolls
      internally and never pushes the header/panel off-screen.

---

## ⭐ Session update (2026-06-11g) — desktop sidebar ⇄ modal layout modes + mobile TRUE fullscreen with keyboard handling

Two independent reworks of the panel's shipping form. **Re-upload both widget
assets.** Supersedes the "2/3 desktop height / enlarged 560px"
(`ms-chat-expanded`) and "mobile near-fullscreen with inset" behaviors.

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.css` | **MODIFIED** (desktop mode blocks, page-shift rules, mobile fullscreen block) | ✅ Yes |
| `assets/ms-chat-widget.js` | **MODIFIED** (view-mode state/toggle, page shift, visualViewport handling) | ✅ Yes |
| `docs/ai-advisor/WIDGET_SPEC.md` | **MODIFIED** (§4.2/§4.4/§4.5/§7 rewritten) | ❌ No (not a theme asset) |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |

### Part 1 — DESKTOP (≥641px): two layout modes

- **Sidebar (COMPACT, default for new users):** docked to the right edge,
  full viewport height, 410px wide, **no backdrop/blur** — the site stays
  visible and interactive. **Page-reflow was used (NOT the overlay
  fallback):** while open, `ms-chat-page-shift` on `<html>` applies
  `margin-right: 410px` (+ `overflow-x: hidden`), so the storefront reflows
  next to the chat with a smooth 360ms margin transition (a temporary
  `ms-chat-page-anim` class carries the transition only around the change).
  The desktop header is `position: sticky`, so it reflows/shifts with the
  layout; in the 641–749px band, where the theme makes `sticky-header`
  `position: fixed`, a companion rule pins its right edge to the sidebar.
  Known cosmetic tradeoff: the page's own scrollbar sits under the docked
  panel (wheel/touch scrolling unaffected); viewport-`fixed` toasts/overlays
  (e.g. the notification bar) stay viewport-relative beneath the panel.
- **Modal (FULL):** centered `min(900px, 100vw - 128px)` ×
  `calc(100dvh - 112px)` over the existing dimmed + 6px-blurred backdrop;
  backdrop click closes. Site not interactive behind.
- The header **mode toggle** (replaces enlarge) switches sidebar ⇄ modal;
  its icon shows the *target* layout (centered-window / docked-panel glyph).
  Mode persists in `localStorage` `ms-chat-view-mode` (legacy
  `ms-chat-expanded=1` migrates to `modal`); the launcher reopens in the
  last-used mode. Toggling preserves the message list's distance-from-bottom
  across the relayout. Open/close/toggle are animated (slide-in for the
  sidebar, fade/scale for the modal; all disabled under reduced motion).
  Closing removes every page-side class — no leftover offset or backdrop.

### Part 2 — MOBILE (≤640px): true fullscreen + keyboard handling

- **True fullscreen:** top/left/right 0, 100% width, no margin, no border or
  radius, **backdrop hidden** (site fully covered) → close via the X only.
  While open, `ms-chat-mobile-open` on `<html>` freezes page scroll behind
  the chat (scoped to ≤640px).
- **Keyboard:** panel height = the **visual viewport** — CSS fallbacks
  `100vh` → `100dvh`, plus the JS pins an inline px height from the
  `visualViewport` API on its `resize`/`scroll` events and re-pins with
  `translateY(visualViewport.offsetTop)` (iOS focus auto-scroll). The input
  row stays just above the keyboard, the message list shrinks and stays
  scrollable, and if the user was at the bottom the list re-pins so the
  latest message + input remain in view.
- **UX:** header icon buttons enlarged to 44px on mobile; the layout-mode
  toggle is hidden (desktop concept); `overscroll-behavior: contain` +
  momentum scrolling on the message list; safe-area insets respected (header
  top, input-bar bottom, new left/right padding for landscape notches).
- Desktop and mobile branches are cleanly separated: all desktop side
  effects (page shift, backdrop) and mobile side effects (scroll lock,
  viewport sizing) gate on one `matchMedia('(min-width: 641px)')`, which is
  re-synced when the viewport crosses the breakpoint while open.

### Dev-theme test checklist — DESKTOP

1. **Sidebar opens with page reflow:** fresh browser profile (no
   localStorage) → launcher opens a full-height right-docked sidebar, no
   dim/blur; the storefront slides/reflows left by 410px (sticky header
   included) and remains scrollable and clickable (add to cart, nav, etc.).
2. **Modal mode:** click the mode toggle (centered-window icon) → panel
   animates to a centered near-fullscreen window with a generous margin;
   storefront behind is dimmed + blurred; clicking the blurred edge closes
   the chat; the toggle now shows the docked-panel icon.
3. **Persistence:** pick modal, reload, reopen → opens as modal. Switch to
   sidebar, reload, reopen → opens as sidebar.
4. **Scroll keeps on toggle:** in a long conversation, scroll mid-history,
   toggle modes both ways → reading position (distance from bottom) is kept.
5. **Clean close:** close from sidebar mode → the page animates back to full
   width with no leftover right offset, horizontal scrollbar, or stuck
   backdrop; close from modal mode → backdrop gone, page untouched.
6. **641–749px band:** at ~700px width, opening the sidebar also shifts the
   (fixed) header left so it doesn't run beneath the panel.

### Dev-theme test checklist — MOBILE (real device, esp. iOS Safari)

1. **True fullscreen:** tap the launcher → chat covers the entire screen
   edge-to-edge; no margin, no website sliver, no blur ring; page behind
   does not scroll; the only way out is the header X (which works).
2. **Keyboard:** focus the input → the input row stays pinned directly
   above the keyboard, the message list shrinks and scrolls above it, and
   NO website is visible behind/below the panel (the old push-up bug).
   Dismiss the keyboard → panel returns to full height.
3. **Send flow:** with the keyboard open, send a message → the latest
   message and the input stay in view while the reply streams.
4. **Safe areas:** on a notched phone, the header clears the notch, the
   disclaimer/input clear the home bar, and in landscape nothing hides
   under the rounded corners/notch strips.
5. **Tap targets:** header X / new-chat are comfortably tappable (44px);
   the mode-toggle button is absent on mobile.
6. **Features intact:** product/compare/checkout/showroom cards, the
   contact + email-capture forms, share button and voice input all render
   and work in fullscreen (compare table scrolls horizontally inside).

---

## ⭐ Session update (2026-06-11f) — FIX: welcome/avatar orbs lose their waves while the panel is open

One-cause JS bug fix. All orb SVGs shared the same gradient ids
(`#ms-chat-lg-cool/-warm`); `url(#id)` resolves to the FIRST matching id in
the document — usually the launcher's copy. Opening the panel hides the
launcher with `display: none`, and WebKit/Blink fail to paint gradients
defined inside a `display:none` subtree → every other orb's strokes lost
their paint and the waves vanished (the empty glass bubble remained). On
product pages it happened to keep working because the CTA's SVG comes first
in the DOM there and stays visible.

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.js` | **MODIFIED** (unique gradient ids per orb) | ✅ Yes |

### What changed
`logoWaves()` now stamps a unique id prefix into each injected SVG
(`__UID__` placeholder → `ms-chat-lg<seq>-<rand>`), so every orb references
its OWN `<defs>` and never depends on another instance's visibility.

### Dev-theme test checklist (this session)
1. On a NON-product page (e.g. home): open the chat — the 96px welcome orb
   shows its animated sine waves (launcher hidden at the same time).
2. Send a message: the static avatar orb next to Mo's reply shows its waves.
3. Launcher (panel closed), product CTA: unchanged.

---

## ⭐ Session update (2026-06-11e) — FIX: launcher orb clipped to its top-left corner

One-rule CSS bug fix. The legacy icon rule `.ms-chat-launcher svg { width:
26px; height: 26px; }` (from when the launcher held a chat icon) outranked
`.ms-chat-logo-waves` and shrank the injected wave SVG to 26×26px anchored at
the bubble's top-left — on the floating button only, the orb appeared as a
static clipped corner while every other placement was fine.

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.css` | **MODIFIED** (one rule removed, one hardened) | ✅ Yes |

### What changed
1. Removed the dead `.ms-chat-launcher svg` sizing rule (nothing else in the
   launcher uses an SVG anymore).
2. Hardened the wave-SVG sizing with a doubled selector
   (`.ms-chat-logo .ms-chat-logo-waves`, specificity 0,2,0) so no ancestor
   `... svg { width/height }` rule — ours or the theme's — can shrink the
   bundle again in any placement.

### Dev-theme test checklist (this session)
1. The floating launcher shows the FULL glass orb edge-to-edge with the sine
   bundle animating (amplitude breathing + crest lean), identical to the
   welcome orb — not a static top-left fragment.
2. Welcome orb, avatar and product CTA unchanged.

---

## ⭐ Session update (2026-06-11d) — true sine waves (inline SVG strands)

The wave strands are no longer circle arcs (which can only bow one way — they
read as half-circles changing amplitude). Each strand is now a **true sine
S-curve**: it rises into a crest on one side of the bubble, swings through
the midline, troughs on the other side, and still starts/ends at the **same
two anchor points** on the bubble's left and right. Implemented as a tiny
**inline SVG** (cubic-bézier paths with gradient strokes) that the widget JS
injects into every `.ms-chat-logo` span — still self-contained: no image
asset, no external request, no library. The glass bubble, rim, pinned-anchor
animation, variants and reduced-motion behaviour are unchanged.

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.css` | **MODIFIED** (strand masks → SVG styling) | ✅ Yes |
| `assets/ms-chat-widget.js` | **MODIFIED** (LOGO_WAVES SVG + injection) | ✅ Yes |
| `templates/product.json` | **UNCHANGED** (CTA span filled by the JS) | ❌ No |
| `docs/ai-advisor/WIDGET_SPEC.md` | **MODIFIED** (§4.1a, docs only) | ❌ No (not a theme asset) |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |

### What changed

1. **JS:** new trusted-markup constant `LOGO_WAVES` — an SVG (`viewBox
   0 0 100 100`) with two `<g>` bundles of sine paths: cool (blue → cyan →
   mint; big/medium/subtle strands + a wide low-opacity glow copy; crest left,
   trough right) and warm (cream → amber → orange → red; mirrored). Every
   path is `M0 50 … 100 50` → shared anchors. `logoEl()` appends it; `init()`
   also fills any server-rendered empty `.ms-chat-logo` span (the product
   CTA). Gradient stops fade to transparent at both ends.
2. **CSS:** the radial-arc `mask-image` pseudo-element strands are gone;
   `.ms-chat-logo-waves` / `.ms-chat-logo-bundle--cool/--warm` style and
   animate the SVG groups instead. The existing pinned-anchor keyframes
   (`ms-chat-logo-wave-a/b`: scaleY breathing + skewX crest lean +
   hue-rotate, uneven stops, two speeds, offset phase) apply as-is via
   `transform-box: view-box`. Avatar-static and reduced-motion rules now
   target `.ms-chat-logo-bundle`.
3. **Fallback note:** if the widget JS doesn't run, orb spans show the empty
   glass bubble (rim + frost, no waves) — the CTA is inert without the JS
   anyway.

### Dev-theme test checklist (this session)

1. **Sine shape:** strands clearly rise above AND dip below the midline (an
   S, not a half-circle): cool bundle crests left-of-center and troughs
   right; warm bundle mirrored; all converge at the same left/right points.
2. **Motion:** amplitudes breathe and crests lean as before; ends stay
   pinned; no jumps over ≥30s.
3. **All four placements** (launcher, 96px welcome, static avatar, slow CTA)
   show the sine bundle; the CTA orb gets its waves once the widget JS loads.
4. **Reduced motion** freezes everything to the static sine frame.

---

## ⭐ Session update (2026-06-11c) — anchored wave bundle (waves share one origin left & right)

Wave geometry + motion rework only (CSS, one file). The strands now form a
**single converging bundle**: every wave runs from the **left edge to the
right edge** of the bubble and **all waves share the same two anchor points**
on the bubble's horizontal midline, differing only in amplitude, bow
direction and phase — like the reference artwork. The animation reads as the
waves flowing left-to-right: the wave parameters (amplitude, crest position,
hue) drift organically while both ends stay cleanly pinned.

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.css` | **MODIFIED** (wave masks + keyframes) | ✅ Yes |
| `assets/ms-chat-widget.js` | **UNCHANGED** | ❌ No |
| `templates/product.json` | **UNCHANGED** | ❌ No |
| `docs/ai-advisor/WIDGET_SPEC.md` | **MODIFIED** (§4.1a, docs only) | ❌ No (not a theme asset) |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |

### What changed

1. **Shared anchors (geometry).** Each strand is still a thin radial-gradient
   arc ring in the pseudo-elements' masks, but every arc's circle is now
   calibrated to pass through the SAME two points — (0%, 50%) and
   (100%, 50%) — using center (50%, 50±d), radius R = √(50² + d²). Cool
   bundle (`::before`, bows up): d = 35/70/130 + a glow arc; warm bundle
   (`::after`, bows down): d = 45/90 + a glow arc. The color gradients fade
   to transparent at both ends, so the bundle converges and dissolves at its
   shared origins.
2. **Pinned-anchor animation.** Rotation/translation (which moved the ends)
   are gone; the keyframes animate ONLY `scaleY` (amplitude breathing,
   0.62–1.35) and `skewX` (crest lean, ±10°) about the centre — both leave
   the midline, and with it both anchor points, mathematically fixed. Three
   unevenly spaced stops per loop, two layer speeds (7s / ~10s) and an offset
   phase make the parameter drift feel random/natural; 0% == 100% keeps each
   loop seamless. Subtle `hue-rotate` retained.
3. **Palette nudged toward the reference:** cool bundle blue → cyan → mint
   (faint warm origin on the left), warm bundle cream → amber → orange → red.
4. Glass bubble, rim, launcher, welcome state, avatar/CTA variants and
   reduced-motion behaviour are all untouched from v3.

### Dev-theme test checklist (this session)

1. **Anchored bundle:** all waves emanate from one point at the bubble's left
   edge and converge to one point at its right edge (mid-height); no strand
   end drifts up or down during the whole animation.
2. **Wave look:** strands bow with different amplitudes (blue/cyan family up,
   warm family down), crossing near the middle like the reference.
3. **Motion:** amplitudes swell/shrink and crests lean left/right at
   different rhythms — feels like the wave is travelling left-to-right;
   no sudden jumps over ≥30s.
4. **Everything else unchanged:** clear glass + rim, welcome orb, static
   avatar, slow CTA, reduced-motion freeze.

---

## ⭐ Session update (2026-06-11b) — clear liquid-glass orb v3, distinct light-strands, orb welcome state

Three changes to the (still pure-CSS) brand mark and the chat welcome screen.
**Re-upload all three theme files** — this round touches the JS too.

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.css` | **MODIFIED** (orb v3 + welcome styles) | ✅ Yes |
| `assets/ms-chat-widget.js` | **MODIFIED** (orb welcome state) | ✅ Yes |
| `templates/product.json` | **MODIFIED** (CTA strand blur 1px → 0.4px) | ✅ Yes |
| `docs/ai-advisor/WIDGET_SPEC.md` | **MODIFIED** (docs only) | ❌ No (not a theme asset) |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |

### What changed

1. **Clear liquid glass (no dark fill, no specks).** The orb's bubble is now a
   barely-there translucent white fill + `backdrop-filter: blur(6px)
   saturate(150%)` frost on the orb itself, so whatever sits behind it shows
   through — actual liquid glass. The dust-speck layers are gone. The
   chromatic rim (mint/red/blue inset shadows) stays as the glass edge. The
   launcher button matches: near-transparent fill (`rgb(255 255 255 / 10%)`),
   stronger frost (14px), lighter drop shadow.
2. **Distinct light-strands instead of blurred bands.** Each pseudo-element
   now paints one horizontal color gradient and **masks it into thin
   radial-gradient ARC rings** (union of mask layers), producing genuinely
   curved, crisp lines: 3 strands + 1 faint glow arc bulging up (red →
   magenta → warm white → violet → blue), 2 strands bulging down (orange →
   cream → mint → blue). Blur is sub-pixel (default 0.5px) so lines stay
   distinct. Motion is livelier: base cycle 9s → **7s**, wider rotation swing
   (±7–8°), added vertical drift (±3–4%) and stronger hue-rotate (±24–30°) —
   still smooth/subtle, just more alive. Fallback: without `mask-image`
   support the strands degrade to a soft full-gradient disc.
3. **Orb welcome state (JS + CSS).** `buildWelcome()` no longer renders the
   "motionsports" wordmark + heading + paragraph. A fresh chat now shows the
   **96px full-motion orb** centered with a single muted line beneath it:
   *"Wie kann ich dir helfen?"* — nothing else. (The now-unused `wordmark()`
   helper was removed; the header's "Mo" wordmark is unaffected.) New CSS:
   `.ms-chat-welcome-logo`, `.ms-chat-welcome-hint`.
4. Avatar still static; CTA still the calm 22s variant (its inline CSS now
   passes `--msc-logo-blur: 0.4px` to keep the strands crisp at 36px);
   `prefers-reduced-motion` still freezes every variant including the
   welcome orb.

### Dev-theme test checklist (this session)

1. **Liquid glass:** the launcher has NO dark/black fill — the storefront is
   visible, frosted, through the sphere; the colorful rim + strands define it.
   Same on the product page CTA (white page shows through).
2. **Distinct strands:** the light-waves read as separate thin curved LINES
   (count ~5 plus a faint glow arc), not a blurred ribbon; they cross and
   braid as they float; noticeably more motion than before but still calm.
3. **Welcome state:** open a fresh chat ("Neuen Chat starten" if needed): a
   large animated orb sits centered with only "Wie kann ich dir helfen?"
   below it — no motionsports wordmark, no paragraph copy. Sending the first
   message clears it as before; restored histories skip it.
4. **Avatar stays calm** (still frame); **reduced-motion** freezes launcher,
   welcome orb and CTA to the same static braid frame.
5. **Fallbacks:** no `backdrop-filter` → orb/launcher lose the frost but keep
   the faint fill + rim + strands; no `mask-image` → strands soften to a
   gradient disc; no errors in either case.

---

## ⭐ Session update (2026-06-11) — glass-sphere orb v2 + liquid-glass launcher

Visual redesign of the (still pure-CSS) animated mark, modelled on a Siri-orb
reference screenshot: instead of the rotating conic ribbon ring, the orb is
now a **dark liquid-glass sphere** with a **chromatic rim light** (mint top,
red bottom-left, blue bottom-right), faint **dust specks** in the glass, and a
horizontal **braid of glowing, fibrous light-waves** (red/orange → magenta →
warm white → mint → violet → blue) gently undulating across the middle. The
floating launcher itself becomes a **frosted liquid-glass button**.

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.css` | **MODIFIED** (orb v2 + glass launcher) | ✅ Yes |
| `templates/product.json` | **MODIFIED** (CTA orb vars + rim re-assert) | ✅ Yes |
| `assets/ms-chat-widget.js` | **UNCHANGED** | ❌ No |
| `docs/ai-advisor/WIDGET_SPEC.md` | **MODIFIED** (§4.1/§4.1a, docs only) | ❌ No (not a theme asset) |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |

### What changed

1. **Orb v2 (`.ms-chat-logo`).** Root carries the glass bubble (translucent-
   capable `--msc-logo-base` fill), the chromatic rim (`--msc-logo-rim-shadow`,
   layered inset shadows scaled by `--msc-logo-rim`), dust specks, a top sheen
   and a soft glow pool. The two pseudo-elements are now wide, thin **ellipses**
   laid across the middle — clipped by the circle their curved edges read as
   waves; tilted against each other (+8°/−9°) they braid like the reference.
   A vertical mask feathers them into glow; a repeating-stripe overlay adds the
   fibre texture. New keyframes `ms-chat-logo-wave-a/b` (symmetric, different
   speeds → seamless, non-repeating braid; subtle `hue-rotate` color shift).
   Old keyframes `ms-chat-logo-flow`/`-breathe` are gone.
2. **Liquid-glass launcher (`.ms-chat-launcher`).** White-with-black-frame is
   replaced by: 1px light keyline, translucent dark fill,
   `backdrop-filter: blur(12px) saturate(150%)` (with `-webkit-` prefix;
   degrades to the translucent fill where unsupported), deeper drop shadow.
   The launcher's orb uses a translucent bubble base so the storefront glows
   through the sphere. Halo keyframes now re-state the rim shadows (box-shadow
   animates as one property).
3. **Variants unchanged in spirit:** avatar still static (`animation: none`),
   product CTA still the calm 22s wave; reduced-motion still freezes
   everything. CTA inline CSS additionally re-asserts the rim
   (`box-shadow: var(--msc-logo-rim-shadow) !important`) because the kurzinfo
   block resets box-shadows.
4. **No JS change.**

### Dev-theme test checklist (this session)

1. **Launcher (glass + waves):** dark glass sphere with colorful rim; the
   storefront is faintly visible/frosted through the button; the wave braid
   undulates smoothly and the halo pulses; loop never visibly jumps (≥30s).
2. **Avatar:** same glass-sphere look, completely still.
3. **Product CTA:** rim light visible (not stripped by the kurzinfo reset);
   waves drift very slowly; clean next to the bullets.
4. **Reduced motion:** launcher/halo/CTA/avatar all freeze to the same static
   braid frame; the glass look (rim, specks, frost) is unaffected.
5. **Fallbacks:** browser without `backdrop-filter` → launcher is simply a
   darker translucent button, no errors; without `mask-image` → wave bands
   show with harder vertical edges but still read as the braid.

---

## ⭐ Session update (2026-06-10b) — animated Siri-style logo orb (pure CSS, no image asset)

Mo's logo is replaced everywhere in the widget by a **self-contained, pure-CSS
animated mark**: soft, glowing multi-color light ribbons (sky blue, violet,
pink, teal + a warm amber accent) flowing over a dark rounded bubble —
Siri-orb style. No GIF, no SVG file, no external request: the `.ms-chat-logo`
root span carries the dark bubble; two pseudo-elements carry a rotating
conic-gradient ribbon ring (radial-masked) and counter-rotating drifting
glows, blurred for softness. Seamless infinite loop, crisp at every size.

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.css` | **MODIFIED** (orb component replaces SVG logo) | ✅ Yes |
| `templates/product.json` | **MODIFIED** (CTA logo → orb, slow variant) | ✅ Yes |
| `assets/ms-chat-widget.js` | **UNCHANGED** | ❌ No |
| `assets/ms-chat-logo-v2.svg` | **NO LONGER REFERENCED** by widget or template | 🗑️ Optional: delete from the live theme (kept in this repo for history) |
| `docs/ai-advisor/WIDGET_SPEC.md` | **MODIFIED** (docs only, new §4.1a) | ❌ No (not a theme asset) |
| `MANIFEST.md` | **MODIFIED** (this entry) | ❌ No (not a theme asset) |

### What changed

1. **CSS (`assets/ms-chat-widget.css`).** The `--msc-logo` URL token and the
   `background-image` logo rules are gone. `.ms-chat-logo` is now the animated
   orb component (new keyframes `ms-chat-logo-flow`, `ms-chat-logo-breathe`,
   `ms-chat-logo-halo`). Per-context tunables: `--msc-logo-dur` (base loop
   duration) and `--msc-logo-blur` (glow softness). Placement variants:
   - **Launcher** (`.ms-chat-launcher-logo`): FULL motion, ~9s base loop, plus
     a soft pulsing box-shadow halo — this is where "draw attention" applies.
   - **Assistant avatar** (`.ms-chat-avatar`): **static** — `animation: none`
     on the orb layers leaves a calm, still gradient frame so a moving element
     doesn't sit next to every message.
   - **Reduced motion:** `prefers-reduced-motion: reduce` freezes ALL variants
     (including the launcher and its halo) to the static gradient state.
   The component deliberately uses literal colors (not `--msc-*` tokens), so
   it also works outside `.ms-chat-root` — which the product CTA relies on.
2. **Product CTA (`templates/product.json`, "USPs" custom-liquid block).** The
   CTA's logo span now carries the `ms-chat-logo` class (markup) and its
   inline CSS swaps the `url(ms-chat-logo-v2.svg)` background for orb
   overrides only: same 36px size, `--msc-logo-dur: 22s` (gentle, calm
   variant), `--msc-logo-blur: 4px`. CTA behavior/markup is otherwise
   unchanged. (The orb styles come from `ms-chat-widget.css`, which the
   AI-advisor snippet loads on product pages whenever the CTA renders.)
3. **No JS change.** `logoEl()` already emits `<span class="ms-chat-logo …">`,
   which is exactly the orb's root — do **not** re-upload the JS for this.
4. **Old asset unused.** Nothing references `ms-chat-logo-v2.svg` anymore
   (the CSS and the product template were its only two consumers). You can
   delete it from the live theme; it stays in this repo as history. The
   "rename to bust the CDN cache" workaround (2026-06-07d) is obsolete — a
   CSS-only logo has no CDN-cached artwork to go stale.

### Dev-theme test checklist (this session)

1. **Launcher animates and draws the eye:** dark orb fills the round button;
   multicolor ribbons rotate smoothly with gently breathing glows and a soft
   pulsing halo; the loop never visibly "jumps" (watch ≥30s). Beta badge,
   open/close behavior and hover lift unchanged.
2. **Avatar stays calm:** open the chat, send a message — the 36px avatar next
   to assistant bubbles shows the SAME orb look but completely still (no
   motion while reading/streaming text).
3. **Product CTA looks clean:** on a product page, the 36px orb next to
   "Detaillierte Beratung zu diesem Produkt" drifts very slowly (~22s loop) —
   alive on a second look, not distracting next to the bullets; click still
   opens the chat with the product primer.
4. **Reduced motion freezes it:** enable "reduce motion" in OS settings (or
   DevTools → Rendering → emulate `prefers-reduced-motion`): launcher, halo,
   CTA and avatar all show the identical static gradient frame — zero
   movement anywhere.
5. **Sizes/edges:** orb stays a crisp circle with no square blur-bleed at
   68px (launcher), 36px (avatar, CTA); colors don't band on a dark/light
   storefront background.
6. **Fallback sanity:** in a browser without `mask-image` support the ribbon
   degrades to a soft blurred color disc inside the bubble (still branded,
   no errors).

---

## ⭐ Session update (2026-06-10) — stronger blur, desktop heights, animated share button, Beta badge, "Mo" header

Five UI changes (features 5, 6, 7, 10, 11). **Re-upload both widget assets.**
The spec was updated to match (`docs/ai-advisor/WIDGET_SPEC.md`, not a theme
file — nothing to upload for it).

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.css` | **MODIFIED** | ✅ Yes |
| `assets/ms-chat-widget.js` | **MODIFIED** | ✅ Yes |
| `docs/ai-advisor/WIDGET_SPEC.md` | **MODIFIED** (docs only) | ❌ No (not a theme asset) |

### What changed
1. **Backdrop blur +50% (feature 5).** `.ms-chat-backdrop` blur raised
   `4px → 6px` (both `backdrop-filter` and `-webkit-backdrop-filter`). The
   `rgba(0,0,0,0.4)` dim is unchanged and remains the graceful fallback where
   `backdrop-filter` is unsupported.
2. **Desktop panel heights (feature 6).** Desktop only — mobile inset
   untouched (the ≤640px media query still overrides height):
   - Default panel: width stays 410px; `height: 640px → 66dvh` (~2/3 of the
     viewport height).
   - Enlarged panel: width stays 560px; `height: 780px → calc(100dvh - 40px)`
     (full viewport height minus the existing 20px top/bottom safe margin,
     matching the existing `max-height`).
   The flex layout is unchanged, so the message area scrolls inside the panel
   and the input row stays pinned at the bottom.
3. **Share icon → animated "Per E-Mail teilen" button (feature 7).** The
   header share *icon* is replaced by a small pill *text button*
   (`.ms-chat-share`, real `<button>`, keyboard-focusable, `aria-label`
   "Zusammenfassung per E-Mail teilen"). It is **hidden** in a new
   conversation; as soon as the first user message is sent (and whenever a
   non-empty history is restored on init), `updateShareBtn()` reveals it with
   a subtle ~420ms fade + scale blend-in (suppressed under
   `prefers-reduced-motion`), and it stays for the rest of the conversation.
   It hides again on "new chat" (and if a failed send rolls the only message
   back). Click behaviour is identical to the old icon: `openCaptureForm()`.
4. **Beta badge on the launcher (feature 10).** A small uppercase "Beta" pill
   (`.ms-chat-beta`, accent fill, white keyline) sits on the launcher's top
   edge. It lives inside the launcher button, so it shows/hides with the
   launcher, never intercepts clicks (`pointer-events: none`), and stays
   within the launcher's safe-area offsets on mobile. Screen readers get it
   via the launcher's `aria-label` ("Chat öffnen (Beta)"); the pill itself is
   `aria-hidden`.
5. **"Mo" header wordmark (feature 11).** The panel header now shows the
   chatbot's name **"Mo"** (same `.ms-chat-wordmark` type treatment, bold
   accent) instead of "motionsports". The welcome state keeps the
   motionsports brand wordmark.

### Dev-theme test checklist (this session)

**Desktop, compressed (default) panel**
1. Open the panel: the storefront behind is dimmed AND noticeably blurrier
   than before (6px); clicking the backdrop still closes the panel.
2. The panel is ~2/3 of the viewport height (resize the browser window
   vertically — the panel height follows), width unchanged (410px).
3. Header shows "**Mo**" (bold, accent color) — no "motionsports" wordmark in
   the header (the welcome screen still shows it).
4. Fresh conversation (use "Neuen Chat starten" first): NO share control in
   the header. Send a message: "Per E-Mail teilen" fades/scales in next to
   the enlarge toggle while Mo responds, and stays visible from then on.
   Clicking it opens the email-capture card (same as the old share icon);
   Tab reaches it and Enter activates it.
5. Reload mid-conversation: the button is already visible (restored history).
   "Neuen Chat starten": it disappears again.
6. With long conversations, messages scroll inside the panel and the input
   row stays pinned at the bottom.

**Desktop, enlarged panel**
7. Click the enlarge toggle: the panel grows to the full viewport height
   minus a small (20px) margin top and bottom, width 560px. Toggle back
   restores the 2/3-height default. The choice still persists across reloads.
8. The share button, "Mo" header, blur, scrolling messages and pinned input
   all behave the same as in the compressed view.

**Mobile (≤640px viewport)**
9. The near-full-screen inset is UNCHANGED (small margin on all sides, dimmed
   + blurred sliver of storefront visible around the edges).
10. The "Beta" pill sits on the launcher's top edge without being cut off by
    the viewport edge or overlapping other sticky elements; tapping anywhere
    on the launcher (including the pill) opens the chat; the pill disappears
    with the launcher while the panel is open.
11. Header fits: "Mo" + "Per E-Mail teilen" (after first message) + the
    remaining header buttons don't wrap or overflow on a ~360px-wide phone
    (note the enlarge toggle is desktop-only in behaviour but still rendered;
    verify no overflow).
12. Blur fallback: on a browser without `backdrop-filter` (e.g. older
    Firefox/WebViews), the backdrop is dim-only — no errors, panel still
    works.

---

## ⭐ Session update (2026-06-07e) — white floating launcher with black frame

Restyle the floating launcher button: background **black → white**, plus a
**2px black border** as a thin-but-noticeable frame (the logo artwork still sits
inside, edge-to-edge). CSS-only.

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.css` | **MODIFIED** (`.ms-chat-launcher`) | ✅ Yes |

> Uses theme tokens: `background: rgb(var(--msc-bg))` (white) and
> `border: 2px solid rgb(var(--msc-accent))` (black).

---

## ⭐ Session update (2026-06-07d) — rename logo asset to bust the CDN cache

Re-uploading the logo under the **same filename** didn't update the floating
launcher/avatar: the CSS references the logo with a relative, **unversioned**
URL (`url('ms-chat-logo.svg')`) — a `.css` file can't use Shopify's `asset_url`
filter, so there's no `?v=…` cache-buster, and Shopify's CDN kept serving the
old cached bytes (browser cache clears don't touch the CDN edge). The
product-page CTA used `asset_url` so it *did* update. Fix: **rename the asset**
so the URL is brand-new.

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-logo.svg` → `assets/ms-chat-logo-v2.svg` | **RENAMED** | ✅ Upload new name |
| `assets/ms-chat-widget.css` | **MODIFIED** (`--msc-logo` → new name) | ✅ Yes |
| `templates/product.json` | **MODIFIED** (`asset_url` → new name) | ✅ Yes |

> **Action in Shopify:**
> 1. Upload your **modified** artwork as **`assets/ms-chat-logo-v2.svg`** (new filename).
> 2. Re-upload `assets/ms-chat-widget.css` and `templates/product.json`.
> 3. Delete the old **`assets/ms-chat-logo.svg`** from the theme.
>
> **Note on this repo:** the renamed file in the repo still carries the *previous*
> artwork bytes (this snapshot wasn't given the modified SVG). The live result is
> driven by whatever you upload to Shopify under the new name; optionally drop the
> modified SVG into the repo as `ms-chat-logo-v2.svg` so the snapshot matches.
>
> **Future logo edits:** uploading new bytes under the *same* name won't refresh
> the launcher (same CDN-cache reason). Bump the filename again
> (`-v3`, …) and update the two references, or wait out the CDN TTL.

---

## ⭐ Session update (2026-06-07c) — avatar size revert, shorter composer placeholder, product CTA as inline link

Three small polish fixes. **Re-upload both widget assets and the product
template.**

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.css` | **MODIFIED** | ✅ Yes |
| `assets/ms-chat-widget.js` | **MODIFIED** | ✅ Yes |
| `templates/product.json` | **MODIFIED** | ✅ Yes (default product template) |

### What changed
1. **In-chat avatar reverted to 36px.** The previous session doubled it to 72px;
   reverted `.ms-chat-avatar` back to `36px` per feedback. The launcher zoom
   (`background-size: 150%`) and the product CTA logo (36px) are **kept** as-is.
2. **Shorter composer placeholder.** Adding the mic button narrowed the textarea,
   so the old long placeholder ("Frag mich etwas über unser Sortiment…") wrapped
   to two lines and scrolled. Shortened to **"Frag mich etwas …"** so it fits on
   one line alongside the mic + send buttons (incl. mobile widths).
3. **Product-page CTA → inline link below the bullets.** Previously rendered as a
   separate `<ul><li>` "bullet", where the 36px Mo logo pushed the text right of
   the disc, creating a visible offset/misalignment. Now rendered as a plain
   `<button>` (no list/disc) directly under the highlight bullets: an inline-flex
   link (Mo logo + underlined "Detaillierte Beratung zu diesem Produkt"),
   `margin-top:10px`, left-aligned to the kurzinfo block. The `.ms-chat-product-
   cta-list` / `-item` CSS rules were removed; `.ms-chat-product-cta` now sets its
   own `font-size:0.8rem`/`line-height:1.35` to match the bullet typography.
   **Behaviour unchanged** — same `data-ms-chat-product-*` attributes + delegated
   handler open the chat primed about the product.

### Dev-theme test checklist (this session)
1. **Avatar** — the Mo avatar beside assistant messages is back to the smaller
   (36px) size.
2. **Placeholder** — open the panel: the placeholder sits on a single line with
   no scrollbar, next to the mic and send buttons; check on a narrow phone too.
3. **Product CTA** — on a product page, "Detaillierte Beratung zu diesem Produkt"
   appears as a left-aligned link just below the highlight bullets (no stray disc,
   no rightward offset); clicking it still opens the chat about that product.

---

## ⭐ Session update (2026-06-07b) — larger logo everywhere it's used

Increases the rendered size of the Mo logo (`ms-chat-logo.svg`) by 100% in
every place it appears. **Re-upload both widget assets and the product
template.**

| Path | Status | Re-upload to Shopify? |
| --- | --- | --- |
| `assets/ms-chat-widget.css` | **MODIFIED** | ✅ Yes |
| `templates/product.json` | **MODIFIED** | ✅ Yes (default product template) |

> The launcher button keeps its 68px size by request — instead of enlarging the
> button, the logo artwork is zoomed to crop its built-in whitespace so the face
> reads bigger inside the same button.

### What changed
- **In-chat assistant avatar** (`.ms-chat-avatar`): `36px → 72px` (doubled).
- **Launcher logo** (`.ms-chat-launcher-logo`): button stays **68px**; added
  `background-size: 150%` so the artwork is zoomed past `cover`, trimming the
  whitespace baked into the SVG so the face fills more of the button.
- **Product-page CTA bullet logo** (`.ms-chat-product-cta__logo`, inline in
  `templates/product.json`): `18px → 36px` (doubled).

### Dev-theme test checklist (this session)
1. **Launcher** — the floating button is still 68px, but the face now fills more
   of it (less empty margin) and isn't cropped awkwardly.
2. **Assistant avatar** — the Mo avatar beside each assistant message is visibly
   larger (≈2×) and still circular/crisp.
3. **Product CTA** — on a product page, the Mo logo in the "Detaillierte Beratung
   zu diesem Produkt" bullet is ≈2× larger.

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

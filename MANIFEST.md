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

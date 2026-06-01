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

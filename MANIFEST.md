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
| `assets/ms-chat-widget.js` | The widget itself: launcher + panel, SSE streaming of `/api/chat` (fetch + reader), session id + conversation persistence, the five tool cards, silent-tool consumption, XSS-safe markdown, product hydration via `/api/products`, inline contact form, and all error handling. Vanilla JS, no dependencies. |
| `MANIFEST.md` | This file. |

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

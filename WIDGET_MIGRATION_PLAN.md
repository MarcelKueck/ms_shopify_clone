# Chat-Widget Migration Plan — TEST → CLONE

**Goal:** migrate the AI-advisor chat-widget changes from the **TEST** theme
(`185014223177`) into the **CLONE** theme (`185918095689`, goes live) **without
clobbering** the software team's un-versioned changes that already live in the
clone.

| Theme | ID | Role |
|-------|----|------|
| TEST  | `185014223177` | your widget work (source) |
| CLONE | `185918095689` | current live + team's un-versioned changes (target, goes live) |

---

## ⚠️ Why I could not pull/diff the two live themes from this environment

Both `shopify theme pull` calls require talking to Shopify, and **two hard
blockers** stop that from happening inside this sandbox:

1. **Network policy blocks Shopify.** A connectivity test returned
   `CONNECT tunnel failed, response 403` for both `admin.shopify.com` and
   `accounts.shopify.com`. That is an organization egress-policy denial — not
   retryable from here.
2. **No Shopify credentials are present** (no `SHOPIFY_CLI_THEME_TOKEN`, no
   stored CLI session), and the OAuth login is browser-interactive, which a
   headless container can't complete.

So the live two-theme diff has to be run **on your own machine**. The exact
commands are in **Step 0** below.

### Good news — this is actually solvable without that diff
This repository **is** the chat-widget development repo. Every widget commit is
here (PRs #26–#59), so it is the **authoritative record of "what I changed."**
I reconstructed the full widget footprint from the code itself, which is *more
reliable* than diffing two opaque theme snapshots. The merges below are all
**additive and surgical**, so applying only my additions to the clone's current
files **cannot clobber** the team's work in those files.

---

## The complete widget footprint — exactly 6 files

I did an exhaustive sweep of every `.liquid`/`.json`/`.js`/`.css` file for every
widget marker (`ms-chat-`, `data-ms-chat`, `MS_CHAT_CONFIG`, `ai_advisor`,
`window.MS_CHAT`). The widget touches **only these 6 files** — nothing else:

### 🟢 MINE-ONLY — copy as-is (3 files)
Uniquely namespaced `ms-chat-widget.*`; no live-theme change would ever touch
them. 100% yours.
- `assets/ms-chat-widget.css`
- `assets/ms-chat-widget.js`
- `snippets/ms-chat-widget.liquid`

### 🟠 SHARED — surgical merge, do NOT overwrite (3 files)
Files I edited that the team may also have changed. Apply **only** the additions
shown below.
- `config/settings_schema.json` — added the "AI Advisor" settings panel
- `layout/theme.liquid` — added one `{% render %}` line before `</body>`
- `templates/product.json` — wove a product-page CTA into an existing
  custom-Liquid block

### ⚪ LEAVE ALONE (verified NOT part of the widget)
- `locales/*.json` — **the widget has zero locale keys.** Its i18n (German
  default + `/en`) is entirely inside `ms-chat-widget.js`. Do not touch locales.
- `config/settings_data.json` — holds no widget values in this repo; widget
  config is set in the customizer (see Step 3). Never overwrite this file.
- `sections/cart-modal.liquid`, `snippets/cart-side-inner.liquid`,
  `snippets/cart-marketing-objection-notice.liquid` — these were touched by the
  GDPR commits #49/#50, but **net out to zero** (added in #49, fully reverted in
  #50; the objection-notice file no longer exists) and **reference nothing in
  the widget.** Not part of this migration. Leave alone.
- Everything else in the clone that differs is the team's work → leave alone.

---

## Step 0 — (Optional) get the real two-theme diff on YOUR machine

You don't need this for the widget migration (the plan below is complete), but
if you want literal line-level confirmation against the clone, run these on your
own machine where you're logged into Shopify. Add `--store` if the CLI prompts:

```bash
shopify theme pull --store=YOURSTORE.myshopify.com --theme=185014223177 --path=./test-theme
shopify theme pull --store=YOURSTORE.myshopify.com --theme=185918095689 --path=./clone-theme
diff -ruq ./test-theme ./clone-theme        # which files differ
```

> If you push both pulled folders to this branch, I can run the real recursive
> diff here and confirm exact insertion points against the clone's current files.

---

## Step 1 — Copy the 3 MINE-ONLY files into the clone

Copy these from TEST → CLONE, overwriting whatever's there (any clone copy is an
older version of your own widget):
- `assets/ms-chat-widget.css`
- `assets/ms-chat-widget.js`
- `snippets/ms-chat-widget.liquid`

Push **only these three files** to the clone (never a full-theme push). With the
CLI on your machine:
```bash
shopify theme push --store=YOURSTORE.myshopify.com --theme=185918095689 \
  --only assets/ms-chat-widget.css \
  --only assets/ms-chat-widget.js \
  --only snippets/ms-chat-widget.liquid
```

---

## Step 2 — Surgically merge the 3 SHARED files

### 2a. `config/settings_schema.json` — add the "AI Advisor" panel

This panel is the **last object in the top-level array**. In the clone's
`settings_schema.json`, append it as a new last element (add a comma after the
current last object, then paste this **before the closing `]`**):

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
        "default": "https://mo.motionsports.de"
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

**Do NOT** replace the whole file. If the clone already has an "AI Advisor"
panel, update its fields instead of adding a duplicate.

### 2b. `layout/theme.liquid` — add the widget include before `</body>`

Add this single line **immediately before the closing `</body>` tag** (in TEST
it's line 258, right after the last inline `</script>`):

```liquid
    {% render 'ms-chat-widget' %}
```

Target context in the clone:
```liquid
</script>
    {% render 'ms-chat-widget' %}   ←  ADD THIS LINE
  </body>
```
If the clone's `theme.liquid` already renders `ms-chat-widget`, do nothing.
Otherwise add just this one line — don't overwrite the file.

### 2c. `templates/product.json` — add the product-page CTA (trickiest)

The product CTA lives **inside an existing custom-Liquid block** in the `main`
section (block id `custom_liquid_BGU8Mt`, the "Kurzinfo" block). It is a mix of
base-theme kurzinfo code and my widget additions, so **edit it surgically.**

**Safest route — do this in the Theme Customizer UI** (not by hand-editing
JSON): open a product page in the clone's customizer → find the **Custom Liquid
block** in the product info area (it contains `product-kurzinfo`) → make these
three additions to its content:

**(i) Prepend the CTA capture (gated by your setting):**
```liquid
{%- comment -%} AI Advisor (Mo) product CTA — a clickable link rendered below the product highlight list {%- endcomment -%}
{%- if settings.ai_advisor_enabled -%}
  {%- capture ms_chat_cta_bullet -%}
    <button type="button" class="ms-chat-product-cta" data-ms-chat-product-id="{{ product.id }}" data-ms-chat-product-title="{{ product.title | escape }}"><span class="ms-chat-logo ms-chat-product-cta__logo" aria-hidden="true"></span><span class="ms-chat-product-cta__label">Detaillierte Beratung zu diesem Produkt</span></button>
  {%- endcapture -%}
{%- endif -%}
```

**(ii) Inject the CTA where kurzinfo renders.** Change the kurzinfo block from
the base-theme form to this (the bold-equivalent lines are the additions):
```liquid
{% if product.metafields.custom.kurzinfo != blank %}
  <div class="product-kurzinfo">
    {{ product.metafields.custom.kurzinfo | metafield_tag }}
    {%- if ms_chat_cta_bullet != blank -%}{{ ms_chat_cta_bullet }}{%- endif -%}   ← ADD
  </div>
{%- elsif ms_chat_cta_bullet != blank -%}                                          ← ADD branch
  <div class="product-kurzinfo">                                                   ← ADD
    {{ ms_chat_cta_bullet }}                                                       ← ADD
  </div>                                                                            ← ADD
{% endif %}
```

**(iii) Add the CTA styling** (keep the existing `/* === Kurzinfo Block === */`
styles untouched; just add this `<style>` block):
```html
<style>
  .ms-chat-product-cta{display:inline-flex;align-items:center;gap:8px;margin:10px 0 0 0;padding:0;background:none;border:none;font-family:inherit;font-size:0.8rem;line-height:1.35;color:#000;text-align:left;cursor:pointer;-webkit-appearance:none;appearance:none;text-decoration:underline;text-underline-offset:2px;text-decoration-color:rgb(var(--color-base-foreground,0 0 0) / 35%);}
  .ms-chat-product-cta:hover{color:rgb(var(--button-secondary-background, 0 140 203));text-decoration-color:currentColor;}
  .ms-chat-product-cta .ms-chat-product-cta__logo{width:36px;height:36px;flex:0 0 auto;--msc-logo-rim:1.5px;box-shadow:var(--msc-logo-rim-shadow) !important;}
  .ms-chat-product-cta__label{overflow-wrap:anywhere;}
</style>
```

> ⚠️ **Check first:** if the team changed the clone's product template, this
> custom-Liquid block may have a different id or content. Add only the widget
> lines above into whichever block renders `product-kurzinfo`; don't paste the
> TEST block over theirs wholesale. If the clone has no kurzinfo block at all,
> this CTA is optional — the main widget still works without it.

---

## Step 3 — Customizer settings to set on the CLONE (you must do these)

These live in the theme customizer (not in the code diff). After Step 2a the
panel appears under **Theme settings → AI Advisor**. Set each:

| Setting (id) | UI label | Set to on CLONE | Notes |
|---|---|---|---|
| `ai_advisor_enabled` | Enable AI advisor chat widget | **ON (checked)** | Default is `false`. Must be ON or nothing renders. |
| `ai_advisor_backend_url` | Backend URL | `https://mo.motionsports.de` | Matches the default; confirm it's exactly this. |
| `ms_chat_shared_secret` | Shared secret (x-ms-chat-key) | **paste the secret** | **Must match the Vercel backend `CHAT_SHARED_SECRET` exactly.** Not stored in this repo — copy it from your TEST theme's customizer or the Vercel env. Sent as the `x-ms-chat-key` header. |
| `ai_advisor_excluded_templates` | Hide widget on these templates | `cart` (default) | `/cart` and `/checkout` are always excluded regardless. Match whatever your TEST theme has. |

**Backend URL hardcoded default — confirmed `mo.motionsports.de`:**
- `assets/ms-chat-widget.js` line 21:
  `var API_BASE = String(CFG.apiBase || 'https://mo.motionsports.de')...`
- `snippets/ms-chat-widget.liquid` line 48: `apiBase` default also
  `'https://mo.motionsports.de'`.
- The JS references only two hosts: `mo.motionsports.de` (backend) and
  `motionsports.de` (showroom link). **No localhost / vercel / staging URLs.**

So even if the `ai_advisor_backend_url` customizer field were left blank, the
widget falls back to `https://mo.motionsports.de`. Set it anyway for clarity.

---

## Step 4 — Verify in Preview BEFORE publishing

Preview the clone (don't publish yet) and check:
- [ ] **Launcher orb appears** bottom-corner on a normal page (home/product).
- [ ] **Widget opens** and a test message gets a real reply → confirms the
      backend URL **and** the shared secret are correct (a wrong/blank secret
      = failed/401 calls in the Network tab).
- [ ] **Product CTA** "Detaillierte Beratung zu diesem Produkt" shows under the
      kurzinfo on a product page and opens the widget (only if you did Step 2c).
- [ ] **Hidden on `/cart` and `/checkout`** (and any template in the exclude
      list).
- [ ] **DevTools → Network:** `ms-chat-widget.css` and `ms-chat-widget.js` load
      (200), and chat calls go to `https://mo.motionsports.de` with an
      `x-ms-chat-key` header.
- [ ] **Team's recent work still intact** — spot-check whatever they changed
      (product page, cart, settings) looks normal; confirms no clobber.
- [ ] German default renders; `/en` switches the widget to English.

Only after all green → **publish the clone.**

---

## One-glance ordered checklist

1. **Copy as-is (yours, safe):** `assets/ms-chat-widget.css`,
   `assets/ms-chat-widget.js`, `snippets/ms-chat-widget.liquid` → push with
   `--only` (never full-theme push).
2. **Merge by hand (additions only, don't overwrite):**
   - `config/settings_schema.json` → append the "AI Advisor" panel object (§2a).
   - `layout/theme.liquid` → add `{% render 'ms-chat-widget' %}` before
     `</body>` (§2b).
   - `templates/product.json` → add the 3 CTA pieces to the kurzinfo custom-Liquid
     block, ideally via the customizer UI (§2c).
3. **Customizer settings (you):** enable widget; backend
   `https://mo.motionsports.de`; paste `ms_chat_shared_secret` (== Vercel
   `CHAT_SHARED_SECRET`); excluded templates = `cart`.
4. **Leave alone:** `locales/*`, `config/settings_data.json`, the cart files,
   and every other file the team changed.
5. **Preview smoke test** (§4) → then publish.

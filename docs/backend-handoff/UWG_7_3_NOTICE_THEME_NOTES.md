# § 7 Abs. 3 UWG "at the time of collection" notice — placement + operator handoff

> GDPR remediation, storefront side. German law (§ 7 Abs. 3 Nr. 4 UWG) requires
> that **at the moment** the customer's email / postal address is collected in
> connection with a purchase, they are told — **clearly and free of charge** —
> that motion sports may **later** contact them about its **own, similar
> products**, and that they may **object at any time**. The in-email notice
> already exists on the backend; this is the mandatory **second limb, at
> collection**.

## ⚠ Launch gate (read first)

- This is a **launch gate**: the backend keeps § 7(3) marketing sends
  **DISABLED** until the notice is **live on the collection surfaces**. Flip the
  backend flag **only after** (a) the wording is **lawyer-confirmed** and (b) the
  notice is live at checkout + on the order-confirmation email.
- The wording below is the **suggested** copy — **the lawyer MUST confirm the
  exact wording before launch.** Do not treat it as final. It is phrased as a
  future possibility (*"ggf. auch"*) and must **not** present existing-customer
  marketing as already active.

## Suggested German copy (single source — keep all surfaces identical)

> Wir verwenden deine E-Mail-Adresse ggf. auch, um dich über eigene, ähnliche
> Produkte von motion sports zu informieren (§ 7 Abs. 3 UWG). Du kannst dieser
> Nutzung jederzeit kostenlos widersprechen — eine formlose Nachricht an
> widerspruch@motionsports.de genügt.

When the lawyer adjusts the wording, update it in **all three** places below so
they stay identical.

## Surface 1 — Cart (DONE in this repo)

- **File:** `snippets/cart-marketing-objection-notice.liquid` (the copy lives
  here, one place).
- **Rendered by:** `snippets/cart-side-inner.liquid` (cart **page**) and
  `sections/cart-modal.liquid` (cart **drawer**) — directly under the checkout
  button, at the foot of the order summary. Visible, not collapsed, not in the
  T&Cs.
- This is the **in-repo reinforcement** at the point of purchase. It is **not** a
  substitute for Surfaces 2 + 3, which are the legally-mandatory ones and are
  **not editable from this theme repo**.
- If you serve non-German language markets and want to hide/translate it there,
  wrap the markup in `{%- if localization.language.iso_code == 'de' -%} … {%- endif -%}`
  (note in the snippet).

## Surface 2 — Checkout, near the contact / email step (MANUAL, Shopify Admin)

The checkout is **not** in this theme repo (no `checkout.liquid`, no Checkout UI
extension here), so this must be added in Admin.

- **Where:** **Shopify Admin → Settings → Checkout → Customize** (the checkout
  editor). Add the copy as static text **at the contact / email step**, directly
  by the email field — visible, not behind a collapsible section, not folded into
  the general terms.
  - On **Shopify Plus**, a **Checkout UI extension** placed at the contact step
    is the cleanest home (target the email/contact area). That extension lives in
    a separate Shopify **app** project, not this theme repo.
  - Without Plus, use the checkout editor's available content/notice block at the
    contact step. If no block can sit next to the email field, the
    order-confirmation email (Surface 3) is the guaranteed fallback surface — but
    the at-collection checkout placement is the one the statute is about, so add
    it there if at all possible.
- **Paste:** the confirmed copy above.

## Surface 3 — Order-confirmation notification email (MANUAL, Shopify Admin)

Notification templates are **not** part of the theme; they live in Admin.

- **Where:** **Shopify Admin → Settings → Notifications → Order confirmation →
  Edit code.** This is editable Liquid/HTML on all plans.
- **Placement:** add the copy as a clearly visible block near the customer/contact
  details (e.g. just under the greeting or the order-summary header) — not buried
  in the footer fine print.
- **Paste:** the confirmed copy above (wrap in your standard `<p>` styling). A
  `mailto:widerspruch@motionsports.de` link is a nice-to-have but the address as
  plain text is sufficient.

## Out of scope here (backend repo)

The § 7(3) **email content/sending** and the **enable flag** are backend. Once
Surfaces 2 + 3 are live and lawyer-confirmed, the operator flips the backend flag
to start § 7(3) sends.

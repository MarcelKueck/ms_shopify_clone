# Clone-merge artifact

`product.json` here is the **CLONE theme's** `templates/product.json` with the
AI-advisor chat-widget product CTA merged in. It is a **deliverable to upload to
the live CLONE theme** — it is *not* the repo's own template (see
`../../templates/product.json` for that, which is the TEST theme's version).

## What changed vs the clone's current file
Only the `custom_liquid_BGU8Mt` block (named "USPs") was modified — the AI
Advisor product CTA was woven into its kurzinfo custom-Liquid. All other blocks
are byte-identical to the clone's current product template. The CTA is gated by
`settings.ai_advisor_enabled`, so it renders nothing until the widget is enabled.

## Dependencies
This file only does something once the rest of the widget migration is applied
(see `../../WIDGET_MIGRATION_PLAN.md`): the `ms-chat-widget.{css,js,liquid}`
assets, the `{% render 'ms-chat-widget' %}` include in `layout/theme.liquid`, the
"AI Advisor" settings panel, and `ai_advisor_enabled` set ON in the customizer.

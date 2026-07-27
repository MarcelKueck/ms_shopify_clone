# Marketing consent gate (Accept/Decline dialog) — theme → backend handoff

> Written by the Shopify theme while shipping the **consent gate**: an
> Accept/Decline dialog presented once per browser session right after the
> user's first chat message (the reply streams in behind it — it is **never**
> conditional on the choice). Goal: replace the buried end-of-chat checkbox as
> the **primary** marketing opt-in surface. Frontend:
> `assets/ms-chat-widget.js` + `assets/ms-chat-widget.css`.

## What shipped in the theme (works against the EXISTING contract)

- **Starter prompt chips removed** from the welcome state (unused; they pushed
  the sign-in surface below the fold on mobile). `starter_shown` /
  `starter_clicked` KPIs will stop arriving.
- **Sign-in card promoted**: sits directly under the welcome orb, accent-tinted,
  sharper benefit copy (incl. "Persönliche Angebote & Aktionen zuerst sehen"),
  plus a "no account? just start typing" reassurance line.
- **Signed-in consent gate** (`surface=signin`): for `signedIn:true` +
  `marketing.optInActionable:true`, the gate renders the **served v3 signin
  copy verbatim** (headline, marketingLabel, consentFooter, imprint/privacy,
  `lawyerApproved===true` gate) and POSTs the existing
  `/api/account/marketing-opt-in` with
  `{ marketingConsent: true, consentTextShown: <echoed verbatim>, locale }`.
  Existing 401/422/429/503 handling mirrors the opt-in card.
- **Consent mechanic on the widget's marketing surfaces is now button-consent**
  (like a cookie dialog): the served `marketingLabel` + `consentFooter` are
  fully visible, and the explicit tap on "Ja, Angebote aktivieren" directly
  beneath that text is the clear affirmative act. Nothing is pre-decided,
  nothing auto-submits, `marketingConsent:true` is sent only on that tap. The
  at-sign-in opt-in card was converted to the same mechanic (checkbox removed).
  The **email-capture form is unchanged** (still two unchecked checkboxes —
  its `consentTextShown` covers both consents, so its mechanics must not
  drift from the audit string).
- **Anti-nag rules** (deliberate — GDPR "freely given", no dark patterns):
  gate at most **once per browser session**; **accept** is remembered forever
  (device `localStorage` + your DOI record); **decline** snoozes it for 24h
  (a later session may ask again); backdrop/Esc = "later" (no snooze). The
  local memory is UX-only — the backend DOI record stays the legal record.
- **New widget KPIs** via `POST /api/kpi`: `consent_gate_shown`,
  `consent_gate_accepted`, `consent_gate_declined`, `consent_gate_dismissed`
  (payload: `{ surface: "signin" | "chat" }`).

## ⛔ What the backend must ship for the ANONYMOUS gate (fail-closed until then)

The anonymous variant renders **nothing** today: it fetches
`GET /api/consent-copy?surface=chat&locale=<locale>` and only renders when that
returns a valid payload with `lawyerApproved: true`. Two additions needed:

### 1. `GET /api/consent-copy?surface=chat` — consent copy for the in-chat gate

Same guards/caching as the other consent-copy surfaces. Shape mirrors
`surface=signin`, but the wording must fit a typed email + marketing-only
signup:

```jsonc
{
  "version": "v4",
  "headline": "…",            // benefit framing, NOT part of consentTextShown —
                              // this is the place to sell personalized offers /
                              // exclusive promotions (lawyer-approved ceiling)
  "marketingLabel": "…",      // the consent statement shown above the accept button
  "consentFooter": "…",
  "consentTextShown": "…",    // pre-composed audit string (label + footer)
  "imprintUrl": "…",
  "privacyUrl": "…",
  "lawyerApproved": true       // gate does not launch until true
}
```

### 2. `POST /api/chat-marketing-opt-in` — marketing-only opt-in with typed email

`/api/capture-email` can't serve this: it hard-requires the transactional tick
(`400 transactional_consent_required`) and its `consentTextShown` covers both
consents. New endpoint, same guards as capture (origin allowlist +
`x-ms-chat-key` + session), same DOI pipeline:

```
POST /api/chat-marketing-opt-in
Headers: x-ms-chat-key, x-ms-session, x-ms-locale, Content-Type: application/json
Body: {
  "sessionId": "<sid>",
  "email": "<typed email>",
  "marketingConsent": true,          // only ever sent on the explicit Accept tap
  "consentTextShown": "<served surface=chat audit string, echoed verbatim>",
  "locale": "de" | "en",
  "trigger": "chat_gate"             // funnel split vs the capture form
}
Responses: 200 { ok, marketing: { status: "pending"|"confirmed", doiEmailSent, alreadyConfirmed } }
Errors: 400 invalid_email | marketing_consent_required, 429 rate_limited (+Retry-After),
        503 upstream_unavailable — same codes/behaviour as capture-email.
```

The widget treats a success like a capture for **returning-customer memory**
(attaches `customer.email` to subsequent `/api/chat` turns in this page
session) — please record the capture against the session the same way
`/api/capture-email` does so the memory verification passes.

## ❓ For confirmation (non-blocking)

1. **Button-consent vs the documented checkbox.** CONSENT_FLOW.md words the
   surfaces around an "unchecked checkbox". The widget now renders the served
   text with an explicit Accept button as the affirmative act (statement fully
   visible, decline equally reachable, nothing pre-selected). We believe this
   satisfies the same Planet49 clear-affirmative-act bar — please confirm with
   legal and update the canonical CONSENT_FLOW.md (consent copy v4).
2. **Copy ceiling.** The shop wants "personalized offers with reduced prices"
   prominent. The current documented ceiling is accurate scarcity only
   ("exklusive Angebote … nur für Abonnenten"). Please have legal sign off on
   how far the served `headline` framing may go (e.g. "Persönliche Angebote &
   exklusive Rabattaktionen") — the widget renders whatever is served.
3. **Decline signal.** The widget only stores declines locally (24h snooze).
   If you want declines recorded server-side (e.g. to suppress the surface
   cross-device via `optInActionable`), define an endpoint and we'll call it.

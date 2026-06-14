# At-sign-in marketing opt-in (CA-4) — theme → backend handoff

> Written by the Shopify theme snapshot while rendering the **sign-in-moment
> marketing opt-in** in the chat widget (`assets/ms-chat-widget.js` +
> `assets/ms-chat-widget.css`). Everything the widget *calls* is already in
> `docs/ai-advisor/{CONSENT_FLOW,CUSTOMER_ACCOUNT}.md` (v3 shape). This records
> the choices the contract left open and the **observations the backend may want
> to confirm**. Nothing here touches the email-only capture form or any other
> tier — those are byte-identical.

## What the widget implemented (all from the existing v3 contract)

- **Copy is served-only, rendered verbatim.** `GET /api/consent-copy?surface=signin`
  (guard: `x-ms-session`, no shared secret — public strings). Its own 60s cache,
  separate from the capture-form copy. The widget hard-codes **no** consent
  string: `headline` (framing, NOT part of `consentTextShown`), `marketingLabel`,
  `consentFooter`, imprint/privacy links, and the echoed `consentTextShown` all
  come from this payload.
- **`lawyerApproved` gate.** The surface renders **only** when `lawyerApproved`
  is exactly `true`; `false`/absent → the card silently removes itself (the
  surface is not launched to real users).
- **One marketing checkbox, always UNCHECKED.** No code path sets `.checked`;
  never pre-ticked, never auto-toggled. Prominent (accent-edged) styling sells
  the opt-in, never a pre-tick (Planet49 / UWG).
- **Submit = the existing DOI path, minus email.** `POST /api/account/marketing-opt-in`
  (guards: `x-ms-chat-key` + `x-ms-session`, same as `/api/auth/me`) with
  `{ marketingConsent: true, consentTextShown: <echoed verbatim> }`. The email is
  never sent — it comes from the verified account. Responses handled:
  `pending`/`confirmed` (+ `alreadyConfirmed`) → success copy; `401` → fail-closed
  to anonymous; `400 marketing_consent_required` → gentle "tick to confirm" hint;
  `422 no_verified_email` → fall back to the typed-email capture form;
  `429`/`503` → retryable error.
- **Unticked submit records nothing and blocks nothing.** It only flags the box
  (accent outline + shake + one inline hint). `marketingConsent: true` is sent
  **only** on a real tick — never auto-submitted.
- **Where it appears.** Gated on `/api/auth/me` reporting `signedIn: true`: in the
  welcome state's auth slot (empty chat) and inline at the `?ms_auth=ok` sign-in
  moment when a conversation is already on screen. Submitting or dismissing
  ("Nicht jetzt") suppresses it for the rest of the browser session
  (`sessionStorage`, not persisted).

## ❓ For confirmation (non-blocking)

1. **No "already opted in" signal at render time.** `/api/auth/me` exposes only
   `signedIn`/`identity` (`CUSTOMER_ACCOUNT.md §4`), so the widget can't know up
   front whether this customer is already DOI-confirmed. It therefore presents
   the opt-in once per session (until acted on) and relies on `alreadyConfirmed`
   in the **POST response** to word the confirmation correctly. If you'd prefer
   the surface be suppressed for already-confirmed customers, expose a flag on
   `/api/auth/me` (e.g. `marketing.optedIn`) and we'll gate on it — a small
   additive widget change.
2. **No widget-side funnel event for this surface.** Mirroring the capture form,
   the widget fires no client KPI on submit — we assume `/api/account/marketing-opt-in`
   records the opt-in funnel server-side. If you want a distinct
   at-sign-in-vs-capture funnel split surfaced from the client, tell us the event
   name/shape and we'll emit it.
3. **No `trigger`/telemetry field is sent** on the opt-in POST (the documented
   body is only `marketingConsent` + `consentTextShown`). If you want a `source`
   marker (e.g. `"signin"`) for analytics, name the field and we'll add it.

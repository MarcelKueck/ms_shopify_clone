/*
 * AI Advisor chat widget — motionsports.de
 * Vanilla JS, no dependencies, no build step.
 *
 * Implements docs/ai-advisor/{API_CONTRACT,BEHAVIOR_REFERENCE,WIDGET_SPEC}.md:
 *   - SSE streaming of /api/chat via fetch + reader (NOT EventSource)
 *   - stable session id + conversation persistence in localStorage
 *   - the five visible tool cards (with render-nothing guards), silent tools
 *     consumed without rendering
 *   - XSS-safe markdown subset (DOM nodes, never innerHTML on model text)
 *   - product hydration via GET /api/products with an in-session cache
 *   - all error envelopes (429 / 401 / 403 / payload_too_large / 5xx / network)
 *
 * All DOM is built under one `.ms-chat-root` container appended to <body>;
 * every CSS class is prefixed `.ms-chat*` for isolation.
 */
(function () {
  'use strict';

  var CFG = window.MS_CHAT_CONFIG || {};
  var API_BASE = String(CFG.apiBase || 'https://motionsports-chatbot.vercel.app').replace(/\/+$/, '');
  var CHAT_KEY = CFG.chatKey || '';
  var SHOWROOM_URL = CFG.showroomUrl || 'https://motionsports.de/pages/showroom-munchen-grobenzell';

  // ---------------------------------------------------------------------------
  // Email-capture form — widget-owned UI CHROME strings only.
  //
  // The LEGAL consent copy (checkbox labels, the shared consent footer, the
  // returning-customer hint, imprint/privacy link targets, and the
  // pre-composed `consentTextShown` audit string) is deliberately NOT
  // hard-coded here. It is served by the backend — attached to every
  // offer_email_summary tool result and available via GET /api/consent-copy —
  // and rendered verbatim, so the stored Art. 7 audit text can never diverge
  // from what was displayed, and a lawyer copy change ships as a backend
  // deploy with no widget release. See docs/{API_CONTRACT,CONSENT_FLOW}.md
  // (§2 + §7.4).
  //
  // LEGAL INVARIANTS (do not "optimise" away):
  //   * The two consents are SEPARATE — one transactional, one marketing.
  //   * BOTH checkboxes start UNCHECKED (consent copy v2 — the earlier
  //     allowance to pre-check the transactional box is revoked).
  //   * The marketing checkbox is NEVER pre-ticked, never auto-toggled by any
  //     other interaction, and never bundled into the same control/action as
  //     the transactional one.
  //   * `consentTextShown` is the backend's pre-composed string echoed back
  //     byte-for-byte — never recomposed or hard-coded by the widget.
  // ---------------------------------------------------------------------------
  var CONSENT_COPY = {
    title: 'Zusammenfassung per E-Mail',
    // Default intro for the header share-icon entry point. When the assistant
    // emits offer_email_summary it supplies its own intro (the tool `message`).
    intro: 'Ich schicke dir gerne die Zusammenfassung deiner Beratung samt Warenkorb per E-Mail.',
    emailLabel: 'E-Mail',
    emailPlaceholder: 'deine@email.de',
    submit: 'Zusammenfassung senden',
    sending: 'Wird gesendet…',
    loading: 'Einwilligungstexte werden geladen…',
    privacy: 'Wir verwenden deine E-Mail nur wie oben angegeben. Für Angebote ist eine Bestätigung über den Doppel-Opt-in-Link in der E-Mail nötig.',
    errEmail: 'Bitte gib eine gültige E-Mail-Adresse an.',
    errTransactional: 'Bitte wähle mindestens die Zusammenfassung aus.',
    errCopyLoad: 'Die Einwilligungstexte konnten nicht geladen werden.',
    retry: 'Erneut versuchen',
    errRate: 'Zu viele Anfragen — bitte kurz warten.',
    errUpstream: 'Senden gerade nicht möglich — bitte später erneut versuchen.',
    errGeneric: 'Senden fehlgeschlagen. Bitte versuch es erneut.',
    successTitle: 'Erledigt!',
    success: 'Wir haben dir die Zusammenfassung geschickt.',
    // Appended only when the response says marketing.status === "pending"
    // (API_CONTRACT.md §7.1 — the DOI mail went out and needs confirming).
    successPending: 'Bitte bestätige noch die Anmeldung über den Link in der E-Mail.',
    decline: 'Nein danke, vielleicht später',
    declined: 'Alles klar! Du findest die Option jederzeit oben unter „Per E-Mail teilen“.'
  };

  // Fail gracefully: no secret -> log a warning, do not render the launcher.
  if (!CHAT_KEY) {
    try { console.warn('[ms-chat] ms_chat_shared_secret is empty; AI advisor widget not mounted. Paste the secret in Theme settings > AI Advisor.'); } catch (e) {}
    return;
  }
  if (window.__msChatMounted) return;
  window.__msChatMounted = true;

  // ---------------------------------------------------------------------------
  // Storage (session id + history) with silent in-memory fallback.
  // ---------------------------------------------------------------------------
  var memStore = {};
  var hasLS = (function () {
    try {
      var k = '__ms_chat_probe__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();
  function lsGet(k) { try { return hasLS ? window.localStorage.getItem(k) : (k in memStore ? memStore[k] : null); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (hasLS) window.localStorage.setItem(k, v); else memStore[k] = v; } catch (e) { memStore[k] = v; } }
  function lsDel(k) { try { if (hasLS) window.localStorage.removeItem(k); else delete memStore[k]; } catch (e) { delete memStore[k]; } }

  // Session-scoped flags (engagement layer "once per session" caps: nudge,
  // launcher attention, chat-opened). sessionStorage so they reset when the
  // tab session ends; silent in-memory fallback degrades to "once per page
  // load" — still capped, never throws.
  var memSession = {};
  function ssGet(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return k in memSession ? memSession[k] : null; } }
  function ssSet(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { memSession[k] = v; } }

  function uuid() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  var SID_KEY = 'ms-chat-sid';
  function getSid() {
    var sid = lsGet(SID_KEY);
    if (!sid) { sid = uuid(); lsSet(SID_KEY, sid); }
    return sid;
  }
  var sid = getSid();
  function historyKey() { return 'ms-chat-history:' + sid; }
  function convKeyStorageKey() { return 'ms-chat-convkey:' + sid; }

  // messages: UIMessage[] -> { id, role, parts: [...] }
  var messages = loadHistory();

  function loadHistory() {
    var raw = lsGet(historyKey());
    if (!raw) return [];
    try {
      var arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.slice(-40);
    } catch (e) {}
    return [];
  }
  function saveHistory() {
    try { lsSet(historyKey(), JSON.stringify(messages.slice(-40))); } catch (e) {}
  }
  function rotateSession() {
    lsDel(historyKey());
    sid = uuid();
    lsSet(SID_KEY, sid);
    messages = [];
  }

  // ---------------------------------------------------------------------------
  // Fail-silent KPI telemetry. Fire-and-forget POST to /api/kpi, contract-
  // exact per API_CONTRACT.md §5: Content-Type: application/json + the
  // x-ms-session header (sendBeacon can set neither, so fetch is primary).
  // keepalive:true lets events survive page unloads (exit-intent, outbound
  // CTA clicks). Failures are swallowed and the response is never read —
  // telemetry must never make a caller care. The body carries the
  // pseudonymous session id and event names/ids only — never message text.
  // ---------------------------------------------------------------------------
  function track(event, data) {
    try {
      var payload = JSON.stringify({
        event: event,
        sessionId: sid,
        timestamp: new Date().toISOString(),
        data: data || {}
      });
      var url = API_BASE + '/api/kpi';
      if (window.fetch) {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-ms-session': sid },
          body: payload,
          keepalive: true
        }).catch(function () {});
        return;
      }
      if (navigator && typeof navigator.sendBeacon === 'function') navigator.sendBeacon(url, payload);
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // Page context + browsing trail (engagement layer).
  //
  // PRIVACY POSTURE (do not change): everything here is gathered CLIENT-SIDE
  // and used only in-session to tailor copy. The trail lives ONLY in the
  // user's localStorage, is capped and pruned, and is NEVER transmitted —
  // no backend call carries it (the only telemetry is the existing
  // fail-silent track() events: names + page type, never names of products
  // browsed, never message text). Context (productId/title) leaves the
  // browser only when the USER sends a chat message that carries it — the
  // same mechanism the product-page CTA already uses.
  //
  // TONE RULE for any copy built from this data: reference the PAGE or
  // CATEGORY ("Fragen zum Produkt …?"), never the user's behavior ("ich habe
  // gesehen, dass du …"). Helpful salesperson, not surveillant.
  // ---------------------------------------------------------------------------
  var PAGE_CTX = (function () {
    var pc = (CFG.pageContext && typeof CFG.pageContext === 'object') ? CFG.pageContext : {};
    var t = String(pc.pageType || '');
    var type = (t === 'product' || t === 'collection' || t === 'cart') ? t : (t === 'index' ? 'home' : 'other');
    return {
      type: type,
      productId: pc.productId != null ? String(pc.productId) : null,
      // The handle is the slug-shaped id — the form most likely to match the
      // backend catalog's product ids (API_CONTRACT.md §3 example ids are
      // slugs, not numeric Shopify ids). Used for context/trail ids; the
      // numeric id stays for our own KPI events.
      productHandle: pc.productHandle != null ? String(pc.productHandle) : null,
      productName: pc.productTitle != null ? String(pc.productTitle) : null,
      collectionHandle: pc.collectionHandle != null ? String(pc.collectionHandle) : null,
      // Category: the product's type on product pages, the collection title
      // on collection pages.
      category: pc.productType ? String(pc.productType) : (pc.collectionTitle ? String(pc.collectionTitle) : null)
    };
  })();

  // Lightweight browsing trail: the last few products/collections viewed
  // (ids + names + type + timestamp), capped at TRAIL_MAX, entries pruned
  // after TRAIL_TTL_MS. localStorage only — see the privacy posture above.
  var TRAIL_KEY = 'ms-chat-trail';
  var TRAIL_MAX = 5;
  var TRAIL_TTL_MS = 3 * 24 * 60 * 60 * 1000;

  function loadTrail() {
    var raw = lsGet(TRAIL_KEY);
    if (!raw) return [];
    try {
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      var now = Date.now();
      return arr.filter(function (e) {
        return e && typeof e === 'object' && typeof e.ts === 'number' && (now - e.ts) < TRAIL_TTL_MS;
      }).slice(0, TRAIL_MAX);
    } catch (e) { return []; }
  }

  function recordTrail() {
    if (PAGE_CTX.type !== 'product' && PAGE_CTX.type !== 'collection') return;
    var id = PAGE_CTX.type === 'product' ? (PAGE_CTX.productHandle || PAGE_CTX.productId) : PAGE_CTX.collectionHandle;
    var name = PAGE_CTX.type === 'product' ? PAGE_CTX.productName : PAGE_CTX.category;
    if (!id && !name) return;
    var entry = { id: id || '', name: name || '', type: PAGE_CTX.type, category: PAGE_CTX.category || '', ts: Date.now() };
    var trail = loadTrail().filter(function (e) { return !(e.type === entry.type && e.id === entry.id); });
    trail.unshift(entry);
    try { lsSet(TRAIL_KEY, JSON.stringify(trail.slice(0, TRAIL_MAX))); } catch (e) {}
  }

  // ">= 2 products viewed in one category" -> that category (the strongest
  // streak wins). Used for the comparison-offer nudge and category starters.
  function trailCategoryStreak(trail) {
    trail = trail || loadTrail();
    var counts = {};
    var best = null;
    for (var i = 0; i < trail.length; i++) {
      var e = trail[i];
      if (e.type !== 'product' || !e.category) continue;
      counts[e.category] = (counts[e.category] || 0) + 1;
      if (counts[e.category] >= 2 && (best == null || counts[e.category] > counts[best])) best = e.category;
    }
    return best;
  }

  // Trail -> the wire shape `context.recentlyViewed` accepts (API_CONTRACT.md
  // §2): { type:"product", id, name } / { type:"category", id?, name }, most
  // recent first, pre-capped to the server's own cap (3 products +
  // 2 categories — anything more is dropped server-side anyway). The backend
  // validates ids/names against the catalog and silently drops mismatches.
  // Returns null when there is nothing worth sending. Sent ONLY inside a
  // user-initiated chat request (open / first message) — never as a
  // background heartbeat.
  function recentlyViewedPayload() {
    var out = [];
    var prods = 0;
    var cats = 0;
    var trail = loadTrail();
    for (var i = 0; i < trail.length; i++) {
      var e = trail[i];
      if (e.type === 'product' && e.id && prods < 3) {
        out.push({ type: 'product', id: e.id, name: e.name || '' });
        prods++;
      } else if (e.type === 'collection' && e.name && cats < 2) {
        var c = { type: 'category', name: e.name };
        if (e.id) c.id = e.id;
        out.push(c);
        cats++;
      }
    }
    return out.length ? out : null;
  }

  // A `type: "browsing"` chat context from the trail, optionally led by a
  // specific category (categories are matched by NAME server-side, tolerant
  // of German storefront labels). Null when there is nothing to send.
  function browsingContext(leadCategory) {
    var rv = recentlyViewedPayload() || [];
    if (leadCategory) {
      rv = rv.filter(function (e) { return !(e.type === 'category' && e.name === leadCategory); });
      rv.unshift({ type: 'category', name: leadCategory });
    }
    return rv.length ? { type: 'browsing', recentlyViewed: rv } : null;
  }

  // ---------------------------------------------------------------------------
  // Tool names.
  // ---------------------------------------------------------------------------
  var VISIBLE_TOOLS = ['show_product', 'compare_products', 'add_to_cart', 'suggest_showroom', 'show_contact_form', 'offer_email_summary'];
  var SILENT_TOOLS = ['update_customer_profile', 'search_products'];
  var ALL_TOOLS = VISIBLE_TOOLS.concat(SILENT_TOOLS);

  function isToolPart(type, name) {
    return type === 'tool-' + name || type.indexOf('tool-' + name) === 0;
  }
  function resolveToolName(type) {
    if (typeof type !== 'string' || type.indexOf('tool-') !== 0) return null;
    for (var i = 0; i < ALL_TOOLS.length; i++) {
      if (isToolPart(type, ALL_TOOLS[i])) return ALL_TOOLS[i];
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Tiny DOM helpers.
  // ---------------------------------------------------------------------------
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v == null) continue;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else n.setAttribute(k, v);
      }
    }
    if (children != null) {
      if (!Array.isArray(children)) children = [children];
      for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (c == null) continue;
        n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return n;
  }

  // Trusted, internal SVG markup -> element. Never used on model output.
  var ICONS = {
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    // Desktop layout-mode toggle glyphs (the icon shows the TARGET mode):
    // `modal` = a centered window inside the viewport frame, `sidebar` = a
    // panel docked to the right edge of the viewport frame.
    modal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/></svg>',
    sidebar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    // Voice-mode toggle (equalizer waveform) — distinct from the dictate mic.
    waveform: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="4" y2="15"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="14" y1="7" x2="14" y2="17"/><line x1="19.5" y1="6" x2="19.5" y2="18"/></svg>',
    // Speaking indicator — same waveform bars; CSS animates them while playing
    // (frozen under prefers-reduced-motion).
    speaking: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="4" y2="15"/><line x1="9" y1="5" x2="9" y2="19"/><line x1="14" y1="7" x2="14" y2="17"/><line x1="19.5" y1="6" x2="19.5" y2="18"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    // Customer Account tier-3 glyphs (sign-in card + signed-in history drawer).
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    // Download glyph — signed-in "Zusammenfassung herunterladen" header button.
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
  };
  function icon(name) {
    var tpl = document.createElement('template');
    tpl.innerHTML = ICONS[name] || '';
    return tpl.content.firstElementChild;
  }

  // The wave bundle inside the brand orb (trusted, internal markup — never
  // model output). True sine S-curves: every path starts at (0,50) and ends
  // at (100,50) — the shared anchor points on the bubble's midline — and
  // crests/troughs in between with different amplitudes and phases. Strokes
  // are painted by the horizontal gradients; the CSS animates the two <g>
  // bundles with scaleY/skewX about the centre, which keeps both anchors
  // pinned. Glow = a wide low-opacity copy of each bundle's main strand.
  // GRADIENT IDS MUST BE UNIQUE PER INSTANCE (the __UID__ placeholder is
  // replaced on injection): url(#...) resolves to the FIRST matching id in
  // the document, and WebKit/Blink fail to paint gradients defined inside a
  // display:none subtree — so with shared ids, hiding the launcher while the
  // panel is open killed the strokes of every other orb (welcome/avatar).
  var LOGO_WAVES =
    '<svg class="ms-chat-logo-waves" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
      '<defs>' +
        '<linearGradient id="__UID__-cool" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0" stop-color="#ff8a5e" stop-opacity="0"/>' +
          '<stop offset="0.08" stop-color="#ff8a5e" stop-opacity="0.5"/>' +
          '<stop offset="0.3" stop-color="#4678ff"/>' +
          '<stop offset="0.55" stop-color="#3cc3ff"/>' +
          '<stop offset="0.78" stop-color="#7bffcd"/>' +
          '<stop offset="1" stop-color="#96ffbe" stop-opacity="0"/>' +
        '</linearGradient>' +
        '<linearGradient id="__UID__-warm" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0" stop-color="#ffc896" stop-opacity="0"/>' +
          '<stop offset="0.1" stop-color="#ffe2be" stop-opacity="0.6"/>' +
          '<stop offset="0.35" stop-color="#ffb43c"/>' +
          '<stop offset="0.62" stop-color="#ff7a32"/>' +
          '<stop offset="0.85" stop-color="#ff4646"/>' +
          '<stop offset="1" stop-color="#ff4646" stop-opacity="0"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<g class="ms-chat-logo-bundle ms-chat-logo-bundle--cool" stroke="url(#__UID__-cool)">' +
        '<path d="M0 50 C 16 18, 36 14, 52 40 S 82 74, 100 50" stroke-width="6.5" opacity="0.3"/>' +
        '<path d="M0 50 C 16 18, 36 14, 52 40 S 82 74, 100 50" stroke-width="2.2"/>' +
        '<path d="M0 50 C 18 28, 38 24, 54 44 S 84 66, 100 50" stroke-width="1.7" opacity="0.85"/>' +
        '<path d="M0 50 C 20 38, 42 34, 58 48 S 86 60, 100 50" stroke-width="1.3" opacity="0.7"/>' +
      '</g>' +
      '<g class="ms-chat-logo-bundle ms-chat-logo-bundle--warm" stroke="url(#__UID__-warm)">' +
        '<path d="M0 50 C 16 76, 36 84, 54 60 S 82 26, 100 50" stroke-width="6.5" opacity="0.28"/>' +
        '<path d="M0 50 C 16 76, 36 84, 54 60 S 82 26, 100 50" stroke-width="2.2"/>' +
        '<path d="M0 50 C 20 64, 40 68, 58 54 S 86 38, 100 50" stroke-width="1.6" opacity="0.85"/>' +
      '</g>' +
    '</svg>';
  var logoWavesSeq = 0;
  function logoWaves() {
    var uid = 'ms-chat-lg' + (++logoWavesSeq) + '-' + Math.random().toString(36).slice(2, 6);
    var tpl = document.createElement('template');
    tpl.innerHTML = LOGO_WAVES.replace(/__UID__/g, uid);
    return tpl.content.firstElementChild;
  }

  // Brand logo element: the glass bubble (CSS on .ms-chat-logo) with the
  // sine-wave SVG inside; the variant (full motion on launcher/welcome,
  // static avatar) is chosen per context via the extra class.
  function logoEl(extraClass) {
    var s = el('span', { class: 'ms-chat-logo ' + (extraClass || ''), 'aria-hidden': 'true' });
    s.appendChild(logoWaves());
    return s;
  }

  // ---------------------------------------------------------------------------
  // Markdown subset: **bold** and [label](url). XSS-safe (DOM nodes only).
  // ---------------------------------------------------------------------------
  var MD_RE = /(\*\*(.+?)\*\*)|(\[([^\]]+)\]\(([^)]+)\))/g;

  function safeHref(url) {
    var u = String(url || '').trim();
    try {
      var parsed = new URL(u, window.location.href);
      var p = parsed.protocol.toLowerCase();
      if (p === 'http:' || p === 'https:' || p === 'mailto:') return parsed.href;
    } catch (e) {}
    return null;
  }

  function appendInline(container, str) {
    MD_RE.lastIndex = 0;
    var last = 0, m;
    while ((m = MD_RE.exec(str)) !== null) {
      if (m.index > last) container.appendChild(document.createTextNode(str.slice(last, m.index)));
      if (m[1] != null) {
        container.appendChild(el('strong', { text: m[2] }));
      } else if (m[3] != null) {
        var href = safeHref(m[5]);
        if (href) {
          container.appendChild(el('a', { href: href, target: '_blank', rel: 'noopener noreferrer', text: m[4] }));
        } else {
          // Reject unsafe scheme: render the raw text literally, no link.
          container.appendChild(document.createTextNode(m[0]));
        }
      }
      last = MD_RE.lastIndex;
    }
    if (last < str.length) container.appendChild(document.createTextNode(str.slice(last)));
  }

  function renderMarkdownInto(node, text) {
    node.replaceChildren();
    var lines = String(text == null ? '' : text).split('\n');
    for (var i = 0; i < lines.length; i++) {
      var p = el('p');
      appendInline(p, lines[i]);
      node.appendChild(p);
    }
  }

  // ---------------------------------------------------------------------------
  // Product hydration with in-session cache.
  // ---------------------------------------------------------------------------
  var productCache = {}; // id -> product | null

  function chunk(arr, size) {
    var out = [];
    for (var i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function hydrate(ids) {
    ids = (ids || []).map(function (s) { return String(s).trim(); }).filter(Boolean);
    var uniq = [];
    var seen = {};
    for (var i = 0; i < ids.length; i++) { if (!seen[ids[i]]) { seen[ids[i]] = 1; uniq.push(ids[i]); } }
    var need = uniq.filter(function (id) { return !(id in productCache); });

    var jobs = chunk(need, 10).map(function (batch) {
      var url = API_BASE + '/api/products?ids=' + encodeURIComponent(batch.join(','));
      return fetch(url, { method: 'GET', headers: { 'x-ms-session': sid } })
        .then(function (res) {
          // Cache ONLY what a successful response asserts. The contract
          // reserves null for UNKNOWN ids — a transient 429/network failure
          // must cache NOTHING, so a later tool call retries instead of
          // rendering nothing for the rest of the session.
          if (!res.ok) return;
          return res.json().then(function (data) {
            var prods = (data && data.products) || [];
            for (var j = 0; j < batch.length; j++) {
              productCache[batch[j]] = prods[j] != null ? prods[j] : null;
            }
          });
        })
        .catch(function () { /* failed fetch: cache nothing -> retried later */ });
    });

    return Promise.all(jobs).then(function () {
      return ids.map(function (id) { return id in productCache ? productCache[id] : null; });
    });
  }

  // ---------------------------------------------------------------------------
  // Canonical consent copy for the capture form (API_CONTRACT.md §7.4).
  // Sourced ONLY from the backend: seeded from the offer_email_summary tool
  // result and/or fetched from GET /api/consent-copy — both serve the
  // identical payload. Held in memory for 60s (matching the endpoint's
  // Cache-Control) so a lawyer copy change reaches live widgets quickly;
  // never persisted across sessions.
  // ---------------------------------------------------------------------------
  var CONSENT_COPY_TTL_MS = 60 * 1000;
  var consentCopyCache = null;    // { copy, at }
  var consentCopyInflight = null; // de-duped GET while a fetch is pending

  function validConsentCopy(c) {
    return !!(c && typeof c === 'object' &&
      typeof c.transactionalLabel === 'string' && c.transactionalLabel &&
      typeof c.marketingLabel === 'string' && c.marketingLabel &&
      typeof c.consentTextShown === 'string' && c.consentTextShown);
  }

  function seedConsentCopy(c) {
    if (validConsentCopy(c)) consentCopyCache = { copy: c, at: Date.now() };
  }

  // Returning-customer hint (consent copy v2): backend-served AND
  // backend-gated. Returns the hint text ONLY when the backend explicitly
  // marks it enabled; an absent field (older backend) or a disabled
  // server-side switch -> null, and the caller renders NOTHING — the widget
  // carries no fallback hint copy.
  function returningHintText(c) {
    var h = c && c.returningHint;
    return (h && h.enabled === true && typeof h.text === 'string' && h.text) ? h.text : null;
  }

  function fetchConsentCopy() {
    if (consentCopyCache && (Date.now() - consentCopyCache.at) < CONSENT_COPY_TTL_MS) {
      return Promise.resolve(consentCopyCache.copy);
    }
    if (consentCopyInflight) return consentCopyInflight;
    consentCopyInflight = fetch(API_BASE + '/api/consent-copy', { method: 'GET', headers: { 'x-ms-session': sid } })
      .then(function (res) {
        if (!res.ok) throw new Error('consent-copy ' + res.status);
        return res.json();
      })
      .then(function (data) {
        consentCopyInflight = null;
        if (!validConsentCopy(data)) throw new Error('consent-copy: invalid payload');
        consentCopyCache = { copy: data, at: Date.now() };
        return data;
      })
      .catch(function (err) {
        consentCopyInflight = null;
        throw err;
      });
    return consentCopyInflight;
  }

  // At-sign-in marketing opt-in copy (consent copy v3 — CONSENT_FLOW.md §2.1).
  // A SEPARATE payload from the capture form's: it carries no email field and
  // no transactional label (the customer is signed in, so we already hold the
  // verified email). Fetched from GET /api/consent-copy?surface=signin and held
  // in its own short-lived cache; like the capture copy it is served-only and
  // never hard-coded, so the stored Art. 7 audit text can't diverge from what
  // was shown. Same guard as the default consent-copy call (no shared secret —
  // these are public strings already shown to users).
  var signInConsentCache = null;    // { copy, at }
  var signInConsentInflight = null; // de-duped GET while a fetch is pending

  function validSignInConsentCopy(c) {
    return !!(c && typeof c === 'object' &&
      typeof c.marketingLabel === 'string' && c.marketingLabel &&
      typeof c.consentTextShown === 'string' && c.consentTextShown);
  }

  function fetchSignInConsentCopy() {
    if (signInConsentCache && (Date.now() - signInConsentCache.at) < CONSENT_COPY_TTL_MS) {
      return Promise.resolve(signInConsentCache.copy);
    }
    if (signInConsentInflight) return signInConsentInflight;
    signInConsentInflight = fetch(API_BASE + '/api/consent-copy?surface=signin', { method: 'GET', headers: { 'x-ms-session': sid } })
      .then(function (res) {
        if (!res.ok) throw new Error('consent-copy signin ' + res.status);
        return res.json();
      })
      .then(function (data) {
        signInConsentInflight = null;
        if (!validSignInConsentCopy(data)) throw new Error('consent-copy signin: invalid payload');
        signInConsentCache = { copy: data, at: Date.now() };
        return data;
      })
      .catch(function (err) {
        signInConsentInflight = null;
        throw err;
      });
    return signInConsentInflight;
  }

  // ---------------------------------------------------------------------------
  // Customer Account sign-in (tier 3) + signed-in conversation history.
  //
  // ADDITIVE BY DESIGN. The anonymous and email-only flows are untouched: when
  // the user never signs in, `auth.signedIn` stays false and every branch below
  // collapses to the pre-existing behaviour (the only new surface is the
  // optional sign-in card/affordance, which is the whole point of the tier).
  //
  // The widget NEVER handles OAuth tokens. Sign-in is a top-level redirect to
  // the backend's hosted flow; identity is re-hydrated via a guarded XHR to
  // /api/auth/me. The EXISTING session id (`sid`) is the opaque reference to
  // the signed-in identity — it survives the redirect unchanged, so we never
  // rotate it around sign-in (CUSTOMER_ACCOUNT.md §1). All /api/auth/me and
  // /api/account/* calls carry the same guards as the chat endpoints
  // (x-ms-chat-key + x-ms-session). Docs: docs/ai-advisor/CUSTOMER_ACCOUNT.md,
  // docs/ai-advisor/API_CONTRACT.md.
  // ---------------------------------------------------------------------------
  // UI CHROME only (German). No legal/consent copy lives here.
  var ACCOUNT_COPY = {
    signInTitle: 'Mit deinem Konto anmelden',
    signInIntro: 'Melde dich mit deinem motion sports Konto an, um mehr aus deiner Beratung zu machen:',
    benefits: [
      'An frühere Beratungen anknüpfen',
      'Adresse & Bestellungen einbeziehen',
      'Passende Angebote erhalten'
    ],
    signInBtn: 'Anmelden',
    signInHeader: 'Anmelden',
    historyTitle: 'Deine Beratungen',
    historyAria: 'Beratungsverlauf',
    newChat: 'Neue Beratung',
    loading: 'Wird geladen…',
    loadError: 'Verlauf konnte nicht geladen werden.',
    empty: 'Noch keine gespeicherten Beratungen.',
    rename: 'Umbenennen',
    del: 'Löschen',
    save: 'Speichern',
    cancel: 'Abbrechen',
    deleteConfirm: 'Dieser Chat wird gelöscht.',
    deleteYes: 'Löschen',
    msgCount: function (n) { return (n || 0) + (n === 1 ? ' Nachricht' : ' Nachrichten'); },
    logout: 'Abmelden',
    erase: 'Alle meine Daten löschen',
    eraseConfirm: 'Alle deine Beratungen, dein Profil und gespeicherten Daten werden unwiderruflich gelöscht. Wirklich fortfahren?',
    eraseYes: 'Endgültig löschen',
    eraseError: 'Löschen gerade nicht möglich — bitte später erneut versuchen.',
    openError: 'Diese Beratung konnte nicht geöffnet werden.'
  };

  // Device hint: set once we've confirmed a signed-in session so a later visit
  // re-probes /api/auth/me even before the storefront customer hint is read.
  // Never carries identity itself — just "worth asking the backend again".
  var SIGNED_IN_KEY = 'ms-chat-signed-in';
  // `marketing` / `optInActionable` mirror /api/auth/me (CUSTOMER_ACCOUNT.md §4):
  // optInActionable is the backend's single source of truth for "show the
  // at-sign-in opt-in" (true ⇔ no marketing decision on record yet + a verified
  // email). We never re-derive it from `status` ourselves.
  var auth = { settled: false, signedIn: false, name: null, tier: null, marketing: null, optInActionable: false };
  // The conversation currently loaded into the local view (for list highlight);
  // purely informational — the backend resolves the active thread from `sid`.
  var activeConversationId = null;
  // Active conversation THREAD key (CUSTOMER_ACCOUNT.md §7.6 / API_CONTRACT.md
  // §2): addresses WHICH thread a /api/chat turn appends to, so a signed-in
  // customer keeps several conversations under one stable session_id. NULL for
  // anonymous / email-only — we then OMIT conversationKey entirely, so the
  // backend defaults to the legacy one-thread-per-session behaviour and tiers
  // 1–2 stay byte-identical. Persisted per-session so a reload resumes the same
  // thread alongside the locally cached transcript.
  var activeConversationKey = loadConvKey();
  function loadConvKey() { return lsGet(convKeyStorageKey()) || null; }
  function saveConvKey() {
    try { if (activeConversationKey) lsSet(convKeyStorageKey(), activeConversationKey); else lsDel(convKeyStorageKey()); } catch (e) {}
  }
  function clearConvKey() { activeConversationKey = null; try { lsDel(convKeyStorageKey()); } catch (e) {} }
  // Mint a fresh thread key for a brand-new signed-in conversation so it becomes
  // its own history row. Only mint on the FIRST turn of a fresh thread; an
  // in-progress local thread that has no key stays legacy (keyed server-side by
  // session_id) so we never fork an existing conversation mid-stream.
  function maybeMintConversationKey(isFreshThread) {
    if (!auth.signedIn || activeConversationKey || !isFreshThread) return;
    activeConversationKey = uuid();
    saveConvKey();
    updateDownloadBtn();
  }

  // Guarded account/auth XHR headers (CUSTOMER_ACCOUNT.md §4/§7).
  function accountHeaders() { return { 'x-ms-chat-key': CHAT_KEY, 'x-ms-session': sid }; }

  // Best-effort, non-authoritative pre-hint: is the visitor logged into the
  // storefront? Used ONLY to decide whether the silent /api/auth/me probe is
  // worth doing — never to gate identity (CUSTOMER_ACCOUNT.md §3).
  function storefrontCustomerHint() {
    try {
      return !!(window.ShopifyAnalytics && window.ShopifyAnalytics.meta &&
                window.ShopifyAnalytics.meta.page && window.ShopifyAnalytics.meta.page.customerId);
    } catch (e) { return false; }
  }
  function shouldProbeAuth() {
    return lsGet(SIGNED_IN_KEY) === '1' || storefrontCustomerHint();
  }

  function applyAuth(data) {
    auth.settled = true;
    if (data && data.signedIn) {
      auth.signedIn = true;
      auth.name = (data.identity && data.identity.name) || null;
      auth.tier = (data.identity && data.identity.tier) || 3;
      // Marketing decision state drives the at-sign-in opt-in (§6.1). Trust
      // optInActionable verbatim — it is false once any decision exists.
      auth.marketing = (data.marketing && typeof data.marketing === 'object') ? data.marketing : null;
      auth.optInActionable = !!(auth.marketing && auth.marketing.optInActionable === true);
      lsSet(SIGNED_IN_KEY, '1');
    } else {
      auth.signedIn = false;
      auth.name = null;
      auth.tier = null;
      auth.marketing = null;
      auth.optInActionable = false;
      lsDel(SIGNED_IN_KEY);
    }
    reflectAuthState();
    flushAutoHistory(); // an async probe that resolves while the panel is open
  }

  // Ask the backend who this session belongs to (CUSTOMER_ACCOUNT.md §4).
  // Fails closed: any error => not signed in.
  var authProbed = false;
  function probeAuth(force) {
    if (authProbed && !force) return Promise.resolve(auth);
    authProbed = true;
    var url = API_BASE + '/api/auth/me?session=' + encodeURIComponent(sid);
    return fetch(url, { method: 'GET', headers: accountHeaders() })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { applyAuth(data); return auth; })
      .catch(function () { applyAuth(null); return auth; });
  }

  // Top-level redirect into the backend's hosted sign-in, returning to THIS
  // page so the same conversation re-hydrates (CUSTOMER_ACCOUNT.md §2). We do
  // NOT use prompt=none here — this is a deliberate user click. The silent
  // prompt=none optimisation is intentionally skipped in favour of the
  // documented one-click affordance (see backend-handoff note).
  function initiateLogin() {
    try {
      track('account_signin_started', {});
      ssSet('ms-chat-auth-return', '1'); // re-open the panel when we come back
      var url = new URL(API_BASE + '/api/auth/shopify/login');
      url.searchParams.set('session', sid);
      url.searchParams.set('return_url', window.location.href);
      window.location.assign(url.toString());
    } catch (e) {
      try { console.error('[ms-chat] sign-in redirect failed', e); } catch (e2) {}
    }
  }

  // Read + strip the ?ms_auth= return marker (CUSTOMER_ACCOUNT.md §2).
  function handleAuthReturn() {
    var marker = null;
    try {
      var u = new URL(window.location.href);
      marker = u.searchParams.get('ms_auth');
      if (marker != null) {
        u.searchParams.delete('ms_auth');
        window.history.replaceState(null, '', u.pathname + (u.search ? u.search : '') + u.hash);
      }
    } catch (e) {}
    if (!marker) return;
    var wantsOpen = ssGet('ms-chat-auth-return') === '1';
    try { window.sessionStorage.removeItem('ms-chat-auth-return'); } catch (e) {}
    authOpenHandled = true; // we own the auth state for this load
    if (marker === 'ok') {
      track('account_signin_return', { result: 'ok' });
      probeAuth(true).then(function () {
        if (wantsOpen || auth.signedIn) openPanel();
        // The sign-in moment: offer the marketing opt-in. The welcome state
        // renders it in its own auth slot; present it inline only when a
        // conversation is already on screen (mid-conversation sign-in).
        if (auth.signedIn) presentSignInOptIn();
      });
    } else if (marker === 'login_required') {
      // prompt=none path only: not logged in -> show the one-click affordance.
      applyAuth(null);
      if (wantsOpen) openPanel();
    } else if (marker === 'logged_out') {
      applyAuth(null);
    } else { // 'error' or anything unexpected -> stay anonymous.
      applyAuth(null);
      if (wantsOpen) openPanel();
    }
  }

  // Local sign-out: hides the signed-in tier on THIS device. A full Shopify
  // logout requires Shopify's end_session_endpoint, which the widget does not
  // have from the documented contract — see the backend-handoff note. The
  // server session is left to expire / be ended via the account page.
  function signOut() {
    track('account_signout', {});
    applyAuth(null);
    closeHistory();
  }

  // First-open auth resolution (lazy: no network for pure-anonymous visitors,
  // so the no-sign-in path stays byte-identical — nothing fires until the
  // panel is opened, and even then only when a hint says it's worth probing).
  var authOpenHandled = false;
  function resolveAuthOnOpen() {
    if (authOpenHandled) return;
    authOpenHandled = true;
    if (shouldProbeAuth()) probeAuth();
    else applyAuth(null); // settle as not-signed-in -> renders the sign-in card
  }

  // ---------------------------------------------------------------------------
  // Formatting helpers.
  // ---------------------------------------------------------------------------
  function euro(value) {
    var n = Number(value);
    if (!isFinite(n)) return '';
    return n.toLocaleString('de-DE') + ' €';
  }

  function priceNode(product) {
    var wrap = el('div', { class: 'ms-chat-price' });
    if (product.salePrice != null && product.salePrice !== product.price) {
      wrap.appendChild(el('span', { class: 'ms-chat-price-sale', text: euro(product.salePrice) }));
      wrap.appendChild(el('span', { class: 'ms-chat-price-strike', text: euro(product.price) }));
    } else {
      wrap.appendChild(el('span', { class: 'ms-chat-price-regular', text: euro(product.price) }));
    }
    return wrap;
  }

  // Prominent primary CTA button to a product page (feature 2 / KPI driver).
  // These are the highest-value clicks, so they get the theme's primary pill
  // button instead of a subtle text link. Fires a fail-silent KPI event.
  function productButton(product, label) {
    var a = el('a', { class: 'ms-chat-btn ms-chat-btn--primary', href: product.shopifyUrl || '#', target: '_blank', rel: 'noopener noreferrer' });
    a.appendChild(el('span', { text: label || 'Zum Produkt' }));
    a.appendChild(icon('external'));
    a.addEventListener('click', function () { track('product_cta_clicked', { productId: product.id }); });
    return a;
  }

  // ---------------------------------------------------------------------------
  // Tool card builders. Each returns Promise<Element|null> (null = render nothing).
  // ---------------------------------------------------------------------------
  // Compact product card (client direction: "only what's needed"): small
  // thumb + name + price + CTA, reusing the checkout row layout. Specs, tag
  // chips, series badge, reason and delivery time live on the product page.
  function buildShowProduct(input) {
    return hydrate([input.productId]).then(function (res) {
      var p = res[0];
      if (!p) return null; // render-nothing guard
      var card = el('div', { class: 'ms-chat-card' });
      var body = el('div', { class: 'ms-chat-card-body' });

      var item = el('div', { class: 'ms-chat-checkout-item' });
      if (p.images && p.images[0]) {
        item.appendChild(el('img', { class: 'ms-chat-checkout-thumb', src: p.images[0], alt: p.name || '', loading: 'lazy' }));
      }
      var meta = el('div', { class: 'ms-chat-checkout-meta' });
      meta.appendChild(el('div', { class: 'ms-chat-prod-name', text: p.name || '' }));
      meta.appendChild(priceNode(p));
      // Sync-fresh stock flag (API_CONTRACT.md §3) — functional, not
      // decorative, so it survives the compact-card cut.
      if (p.inStock === false) meta.appendChild(el('span', { class: 'ms-chat-soldout-badge', text: 'Ausverkauft' }));
      item.appendChild(meta);
      body.appendChild(item);

      // Prominent primary CTA below the product row.
      body.appendChild(productButton(p, 'Zum Produkt'));

      card.appendChild(body);
      return card;
    });
  }

  function buildCompare(input) {
    var ids = input.productIds || [];
    return hydrate(ids).then(function (res) {
      var prods = res.filter(function (p) { return !!p; });
      if (prods.length < 2) return null; // need >= 2

      var wrap = el('div', { class: 'ms-chat-card' });
      var body = el('div', { class: 'ms-chat-card-body' });
      if (input.comparisonContext) body.appendChild(el('div', { class: 'ms-chat-compare-context', text: input.comparisonContext }));

      // Spec keys present in >= 2 products (or all keys when exactly 2 products).
      var keyCount = {};
      var keyOrder = [];
      prods.forEach(function (p) {
        Object.keys(p.specifications || {}).forEach(function (k) {
          if (!(k in keyCount)) { keyCount[k] = 0; keyOrder.push(k); }
          keyCount[k]++;
        });
      });
      var specKeys = keyOrder.filter(function (k) { return prods.length === 2 ? true : keyCount[k] >= 2; });

      var scroll = el('div', { class: 'ms-chat-compare-scroll' });
      var table = el('table', { class: 'ms-chat-compare-table' });

      // Header row.
      var thead = el('thead');
      var hrow = el('tr');
      hrow.appendChild(el('th'));
      prods.forEach(function (p) {
        var th = el('th');
        if (p.images && p.images[0]) th.appendChild(el('img', { class: 'ms-chat-compare-img', src: p.images[0], alt: p.name || '', loading: 'lazy' }));
        th.appendChild(el('div', { class: 'ms-chat-compare-name', text: p.name || '' }));
        hrow.appendChild(th);
      });
      thead.appendChild(hrow);
      table.appendChild(thead);

      var tbody = el('tbody');
      function row(label, cellFn) {
        var tr = el('tr');
        tr.appendChild(el('td', { class: 'ms-chat-compare-rowlabel', text: label }));
        prods.forEach(function (p) { tr.appendChild(cellFn(p)); });
        tbody.appendChild(tr);
      }

      row('Preis', function (p) { var td = el('td'); td.appendChild(priceNode(p)); return td; });
      specKeys.forEach(function (k) {
        row(k, function (p) {
          var v = (p.specifications && p.specifications[k] != null) ? String(p.specifications[k]) : '—';
          return el('td', { text: v });
        });
      });
      row('Lieferzeit', function (p) { return el('td', { text: p.deliveryTime || '—' }); });
      row('', function (p) { var td = el('td'); td.appendChild(productButton(p, 'Zum Produkt')); return td; });

      table.appendChild(tbody);
      scroll.appendChild(table);
      body.appendChild(scroll);
      wrap.appendChild(body);
      return wrap;
    });
  }

  // tool-add_to_cart -> direct-checkout CTA. Per API_CONTRACT.md the tool id is
  // unchanged but a single call can now cover ONE *or* SEVERAL products in one
  // combined cart: read `productIds` when present, else fall back to the single
  // `productId`. We render ONE card listing every resolved product and ONE
  // checkout button pointing at the response's top-level `cartUrl` — a single
  // permalink that puts all variants in one cart (never stitched client-side).
  function buildAddToCart(input) {
    var ids = (input.productIds && input.productIds.length)
      ? input.productIds.slice()
      : (input.productId != null ? [input.productId] : []);
    ids = ids.map(function (s) { return String(s).trim(); }).filter(Boolean);
    var seen = {}, uniq = [];
    for (var i = 0; i < ids.length; i++) { if (!seen[ids[i]]) { seen[ids[i]] = 1; uniq.push(ids[i]); } }
    ids = uniq;
    if (!ids.length) return Promise.resolve(null);

    // Dedicated fetch (not the per-id hydrate cache) so we get the response's
    // top-level `cartUrl` — the one combined permalink for exactly these ids.
    var url = API_BASE + '/api/products?ids=' + encodeURIComponent(ids.join(','));
    return fetch(url, { method: 'GET', headers: { 'x-ms-session': sid } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        var prods = (data && data.products) || [];
        var cartUrl = (data && data.cartUrl) || null;
        // Warm the shared cache opportunistically (unknown ids come back
        // null) — but only from a successful response; a failed fetch must
        // not mark the ids unknown for the rest of the session.
        if (data) {
          for (var j = 0; j < ids.length; j++) {
            if (!(ids[j] in productCache)) productCache[ids[j]] = prods[j] != null ? prods[j] : null;
          }
        }
        var resolved = prods.filter(function (p) { return !!p; });
        if (!resolved.length) return null; // nothing resolvable -> render nothing
        var multi = resolved.length > 1;

        var card = el('div', { class: 'ms-chat-card' });
        var body = el('div', { class: 'ms-chat-card-body' });
        if (input.message) body.appendChild(el('div', { class: 'ms-chat-card-msg', text: input.message }));

        // One row per product (thumb + name + price), so the shopper sees exactly
        // what the single checkout click buys.
        resolved.forEach(function (p) {
          var item = el('div', { class: 'ms-chat-checkout-item' });
          if (p.images && p.images[0]) {
            item.appendChild(el('img', { class: 'ms-chat-checkout-thumb', src: p.images[0], alt: p.name || '', loading: 'lazy' }));
          }
          var meta = el('div', { class: 'ms-chat-checkout-meta' });
          meta.appendChild(el('span', { class: 'ms-chat-checkout-name', text: p.name || 'Produkt' }));
          meta.appendChild(priceNode(p));
          // The server-built cartUrl EXCLUDES sold-out products — mark them so
          // the listed rows match what the checkout click actually contains.
          if (p.inStock === false) meta.appendChild(el('span', { class: 'ms-chat-soldout-note', text: 'Ausverkauft — nicht im Warenkorb' }));
          item.appendChild(meta);
          body.appendChild(item);
        });

        if (cartUrl) {
          // ONE button -> the combined cart covering every resolved product.
          // Labeled "Zur Kasse": the permalink lands in checkout, so an
          // add-to-cart label would be misleading. Brand-blue checkout
          // styling makes it the unmistakable primary action.
          var btn = el('a', { class: 'ms-chat-btn ms-chat-btn--checkout', href: cartUrl, target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'Zur Kasse' });
          btn.appendChild(icon('cart'));
          btn.appendChild(el('span', { text: 'Zur Kasse' }));
          btn.addEventListener('click', function () {
            track('add_to_cart_clicked', { productId: resolved[0].id, productIds: resolved.map(function (p) { return p.id; }) });
          });
          body.appendChild(btn);
          body.appendChild(el('div', { class: 'ms-chat-caption', text: 'Direkt zur sicheren Kasse bei motionsports.de' }));
        } else {
          // No resolvable variant -> degrade to product-page link(s), never a
          // broken checkout link.
          resolved.forEach(function (p) {
            if (!p.shopifyUrl) return;
            var link = el('a', { class: 'ms-chat-btn ms-chat-btn--secondary', href: p.shopifyUrl, target: '_blank', rel: 'noopener noreferrer' });
            link.appendChild(el('span', { text: multi ? (p.name || 'Zum Produkt') : 'Zum Produkt' }));
            link.appendChild(icon('external'));
            link.addEventListener('click', function () { track('product_cta_clicked', { productId: p.id }); });
            body.appendChild(link);
          });
        }

        card.appendChild(body);
        return card;
      })
      .catch(function () { return null; });
  }

  function buildShowroom(input) {
    var ids = input.productIds || [];
    return hydrate(ids).then(function (res) {
      var prods = res.filter(function (p) { return !!p; });
      if (prods.length < 1) return null;
      var names = prods.map(function (p) { return p.name; }).join(', ');

      var card = el('div', { class: 'ms-chat-card' });
      var body = el('div', { class: 'ms-chat-card-body' });
      var head = el('div', { class: 'ms-chat-card-head' });
      head.appendChild(icon('pin'));
      head.appendChild(el('span', { text: 'Showroom in Gröbenzell bei München' }));
      body.appendChild(head);
      body.appendChild(el('div', { class: 'ms-chat-card-text', text: 'Möchtest du ' + names + ' vor dem Kauf testen? Besuche unseren Showroom!' }));

      var btn = el('a', { class: 'ms-chat-btn ms-chat-btn--primary', href: SHOWROOM_URL, target: '_blank', rel: 'noopener noreferrer' });
      btn.appendChild(el('span', { text: 'Showroom ansehen' }));
      btn.appendChild(icon('external'));
      btn.addEventListener('click', function () { track('showroom_clicked', { productIds: prods.map(function (p) { return p.id; }) }); });
      body.appendChild(btn);
      body.appendChild(el('div', { class: 'ms-chat-caption', text: 'Terminvereinbarung erforderlich' }));
      card.appendChild(body);
      return card;
    });
  }

  var REASON_LABELS = {
    studio_consultation: { title: 'Persönliche Studio-Beratung', sub: 'Ein Studio-Spezialist meldet sich für ein individuelles Konzept.' },
    public_sector_quote: { title: 'Formelles Angebot anfordern', sub: 'Mit Kauf auf Rechnung, Zahlungsziel und CE-Doku.' },
    physio_consultation: { title: 'Physio- / Reha-Beratung', sub: 'Persönliche Beratung zu Reha-Einsatz und Medizinprodukten.' },
    bulk_discount: { title: 'Mengenrabatt anfragen', sub: 'Wir erstellen ein individuelles Angebot.' },
    leasing: { title: 'Leasing-Anfrage', sub: 'Flexible Finanzierung für gewerbliche Kunden.' },
    maintenance: { title: 'Wartungsvertrag', sub: 'Langfristige Wartung und Ersatzteilversorgung.' },
    general: { title: 'Persönliche Beratung', sub: 'Wir helfen dir gerne weiter.' }
  };

  function buildContactForm(input) {
    var reason = input.reason || 'general';
    var labels = REASON_LABELS[reason] || REASON_LABELS.general;
    var orgRequired = (reason === 'studio_consultation' || reason === 'public_sector_quote');

    var card = el('div', { class: 'ms-chat-card' });
    var body = el('div', { class: 'ms-chat-card-body' });

    var head = el('div', { class: 'ms-chat-card-head' });
    head.appendChild(icon('mail'));
    head.appendChild(el('span', { text: labels.title }));
    body.appendChild(head);
    body.appendChild(el('div', { class: 'ms-chat-card-text', text: input.message || labels.sub }));

    var refsEl = null;
    if (input.productIds && input.productIds.length) {
      refsEl = el('div', { class: 'ms-chat-card-refs' });
      body.appendChild(refsEl);
      hydrate(input.productIds).then(function (res) {
        var names = res.filter(function (p) { return !!p; }).map(function (p) { return p.name; });
        if (names.length) {
          refsEl.replaceChildren();
          refsEl.appendChild(el('span', { text: 'Im Bezug: ' }));
          refsEl.appendChild(el('b', { text: names.join(', ') }));
        }
      });
    }

    var form = el('form', { class: 'ms-chat-form', novalidate: 'novalidate' });

    function field(labelText, inputEl) {
      var f = el('div', { class: 'ms-chat-field' });
      var id = 'msc-' + Math.random().toString(36).slice(2, 8);
      inputEl.id = id;
      var lbl = el('label', { text: labelText });
      lbl.setAttribute('for', id);
      f.appendChild(lbl);
      f.appendChild(inputEl);
      return f;
    }

    var nameInput = el('input', { type: 'text', name: 'name', required: 'required', autocomplete: 'name' });
    var emailInput = el('input', { type: 'email', name: 'email', required: 'required', autocomplete: 'email' });
    var orgInput = el('input', { type: 'text', name: 'organization', autocomplete: 'organization' });
    if (orgRequired) orgInput.setAttribute('required', 'required');
    var phoneInput = el('input', { type: 'tel', name: 'phone', autocomplete: 'tel' });
    var msgInput = el('textarea', { name: 'message', required: 'required', placeholder: 'Beschreibe kurz dein Anliegen…' });

    form.appendChild(field('Name *', nameInput));
    form.appendChild(field('E-Mail *', emailInput));
    form.appendChild(field(orgRequired ? 'Organisation / Studio *' : 'Organisation', orgInput));
    form.appendChild(field('Telefon', phoneInput));
    form.appendChild(field('Nachricht *', msgInput));

    var errEl = el('div', { class: 'ms-chat-form-error', style: 'display:none' });
    form.appendChild(errEl);

    var submit = el('button', { type: 'submit', class: 'ms-chat-btn ms-chat-btn--primary' }, ['Anfrage senden']);
    form.appendChild(submit);
    body.appendChild(form);

    body.appendChild(el('div', { class: 'ms-chat-caption', text: 'Wir melden uns innerhalb von 1-2 Werktagen. Deine Daten werden nur für die Bearbeitung deiner Anfrage verwendet.' }));

    function showError(msg) { errEl.textContent = msg; errEl.style.display = 'block'; }
    function clearError() { errEl.textContent = ''; errEl.style.display = 'none'; }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      clearError();

      var payload = {
        reason: reason,
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        organization: orgInput.value.trim(),
        phone: phoneInput.value.trim(),
        message: msgInput.value.trim()
      };
      if (input.productIds && input.productIds.length) payload.productIds = input.productIds;

      if (!payload.name) { showError('Bitte gib deinen Namen an.'); return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email)) { showError('Bitte gib eine gültige E-Mail-Adresse an.'); return; }
      if (orgRequired && !payload.organization) { showError('Bitte gib deine Organisation / dein Studio an.'); return; }
      if (!payload.message) { showError('Bitte beschreibe kurz dein Anliegen.'); return; }

      submit.disabled = true;
      submit.textContent = 'Wird gesendet…';

      fetch(API_BASE + '/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ms-chat-key': CHAT_KEY, 'x-ms-session': sid },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (res.ok) {
          var ok = el('div', { class: 'ms-chat-form-success' });
          ok.appendChild(icon('check'));
          ok.appendChild(el('h3', { text: 'Vielen Dank!' }));
          ok.appendChild(el('p', { text: 'Wir haben deine Anfrage erhalten und melden uns innerhalb von 1-2 Werktagen.' }));
          body.replaceChildren(head, ok);
          return;
        }
        return res.json().catch(function () { return null; }).then(function (data) {
          var code = data && data.error && data.error.code;
          var msg = (data && data.error && data.error.message) || '';
          if (res.status === 429 || code === 'rate_limited') {
            // Mirror the chat path: German hint + submit locked for the
            // Retry-After window (same 30s default when the header is
            // missing/unreadable).
            var retry = parseInt(res.headers.get('Retry-After'), 10);
            if (!isFinite(retry) || retry <= 0) retry = 30;
            showError('Zu viele Anfragen — bitte kurz warten.');
            submit.textContent = 'Anfrage senden';
            setTimeout(function () { submit.disabled = false; }, retry * 1000);
            return;
          }
          if (code === 'upstream_unavailable' || res.status === 502) {
            msg = 'Senden gerade nicht möglich — bitte später erneut versuchen.';
          } else if (!msg) {
            msg = 'Senden fehlgeschlagen. Bitte versuch es erneut.';
          }
          showError(msg);
          submit.disabled = false;
          submit.textContent = 'Anfrage senden';
        });
      }).catch(function () {
        showError('Senden gerade nicht möglich — bitte später erneut versuchen.');
        submit.disabled = false;
        submit.textContent = 'Anfrage senden';
      });
    });

    card.appendChild(body);
    return Promise.resolve(card);
  }

  // ---------------------------------------------------------------------------
  // GDPR email-capture form. Shared by BOTH entry points:
  //   (a) the assistant's offer_email_summary tool part (inline in the chat),
  //   (b) the header share icon (proactive, on demand).
  // Returns the card Element synchronously; the consent block fills in once
  // the CANONICAL backend copy resolves (submit stays disabled until then —
  // the audit string must be the served text, never a widget fallback). The
  // two consents are SEPARATE; BOTH boxes start UNCHECKED (v2) and the
  // marketing box is never bundled with the transactional one. POSTs to
  // /api/capture-email
  // (API_CONTRACT.md §7) echoing the backend's `consentTextShown` verbatim.
  // opts.productIds is advisory cart-preview only — the backend resolves the
  // real products. opts.trigger is the offer's value moment, echoed back on
  // submit (telemetry only).
  // ---------------------------------------------------------------------------
  // Returning-customer memory (API_CONTRACT.md §2 "customer"): the email the
  // user captured IN THIS PAGE'S chat session, attached to subsequent
  // /api/chat requests so the backend can inject its memory block. PRIVACY
  // GATE (do not change): in-memory ONLY — never localStorage/cookies, never
  // auto-attached on a fresh widget open; a navigation resets it. The backend
  // independently verifies the capture came from this same x-ms-session, so
  // a forged value resolves to no memory anyway.
  var capturedEmail = null;

  function buildCaptureCard(opts) {
    opts = opts || {};
    var card = el('div', { class: 'ms-chat-card' });
    var body = el('div', { class: 'ms-chat-card-body' });

    var head = el('div', { class: 'ms-chat-card-head' });
    head.appendChild(icon('mail'));
    head.appendChild(el('span', { text: CONSENT_COPY.title }));
    body.appendChild(head);

    if (opts.message) body.appendChild(el('div', { class: 'ms-chat-card-text', text: opts.message }));

    if (opts.productIds && opts.productIds.length) {
      var refsEl = el('div', { class: 'ms-chat-card-refs' });
      body.appendChild(refsEl);
      hydrate(opts.productIds).then(function (res) {
        var names = res.filter(function (p) { return !!p; }).map(function (p) { return p.name; });
        if (names.length) {
          refsEl.replaceChildren();
          refsEl.appendChild(el('span', { text: 'Im Warenkorb: ' }));
          refsEl.appendChild(el('b', { text: names.join(', ') }));
        }
      });
    }

    var form = el('form', { class: 'ms-chat-form ms-chat-capture', novalidate: 'novalidate' });

    // Returning-customer hint (backend-served, v2) directly ABOVE the email
    // field — the "why give my email" answer where the decision happens.
    // Filled in renderConsent ONLY when the backend marks it enabled;
    // informational UI copy, NOT part of the consent block or of
    // `consentTextShown`. No fallback text lives in the widget.
    var returnHintEl = el('div', { class: 'ms-chat-returning-hint ms-chat-returning-hint--form', style: 'display:none' });
    form.appendChild(returnHintEl);

    // Email field (real <label> tied to the input via for/id).
    var emailId = 'msc-' + Math.random().toString(36).slice(2, 8);
    var emailInput = el('input', { type: 'email', name: 'email', required: 'required', autocomplete: 'email', placeholder: CONSENT_COPY.emailPlaceholder, id: emailId });
    var emailField = el('div', { class: 'ms-chat-field' });
    var emailLbl = el('label', { text: CONSENT_COPY.emailLabel + ' *' });
    emailLbl.setAttribute('for', emailId);
    emailField.appendChild(emailLbl);
    emailField.appendChild(emailInput);
    form.appendChild(emailField);

    // Consent block — populated with the CANONICAL backend-served copy once it
    // resolves (loadConsent below). Nothing legal is hard-coded here.
    var consentArea = el('div', { class: 'ms-chat-consent-area' });
    form.appendChild(consentArea);

    var errEl = el('div', { class: 'ms-chat-form-error', style: 'display:none' });
    form.appendChild(errEl);

    var submit = el('button', { type: 'submit', class: 'ms-chat-btn ms-chat-btn--primary' }, [CONSENT_COPY.submit]);
    submit.disabled = true; // enabled only once the served consent copy is rendered
    form.appendChild(submit);
    body.appendChild(form);

    body.appendChild(el('div', { class: 'ms-chat-caption', text: CONSENT_COPY.privacy }));

    // Imprint/Privacy links next to the form (compliance requirement —
    // CONSENT_FLOW.md). Targets are backend-served; filled in renderConsent.
    var legalEl = el('div', { class: 'ms-chat-legal-links' });
    body.appendChild(legalEl);

    // Decline affordance (API_CONTRACT.md §2/§5): the backend cannot observe
    // a dismissal, so the widget reports it — ONE email_capture_declined KPI
    // event (trigger only; no email, no text), then the card collapses to a
    // short note. Removed automatically on submit success (body is replaced).
    var declineBtn = el('button', { type: 'button', class: 'ms-chat-capture-decline', text: CONSENT_COPY.decline });
    declineBtn.addEventListener('click', function () {
      track('email_capture_declined', opts.trigger ? { trigger: opts.trigger } : {});
      body.replaceChildren(head, el('div', { class: 'ms-chat-card-text', text: CONSENT_COPY.declined }));
      // Unblock the header entry point: a declined card must not be "reused".
      var row = card.closest ? card.closest('.ms-chat-row') : null;
      if (row && row === lastCaptureRow) lastCaptureRow = null;
    });
    body.appendChild(declineBtn);

    // Two SEPARATE consent controls. Each is a real <label> wrapping a real
    // <input type=checkbox> (keyboard-usable, clicking the text toggles it) with
    // the full consent text always visible (never truncated). v2: EVERY box
    // starts UNCHECKED — there is deliberately no way to construct a
    // pre-ticked row here.
    function consentRow(labelText) {
      var row = el('label', { class: 'ms-chat-consent' });
      var input = el('input', { type: 'checkbox' });
      row.appendChild(input);
      var text = el('span', { class: 'ms-chat-consent-text' }, [labelText]);
      row.appendChild(text);
      return { row: row, input: input };
    }

    // The backend-served copy currently rendered. Submitting is impossible
    // until this is set: `consentTextShown` must be the served audit string
    // verbatim (Art. 7 proof), so there is no client-side fallback text.
    var copy = null;
    var txn = null;
    var mkt = null;
    var consentGroup = null;
    var attnActive = false;

    // Unchecked-transactional attention treatment: accent outline + a brief
    // shake on the checkbox group (the shake is disabled via CSS under
    // prefers-reduced-motion) plus ONE inline hint line. No request is sent.
    // Cleared as soon as the user checks a box.
    function flagConsentAttention() {
      showError(CONSENT_COPY.errTransactional);
      attnActive = true;
      if (consentGroup) {
        consentGroup.classList.remove('ms-chat-consent-group--attn');
        void consentGroup.offsetWidth; // restart the shake on repeat clicks
        consentGroup.classList.add('ms-chat-consent-group--attn');
      }
      if (txn) { try { txn.input.focus(); } catch (e) {} }
    }
    function clearConsentAttention() {
      if (!attnActive) return;
      attnActive = false;
      if (consentGroup) consentGroup.classList.remove('ms-chat-consent-group--attn');
      clearError();
    }

    function renderConsent(c) {
      copy = c;
      consentArea.replaceChildren();
      // BOTH boxes start UNCHECKED (consent copy v2 — API_CONTRACT.md §2/§7.4;
      // the v1 allowance to pre-check the transactional box is revoked).
      // TRANSACTIONAL box: required to submit, but the user actively ticks it
      // — the submit button stays clickable and an unchecked submit triggers
      // the attention treatment instead of a request.
      txn = consentRow(c.transactionalLabel);
      // MARKETING box: PROMINENT (own accent-edged block) but ALWAYS
      // UNCHECKED and never auto-toggled by any other interaction.
      // DELIBERATE LEGAL DECISION — never pre-check this box: pre-ticked
      // marketing consent is invalid under the GDPR's clear-affirmative-act
      // requirement (CJEU C-673/17 "Planet49") and a German UWG Abmahnung
      // trigger. The opt-in is won through placement and copy, never through
      // a pre-tick. Do not "optimise" this.
      mkt = consentRow(c.marketingLabel);
      mkt.row.classList.add('ms-chat-consent--marketing');
      consentGroup = el('div', { class: 'ms-chat-consent-group' });
      consentGroup.appendChild(txn.row);
      consentGroup.appendChild(mkt.row);
      consentArea.appendChild(consentGroup);
      // Checking a box resolves the unchecked-transactional highlight.
      txn.input.addEventListener('change', function () { if (txn.input.checked) clearConsentAttention(); });
      mkt.input.addEventListener('change', function () { if (mkt.input.checked) clearConsentAttention(); });
      // Shared footer line beneath BOTH checkboxes (v2) — backend-served,
      // rendered verbatim (part of the consentTextShown audit text).
      if (typeof c.consentFooter === 'string' && c.consentFooter) {
        consentArea.appendChild(el('div', { class: 'ms-chat-consent-footer', text: c.consentFooter }));
      }
      // Returning-customer hint above the email field — backend-gated; an
      // absent field or enabled:false renders nothing.
      var rh = returningHintText(c);
      returnHintEl.textContent = rh || '';
      returnHintEl.style.display = rh ? '' : 'none';

      legalEl.replaceChildren();
      var impHref = safeHref(c.imprintUrl);
      var privHref = safeHref(c.privacyUrl);
      if (impHref) legalEl.appendChild(el('a', { href: impHref, target: '_blank', rel: 'noopener noreferrer', text: 'Impressum' }));
      if (privHref) legalEl.appendChild(el('a', { href: privHref, target: '_blank', rel: 'noopener noreferrer', text: 'Datenschutz' }));

      submit.disabled = false;
    }

    function loadConsent() {
      consentArea.replaceChildren(el('div', { class: 'ms-chat-consent-loading', text: CONSENT_COPY.loading }));
      fetchConsentCopy().then(renderConsent).catch(function () {
        // Without the served copy the form must not submit — offer a retry.
        consentArea.replaceChildren();
        consentArea.appendChild(el('div', { class: 'ms-chat-form-error', text: CONSENT_COPY.errCopyLoad }));
        var retry = el('button', { type: 'button', class: 'ms-chat-btn ms-chat-btn--secondary' }, [CONSENT_COPY.retry]);
        retry.addEventListener('click', loadConsent);
        consentArea.appendChild(retry);
      });
    }
    loadConsent();

    function showError(msg) { errEl.textContent = msg; errEl.style.display = 'block'; }
    function clearError() { errEl.textContent = ''; errEl.style.display = 'none'; }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      clearError();
      if (!copy || !txn || !mkt) return; // canonical copy not loaded -> cannot submit

      // Client-side validation before sending.
      var email = emailInput.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { showError(CONSENT_COPY.errEmail); try { emailInput.focus(); } catch (e) {} return; }
      // v2: the transactional box starts unchecked. An unchecked submit sends
      // NOTHING — it highlights the checkbox group with one inline hint.
      if (!txn.input.checked) { flagConsentAttention(); return; }

      var marketing = !!mkt.input.checked;
      var payload = {
        sessionId: sid,
        email: email,
        transactionalConsent: true,
        marketingConsent: marketing,
        // The backend's pre-composed audit string (labels + shared footer),
        // echoed back VERBATIM — byte-for-byte the text rendered above. Never
        // recomposed or hard-coded client-side (Art. 7 proof of consent).
        consentTextShown: copy.consentTextShown
      };
      // Echo of the offer's value moment (telemetry only — opt-in funnel split).
      if (opts.trigger) payload.trigger = opts.trigger;

      submit.disabled = true;
      submit.textContent = CONSENT_COPY.sending;
      // No widget-side "submitted" KPI event: email_capture_submitted is
      // recorded server-side by /api/capture-email (API_CONTRACT.md §5).

      fetch(API_BASE + '/api/capture-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ms-chat-key': CHAT_KEY, 'x-ms-session': sid },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (res.ok) {
          // Unlock returning-customer memory for the rest of this page's
          // session (in-memory only — see the capturedEmail privacy gate).
          capturedEmail = email;
          // Branch the success copy on the DOI state (API_CONTRACT.md §7.1):
          // only a pending marketing opt-in needs the "confirm the link" line.
          return res.json().catch(function () { return null; }).then(function (data) {
            var pending = !!(data && data.marketing && data.marketing.status === 'pending');
            var ok = el('div', { class: 'ms-chat-form-success' });
            ok.appendChild(icon('check'));
            ok.appendChild(el('h3', { text: CONSENT_COPY.successTitle }));
            ok.appendChild(el('p', { text: pending ? (CONSENT_COPY.success + ' ' + CONSENT_COPY.successPending) : CONSENT_COPY.success }));
            body.replaceChildren(head, ok);
            scrollToBottom();
          });
        }
        // Error: keep the form populated for retry.
        return res.json().catch(function () { return null; }).then(function (data) {
          var code = data && data.error && data.error.code;
          var msg = (data && data.error && data.error.message) || '';
          if (code === 'transactional_consent_required') {
            // Defensive: the widget already blocks an unchecked submit
            // client-side; if the backend still rejects (§7.1), surface the
            // same targeted checkbox attention instead of a generic error.
            submit.disabled = false;
            submit.textContent = CONSENT_COPY.submit;
            flagConsentAttention();
            return;
          }
          if (res.status === 429 || code === 'rate_limited') {
            // Honor Retry-After: keep submit locked for the window (mirrors
            // the chat path; same 30s default when the header is unreadable)
            // instead of allowing an instant re-submission.
            var retry = parseInt(res.headers.get('Retry-After'), 10);
            if (!isFinite(retry) || retry <= 0) retry = 30;
            showError(CONSENT_COPY.errRate);
            submit.textContent = CONSENT_COPY.submit;
            setTimeout(function () { submit.disabled = false; }, retry * 1000);
            return;
          }
          if (res.status === 502 || res.status === 503 || code === 'upstream_unavailable') {
            msg = CONSENT_COPY.errUpstream;
          } else if (!msg) {
            msg = CONSENT_COPY.errGeneric;
          }
          showError(msg);
          submit.disabled = false;
          submit.textContent = CONSENT_COPY.submit;
        });
      }).catch(function () {
        showError(CONSENT_COPY.errUpstream);
        submit.disabled = false;
        submit.textContent = CONSENT_COPY.submit;
      });
    });

    card.appendChild(body);
    return card;
  }

  function buildToolCard(name, input) {
    switch (name) {
      case 'show_product': return buildShowProduct(input);
      case 'compare_products': return buildCompare(input);
      case 'add_to_cart': return buildAddToCart(input);
      case 'suggest_showroom': return buildShowroom(input);
      case 'show_contact_form': return buildContactForm(input);
      case 'offer_email_summary':
        // Signed-in (tier 3): the email comes from the account, so never show
        // the "type your email" capture (task §5 — no double-ask). The backend
        // normally won't emit this for a signed-in customer; suppress defensively.
        if (auth.signedIn) return Promise.resolve(null);
        return Promise.resolve(buildCaptureCard({ message: input.message, productIds: input.productIds, trigger: input.trigger }));
      default: return Promise.resolve(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Widget shell.
  // ---------------------------------------------------------------------------
  var root, launcher, panel, backdrop, modeBtn, shareBtn, downloadBtn, messagesEl, textarea, sendBtn, micBtn, vmBtn, speakingBtn, noticeEl, welcomeEl;
  // Customer Account tier-3 chrome (built in buildShell / buildWelcome).
  var signInBtn, historyBtn, historyEl, historyListEl, historyTitleEl, welcomeGreetingEl, welcomeAuthEl;
  // Desktop layout mode, persisted across page loads. 'sidebar' = docked
  // right-edge sidebar (page makes room, site stays interactive); 'modal' =
  // centered near-fullscreen modal over the blurred backdrop. Mobile ignores
  // this entirely (true fullscreen, see the ≤640px CSS + syncMobileViewport).
  var VIEW_MODE_KEY = 'ms-chat-view-mode';
  function loadViewMode() {
    var v = lsGet(VIEW_MODE_KEY);
    if (v === 'sidebar' || v === 'modal') return v;
    // Migration: the old enlarged state was the focused/large layout, which
    // maps to the modal; everyone else starts in the default sidebar.
    return lsGet('ms-chat-expanded') === '1' ? 'modal' : 'sidebar';
  }
  var state = { open: false, streaming: false, rateLocked: false, viewMode: loadViewMode() };
  var typingEl = null;
  var rateTimer = null;

  // Desktop/mobile branch point — matches the CSS breakpoint (641px). All
  // desktop-mode side effects (page shift, backdrop) and all mobile side
  // effects (scroll lock, visual-viewport sizing) are gated on this so the
  // two parts can never bleed into each other.
  var desktopMq = window.matchMedia ? window.matchMedia('(min-width: 641px)') : null;
  function isDesktop() { return desktopMq ? desktopMq.matches : true; }

  function buildShell() {
    root = el('div', { class: 'ms-chat-root' });

    launcher = el('button', { class: 'ms-chat-launcher', type: 'button', 'aria-label': 'Chat öffnen (Beta)' });
    launcher.appendChild(logoEl('ms-chat-launcher-logo'));
    // Feature 10: subtle "Beta" badge on the launcher (decorative; the
    // aria-label above carries it for screen readers).
    launcher.appendChild(el('span', { class: 'ms-chat-beta', text: 'Beta', 'aria-hidden': 'true' }));
    launcher.addEventListener('click', togglePanel);

    backdrop = el('div', { class: 'ms-chat-backdrop', 'aria-hidden': 'true' });
    backdrop.addEventListener('click', closePanel);

    panel = el('div', { class: 'ms-chat-panel', role: 'dialog', 'aria-label': 'AI Fitnessberater', 'aria-modal': 'false' });

    var header = el('div', { class: 'ms-chat-header' });
    // Feature 11: the header shows the chatbot's name "Mo" (same wordmark
    // type treatment; the welcome state shows the animated brand orb).
    var headerTitle = el('span', { class: 'ms-chat-wordmark' });
    headerTitle.appendChild(el('b', { text: 'Mo' }));
    header.appendChild(headerTitle);
    var actions = el('div', { class: 'ms-chat-header-actions' });
    // Feature 7: "Per E-Mail teilen" text button (replaces the share icon).
    // Same action as before — opens the email-capture form (same form the
    // assistant's offer_email_summary tool renders inline). Hidden in a fresh
    // conversation; updateShareBtn() reveals it once the first user message is
    // sent (or a history with messages is restored).
    shareBtn = el('button', { class: 'ms-chat-share', type: 'button', text: 'Per E-Mail teilen', 'aria-label': 'Zusammenfassung per E-Mail teilen', title: 'Zusammenfassung per E-Mail' });
    shareBtn.addEventListener('click', function () { openCaptureForm(); });
    actions.appendChild(shareBtn);
    // Signed-in (tier 3): download the branded HTML summary of the ACTIVE thread
    // (CUSTOMER_ACCOUNT.md §8) — replaces the email-share path that's suppressed
    // for signed-in customers. Same quiet-pill chrome as the share button;
    // updateDownloadBtn() reveals it once a downloadable thread exists.
    downloadBtn = el('button', { class: 'ms-chat-download', type: 'button', 'aria-label': 'Zusammenfassung herunterladen', title: 'Zusammenfassung herunterladen' });
    downloadBtn.appendChild(icon('download'));
    downloadBtn.appendChild(el('span', { text: 'Zusammenfassung' }));
    downloadBtn.addEventListener('click', downloadSummary);
    actions.appendChild(downloadBtn);
    // Customer Account (tier 3): "Anmelden" pill (shown only when settled +
    // not signed in) and the conversation-history button (shown only when
    // signed in). Both hidden by default; reflectAuthState() toggles them.
    signInBtn = el('button', { class: 'ms-chat-signin-btn', type: 'button', text: ACCOUNT_COPY.signInHeader, 'aria-label': 'Mit Konto anmelden' });
    signInBtn.addEventListener('click', function () { openSignInCard(); });
    actions.appendChild(signInBtn);
    historyBtn = el('button', { class: 'ms-chat-iconbtn ms-chat-history-btn', type: 'button', 'aria-label': ACCOUNT_COPY.historyAria, title: ACCOUNT_COPY.historyAria });
    historyBtn.appendChild(icon('history'));
    historyBtn.addEventListener('click', openHistory);
    actions.appendChild(historyBtn);
    // Feature 6 (reworked): desktop layout-mode toggle, sidebar ⇄ modal.
    // Hidden on mobile via CSS (.ms-chat-mode); icon/labels set by
    // applyViewMode().
    modeBtn = el('button', { class: 'ms-chat-iconbtn ms-chat-mode', type: 'button' });
    modeBtn.addEventListener('click', toggleViewMode);
    actions.appendChild(modeBtn);
    var newBtn = el('button', { class: 'ms-chat-iconbtn', type: 'button', 'aria-label': 'Neuen Chat starten', title: 'Neuen Chat starten' });
    newBtn.appendChild(icon('refresh'));
    newBtn.addEventListener('click', function () { startNewChat(); });
    var closeBtn = el('button', { class: 'ms-chat-iconbtn', type: 'button', 'aria-label': 'Chat schließen' });
    closeBtn.appendChild(icon('close'));
    closeBtn.addEventListener('click', closePanel);
    actions.appendChild(newBtn);
    actions.appendChild(closeBtn);
    header.appendChild(actions);
    panel.appendChild(header);

    messagesEl = el('div', { class: 'ms-chat-messages' });
    panel.appendChild(messagesEl);

    var inputbar = el('div', { class: 'ms-chat-inputbar' });
    noticeEl = el('div', { style: 'display:none' });
    inputbar.appendChild(noticeEl);

    // Unified composer: textarea (top, borderless) + control row (bottom,
    // right-aligned mic + send) inside ONE bordered rounded surface.
    var composer = el('div', { class: 'ms-chat-composer' });
    textarea = el('textarea', { class: 'ms-chat-textarea', rows: '1', placeholder: 'Wie kann ich dir helfen?', 'aria-label': 'Nachricht' });
    textarea.addEventListener('input', autoGrow);
    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
    });
    composer.appendChild(textarea);
    var controls = el('div', { class: 'ms-chat-input-controls' });
    sendBtn = el('button', { class: 'ms-chat-send ms-chat-send--hidden', type: 'button', 'aria-label': 'Senden' });
    sendBtn.appendChild(icon('send'));
    sendBtn.addEventListener('click', onSend);
    // Voice input: only render the mic button when the browser supports the Web
    // Speech API (Chrome/Edge/Android). On unsupported browsers (Firefox, some
    // iOS) it's simply absent — typed input is unaffected.
    if (voiceSupported()) {
      micBtn = el('button', { class: 'ms-chat-mic', type: 'button', 'aria-label': 'Spracheingabe starten', 'aria-pressed': 'false', title: 'Spracheingabe' });
      micBtn.appendChild(icon('mic'));
      micBtn.addEventListener('click', toggleVoice);
      controls.appendChild(micBtn);
      // Voice mode (hands-free conversation loop) toggle — NEXT TO the dictate
      // mic, gated on the same recognition capability check. The dictate mic
      // above is unchanged.
      vmBtn = el('button', { class: 'ms-chat-voicemode', type: 'button', 'aria-label': 'Sprachmodus', 'aria-pressed': 'false', title: 'Sprachmodus' });
      vmBtn.appendChild(icon('waveform'));
      vmBtn.addEventListener('click', toggleVoiceMode);
      controls.appendChild(vmBtn);
      // Speaking indicator — shown only while a reply is being read aloud;
      // tapping it stops playback immediately and resumes listening.
      speakingBtn = el('button', { class: 'ms-chat-speaking', type: 'button', 'aria-label': 'Sprachausgabe stoppen', title: 'Sprachausgabe stoppen', style: 'display:none' });
      speakingBtn.appendChild(icon('speaking'));
      speakingBtn.addEventListener('click', function () {
        if (!isSpeaking) return;
        endSpeaking();
        if (voiceMode) restartVoiceLoop();
      });
      controls.appendChild(speakingBtn);
    }
    controls.appendChild(sendBtn);
    composer.appendChild(controls);
    // The whole surface reads as the input — clicking its padding (not the
    // buttons) focuses the textarea.
    composer.addEventListener('click', function (e) {
      if (e.target === composer || e.target === controls) { try { textarea.focus(); } catch (err) {} }
    });
    inputbar.appendChild(composer);
    inputbar.appendChild(el('div', { class: 'ms-chat-disclaimer', text: 'KI-Fitnessberater – Antworten können Fehler enthalten' }));
    panel.appendChild(inputbar);

    welcomeEl = buildWelcome();

    // Signed-in conversation-history drawer (overlays the panel; inert until a
    // signed-in customer opens it).
    buildHistoryDrawer();

    root.appendChild(launcher);
    root.appendChild(backdrop);
    root.appendChild(panel);
    document.body.appendChild(root);

    applyViewMode();

    // Mobile keyboard handling: the visual viewport shrinks/scrolls when the
    // on-screen keyboard opens — re-pin the panel to the visible area so the
    // input stays just above the keyboard (no-ops while closed / on desktop).
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', syncMobileViewport);
      window.visualViewport.addEventListener('scroll', syncMobileViewport);
    }
    // Crossing the desktop/mobile breakpoint while open: re-sync the page
    // shift, backdrop and scroll lock for the new branch.
    if (desktopMq) {
      if (desktopMq.addEventListener) desktopMq.addEventListener('change', syncChrome);
      else if (desktopMq.addListener) desktopMq.addListener(syncChrome);
    }
    // Voice mode is hands-free and audible — auto-disable it when the tab is
    // backgrounded so it never keeps the mic open / speaks off-screen.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && voiceMode) disableVoiceMode();
    });
  }

  // Feature 7: the share button is hidden until the conversation has at least
  // one message; once shown it stays for the rest of the conversation (the CSS
  // animates the reveal). Re-evaluated on send, restore, new chat and rollback.
  function updateShareBtn() {
    if (!shareBtn) return;
    // Signed-in customers never see the "type your email" capture entry point —
    // their email comes from the account (task §5). Anonymous/email-only keep
    // the exact previous behaviour (auth.signedIn is always false for them).
    shareBtn.classList.toggle('ms-chat-share--visible', messages.length > 0 && !auth.signedIn);
    updateDownloadBtn();
  }

  // The signed-in download button (task §2): shown only once signed in AND the
  // active thread is addressable (a conversationKey + at least one turn), so we
  // never offer a download that the summary endpoint would 404. Hidden entirely
  // for anonymous / email-only — keeping their header byte-identical.
  function updateDownloadBtn() {
    if (!downloadBtn) return;
    var canDownload = !!(auth.signedIn && activeConversationKey && messages.length > 0);
    downloadBtn.classList.toggle('ms-chat-download--visible', canDownload);
  }

  // Keep exactly one desktop mode class on the panel and the toggle button's
  // icon/labels in sync (the icon shows the TARGET mode, so it reads as a
  // layout switch, not a zoom).
  function applyViewMode() {
    if (!panel) return;
    panel.classList.toggle('ms-chat-panel--sidebar', state.viewMode === 'sidebar');
    panel.classList.toggle('ms-chat-panel--modal', state.viewMode === 'modal');
    panel.setAttribute('aria-modal', state.viewMode === 'modal' ? 'true' : 'false');
    if (modeBtn) {
      var toModal = state.viewMode === 'sidebar';
      modeBtn.replaceChildren(icon(toModal ? 'modal' : 'sidebar'));
      modeBtn.title = toModal ? 'Als zentriertes Fenster öffnen' : 'Als Seitenleiste andocken';
      modeBtn.setAttribute('aria-label', modeBtn.title);
    }
    syncChrome();
  }

  function toggleViewMode() {
    // The relayout changes the message area's width AND height — preserve the
    // reading position by keeping the distance from the bottom constant.
    var fromBottom = messagesEl
      ? (messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight)
      : 0;
    state.viewMode = state.viewMode === 'sidebar' ? 'modal' : 'sidebar';
    lsSet(VIEW_MODE_KEY, state.viewMode);
    applyViewMode();
    requestAnimationFrame(function () {
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight - messagesEl.clientHeight - fromBottom;
    });
  }

  // Everything OUTSIDE the panel that depends on open-state + mode + viewport:
  // the modal backdrop, the desktop page shift, the mobile scroll lock and the
  // mobile visual-viewport sizing. Single place, so open/close/toggle/resize
  // can never leave a stray backdrop, offset or lock behind.
  function syncChrome() {
    var desktop = isDesktop();
    if (backdrop) backdrop.classList.toggle('ms-chat-backdrop--open', state.open && desktop && state.viewMode === 'modal');
    setPageShift(state.open && desktop && state.viewMode === 'sidebar');
    document.documentElement.classList.toggle('ms-chat-mobile-open', state.open && !desktop);
    syncMobileViewport();
  }

  // Desktop sidebar "make room": margin-right on <html> reflows the storefront
  // next to the docked panel. The -anim class only lives around the change so
  // the page never keeps a permanent transition (or offset) once closed.
  var pageShiftTimer = null;
  function setPageShift(on) {
    var de = document.documentElement;
    if (de.classList.contains('ms-chat-page-shift') === on) return;
    de.classList.add('ms-chat-page-anim');
    de.classList.toggle('ms-chat-page-shift', on);
    if (pageShiftTimer) clearTimeout(pageShiftTimer);
    pageShiftTimer = setTimeout(function () { de.classList.remove('ms-chat-page-anim'); pageShiftTimer = null; }, 420);
  }

  // Mobile keyboard handling: size the OPEN panel to the visual viewport so
  // the input row sits just above the on-screen keyboard and the message list
  // shrinks to fit. translateY(offsetTop) re-pins the fixed panel when iOS
  // scrolls the layout viewport to reveal the focused input. On desktop (or
  // closed) all inline styles are cleared so the CSS modes rule alone.
  function syncMobileViewport() {
    if (!panel) return;
    var vv = window.visualViewport;
    if (state.open && !isDesktop() && vv) {
      var pinned = messagesEl && (messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight) < 120;
      panel.style.height = Math.round(vv.height) + 'px';
      panel.style.transform = 'translateY(' + Math.round(vv.offsetTop) + 'px)';
      // Keyboard opening shrinks the list — keep the latest message + input
      // in view if the user was already reading the bottom.
      if (pinned && messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    } else {
      panel.style.height = '';
      panel.style.transform = '';
    }
  }

  // Context-seeded starter prompts for the welcome state. Seeding order:
  // current/last product -> current category or a trail category streak ->
  // strong general starters. Copy is page/category-referencing (tone rule),
  // grammar-safe for any product/category name, and NEVER asks for an email —
  // a starter's only job is to start the conversation.
  var starterMeta = null; // { variant, count, tracked } — for the starter_shown KPI
  function starterSeed() {
    var trail = loadTrail();
    var prod = null;
    if (PAGE_CTX.type === 'product' && PAGE_CTX.productName) {
      prod = { id: PAGE_CTX.productHandle || PAGE_CTX.productId || '', name: PAGE_CTX.productName };
    } else {
      for (var i = 0; i < trail.length; i++) {
        if (trail[i].type === 'product' && trail[i].name) { prod = { id: trail[i].id, name: trail[i].name }; break; }
      }
    }
    if (prod) {
      // Same context shape the product-page CTA (openWithProduct) sends,
      // plus the browsing trail (API_CONTRACT.md §2 allows recentlyViewed on
      // a "product" context too — it becomes background knowledge).
      var pctx = { type: 'product', productId: prod.id, productTitle: prod.name };
      var prv = recentlyViewedPayload();
      if (prv) pctx.recentlyViewed = prv;
      return { variant: 'product', items: [
        { text: 'Ist „' + prod.name + '“ gut für Zuhause geeignet?', context: pctx },
        { text: 'Gibt es eine günstigere Alternative zu „' + prod.name + '“?', context: pctx },
        { text: 'Wie groß und wie laut ist „' + prod.name + '“?', context: pctx }
      ] };
    }
    var cat = (PAGE_CTX.type === 'collection' && PAGE_CTX.category) ? PAGE_CTX.category : trailCategoryStreak(trail);
    if (!cat) {
      for (var j = 0; j < trail.length; j++) {
        if (trail[j].type === 'collection' && trail[j].name) { cat = trail[j].name; break; }
      }
    }
    if (cat) {
      // A bare `type: "category"` context does not exist in the contract —
      // the whole context would be ignored. Category starters ride on a
      // `type: "browsing"` context with the category leading recentlyViewed.
      var cctx = browsingContext(cat);
      return { variant: 'category', items: [
        { text: 'Worauf sollte ich bei „' + cat + '“ achten?', context: cctx },
        { text: 'Hilf mir, das richtige Modell aus „' + cat + '“ zu finden.', context: cctx },
        { text: 'Was sind eure Bestseller bei „' + cat + '“?', context: cctx }
      ] };
    }
    return { variant: 'generic', items: [
      { text: 'Hilf mir, das richtige Trainingsgerät zu finden.', context: null },
      { text: 'Was sind eure Bestseller?', context: null },
      { text: 'Ich trainiere zuhause — was empfiehlst du mir?', context: null }
    ] };
  }

  // Welcome state: the animated brand orb is the hero (an empty chat has
  // nothing to read, so full motion is fine here — reduced-motion still
  // freezes it via CSS). The prompt line lives in the composer placeholder
  // ("Wie kann ich dir helfen?"); beneath the orb, 2-3 TAPPABLE context-seeded
  // starters (deliberately supersedes the earlier "no copy at all" rule —
  // WIDGET_SPEC §9c). Tapping one sends it as the first user message,
  // carrying the same context shape openWithProduct already sends.
  function buildWelcome() {
    var w = el('div', { class: 'ms-chat-welcome' });
    w.appendChild(logoEl('ms-chat-welcome-logo'));
    // Signed-in greeting by name (filled/toggled by updateWelcomeAuth); hidden
    // for anonymous so the welcome stays byte-identical when no one signs in.
    welcomeGreetingEl = el('div', { class: 'ms-chat-welcome-greeting', style: 'display:none' });
    w.appendChild(welcomeGreetingEl);
    var seed = starterSeed();
    starterMeta = { variant: seed.variant, count: seed.items.length, tracked: false };
    var list = el('div', { class: 'ms-chat-starters' });
    seed.items.forEach(function (item, idx) {
      var b = el('button', { class: 'ms-chat-starter', type: 'button', text: item.text });
      b.addEventListener('click', function () {
        if (state.streaming || state.rateLocked) return;
        track('starter_clicked', { variant: seed.variant, index: idx });
        sendMessage(item.text, item.context);
      });
      list.appendChild(b);
    });
    w.appendChild(list);
    // Sign-in benefits card slot (filled by updateWelcomeAuth when the auth
    // state settles as not-signed-in; empty otherwise).
    welcomeAuthEl = el('div', { class: 'ms-chat-welcome-auth' });
    w.appendChild(welcomeAuthEl);
    return w;
  }

  // Auto-grow up to the cap (must match the CSS max-height), then the textarea
  // scrolls internally — the composer/panel never grow past it. Also the single
  // sync point for the appear-on-type send button: every path that changes the
  // input's value (typing, voice dictation, send-clear, error-restore) already
  // calls autoGrow().
  function autoGrow() {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    if (sendBtn) sendBtn.classList.toggle('ms-chat-send--hidden', !textarea.value.trim());
  }

  function togglePanel() { state.open ? closePanel() : openPanel(); }
  function openPanel() {
    if (state.open) return;
    state.open = true;
    // Engagement layer: an opened chat ends the nudge's eligibility for this
    // session, and a visible welcome state means the starters are shown.
    ssSet(SS_CHAT_OPENED, '1');
    removeNudge();
    if (starterMeta && !starterMeta.tracked && welcomeEl && welcomeEl.parentNode === messagesEl) {
      starterMeta.tracked = true;
      track('starter_shown', { variant: starterMeta.variant, count: starterMeta.count });
    }
    // Customer Account: resolve signed-in state on first open (lazy — no
    // network for pure-anonymous visitors; see resolveAuthOnOpen). Arm the
    // history auto-surface (task §1); it flushes once auth has settled (now if
    // already settled, else when the probe resolves via applyAuth).
    autoHistoryArmed = true;
    resolveAuthOnOpen();
    flushAutoHistory();
    panel.classList.add('ms-chat-panel--open');
    launcher.classList.add('ms-chat-launcher--hidden');
    syncChrome(); // backdrop (modal) / page shift (sidebar) / mobile lock+size
    // Re-measure the textarea now that the panel is visible — the init-time
    // autoGrow() ran on a hidden panel (scrollHeight 0), which left the field
    // mis-sized (internally overflowing) on first open.
    autoGrow();
    scrollToBottom();
    setTimeout(function () { try { textarea.focus(); } catch (e) {} }, 50);
    track('chat_opened', {});
  }
  function closePanel() {
    if (!state.open) return;
    state.open = false;
    if (voiceMode) disableVoiceMode(); // stop playback + mic, return to normal
    panel.classList.remove('ms-chat-panel--open');
    launcher.classList.remove('ms-chat-launcher--hidden');
    syncChrome(); // restores the page: no leftover offset, backdrop or lock
    track('chat_closed', {});
  }

  function scrollToBottom() {
    requestAnimationFrame(function () { messagesEl.scrollTop = messagesEl.scrollHeight; });
  }

  function updateInputState() {
    var disabled = state.streaming || state.rateLocked;
    if (textarea) textarea.disabled = disabled;
    if (sendBtn) sendBtn.disabled = disabled;
    if (micBtn) micBtn.disabled = disabled;
    if (disabled) stopVoice();
  }

  // ---------------------------------------------------------------------------
  // Voice input (Web Speech API). Dictates into the textarea in German; the
  // mic button is only created when the API exists (see buildShell). Audio is
  // handled by the browser's own speech service — no audio touches our backend.
  // ---------------------------------------------------------------------------
  var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recognition = null;
  var recognizing = false;

  // Voice mode (hands-free conversation loop) state. ALL additive: while
  // voiceMode stays false every branch below is skipped and dictation behaves
  // exactly as before.
  var voiceMode = false;        // the loop is active
  var ttsAudio = null;          // reused <audio>, unlocked on the enabling gesture
  var isSpeaking = false;       // a reply is currently being read aloud
  var ttsBackoffUntil = 0;      // epoch ms; while in the future, skip /api/tts (429 Retry-After)
  var ttsHintShown = false;     // "Sprachausgabe nicht verfügbar" shown once
  var voiceRestartTimer = null; // debounce for re-arming the mic
  var currentBlobUrl = null;    // object URL of the playing MP3 (revoked on stop)
  var speakSeq = 0;             // guards async TTS callbacks against a newer reply

  function voiceSupported() { return !!SpeechRec; }

  function setMicState(on) {
    recognizing = on;
    if (!micBtn) return;
    micBtn.classList.toggle('ms-chat-mic--recording', on);
    micBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    micBtn.setAttribute('aria-label', on ? 'Spracheingabe beenden' : 'Spracheingabe starten');
    micBtn.title = on ? 'Spracheingabe beenden' : 'Spracheingabe';
  }

  function stopVoice() {
    if (recognition && recognizing) { try { recognition.stop(); } catch (e) {} }
  }

  function startVoice() {
    if (!SpeechRec || recognizing) return;
    if (state.streaming || state.rateLocked) return;
    recognition = new SpeechRec();
    recognition.lang = 'de-DE';
    recognition.interimResults = true;
    recognition.continuous = false;
    // Dictate-once appends to whatever is already typed; voice mode listens
    // fresh (and never clobbers the textarea, so the user can still type).
    var base = voiceMode ? '' : (textarea.value.trim() ? textarea.value.trim() + ' ' : '');
    var finalT = '';
    recognition.onresult = function (e) {
      var interim = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var seg = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalT += seg;
        else interim += seg;
      }
      if (!voiceMode) {
        textarea.value = base + finalT + interim;
        autoGrow();
      }
    };
    recognition.onerror = function (e) {
      setMicState(false);
      if (e && (e.error === 'not-allowed' || e.error === 'service-not-allowed')) {
        showNotice('warn', 'Mikrofonzugriff wurde blockiert. Bitte erlaube ihn in den Browser-Einstellungen.');
        if (voiceMode) disableVoiceMode(); // can't run the loop without the mic
      }
    };
    recognition.onend = function () {
      setMicState(false);
      if (voiceMode) {
        // Recognition end / final result -> send the transcript via the normal
        // send path. Silence (no transcript) just re-arms the mic to keep the
        // hands-free loop alive.
        var said = finalT.trim();
        if (said) voiceSubmit(said);
        else restartVoiceLoop();
        return;
      }
      try { textarea.focus(); } catch (e) {}
    };
    try {
      recognition.start();
      setMicState(true);
      clearNotice();
    } catch (e) {
      setMicState(false);
      if (voiceMode) restartVoiceLoop();
    }
  }

  function toggleVoice() {
    if (recognizing) stopVoice();
    else startVoice();
  }

  // ---------------------------------------------------------------------------
  // Voice mode — hands-free conversation loop. Reuses the recognition above and
  // the existing send path; adds TTS playback of the completed reply. The loop:
  //   listen -> send final transcript -> on stream complete, speak the reply's
  //   plain text (markdown stripped; tool cards never read) -> on playback end,
  //   listen again. Toggling off, closing the panel, or the tab going hidden
  //   all stop it (handled elsewhere).
  //
  // iOS AUTOPLAY: programmatic audio is only allowed once unlocked by a user
  // gesture. The <audio> element is created AND played (a tiny silent clip)
  // inside the toggle's click handler (enableVoiceMode -> unlockAudio), then
  // reused for every later reply — so playback fired when a stream completes
  // (not itself a gesture) is permitted. This is the real iOS risk; without it
  // the first reply would be silently blocked.
  // ---------------------------------------------------------------------------

  // Minimal valid silent WAV built in code (so no opaque base64 blob is
  // shipped) — used ONLY to unlock the <audio> element on the enabling gesture.
  function silentWavUrl() {
    try {
      var len = 8, buf = new ArrayBuffer(44 + len), dv = new DataView(buf);
      function s(o, str) { for (var i = 0; i < str.length; i++) dv.setUint8(o + i, str.charCodeAt(i)); }
      s(0, 'RIFF'); dv.setUint32(4, 36 + len, true); s(8, 'WAVE');
      s(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
      dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
      s(36, 'data'); dv.setUint32(40, len, true);
      for (var i = 0; i < len; i++) dv.setUint8(44 + i, 128); // 8-bit silence
      var bytes = new Uint8Array(buf), bin = '';
      for (var j = 0; j < bytes.length; j++) bin += String.fromCharCode(bytes[j]);
      return 'data:audio/wav;base64,' + btoa(bin);
    } catch (e) { return ''; }
  }

  function unlockAudio() {
    try {
      if (!ttsAudio) {
        ttsAudio = new Audio();
        ttsAudio.preload = 'auto';
        ttsAudio.addEventListener('ended', onPlaybackEnded);
      }
      var u = silentWavUrl();
      if (!u) return;
      ttsAudio.src = u;
      var p = ttsAudio.play();
      if (p && p.then) p.then(function () { try { ttsAudio.pause(); ttsAudio.currentTime = 0; } catch (e) {} }).catch(function () {});
    } catch (e) {}
  }

  function setVmState(on) {
    if (!vmBtn) return;
    vmBtn.classList.toggle('ms-chat-voicemode--on', on);
    vmBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    vmBtn.setAttribute('aria-label', on ? 'Sprachmodus beenden' : 'Sprachmodus');
    vmBtn.title = 'Sprachmodus';
  }

  function toggleVoiceMode() {
    if (voiceMode) disableVoiceMode();
    else enableVoiceMode();
  }

  function enableVoiceMode() {
    if (voiceMode) return;
    voiceMode = true;
    unlockAudio(); // MUST run inside this click gesture (iOS autoplay unlock)
    setVmState(true);
    ttsHintShown = false;
    track('voice_mode_on', {}); // fail-silent KPI, no transcript content
    clearNotice();
    if (!state.streaming && !state.rateLocked && !isSpeaking) startVoice();
  }

  function disableVoiceMode() {
    if (!voiceMode) return;
    voiceMode = false;
    setVmState(false);
    if (voiceRestartTimer) { clearTimeout(voiceRestartTimer); voiceRestartTimer = null; }
    endSpeaking(); // stop any playback
    stopVoice();   // stop the mic
    track('voice_mode_off', {});
  }

  // Re-arm the mic after a small debounce, gated so it never fights streaming,
  // rate locks, an in-flight reply, or a closed panel.
  function restartVoiceLoop() {
    if (!voiceMode) return;
    if (voiceRestartTimer) clearTimeout(voiceRestartTimer);
    voiceRestartTimer = setTimeout(function () {
      voiceRestartTimer = null;
      if (voiceMode && !recognizing && !isSpeaking && !state.streaming && !state.rateLocked && state.open) startVoice();
    }, 350);
  }

  // Send a spoken transcript through the SAME path a typed message uses.
  function voiceSubmit(text) {
    if (state.streaming || state.rateLocked || !text) return;
    endSpeaking();          // a new turn supersedes any current playback
    sendMessage(text);
  }

  function showSpeakingIndicator() {
    if (!speakingBtn) return;
    speakingBtn.style.display = '';
    speakingBtn.classList.add('ms-chat-speaking--on');
  }
  function hideSpeakingIndicator() {
    if (!speakingBtn) return;
    speakingBtn.style.display = 'none';
    speakingBtn.classList.remove('ms-chat-speaking--on');
  }

  function startSpeaking() { isSpeaking = true; showSpeakingIndicator(); }

  // Stop playback (MP3 or speechSynthesis) and tidy up — does NOT re-arm the
  // mic on its own (callers decide whether the loop continues).
  function endSpeaking() {
    isSpeaking = false;
    hideSpeakingIndicator();
    try { if (ttsAudio) ttsAudio.pause(); } catch (e) {}
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    if (currentBlobUrl) { try { URL.revokeObjectURL(currentBlobUrl); } catch (e) {} currentBlobUrl = null; }
  }

  // Natural end of playback -> resume listening (the loop).
  function onPlaybackEnded() {
    if (!isSpeaking) return;
    endSpeaking();
    if (voiceMode) restartVoiceLoop();
  }

  // After Mo's reply stream completes: speak the plain text, or just re-listen.
  function voiceAfterReply(parts, errored) {
    if (!voiceMode) return;
    if (errored) { restartVoiceLoop(); return; }
    var speech = plainTextFromParts(parts);
    if (speech) speakReply(speech);
    else restartVoiceLoop();
  }

  // Assistant message -> spoken text: text parts only (tool cards are NEVER
  // read aloud), with the markdown subset stripped.
  function plainTextFromParts(parts) {
    var out = '';
    parts = parts || [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] && parts[i].type === 'text') out += parts[i].text || '';
    }
    return stripMarkdownForSpeech(out);
  }

  function stripMarkdownForSpeech(s) {
    s = String(s == null ? '' : s);
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1'); // [label](url) -> label
    s = s.replace(/\*\*([^*]+)\*\*/g, '$1');          // **bold** -> bold
    s = s.replace(/\*([^*]+)\*/g, '$1');              // *italic* -> italic
    s = s.replace(/[*_`#>]/g, '');                    // stray markdown artifacts
    return s.replace(/\s+/g, ' ').trim();
  }

  function pickGermanVoice(synth) {
    try {
      var vs = synth.getVoices() || [];
      for (var i = 0; i < vs.length; i++) {
        if (vs[i] && vs[i].lang && String(vs[i].lang).toLowerCase().indexOf('de') === 0) return vs[i];
      }
    } catch (e) {}
    return null;
  }

  // POST /api/tts (standard auth headers) and play the MP3. On any non-2xx
  // (incl. 502 upstream_unavailable, the documented "use the local voice"
  // signal) or a play failure -> browser speechSynthesis fallback. 429 records
  // a Retry-After backoff so we stop hitting the endpoint for the window and go
  // straight to the local voice meanwhile.
  function speakReply(text) {
    var seq = ++speakSeq;
    startSpeaking();
    if (Date.now() < ttsBackoffUntil) { speakViaSynthesis(text, seq); return; }
    fetch(API_BASE + '/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ms-chat-key': CHAT_KEY, 'x-ms-session': sid },
      body: JSON.stringify({ text: text })
    }).then(function (res) {
      if (seq !== speakSeq || !voiceMode || !isSpeaking) return; // superseded / cancelled
      if (!res.ok) {
        if (res.status === 429) {
          var ra = parseInt(res.headers.get('Retry-After'), 10);
          if (!isFinite(ra) || ra <= 0) ra = 300; // tts bucket window
          ttsBackoffUntil = Date.now() + ra * 1000;
        }
        speakViaSynthesis(text, seq);
        return;
      }
      return res.blob().then(function (blob) {
        if (seq !== speakSeq || !voiceMode || !isSpeaking) return;
        playBlob(blob, text, seq);
      });
    }).catch(function () {
      if (seq === speakSeq && isSpeaking) speakViaSynthesis(text, seq);
    });
  }

  function playBlob(blob, text, seq) {
    try {
      if (currentBlobUrl) { try { URL.revokeObjectURL(currentBlobUrl); } catch (e) {} }
      currentBlobUrl = URL.createObjectURL(blob);
      ttsAudio.src = currentBlobUrl;
      var p = ttsAudio.play();
      if (p && p.then) {
        p.then(function () { if (seq === speakSeq) track('voice_reply_played', {}); })
         .catch(function () { if (seq === speakSeq && isSpeaking) speakViaSynthesis(text, seq); });
      } else {
        track('voice_reply_played', {});
      }
    } catch (e) {
      if (seq === speakSeq && isSpeaking) speakViaSynthesis(text, seq);
    }
  }

  function speakViaSynthesis(text, seq) {
    try {
      var synth = window.speechSynthesis;
      if (!synth || typeof window.SpeechSynthesisUtterance === 'undefined') { ttsUnavailable(); return; }
      var u = new window.SpeechSynthesisUtterance(text);
      u.lang = 'de-DE';
      var v = pickGermanVoice(synth);
      if (v) u.voice = v;
      u.onstart = function () { if (seq === speakSeq) track('voice_reply_played', {}); };
      u.onend = function () { if (seq === speakSeq) onPlaybackEnded(); };
      u.onerror = function () { if (seq === speakSeq) onPlaybackEnded(); };
      synth.cancel();
      synth.speak(u);
    } catch (e) { ttsUnavailable(); }
  }

  // Neither remote TTS nor local speech worked: show a small hint once, keep
  // the mic loop running (input-only).
  function ttsUnavailable() {
    if (!ttsHintShown) { ttsHintShown = true; showNotice('warn', 'Sprachausgabe nicht verfügbar.'); }
    onPlaybackEnded();
  }

  function showWelcome() {
    messagesEl.replaceChildren(welcomeEl);
  }
  function clearWelcome() {
    if (welcomeEl && welcomeEl.parentNode === messagesEl) messagesEl.removeChild(welcomeEl);
  }

  // ---------------------------------------------------------------------------
  // Notices.
  // ---------------------------------------------------------------------------
  function showNotice(kind, text, actionLabel, actionFn) {
    noticeEl.className = 'ms-chat-notice ' + (kind === 'warn' ? 'ms-chat-notice--warn' : 'ms-chat-notice--info');
    noticeEl.replaceChildren();
    noticeEl.appendChild(el('div', { text: text }));
    if (actionLabel) {
      var b = el('button', { class: 'ms-chat-btn ms-chat-btn--secondary', type: 'button' }, [actionLabel]);
      b.addEventListener('click', actionFn);
      noticeEl.appendChild(b);
    }
    noticeEl.style.display = 'block';
  }
  function clearNotice() { noticeEl.style.display = 'none'; noticeEl.replaceChildren(); }

  // Build an assistant row: brand avatar + a stacked content column. Returns
  // both so callers append bubbles/cards into `.content`.
  function assistantRow() {
    var row = el('div', { class: 'ms-chat-row ms-chat-row--assistant' });
    row.appendChild(logoEl('ms-chat-avatar'));
    var content = el('div', { class: 'ms-chat-asst-content' });
    row.appendChild(content);
    return { row: row, content: content };
  }

  // An assistant-area error line that lives in the message list.
  function showMessageError(text) {
    clearWelcome();
    var ar = assistantRow();
    ar.content.appendChild(el('div', { class: 'ms-chat-bubble ms-chat-bubble--assistant', text: text }));
    messagesEl.appendChild(ar.row);
    scrollToBottom();
  }

  // ---------------------------------------------------------------------------
  // Rendering: user + assistant messages.
  // ---------------------------------------------------------------------------
  function renderUserMessage(msg) {
    clearWelcome();
    var text = textOfMessage(msg);
    var row = el('div', { class: 'ms-chat-row ms-chat-row--user' });
    row.appendChild(el('div', { class: 'ms-chat-bubble ms-chat-bubble--user', text: text }));
    messagesEl.appendChild(row);
    return row;
  }

  function textOfMessage(msg) {
    var parts = msg.parts || [];
    var out = '';
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] && parts[i].type === 'text') out += parts[i].text || '';
    }
    return out;
  }

  // ctx-based incremental renderer, reused for streaming and restore.
  function newAssistantCtx() {
    clearWelcome();
    var ar = assistantRow();
    messagesEl.appendChild(ar.row);
    return { row: ar.row, content: ar.content, activeText: null, tools: {} };
  }

  function renderPartIntoCtx(ctx, part) {
    if (!part || typeof part.type !== 'string') return;
    var type = part.type;

    if (type === 'text') {
      var t = part.text != null ? part.text : (part.delta != null ? part.delta : '');
      if (!t) return;
      if (!ctx.activeText) {
        var node = el('div', { class: 'ms-chat-bubble ms-chat-bubble--assistant' });
        ctx.content.appendChild(node);
        ctx.activeText = { str: '', node: node };
      }
      ctx.activeText.str += t;
      renderMarkdownInto(ctx.activeText.node, ctx.activeText.str);
      scrollToBottom();
      return;
    }

    var name = resolveToolName(type);
    if (!name) return;
    if (SILENT_TOOLS.indexOf(name) !== -1) return; // consume silently
    var input = part.input != null ? part.input : part.args;
    if (input == null) return; // wait until args have streamed

    ctx.activeText = null; // a tool card ends the current text run

    var key = part.toolCallId || (name + ':' + JSON.stringify(input));
    var inputKey = JSON.stringify(input);
    var holder = ctx.tools[key];
    if (holder) {
      if (holder.inputKey === inputKey) return; // unchanged -> no re-render
      holder.inputKey = inputKey;
    } else {
      holder = { node: el('div'), inputKey: inputKey };
      ctx.tools[key] = holder;
      ctx.content.appendChild(holder.node);
    }
    buildToolCard(name, input).then(function (cardEl) {
      holder.node.replaceChildren();
      if (cardEl) { holder.node.appendChild(cardEl); scrollToBottom(); }
    }).catch(function () { /* render nothing on failure */ });
  }

  function renderRestoredAssistant(msg) {
    var ctx = newAssistantCtx();
    var parts = msg.parts || [];
    for (var i = 0; i < parts.length; i++) renderPartIntoCtx(ctx, parts[i]);
  }

  function renderAllMessages() {
    messagesEl.replaceChildren();
    updateShareBtn();
    if (!messages.length) { showWelcome(); return; }
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      if (m.role === 'user') renderUserMessage(m);
      else if (m.role === 'assistant') renderRestoredAssistant(m);
    }
    scrollToBottom();
  }

  // ---------------------------------------------------------------------------
  // Generating indicator. Instead of the old three bouncing dots, the
  // assistant-slot avatar itself animates while a reply is pending (calm wave
  // motion + a gentle breathing pulse — the .ms-chat-row--gen CSS). When the
  // first tokens arrive this row is removed and the real assistant row takes
  // the same position, so the orb reads as settling into the static avatar
  // beside the streaming text. Reduced motion freezes it via CSS.
  // ---------------------------------------------------------------------------
  function showTyping() {
    removeTyping();
    var ar = assistantRow();
    ar.row.classList.add('ms-chat-row--gen');
    ar.row.setAttribute('role', 'status');
    ar.row.setAttribute('aria-label', 'Mo antwortet');
    typingEl = ar.row;
    messagesEl.appendChild(typingEl);
    scrollToBottom();
  }
  function removeTyping() {
    if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
    typingEl = null;
  }

  // ---------------------------------------------------------------------------
  // Wire helpers + history accumulation for the streamed assistant message.
  // ---------------------------------------------------------------------------
  function accumulatePart(parts, part) {
    var type = part.type;
    if (type === 'text') {
      var t = part.text != null ? part.text : (part.delta != null ? part.delta : '');
      if (!t) return;
      var last = parts[parts.length - 1];
      if (last && last.type === 'text') last.text += t;
      else parts.push({ type: 'text', text: t });
      return;
    }
    var name = resolveToolName(type);
    if (!name) return;
    var input = part.input != null ? part.input : part.args;
    // Keep ALL tool parts (incl. silent ones) in history so the backend can
    // replay update_customer_profile etc. on subsequent turns.
    var id = part.toolCallId || null;
    var existing = null;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].toolCallId && parts[i].toolCallId === id) { existing = parts[i]; break; }
    }
    if (existing) {
      if (input != null) { existing.input = input; existing.state = 'output-available'; }
      // Persist the tool RESULT (tool-output-available) too, so restored
      // histories carry { state: "output-available", input, output } like a
      // genuine AI-SDK history. Never rendered.
      if (part.output !== undefined) { existing.output = part.output; existing.state = 'output-available'; }
    } else {
      // An output without any accumulated call to attach it to: ignore
      // (outputs only ever follow tool-input-available on the wire).
      if (input == null && part.output !== undefined) return;
      parts.push({ type: 'tool-' + name, toolCallId: id, state: input != null ? 'output-available' : 'input-streaming', input: input != null ? input : undefined, output: part.output !== undefined ? part.output : undefined });
    }
  }

  function toWire(msgs) {
    return msgs.map(function (m) { return { id: m.id, role: m.role, parts: m.parts }; });
  }

  // ---------------------------------------------------------------------------
  // Send + SSE stream consumption.
  // ---------------------------------------------------------------------------
  function onSend() {
    if (state.streaming || state.rateLocked) return;
    stopVoice();
    // A text send stops any current playback immediately but does NOT exit
    // voice mode — the upcoming reply is still spoken (the loop continues).
    if (voiceMode) endSpeaking();
    var text = textarea.value.trim();
    if (!text) return;
    sendMessage(text);
  }

  function sendMessage(text, context) {
    clearNotice();
    // Signed-in: the first turn of a fresh thread mints its own conversationKey
    // so it becomes a discrete history entry (no-op for anonymous / a thread
    // that already has a key). Decided BEFORE the user message is pushed.
    maybeMintConversationKey(messages.length === 0);

    var userMsg = { id: 'u-' + uuid(), role: 'user', parts: [{ type: 'text', text: text }] };
    messages.push(userMsg);
    var userRow = renderUserMessage(userMsg);
    saveHistory();
    updateShareBtn(); // first user message reveals the share button
    track('message_sent', {}); // event only — never the message text

    textarea.value = '';
    autoGrow();

    startStream({ userMsg: userMsg, userRow: userRow, restoreText: text, context: context || null });
  }

  // Fresh-open contextual greeting (API_CONTRACT.md §2): POST the context
  // with an EMPTY messages array — the backend streams a natural,
  // context-aware greeting as the first assistant message. No fake user
  // primer enters the history. Only valid for a fresh conversation; a stream
  // error rolls back to the welcome state via the normal error handling.
  function sendContextGreeting(context) {
    if (!context || messages.length || state.streaming || state.rateLocked) return;
    clearNotice();
    maybeMintConversationKey(true); // fresh thread (messages is empty here)
    clearWelcome();
    startStream({ userMsg: null, userRow: null, restoreText: '', context: context });
  }

  function startStream(opts) {
    var userMsg = opts.userMsg;
    var userRow = opts.userRow;
    var restoreText = opts.restoreText || '';

    state.streaming = true;
    updateInputState();
    showTyping();

    var asstParts = [];
    var ctx = null;
    var gotContent = false;
    var toolNames = {};      // toolCallId -> toolName (from tool-input-start / -available)
    var finished = false;
    var streamErrored = false;

    // Creating the real assistant row is the pending->streaming transition:
    // drop the generating placeholder FIRST so its avatar never coexists with
    // the new row's own avatar (a tool-first reply removed typing only after an
    // async card build, briefly showing two avatars).
    function ensureCtx() { if (!ctx) { removeTyping(); ctx = newAssistantCtx(); } return ctx; }

    function rollback() {
      // Remove optimistic user message + assistant scaffolding; restore input.
      if (userMsg) {
        var idx = messages.indexOf(userMsg);
        if (idx !== -1) messages.splice(idx, 1);
        if (userRow && userRow.parentNode) userRow.parentNode.removeChild(userRow);
      }
      if (ctx && ctx.row && ctx.row.parentNode) ctx.row.parentNode.removeChild(ctx.row);
      removeTyping();
      saveHistory();
      updateShareBtn();
      if (!messages.length) showWelcome();
      if (restoreText) { textarea.value = restoreText; autoGrow(); }
    }

    // Idempotent: called on the `finish` event, on `[DONE]`, and on socket
    // close (r.done) — whichever comes first wins.
    function finalizeStream() {
      if (finished) return;
      finished = true;
      removeTyping();
      // Stream produced nothing visible -> drop the empty assistant row.
      if (ctx && ctx.row && !gotContent && ctx.content && !ctx.content.childNodes.length && ctx.row.parentNode) {
        ctx.row.parentNode.removeChild(ctx.row);
      }
      if (asstParts.length) {
        messages.push({ id: 'a-' + uuid(), role: 'assistant', parts: asstParts });
        saveHistory();
      }
      state.streaming = false;
      updateInputState();
      if (streamErrored) {
        // With partial content already rendered the notice is appended AFTER
        // it (showMessageError adds a new row at the end) — the partial
        // answer is kept, never discarded. With nothing rendered it is the
        // whole response, as before.
        showMessageError('Es gab ein Problem. Bitte versuch es gleich nochmal.');
      }
      // Voice mode: speak the completed reply, then resume listening.
      if (voiceMode) voiceAfterReply(asstParts, streamErrored);
    }

    // Feed a part in the widget's canonical shape into history + the renderer.
    // (renderPartIntoCtx / accumulatePart understand {type:'text',text} and
    // {type:'tool-<name>', toolCallId, input} — unchanged from before.)
    function feedCanonical(part) {
      accumulatePart(asstParts, part);
      var c = ensureCtx().content;
      var before = c.childNodes.length;
      renderPartIntoCtx(ctx, part);
      if (c.childNodes.length > 0 || before !== c.childNodes.length) gotContent = true;
    }

    // Body carries the full history each turn; `context` (when present) primes
    // the assistant with the current product / browsing trail per
    // API_CONTRACT.md §2.
    var chatBody = { messages: toWire(messages) };
    if (opts.context) chatBody.context = opts.context;
    // Signed-in: address the active thread so several conversations can live
    // under one stable session_id (CUSTOMER_ACCOUNT.md §7.6). OMITTED for
    // anonymous / email-only (activeConversationKey is always null for them) →
    // backend defaults to session_id, keeping tiers 1–2 byte-identical.
    if (auth.signedIn && activeConversationKey) chatBody.conversationKey = activeConversationKey;
    // Returning-customer memory: only after a successful capture in this
    // page's chat session (see the capturedEmail privacy gate). A new or
    // unverifiable email is ignored gracefully server-side.
    if (capturedEmail) chatBody.customer = { email: capturedEmail };

    fetch(API_BASE + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ms-chat-key': CHAT_KEY, 'x-ms-session': sid },
      body: JSON.stringify(chatBody)
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return null; }).then(function (data) {
          handleChatHttpError(res, data, rollback);
          state.streaming = false;
          updateInputState();
        });
      }
      // Stream the AI SDK v5 UI-message stream (SSE) body.
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      function pump() {
        return reader.read().then(function (r) {
          if (r.done) {
            if (buffer.trim()) processLine(buffer);
            finalizeStream();
            return;
          }
          buffer += decoder.decode(r.value, { stream: true });
          var lines = buffer.split('\n');
          buffer = lines.pop(); // keep the (possibly partial) last line
          for (var i = 0; i < lines.length; i++) processLine(lines[i]);
          return pump();
        });
      }

      function processLine(line) {
        line = line.replace(/\r$/, '');
        if (!line) return;
        var payload = line;
        if (line.indexOf('data:') === 0) payload = line.slice(5).trim();
        else if (line.indexOf(':') === 0) return; // SSE comment / keep-alive
        if (!payload) return;
        if (payload === '[DONE]') { finalizeStream(); return; } // stream terminator
        var ev;
        try { ev = JSON.parse(payload); } catch (e) { return; } // ignore partial/non-JSON
        if (!ev || typeof ev !== 'object') return;
        if (Array.isArray(ev)) { ev.forEach(handleEvent); return; }
        handleEvent(ev);
      }

      // Translate an AI SDK v5 UI-message-stream event into the widget's
      // canonical part shape, then render/persist it.
      function handleEvent(ev) {
        var type = ev.type;
        if (typeof type !== 'string') return;

        switch (type) {
          // --- Framing: no visible effect. ---
          case 'start':
          case 'start-step':
          case 'finish-step':
            return;
          case 'finish':
            finalizeStream();
            return;

          // --- Text run lifecycle (keyed by ev.id). ---
          case 'text-start':
            // Begin a fresh visible bubble for this run.
            ensureCtx().activeText = null;
            return;
          case 'text-delta': {
            var d = ev.delta != null ? ev.delta : (ev.text != null ? ev.text : '');
            if (!d) return;
            feedCanonical({ type: 'text', text: d });
            return;
          }
          case 'text-end':
            // Close the current run so the next text-start starts a new bubble.
            if (ctx) ctx.activeText = null;
            return;

          // --- Tool call lifecycle (keyed by ev.toolCallId). ---
          case 'tool-input-start':
            if (ev.toolCallId && ev.toolName) toolNames[ev.toolCallId] = ev.toolName;
            return;
          case 'tool-input-delta':
            // Partial input args streaming; we only render once full input lands.
            return;
          case 'tool-input-available': {
            var name = ev.toolName || toolNames[ev.toolCallId];
            if (!name) return;
            if (ev.toolCallId) toolNames[ev.toolCallId] = name;
            // input may legitimately be {} for some tools; pass it through.
            feedCanonical({ type: 'tool-' + name, toolCallId: ev.toolCallId || null, input: ev.input != null ? ev.input : {} });
            return;
          }
          case 'tool-output-available':
            // The offer_email_summary RESULT carries the canonical consent
            // copy for the capture form (API_CONTRACT.md §2) — seed the
            // consent-copy cache so the card renders the exact served strings.
            // All other tool results carry nothing extra to render (the
            // widget hydrates its own product data). Consumed silently.
            if (ev.toolCallId && toolNames[ev.toolCallId] === 'offer_email_summary' &&
                ev.output && ev.output.consentCopy) {
              seedConsentCopy(ev.output.consentCopy);
            }
            // Persist the output on the accumulated HISTORY part (renderless
            // — accumulatePart only, never feedCanonical).
            if (ev.toolCallId && toolNames[ev.toolCallId]) {
              accumulatePart(asstParts, { type: 'tool-' + toolNames[ev.toolCallId], toolCallId: ev.toolCallId, output: ev.output != null ? ev.output : null });
            }
            return;
          case 'tool-output-error':
            return;

          // --- Error event. ---
          case 'error':
            try { console.error('[ms-chat] stream error event', ev.errorText || ev.error || ev); } catch (e) {}
            streamErrored = true;
            return;

          default:
            // Custom data parts (data-*) and reasoning-* are not rendered here.
            if (type.indexOf('data-') === 0 || type.indexOf('reasoning') === 0) return;
            try { console.debug('[ms-chat] unhandled stream event type:', type, ev); } catch (e) {}
            return;
        }
      }

      return pump();
    }).catch(function (err) {
      try { console.error('[ms-chat] chat request failed', err); } catch (e) {}
      removeTyping();
      if (gotContent) {
        // Keep partial content; just surface a soft error and re-enable.
        // (finalizeStream already shows the notice when an `error` chunk was
        // seen — don't double it.)
        var notified = streamErrored;
        finalizeStream();
        if (!notified) showMessageError('Es gab ein Problem. Bitte versuch es gleich nochmal.');
      } else {
        rollback();
        showMessageError('Es gab ein Problem. Bitte versuch es gleich nochmal.');
        state.streaming = false;
        updateInputState();
        if (voiceMode) restartVoiceLoop(); // keep the hands-free loop alive
      }
    });
  }

  function handleChatHttpError(res, data, rollback) {
    var code = data && data.error && data.error.code;
    removeTyping();

    if (res.status === 429 || code === 'rate_limited') {
      rollback();
      var retry = parseInt(res.headers.get('Retry-After'), 10);
      if (!isFinite(retry) || retry <= 0) retry = 30;
      lockRateLimit(retry);
      return;
    }
    if (res.status === 401 || code === 'unauthorized') {
      try { console.error('[ms-chat] 401 unauthorized — check ms_chat_shared_secret in theme settings.'); } catch (e) {}
      rollback();
      showMessageError('Chat ist gerade nicht verfügbar.');
      return;
    }
    if (res.status === 403 || code === 'forbidden') {
      try { console.error('[ms-chat] 403 forbidden — origin not allowlisted on the backend (ALLOWED_ORIGINS).'); } catch (e) {}
      rollback();
      showMessageError('Chat ist gerade nicht verfügbar.');
      return;
    }
    if (code === 'payload_too_large' || (res.status === 400 && code === 'payload_too_large')) {
      // 40-message cap hit. Offer a clean restart.
      rollback();
      showNotice('info', 'Dieser Chat ist ziemlich lang geworden. Starte einen neuen Chat, um weiterzumachen.', 'Neuen Chat starten', function () {
        startNewChat();
      });
      return;
    }
    // bad_request / internal_error / upstream_unavailable / anything else.
    try { console.error('[ms-chat] chat error', res.status, code); } catch (e) {}
    rollback();
    if (res.status >= 500 || code === 'internal_error' || code === 'upstream_unavailable') {
      showMessageError('Es gab ein Problem. Bitte versuch es gleich nochmal.');
    } else {
      showMessageError('Chat ist gerade nicht verfügbar.');
    }
  }

  function lockRateLimit(seconds) {
    state.rateLocked = true;
    updateInputState();
    showNotice('warn', 'Zu viele Anfragen — bitte kurz warten.');
    if (rateTimer) clearTimeout(rateTimer);
    rateTimer = setTimeout(function () {
      state.rateLocked = false;
      rateTimer = null;
      clearNotice();
      updateInputState();
      if (voiceMode) restartVoiceLoop(); // resume listening once the lock lifts
    }, seconds * 1000);
  }

  function startNewChat() {
    clearNotice();
    if (auth.signedIn) {
      // Signed-in: the session id is the identity link (CUSTOMER_ACCOUNT.md §1),
      // so DON'T rotate it — just clear the active thread. Past conversations
      // stay in the customer's server-side history ("Neue Beratung"). Dropping
      // the local messages is enough to clear the per-request 40-message cap.
      lsDel(historyKey());
      messages = [];
      activeConversationId = null;
      // "Neue Beratung": keep session_id, start a FRESH thread key so prior
      // conversations stay in history and this becomes a new entry on first turn.
      activeConversationKey = uuid();
      saveConvKey();
    } else {
      rotateSession(); // anonymous/email-only: unchanged (rotates sid + history)
      activeConversationKey = null; // anonymous never sends a conversationKey
    }
    if (rateTimer) { clearTimeout(rateTimer); rateTimer = null; }
    state.rateLocked = false;
    state.streaming = false;
    updateInputState();
    renderAllMessages(); // empty -> welcome
    try { textarea.focus(); } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // Contextual proactive nudge (engagement layer, WIDGET_SPEC §9c).
  //
  // A small dismissible speech bubble next to the launcher — NEVER a blocking
  // overlay/modal. Copy is tailored to the page/category (tone rule above);
  // it never asks for an email. Frequency: at most ONCE per session
  // (sessionStorage), never again once dismissed (localStorage), never if the
  // chat was already opened this session. Triggers: dwell on product/
  // collection pages, scroll near the bottom of a product page, exit intent
  // on desktop only (mobile = dwell/scroll only). First applicable wins.
  // ---------------------------------------------------------------------------
  var NUDGE_DISMISSED_KEY = 'ms-chat-nudge-dismissed'; // persists: dismissed once = never again
  var SS_NUDGE_SHOWN = 'ms-chat-nudge-shown';          // once per session
  var SS_CHAT_OPENED = 'ms-chat-opened';               // chat opened this session
  var SS_ATTN = 'ms-chat-attn-played';                 // launcher attention played this session
  var NUDGE_DWELL_MS = 24000;
  var nudgeEl = null;

  function prefersReducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  function nudgeEligible() {
    return !state.open &&
      lsGet(NUDGE_DISMISSED_KEY) !== '1' &&
      !ssGet(SS_NUDGE_SHOWN) &&
      !ssGet(SS_CHAT_OPENED);
  }

  // Copy priority: current product page -> current collection page -> a
  // category streak in the trail -> friendly generic offer. All variants are
  // grammar-safe for any product/category name (quoted, no gender/number
  // agreement) and reference only the page/category — never behavior.
  function nudgeCopy() {
    if (PAGE_CTX.type === 'product' && PAGE_CTX.productName) {
      return { text: 'Fragen zum Produkt „' + PAGE_CTX.productName + '“? Ich helf dir gern weiter.', contextual: true };
    }
    if (PAGE_CTX.type === 'collection' && PAGE_CTX.category) {
      return { text: 'Unsicher, was aus „' + PAGE_CTX.category + '“ zu dir passt? Lass es uns klären.', contextual: true };
    }
    var streak = trailCategoryStreak();
    if (streak) {
      return { text: 'Du schaust dir ein paar Produkte aus „' + streak + '“ an — soll ich beim Vergleich helfen?', contextual: true };
    }
    return { text: 'Hi, ich bin Mo! Wenn du Fragen hast, helfe ich dir gern bei der Auswahl.', contextual: false };
  }

  function removeNudge() {
    if (nudgeEl && nudgeEl.parentNode) nudgeEl.parentNode.removeChild(nudgeEl);
    nudgeEl = null;
  }

  function showNudge(trigger) {
    if (!nudgeEligible() || nudgeEl) return;
    var copy = nudgeCopy();
    ssSet(SS_NUDGE_SHOWN, '1');
    nudgeEl = el('div', { class: 'ms-chat-nudge' });
    var msg = el('button', { class: 'ms-chat-nudge-msg', type: 'button', text: copy.text });
    msg.addEventListener('click', function () {
      track('nudge_clicked', { pageType: PAGE_CTX.type, contextual: copy.contextual });
      removeNudge();
      var fresh = !messages.length;
      openPanel();
      // Fresh conversation: hand the page/trail context to the backend for a
      // streamed contextual greeting (messages: [] — API_CONTRACT.md §2).
      // With existing history (or no usable context) just open as before.
      if (fresh && !state.streaming && !state.rateLocked) {
        var ctx = null;
        if (PAGE_CTX.type === 'product' && (PAGE_CTX.productHandle || PAGE_CTX.productId)) {
          ctx = { type: 'product', productId: PAGE_CTX.productHandle || PAGE_CTX.productId };
          if (PAGE_CTX.productName) ctx.productTitle = PAGE_CTX.productName;
          var rv = recentlyViewedPayload();
          if (rv) ctx.recentlyViewed = rv;
        } else {
          ctx = browsingContext(null);
        }
        if (ctx) sendContextGreeting(ctx);
      }
    });
    var x = el('button', { class: 'ms-chat-nudge-x', type: 'button', 'aria-label': 'Hinweis schließen' });
    x.appendChild(icon('close'));
    x.addEventListener('click', function () {
      lsSet(NUDGE_DISMISSED_KEY, '1'); // dismissed once -> persists, never shown again
      track('nudge_dismissed', { pageType: PAGE_CTX.type, contextual: copy.contextual });
      removeNudge();
    });
    nudgeEl.appendChild(msg);
    nudgeEl.appendChild(x);
    root.appendChild(nudgeEl);
    track('nudge_shown', { pageType: PAGE_CTX.type, contextual: copy.contextual, trigger: trigger || '' });
  }

  // Behavior-based triggers; the first applicable one fires, then all are
  // torn down. showNudge() re-checks eligibility, so a chat opened after
  // arming silently wins.
  function initNudgeTriggers() {
    if (!nudgeEligible()) return;
    var fired = false;
    var dwellTimer = null;
    var scrollBound = false;
    var mouseBound = false;

    function cleanup() {
      if (dwellTimer) { clearTimeout(dwellTimer); dwellTimer = null; }
      if (scrollBound) { window.removeEventListener('scroll', onScroll); scrollBound = false; }
      if (mouseBound) { document.removeEventListener('mouseout', onMouseOut); mouseBound = false; }
    }
    function fire(trigger) {
      if (fired) return;
      fired = true;
      cleanup();
      showNudge(trigger);
    }
    // Dwell on a product/collection page.
    if (PAGE_CTX.type === 'product' || PAGE_CTX.type === 'collection') {
      dwellTimer = setTimeout(function () { fire('dwell'); }, NUDGE_DWELL_MS);
    }
    // Scroll near the bottom of a product page.
    function onScroll() {
      var doc = document.documentElement;
      var max = Math.max(doc.scrollHeight || 0, document.body ? document.body.scrollHeight : 0);
      if (max <= window.innerHeight) return;
      if ((window.pageYOffset + window.innerHeight) / max >= 0.85) fire('scroll');
    }
    if (PAGE_CTX.type === 'product') {
      window.addEventListener('scroll', onScroll, { passive: true });
      scrollBound = true;
    }
    // Exit intent — DESKTOP only (pointer leaving toward the top/URL bar).
    // Mobile has no pointer-out: dwell/scroll above are the mobile triggers.
    function onMouseOut(e) {
      if (e.relatedTarget) return;
      if (typeof e.clientY === 'number' && e.clientY > 16) return;
      fire('exit');
    }
    if (isDesktop()) {
      document.addEventListener('mouseout', onMouseOut);
      mouseBound = true;
    }
  }

  // ---------------------------------------------------------------------------
  // One-time launcher attention animation: a single gentle bounce shortly
  // after load, then rest. Once per SESSION (not per navigation), skipped
  // entirely under prefers-reduced-motion (the CSS also freezes it as a
  // belt-and-braces guard).
  // ---------------------------------------------------------------------------
  function playLauncherAttention() {
    if (ssGet(SS_ATTN)) return;
    ssSet(SS_ATTN, '1'); // consumed even when skipped — never replays this session
    if (prefersReducedMotion()) return;
    setTimeout(function () {
      if (state.open || !launcher) return;
      launcher.classList.add('ms-chat-launcher--attn');
      launcher.addEventListener('animationend', function onEnd(e) {
        if (e.target !== launcher) return; // ignore bubbled orb/halo animation ends
        launcher.classList.remove('ms-chat-launcher--attn');
        launcher.removeEventListener('animationend', onEnd);
      });
      track('launcher_attention_played', {});
    }, 1400);
  }

  // ---------------------------------------------------------------------------
  // Public API: product-page CTA (feature 2). Opens the panel and sends a
  // product-primed message so the assistant advises about that product. This
  // works whether the conversation is fresh or already going — it appends a
  // normal turn, so existing history is never wiped. The `context` field is
  // also sent (the backend may use it); ids/title only — never a page scrape.
  // ---------------------------------------------------------------------------
  function openWithProduct(id, title) {
    try {
      openPanel();
      var pid = id != null ? String(id) : '';
      var ptitle = title != null ? String(title) : '';
      track('product_cta_opened', { productId: pid }); // numeric id stays for KPI
      if (state.streaming || state.rateLocked) return; // busy -> just open; user can ask
      // Context grounding: the catalog's ids are handles/slugs, so a numeric
      // Shopify product.id is dropped server-side. The CTA only renders on
      // its own product page, where the snippet injects productHandle — use
      // it (guarded against a CTA for a different product), falling back to
      // the passed id only when no handle is present.
      var ctxId = pid;
      if (PAGE_CTX.type === 'product' && PAGE_CTX.productHandle &&
          (!pid || !PAGE_CTX.productId || pid === PAGE_CTX.productId)) {
        ctxId = PAGE_CTX.productHandle;
      }
      var context = { type: 'product', productId: ctxId, productTitle: ptitle };
      var rv = recentlyViewedPayload();
      if (rv) context.recentlyViewed = rv;
      // Deliberately a primer user message, NOT the messages:[] greeting:
      // the primer carries the title in text, so the consultation works even
      // if the context's productId were ever dropped server-side. (With
      // existing history this is also the contract's pivot path.)
      var prompt = ptitle
        ? ('Ich interessiere mich für „' + ptitle + '". Kannst du mich zu diesem Produkt beraten?')
        : 'Kannst du mich zu diesem Produkt beraten?';
      sendMessage(prompt, context);
    } catch (e) {
      try { console.error('[ms-chat] openWithProduct failed', e); } catch (e2) {}
    }
  }

  // ---------------------------------------------------------------------------
  // Share-icon entry point: open the panel and drop the SAME email-capture form
  // into the message area so the user can request the summary at any time. If a
  // not-yet-submitted capture card is already on screen, reuse it (don't stack).
  // ---------------------------------------------------------------------------
  var lastCaptureRow = null;
  function openCaptureForm() {
    try {
      openPanel();
      if (lastCaptureRow && lastCaptureRow.parentNode === messagesEl) {
        var existing = lastCaptureRow.querySelector('input[type="email"]');
        lastCaptureRow.scrollIntoView({ block: 'nearest' });
        if (existing) { try { existing.focus(); } catch (e) {} }
        return;
      }
      clearWelcome();
      var ar = assistantRow();
      ar.content.appendChild(buildCaptureCard({ message: CONSENT_COPY.intro, productIds: null }));
      messagesEl.appendChild(ar.row);
      lastCaptureRow = ar.row;
      scrollToBottom();
      setTimeout(function () {
        try { ar.row.querySelector('input[type="email"]').focus(); } catch (e) {}
      }, 60);
    } catch (e) {
      try { console.error('[ms-chat] openCaptureForm failed', e); } catch (e2) {}
    }
  }

  // ---------------------------------------------------------------------------
  // Signed-in summary download (CUSTOMER_ACCOUNT.md §8). Guarded XHR to
  // GET /api/account/summary?conversationKey=… → branded HTML document, saved
  // as a file client-side (a plain <a download> can't send the x-ms-chat-key +
  // session guards). On-demand and may make one AI call, so it can take a
  // moment — we show a busy state and impose NO short timeout.
  // ---------------------------------------------------------------------------
  var DOWNLOAD_COPY = {
    notFound: 'Für diese Beratung gibt es noch keine Zusammenfassung.',
    error: 'Zusammenfassung konnte gerade nicht erstellt werden — bitte später erneut versuchen.'
  };
  var downloadingSummary = false;
  function downloadSummary() {
    if (!auth.signedIn || !activeConversationKey || downloadingSummary) return;
    downloadingSummary = true;
    downloadBtn.disabled = true;
    downloadBtn.classList.add('ms-chat-download--busy');
    clearNotice();
    track('summary_download_started', {});
    var key = activeConversationKey;
    fetch(API_BASE + '/api/account/summary?conversationKey=' + encodeURIComponent(key), {
      method: 'GET', headers: accountHeaders()
    }).then(function (res) {
      if (res.status === 401) { accountUnauthorized(); throw 0; }   // session gone
      if (res.status === 404) throw 404;                            // not this customer's / unknown
      if (!res.ok) throw new Error('summary ' + res.status);
      return res.blob();
    }).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = el('a', { href: url, download: 'motionsports-zusammenfassung.html' });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 1000);
      track('summary_downloaded', {});
    }).catch(function (e) {
      if (e === 0) return; // 401 already dropped to anonymous
      if (e === 404) showNotice('info', DOWNLOAD_COPY.notFound);
      else showNotice('warn', DOWNLOAD_COPY.error);
    }).then(function () {
      downloadingSummary = false;
      if (downloadBtn) { downloadBtn.disabled = false; downloadBtn.classList.remove('ms-chat-download--busy'); }
    });
  }

  // ---------------------------------------------------------------------------
  // Customer Account tier-3 UI: sign-in card, header affordances, signed-in
  // welcome greeting, and the ChatGPT-style conversation-history drawer.
  // All of this is gated on `auth.signedIn` (or settled-but-anonymous), so it
  // is inert for visitors who never sign in.
  // ---------------------------------------------------------------------------

  // The benefits card (task §2): NOT a fake login form — auth is Shopify's
  // hosted page; one button initiates the redirect and returns here.
  function buildSignInCard() {
    var card = el('div', { class: 'ms-chat-card ms-chat-signin-card' });
    var body = el('div', { class: 'ms-chat-card-body' });
    var head = el('div', { class: 'ms-chat-card-head' });
    head.appendChild(icon('user'));
    head.appendChild(el('span', { text: ACCOUNT_COPY.signInTitle }));
    body.appendChild(head);
    body.appendChild(el('div', { class: 'ms-chat-card-text', text: ACCOUNT_COPY.signInIntro }));
    var ul = el('ul', { class: 'ms-chat-signin-benefits' });
    ACCOUNT_COPY.benefits.forEach(function (b) {
      var li = el('li');
      li.appendChild(icon('check'));
      li.appendChild(el('span', { text: b }));
      ul.appendChild(li);
    });
    body.appendChild(ul);
    var btn = el('button', { type: 'button', class: 'ms-chat-btn ms-chat-btn--primary' }, [ACCOUNT_COPY.signInBtn]);
    btn.addEventListener('click', function () { initiateLogin(); });
    body.appendChild(btn);
    card.appendChild(body);
    return card;
  }

  // Header "Anmelden" entry point for mid-conversation (when the welcome state
  // — which already shows the card — isn't on screen). Drops the same card into
  // the message stream; never stacks.
  var lastSignInRow = null;
  function openSignInCard() {
    try {
      openPanel();
      if (auth.signedIn) return;
      if (welcomeEl && welcomeEl.parentNode === messagesEl && welcomeAuthEl && welcomeAuthEl.firstChild) {
        welcomeAuthEl.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (lastSignInRow && lastSignInRow.parentNode === messagesEl) {
        lastSignInRow.scrollIntoView({ block: 'nearest' });
        return;
      }
      clearWelcome();
      var ar = assistantRow();
      ar.content.appendChild(buildSignInCard());
      messagesEl.appendChild(ar.row);
      lastSignInRow = ar.row;
      scrollToBottom();
    } catch (e) {
      try { console.error('[ms-chat] openSignInCard failed', e); } catch (e2) {}
    }
  }

  // At-sign-in marketing opt-in (CONSENT_FLOW.md §2). UI CHROME only (German) —
  // every LEGAL string (headline framing, the marketing label, the shared
  // footer, the consentTextShown audit text, imprint/privacy targets) is
  // backend-served and rendered verbatim; nothing consent-related is hard-coded
  // here.
  var OPTIN_COPY = {
    loading: 'Einwilligungstext wird geladen…',
    submit: 'Anmelden',
    sending: 'Wird gesendet…',
    dismiss: 'Nicht jetzt',
    // Unticked submit -> a gentle "please tick" hint; never auto-submitted.
    errTick: 'Bitte setze das Häkchen, um dich anzumelden.',
    errRate: 'Zu viele Anfragen — bitte kurz warten.',
    errUpstream: 'Anmeldung gerade nicht möglich — bitte später erneut versuchen.',
    errGeneric: 'Anmeldung fehlgeschlagen. Bitte versuch es erneut.',
    successTitle: 'Fast geschafft!',
    // DOI: ticking only sends a confirmation mail — not subscribed until clicked.
    successPending: 'Bitte bestätige die Anmeldung über den Link in der E-Mail an deine hinterlegte Adresse.',
    successConfirmed: 'Du bist bereits angemeldet — viel Freude mit unseren Angeboten!',
    // 422 no_verified_email -> fall back to the typed-email capture form.
    noEmail: 'Für dein Konto ist keine bestätigte E-Mail-Adresse hinterlegt.',
    noEmailBtn: 'E-Mail-Adresse eingeben'
  };

  // Session-scoped guard: once the customer submits or dismisses the opt-in we
  // stop re-presenting it for the rest of this browser session (it is an
  // optional benefit surface, not a nag). Never persisted across sessions.
  var OPTIN_DONE_KEY = 'ms-chat-optin-done';
  var signInOptInDone = (ssGet(OPTIN_DONE_KEY) === '1');
  function markOptInDone() { signInOptInDone = true; ssSet(OPTIN_DONE_KEY, '1'); }
  // Show the at-sign-in opt-in ONLY when the backend says there's no marketing
  // decision on record yet (auth.optInActionable, CUSTOMER_ACCOUNT.md §6.1) —
  // so a customer who already opted in / out (or whose prior consent carried
  // forward) is never re-asked. `signInOptInDone` is the additional local
  // session guard for "dismissed/submitted this session".
  function optInActionable() { return auth.signedIn && auth.optInActionable && !signInOptInDone; }

  // The opt-in card (CONSENT_FLOW.md §2): the SAME double-opt-in as the capture
  // form, minus the "type your email" step. Renders the served v3 copy verbatim
  // — a benefit headline (framing, NOT consent text), ONE marketing checkbox
  // that ALWAYS starts UNCHECKED and is never auto-toggled, the served footer,
  // and imprint/privacy links. Submitting runs the existing DOI path
  // (POST /api/account/marketing-opt-in) echoing consentTextShown verbatim; an
  // unticked submit records nothing and blocks nothing.
  function buildMarketingOptInCard() {
    var card = el('div', { class: 'ms-chat-card ms-chat-optin-card' });
    var body = el('div', { class: 'ms-chat-card-body' });
    card.appendChild(body);
    body.appendChild(el('div', { class: 'ms-chat-consent-loading', text: OPTIN_COPY.loading }));

    var copy = null, mkt = null, group = null, attnActive = false;
    var errEl = el('div', { class: 'ms-chat-form-error', style: 'display:none' });
    function showError(m) { errEl.textContent = m; errEl.style.display = 'block'; }
    function clearError() { errEl.textContent = ''; errEl.style.display = 'none'; }

    function dismiss() { markOptInDone(); card.remove(); }

    // Unchecked-marketing attention treatment (mirrors the capture form): accent
    // outline + one brief shake + an inline hint. No request is sent; the tick
    // is the consent, so we never proceed without it.
    function flagAttention() {
      showError(OPTIN_COPY.errTick);
      attnActive = true;
      if (group) {
        group.classList.remove('ms-chat-consent-group--attn');
        void group.offsetWidth; // restart the shake on repeat clicks
        group.classList.add('ms-chat-consent-group--attn');
      }
      if (mkt) { try { mkt.input.focus(); } catch (e) {} }
    }
    function clearAttention() {
      if (!attnActive) return;
      attnActive = false;
      if (group) group.classList.remove('ms-chat-consent-group--attn');
      clearError();
    }

    function renderForm(c) {
      copy = c;
      body.replaceChildren();
      // Benefit framing ABOVE the checkbox — explicitly NOT part of
      // consentTextShown (CONSENT_FLOW.md §2.1); rendered as served.
      if (typeof c.headline === 'string' && c.headline) {
        body.appendChild(el('div', { class: 'ms-chat-optin-headline', text: c.headline }));
      }
      var form = el('form', { class: 'ms-chat-form ms-chat-optin', novalidate: 'novalidate' });

      // ONE marketing checkbox — ALWAYS UNCHECKED, never pre-ticked, never
      // auto-toggled by any other interaction. Same DELIBERATE LEGAL invariant
      // as the capture form (Planet49 / UWG): the opt-in is won by placement and
      // copy, never by a pre-tick. There is no code path that sets .checked.
      var row = el('label', { class: 'ms-chat-consent ms-chat-consent--marketing' });
      var input = el('input', { type: 'checkbox' });
      row.appendChild(input);
      row.appendChild(el('span', { class: 'ms-chat-consent-text' }, [c.marketingLabel]));
      mkt = { row: row, input: input };
      group = el('div', { class: 'ms-chat-consent-group' });
      group.appendChild(row);
      form.appendChild(group);
      input.addEventListener('change', function () { if (input.checked) clearAttention(); });

      // Shared footer beneath the box — backend-served, part of the audit text.
      if (typeof c.consentFooter === 'string' && c.consentFooter) {
        form.appendChild(el('div', { class: 'ms-chat-consent-footer', text: c.consentFooter }));
      }
      form.appendChild(errEl);

      var submit = el('button', { type: 'submit', class: 'ms-chat-btn ms-chat-btn--primary' }, [OPTIN_COPY.submit]);
      form.appendChild(submit);

      // Imprint / privacy links nearby (compliance) — targets backend-served.
      var legal = el('div', { class: 'ms-chat-legal-links' });
      var impHref = safeHref(c.imprintUrl);
      var privHref = safeHref(c.privacyUrl);
      if (impHref) legal.appendChild(el('a', { href: impHref, target: '_blank', rel: 'noopener noreferrer', text: 'Impressum' }));
      if (privHref) legal.appendChild(el('a', { href: privHref, target: '_blank', rel: 'noopener noreferrer', text: 'Datenschutz' }));
      form.appendChild(legal);

      var skip = el('button', { type: 'button', class: 'ms-chat-optin-dismiss', text: OPTIN_COPY.dismiss });
      skip.addEventListener('click', dismiss);
      form.appendChild(skip);

      body.appendChild(form);

      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        clearError();
        if (!copy || !mkt) return; // served copy not loaded -> cannot submit
        // Opt-in is OPTIONAL: an unticked submit records nothing and blocks
        // nothing — it only flags the box. We never auto-send marketingConsent.
        if (!mkt.input.checked) { flagAttention(); return; }
        var payload = {
          marketingConsent: true,                    // the user's actual tick
          // The served audit string, echoed back VERBATIM (Art. 7 proof) — never
          // recomposed or hard-coded client-side.
          consentTextShown: copy.consentTextShown
        };
        submit.disabled = true;
        submit.textContent = OPTIN_COPY.sending;
        // Guarded account XHR (CONSENT_FLOW.md §2.2): same headers as /api/auth/me.
        fetch(API_BASE + '/api/account/marketing-opt-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-ms-chat-key': CHAT_KEY, 'x-ms-session': sid },
          body: JSON.stringify(payload)
        }).then(function (res) {
          if (res.status === 401) { accountUnauthorized(); card.remove(); return; }
          if (res.ok) {
            return res.json().catch(function () { return null; }).then(function (data) {
              var m = data && data.marketing;
              var confirmed = !!(m && (m.alreadyConfirmed === true || m.status === 'confirmed'));
              var ok = el('div', { class: 'ms-chat-form-success' });
              ok.appendChild(icon('check'));
              ok.appendChild(el('h3', { text: OPTIN_COPY.successTitle }));
              ok.appendChild(el('p', { text: confirmed ? OPTIN_COPY.successConfirmed : OPTIN_COPY.successPending }));
              body.replaceChildren(ok);
              markOptInDone();
              scrollToBottom();
            });
          }
          return res.json().catch(function () { return null; }).then(function (data) {
            var code = data && data.error && data.error.code;
            if (code === 'marketing_consent_required') {
              // Defensive: the widget already blocks an unticked submit; if the
              // backend still rejects, show the same targeted box attention.
              submit.disabled = false;
              submit.textContent = OPTIN_COPY.submit;
              flagAttention();
              return;
            }
            if (res.status === 422 || code === 'no_verified_email') {
              // Rare: no verified email on file -> fall back to the typed-email
              // capture form (the existing, unchanged path).
              body.replaceChildren();
              body.appendChild(el('div', { class: 'ms-chat-card-text', text: OPTIN_COPY.noEmail }));
              var b = el('button', { type: 'button', class: 'ms-chat-btn ms-chat-btn--secondary' }, [OPTIN_COPY.noEmailBtn]);
              b.addEventListener('click', function () { markOptInDone(); card.remove(); openCaptureForm(); });
              body.appendChild(b);
              return;
            }
            if (res.status === 429 || code === 'rate_limited') {
              var retry = parseInt(res.headers.get('Retry-After'), 10);
              if (!isFinite(retry) || retry <= 0) retry = 30;
              showError(OPTIN_COPY.errRate);
              submit.textContent = OPTIN_COPY.submit;
              setTimeout(function () { submit.disabled = false; }, retry * 1000);
              return;
            }
            var msg = (data && data.error && data.error.message) || '';
            if (res.status === 502 || res.status === 503 || code === 'upstream_unavailable') msg = OPTIN_COPY.errUpstream;
            else if (!msg) msg = OPTIN_COPY.errGeneric;
            showError(msg);
            submit.disabled = false;
            submit.textContent = OPTIN_COPY.submit;
          });
        }).catch(function () {
          showError(OPTIN_COPY.errUpstream);
          submit.disabled = false;
          submit.textContent = OPTIN_COPY.submit;
        });
      });
    }

    fetchSignInConsentCopy().then(function (c) {
      // lawyerApproved:false means the copy is not yet legally signed off — do
      // not launch the surface to real users (CONSENT_FLOW.md §1).
      if (c.lawyerApproved !== true) { card.remove(); return; }
      renderForm(c);
    }).catch(function () {
      // No served copy -> render nothing (we never hard-code consent text).
      card.remove();
    });

    return card;
  }

  // Present the opt-in INLINE after a sign-in moment when the welcome state
  // (which renders it in its own auth slot) isn't on screen — e.g. signing in
  // mid-conversation. Non-stacking and session-gated; never shown to anonymous.
  var lastOptInRow = null;
  function presentSignInOptIn() {
    try {
      if (!optInActionable()) return;
      // Welcome on screen -> updateWelcomeAuth already renders the opt-in there.
      if (welcomeEl && welcomeEl.parentNode === messagesEl) return;
      if (lastOptInRow && lastOptInRow.parentNode === messagesEl) {
        lastOptInRow.scrollIntoView({ block: 'nearest' });
        return;
      }
      var ar = assistantRow();
      ar.content.appendChild(buildMarketingOptInCard());
      messagesEl.appendChild(ar.row);
      lastOptInRow = ar.row;
      scrollToBottom();
    } catch (e) {
      try { console.error('[ms-chat] presentSignInOptIn failed', e); } catch (e2) {}
    }
  }

  // Reflect the resolved auth state across the chrome. Called on every auth
  // change; a no-op shape for anonymous (signInBtn shown, history hidden,
  // share button behaves exactly as before).
  function reflectAuthState() {
    if (signInBtn) signInBtn.classList.toggle('ms-chat-signin-btn--visible', auth.settled && !auth.signedIn);
    if (historyBtn) historyBtn.classList.toggle('ms-chat-iconbtn--shown', auth.signedIn);
    updateShareBtn();          // hides the email-capture entry point when signed in
    updateWelcomeAuth();       // greeting / sign-in card inside the welcome state
    if (!auth.signedIn) closeHistory();
  }

  // Welcome-state additions: a "Hallo {Name}" greeting when signed in, and the
  // sign-in benefits card when settled-but-anonymous. Both live in containers
  // built into the welcome element; emptied/filled here.
  function updateWelcomeAuth() {
    if (welcomeGreetingEl) {
      if (auth.signedIn) {
        welcomeGreetingEl.textContent = auth.name ? ('Hallo ' + auth.name + '!') : 'Schön, dass du wieder da bist!';
        welcomeGreetingEl.style.display = '';
      } else {
        welcomeGreetingEl.textContent = '';
        welcomeGreetingEl.style.display = 'none';
      }
    }
    if (welcomeAuthEl) {
      welcomeAuthEl.replaceChildren();
      // Anonymous (settled): the sign-in benefits card. Signed in: the at-sign-in
      // marketing opt-in (CONSENT_FLOW.md §2), unless already submitted/dismissed
      // this session.
      if (auth.settled && !auth.signedIn) welcomeAuthEl.appendChild(buildSignInCard());
      else if (optInActionable()) welcomeAuthEl.appendChild(buildMarketingOptInCard());
    }
  }

  // --- Conversation-history drawer (signed-in only) ---------------------------
  function buildHistoryDrawer() {
    historyEl = el('div', { class: 'ms-chat-history', 'aria-hidden': 'true', role: 'dialog', 'aria-label': ACCOUNT_COPY.historyAria });

    var head = el('div', { class: 'ms-chat-history-head' });
    historyTitleEl = el('span', { class: 'ms-chat-history-title', text: ACCOUNT_COPY.historyTitle });
    var back = el('button', { class: 'ms-chat-iconbtn', type: 'button', 'aria-label': 'Verlauf schließen' });
    back.appendChild(icon('close'));
    back.addEventListener('click', closeHistory);
    head.appendChild(historyTitleEl);
    head.appendChild(back);
    historyEl.appendChild(head);

    var newBtn = el('button', { class: 'ms-chat-btn ms-chat-btn--primary ms-chat-history-new', type: 'button' });
    newBtn.appendChild(icon('plus'));
    newBtn.appendChild(el('span', { text: ACCOUNT_COPY.newChat }));
    newBtn.addEventListener('click', function () { track('account_new_consultation', {}); startNewChat(); closeHistory(); });
    historyEl.appendChild(newBtn);

    historyListEl = el('div', { class: 'ms-chat-history-list' });
    historyEl.appendChild(historyListEl);

    var foot = el('div', { class: 'ms-chat-history-foot' });
    var outBtn = el('button', { class: 'ms-chat-history-link', type: 'button', text: ACCOUNT_COPY.logout });
    outBtn.addEventListener('click', signOut);
    foot.appendChild(outBtn);
    var eraseWrap = el('div', { class: 'ms-chat-history-erase' });
    buildEraseControl(eraseWrap);
    foot.appendChild(eraseWrap);
    historyEl.appendChild(foot);

    panel.appendChild(historyEl);
  }

  function openHistory() {
    if (!historyEl || !auth.signedIn) return;
    track('account_history_opened', {});
    historyTitleEl.textContent = auth.name ? ('Hallo ' + auth.name) : ACCOUNT_COPY.historyTitle;
    historyEl.classList.add('ms-chat-history--open');
    historyEl.setAttribute('aria-hidden', 'false');
    loadConversations();
  }
  function closeHistory() {
    if (!historyEl) return;
    historyEl.classList.remove('ms-chat-history--open');
    historyEl.setAttribute('aria-hidden', 'true');
  }

  // Task §1: surface the conversation history PROMINENTLY for signed-in
  // customers rather than leaving it behind the header icon. When a signed-in
  // customer opens the chat onto the welcome state (no conversation in
  // progress), land them straight on their history list — past beratungen +
  // "Neue Beratung". A mid-conversation reopen (messages present) is left alone
  // so we never cover an active chat. The header icon stays as the re-entry.
  // Armed on each panel open and flushed once /api/auth/me has settled.
  var autoHistoryArmed = false;
  function maybeAutoOpenHistory() {
    if (!state.open || !auth.signedIn) return;
    if (messages.length) return;
    if (!historyEl || historyEl.classList.contains('ms-chat-history--open')) return;
    openHistory();
  }
  function flushAutoHistory() {
    if (!autoHistoryArmed || !auth.settled) return; // wait for the probe; applyAuth re-calls
    autoHistoryArmed = false;
    maybeAutoOpenHistory();
  }

  // 401 on any /api/account/* call means the session no longer resolves
  // (logged out / expired / erased) — fail closed and drop back to anonymous.
  function accountUnauthorized() {
    applyAuth(null);
    closeHistory();
  }

  function loadConversations() {
    historyListEl.replaceChildren(el('div', { class: 'ms-chat-history-empty', text: ACCOUNT_COPY.loading }));
    fetch(API_BASE + '/api/account/conversations', { method: 'GET', headers: accountHeaders() })
      .then(function (r) {
        if (r.status === 401) { accountUnauthorized(); throw 0; }
        return r.ok ? r.json() : null;
      })
      .then(function (data) { renderConversations((data && data.conversations) || []); })
      .catch(function (e) {
        if (e === 0) return;
        historyListEl.replaceChildren(el('div', { class: 'ms-chat-history-empty', text: ACCOUNT_COPY.loadError }));
      });
  }

  function renderConversations(list) {
    historyListEl.replaceChildren();
    if (!list.length) {
      historyListEl.appendChild(el('div', { class: 'ms-chat-history-empty', text: ACCOUNT_COPY.empty }));
      return;
    }
    for (var i = 0; i < list.length; i++) historyListEl.appendChild(buildConversationItem(list[i]));
  }

  function convDate(c) {
    var iso = c.updatedAt || c.createdAt;
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return ''; }
  }

  function buildConversationItem(c) {
    var item = el('div', { class: 'ms-chat-conv' });
    if (activeConversationId != null && c.conversationId === activeConversationId) item.classList.add('ms-chat-conv--active');

    var openBtn = el('button', { class: 'ms-chat-conv-open', type: 'button' });
    var titleEl = el('span', { class: 'ms-chat-conv-title', text: c.title || 'Beratung' });
    var meta = [ACCOUNT_COPY.msgCount(c.messageCount), convDate(c)].filter(Boolean).join(' · ');
    openBtn.appendChild(titleEl);
    openBtn.appendChild(el('span', { class: 'ms-chat-conv-meta', text: meta }));
    openBtn.addEventListener('click', function () { openConversation(c.conversationId); });
    item.appendChild(openBtn);

    var acts = el('div', { class: 'ms-chat-conv-acts' });
    var renameBtn = el('button', { class: 'ms-chat-iconbtn ms-chat-conv-act', type: 'button', 'aria-label': ACCOUNT_COPY.rename, title: ACCOUNT_COPY.rename });
    renameBtn.appendChild(icon('pencil'));
    renameBtn.addEventListener('click', function () { startRename(item, c, titleEl); });
    var delBtn = el('button', { class: 'ms-chat-iconbtn ms-chat-conv-act', type: 'button', 'aria-label': ACCOUNT_COPY.del, title: ACCOUNT_COPY.del });
    delBtn.appendChild(icon('trash'));
    delBtn.addEventListener('click', function () { startDelete(item, c); });
    acts.appendChild(renameBtn);
    acts.appendChild(delBtn);
    item.appendChild(acts);
    return item;
  }

  // Inline rename (PATCH /api/account/conversations/{id}) — no native prompt.
  function startRename(item, c, titleEl) {
    if (item.querySelector('.ms-chat-conv-edit')) return;
    item.classList.add('ms-chat-conv--editing');
    var form = el('form', { class: 'ms-chat-conv-edit' });
    var input = el('input', { type: 'text', value: c.title || '', maxlength: '80', 'aria-label': ACCOUNT_COPY.rename });
    var save = el('button', { type: 'submit', class: 'ms-chat-conv-mini ms-chat-conv-mini--primary', text: ACCOUNT_COPY.save });
    var cancel = el('button', { type: 'button', class: 'ms-chat-conv-mini', text: ACCOUNT_COPY.cancel });
    form.appendChild(input);
    form.appendChild(save);
    form.appendChild(cancel);
    function done() { item.classList.remove('ms-chat-conv--editing'); if (form.parentNode) form.remove(); }
    cancel.addEventListener('click', done);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var next = input.value.trim();
      if (!next) { try { input.focus(); } catch (er) {} return; }
      save.disabled = true;
      fetch(API_BASE + '/api/account/conversations/' + encodeURIComponent(c.conversationId), {
        method: 'PATCH',
        headers: Object.assign({ 'Content-Type': 'application/json' }, accountHeaders()),
        body: JSON.stringify({ title: next })
      }).then(function (r) {
        if (r.status === 401) { accountUnauthorized(); throw 0; }
        return r.ok ? r.json() : null;
      }).then(function (data) {
        if (data && data.ok) { c.title = data.title; titleEl.textContent = data.title; track('conversation_renamed', {}); }
        done();
      }).catch(function (er) { if (er === 0) return; save.disabled = false; });
    });
    item.appendChild(form);
    setTimeout(function () { try { input.focus(); input.select(); } catch (e) {} }, 30);
  }

  // Inline two-step delete (DELETE /api/account/conversations/{id}). Honest
  // wording per CUSTOMER_ACCOUNT.md §7.4 — "this chat", not "all data".
  function startDelete(item, c) {
    if (item.querySelector('.ms-chat-conv-confirm')) return;
    item.classList.add('ms-chat-conv--confirm');
    var bar = el('div', { class: 'ms-chat-conv-confirm' });
    bar.appendChild(el('span', { class: 'ms-chat-conv-confirm-text', text: ACCOUNT_COPY.deleteConfirm }));
    var yes = el('button', { type: 'button', class: 'ms-chat-conv-mini ms-chat-conv-mini--danger', text: ACCOUNT_COPY.deleteYes });
    var no = el('button', { type: 'button', class: 'ms-chat-conv-mini', text: ACCOUNT_COPY.cancel });
    bar.appendChild(yes);
    bar.appendChild(no);
    function done() { item.classList.remove('ms-chat-conv--confirm'); if (bar.parentNode) bar.remove(); }
    no.addEventListener('click', done);
    yes.addEventListener('click', function () {
      yes.disabled = true;
      fetch(API_BASE + '/api/account/conversations/' + encodeURIComponent(c.conversationId), { method: 'DELETE', headers: accountHeaders() })
        .then(function (r) {
          if (r.status === 401) { accountUnauthorized(); throw 0; }
          return r.ok ? r.json() : null;
        })
        .then(function (data) {
          if (data && data.deleted) {
            track('conversation_deleted', {});
            // If the active thread was deleted, clear the local view too.
            if (activeConversationId != null && c.conversationId === activeConversationId) {
              lsDel(historyKey()); messages = []; activeConversationId = null; clearConvKey(); renderAllMessages();
            }
            item.remove();
            if (!historyListEl.querySelector('.ms-chat-conv')) renderConversations([]);
          } else { done(); }
        })
        .catch(function (er) { if (er === 0) return; yes.disabled = false; });
    });
    item.appendChild(bar);
  }

  // Open a past conversation: fetch the transcript and load it into the local
  // view as the active thread (GET /api/account/conversations/{id}). The
  // transcript carries readable turns only (§7.2); we render them as text
  // bubbles and persist under the current session so a reload keeps them.
  function transcriptToMessages(conv) {
    var out = [];
    var arr = (conv && conv.messages) || [];
    for (var i = 0; i < arr.length; i++) {
      var m = arr[i];
      if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
      out.push({ id: m.role.charAt(0) + '-' + uuid(), role: m.role, parts: [{ type: 'text', text: m.content || '' }] });
    }
    return out;
  }
  function openConversation(id) {
    fetch(API_BASE + '/api/account/conversations/' + encodeURIComponent(id), { method: 'GET', headers: accountHeaders() })
      .then(function (r) {
        if (r.status === 401) { accountUnauthorized(); throw 0; }
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        var conv = data && data.conversation;
        if (!conv) throw new Error('no conversation');
        track('conversation_opened', {});
        messages = transcriptToMessages(conv).slice(-40);
        activeConversationId = conv.conversationId;
        // Adopt this thread's key so the next /api/chat turn appends to it
        // (CUSTOMER_ACCOUNT.md §7.6) and the summary download targets it (§8).
        activeConversationKey = conv.conversationKey || null;
        saveConvKey();
        saveHistory();
        if (rateTimer) { clearTimeout(rateTimer); rateTimer = null; }
        state.rateLocked = false;
        state.streaming = false;
        updateInputState();
        renderAllMessages();
        closeHistory();
        scrollToBottom();
      })
      .catch(function (e) {
        if (e === 0) return;
        closeHistory();
        showMessageError(ACCOUNT_COPY.openError);
      });
  }

  // Delete ALL my data (POST /api/account/erase, §7.5) — distinct, heavier than
  // a per-chat delete. Two-step inline confirm in the drawer footer.
  function buildEraseControl(wrap) {
    wrap.replaceChildren();
    var btn = el('button', { class: 'ms-chat-history-link ms-chat-history-erase-btn', type: 'button', text: ACCOUNT_COPY.erase });
    btn.addEventListener('click', function () {
      var box = el('div', { class: 'ms-chat-erase-confirm' });
      box.appendChild(el('div', { class: 'ms-chat-erase-text', text: ACCOUNT_COPY.eraseConfirm }));
      var row = el('div', { class: 'ms-chat-erase-actions' });
      var yes = el('button', { type: 'button', class: 'ms-chat-conv-mini ms-chat-conv-mini--danger', text: ACCOUNT_COPY.eraseYes });
      var no = el('button', { type: 'button', class: 'ms-chat-conv-mini', text: ACCOUNT_COPY.cancel });
      row.appendChild(yes);
      row.appendChild(no);
      box.appendChild(row);
      var msg = el('div', { class: 'ms-chat-erase-msg', style: 'display:none' });
      box.appendChild(msg);
      wrap.replaceChildren(box);
      no.addEventListener('click', function () { buildEraseControl(wrap); });
      yes.addEventListener('click', function () {
        yes.disabled = true; no.disabled = true;
        fetch(API_BASE + '/api/account/erase', { method: 'POST', headers: accountHeaders() })
          .then(function (r) {
            if (r.status === 401) { return { erased: true }; } // already gone -> treat as done
            if (!r.ok) throw new Error('erase ' + r.status); // 503 etc. -> retry
            return r.json();
          })
          .then(function (data) {
            if (data && data.erased) {
              track('account_erased', {});
              lsDel(historyKey()); messages = []; activeConversationId = null; clearConvKey();
              applyAuth(null); // session no longer resolves
              renderAllMessages();
              closeHistory();
            } else { throw new Error('not erased'); }
          })
          .catch(function () { msg.style.display = ''; msg.textContent = ACCOUNT_COPY.eraseError; yes.disabled = false; no.disabled = false; });
      });
    });
    wrap.appendChild(btn);
  }

  // ---------------------------------------------------------------------------
  // Init.
  // ---------------------------------------------------------------------------
  function init() {
    buildShell();
    autoGrow(); // size the input to its clean single-line height up front
    renderAllMessages();
    updateInputState();
    // Server-rendered orb spans (the product-page CTA renders an empty
    // .ms-chat-logo span in the template) get the same wave SVG as the
    // JS-built ones.
    try {
      var orbs = document.querySelectorAll('.ms-chat-logo');
      for (var oi = 0; oi < orbs.length; oi++) {
        if (!orbs[oi].firstElementChild) orbs[oi].appendChild(logoWaves());
      }
    } catch (e) {}
    window.MS_CHAT = window.MS_CHAT || {};
    window.MS_CHAT.openWithProduct = openWithProduct;
    window.MS_CHAT.openEmailSummary = openCaptureForm;
    bindProductCtas();
    // Engagement layer: record this page in the local browsing trail, arm the
    // contextual nudge triggers, play the one-time launcher attention motion.
    recordTrail();
    initNudgeTriggers();
    playLauncherAttention();
    // Customer Account: process a sign-in/logout return marker (?ms_auth=…),
    // re-hydrating identity and re-opening the panel onto the SAME conversation.
    handleAuthReturn();
  }

  // Delegated handler for storefront product-page CTAs. Reading product id +
  // title from data-* attributes (not an inline onclick) keeps it robust no
  // matter what quotes/apostrophes a product title contains.
  function bindProductCtas() {
    document.addEventListener('click', function (e) {
      var t = e.target;
      var btn = t && t.closest ? t.closest('.ms-chat-product-cta') : null;
      if (!btn) return;
      e.preventDefault();
      openWithProduct(btn.getAttribute('data-ms-chat-product-id'), btn.getAttribute('data-ms-chat-product-title'));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

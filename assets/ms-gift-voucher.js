/*
 * Gutschein-Designer — page logic of sections/ms-gift-voucher.liquid
 * (vanilla ES5, no dependencies).
 *
 * Five steps — Betrag → Motiv → Text → Versand → Prüfen & kaufen — with the
 * progress line on top (done steps blue with a tick and clickable, the
 * current one outlined, the rest grey; a narrow card shows only the dots
 * plus „Schritt 2 von 5 · Motiv“), a live preview card (the design's
 * previewSvg from Mo with the texts laid over it in HTML; the message in
 * Caveat from Mo's font route) and, while the layout is one column, a sticky
 * bar with the total and „Weiter“ that keeps clear of the Mo launcher.
 *
 * Config reaches the page only through the section's data attributes and its
 * products JSON (the amount variants + the Premium-Karte add-on — amounts
 * never come from anywhere else); the rest from the Mo backend (mo repo,
 * gift voucher spec §8):
 *   GET  /api/gift-vouchers/config?locale=   designs, features, limits
 *   POST /api/gift-vouchers/photo           the photo (downscaled here) → photoId
 *   POST /api/gift-vouchers/suggest         { occasion, tone, locale } → 1–3 texts
 *   POST /api/gift-vouchers/preview         the exact server images (step 5)
 *   POST /api/gift-vouchers/drafts          → token
 *   POST /api/gift-vouchers/balance         { code } → balance („Guthaben prüfen“)
 * POSTs carry x-ms-chat-key, x-ms-session (the widget's localStorage
 * ms-chat-sid — created here the way the widget does when it is missing) and
 * x-ms-locale; no other header (CORS) and never credentials. Errors are
 * { error: { code, message } }: Mo's message is shown as it is — except its
 * generic English ones (429, 401/403, 500), which get a friendly line of our
 * own like a network error; a 409 (Mo stopped selling during the visit)
 * turns the designer into the fallback.
 *
 * Buying: drafts → POST /cart/add.js (the theme's route) with the voucher
 * line and, for the Premium-Karte, the add-on line — both carry the private
 * property _mo_gv=<token> (Mo links the design with it; the visible
 * properties are for the cart and the order) — then /checkout („Jetzt
 * kaufen“) or the cart drawer („In den Warenkorb“: cart:refresh +
 * <cart-modal>.reloadContent().then(show), as the widget's plan does).
 * An edit after that replaces the voucher in the cart: the new lines go in
 * first, then the earlier version's lines (their keys from the add) come out
 * via /cart/change.js; „Noch einen Gutschein gestalten“ starts a second one.
 * On load and on entering step 5 the page reads GET /cart.js: lines bought
 * meanwhile or removed in the drawer no longer count as in the cart.
 * The page's draft (names, message, address) stays in sessionStorage
 * ms-gv-draft — never in a URL. No KPI events in v1, no JS globals.
 * Re-initialises on the theme editor's shopify:section:load (and tears down
 * on shopify:section:unload).
 */
(function () {
  'use strict';

  function boot(scope) {
    var host = scope && scope.querySelectorAll ? scope : document;
    var roots = host.querySelectorAll('[data-ms-gv]');
    if (host !== document && host.matches && host.matches('[data-ms-gv]')) setup(host);
    for (var i = 0; i < roots.length; i++) setup(roots[i]);
  }
  // A second copy of this file (the section added twice) registers these
  // listeners again — harmless: setup() is guarded per root (root.__msGv) and
  // a teardown runs once (it removes itself).
  document.addEventListener('shopify:section:load', function (e) { boot(e.target); });
  document.addEventListener('shopify:section:unload', function (e) {
    var t = e.target;
    var roots = t && t.querySelectorAll ? t.querySelectorAll('[data-ms-gv]') : [];
    for (var i = 0; i < roots.length; i++) if (typeof roots[i].__msGvTeardown === 'function') roots[i].__msGvTeardown();
  });
  boot(document);

  function setup(root) {
    if (root.__msGv) return;
    root.__msGv = true;
    var EN = root.getAttribute('data-locale') === 'en';
    var LOCALE = EN ? 'en' : 'de';
    function T(de, en) { return EN ? en : de; }
    var uid = root.id || 'ms-gv';

    // Everything this root registers outside itself, undone on unload.
    var cleanups = [];
    var torn = false;
    function on(target, type, fn, opts) {
      if (!target || !target.addEventListener) return;
      target.addEventListener(type, fn, opts || false);
      cleanups.push(function () { target.removeEventListener(type, fn, opts || false); });
    }
    root.__msGvTeardown = function () {
      torn = true;
      while (cleanups.length) { try { cleanups.pop()(); } catch (e) {} }
      root.__msGv = false;
      root.__msGvTeardown = null;
    };

    // ----- settings from the section ------------------------------------------
    function cleanBase(v) {
      v = String(v || '').replace(/^\s+|\s+$/g, '').replace(/\/+$/, '');
      return /^https?:\/\/[^\s"'<>\\]+$/i.test(v) ? v : '';
    }
    var API = cleanBase(root.getAttribute('data-api-base'));
    var KEY = root.getAttribute('data-key') || '';
    var MO_ON = root.getAttribute('data-mo') === 'on' && !!API && !!KEY;
    var FALLBACK_URL = root.getAttribute('data-fallback-url') || '/';
    var TERMS_SETTING = root.getAttribute('data-terms-url') || '';
    var DESIGN_MODE = root.getAttribute('data-design-mode') === 'true';

    // ----- icons ---------------------------------------------------------------
    var ICON = {
      check: '<path d="M20 6 9 17l-5-5"/>',
      arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
      arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
      sparkle: '<path d="M10 3.5 11.8 8.2 16.5 10l-4.7 1.8L10 16.5l-1.8-4.7L3.5 10l4.7-1.8z"/><path d="M18 14.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/>',
      camera: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.5"/>',
      upload: '<path d="M12 15.5V4M7 9l5-5 5 5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>',
      trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
      mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6.5L20.5 7"/>',
      card: '<rect x="3.5" y="4" width="17" height="16" rx="1.5"/><path d="M12 4v16"/><path d="M14.8 9.5h3M14.8 12.5h3"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.01"/>',
      alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
      refresh: '<path d="M20 11.5a8 8 0 1 1-2.6-6"/><path d="M20 4v5h-5"/>',
      lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
      cartIcon: '<path d="M3 4h2.2l2.1 10.5h10.4L20 7H6.4"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
      image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5.2-5.2 3.6 3.6 2.4-2.4L20 18.8"/>',
      shield: '<path d="M12 3 5 6v5.5c0 4.4 3 7.9 7 9.5 4-1.6 7-5.1 7-9.5V6z"/><path d="m9 12 2 2 4-4"/>'
    };
    function icon(name, cls) {
      return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICON[name] || '') + '</svg>';
    }

    // ----- small helpers ---------------------------------------------------------
    function el(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null && text !== '') n.textContent = text;
      return n;
    }
    function setText(n, t) { if (n && n.textContent !== t) n.textContent = t; }
    function ssGet(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }
    function ssSet(k, v) { try { window.sessionStorage.setItem(k, v); return true; } catch (e) { return false; } }
    function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
    function reducedMotion() {
      try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }
    function focusEl(n) {
      if (!n) return;
      try { n.focus({ preventScroll: true }); } catch (e) { try { n.focus(); } catch (e2) {} }
    }
    function uuid() {
      try { if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID(); } catch (e) {}
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        var v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
    // The widget's session id (assets/ms-chat-widget.js → getSid): the same
    // localStorage key, created the same way when the widget has not run yet.
    var memSid = null;
    function sessionId() {
      var sid = lsGet('ms-chat-sid');
      if (!sid) {
        sid = memSid || uuid();
        memSid = sid;
        lsSet('ms-chat-sid', sid);
      }
      return sid;
    }
    function stickyTop() {
      var v = parseFloat(window.getComputedStyle(root).getPropertyValue('--gv-sticky-top'));
      return v > 0 ? v : 112;
    }
    // Scroll an element into view below the sticky header — only when it is
    // not already comfortably visible.
    function reveal(n, block) {
      if (!n) return;
      try {
        var r = n.getBoundingClientRect();
        var top = stickyTop();
        var vh = window.innerHeight || document.documentElement.clientHeight;
        if (r.top >= top - 1 && r.bottom <= vh - 8) return;
        if (block === 'center' && r.height < vh - top) {
          window.scrollBy({ top: r.top - top - (vh - top - r.height) / 2, left: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
          return;
        }
        n.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      } catch (e) {}
    }

    // ----- money ---------------------------------------------------------------------
    var NUM_LOCALE = EN ? 'en-GB' : 'de-DE';
    function money(cents, currency) {
      var cur = currency || 'EUR';
      try { return new Intl.NumberFormat(NUM_LOCALE, { style: 'currency', currency: cur }).format(cents / 100); } catch (e) {}
      var s = (cents / 100).toFixed(2);
      return EN ? '€' + s : s.replace('.', ',') + ' €';
    }
    // The face value as on the voucher: „50 €“ — cents only when there are any.
    function amountLabel(cents) {
      if (cents % 100 !== 0) return money(cents, 'EUR');
      try { return new Intl.NumberFormat(NUM_LOCALE, { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100); } catch (e) {}
      return EN ? '€' + cents / 100 : cents / 100 + ' €';
    }

    // ----- products (Liquid) -----------------------------------------------------------
    // The voucher's face value is its variant price in euros. In another
    // presentment currency (the country selector) Shopify converts the price,
    // so the value then comes from the variant title („50 €“) when it names one.
    function faceValue(price, title, currency) {
      if (currency === 'EUR') return price;
      var m = /(\d{1,5})(?:[.,](\d{1,2}))?/.exec(title || '');
      if (!m) return price;
      return parseInt(m[1], 10) * 100 + (m[2] ? parseInt((m[2] + '0').slice(0, 2), 10) : 0);
    }
    var PRODUCTS = (function () {
      var out = { currency: 'EUR', voucher: [], print: null, issue: '' };
      var node = root.querySelector('script[data-ms-gv-products]');
      var raw = null;
      try { raw = JSON.parse(node ? node.textContent : 'null'); } catch (e) { raw = null; }
      if (!raw || typeof raw !== 'object') return out;
      if (typeof raw.currency === 'string' && /^[A-Z]{3}$/.test(raw.currency)) out.currency = raw.currency;
      // The section's own check of the products (e.g. a Shopify gift card
      // product picked as „Gutschein-Produkt“ — Liquid then lists no amounts).
      if (typeof raw.issue === 'string' && /^[a-z_]{1,30}$/.test(raw.issue)) out.issue = raw.issue;
      var seen = {};
      (Array.isArray(raw.voucher) ? raw.voucher : []).forEach(function (v) {
        if (!v || typeof v !== 'object') return;
        var id = Number(v.id);
        var price = Math.round(Number(v.priceCents));
        if (!isFinite(id) || id <= 0 || seen[id] || !isFinite(price) || price <= 0) return;
        seen[id] = true;
        var title = typeof v.title === 'string' ? v.title.slice(0, 80) : '';
        out.voucher.push({ id: id, priceCents: price, title: title, available: v.available !== false, faceCents: faceValue(price, title, out.currency) });
      });
      out.voucher.sort(function (a, b) { return a.faceCents - b.faceCents; });
      var p = raw.print;
      if (p && typeof p === 'object' && Number(p.id) > 0 && isFinite(Number(p.priceCents)) && Number(p.priceCents) >= 0 && p.available !== false) {
        out.print = { id: Number(p.id), priceCents: Math.round(Number(p.priceCents)), title: typeof p.title === 'string' ? p.title.slice(0, 80) : '' };
      }
      return out;
    })();
    function variantById(id) {
      for (var i = 0; i < PRODUCTS.voucher.length; i++) if (PRODUCTS.voucher[i].id === id) return PRODUCTS.voucher[i];
      return null;
    }

    // ----- texts: the printable repertoire ----------------------------------------------
    // The same rule as Mo's sanitizeGiftVoucherText (isPrintableCodePoint):
    // the voucher fonts draw Basic Latin, Latin-1, Latin Extended-A without
    // the long s ſ (the handwriting font Caveat has no glyph for it), € and
    // the typographic punctuation „ “ ” ‚ ‘ ’ – — … • · ‹ ›. Everything else
    // (emoji, ſ, other scripts, symbols) is removed while typing — with a
    // note at the field — so the preview shows exactly what will be printed.
    var PRINTABLE = /[ -~ -¬®-ž€‚“”„‘’–—…•‹›]/;
    var SILENT = /[\u0000-\u001f\u007f-\u009f­​‌‎‏‪-‮⁠-⁤⁦-⁩︎﻿]/;
    function liveClean(value, max, maxLines, multiline) {
      var s = String(value == null ? '' : value);
      if (s.normalize) { try { s = s.normalize('NFC'); } catch (e) {} }
      s = s.replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
      var out = '';
      var removed = false;
      var limited = false;
      for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i);
        var code = s.charCodeAt(i);
        if (ch === '\n') { out += multiline ? '\n' : ' '; continue; }
        if (code >= 0xd800 && code <= 0xdbff) { i++; removed = true; continue; }
        if (code >= 0xdc00 && code <= 0xdfff) { removed = true; continue; }
        if (PRINTABLE.test(ch)) { out += ch; continue; }
        if (!SILENT.test(ch)) removed = true;
      }
      if (multiline && maxLines) {
        var lines = out.split('\n');
        if (lines.length > maxLines) {
          out = lines.slice(0, maxLines - 1).concat([lines.slice(maxLines - 1).join(' ')]).join('\n');
          limited = true;
        }
      }
      if (max && out.length > max) { out = out.slice(0, max); limited = true; }
      return { text: out, removed: removed, limited: limited };
    }
    // What is sent and drawn: spaces collapsed, lines trimmed, no blank line
    // at the start or the end, at most one empty line in a row.
    function finalText(v) {
      return String(v || '').split('\n').map(function (l) { return l.replace(/[  ]+/g, ' ').replace(/^ +| +$/g, ''); })
        .join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
    }
    function finalLine(v) { return String(v || '').replace(/\s+/g, ' ').replace(/^ +| +$/g, ''); }
    // Clean an input in place, keeping the caret where the visitor typed.
    function applyClean(input, max, maxLines, multiline) {
      var v = input.value;
      var r = liveClean(v, max, maxLines, multiline);
      if (r.text !== v) {
        var pos = typeof input.selectionStart === 'number' ? input.selectionStart : v.length;
        var caret = Math.min(liveClean(v.slice(0, pos), max, maxLines, multiline).text.length, r.text.length);
        input.value = r.text;
        try { if (document.activeElement === input) input.setSelectionRange(caret, caret); } catch (e) {}
      }
      return r;
    }
    // Mo writes its suggestions with the literal placeholders {{fuer}}
    // (recipient) and {{von}} (sender) — no names ever go to the model. The
    // page fills them in; a salutation or sign-off line whose placeholder is
    // empty („Liebe {{fuer}},“ / „Dein {{von}}“) is dropped, a placeholder
    // inside a longer sentence is taken out with its comma.
    // The closing line with {{von}}: the voucher prints the sender under the
    // message anyway („— Jonas“), so the name is not repeated there — „Dein
    // {{von}}“ goes, „Von Herzen, {{von}}“ keeps „Von Herzen“.
    var RE_FUER = /\{\{\s*f(?:ue|ü)r\s*\}\}/gi;
    var RE_VON = /\{\{\s*von\s*\}\}/gi;
    var CLOSING_TAIL = /[\s,;:–—-]*\b(?:dein|deine|deinem|deiner|euer|eure|eurem|eurer|von|your|yours|from)\s*$/i;
    function hasRe(re, s) { re.lastIndex = 0; var r = re.test(s); re.lastIndex = 0; return r; }
    function closingWithoutName(line) {
      var rest = line.replace(RE_VON, ' ').replace(/[ \t]+/g, ' ').replace(/^ +| +$/g, '');
      var prev = null;
      while (rest !== prev) { prev = rest; rest = rest.replace(CLOSING_TAIL, '').replace(/[\s,;:–—-]+$/, ''); }
      rest = rest.replace(/^[\s,;:–—-]+/, '').replace(/ +([,.!?;:])/g, '$1');
      return rest.replace(/[^A-Za-zÀ-ž]/g, '').length > 2 ? rest : '';
    }
    function fillSuggestion(text, fuer, von) {
      var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
      var last = -1;
      for (var n = lines.length - 1; n >= 0; n--) if (/\S/.test(lines[n])) { last = n; break; }
      var out = [];
      lines.forEach(function (line, idx) {
        var f = hasRe(RE_FUER, line);
        var v = hasRe(RE_VON, line);
        if (v && von && idx === last) {
          line = closingWithoutName(line);
          if (!line) return;
          v = false;
        }
        if ((f && !fuer) || (v && !von)) {
          var rest = line.replace(RE_FUER, '').replace(RE_VON, '').replace(/[\s,.;:!?–—-]+/g, '');
          if (rest.length <= 24) return;
          if (f && !fuer) line = line.replace(/[ \t]*,?[ \t]*\{\{\s*f(?:ue|ü)r\s*\}\}[ \t]*/gi, ' ');
          if (v && !von) line = line.replace(/[ \t]*,?[ \t]*\{\{\s*von\s*\}\}[ \t]*/gi, ' ');
          line = line.replace(/ {2,}/g, ' ').replace(/ +([,.!?;:])/g, '$1').replace(/,([.!?])/g, '$1').replace(/^ +| +$/g, '');
        }
        out.push(line.replace(RE_FUER, function () { return fuer; }).replace(RE_VON, function () { return von; }));
      });
      return out.join('\n').replace(/^\s*\n+/, '').replace(/\n+\s*$/, '').replace(/\n{3,}/g, '\n\n');
    }

    // ----- draft (sessionStorage, this tab only) ---------------------------------------
    var DRAFT_KEY = 'ms-gv-draft';
    function blankAddress() { return { name: '', line1: '', line2: '', postalCode: '', city: '', country: 'DE' }; }
    // added: the draft key of the version in the cart; addedLines: its cart
    // line keys („variant:hash“ from /cart/add.js) — an edit replaces it.
    function defaults() {
      return { v: 1, step: 0, done: [false, false, false, false, false], variantId: null, designKey: null, photo: null,
        recipient: '', sender: '', message: '', delivery: 'pdf', address: blankAddress(), occasion: null, tone: null, added: null, addedLines: null };
    }
    function str(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
    var LINE_KEY = /^\d{1,20}:[0-9a-f]{8,64}$/;
    // At most four line keys (a voucher line and its card line) or null.
    function lineKeys(list) {
      if (!Array.isArray(list) || !list.length || list.length > 4) return null;
      for (var i = 0; i < list.length; i++) if (typeof list[i] !== 'string' || !LINE_KEY.test(list[i])) return null;
      return list.slice();
    }
    function loadDraft() {
      var s = defaults();
      var raw = null;
      try { raw = JSON.parse(ssGet(DRAFT_KEY) || 'null'); } catch (e) { raw = null; }
      if (!raw || typeof raw !== 'object' || raw.v !== 1) return s;
      s.step = raw.step >= 0 && raw.step <= 4 ? Math.floor(raw.step) : 0;
      if (Array.isArray(raw.done)) for (var i = 0; i < 5; i++) s.done[i] = raw.done[i] === true;
      if (typeof raw.variantId === 'number') s.variantId = raw.variantId;
      if (typeof raw.designKey === 'string' && /^[a-z0-9_-]{1,40}$/.test(raw.designKey)) s.designKey = raw.designKey;
      var p = raw.photo;
      if (p && typeof p === 'object' && /^[A-Za-z0-9_-]{22,64}$/.test(p.id || '') && typeof p.thumb === 'string' && /^data:image\/jpeg;base64,/.test(p.thumb)) {
        // w × h: the size Mo stored (0 = unknown — then no „recht klein“ note).
        s.photo = { id: p.id, thumb: p.thumb, w: Number(p.w) || 0, h: Number(p.h) || 0 };
      }
      s.recipient = str(raw.recipient, 80);
      s.sender = str(raw.sender, 80);
      s.message = str(raw.message, 700);
      s.delivery = raw.delivery === 'print' ? 'print' : 'pdf';
      var a = raw.address && typeof raw.address === 'object' ? raw.address : {};
      s.address = { name: str(a.name, 120), line1: str(a.line1, 160), line2: str(a.line2, 160), postalCode: str(a.postalCode, 20), city: str(a.city, 120), country: /^[A-Z]{2}$/.test(a.country || '') ? a.country : 'DE' };
      s.occasion = typeof raw.occasion === 'string' ? raw.occasion.slice(0, 40) : null;
      s.tone = typeof raw.tone === 'string' ? raw.tone.slice(0, 40) : null;
      s.added = typeof raw.added === 'string' ? raw.added.slice(0, 4000) : null;
      s.addedLines = s.added ? lineKeys(raw.addedLines) : null;
      return s;
    }
    var state = loadDraft();
    var saveTimer = null;
    function writeDraft() {
      saveTimer = null;
      var data = JSON.stringify(state);
      if (ssSet(DRAFT_KEY, data)) return;
      // Over the storage quota (the photo thumbnail): keep the rest.
      try {
        var copy = JSON.parse(data);
        copy.photo = null;
        ssSet(DRAFT_KEY, JSON.stringify(copy));
      } catch (e) {}
    }
    function save(now) {
      clearTimeout(saveTimer);
      if (now) { writeDraft(); return; }
      saveTimer = setTimeout(writeDraft, 250);
    }
    cleanups.push(function () { if (saveTimer) writeDraft(); });

    // ----- backend -------------------------------------------------------------------
    function guardedHeaders(contentType) {
      return { 'Content-Type': contentType || 'application/json', 'x-ms-chat-key': KEY, 'x-ms-session': sessionId(), 'x-ms-locale': LOCALE };
    }
    // Any response → { ok, status, data } or { ok:false, status, code, message, field, network }.
    function normalize(status, j) {
      if (status >= 200 && status < 300 && j && j.ok === true) return { ok: true, status: status, data: j };
      var err = j && j.error && typeof j.error === 'object' ? j.error : null;
      return {
        ok: false,
        status: status,
        code: err && typeof err.code === 'string' ? err.code.slice(0, 60) : '',
        message: err && typeof err.message === 'string' ? err.message.replace(/\s+/g, ' ').slice(0, 300) : '',
        field: err && typeof err.field === 'string' ? err.field.slice(0, 60) : ''
      };
    }
    function request(method, path, body, timeoutMs) {
      return new Promise(function (resolve) {
        var done = false;
        var ctrl = null;
        var timer = null;
        function finish(r) { if (done) return; done = true; clearTimeout(timer); resolve(r); }
        if (typeof window.fetch !== 'function' || !API) { finish({ ok: false, status: 0, network: true }); return; }
        try { ctrl = typeof window.AbortController === 'function' ? new window.AbortController() : null; } catch (e) { ctrl = null; }
        timer = setTimeout(function () {
          try { if (ctrl) ctrl.abort(); } catch (e) {}
          finish({ ok: false, status: 0, network: true, timeout: true });
        }, timeoutMs || 20000);
        // The config GET is a simple request (no preflight, cacheable); the
        // writes carry the widget's guard headers.
        var init = { method: method, credentials: 'omit' };
        if (method === 'POST') {
          init.headers = guardedHeaders();
          init.body = JSON.stringify(body || {});
          init.cache = 'no-store';
        }
        if (ctrl) init.signal = ctrl.signal;
        try {
          window.fetch(API + path, init).then(function (r) {
            return r.text().then(function (t) {
              var j = null;
              try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
              finish(normalize(r.status, j));
            });
          }).catch(function () { finish({ ok: false, status: 0, network: true }); });
        } catch (e) { finish({ ok: false, status: 0, network: true }); }
      });
    }
    // Mo's own message wins (German with locale de) — except where Mo answers
    // in generic English by design (the shared guards and limiter: 429 „Too
    // many requests“, 401/403, 500 „Unexpected server error“); those, a
    // network error and an empty answer get a line of our own (as the chat
    // widget maps them by code).
    function errorText(res, de, en) {
      if (res && (res.status === 429 || res.code === 'rate_limited')) return T('Gerade kommen sehr viele Anfragen – bitte versuche es in ein paar Minuten noch einmal.', 'Too many requests right now – please try again in a few minutes.');
      if (!res || res.network || !res.status) return T('Die Verbindung hat gerade nicht geklappt. Bitte prüfe dein Internet und versuche es noch einmal.', 'The connection did not work. Please check your internet connection and try again.');
      if (res.message && res.code !== 'internal_error' && res.code !== 'unauthorized' && res.code !== 'forbidden') return res.message;
      return T(de, en);
    }

    // ----- config (Mo) ----------------------------------------------------------------
    var COLOR = /^#[0-9a-f]{3,8}$/i;
    var DEFAULT_COLORS = { background: '#15171a', ink: '#f3e7c6', accent: '#008ccb', muted: '#9aa3ab', insideBackground: '#fbfaf6', insideInk: '#1b1d20' };
    function svgUri(s) {
      if (typeof s !== 'string') return '';
      s = s.replace(/^\s+|\s+$/g, '');
      if (!/^<svg[\s>]/i.test(s) || s.length > 400000) return '';
      if (!/^<svg[^>]*\sxmlns=/i.test(s)) s = s.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    }
    function cleanList(list, max) {
      var out = [];
      (Array.isArray(list) ? list : []).forEach(function (o) {
        if (out.length >= 12 || !o || typeof o.key !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(o.key)) return;
        out.push({ key: o.key, label: str(o.label, max) || o.key });
      });
      return out;
    }
    function num(v, def, lo, hi) { v = Number(v); return isFinite(v) && v >= lo && v <= hi ? Math.floor(v) : def; }
    // The card's photo size (Mo's GIFT_VOUCHER_PHOTO_PRINT_MIN_SIDE): a photo
    // with a shorter side is accepted but prints soft on the 14 × 14 cm card.
    var PHOTO_PRINT_MIN_SIDE = 1000;
    var DEFAULT_LIMITS = { recipientName: 40, senderName: 40, message: 350, messageLines: 8, photoMaxBytes: 4000000, photoPrintMinSide: PHOTO_PRINT_MIN_SIDE };
    // Fails closed: no usable design → no designer.
    function cleanConfig(j) {
      if (!j || j.ok !== true) return null;
      var c = {
        available: j.available === true,
        reason: typeof j.unavailableReason === 'string' ? j.unavailableReason : null,
        designs: [],
        features: { ai: false, photo: false, print: false },
        limits: DEFAULT_LIMITS,
        occasions: cleanList(j.occasions, 40),
        tones: cleanList(j.tones, 40),
        print: { countries: ['DE'], deliveryNote: T('3–6 Werktage', '3–6 working days') },
        validity: { years: 3, until: '' },
        termsUrl: '',
        scriptFont: ''
      };
      var f = j.features && typeof j.features === 'object' ? j.features : {};
      c.features = { ai: f.ai === true, photo: f.photo === true, print: f.print === true };
      var l = j.limits && typeof j.limits === 'object' ? j.limits : {};
      c.limits = {
        recipientName: num(l.recipientName, 40, 1, 80),
        senderName: num(l.senderName, 40, 1, 80),
        message: num(l.message, 350, 1, 700),
        messageLines: num(l.messageLines, 8, 1, 20),
        photoMaxBytes: num(l.photoMaxBytes, 4000000, 200000, 4500000),
        // Only a number counts (Mo sends one): Number() would read null, ''
        // and false as 0 and switch both photo notes off, so anything that is
        // no number means absent (1000 px). A real 0 still means: no note.
        photoPrintMinSide: typeof l.photoPrintMinSide === 'number' ? num(l.photoPrintMinSide, PHOTO_PRINT_MIN_SIDE, 0, 10000) : PHOTO_PRINT_MIN_SIDE
      };
      var p = j.print && typeof j.print === 'object' ? j.print : {};
      var countries = (Array.isArray(p.countries) ? p.countries : []).filter(function (x) { return typeof x === 'string' && /^[A-Z]{2}$/.test(x); }).slice(0, 30);
      if (countries.length) c.print.countries = countries;
      if (typeof p.deliveryNote === 'string' && p.deliveryNote) c.print.deliveryNote = p.deliveryNote.slice(0, 60);
      var v = j.validity && typeof j.validity === 'object' ? j.validity : {};
      // The date as Mo writes it for the page's language: „31.12.2029“ /
      // „31 December 2029“ (untilText() shortens the English month).
      c.validity = { years: num(v.years, 3, 0, 10), until: typeof v.untilExample === 'string' && /^[0-9A-Za-z. ]{6,24}$/.test(v.untilExample) ? v.untilExample : '' };
      if (typeof j.termsUrl === 'string' && /^https:\/\/[^\s"'<>]+$/.test(j.termsUrl)) c.termsUrl = j.termsUrl;
      var fonts = j.fonts && typeof j.fonts === 'object' ? j.fonts : {};
      if (typeof fonts.script === 'string') {
        // Only a file of Mo's own font route, loaded from the page's backend
        // URL (Mo builds its URL on its public base, which may be another
        // spelling of the same backend) — the URL goes into a CSS url().
        var fm = /\/api\/gift-vouchers\/fonts\/([a-z0-9-]{1,40}\.ttf)$/.exec(fonts.script.replace(/^\s+|\s+$/g, ''));
        var fu = fm ? API + '/api/gift-vouchers/fonts/' + fm[1] : '';
        if (fu && /^[^\s"'()\\<>]+$/.test(fu)) c.scriptFont = fu;
      }
      var seen = {};
      (Array.isArray(j.designs) ? j.designs : []).forEach(function (d) {
        if (c.designs.length >= 24 || !d || typeof d.key !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(d.key) || seen[d.key]) return;
        seen[d.key] = true;
        var col = d.colors && typeof d.colors === 'object' ? d.colors : {};
        var colors = {};
        Object.keys(DEFAULT_COLORS).forEach(function (k) { colors[k] = typeof col[k] === 'string' && COLOR.test(col[k]) ? col[k] : DEFAULT_COLORS[k]; });
        var ps = d.previewSvg && typeof d.previewSvg === 'object' ? d.previewSvg : {};
        c.designs.push({
          key: d.key,
          name: str(d.name, 40) || d.key,
          description: str(d.description, 160),
          // What the PDF and the card print when the message is left empty
          // („Alles Gute zum Geburtstag!“) — cleaned like a typed message,
          // so the live preview shows only what the fonts print.
          defaultMessage: typeof d.defaultMessage === 'string' ? finalText(liveClean(d.defaultMessage.slice(0, 400), 120, c.limits.messageLines, true).text) : '',
          photo: d.photo === true,
          colors: colors,
          svg: { landscape: svgUri(ps.landscape), square: svgUri(ps.square) }
        });
      });
      if (c.available && !c.designs.length) return null;
      return c;
    }

    // ----- elements (Liquid) ---------------------------------------------------------
    var designer = root.querySelector('[data-ms-gv-designer]');
    var progressEl = root.querySelector('[data-ms-gv-progress]');
    var progressText = root.querySelector('[data-ms-gv-progress-text]');
    var stepsEl = root.querySelector('[data-ms-gv-steps]');
    var panelsEl = root.querySelector('[data-ms-gv-panels]');
    var loadingEl = root.querySelector('[data-ms-gv-loading]');
    var fallbackEl = root.querySelector('[data-ms-gv-fallback]');
    var previewEl = root.querySelector('[data-ms-gv-preview]');
    var stage = root.querySelector('[data-ms-gv-stage]');
    var badgeEl = root.querySelector('[data-ms-gv-preview-badge]');
    var noteEl = root.querySelector('[data-ms-gv-preview-note]');
    var summaryEl = root.querySelector('[data-ms-gv-summary]');
    var sideBtns = root.querySelectorAll('[data-ms-gv-side]');
    var gridEl = root.querySelector('.ms-gv-grid');

    // Live regions: polite status for async work, one alert per blocked click.
    var statusEl = el('p', 'ms-gv-sr');
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');
    var alertEl = el('p', 'ms-gv-sr');
    alertEl.setAttribute('role', 'alert');
    if (designer) { designer.appendChild(statusEl); designer.appendChild(alertEl); }
    var sayTimer = null;
    function say(msg) {
      clearTimeout(sayTimer);
      statusEl.textContent = '';
      sayTimer = setTimeout(function () { statusEl.textContent = msg || ''; }, 80);
    }
    var alertTimer = null;
    function alertSay(msg) {
      clearTimeout(alertTimer);
      alertEl.textContent = '';
      alertTimer = setTimeout(function () { alertEl.textContent = msg || ''; }, 60);
    }

    // ----- steps ------------------------------------------------------------------------
    var STEP_LABELS = [T('Betrag', 'Amount'), T('Motiv', 'Design'), T('Text', 'Message'), T('Versand', 'Delivery'), T('Prüfen & kaufen', 'Review & buy')];
    var NEXT_LABELS = [T('Weiter zum Motiv', 'Continue to design'), T('Weiter zum Text', 'Continue to message'), T('Weiter zum Versand', 'Continue to delivery'), T('Weiter zur Prüfung', 'Continue to review')];
    // Which step owns which error key (also the server's field names).
    var KEY_STEP = { amount: 0, design: 1, photo: 1, recipient: 2, sender: 2, message: 2, delivery: 3, 'addr-name': 3, 'addr-line1': 3, 'addr-line2': 3, 'addr-postal': 3, 'addr-city': 3, terms: 4 };

    var cfg = null;
    var DESIGNS = [];
    var ready = false;
    var side = 'front';
    var P = [];            // the step panels: { el, title, body, foot, next, back, hint }
    var errs = {};         // error key → function (message | null)
    var shown = {};        // error keys shown after a blocked click
    var extErr = {};       // error key → Mo's message for that field (drafts 400)

    function designByKey(k) {
      for (var i = 0; i < DESIGNS.length; i++) if (DESIGNS[i].key === k) return DESIGNS[i];
      return null;
    }
    function photoAllowed() { return !!(cfg && cfg.features.photo); }
    function printAllowed() { return !!(cfg && cfg.features.print && PRODUCTS.print); }
    function aiAllowed() { return !!(cfg && cfg.features.ai && cfg.occasions.length && cfg.tones.length); }
    function visibleDesigns() { return DESIGNS.filter(function (d) { return !d.photo || photoAllowed(); }); }
    function selectedVariant() { var v = variantById(state.variantId); return v && v.available ? v : null; }
    function selectedDesign() { var d = designByKey(state.designKey); return d && (!d.photo || photoAllowed()) ? d : null; }
    function isPrint() { return state.delivery === 'print' && printAllowed(); }
    function layout() { return isPrint() ? 'square' : 'landscape'; }
    // The photo of „Eigenes Foto“ as Mo stored it (the width × height it
    // answered) against the card's print size (limits.photoPrintMinSide): a
    // shorter side is accepted, but prints soft — a note, never a block.
    function photoSoft() {
      var p = state.photo;
      var d = selectedDesign();
      var shortSide = p && p.id ? Math.min(p.w, p.h) : 0;
      return !!(d && d.photo) && shortSide > 0 && shortSide < limits().photoPrintMinSide;
    }
    function cardPhotoText() {
      return T('Für die gedruckte Karte ist das Foto recht klein – es kann unscharf wirken. Ein größeres Foto sieht auf 14 × 14 cm besser aus.', 'The photo is quite small for the printed card – it may look soft. A larger photo looks better at 14 × 14 cm.');
    }
    function limits() { return cfg ? cfg.limits : DEFAULT_LIMITS; }
    function countries() { return cfg ? cfg.print.countries : ['DE']; }
    function country() {
      var list = countries();
      return list.indexOf(state.address.country) !== -1 ? state.address.country : list[0];
    }
    function countryName(code) {
      try { if (window.Intl && Intl.DisplayNames) return new Intl.DisplayNames([LOCALE], { type: 'region' }).of(code); } catch (e) {}
      return code === 'DE' ? T('Deutschland', 'Germany') : code;
    }
    // The validity date as the voucher prints it: „31.12.2029“ / „31 Dec 2029“
    // (Mo's config says „31 December 2029“ on the English page).
    function untilText() {
      var u = cfg && cfg.validity.until;
      if (!u) return '';
      if (!EN) return u;
      var m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(u);
      var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return m ? parseInt(m[1], 10) + ' ' + months[parseInt(m[2], 10) - 1] + ' ' + m[3] : u.replace(/\b([A-Z][a-z]{2})[a-z]+\b/, '$1');
    }
    function validityLine() {
      if (cfg && cfg.validity.years === 0) return T('Unbegrenzt gültig', 'No expiry date');
      var u = untilText();
      return u ? T('Gültig bis ', 'Valid until ') + u : validityFact();
    }
    function termsUrl() {
      if (TERMS_SETTING) return TERMS_SETTING;
      if (cfg && cfg.termsUrl) return cfg.termsUrl;
      return '/pages/gutscheinbedingungen';
    }

    // ----- problems per step ------------------------------------------------------------
    // The postcode as Mo stores it: German ones without spaces („803 31“ → „80331“).
    function postalCode() {
      var pc = finalLine(state.address.postalCode);
      return country() === 'DE' ? pc.replace(/\s+/g, '') : pc.toUpperCase();
    }
    function addressProblems() {
      var a = state.address;
      var out = [];
      var name = finalLine(a.name);
      var l1 = finalLine(a.line1);
      var pc = postalCode();
      var city = finalLine(a.city);
      if (!name) out.push({ key: 'addr-name', msg: T('Bitte gib den Namen an.', 'Please enter the name.') });
      if (!l1) out.push({ key: 'addr-line1', msg: T('Bitte gib Straße und Hausnummer an.', 'Please enter the street and house number.') });
      else if (!/\d/.test(l1)) out.push({ key: 'addr-line1', msg: T('Bitte ergänze die Hausnummer.', 'Please add the house number.') });
      if (country() === 'DE' ? !/^\d{5}$/.test(pc) : !pc) out.push({ key: 'addr-postal', msg: country() === 'DE' ? T('Bitte gib eine PLZ mit 5 Ziffern an.', 'Please enter a 5-digit postcode.') : T('Bitte gib die Postleitzahl an.', 'Please enter the postcode.') });
      if (!city) out.push({ key: 'addr-city', msg: T('Bitte gib den Ort an.', 'Please enter the town or city.') });
      return out;
    }
    function check(i) {
      var out = [];
      if (i === 0 && !selectedVariant()) out.push({ key: 'amount', msg: T('Bitte wähle einen Betrag.', 'Please choose an amount.') });
      if (i === 1) {
        var d = selectedDesign();
        if (!d) out.push({ key: 'design', msg: T('Bitte wähle ein Motiv.', 'Please choose a design.') });
        else if (d.photo && !(state.photo && state.photo.id)) out.push({ key: 'photo', msg: T('Bitte lade ein Foto hoch – oder wähle ein anderes Motiv.', 'Please upload a photo – or choose another design.') });
      }
      if (i === 3 && isPrint()) out = out.concat(addressProblems());
      if (i === 4 && !termsChecked()) out.push({ key: 'terms', msg: T('Bitte bestätige, dass du die Gutscheinbedingungen gelesen hast.', 'Please confirm that you have read the voucher terms.') });
      return out;
    }
    function stepDone(i) { return !!state.done[i] && !check(i).length; }
    function reachable(i) {
      for (var s = 0; s < i; s++) if (!stepDone(s)) return false;
      return true;
    }
    // The first step that is not done yet (where a restored draft resumes).
    function firstOpen() {
      for (var s = 0; s < 4; s++) if (!stepDone(s)) return s;
      return 4;
    }
    function focusTarget(key) {
      var f = FIELDS[key];
      if (f && f.input) return f.input;
      if (key === 'amount') return root.querySelector('.ms-gv-amount:not([disabled])');
      if (key === 'design') return root.querySelector('.ms-gv-design');
      if (key === 'photo') return uploadUi.pick || root.querySelector('.ms-gv-design[aria-pressed="true"]');
      if (key === 'terms') return termsInput;
      return null;
    }

    // Errors: shown after a blocked click (shown) or from Mo (extErr) until
    // the field is right — no layout games, the line sits under the field.
    function paintErrors() {
      var current = {};
      check(state.step).forEach(function (p) { current[p.key] = p.msg; });
      Object.keys(errs).forEach(function (k) {
        var msg = extErr[k] || (shown[k] && current[k]) || null;
        if (shown[k] && !current[k]) delete shown[k];
        errs[k](msg);
      });
    }
    // A click on „Weiter“ (or „Jetzt kaufen“) with something open: mark it,
    // say it once, move to the first one.
    function block(problems) {
      shown = {};
      problems.forEach(function (p) { shown[p.key] = true; });
      paintErrors();
      paintFooter();
      alertSay(problems.map(function (p) { return p.msg; }).join(' '));
      var first = problems[0] ? focusTarget(problems[0].key) : null;
      if (first) {
        var box = first.closest ? first.closest('.ms-gv-field, .ms-gv-block, .ms-gv-review__terms') : null;
        reveal(box || first, 'center');
        focusEl(first);
      }
    }

    // ----- navigation ----------------------------------------------------------------------
    function next() {
      var i = state.step;
      var probs = check(i);
      if (probs.length) { block(probs); return; }
      state.done[i] = true;
      go(i + 1);
    }
    function back() { if (state.step > 0) go(state.step - 1); }
    function go(i, opts) {
      opts = opts || {};
      if (!ready || i < 0 || i > 4) return;
      if (i > state.step && !reachable(i)) {
        for (var s = 0; s < i; s++) {
          if (!stepDone(s)) {
            if (s !== state.step) go(s, { quiet: true });
            var probs = check(s);
            if (probs.length) block(probs);
            return;
          }
        }
      }
      var from = state.step;
      state.step = i;
      shown = {};
      save();
      showStep(from !== i && !opts.quiet);
    }
    function showStep(moveFocus) {
      for (var j = 0; j < P.length; j++) P[j].el.hidden = j !== state.step;
      if (state.step === 0 || state.step === 1 || state.step === 4) setSide('front', true);
      if (state.step === 4) { paintReview(); requestExact(); syncCart(); }
      paintAll();
      if (moveFocus) {
        focusEl(P[state.step].title);
        reveal(progressEl);
      }
    }

    // ----- progress line ----------------------------------------------------------------
    // Clickable: every step but the current one whose steps before it are all
    // done — the done ones (back, or forward over the line) and the next open
    // one (e.g. back to „Prüfen & kaufen“ after a change in step 2).
    function paintSteps() {
      var items = stepsEl ? stepsEl.querySelectorAll('[data-step]') : [];
      for (var k = 0; k < items.length; k++) {
        var i = parseInt(items[k].getAttribute('data-step'), 10);
        var cur = i === state.step;
        var done = !cur && stepDone(i);
        var open = ready && !cur && reachable(i);
        items[k].classList.toggle('is-current', cur);
        items[k].classList.toggle('is-done', done);
        items[k].classList.toggle('is-next', open && !done);
        // The line to the next step turns blue once this step is done (also
        // the current one, after a step back).
        items[k].classList.toggle('is-filled', ready && stepDone(i));
        if (cur) items[k].setAttribute('aria-current', 'step'); else items[k].removeAttribute('aria-current');
        var btn = items[k].querySelector('[data-ms-gv-goto]');
        if (btn) btn.disabled = !open;
        var st = items[k].querySelector('[data-ms-gv-step-state]');
        setText(st, cur ? T(' – aktueller Schritt', ' – current step') : done ? T(' – erledigt', ' – done') : open ? T(' – als Nächstes', ' – next') : '');
      }
      setText(progressText, T('Schritt ', 'Step ') + (state.step + 1) + T(' von 5 · ', ' of 5 · ') + STEP_LABELS[state.step]);
    }
    if (stepsEl) {
      stepsEl.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-ms-gv-goto]') : null;
        if (!b || b.disabled) return;
        go(parseInt(b.getAttribute('data-ms-gv-goto'), 10));
      });
    }

    // ----- voucher faces (live preview, design tiles, hero) ---------------------------------
    // Spans only (they also live inside <button> tiles). Sizes in the CSS are
    // container units of the face (cqw), so the text scales with the card.
    function luminance(hex) {
      var h = hex.replace('#', '');
      if (h.length === 3 || h.length === 4) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
      var rgb = [0, 2, 4].map(function (o) {
        var c = parseInt(h.substr(o, 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    }
    function contrast(a, b) {
      var la = luminance(a);
      var lb = luminance(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }
    // The wordmark: the design's accent where it reads, else white on dark /
    // brand blue on light (as Mo's renderer).
    function brandColor(c, bg) {
      if (contrast(c.accent, bg) >= 3.5) return c.accent;
      return luminance(bg) < 0.25 ? '#ffffff' : '#008ccb';
    }
    function mutedColor(c, bg, ink) { return contrast(c.muted, bg) >= 3 ? c.muted : ink; }
    // A QR-like placeholder (the real one points to #guthaben).
    var QR_SVG = (function () {
      var n = 21;
      var seed = 7;
      function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
      function finder(x, y) {
        return 'M' + x + ' ' + y + 'h7v7h-7zM' + (x + 1) + ' ' + (y + 1) + 'v5h5v-5zM' + (x + 2) + ' ' + (y + 2) + 'h3v3h-3z';
      }
      var d = finder(0, 0) + finder(n - 7, 0) + finder(0, n - 7);
      for (var y = 0; y < n; y++) {
        for (var x = 0; x < n; x++) {
          var inFinder = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
          if (!inFinder && rnd() > 0.52) d += 'M' + x + ' ' + y + 'h1v1h-1z';
        }
      }
      return '<svg viewBox="-1.5 -1.5 24 24" aria-hidden="true" focusable="false"><rect x="-1.5" y="-1.5" width="24" height="24" fill="#fff"/><path fill="currentColor" fill-rule="evenodd" d="' + d + '"/></svg>';
    })();
    function Face(kind) {
      var f = { kind: kind };
      var n = el('span', 'ms-gv-face ms-gv-face--' + kind);
      n.setAttribute('aria-hidden', 'true');
      f.el = n;
      var bg = el('img', 'ms-gv-face__bg');
      bg.alt = '';
      bg.hidden = true;
      bg.setAttribute('decoding', 'async');
      n.appendChild(bg);
      n.appendChild(el('span', 'ms-gv-face__shade'));
      if (kind === 'front') {
        var c = el('span', 'ms-gv-face__content');
        f.brand = el('span', 'ms-gv-face__brand', 'motion sports');
        f.eyebrow = el('span', 'ms-gv-face__eyebrow', T('Geschenkgutschein', 'Gift voucher'));
        f.value = el('span', 'ms-gv-face__value');
        f.forEl = el('span', 'ms-gv-face__for');
        f.url = el('span', 'ms-gv-face__url', 'motionsports.de');
        c.appendChild(f.brand);
        c.appendChild(f.eyebrow);
        c.appendChild(f.value);
        c.appendChild(f.forEl);
        c.appendChild(f.url);
        n.appendChild(c);
      } else {
        var panels = el('span', 'ms-gv-face__panels');
        var pm = el('span', 'ms-gv-face__panel ms-gv-face__panel--msg');
        f.msgbox = el('span', 'ms-gv-face__msgbox');
        f.msg = el('span', 'ms-gv-face__msg');
        f.from = el('span', 'ms-gv-face__from');
        f.msgbox.appendChild(f.msg);
        f.msgbox.appendChild(f.from);
        pm.appendChild(f.msgbox);
        var pi = el('span', 'ms-gv-face__panel ms-gv-face__panel--info');
        pi.appendChild(el('span', 'ms-gv-face__label', T('Dein Gutscheincode', 'Your voucher code')));
        pi.appendChild(el('span', 'ms-gv-face__code', 'XXXX XXXX XXXX XXXX'));
        var qr = el('span', 'ms-gv-face__qr');
        qr.innerHTML = QR_SVG;
        pi.appendChild(qr);
        f.worth = el('span', 'ms-gv-face__worth');
        f.valid = el('span', 'ms-gv-face__valid');
        pi.appendChild(f.worth);
        pi.appendChild(f.valid);
        pi.appendChild(el('span', 'ms-gv-face__fine', T('Einlösen im Checkout auf motionsports.de', 'Redeem at checkout on motionsports.de')));
        panels.appendChild(pm);
        panels.appendChild(pi);
        n.appendChild(panels);
      }
      f.bg = bg;
      f.update = function (design, lay, data) {
        var c = design ? design.colors : DEFAULT_COLORS;
        var front = kind === 'front';
        var photo = !!(design && design.photo && front);
        var shape = front ? lay : (lay === 'square' ? 'spread' : 'landscape');
        var bgc = front ? c.background : c.insideBackground;
        var ink = front ? c.ink : c.insideInk;
        var cls = 'ms-gv-face ms-gv-face--' + kind + ' ms-gv-face--' + shape + (photo ? ' ms-gv-face--photo' : '') + (photo && !data.photo ? ' ms-gv-face--nophoto' : '');
        if (n.className !== cls) n.className = cls;
        n.style.setProperty('--f-bg', bgc);
        n.style.setProperty('--f-ink', photo ? '#ffffff' : ink);
        n.style.setProperty('--f-brand', photo ? '#ffffff' : brandColor(c, bgc));
        n.style.setProperty('--f-muted', photo ? 'rgba(255,255,255,0.86)' : mutedColor(c, bgc, ink));
        var src = '';
        if (front) {
          if (photo && data.photo) src = data.photo;
          else if (design) src = design.svg[lay] || design.svg.landscape || design.svg.square || '';
        }
        if ((bg.getAttribute('src') || '') !== src) {
          if (src) { bg.src = src; bg.hidden = false; } else { bg.removeAttribute('src'); bg.hidden = true; }
        }
        if (front) {
          setText(f.value, data.amount);
          setText(f.forEl, data.recipient ? T('für ', 'for ') + data.recipient : '');
          f.forEl.hidden = !data.recipient;
        } else {
          // No message: the design's own line, as the PDF and the card print it.
          var msg = data.message || (design && design.defaultMessage) || T('Viel Freude beim Training!', 'Enjoy your training!');
          var changed = f.msg.textContent !== msg || f.from.textContent !== (data.sender ? '— ' + data.sender : '') || f.shape !== shape;
          setText(f.msg, msg);
          setText(f.from, data.sender ? '— ' + data.sender : '');
          f.from.hidden = !data.sender;
          setText(f.worth, T('Wert ', 'Value ') + data.money);
          setText(f.valid, data.validity);
          f.shape = shape;
          if (changed) fitLater(f);
        }
        cqFallback(n);
      };
      return f;
    }
    // The message is auto-sized to its panel, as Mo's renderer does: the
    // largest size (--fit 1) that fits, down to 45 %.
    var fitQueue = [];
    var fitFrame = null;
    function fitLater(f) {
      if (fitQueue.indexOf(f) === -1) fitQueue.push(f);
      if (fitFrame) return;
      var raf = window.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); };
      fitFrame = raf(function () {
        fitFrame = null;
        var q = fitQueue.slice();
        fitQueue = [];
        q.forEach(fitMsg);
      });
    }
    function fits(box) { return box.scrollHeight <= box.clientHeight + 1 && box.scrollWidth <= box.clientWidth + 1; }
    function fitMsg(f) {
      var box = f.msgbox;
      if (!box || !box.clientHeight) return;
      box.style.setProperty('--fit', '1');
      if (fits(box)) return;
      var lo = 0.45;
      var hi = 1;
      var best = lo;
      for (var k = 0; k < 7; k++) {
        var mid = (lo + hi) / 2;
        box.style.setProperty('--fit', mid.toFixed(3));
        if (fits(box)) { best = mid; lo = mid; } else hi = mid;
      }
      box.style.setProperty('--fit', best.toFixed(3));
    }
    // Browsers without container units: the face gets its own unit in px.
    var CQ = (function () { try { return !!(window.CSS && CSS.supports && CSS.supports('container-type', 'inline-size')); } catch (e) { return false; } })();
    function cqFallback(n) {
      if (CQ || !n) return;
      var w = n.getBoundingClientRect().width;
      if (w) n.style.setProperty('--cq', (w / 100) + 'px');
      var panels = n.querySelectorAll('.ms-gv-face__panel');
      for (var i = 0; i < panels.length; i++) {
        var pw = panels[i].getBoundingClientRect().width;
        if (pw) panels[i].style.setProperty('--cq', (pw / 100) + 'px');
      }
    }
    function previewData() {
      var v = selectedVariant();
      return {
        amount: v ? amountLabel(v.faceCents) : '',
        money: v ? money(v.faceCents, 'EUR') : '',
        recipient: finalLine(state.recipient),
        sender: finalLine(state.sender),
        message: finalText(state.message),
        photo: state.photo && state.photo.thumb ? state.photo.thumb : '',
        validity: validityLine()
      };
    }

    // ----- live preview (aside) ---------------------------------------------------------------
    var pvFront = Face('front');
    var pvInside = Face('inside');
    var exactImgs = { front: el('img', 'ms-gv-preview__exact ms-gv-preview__exact--front'), inside: el('img', 'ms-gv-preview__exact ms-gv-preview__exact--inside') };
    exactImgs.front.alt = '';
    exactImgs.inside.alt = '';
    exactImgs.front.hidden = true;
    exactImgs.inside.hidden = true;
    // The state of the exact preview sits over the stage but outside its
    // role="img" (the retry button must stay reachable).
    var exactState = el('div', 'ms-gv-preview__state');
    exactState.hidden = true;
    var exactStateText = el('span', 'ms-gv-preview__state-text');
    var exactRetry = el('button', 'ms-gv-link ms-gv-preview__retry', T('Erneut versuchen', 'Try again'));
    exactRetry.type = 'button';
    exactRetry.hidden = true;
    exactState.innerHTML = '<span class="ms-gv-spinner ms-gv-spinner--sm" aria-hidden="true"></span>';
    exactState.appendChild(exactStateText);
    exactState.appendChild(exactRetry);
    exactRetry.addEventListener('click', function () { exact.key = ''; requestExact(); });
    function mountPreview() {
      if (!stage) return;
      stage.innerHTML = '';
      var wrapF = el('span', 'ms-gv-preview__card ms-gv-preview__card--front');
      wrapF.appendChild(pvFront.el);
      var wrapI = el('span', 'ms-gv-preview__card ms-gv-preview__card--inside');
      wrapI.appendChild(pvInside.el);
      stage.appendChild(wrapF);
      stage.appendChild(wrapI);
      stage.appendChild(exactImgs.front);
      stage.appendChild(exactImgs.inside);
      var frame = el('div', 'ms-gv-preview__frame');
      stage.parentNode.insertBefore(frame, stage);
      frame.appendChild(stage);
      frame.appendChild(exactState);
    }
    function setSide(s, auto) {
      if (s !== 'front' && s !== 'inside') return;
      side = s;
      for (var i = 0; i < sideBtns.length; i++) sideBtns[i].setAttribute('aria-pressed', sideBtns[i].getAttribute('data-ms-gv-side') === s ? 'true' : 'false');
      if (stage) stage.setAttribute('data-side', s);
      if (!auto) paintPreview();
    }
    for (var sb = 0; sb < sideBtns.length; sb++) {
      sideBtns[sb].addEventListener('click', function () { setSide(this.getAttribute('data-ms-gv-side')); });
    }
    // The exact images (step 5): Mo's renderer with a „MUSTER“ watermark.
    var exact = { key: '', status: 'idle', front: '', inside: '', message: '', seq: 0 };
    function isDataImage(s) { return typeof s === 'string' && s.length < 8000000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s); }
    function previewBody() {
      var b = draftFields();
      b.layout = layout();
      return b;
    }
    function requestExact() {
      if (!ready) return;
      var body = previewBody();
      var key = JSON.stringify(body);
      if (exact.key === key && (exact.status === 'ok' || exact.status === 'loading')) { paintPreview(); return; }
      var seq = ++exact.seq;
      exact.key = key;
      exact.status = 'loading';
      exact.message = '';
      paintPreview();
      say(T('Die exakte Vorschau wird erstellt …', 'Creating the exact preview …'));
      request('POST', '/api/gift-vouchers/preview', body, 30000).then(function (res) {
        if (torn || seq !== exact.seq) return;
        if (!res.ok && res.status === 409) {
          exact.status = 'idle';
          exact.key = '';
          stopSelling(res);
          return;
        }
        if (res.ok && isDataImage(res.data.front) && isDataImage(res.data.inside)) {
          exact.status = 'ok';
          exact.front = res.data.front;
          exact.inside = res.data.inside;
          say(T('Exakte Vorschau geladen.', 'Exact preview loaded.'));
        } else {
          exact.status = 'error';
          exact.message = res.ok ? T('Die Vorschau ist gerade nicht verfügbar.', 'The preview is not available right now.') : errorText(res, 'Die Vorschau ist gerade nicht verfügbar.', 'The preview is not available right now.');
          say(exact.message);
        }
        paintPreview();
      });
    }
    function paintPreview() {
      if (!stage || !ready) return;
      var d = selectedDesign() || DESIGNS[0];
      var lay = layout();
      var data = previewData();
      stage.setAttribute('data-layout', lay);
      stage.setAttribute('data-side', side);
      pvFront.update(d, lay, data);
      pvInside.update(d, lay, data);
      var exactMode = state.step === 4;
      var key = exactMode ? JSON.stringify(previewBody()) : '';
      var have = exactMode && exact.status === 'ok' && exact.key === key;
      previewEl.setAttribute('data-mode', exactMode ? 'exact' : 'live');
      ['front', 'inside'].forEach(function (s) {
        var img = exactImgs[s];
        var src = have ? exact[s] : '';
        if ((img.getAttribute('src') || '') !== src) { if (src) img.src = src; else img.removeAttribute('src'); }
        img.hidden = !src;
        stage.classList.toggle('has-exact-' + s, !!src);
      });
      var loading = exactMode && exact.status === 'loading';
      var failed = exactMode && exact.status === 'error' && exact.key === key;
      stage.classList.toggle('is-loading', loading);
      exactState.hidden = !(loading || failed);
      exactState.classList.toggle('is-error', failed);
      setText(exactStateText, loading ? T('Exakte Vorschau wird erstellt …', 'Creating the exact preview …') : failed ? exact.message : '');
      exactRetry.hidden = !failed;
      setText(badgeEl, have ? T('Exakt · Muster', 'Exact · sample') : 'Live');
      if (badgeEl) badgeEl.classList.toggle('is-exact', have);
      setText(noteEl, have
        ? T('So kommt dein Gutschein an – ohne „Muster“ und mit deinem persönlichen Code.', 'This is how your voucher arrives – without “sample” and with your personal code.')
        : T('Vereinfachte Live-Vorschau – im letzten Schritt siehst du den exakten Gutschein.', 'Simplified live preview – the last step shows the exact voucher.'));
      var label = (side === 'front' ? T('Vorderseite', 'Front') : T('Innenseite', 'Inside')) + ': ' + (d ? d.name : '') +
        (data.amount ? ', ' + data.amount : '') + (data.recipient ? ', ' + T('für ', 'for ') + data.recipient : '') +
        (lay === 'square' ? T(' – Premium-Karte 14 × 14 cm', ' – premium card 14 × 14 cm') : T(' – PDF im Querformat', ' – landscape PDF'));
      stage.setAttribute('aria-label', T('Vorschau ', 'Preview ') + label);
    }

    // ----- fields ---------------------------------------------------------------------------
    var FIELDS = {};
    function field(o) {
      var wrap = el('div', 'ms-gv-field' + (o.cls ? ' ' + o.cls : ''));
      var label = el('label', 'ms-gv-label', o.label);
      label.setAttribute('for', o.id);
      if (o.optional) {
        label.appendChild(document.createTextNode(' '));
        label.appendChild(el('span', 'ms-gv-label__opt', T('optional', 'optional')));
      }
      wrap.appendChild(label);
      var input = el(o.multiline ? 'textarea' : 'input', 'ms-gv-input' + (o.multiline ? ' ms-gv-input--area' : ''));
      if (!o.multiline) input.type = 'text';
      input.id = o.id;
      if (o.max) input.setAttribute('maxlength', String(o.max));
      if (o.rows) input.rows = o.rows;
      input.setAttribute('autocomplete', o.autocomplete || 'off');
      if (o.inputmode) input.setAttribute('inputmode', o.inputmode);
      if (o.placeholder) input.placeholder = o.placeholder;
      if (o.spellcheck === false) input.setAttribute('spellcheck', 'false');
      wrap.appendChild(input);
      var err = el('p', 'ms-gv-field__error');
      err.id = o.id + '-err';
      err.hidden = true;
      err.innerHTML = icon('alert');
      var errText = el('span');
      err.appendChild(errText);
      wrap.appendChild(err);
      var described = [];
      var after = el('div', 'ms-gv-field__after');
      var hint = null;
      if (o.hint) {
        hint = el('p', 'ms-gv-hint', o.hint);
        hint.id = o.id + '-hint';
        after.appendChild(hint);
        described.push(hint.id);
      }
      if (o.counter) {
        var count = el('p', 'ms-gv-count');
        count.id = o.id + '-count';
        count.setAttribute('aria-hidden', 'true');
        after.appendChild(count);
      }
      if (after.firstChild) wrap.appendChild(after);
      var warn = el('p', 'ms-gv-field__warn');
      warn.id = o.id + '-warn';
      warn.hidden = true;
      warn.setAttribute('aria-live', 'polite');
      wrap.appendChild(warn);
      if (described.length) input.setAttribute('aria-describedby', described.join(' '));
      var fobj = { wrap: wrap, input: input, err: err, hint: hint, count: count || null, warn: warn, described: described };
      fobj.setError = function (msg) {
        var on = !!msg;
        err.hidden = !on;
        setText(errText, msg || '');
        wrap.classList.toggle('is-invalid', on);
        if (on) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
        input.setAttribute('aria-describedby', (on ? [err.id] : []).concat(described).join(' ') || '');
        if (!on && !described.length) input.removeAttribute('aria-describedby');
      };
      if (o.key) { FIELDS[o.key] = fobj; errs[o.key] = fobj.setError; }
      return fobj;
    }
    // The note at a field when characters were removed (emoji …).
    var warnTimers = {};
    function warnRemoved(f, on) {
      if (!f || !f.warn) return;
      if (!on) return;
      f.warn.innerHTML = icon('info');
      f.warn.appendChild(el('span', '', T('Emojis und einige Sonderzeichen können wir nicht drucken – wir haben sie entfernt.', 'We cannot print emoji and some special characters – we removed them.')));
      f.warn.hidden = false;
      clearTimeout(warnTimers[f.input.id]);
      warnTimers[f.input.id] = setTimeout(function () { f.warn.hidden = true; }, 9000);
    }

    // ----- panel scaffold ----------------------------------------------------------------------
    function panel(i, title, sub) {
      var p = el('section', 'ms-gv-panel');
      p.setAttribute('data-panel', String(i));
      p.hidden = true;
      var head = el('div', 'ms-gv-panel__head');
      var h = el('h3', 'ms-gv-panel__title');
      h.id = uid + '-p' + i;
      h.setAttribute('tabindex', '-1');
      h.appendChild(el('span', 'ms-gv-panel__kicker', T('Schritt ', 'Step ') + (i + 1) + T(' von 5', ' of 5')));
      h.appendChild(el('span', 'ms-gv-sr', ': '));
      h.appendChild(el('span', 'ms-gv-panel__heading', title));
      head.appendChild(h);
      if (sub) head.appendChild(el('p', 'ms-gv-panel__sub', sub));
      p.setAttribute('aria-labelledby', h.id);
      p.appendChild(head);
      var body = el('div', 'ms-gv-panel__body');
      p.appendChild(body);
      var foot = el('div', 'ms-gv-panel__foot');
      p.appendChild(foot);
      var o = { el: p, title: h, body: body, foot: foot, next: null, back: null, hint: null };
      if (i < 4) {
        var hint = el('p', 'ms-gv-panel__hint');
        hint.setAttribute('aria-live', 'polite');
        hint.id = uid + '-p' + i + '-hint';
        var actions = el('div', 'ms-gv-panel__actions');
        if (i > 0) {
          var b = el('button', 'ms-gv-btn ms-gv-btn--secondary ms-gv-btn--back');
          b.type = 'button';
          b.innerHTML = icon('arrowLeft');
          b.appendChild(el('span', '', T('Zurück', 'Back')));
          b.addEventListener('click', back);
          actions.appendChild(b);
          o.back = b;
        }
        var nb = el('button', 'ms-gv-btn ms-gv-btn--primary ms-gv-btn--next');
        nb.type = 'button';
        nb.appendChild(el('span', '', NEXT_LABELS[i]));
        nb.insertAdjacentHTML('beforeend', icon('arrowRight'));
        nb.setAttribute('aria-describedby', hint.id);
        nb.addEventListener('click', next);
        actions.appendChild(nb);
        foot.appendChild(actions);
        foot.appendChild(hint);
        o.next = nb;
        o.hint = hint;
      }
      P[i] = o;
      return o;
    }
    // „Noch offen: …“ under the buttons; the button keeps its click (the
    // disabled look via aria-disabled, as the Konfigurator's „Weiter“).
    var OPEN_NAMES = { amount: T('Betrag', 'amount'), design: T('Motiv', 'design'), photo: T('Foto', 'photo'), 'addr-name': T('Name', 'name'), 'addr-line1': T('Straße und Hausnummer', 'street and number'), 'addr-postal': T('PLZ', 'postcode'), 'addr-city': T('Ort', 'town'), terms: T('Bedingungen', 'terms') };
    function paintFooter() {
      var p = P[state.step];
      if (!p || !p.next) return;
      var probs = check(state.step);
      if (probs.length) p.next.setAttribute('aria-disabled', 'true'); else p.next.removeAttribute('aria-disabled');
      var names = [];
      probs.forEach(function (x) { var nm = OPEN_NAMES[x.key]; if (nm && names.indexOf(nm) === -1) names.push(nm); });
      setText(p.hint, names.length ? T('Noch offen: ', 'Still open: ') + names.join(', ') : '');
    }

    // ----- step 1: Betrag -------------------------------------------------------------------
    var amountBtns = [];
    function buildAmount() {
      var p = panel(0, T('Wie viel möchtest du schenken?', 'How much would you like to give?'), T('Der Gutschein gilt für das ganze Sortiment auf motionsports.de.', 'The voucher works for everything on motionsports.de.'));
      var block = el('div', 'ms-gv-block');
      var group = el('div', 'ms-gv-amounts');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', T('Betrag', 'Amount'));
      var err = el('p', 'ms-gv-field__error');
      err.id = uid + '-amount-err';
      err.hidden = true;
      err.innerHTML = icon('alert');
      var errText = el('span');
      err.appendChild(errText);
      errs.amount = function (msg) {
        err.hidden = !msg;
        setText(errText, msg || '');
        block.classList.toggle('is-invalid', !!msg);
      };
      PRODUCTS.voucher.forEach(function (v) {
        var b = el('button', 'ms-gv-tile ms-gv-amount');
        b.type = 'button';
        b.setAttribute('aria-pressed', 'false');
        b.setAttribute('data-variant', String(v.id));
        b.appendChild(el('span', 'ms-gv-amount__value', amountLabel(v.faceCents)));
        if (!v.available) {
          b.disabled = true;
          b.appendChild(el('span', 'ms-gv-amount__note', T('nicht verfügbar', 'unavailable')));
        }
        b.addEventListener('click', function () {
          state.variantId = v.id;
          setSide('front', true);
          changed();
        });
        amountBtns.push(b);
        group.appendChild(b);
      });
      block.appendChild(err);
      block.appendChild(group);
      p.body.appendChild(block);
      var facts = el('ul', 'ms-gv-facts');
      facts.setAttribute('role', 'list');
      [T('Im ganzen Shop einlösbar', 'Valid across the shop'), validityFact(), T('Restguthaben bleibt erhalten', 'Remaining balance is kept')].forEach(function (t) {
        var li = el('li');
        li.innerHTML = icon('check');
        li.appendChild(el('span', '', t));
        facts.appendChild(li);
      });
      p.body.appendChild(facts);
      if (PRODUCTS.currency !== 'EUR') {
        var call = el('p', 'ms-gv-callout');
        call.innerHTML = icon('info');
        call.appendChild(el('span', '', T('Gutscheine gibt es in Euro: Der Wert steht in € auf dem Gutschein, der Preis im Checkout kann umgerechnet sein.', 'Vouchers are in euros: the value on the voucher is in €, the checkout price may be converted.')));
        p.body.appendChild(call);
      }
    }
    function validityFact() {
      if (cfg && cfg.validity.years === 0) return T('Unbegrenzt gültig', 'No expiry date');
      var y = cfg ? cfg.validity.years : 3;
      return y === 1 ? T('1 Jahr gültig', 'Valid for 1 year') : T(y + ' Jahre gültig', 'Valid for ' + y + ' years');
    }
    function paintAmount() {
      amountBtns.forEach(function (b) { b.setAttribute('aria-pressed', Number(b.getAttribute('data-variant')) === state.variantId ? 'true' : 'false'); });
    }

    // ----- step 2: Motiv ---------------------------------------------------------------------
    var designTiles = [];
    var uploadUi = {};
    var upload = { status: 'idle', progress: 0, phase: '', message: '', seq: 0 };
    function buildDesign() {
      var p = panel(1, T('Wähle ein Motiv', 'Choose a design'), photoAllowed() ? T('Oder mach ihn mit deinem eigenen Foto ganz persönlich.', 'Or make it truly personal with your own photo.') : T('Jedes Motiv gibt es als PDF und als Premium-Karte.', 'Every design comes as a PDF and as a premium card.'));
      var block = el('div', 'ms-gv-block');
      var err = el('p', 'ms-gv-field__error');
      err.hidden = true;
      err.innerHTML = icon('alert');
      var errText = el('span');
      err.appendChild(errText);
      errs.design = function (msg) {
        err.hidden = !msg;
        setText(errText, msg || '');
        block.classList.toggle('is-invalid', !!msg);
      };
      var grid = el('div', 'ms-gv-designs');
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-label', T('Motiv', 'Design'));
      visibleDesigns().forEach(function (d) {
        var b = el('button', 'ms-gv-tile ms-gv-design' + (d.photo ? ' ms-gv-design--photo' : ''));
        b.type = 'button';
        b.setAttribute('aria-pressed', 'false');
        b.setAttribute('data-design', d.key);
        var media = el('span', 'ms-gv-design__media');
        var face = Face('front');
        media.appendChild(face.el);
        if (d.photo) {
          var badge = el('span', 'ms-gv-design__cam');
          badge.innerHTML = icon('camera');
          media.appendChild(badge);
        }
        b.appendChild(media);
        var text = el('span', 'ms-gv-design__text');
        text.appendChild(el('span', 'ms-gv-design__name', d.name));
        if (d.description) text.appendChild(el('span', 'ms-gv-design__desc', d.description));
        b.appendChild(text);
        b.addEventListener('click', function () {
          state.designKey = d.key;
          setSide('front', true);
          changed();
          // „Eigenes Foto“ without a photo yet: the file picker opens right
          // away (in the click, so the browser allows it); the box under the
          // tiles stays for a second try.
          if (d.photo && !(state.photo && state.photo.id) && uploadUi.box) {
            reveal(uploadUi.box, 'center');
            if (upload.status !== 'working') openPicker();
          }
        });
        designTiles.push({ btn: b, face: face, design: d });
        grid.appendChild(b);
      });
      block.appendChild(err);
      block.appendChild(grid);
      p.body.appendChild(block);
      if (photoAllowed() && DESIGNS.some(function (d) { return d.photo; })) buildUpload(p.body);
    }
    function paintDesigns() {
      var data = previewData();
      var lay = layout();
      designTiles.forEach(function (t) {
        t.btn.setAttribute('aria-pressed', t.design.key === state.designKey ? 'true' : 'false');
        t.face.update(t.design, lay, data);
      });
    }

    // The photo box under the designs („Eigenes Foto“): pick (or drop) →
    // downscale here (≤ 2400 px, JPEG ≤ the limit) → upload with progress →
    // thumbnail. Mo crops it to the card.
    function buildUpload(host) {
      var box = el('div', 'ms-gv-upload ms-gv-block');
      box.hidden = true;
      var input = el('input', 'ms-gv-sr');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp';
      input.tabIndex = -1;
      input.setAttribute('aria-hidden', 'true');
      box.appendChild(input);
      // empty
      var empty = el('div', 'ms-gv-upload__empty');
      var ico = el('span', 'ms-gv-upload__icon');
      ico.innerHTML = icon('upload');
      empty.appendChild(ico);
      var et = el('div', 'ms-gv-upload__text');
      et.appendChild(el('p', 'ms-gv-upload__title', T('Lade dein Lieblingsfoto hoch', 'Upload your favourite photo')));
      et.appendChild(el('p', 'ms-gv-hint', T('JPG, PNG oder WebP – wir bereiten es für den Druck auf. Am schönsten mit dem Motiv in der Bildmitte.', 'JPG, PNG or WebP – we prepare it for print. Looks best with the subject in the centre.')));
      empty.appendChild(et);
      var pick = el('button', 'ms-gv-btn ms-gv-btn--secondary ms-gv-btn--sm');
      pick.type = 'button';
      pick.innerHTML = icon('image');
      pick.appendChild(el('span', '', T('Foto auswählen', 'Choose photo')));
      empty.appendChild(pick);
      box.appendChild(empty);
      // working
      var work = el('div', 'ms-gv-upload__work');
      var workText = el('p', 'ms-gv-upload__title');
      var bar = el('span', 'ms-gv-progressbar');
      var barFill = el('span', 'ms-gv-progressbar__fill');
      bar.appendChild(barFill);
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      bar.setAttribute('aria-label', T('Fortschritt des Uploads', 'Upload progress'));
      work.appendChild(workText);
      work.appendChild(bar);
      box.appendChild(work);
      // done
      var doneEl = el('div', 'ms-gv-upload__done');
      var thumb = el('img', 'ms-gv-upload__thumb');
      thumb.alt = T('Dein Foto', 'Your photo');
      doneEl.appendChild(thumb);
      var dt = el('div', 'ms-gv-upload__text');
      var doneTitle = el('p', 'ms-gv-upload__title');
      doneTitle.innerHTML = icon('check', 'ms-gv-upload__ok');
      doneTitle.appendChild(el('span', '', T('Dein Foto ist drauf', 'Your photo is on')));
      dt.appendChild(doneTitle);
      var small = el('p', 'ms-gv-hint ms-gv-upload__small', T('Das Foto ist recht klein – im Druck kann es etwas unscharf wirken.', 'The photo is quite small – it may look a little soft in print.'));
      dt.appendChild(small);
      var acts = el('div', 'ms-gv-upload__actions');
      var change = el('button', 'ms-gv-btn ms-gv-btn--secondary ms-gv-btn--sm');
      change.type = 'button';
      change.innerHTML = icon('image');
      change.appendChild(el('span', '', T('Anderes Foto', 'Another photo')));
      var remove = el('button', 'ms-gv-btn ms-gv-btn--secondary ms-gv-btn--sm ms-gv-btn--quiet');
      remove.type = 'button';
      remove.innerHTML = icon('trash');
      remove.appendChild(el('span', '', T('Entfernen', 'Remove')));
      acts.appendChild(change);
      acts.appendChild(remove);
      dt.appendChild(acts);
      doneEl.appendChild(dt);
      box.appendChild(doneEl);
      var err = el('p', 'ms-gv-field__error ms-gv-upload__error');
      err.setAttribute('role', 'alert');
      err.hidden = true;
      var errText = el('span');
      err.innerHTML = icon('alert');
      err.appendChild(errText);
      box.appendChild(err);
      host.appendChild(box);
      uploadUi = { box: box, input: input, pick: pick, change: change, remove: remove, empty: empty, work: work, workText: workText, bar: bar, barFill: barFill, done: doneEl, thumb: thumb, small: small, err: err, errText: errText };
      errs.photo = function (msg) {
        if (upload.status === 'error') return;
        err.hidden = !msg;
        setText(errText, msg || '');
        box.classList.toggle('is-invalid', !!msg);
      };
      pick.addEventListener('click', openPicker);
      change.addEventListener('click', openPicker);
      remove.addEventListener('click', function () {
        state.photo = null;
        upload = { status: 'idle', progress: 0, phase: '', message: '', seq: upload.seq + 1 };
        changed();
        paintUpload();
        focusEl(pick);
        say(T('Foto entfernt.', 'Photo removed.'));
      });
      input.addEventListener('change', function () { if (input.files && input.files[0]) onPhoto(input.files[0]); });
      // Drop a photo onto the box (desktop).
      box.addEventListener('dragover', function (e) { e.preventDefault(); box.classList.add('is-drag'); });
      box.addEventListener('dragleave', function () { box.classList.remove('is-drag'); });
      box.addEventListener('drop', function (e) {
        e.preventDefault();
        box.classList.remove('is-drag');
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) onPhoto(f);
      });
    }
    function openPicker() {
      var input = uploadUi.input;
      if (!input) return;
      input.value = '';
      try { input.click(); } catch (e) {}
    }
    function paintUpload() {
      var u = uploadUi;
      if (!u.box) return;
      var d = selectedDesign();
      u.box.hidden = !(d && d.photo);
      var has = !!(state.photo && state.photo.id && state.photo.thumb);
      var working = upload.status === 'working';
      u.empty.hidden = working || has;
      u.work.hidden = !working;
      u.done.hidden = working || !has;
      if (has && u.thumb.getAttribute('src') !== state.photo.thumb) u.thumb.src = state.photo.thumb;
      // „recht klein“: for the card in its own words (14 × 14 cm), else for
      // printing the PDF.
      var soft = has && photoSoft();
      u.small.hidden = !soft;
      if (soft) setText(u.small, isPrint() ? cardPhotoText() : T('Das Foto ist recht klein – im Druck kann es etwas unscharf wirken.', 'The photo is quite small – it may look a little soft in print.'));
      var pct = Math.round(upload.progress * 100);
      setText(u.workText, upload.phase === 'upload' ? T('Wird hochgeladen … ', 'Uploading … ') + pct + ' %' : T('Foto wird vorbereitet …', 'Preparing your photo …'));
      u.barFill.style.width = (upload.phase === 'upload' ? Math.max(4, pct) : 4) + '%';
      u.bar.setAttribute('aria-valuenow', String(upload.phase === 'upload' ? pct : 0));
      u.bar.classList.toggle('is-indeterminate', upload.phase !== 'upload');
      var failed = upload.status === 'error';
      if (failed) {
        u.err.hidden = false;
        setText(u.errText, upload.message);
        u.box.classList.add('is-invalid');
      } else if (!shown.photo) {
        u.err.hidden = true;
        u.box.classList.remove('is-invalid');
      }
    }
    // Downscale on the device (Mo's upload limit, mobile data): ≤ 2400 px on
    // the long side — but never under Mo's 500 px on the short side (a
    // panorama) — JPEG ≤ the byte limit, white behind transparency; plus a
    // small thumbnail for the preview (kept in the draft).
    function readImage(file) {
      return new Promise(function (resolve, reject) {
        var url = null;
        try { url = URL.createObjectURL(file); } catch (e) { reject('decode'); return; }
        var img = new Image();
        img.onload = function () {
          try { URL.revokeObjectURL(url); } catch (e) {}
          if (!img.naturalWidth || !img.naturalHeight) { reject('decode'); return; }
          resolve(img);
        };
        img.onerror = function () { try { URL.revokeObjectURL(url); } catch (e) {} reject('decode'); };
        img.src = url;
      });
    }
    function canvasBlob(canvas, q) {
      return new Promise(function (resolve) {
        if (canvas.toBlob) {
          canvas.toBlob(function (b) { resolve(b); }, 'image/jpeg', q);
          return;
        }
        try {
          var data = canvas.toDataURL('image/jpeg', q);
          var bin = atob(data.split(',')[1]);
          var arr = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          resolve(new Blob([arr], { type: 'image/jpeg' }));
        } catch (e) { resolve(null); }
      });
    }
    // minShort (the upload only, not the thumbnail): the short side stays at
    // that size or more, even if the long side then exceeds maxSide — a
    // panorama keeps Mo's minimum (Mo scales the long side down itself).
    function drawScaled(img, maxSide, minShort) {
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      var sh = Math.min(w, h);
      var s = Math.min(1, maxSide / Math.max(w, h));
      if (minShort && sh * s < minShort) s = Math.min(1, minShort / sh);
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * s));
      c.height = Math.max(1, Math.round(h * s));
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      try { ctx.imageSmoothingQuality = 'high'; } catch (e) {}
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return c;
    }
    // Mo's shortest side (GIFT_VOUCHER_PHOTO_MIN_SIDE): a smaller photo is
    // refused here with Mo's own words, before any upload.
    var PHOTO_MIN_SIDE = 500;
    function prepareImage(file, maxBytes) {
      return readImage(file).then(function (img) {
        if (Math.min(img.naturalWidth, img.naturalHeight) < PHOTO_MIN_SIDE) throw 'small';
        var maxSide = 2400;
        var qualities = [0.9, 0.82, 0.74, 0.66];
        function attempt(k) {
          var c = drawScaled(img, maxSide, PHOTO_MIN_SIDE);
          return canvasBlob(c, qualities[k]).then(function (blob) {
            if (!blob) throw 'encode';
            if (blob.size <= maxBytes) return { blob: blob, w: c.width, h: c.height };
            if (k + 1 < qualities.length) return attempt(k + 1);
            maxSide = Math.round(maxSide * 0.8);
            if (maxSide < 900) throw 'large';
            return attempt(0);
          });
        }
        return attempt(0).then(function (res) {
          var t = drawScaled(img, 720);
          res.thumb = t.toDataURL('image/jpeg', 0.82);
          return res;
        });
      });
    }
    function uploadPhoto(blob, onProgress) {
      return new Promise(function (resolve) {
        var xhr;
        try { xhr = new XMLHttpRequest(); } catch (e) { resolve({ ok: false, status: 0, network: true }); return; }
        xhr.open('POST', API + '/api/gift-vouchers/photo', true);
        var h = guardedHeaders('image/jpeg');
        Object.keys(h).forEach(function (k) { xhr.setRequestHeader(k, h[k]); });
        xhr.timeout = 90000;
        if (xhr.upload) xhr.upload.onprogress = function (e) { if (e.lengthComputable && e.total) onProgress(e.loaded / e.total); };
        xhr.onload = function () {
          var j = null;
          try { j = JSON.parse(xhr.responseText || 'null'); } catch (e) { j = null; }
          resolve(normalize(xhr.status, j));
        };
        xhr.onerror = function () { resolve({ ok: false, status: 0, network: true }); };
        xhr.ontimeout = function () { resolve({ ok: false, status: 0, network: true, timeout: true }); };
        xhr.send(blob);
      });
    }
    function onPhoto(file) {
      var seq = ++upload.seq;
      // The page re-encodes every photo as JPEG, so any image the browser can
      // decode is fine (e.g. „image/jpg“, or HEIC in Safari); the picker
      // offers JPG, PNG and WebP. Not an image at all → the note at once.
      var type = String(file.type || '').toLowerCase();
      if (type && !/^image\//.test(type)) {
        upload = { status: 'error', progress: 0, phase: '', seq: seq, message: T('Bitte wähle ein Foto im Format JPG, PNG oder WebP.', 'Please choose a JPG, PNG or WebP photo.') };
        paintUpload();
        return;
      }
      if (file.size > 40000000) {
        upload = { status: 'error', progress: 0, phase: '', seq: seq, message: T('Das Foto ist zu groß (höchstens 40 MB).', 'The photo is too large (40 MB at most).') };
        paintUpload();
        return;
      }
      upload = { status: 'working', progress: 0, phase: 'prepare', message: '', seq: seq };
      paintUpload();
      say(T('Foto wird vorbereitet …', 'Preparing your photo …'));
      prepareImage(file, limits().photoMaxBytes).then(function (img) {
        if (torn || seq !== upload.seq) return null;
        upload.phase = 'upload';
        paintUpload();
        return uploadPhoto(img.blob, function (p) {
          if (seq !== upload.seq) return;
          upload.progress = p;
          paintUpload();
        }).then(function (res) {
          if (torn || seq !== upload.seq) return;
          if (!res.ok && res.status === 409) {
            upload = { status: 'idle', progress: 0, phase: '', message: '', seq: seq };
            stopSelling(res);
            return;
          }
          if (res.ok && typeof res.data.photoId === 'string' && /^[A-Za-z0-9_-]{22,64}$/.test(res.data.photoId)) {
            // The size Mo stored (it scales a long side over 2400 px down
            // again) decides the „recht klein“ notes (photoSoft) — that is
            // what is printed.
            var mw = Number(res.data.width);
            var mh = Number(res.data.height);
            var stored = mw > 0 && mh > 0 && isFinite(mw) && isFinite(mh);
            var pw = stored ? Math.round(mw) : img.w;
            var ph = stored ? Math.round(mh) : img.h;
            state.photo = { id: res.data.photoId, thumb: img.thumb, w: pw, h: ph };
            upload = { status: 'idle', progress: 1, phase: '', message: '', seq: seq };
            delete shown.photo;
            changed();
            paintUpload();
            setSide('front', true);
            paintPreview();
            focusEl(uploadUi.change);
            say(T('Foto hochgeladen.', 'Photo uploaded.'));
          } else {
            upload = { status: 'error', progress: 0, phase: '', seq: seq, message: res.ok ? T('Das Foto konnte nicht gespeichert werden. Bitte versuche es noch einmal.', 'The photo could not be saved. Please try again.') : errorText(res, 'Das Foto konnte nicht hochgeladen werden. Bitte versuche es noch einmal.', 'The photo could not be uploaded. Please try again.') };
            paintUpload();
          }
        });
      }).catch(function (why) {
        if (torn || seq !== upload.seq) return;
        upload = { status: 'error', progress: 0, phase: '', seq: seq, message: why === 'small'
          ? T('Das Foto ist zu klein — es braucht mindestens 500 × 500 Pixel.', 'The photo is too small — it needs at least 500 × 500 pixels.')
          : why === 'large'
            ? T('Das Foto lässt sich nicht klein genug rechnen. Bitte wähle ein anderes.', 'This photo cannot be made small enough. Please choose another one.')
            : T('Dieses Bild können wir nicht lesen. Bitte wähle ein Foto im Format JPG, PNG oder WebP.', 'We cannot read this image. Please choose a JPG, PNG or WebP photo.') };
        paintUpload();
      });
    }

    // ----- step 3: Text ------------------------------------------------------------------------
    var ai = { open: false, status: 'idle', items: [], message: '', seq: 0, applied: -1 };
    var aiUi = {};
    function buildText() {
      var lim = limits();
      var p = panel(2, T('Was soll draufstehen?', 'What should it say?'), T('Alles ist optional – ohne Nachricht drucken wir einen kurzen Gruß.', 'Everything is optional – without a message we print a short greeting.'));
      var names = el('div', 'ms-gv-row');
      var fr = field({ key: 'recipient', id: uid + '-for', label: T('Für', 'For'), optional: true, max: lim.recipientName, placeholder: T('z. B. Lena', 'e.g. Lena'), hint: T('Steht vorne auf dem Gutschein.', 'Shown on the front.') });
      var fs = field({ key: 'sender', id: uid + '-from', label: T('Von', 'From'), optional: true, max: lim.senderName, placeholder: T('z. B. Jonas', 'e.g. Jonas'), autocomplete: 'given-name', hint: T('Steht innen unter der Nachricht.', 'Shown inside under the message.') });
      names.appendChild(fr.wrap);
      names.appendChild(fs.wrap);
      p.body.appendChild(names);
      var fm = field({ key: 'message', id: uid + '-msg', label: T('Deine Nachricht', 'Your message'), optional: true, multiline: true, rows: 5, max: lim.message, counter: true, placeholder: T('Schreib ein paar persönliche Worte …', 'Write a few personal words …'), hint: T('Bis zu ' + lim.message + ' Zeichen und ' + lim.messageLines + ' Zeilen.', 'Up to ' + lim.message + ' characters and ' + lim.messageLines + ' lines.') });
      p.body.appendChild(fm.wrap);
      fr.input.value = state.recipient;
      fs.input.value = state.sender;
      fm.input.value = state.message;
      bindText(fr, 'recipient', lim.recipientName, 1, false, 'front');
      bindText(fs, 'sender', lim.senderName, 1, false, 'inside');
      bindText(fm, 'message', lim.message, lim.messageLines, true, 'inside');
      paintCount();
      if (aiAllowed()) buildAi(p.body);
    }
    function bindText(f, key, max, lines, multi, prefSide) {
      var composing = false;
      function onInput() {
        if (composing) return;
        var r = applyClean(f.input, max, lines, multi);
        warnRemoved(f, r.removed);
        state[key] = f.input.value;
        delete extErr[key];
        if (key === 'message') { ai.applied = -1; paintAi(); paintCount(); }
        changed();
        paintPreview();
        if (key === 'recipient' || key === 'sender') paintAi();
      }
      f.input.addEventListener('compositionstart', function () { composing = true; });
      f.input.addEventListener('compositionend', function () { composing = false; onInput(); });
      f.input.addEventListener('input', onInput);
      // The preview turns to the side the field is on.
      f.input.addEventListener('focus', function () { if (side !== prefSide) setSide(prefSide); });
    }
    function paintCount() {
      var f = FIELDS.message;
      if (!f || !f.count) return;
      var lim = limits();
      var n = f.input.value.length;
      var lines = f.input.value ? f.input.value.split('\n').length : 0;
      setText(f.count, n + '/' + lim.message + (lines >= lim.messageLines - 1 ? ' · ' + lines + '/' + lim.messageLines + T(' Zeilen', ' lines') : ''));
      f.count.classList.toggle('is-max', n >= lim.message || lines >= lim.messageLines);
    }
    // „Mit Mo formulieren“: occasion + tone → up to three suggestions (Mo
    // writes with the {{fuer}} / {{von}} placeholders; the names are filled in
    // here). Mo asks the model for three and passes on one to three.
    function aiTitle(n) {
      if (n === 1) return T('Mo schreibt dir einen Vorschlag', 'Mo writes a suggestion for you');
      if (n === 2) return T('Mo schreibt dir zwei Vorschläge', 'Mo writes two suggestions for you');
      return T('Mo schreibt dir drei Vorschläge', 'Mo writes three suggestions for you');
    }
    function aiReadyText(n) {
      if (n === 1) return T('Ein Vorschlag von Mo ist da.', 'One suggestion from Mo is ready.');
      if (n === 2) return T('Zwei Vorschläge von Mo sind da.', 'Two suggestions from Mo are ready.');
      return T('Drei Vorschläge von Mo sind da.', 'Three suggestions from Mo are ready.');
    }
    function chipGroup(label, list, key) {
      var wrap = el('div', 'ms-gv-chipgroup');
      var lab = el('p', 'ms-gv-label', label);
      lab.id = uid + '-ai-' + key;
      wrap.appendChild(lab);
      var row = el('div', 'ms-gv-chips');
      row.setAttribute('role', 'group');
      row.setAttribute('aria-labelledby', lab.id);
      var btns = [];
      list.forEach(function (o) {
        var b = el('button', 'ms-gv-chip', o.label);
        b.type = 'button';
        b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function () {
          state[key] = o.key;
          save();
          paintAi();
        });
        b.__key = o.key;
        btns.push(b);
        row.appendChild(b);
      });
      wrap.appendChild(row);
      return { wrap: wrap, btns: btns };
    }
    function buildAi(host) {
      var box = el('div', 'ms-gv-ai');
      var toggle = el('button', 'ms-gv-btn ms-gv-btn--secondary ms-gv-btn--sm ms-gv-ai__toggle');
      toggle.type = 'button';
      toggle.innerHTML = icon('sparkle');
      toggle.appendChild(el('span', '', T('Mit Mo formulieren', 'Write it with Mo')));
      toggle.setAttribute('aria-expanded', 'false');
      var bodyId = uid + '-ai';
      toggle.setAttribute('aria-controls', bodyId);
      box.appendChild(toggle);
      var body = el('div', 'ms-gv-ai__body');
      body.id = bodyId;
      body.hidden = true;
      var head = el('div', 'ms-gv-ai__head');
      var title = el('p', 'ms-gv-ai__title', aiTitle(3));
      head.appendChild(title);
      var privacy = el('p', 'ms-gv-hint ms-gv-ai__privacy');
      privacy.innerHTML = icon('shield');
      privacy.appendChild(el('span', '', T('Mo bekommt nur Anlass und Ton – deine Namen setzen wir erst hier auf der Seite ein.', 'Mo only gets the occasion and the tone – your names are filled in here on the page.')));
      head.appendChild(privacy);
      body.appendChild(head);
      var occ = chipGroup(T('Anlass', 'Occasion'), cfg.occasions, 'occasion');
      var tone = chipGroup(T('Ton', 'Tone'), cfg.tones, 'tone');
      body.appendChild(occ.wrap);
      body.appendChild(tone.wrap);
      var go2 = el('button', 'ms-gv-btn ms-gv-btn--primary ms-gv-btn--sm ms-gv-ai__go');
      go2.type = 'button';
      go2.innerHTML = icon('sparkle');
      var goLabel = el('span', '', T('Vorschläge schreiben', 'Write suggestions'));
      go2.appendChild(goLabel);
      var goRow = el('div', 'ms-gv-ai__gorow');
      goRow.appendChild(go2);
      var goHint = el('p', 'ms-gv-hint ms-gv-ai__gohint');
      goHint.setAttribute('aria-live', 'polite');
      goRow.appendChild(goHint);
      body.appendChild(goRow);
      var list = el('div', 'ms-gv-ai__list');
      list.setAttribute('aria-live', 'polite');
      list.setAttribute('aria-busy', 'false');
      body.appendChild(list);
      var err = el('p', 'ms-gv-field__error ms-gv-ai__error');
      err.setAttribute('role', 'alert');
      err.hidden = true;
      body.appendChild(err);
      box.appendChild(body);
      host.appendChild(box);
      aiUi = { box: box, toggle: toggle, body: body, title: title, occ: occ, tone: tone, go: go2, goLabel: goLabel, goHint: goHint, list: list, err: err };
      toggle.addEventListener('click', function () {
        ai.open = !ai.open;
        paintAi();
        if (ai.open) {
          var first = occ.btns.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; })[0] || occ.btns[0];
          focusEl(first);
          reveal(body, 'center');
        }
      });
      go2.addEventListener('click', suggest);
      if (!state.tone && cfg.tones[0]) state.tone = cfg.tones[0].key;
    }
    function suggest() {
      if (ai.status === 'loading') return;
      if (!state.occasion || !state.tone) {
        setText(aiUi.goHint, T('Wähle zuerst einen Anlass.', 'Choose an occasion first.'));
        focusEl(aiUi.occ.btns[0]);
        return;
      }
      var seq = ++ai.seq;
      ai.status = 'loading';
      ai.items = [];
      ai.message = '';
      ai.applied = -1;
      paintAi();
      say(T('Mo schreibt …', 'Mo is writing …'));
      request('POST', '/api/gift-vouchers/suggest', { occasion: state.occasion, tone: state.tone, locale: LOCALE }, 30000).then(function (res) {
        if (torn || seq !== ai.seq) return;
        if (!res.ok && res.status === 409) {
          ai.status = 'idle';
          stopSelling(res);
          return;
        }
        var items = res.ok && Array.isArray(res.data.suggestions) ? res.data.suggestions.filter(function (s) { return typeof s === 'string' && s.replace(/\s+/g, ''); }).slice(0, 3).map(function (s) { return s.slice(0, 400); }) : [];
        if (items.length) {
          ai.status = 'ok';
          ai.items = items;
          say(aiReadyText(items.length));
        } else {
          ai.status = 'error';
          ai.message = res.ok ? T('Mo hatte gerade keine Idee – bitte versuch es noch einmal.', 'Mo had no idea just now – please try again.') : errorText(res, 'Mo kann gerade nicht formulieren – bitte versuch es später noch einmal.', 'Mo cannot write right now – please try again later.');
        }
        paintAi();
      });
    }
    function suggestionText(i) {
      var lim = limits();
      var filled = fillSuggestion(ai.items[i], finalLine(state.recipient), finalLine(state.sender));
      return liveClean(filled, lim.message, lim.messageLines, true).text;
    }
    function applySuggestion(i) {
      var f = FIELDS.message;
      if (!f) return;
      f.input.value = suggestionText(i);
      state.message = f.input.value;
      ai.applied = i;
      changed();
      paintCount();
      paintAi();
      setSide('inside', true);
      paintPreview();
      say(T('Vorschlag übernommen – du kannst ihn im Feld noch anpassen.', 'Suggestion applied – you can still edit it in the field.'));
      focusEl(f.input);
      reveal(f.wrap, 'center');
    }
    function paintAi() {
      var u = aiUi;
      if (!u.box) return;
      u.toggle.setAttribute('aria-expanded', ai.open ? 'true' : 'false');
      u.body.hidden = !ai.open;
      u.occ.btns.forEach(function (b) { b.setAttribute('aria-pressed', b.__key === state.occasion ? 'true' : 'false'); });
      u.tone.btns.forEach(function (b) { b.setAttribute('aria-pressed', b.__key === state.tone ? 'true' : 'false'); });
      var loading = ai.status === 'loading';
      u.go.setAttribute('aria-busy', loading ? 'true' : 'false');
      setText(u.goLabel, loading ? T('Mo schreibt …', 'Mo is writing …') : ai.status === 'ok' ? T('Neue Vorschläge', 'New suggestions') : T('Vorschläge schreiben', 'Write suggestions'));
      // „drei“ as asked for; the real number once Mo's texts are here.
      setText(u.title, aiTitle(ai.status === 'ok' ? ai.items.length : 3));
      if (state.occasion) setText(u.goHint, '');
      u.list.setAttribute('aria-busy', loading ? 'true' : 'false');
      u.err.hidden = ai.status !== 'error';
      if (ai.status === 'error') {
        u.err.innerHTML = icon('alert');
        u.err.appendChild(el('span', '', ai.message));
      }
      // Rebuild the list (one small card per text, three placeholders while
      // Mo writes; texts via textContent).
      u.list.innerHTML = '';
      if (loading) {
        for (var s = 0; s < 3; s++) {
          var sk = el('div', 'ms-gv-sugg ms-gv-sugg--skeleton');
          sk.setAttribute('aria-hidden', 'true');
          sk.appendChild(el('span', 'ms-gv-skel ms-gv-skel--tag'));
          sk.appendChild(el('span', 'ms-gv-skel'));
          sk.appendChild(el('span', 'ms-gv-skel'));
          sk.appendChild(el('span', 'ms-gv-skel ms-gv-skel--short'));
          u.list.appendChild(sk);
        }
        return;
      }
      if (ai.status !== 'ok') return;
      ai.items.forEach(function (_, i) {
        var card = el('div', 'ms-gv-sugg' + (ai.applied === i ? ' is-applied' : ''));
        var top = el('div', 'ms-gv-sugg__top');
        top.appendChild(el('span', 'ms-gv-sugg__tag', T('KI-Vorschlag ', 'AI suggestion ') + (i + 1)));
        card.appendChild(top);
        card.appendChild(el('p', 'ms-gv-sugg__text', suggestionText(i)));
        var b = el('button', 'ms-gv-btn ms-gv-btn--secondary ms-gv-btn--sm ms-gv-sugg__use');
        b.type = 'button';
        if (ai.applied === i) {
          b.innerHTML = icon('check');
          b.appendChild(el('span', '', T('Übernommen', 'Applied')));
        } else {
          b.appendChild(el('span', '', T('Übernehmen', 'Use this')));
        }
        b.setAttribute('aria-label', (ai.applied === i ? T('Übernommen: ', 'Applied: ') : T('Übernehmen: ', 'Use: ')) + T('KI-Vorschlag ', 'AI suggestion ') + (i + 1));
        b.addEventListener('click', function () { applySuggestion(i); });
        card.appendChild(b);
        u.list.appendChild(card);
      });
    }

    // ----- step 4: Versand -------------------------------------------------------------------
    var deliveryBtns = {};
    var addrBox = null;
    var cardPhotoNote = null;
    function buildDelivery() {
      var p = panel(3, T('Wie soll der Gutschein ankommen?', 'How should the voucher arrive?'), T('Das PDF bekommst du in jedem Fall sofort nach dem Kauf per E-Mail.', 'You always get the PDF by e-mail right after your purchase.'));
      var group = el('div', 'ms-gv-options');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', T('Versand', 'Delivery'));
      function option(key, ic, title, text, price, badge) {
        var b = el('button', 'ms-gv-tile ms-gv-option');
        b.type = 'button';
        b.setAttribute('aria-pressed', 'false');
        var i = el('span', 'ms-gv-option__icon');
        i.innerHTML = icon(ic);
        b.appendChild(i);
        var t = el('span', 'ms-gv-option__text');
        t.appendChild(el('span', 'ms-gv-option__title', title));
        t.appendChild(el('span', 'ms-gv-option__desc', text));
        b.appendChild(t);
        var pr = el('span', 'ms-gv-option__price' + (badge ? ' ms-gv-option__price--incl' : ''), price);
        b.appendChild(pr);
        b.addEventListener('click', function () {
          var was = state.delivery;
          state.delivery = key;
          changed();
          // The card's own shape shows at once (square front).
          if (was !== key) setSide('front');
          if (key !== 'print' || was === key) return;
          // A photo too small for the card: the note under the options comes
          // first (and is said), the address right after it.
          var soft = photoSoft() && cardPhotoNote;
          if (soft) say(cardPhotoText());
          if (soft || addrBox) reveal(soft ? cardPhotoNote : addrBox, 'center');
        });
        deliveryBtns[key] = b;
        group.appendChild(b);
      }
      option('pdf', 'mail', T('PDF per E-Mail', 'PDF by e-mail'), T('Sofort nach dem Kauf in deinem Postfach – zum Ausdrucken oder Weiterleiten.', 'In your inbox right after your purchase – to print or forward.'), T('Inklusive', 'Included'), true);
      if (printAllowed()) {
        option('print', 'card', T('Premium-Karte per Post', 'Premium card by post'), T('350-g-Karte im Umschlag · 14 × 14 cm · ', '350 g card in an envelope · 14 × 14 cm · ') + cfg.print.deliveryNote + T('. Das PDF kommt zusätzlich sofort.', '. The PDF still arrives right away.'), '+ ' + money(PRODUCTS.print.priceCents, PRODUCTS.currency), false);
      }
      p.body.appendChild(group);
      if (printAllowed()) {
        // The card with a photo under limits.photoPrintMinSide: a calm note.
        cardPhotoNote = el('p', 'ms-gv-callout ms-gv-delivery__photo');
        cardPhotoNote.hidden = true;
        cardPhotoNote.innerHTML = icon('info');
        cardPhotoNote.appendChild(el('span', '', cardPhotoText()));
        p.body.appendChild(cardPhotoNote);
        buildAddress(p.body);
      } else {
        var note = el('p', 'ms-gv-callout');
        note.innerHTML = icon('info');
        note.appendChild(el('span', '', T('Die Premium-Karte per Post gibt es gerade nicht – dein Gutschein kommt als PDF, zum Ausdrucken oder Weiterleiten.', 'The premium card by post is not available right now – your voucher comes as a PDF, to print or forward.')));
        p.body.appendChild(note);
      }
    }
    function buildAddress(host) {
      var box = el('div', 'ms-gv-address');
      box.hidden = true;
      var head = el('div', 'ms-gv-address__head');
      head.appendChild(el('p', 'ms-gv-address__title', T('Wohin soll die Karte?', 'Where should the card go?')));
      head.appendChild(el('p', 'ms-gv-hint', T('Direkt an die beschenkte Person – oder an dich, wenn du sie selbst überreichen möchtest.', 'Straight to the lucky one – or to you, if you want to hand it over yourself.')));
      box.appendChild(head);
      var grid = el('div', 'ms-gv-address__grid');
      var defs = [
        { key: 'addr-name', prop: 'name', label: T('Name', 'Name'), max: 60, autocomplete: 'section-gv shipping name', placeholder: T('Vor- und Nachname', 'First and last name'), cls: 'ms-gv-field--full' },
        { key: 'addr-line1', prop: 'line1', label: T('Straße und Hausnummer', 'Street and house number'), max: 80, autocomplete: 'section-gv shipping address-line1', cls: 'ms-gv-field--full' },
        { key: 'addr-line2', prop: 'line2', label: T('Adresszusatz', 'Address line 2'), optional: true, max: 80, autocomplete: 'section-gv shipping address-line2', placeholder: T('z. B. c/o, Hinterhaus', 'e.g. c/o, flat'), cls: 'ms-gv-field--full' },
        { key: 'addr-postal', prop: 'postalCode', label: T('PLZ', 'Postcode'), max: 10, autocomplete: 'section-gv shipping postal-code', inputmode: country() === 'DE' ? 'numeric' : 'text', cls: 'ms-gv-field--postal' },
        { key: 'addr-city', prop: 'city', label: T('Ort', 'Town / city'), max: 60, autocomplete: 'section-gv shipping address-level2', cls: 'ms-gv-field--city' }
      ];
      defs.forEach(function (d) {
        var f = field({ key: d.key, id: uid + '-' + d.key, label: d.label, optional: d.optional, max: d.max, autocomplete: d.autocomplete, inputmode: d.inputmode, placeholder: d.placeholder, cls: d.cls });
        f.input.value = state.address[d.prop] || '';
        var composing = false;
        function onInput() {
          if (composing) return;
          var r = applyClean(f.input, d.max, 1, false);
          warnRemoved(f, r.removed);
          state.address[d.prop] = f.input.value;
          delete extErr[d.key];
          changed();
        }
        f.input.addEventListener('compositionstart', function () { composing = true; });
        f.input.addEventListener('compositionend', function () { composing = false; onInput(); });
        f.input.addEventListener('input', onInput);
        // Inline check when leaving a field the visitor has typed in.
        f.input.addEventListener('blur', function () {
          if (!f.input.value) return;
          var bad = addressProblems().some(function (x) { return x.key === d.key; });
          if (bad) { shown[d.key] = true; paintErrors(); paintFooter(); }
        });
        grid.appendChild(f.wrap);
      });
      // Country: fixed „Deutschland“ while Mo prints for one country only.
      var list = countries();
      var cw = el('div', 'ms-gv-field ms-gv-field--full');
      var cl = el('p', 'ms-gv-label', T('Land', 'Country'));
      cl.id = uid + '-addr-country-l';
      cw.appendChild(cl);
      if (list.length === 1) {
        var fixed = el('p', 'ms-gv-fixed');
        fixed.setAttribute('aria-labelledby', cl.id);
        fixed.appendChild(el('span', '', countryName(list[0])));
        fixed.appendChild(el('span', 'ms-gv-fixed__note', T('Versand nur innerhalb von ', 'Shipping only within ') + countryName(list[0])));
        cw.appendChild(fixed);
      } else {
        var sel = el('select', 'ms-gv-input ms-gv-select');
        sel.id = uid + '-addr-country';
        cl.setAttribute('for', sel.id);
        list.forEach(function (c) {
          var o = el('option', '', countryName(c));
          o.value = c;
          sel.appendChild(o);
        });
        sel.value = country();
        sel.addEventListener('change', function () { state.address.country = sel.value; changed(); });
        cw.appendChild(sel);
      }
      grid.appendChild(cw);
      box.appendChild(grid);
      host.appendChild(box);
      addrBox = box;
    }
    function paintDelivery() {
      var d = isPrint() ? 'print' : 'pdf';
      Object.keys(deliveryBtns).forEach(function (k) { deliveryBtns[k].setAttribute('aria-pressed', k === d ? 'true' : 'false'); });
      if (addrBox) addrBox.hidden = d !== 'print';
      if (cardPhotoNote) cardPhotoNote.hidden = !(d === 'print' && photoSoft());
    }

    // ----- step 5: Prüfen & kaufen --------------------------------------------------------------
    var review = {};
    var termsInput = null;
    var buying = null;
    var checkoutTimer = null;
    var draftCache = { key: '', token: '' };
    function buildReview() {
      var p = panel(4, T('Prüfen & kaufen', 'Review & buy'), T('So kommt dein Gutschein an. Passt alles?', 'This is how your voucher arrives. All good?'));
      var dl = el('dl', 'ms-gv-review');
      p.body.appendChild(dl);
      var termsWrap = el('div', 'ms-gv-review__terms ms-gv-block');
      var lab = el('label', 'ms-gv-check');
      termsInput = el('input', 'ms-gv-check__input');
      termsInput.type = 'checkbox';
      termsInput.id = uid + '-terms';
      lab.setAttribute('for', termsInput.id);
      var lt = el('span', 'ms-gv-check__text');
      lt.appendChild(document.createTextNode(T('Ich habe die ', 'I have read the ')));
      var a = el('a', 'ms-gv-link ms-gv-link--inline', T('Gutscheinbedingungen', 'voucher terms'));
      a.href = termsUrl();
      a.target = '_blank';
      a.rel = 'noopener';
      a.appendChild(el('span', 'ms-gv-sr', T(' (öffnet in neuem Tab)', ' (opens in a new tab)')));
      lt.appendChild(a);
      lt.appendChild(document.createTextNode(T(' gelesen.', '.')));
      termsWrap.appendChild(termsInput);
      lab.appendChild(lt);
      termsWrap.appendChild(lab);
      var terr = el('p', 'ms-gv-field__error');
      terr.id = uid + '-terms-err';
      terr.hidden = true;
      terr.innerHTML = icon('alert');
      var terrText = el('span');
      terr.appendChild(terrText);
      termsWrap.appendChild(terr);
      errs.terms = function (msg) {
        terr.hidden = !msg;
        setText(terrText, msg || '');
        termsWrap.classList.toggle('is-invalid', !!msg);
        if (msg) { termsInput.setAttribute('aria-invalid', 'true'); termsInput.setAttribute('aria-describedby', terr.id); } else { termsInput.removeAttribute('aria-invalid'); termsInput.removeAttribute('aria-describedby'); }
      };
      termsInput.addEventListener('change', function () { paintErrors(); paintBuy(); paintBar(); });
      p.body.appendChild(termsWrap);
      // An edit after „In den Warenkorb“: this version takes the earlier one's
      // place in the cart (buy()).
      var replace = el('p', 'ms-gv-callout ms-gv-buy__replace');
      replace.hidden = true;
      replace.innerHTML = icon('info');
      replace.appendChild(el('span', '', T('Dein vorheriger Entwurf liegt im Warenkorb – er wird durch diesen ersetzt.', 'Your previous design is in the cart – this one replaces it.')));
      p.body.appendChild(replace);
      // Buy
      var actions = el('div', 'ms-gv-buy');
      var buyBtn = el('button', 'ms-gv-btn ms-gv-btn--primary ms-gv-buy__now');
      buyBtn.type = 'button';
      buyBtn.innerHTML = icon('lock');
      var buyLabel = el('span', '', T('Jetzt kaufen', 'Buy now'));
      buyBtn.appendChild(buyLabel);
      buyBtn.addEventListener('click', function () { buy('checkout'); });
      var cartBtn = el('button', 'ms-gv-btn ms-gv-btn--secondary ms-gv-buy__cart');
      cartBtn.type = 'button';
      cartBtn.innerHTML = icon('cartIcon');
      var cartLabel = el('span', '', T('In den Warenkorb', 'Add to cart'));
      cartBtn.appendChild(cartLabel);
      cartBtn.addEventListener('click', function () { buy('cart'); });
      actions.appendChild(buyBtn);
      actions.appendChild(cartBtn);
      p.body.appendChild(actions);
      // After „In den Warenkorb“: the next moves.
      var done = el('div', 'ms-gv-added');
      done.hidden = true;
      done.setAttribute('tabindex', '-1');
      var dTitle = el('p', 'ms-gv-added__title');
      dTitle.innerHTML = icon('check');
      dTitle.appendChild(el('span', '', T('Dein Gutschein liegt im Warenkorb.', 'Your voucher is in the cart.')));
      done.appendChild(dTitle);
      var dActs = el('div', 'ms-gv-added__actions');
      var toCheckout = el('a', 'ms-gv-btn ms-gv-btn--primary', T('Zur Kasse', 'Checkout'));
      toCheckout.href = checkoutUrl();
      // The long label, or the short one on a narrow panel (CSS).
      var another = el('button', 'ms-gv-btn ms-gv-btn--secondary');
      another.type = 'button';
      another.appendChild(el('span', 'ms-gv-added__long', T('Noch einen Gutschein gestalten', 'Design another voucher')));
      another.appendChild(el('span', 'ms-gv-added__short', T('Noch einen gestalten', 'Design another')));
      another.addEventListener('click', startOver);
      dActs.appendChild(toCheckout);
      dActs.appendChild(another);
      done.appendChild(dActs);
      p.body.appendChild(done);
      var err = el('div', 'ms-gv-buy__error');
      err.setAttribute('role', 'alert');
      err.hidden = true;
      p.body.appendChild(err);
      var fine = el('p', 'ms-gv-hint ms-gv-buy__fine');
      fine.innerHTML = icon('info');
      fine.appendChild(el('span', 'ms-gv-buy__finetext'));
      p.body.appendChild(fine);
      review = { dl: dl, buyBtn: buyBtn, buyLabel: buyLabel, cartBtn: cartBtn, cartLabel: cartLabel, actions: actions, done: done, replace: replace, err: err, fine: fine, terms: termsWrap, link: a };
    }
    function termsChecked() { return !!(termsInput && termsInput.checked); }
    function paintReview() {
      var dl = review.dl;
      if (!dl) return;
      dl.innerHTML = '';
      var v = selectedVariant();
      var d = selectedDesign();
      var a = state.address;
      function row(label, value, step, extraCls) {
        var r = el('div', 'ms-gv-review__row' + (extraCls ? ' ' + extraCls : ''));
        r.appendChild(el('dt', 'ms-gv-review__label', label));
        var dd = el('dd', 'ms-gv-review__value');
        dd.appendChild(el('span', 'ms-gv-review__text', value));
        r.appendChild(dd);
        if (step != null) {
          var b = el('button', 'ms-gv-link ms-gv-review__edit', T('Ändern', 'Change'));
          b.type = 'button';
          b.setAttribute('aria-label', label + T(' ändern', ': change'));
          b.addEventListener('click', function () { go(step); });
          dd.appendChild(b);
        }
        dl.appendChild(r);
      }
      row(T('Betrag', 'Amount'), v ? money(v.faceCents, 'EUR') : '—', 0);
      row(T('Motiv', 'Design'), d ? d.name : '—', 1);
      row(T('Für / Von', 'For / From'), (finalLine(state.recipient) || '—') + ' / ' + (finalLine(state.sender) || '—'), 2);
      var msg = finalText(state.message);
      row(T('Nachricht', 'Message'), msg ? msg.replace(/\n+/g, ' / ') : T('Kurzer Gruß zum Motiv', 'A short greeting'), null, 'ms-gv-review__row--msg');
      var ship = isPrint()
        ? T('Premium-Karte per Post', 'Premium card by post') + ' · ' + money(PRODUCTS.print.priceCents, PRODUCTS.currency) + '\n' + [finalLine(a.name), finalLine(a.line1), finalLine(a.line2), (postalCode() + ' ' + finalLine(a.city)).replace(/^ +| +$/g, '')].filter(Boolean).join(', ')
        : T('PDF per E-Mail · inklusive', 'PDF by e-mail · included');
      row(T('Versand', 'Delivery'), ship, 3, 'ms-gv-review__row--ship');
      var total = el('div', 'ms-gv-review__row ms-gv-review__row--total');
      total.appendChild(el('dt', 'ms-gv-review__label', T('Gesamt', 'Total')));
      total.appendChild(el('dd', 'ms-gv-review__value', money(totalCents(), PRODUCTS.currency)));
      dl.appendChild(total);
      if (review.link) review.link.href = termsUrl();
      paintBuy();
    }
    function totalCents() {
      var v = selectedVariant();
      return (v ? v.priceCents : 0) + (isPrint() ? PRODUCTS.print.priceCents : 0);
    }
    function paintBuy() {
      if (!review.buyBtn) return;
      var added = !!state.added && state.added === draftKey();
      review.actions.hidden = added;
      review.done.hidden = !added;
      review.replace.hidden = added || !state.added || !state.addedLines;
      var busy = !!buying;
      [review.buyBtn, review.cartBtn].forEach(function (b) {
        b.setAttribute('aria-busy', busy ? 'true' : 'false');
        if (busy || !termsChecked()) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
      });
      setText(review.buyLabel, buying === 'checkout' ? T('Wird vorbereitet …', 'Preparing …') : T('Jetzt kaufen', 'Buy now'));
      setText(review.cartLabel, buying === 'cart' ? T('Wird hinzugefügt …', 'Adding …') : T('In den Warenkorb', 'Add to cart'));
      var ft = review.fine.querySelector('.ms-gv-buy__finetext');
      setText(ft, isPrint()
        ? T('Nach der Zahlung erstellen wir deinen persönlichen Code: Das PDF kommt sofort per E-Mail, die Karte geht in ' + cfg.print.deliveryNote + ' auf die Reise.', 'After payment we create your personal code: the PDF arrives by e-mail at once, the card is on its way in ' + cfg.print.deliveryNote + '.')
        : T('Nach der Zahlung erstellen wir deinen persönlichen Code und schicken dir den Gutschein sofort als PDF per E-Mail.', 'After payment we create your personal code and e-mail you the voucher as a PDF right away.'));
    }
    function showBuyError(msg, key) {
      var e = review.err;
      e.innerHTML = '';
      e.appendChild(el('span', 'ms-gv-buy__erricon')).innerHTML = icon('alert');
      var t = el('div', 'ms-gv-buy__errbody');
      t.appendChild(el('p', '', msg));
      if (key && KEY_STEP[key] != null && KEY_STEP[key] < 4) {
        var b = el('button', 'ms-gv-link', T('Angabe ändern', 'Change it'));
        b.type = 'button';
        b.addEventListener('click', function () {
          var st = KEY_STEP[key];
          go(st);
          setTimeout(function () { paintErrors(); var tg = focusTarget(key); if (tg) { reveal(tg, 'center'); focusEl(tg); } }, 30);
        });
        t.appendChild(b);
      }
      e.appendChild(t);
      e.hidden = false;
    }
    function clearBuyError() { if (review.err) { review.err.hidden = true; review.err.innerHTML = ''; } }
    // Mo's field names → our error keys.
    function fieldKey(field) {
      var f = String(field || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!f) return '';
      if (f.indexOf('postal') !== -1 || f.indexOf('zip') !== -1 || f.indexOf('country') !== -1) return 'addr-postal';
      if (f.indexOf('line2') !== -1 || f.indexOf('addressline2') !== -1) return 'addr-line2';
      if (f.indexOf('line1') !== -1 || f.indexOf('street') !== -1) return 'addr-line1';
      if (f.indexOf('city') !== -1) return 'addr-city';
      if (f.indexOf('address') !== -1) return 'addr-name';
      if (f.indexOf('recipient') !== -1) return 'recipient';
      if (f.indexOf('sender') !== -1) return 'sender';
      if (f.indexOf('message') !== -1) return 'message';
      if (f.indexOf('photo') !== -1) return 'photo';
      if (f.indexOf('design') !== -1) return 'design';
      if (f.indexOf('amount') !== -1) return 'amount';
      if (f.indexOf('delivery') !== -1) return 'delivery';
      return '';
    }
    function draftFields() {
      var d = selectedDesign();
      var v = selectedVariant();
      var b = {
        designKey: d ? d.key : null,
        amountCents: v ? v.faceCents : null,
        recipientName: finalLine(state.recipient) || null,
        senderName: finalLine(state.sender) || null,
        message: finalText(state.message) || null,
        locale: LOCALE
      };
      if (d && d.photo && state.photo && state.photo.id) b.photoId = state.photo.id;
      return b;
    }
    function draftBody() {
      var b = draftFields();
      b.delivery = isPrint() ? 'print' : 'pdf';
      if (b.delivery === 'print') {
        var a = state.address;
        b.address = { name: finalLine(a.name), line1: finalLine(a.line1), postalCode: postalCode(), city: finalLine(a.city), country: country() };
        if (finalLine(a.line2)) b.address.line2 = finalLine(a.line2);
      }
      return b;
    }
    function draftKey() { return ready ? JSON.stringify(draftBody()) : ''; }
    function ensureDraft() {
      var body = draftBody();
      var key = JSON.stringify(body);
      if (draftCache.key === key && draftCache.token) return Promise.resolve({ ok: true, token: draftCache.token, key: key });
      return request('POST', '/api/gift-vouchers/drafts', body, 20000).then(function (res) {
        if (res.ok && typeof res.data.token === 'string' && /^[A-Za-z0-9_-]{24,64}$/.test(res.data.token)) {
          draftCache = { key: key, token: res.data.token };
          return { ok: true, token: res.data.token, key: key };
        }
        if (res.ok) return { ok: false, message: T('Der Gutschein konnte gerade nicht gespeichert werden. Bitte versuche es noch einmal.', 'The voucher could not be saved just now. Please try again.') };
        return { ok: false, status: res.status, message: errorText(res, 'Der Gutschein konnte gerade nicht gespeichert werden. Bitte versuche es noch einmal.', 'The voucher could not be saved just now. Please try again.'), key: fieldKey(res.field) };
      });
    }
    // The cart contract (mo spec §8): the voucher line and, for the card, the
    // add-on line; both with _mo_gv=<token>. Quantity 1 each.
    function cartItems(token) {
      var v = selectedVariant();
      var d = selectedDesign();
      var who = finalLine(state.recipient) || '—';
      var items = [{ id: v.id, quantity: 1, properties: { 'Gutschein für': who, 'Motiv': d.name, 'Versand': isPrint() ? 'Premium-Karte per Post' : 'PDF per E-Mail', '_mo_gv': token } }];
      if (isPrint()) items.push({ id: PRODUCTS.print.id, quantity: 1, properties: { 'Für Gutschein an': who, '_mo_gv': token } });
      return items;
    }
    function rootUrl() {
      try {
        var r = window.Shopify && window.Shopify.routes && window.Shopify.routes.root;
        if (typeof r === 'string' && r.charAt(0) === '/') return r.replace(/\/?$/, '/');
      } catch (e) {}
      return '/';
    }
    function checkoutUrl() { return rootUrl() + 'checkout'; }
    function cartUrl() {
      try { if (window.routes && window.routes.cart_url) return String(window.routes.cart_url).replace(/\.js$/, ''); } catch (e) {}
      return rootUrl() + 'cart';
    }
    function cartAddUrl() {
      try { if (window.routes && window.routes.cart_add_url) return String(window.routes.cart_add_url).replace(/\.js$/, '') + '.js'; } catch (e) {}
      return rootUrl() + 'cart/add.js';
    }
    function cartChangeUrl() {
      try { if (window.routes && window.routes.cart_change_url) return String(window.routes.cart_change_url).replace(/\.js$/, '') + '.js'; } catch (e) {}
      return rootUrl() + 'cart/change.js';
    }
    function cartJsUrl() {
      try { if (window.routes && window.routes.cart_url) return String(window.routes.cart_url).replace(/\.js$/, '') + '.js'; } catch (e) {}
      return rootUrl() + 'cart.js';
    }
    // The cart as it is now (GET /cart.js; on load and on entering step 5):
    // the lines of the version in the cart may be gone — bought in this tab,
    // or removed in the drawer. Only the keys still there are kept; none
    // left → „liegt im Warenkorb“ and the replace note go. Without keys there
    // is nothing to check; a failed read keeps what the page knows. A read
    // that answers after a buy started (cartSeq) or after the lines changed
    // is dropped.
    var cartSeq = 0;
    function syncCart() {
      if (!ready || !state.added || !state.addedLines || typeof window.fetch !== 'function') return;
      var seq = ++cartSeq;
      var asked = state.addedLines.join(' ');
      var pr;
      try {
        pr = window.fetch(cartJsUrl(), { method: 'GET', credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
      } catch (e) { return; }
      pr.then(function (r) { return r.ok ? r.json() : null; }).then(function (cart) {
        if (torn || !ready || buying || seq !== cartSeq || !cart || !Array.isArray(cart.items)) return;
        if (!state.added || !state.addedLines || state.addedLines.join(' ') !== asked) return;
        var inCart = {};
        cart.items.forEach(function (it) { if (it && typeof it.key === 'string') inCart[it.key] = true; });
        var keep = state.addedLines.filter(function (k) { return inCart[k] === true; });
        if (keep.length === state.addedLines.length) return;
        if (keep.length) state.addedLines = keep;
        else { state.added = null; state.addedLines = null; }
        save(true);
        paintAll();
      }).then(null, function () {});
    }
    // → { ok: true, keys } with the new lines' keys (for a later replace).
    function cartAdd(items) {
      return window.fetch(cartAddUrl(), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: items })
      }).then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
          if (r.ok) {
            var keys = (j && Array.isArray(j.items) ? j.items : []).map(function (i) { return i && typeof i.key === 'string' ? i.key : ''; }).filter(function (k) { return LINE_KEY.test(k); });
            return { ok: true, keys: keys };
          }
          var desc = j && typeof j.description === 'string' ? j.description.slice(0, 200) : '';
          return { ok: false, message: desc || T('Der Gutschein konnte nicht in den Warenkorb gelegt werden. Bitte versuche es noch einmal.', 'The voucher could not be added to the cart. Please try again.') };
        });
      }).catch(function () {
        return { ok: false, message: T('Die Verbindung hat gerade nicht geklappt. Bitte prüfe dein Internet und versuche es noch einmal.', 'The connection did not work. Please check your internet connection and try again.') };
      });
    }
    // Lines out of the cart by their keys, one after the other (by key, not
    // by variant id: every voucher line of an amount shares its variant).
    // A failure is ignored — e.g. the line is gone already (removed in the
    // drawer, or bought).
    function cartRemove(keys) {
      var list = (keys || []).slice();
      function nextKey() {
        if (!list.length) return Promise.resolve();
        var key = list.shift();
        var done;
        try {
          done = window.fetch(cartChangeUrl(), {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ id: key, quantity: 0 })
          }).then(function () {}, function () {});
        } catch (e) { done = Promise.resolve(); }
        return done.then(nextKey);
      }
      return nextKey();
    }
    // The theme's drawer, as after the widget's plan add (never replaceWith).
    function openCart() {
      try { document.dispatchEvent(new CustomEvent('cart:refresh')); } catch (e) {}
      var modal = document.querySelector('cart-modal');
      if (modal && typeof modal.reloadContent === 'function') {
        try {
          var pr = modal.reloadContent();
          var show = function () { try { if (typeof modal.show === 'function') modal.show(); } catch (e) {} };
          if (pr && typeof pr.then === 'function') pr.then(show, show); else show();
          return;
        } catch (e) {}
      }
      window.location.href = cartUrl();
    }
    function buy(mode) {
      if (buying || !ready) return;
      clearBuyError();
      for (var s = 0; s < 4; s++) {
        var probs = check(s);
        if (probs.length) { state.done[s] = false; go(s, { quiet: true }); showStep(true); block(probs); return; }
      }
      var p4 = check(4);
      if (p4.length) { block(p4); return; }
      buying = mode;
      cartSeq++;
      paintBuy();
      paintBar();
      say(T('Dein Gutschein wird vorbereitet …', 'Preparing your voucher …'));
      var key = draftKey();
      // An earlier version of this voucher in the cart (an edit after „In den
      // Warenkorb“) is replaced: its lines come out only once the new ones
      // are in, so a failed add never leaves the cart without the voucher.
      var replace = state.added && state.added !== key && state.addedLines ? state.addedLines.slice() : [];
      ensureDraft().then(function (r) {
        if (torn) return null;
        if (!r.ok) return r;
        return cartAdd(cartItems(r.token)).then(function (a) {
          if (torn || !a.ok || !replace.length) return a;
          return cartRemove(replace).then(function () { return a; });
        });
      }).then(function (r) {
        if (torn || !r) return;
        if (!r.ok) {
          buying = null;
          if (r.status === 409) { stopSelling(r); return; }
          paintBuy();
          paintBar();
          if (r.key) { extErr[r.key] = r.message; paintErrors(); }
          showBuyError(r.message, r.key);
          say(r.message);
          return;
        }
        state.added = key;
        state.addedLines = lineKeys(r.keys);
        save(true);
        if (mode === 'checkout') {
          setText(review.buyLabel, T('Weiter zur Kasse …', 'To checkout …'));
          say(T('Weiter zur Kasse …', 'To checkout …'));
          window.location.href = checkoutUrl();
          // Should the navigation not happen (blocked), the buttons come back;
          // back from the back-forward cache, pageshow brings them at once.
          checkoutTimer = setTimeout(function () { checkoutTimer = null; if (torn) return; buying = null; paintBuy(); paintBar(); }, 8000);
          return;
        }
        buying = null;
        paintBuy();
        paintBar();
        openCart();
        say(T('Dein Gutschein liegt im Warenkorb.', 'Your voucher is in the cart.'));
      });
    }
    // „Noch einen Gutschein gestalten“: amount, design and delivery stay; the
    // personal parts go — and the voucher in the cart stays there (the next
    // one is added next to it, never in its place).
    function startOver() {
      state.recipient = '';
      state.sender = '';
      state.message = '';
      state.photo = null;
      state.address = blankAddress();
      state.added = null;
      state.addedLines = null;
      state.done = [false, false, false, false, false];
      if (selectedDesign() && selectedDesign().photo) state.designKey = (visibleDesigns().filter(function (d) { return !d.photo; })[0] || DESIGNS[0]).key;
      ['recipient', 'sender', 'message'].forEach(function (k) { if (FIELDS[k]) FIELDS[k].input.value = ''; });
      ['addr-name', 'addr-line1', 'addr-line2', 'addr-postal', 'addr-city'].forEach(function (k) { if (FIELDS[k]) FIELDS[k].input.value = ''; });
      if (termsInput) termsInput.checked = false;
      ai.applied = -1;
      draftCache = { key: '', token: '' };
      save(true);
      go(0);
      paintAll();
    }

    // ----- summary (aside) + sticky bar --------------------------------------------------------
    function paintSummary() {
      if (!summaryEl) return;
      var v = selectedVariant();
      summaryEl.hidden = !ready;
      summaryEl.innerHTML = '';
      var dl = el('dl', 'ms-gv-sum');
      function row(a, b, cls) {
        var r = el('div', 'ms-gv-sum__row' + (cls ? ' ' + cls : ''));
        r.appendChild(el('dt', '', a));
        r.appendChild(el('dd', '', b));
        dl.appendChild(r);
      }
      row(T('Gutschein', 'Voucher') + (v ? ' ' + amountLabel(v.faceCents) : ''), v ? money(v.priceCents, PRODUCTS.currency) : '—');
      if (isPrint()) row(T('Premium-Karte', 'Premium card'), money(PRODUCTS.print.priceCents, PRODUCTS.currency));
      row(T('Gesamt', 'Total'), money(totalCents(), PRODUCTS.currency), 'ms-gv-sum__row--total');
      summaryEl.appendChild(dl);
      var note = el('p', 'ms-gv-sum__note');
      note.innerHTML = icon(isPrint() ? 'card' : 'mail');
      note.appendChild(el('span', '', isPrint() ? T('Premium-Karte per Post · ', 'Premium card by post · ') + cfg.print.deliveryNote + T(' · PDF sofort', ' · PDF at once') : T('PDF per E-Mail – sofort nach dem Kauf', 'PDF by e-mail – right after your purchase')));
      summaryEl.appendChild(note);
    }
    var bar = null;
    var barUi = {};
    var vis = { designer: false, foot: {} };
    var typing = false;
    function buildBar() {
      bar = el('div', 'ms-gv-bar');
      bar.setAttribute('role', 'region');
      bar.setAttribute('aria-label', T('Kurzübersicht', 'Summary'));
      var info = el('div', 'ms-gv-bar__info');
      var total = el('span', 'ms-gv-bar__total');
      var step = el('span', 'ms-gv-bar__step');
      info.appendChild(total);
      info.appendChild(step);
      bar.appendChild(info);
      var b = el('button', 'ms-gv-btn ms-gv-btn--primary ms-gv-bar__btn');
      b.type = 'button';
      var lab = el('span');
      b.appendChild(lab);
      b.insertAdjacentHTML('beforeend', icon('arrowRight'));
      b.addEventListener('click', function () {
        if (state.step === 4) buy('checkout'); else next();
      });
      bar.appendChild(b);
      root.appendChild(bar);
      barUi = { total: total, step: step, btn: b, label: lab };
    }
    // One column (the preview above the steps): the CSS says so through
    // --gv-cols on the grid (a container query of the designer).
    function stacked() {
      try { return window.getComputedStyle(gridEl).getPropertyValue('--gv-cols').replace(/\s/g, '') !== '2'; } catch (e) { return true; }
    }
    function launcherShown() {
      var l = document.querySelector('.ms-chat-launcher');
      if (!l || l.classList.contains('ms-chat-launcher--hidden')) return false;
      var r = l.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }
    function paintBar() {
      if (!bar) return;
      var added = state.step === 4 && !!state.added && state.added === draftKey();
      var show = ready && stacked() && vis.designer && !vis.foot[state.step] && !typing && !added;
      bar.classList.toggle('is-shown', show);
      bar.classList.toggle('ms-gv-bar--launcher', launcherShown());
      setText(barUi.total, money(totalCents(), PRODUCTS.currency));
      setText(barUi.label, state.step === 4 ? T('Jetzt kaufen', 'Buy now') : T('Weiter', 'Continue'));
      // „Schritt 2 von 5 · Motiv“ — or without the name when the bar is
      // narrow (next to the Mo launcher on a phone); never an ellipsis.
      var stepNo = T('Schritt ', 'Step ') + (state.step + 1) + T(' von 5', ' of 5');
      setText(barUi.step, stepNo + ' · ' + STEP_LABELS[state.step]);
      if (show && barUi.step.scrollWidth > barUi.step.clientWidth + 1) setText(barUi.step, stepNo);
      var off = state.step === 4 ? (!!buying || !termsChecked()) : check(state.step).length > 0;
      if (off) barUi.btn.setAttribute('aria-disabled', 'true'); else barUi.btn.removeAttribute('aria-disabled');
    }
    function observe() {
      if (!('IntersectionObserver' in window)) return;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.target === designer) vis.designer = en.isIntersecting;
          else {
            var i = parseInt(en.target.getAttribute('data-foot'), 10);
            if (!isNaN(i)) vis.foot[i] = en.isIntersecting;
          }
        });
        paintBar();
      }, { rootMargin: '0px 0px -30% 0px', threshold: 0 });
      io.observe(designer);
      // The panel's own buttons in view: no bar (one „Weiter“ on screen).
      var io2 = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var i = parseInt(en.target.getAttribute('data-foot'), 10);
          if (!isNaN(i)) vis.foot[i] = en.isIntersecting;
        });
        paintBar();
      }, { threshold: 0 });
      P.forEach(function (p, i) {
        var t = i === 4 ? review.actions : p.foot;
        if (!t) return;
        t.setAttribute('data-foot', String(i));
        io2.observe(t);
        if (i === 4 && review.done) { review.done.setAttribute('data-foot', '4'); io2.observe(review.done); }
      });
      cleanups.push(function () { io.disconnect(); io2.disconnect(); });
    }

    // ----- everything after a change ------------------------------------------------------------
    function changed() {
      // A finished step stays done while its data is complete (check()).
      save();
      paintAll();
    }
    function paintAll() {
      if (!ready) return;
      paintSteps();
      paintAmount();
      paintDesigns();
      paintUpload();
      paintDelivery();
      paintErrors();
      paintFooter();
      paintSummary();
      paintPreview();
      if (state.step === 4) paintReview();
      paintBar();
    }

    // ----- hero cards ---------------------------------------------------------------------------
    var stackEl = root.querySelector('[data-ms-gv-stack]');
    var stackFaces = [];
    function buildHero() {
      var vt = root.querySelector('[data-ms-gv-validity]');
      if (vt && cfg) setText(vt, validityFact());
      var dt = root.querySelector('[data-ms-gv-delivery-trust]');
      if (dt && cfg && !printAllowed()) setText(dt, T('Sofort als PDF per E-Mail', 'Instantly as a PDF by e-mail'));
      if (!stackEl) return;
      var designs = DESIGNS.filter(function (d) { return !d.photo; });
      if (!designs.length) return;
      // The three cards: 50 € in front (or the nearest amount), 25 € and 100 € behind.
      function nearest(c) {
        var best = null;
        PRODUCTS.voucher.forEach(function (v) { if (!best || Math.abs(v.faceCents - c) < Math.abs(best.faceCents - c)) best = v; });
        return best ? best.faceCents : c;
      }
      var amounts = [nearest(5000), nearest(2500), nearest(10000)];
      var cards = stackEl.querySelectorAll('[data-ms-gv-stack-card]');
      for (var i = 0; i < cards.length; i++) {
        var k = parseInt(cards[i].getAttribute('data-ms-gv-stack-card'), 10);
        var d = designs[k % designs.length];
        var f = Face('front');
        f.update(d, 'landscape', { amount: amountLabel(amounts[k] || 5000), recipient: k === 0 ? T('dich', 'you') : '', photo: '' });
        cards[i].innerHTML = '';
        cards[i].appendChild(f.el);
        stackFaces.push(f);
      }
      stackEl.classList.add('is-live');
    }

    // ----- the Caveat font from Mo ------------------------------------------------------------
    function loadScriptFont(url) {
      if (!url) return;
      var done = function () { root.classList.add('ms-gv--script'); refit(); };
      try {
        if (window.FontFace && document.fonts && document.fonts.add) {
          var ff = new window.FontFace('MS GV Caveat', 'url("' + url + '") format("truetype")', { weight: '500', style: 'normal', display: 'swap' });
          document.fonts.add(ff);
          ff.load().then(done, function () {});
          return;
        }
      } catch (e) {}
      try {
        var st = document.createElement('style');
        st.textContent = '@font-face{font-family:"MS GV Caveat";src:url("' + url + '") format("truetype");font-weight:500;font-display:swap}';
        document.head.appendChild(st);
        setTimeout(done, 1500);
      } catch (e) {}
    }
    function refit() {
      fitLater(pvInside);
      if (!CQ) { cqFallback(pvFront.el); cqFallback(pvInside.el); designTiles.forEach(function (t) { cqFallback(t.face.el); }); stackFaces.forEach(function (f) { cqFallback(f.el); }); }
    }

    // ----- unavailable --------------------------------------------------------------------------
    function showFallback(retry) {
      if (designer) designer.setAttribute('data-state', 'unavailable');
      if (loadingEl) loadingEl.hidden = true;
      if (fallbackEl) fallbackEl.hidden = false;
      if (retry && fallbackEl && !fallbackEl.querySelector('[data-ms-gv-retry]')) {
        var b = el('button', 'ms-gv-btn ms-gv-btn--secondary');
        b.type = 'button';
        b.setAttribute('data-ms-gv-retry', '');
        b.innerHTML = icon('refresh');
        b.appendChild(el('span', '', T('Erneut versuchen', 'Try again')));
        b.addEventListener('click', function () {
          b.parentNode.removeChild(b);
          if (fallbackEl) fallbackEl.hidden = true;
          if (designer) designer.setAttribute('data-state', 'loading');
          if (loadingEl) loadingEl.hidden = false;
          loadConfig();
        });
        var link = fallbackEl.querySelector('a.ms-gv-btn');
        var actions = el('div', 'ms-gv-fallback__actions');
        if (link) { link.parentNode.insertBefore(actions, link); actions.appendChild(link); }
        else fallbackEl.appendChild(actions);
        actions.appendChild(b);
      }
    }
    // Mo stopped selling while the page was open (a 409 from the photo,
    // suggest, preview or drafts route: switched off in Mo, or no longer set
    // up). The designer gives way to the fallback — the link to the plain
    // voucher product — and Mo's line is announced; the focus moves to that
    // link when it was in the part that disappears.
    function stopSelling(res) {
      if (!ready) return;
      ready = false;
      buying = null;
      var a = document.activeElement;
      var lost = !a || a === document.body || (designer && designer.contains(a)) || (bar && bar.contains(a));
      paintBar();
      showFallback(false);
      say(errorText(res, 'Gutscheine sind gerade nicht verfügbar.', 'Gift vouchers are not available right now.'));
      if (fallbackEl) {
        reveal(fallbackEl, 'center');
        if (lost) focusEl(fallbackEl.querySelector('a') || null);
      }
    }

    // ----- start ----------------------------------------------------------------------------------
    function start() {
      DESIGNS = cfg.designs;
      // The draft against what exists now (variants, designs, features).
      if (!selectedVariant()) {
        var pick = null;
        PRODUCTS.voucher.forEach(function (v) { if (v.available && (!pick || Math.abs(v.faceCents - 5000) < Math.abs(pick.faceCents - 5000))) pick = v; });
        state.variantId = pick ? pick.id : null;
      }
      if (!selectedDesign()) state.designKey = (visibleDesigns()[0] || {}).key || null;
      if (state.photo && !photoAllowed()) state.photo = null;
      if (state.delivery === 'print' && !printAllowed()) state.delivery = 'pdf';
      if (state.occasion && !cfg.occasions.some(function (o) { return o.key === state.occasion; })) state.occasion = null;
      if (state.tone && !cfg.tones.some(function (o) { return o.key === state.tone; })) state.tone = null;
      // A restored draft whose earlier step no longer holds (an amount sold
      // out, photos switched off …) resumes at that step.
      if (!reachable(state.step)) state.step = firstOpen();
      buildAmount();
      buildDesign();
      buildText();
      buildDelivery();
      buildReview();
      if (loadingEl) loadingEl.parentNode.removeChild(loadingEl);
      P.forEach(function (p) { panelsEl.appendChild(p.el); });
      mountPreview();
      buildBar();
      buildHero();
      ready = true;
      designer.setAttribute('data-state', 'ready');
      loadScriptFont(cfg.scriptFont);
      for (var j = 0; j < P.length; j++) P[j].el.hidden = j !== state.step;
      if (state.step === 4) { paintReview(); requestExact(); }
      paintAll();
      observe();
      save();
      syncCart();
      // Resizes: the sticky offset, the bar (one or two columns), the fit.
      if ('ResizeObserver' in window && stage) {
        var ro = new window.ResizeObserver(function () { refit(); });
        ro.observe(stage);
        cleanups.push(function () { ro.disconnect(); });
      }
      try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!torn) refit(); }); } catch (e) {}
    }
    function loadConfig() {
      request('GET', '/api/gift-vouchers/config?locale=' + LOCALE, null, 9000).then(function (res) {
        if (torn) return;
        var c = res.ok ? cleanConfig(res.data) : null;
        if (!c) { showFallback(!res.ok); return; }
        cfg = c;
        if (!c.available) { DESIGNS = c.designs; buildHero(); showFallback(false); return; }
        start();
      });
    }

    // ----- „Guthaben prüfen“ ------------------------------------------------------------------
    var balForm = root.querySelector('[data-ms-gv-balance]');
    function setupBalance() {
      if (!balForm) return;
      var input = balForm.querySelector('[data-ms-gv-balance-input]');
      var btn = balForm.querySelector('[data-ms-gv-balance-btn]');
      var label = balForm.querySelector('[data-ms-gv-balance-label]');
      var out = balForm.querySelector('[data-ms-gv-balance-result]');
      var busy = false;
      var idle = label ? label.textContent : '';
      if (!MO_ON) {
        input.disabled = true;
        btn.disabled = true;
        out.appendChild(resultBox('muted', T('Die Guthabenabfrage ist gerade nicht verfügbar. Dein Restguthaben siehst du auch im Checkout.', 'The balance check is not available right now. You can also see your balance at checkout.')));
        return;
      }
      function resultBox(kind, title, rows, pill) {
        var b = el('div', 'ms-gv-result ms-gv-result--' + kind);
        var head = el('div', 'ms-gv-result__head');
        var ic = el('span', 'ms-gv-result__icon');
        ic.innerHTML = icon(kind === 'ok' ? 'check' : kind === 'muted' ? 'info' : 'alert');
        head.appendChild(ic);
        head.appendChild(el('p', 'ms-gv-result__title', title));
        if (pill) head.appendChild(el('span', 'ms-gv-result__pill ms-gv-result__pill--' + pill.kind, pill.text));
        b.appendChild(head);
        if (rows && rows.length) {
          var dl = el('dl', 'ms-gv-result__rows');
          rows.forEach(function (r) {
            var row = el('div');
            row.appendChild(el('dt', '', r[0]));
            row.appendChild(el('dd', '', r[1]));
            dl.appendChild(row);
          });
          b.appendChild(dl);
        }
        return b;
      }
      function dateText(iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
        if (!m) return '';
        if (!EN) return m[3] + '.' + m[2] + '.' + m[1];
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return parseInt(m[3], 10) + ' ' + months[parseInt(m[2], 10) - 1] + ' ' + m[1];
      }
      function setError(msg) {
        input.classList.toggle('is-invalid', !!msg);
        if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
      }
      input.addEventListener('input', function () { setError(null); });
      balForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (busy) return;
        var code = String(input.value || '').toUpperCase().replace(/[\s.\-–]/g, '');
        out.innerHTML = '';
        if (!/^[A-Z0-9]{8,20}$/.test(code)) {
          setError(true);
          out.appendChild(resultBox('error', T('Bitte gib den Code vollständig ein – 16 Zeichen, wie auf dem Gutschein.', 'Please enter the full code – 16 characters, as on the voucher.')));
          focusEl(input);
          return;
        }
        busy = true;
        btn.setAttribute('aria-busy', 'true');
        setText(label, T('Wird geprüft …', 'Checking …'));
        out.appendChild(resultBox('muted', T('Wird geprüft …', 'Checking …')));
        request('POST', '/api/gift-vouchers/balance', { code: code }, 15000).then(function (res) {
          if (torn) return;
          busy = false;
          btn.removeAttribute('aria-busy');
          setText(label, idle);
          out.innerHTML = '';
          if (!res.ok) {
            out.appendChild(resultBox('error', errorText(res, 'Das Guthaben lässt sich gerade nicht abfragen. Bitte versuche es später noch einmal.', 'The balance cannot be checked right now. Please try again later.')));
            return;
          }
          var d = res.data;
          if (!d.found) {
            setError(true);
            out.appendChild(resultBox('error', T('Diesen Code kennen wir nicht. Bitte prüfe die Schreibweise – ältere Geschenkkarten zeigen ihr Guthaben im Checkout.', 'We do not know this code. Please check the spelling – older gift cards show their balance at checkout.')));
            return;
          }
          var bal = Number(d.balanceCents);
          var amt = Number(d.amountCents);
          var cur = typeof d.currency === 'string' && /^[A-Z]{3}$/.test(d.currency) ? d.currency : 'EUR';
          var st = d.state;
          var pills = { active: { kind: 'ok', text: T('Aktiv', 'Active') }, used: { kind: 'muted', text: T('Aufgebraucht', 'Used up') }, expired: { kind: 'muted', text: T('Abgelaufen', 'Expired') }, deactivated: { kind: 'error', text: T('Gesperrt', 'Blocked') } };
          var rows = [];
          if (isFinite(amt) && amt > 0) rows.push([T('Ursprünglicher Wert', 'Original value'), money(amt, cur)]);
          var exp = dateText(d.expiresOn);
          rows.push([T('Gültig bis', 'Valid until'), exp || T('unbegrenzt', 'no expiry')]);
          out.appendChild(resultBox(st === 'active' ? 'ok' : 'muted', (isFinite(bal) ? money(bal, cur) : '—') + T(' Restguthaben', ' remaining'), rows, pills[st] || null));
        });
      });
    }

    // ----- page chrome ----------------------------------------------------------------------------
    // Sticky offset below the theme's sticky header (as the Konfigurator).
    function measureHeader() {
      try {
        var h = document.querySelector('sticky-header') || document.querySelector('.section-header');
        var px = h ? Math.round(h.getBoundingClientRect().height) : 0;
        if (px > 40 && px < 260) root.style.setProperty('--gv-sticky-top', (px + 16) + 'px');
      } catch (e) {}
    }
    measureHeader();
    var resizeTimer = null;
    on(window, 'resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { measureHeader(); paintBar(); if (!('ResizeObserver' in window)) refit(); }, 100);
    });
    // Back on this page from the back-forward cache (e.g. from the checkout):
    // a load as well — the cart may have changed meanwhile (syncCart). The
    // way to /checkout was taken, so its busy buttons come back.
    on(window, 'pageshow', function (e) {
      if (!e || !e.persisted || !ready) return;
      if (buying === 'checkout') {
        clearTimeout(checkoutTimer);
        checkoutTimer = null;
        buying = null;
        paintBuy();
        paintBar();
      }
      syncCart();
    });
    // While a field has the focus on a phone, the bar steps aside (keyboard).
    on(root, 'focusin', function (e) {
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') && t.type !== 'checkbox' && t.type !== 'file') { typing = true; paintBar(); }
    });
    on(root, 'focusout', function () {
      setTimeout(function () {
        var a = document.activeElement;
        typing = !!(a && root.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') && a.type !== 'checkbox' && a.type !== 'file');
        paintBar();
      }, 0);
    });
    // The bar follows the Mo launcher (it mounts after this script).
    var launcherTimer = setTimeout(function () { paintBar(); }, 2500);
    cleanups.push(function () { clearTimeout(launcherTimer); });
    // Smooth in-page links (hero CTA, „Guthaben prüfen“).
    var links = root.querySelectorAll('[data-ms-gv-scroll]');
    for (var li = 0; li < links.length; li++) {
      links[li].addEventListener('click', function (e) {
        var id = (this.getAttribute('href') || '').replace(/^#/, '');
        var target = id && document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        try { target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }); } catch (err) { target.scrollIntoView(); }
        if (id === 'guthaben') {
          var inp = target.querySelector('[data-ms-gv-balance-input]');
          if (inp && !inp.disabled) setTimeout(function () { focusEl(inp); }, reducedMotion() ? 0 : 450);
        }
      });
    }

    setupBalance();
    if (!designer || !panelsEl) return;
    var anyAmount = PRODUCTS.voucher.some(function (v) { return v.available; });
    if (!MO_ON || !anyAmount || typeof window.fetch !== 'function' || typeof window.Promise !== 'function') {
      showFallback(false);
      // Theme editor: say what is missing with the products (Liquid's own
      // hint covers Mo and the preview domain).
      var hint = DESIGN_MODE && fallbackEl ? fallbackEl.querySelector('[data-ms-gv-editor-hint]') : null;
      if (hint && PRODUCTS.issue === 'gift_card') {
        hint.textContent = 'Theme-Editor: Das gewählte „Gutschein-Produkt“ ist ein Shopify-Geschenkkarten-Produkt – damit stellt Shopify eine zweite Karte aus. Bitte ein normales Produkt mit einer Variante je Betrag wählen (Handle designgutschein).';
      } else if (hint && !PRODUCTS.voucher.length) {
        hint.textContent = 'Theme-Editor: Bitte in diesem Abschnitt unter „Gutschein-Produkt (Beträge)“ das Produkt mit den Beträgen auswählen (Handle designgutschein).';
      } else if (hint && !anyAmount) {
        hint.textContent = 'Theme-Editor: Keine Variante des Gutschein-Produkts ist verfügbar – im Produkt „Inventar verfolgen“ ausschalten (oder „Weiterverkaufen, wenn nicht auf Lager“ an) und es im Vertriebskanal Onlineshop veröffentlichen.';
      }
      return;
    }
    loadConfig();
  }
})();

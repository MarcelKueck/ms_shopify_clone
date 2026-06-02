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
  // Fail-silent KPI telemetry (Phase 3 prep). POSTs pseudonymous event +
  // session id to /api/kpi. Wrapped so it harmlessly no-ops until the backend
  // endpoint exists, and never sends message text — only event names + ids.
  // ---------------------------------------------------------------------------
  function track(event, data) {
    try {
      fetch(API_BASE + '/api/kpi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ms-session': sid },
        body: JSON.stringify({
          event: event,
          sessionId: sid,
          timestamp: new Date().toISOString(),
          data: data || {}
        }),
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // Tool names.
  // ---------------------------------------------------------------------------
  var VISIBLE_TOOLS = ['show_product', 'compare_products', 'add_to_cart', 'suggest_showroom', 'show_contact_form'];
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
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    shrink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
  };
  function icon(name) {
    var tpl = document.createElement('template');
    tpl.innerHTML = ICONS[name] || '';
    return tpl.content.firstElementChild;
  }

  // Brand logo element. The variant (white on the dark launcher, black on the
  // light panel) is chosen per context in CSS via the extra class.
  function logoEl(extraClass) {
    return el('span', { class: 'ms-chat-logo ' + (extraClass || ''), 'aria-hidden': 'true' });
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
          if (!res.ok) { batch.forEach(function (id) { productCache[id] = null; }); return; }
          return res.json().then(function (data) {
            var prods = (data && data.products) || [];
            for (var j = 0; j < batch.length; j++) {
              productCache[batch[j]] = prods[j] != null ? prods[j] : null;
            }
          });
        })
        .catch(function () { batch.forEach(function (id) { productCache[id] = null; }); });
    });

    return Promise.all(jobs).then(function () {
      return ids.map(function (id) { return id in productCache ? productCache[id] : null; });
    });
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

  var TAG_CLASS = {
    bestseller: 'ms-chat-tag--bestseller',
    neu: 'ms-chat-tag--new',
    'new': 'ms-chat-tag--new',
    sale: 'ms-chat-tag--sale',
    'preis-tipp': 'ms-chat-tag--preistipp',
    premium: 'ms-chat-tag--premium'
  };

  function specsGrid(product, limit) {
    var specs = product.specifications || {};
    var keys = Object.keys(specs).slice(0, limit);
    if (!keys.length) return null;
    var grid = el('div', { class: 'ms-chat-specs' });
    keys.forEach(function (key) {
      grid.appendChild(el('div', { class: 'ms-chat-spec' }, [
        el('span', { class: 'ms-chat-spec-key', text: key }),
        el('span', { class: 'ms-chat-spec-val', text: String(specs[key]) })
      ]));
    });
    return grid;
  }

  function productLink(product, label) {
    var a = el('a', { class: 'ms-chat-link', href: product.shopifyUrl || '#', target: '_blank', rel: 'noopener noreferrer' }, [label || 'Zum Produkt']);
    a.appendChild(icon('external'));
    return a;
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
  function buildShowProduct(input) {
    return hydrate([input.productId]).then(function (res) {
      var p = res[0];
      if (!p) return null; // render-nothing guard
      var card = el('div', { class: 'ms-chat-card' });

      var imgwrap = el('div', { class: 'ms-chat-prod-imgwrap' });
      if (p.images && p.images[0]) {
        imgwrap.appendChild(el('img', { src: p.images[0], alt: p.name || '', loading: 'lazy' }));
      }
      if (p.series) imgwrap.appendChild(el('span', { class: 'ms-chat-series-badge', text: p.series }));
      card.appendChild(imgwrap);

      var body = el('div', { class: 'ms-chat-card-body' });
      body.appendChild(el('div', { class: 'ms-chat-prod-name', text: p.name || '' }));

      if (p.tags && p.tags.length) {
        var tags = el('div', { class: 'ms-chat-tags' });
        p.tags.forEach(function (t) {
          var cls = 'ms-chat-tag';
          var extra = TAG_CLASS[String(t).toLowerCase()];
          if (extra) cls += ' ' + extra;
          tags.appendChild(el('span', { class: cls, text: t }));
        });
        body.appendChild(tags);
      }

      body.appendChild(priceNode(p));

      var specs = specsGrid(p, 4);
      if (specs) body.appendChild(specs);

      if (input.reason) body.appendChild(el('div', { class: 'ms-chat-reason', text: input.reason }));

      var footer = el('div', { class: 'ms-chat-prod-footer' });
      var delivery = el('span', { class: 'ms-chat-delivery' }, [p.deliveryTime || '']);
      delivery.insertBefore(icon('truck'), delivery.firstChild);
      footer.appendChild(delivery);
      body.appendChild(footer);
      // Prominent primary CTA below the meta row.
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

  // tool-add_to_cart -> quick-checkout CTA. The backend tool id is unchanged,
  // but shopifyCartUrl is now a one-unit Shopify checkout permalink
  // (/cart/<variantId>:1) and is optional. We link straight to checkout.
  function buildAddToCart(input) {
    return hydrate([input.productId]).then(function (res) {
      var p = res[0];
      if (!p) return null; // can't hydrate -> render nothing
      var card = el('div', { class: 'ms-chat-card' });
      var body = el('div', { class: 'ms-chat-card-body' });
      if (input.message) body.appendChild(el('div', { class: 'ms-chat-card-msg', text: input.message }));

      // Compact line: name + price, so the shopper sees exactly what one click buys.
      var summary = el('div', { class: 'ms-chat-checkout-summary' });
      summary.appendChild(el('span', { class: 'ms-chat-checkout-name', text: p.name || 'Produkt' }));
      summary.appendChild(priceNode(p));
      body.appendChild(summary);

      if (p.shopifyCartUrl) {
        var btn = el('a', { class: 'ms-chat-btn ms-chat-btn--primary', href: p.shopifyCartUrl, target: '_blank', rel: 'noopener noreferrer' });
        btn.appendChild(icon('cart'));
        btn.appendChild(el('span', { text: 'In den Warenkorb' }));
        btn.addEventListener('click', function () { track('add_to_cart_clicked', { productId: p.id }); });
        body.appendChild(btn);
        body.appendChild(el('div', { class: 'ms-chat-caption', text: 'Direkt zur sicheren Kasse bei motionsports.de' }));
      } else if (p.shopifyUrl) {
        // No resolvable variant id -> degrade to the product page, never a broken
        // checkout link.
        var link = el('a', { class: 'ms-chat-btn ms-chat-btn--primary', href: p.shopifyUrl, target: '_blank', rel: 'noopener noreferrer' });
        link.appendChild(el('span', { text: 'Zum Produkt' }));
        link.appendChild(icon('external'));
        link.addEventListener('click', function () { track('product_cta_clicked', { productId: p.id }); });
        body.appendChild(link);
      }

      card.appendChild(body);
      return card;
    });
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

  function buildToolCard(name, input) {
    switch (name) {
      case 'show_product': return buildShowProduct(input);
      case 'compare_products': return buildCompare(input);
      case 'add_to_cart': return buildAddToCart(input);
      case 'suggest_showroom': return buildShowroom(input);
      case 'show_contact_form': return buildContactForm(input);
      default: return Promise.resolve(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Widget shell.
  // ---------------------------------------------------------------------------
  var root, launcher, panel, backdrop, expandBtn, messagesEl, textarea, sendBtn, noticeEl, welcomeEl;
  var EXPAND_KEY = 'ms-chat-expanded';
  var state = { open: false, streaming: false, rateLocked: false, expanded: lsGet(EXPAND_KEY) === '1' };
  var typingEl = null;
  var rateTimer = null;
  // Product context to attach to the NEXT /api/chat request (see openWithProduct).
  var pendingContext = null;

  function wordmark() {
    var w = el('span', { class: 'ms-chat-wordmark' });
    w.appendChild(el('b', { text: 'motion' }));
    w.appendChild(el('span', { text: 'sports' }));
    return w;
  }

  function buildShell() {
    root = el('div', { class: 'ms-chat-root' });

    launcher = el('button', { class: 'ms-chat-launcher', type: 'button', 'aria-label': 'Chat öffnen' });
    launcher.appendChild(logoEl('ms-chat-launcher-logo'));
    launcher.addEventListener('click', togglePanel);

    backdrop = el('div', { class: 'ms-chat-backdrop', 'aria-hidden': 'true' });
    backdrop.addEventListener('click', closePanel);

    panel = el('div', { class: 'ms-chat-panel', role: 'dialog', 'aria-label': 'AI Fitnessberater', 'aria-modal': 'false' });

    var header = el('div', { class: 'ms-chat-header' });
    header.appendChild(wordmark());
    var actions = el('div', { class: 'ms-chat-header-actions' });
    // Feature 6: enlarge/expand toggle (desktop only; no-op styling on mobile).
    expandBtn = el('button', { class: 'ms-chat-iconbtn', type: 'button', 'aria-label': 'Chat vergrößern', title: 'Vergrößern' });
    expandBtn.appendChild(icon(state.expanded ? 'shrink' : 'expand'));
    expandBtn.addEventListener('click', toggleExpand);
    actions.appendChild(expandBtn);
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

    var controls = el('div', { class: 'ms-chat-input-controls' });
    textarea = el('textarea', { class: 'ms-chat-textarea', rows: '1', placeholder: 'Frag mich etwas über unser Sortiment...', 'aria-label': 'Nachricht' });
    textarea.addEventListener('input', autoGrow);
    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
    });
    sendBtn = el('button', { class: 'ms-chat-send', type: 'button', 'aria-label': 'Senden' });
    sendBtn.appendChild(icon('send'));
    sendBtn.addEventListener('click', onSend);
    controls.appendChild(textarea);
    controls.appendChild(sendBtn);
    inputbar.appendChild(controls);
    inputbar.appendChild(el('div', { class: 'ms-chat-disclaimer', text: 'KI-Fitnessberater – Antworten können Fehler enthalten' }));
    panel.appendChild(inputbar);

    welcomeEl = buildWelcome();

    root.appendChild(launcher);
    root.appendChild(backdrop);
    root.appendChild(panel);
    document.body.appendChild(root);

    applyExpanded();
  }

  function applyExpanded() {
    if (!panel) return;
    panel.classList.toggle('ms-chat-panel--expanded', !!state.expanded);
    if (expandBtn) {
      expandBtn.replaceChildren(icon(state.expanded ? 'shrink' : 'expand'));
      expandBtn.title = state.expanded ? 'Verkleinern' : 'Vergrößern';
      expandBtn.setAttribute('aria-label', state.expanded ? 'Chat verkleinern' : 'Chat vergrößern');
    }
  }

  function toggleExpand() {
    state.expanded = !state.expanded;
    lsSet(EXPAND_KEY, state.expanded ? '1' : '0');
    applyExpanded();
  }

  function buildWelcome() {
    var w = el('div', { class: 'ms-chat-welcome' });
    w.appendChild(wordmark());
    w.appendChild(el('h2', { text: 'Wie kann ich dir helfen?' }));
    w.appendChild(el('p', { text: 'Frag mich nach Empfehlungen, vergleiche Produkte oder beschreib einfach deine Trainingssituation.' }));
    return w;
  }

  function autoGrow() {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  function togglePanel() { state.open ? closePanel() : openPanel(); }
  function openPanel() {
    if (state.open) return;
    state.open = true;
    panel.classList.add('ms-chat-panel--open');
    if (backdrop) backdrop.classList.add('ms-chat-backdrop--open');
    launcher.classList.add('ms-chat-launcher--hidden');
    scrollToBottom();
    setTimeout(function () { try { textarea.focus(); } catch (e) {} }, 50);
    track('chat_opened', {});
  }
  function closePanel() {
    if (!state.open) return;
    state.open = false;
    panel.classList.remove('ms-chat-panel--open');
    if (backdrop) backdrop.classList.remove('ms-chat-backdrop--open');
    launcher.classList.remove('ms-chat-launcher--hidden');
    track('chat_closed', {});
  }

  function scrollToBottom() {
    requestAnimationFrame(function () { messagesEl.scrollTop = messagesEl.scrollHeight; });
  }

  function updateInputState() {
    var disabled = state.streaming || state.rateLocked;
    if (textarea) textarea.disabled = disabled;
    if (sendBtn) sendBtn.disabled = disabled;
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
      removeTyping();
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
      if (cardEl) { holder.node.appendChild(cardEl); removeTyping(); scrollToBottom(); }
    }).catch(function () { /* render nothing on failure */ });
  }

  function renderRestoredAssistant(msg) {
    var ctx = newAssistantCtx();
    var parts = msg.parts || [];
    for (var i = 0; i < parts.length; i++) renderPartIntoCtx(ctx, parts[i]);
  }

  function renderAllMessages() {
    messagesEl.replaceChildren();
    if (!messages.length) { showWelcome(); return; }
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      if (m.role === 'user') renderUserMessage(m);
      else if (m.role === 'assistant') renderRestoredAssistant(m);
    }
    scrollToBottom();
  }

  // ---------------------------------------------------------------------------
  // Typing indicator.
  // ---------------------------------------------------------------------------
  function showTyping() {
    removeTyping();
    var ar = assistantRow();
    ar.content.appendChild(el('div', { class: 'ms-chat-typing' }, [el('span'), el('span'), el('span')]));
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
    } else {
      parts.push({ type: 'tool-' + name, toolCallId: id, state: input != null ? 'output-available' : 'input-streaming', input: input != null ? input : undefined });
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
    var text = textarea.value.trim();
    if (!text) return;
    sendMessage(text);
  }

  function sendMessage(text) {
    clearNotice();

    var userMsg = { id: 'u-' + uuid(), role: 'user', parts: [{ type: 'text', text: text }] };
    messages.push(userMsg);
    var userRow = renderUserMessage(userMsg);
    saveHistory();
    track('message_sent', {}); // event only — never the message text

    textarea.value = '';
    autoGrow();

    // Attach (and consume) any product context queued by openWithProduct.
    var context = pendingContext;
    pendingContext = null;

    startStream({ userMsg: userMsg, userRow: userRow, restoreText: text, context: context });
  }

  // Start an assistant turn with NO user message — used to trigger the
  // product greeting from openWithProduct on a fresh conversation. History
  // (if any) is preserved and sent as-is.
  function requestAssistant(context) {
    if (state.streaming || state.rateLocked) { pendingContext = context; return; }
    clearNotice();
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

    function ensureCtx() { if (!ctx) ctx = newAssistantCtx(); return ctx; }

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
      if (streamErrored && !gotContent) {
        showMessageError('Es gab ein Problem. Bitte versuch es gleich nochmal.');
      }
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
    // the assistant with the current product per API_CONTRACT.md §2.
    var chatBody = { messages: toWire(messages) };
    if (opts.context) chatBody.context = opts.context;

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
          case 'tool-output-error':
            // Tool results: the widget hydrates its own product data, so these
            // carry nothing extra to render. Consumed silently.
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
        finalizeStream();
        showMessageError('Es gab ein Problem. Bitte versuch es gleich nochmal.');
      } else {
        rollback();
        showMessageError('Es gab ein Problem. Bitte versuch es gleich nochmal.');
        state.streaming = false;
        updateInputState();
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
    }, seconds * 1000);
  }

  function startNewChat() {
    clearNotice();
    rotateSession();
    if (rateTimer) { clearTimeout(rateTimer); rateTimer = null; }
    state.rateLocked = false;
    state.streaming = false;
    updateInputState();
    renderAllMessages(); // empty -> welcome
    try { textarea.focus(); } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // Public API: product-page CTA (feature 2). Opens the panel primed about a
  // product. On a fresh conversation this triggers the assistant's product
  // greeting; mid-conversation it queues the product context for the next
  // message WITHOUT wiping the existing chat. Sends ids/title only — never a
  // page scrape. See API_CONTRACT.md §2.
  // ---------------------------------------------------------------------------
  function openWithProduct(id, title) {
    try {
      openPanel();
      var pid = id != null ? String(id) : '';
      track('product_cta_opened', { productId: pid });
      var context = { type: 'product', productId: pid, productTitle: title != null ? String(title) : '' };
      if (!messages.length) {
        requestAssistant(context); // fresh -> product greeting
      } else {
        pendingContext = context;  // mid-chat -> attach to next send, keep history
      }
    } catch (e) {
      try { console.error('[ms-chat] openWithProduct failed', e); } catch (e2) {}
    }
  }

  // ---------------------------------------------------------------------------
  // Init.
  // ---------------------------------------------------------------------------
  function init() {
    buildShell();
    renderAllMessages();
    updateInputState();
    window.MS_CHAT = window.MS_CHAT || {};
    window.MS_CHAT.openWithProduct = openWithProduct;
    bindProductCtas();
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

/*
 * Mock of the Mo gift voucher API (mo spec §8) and of Shopify's
 * /cart/add.js + <cart-modal> for tests/gift-voucher/harness.html.
 * Test code only — never uploaded. Everything the page sends is recorded in
 * window.__gvMock (calls, cart, events, violations) for run.cjs.
 *
 *   GET  /api/gift-vouchers/config      six designs with vector backgrounds
 *   POST /api/gift-vouchers/photo       (XMLHttpRequest, with upload progress)
 *   POST /api/gift-vouchers/suggest     three texts with {{fuer}} / {{von}}
 *   POST /api/gift-vouchers/preview     JPEG data URIs drawn on a canvas, „MUSTER“
 *   POST /api/gift-vouchers/drafts      → token
 *   POST /api/gift-vouchers/balance     ABCDEFGHJKLMNPQR → 42,50 € of 50 €
 */
(function () {
  'use strict';
  var API = 'https://mo.example.test';
  var q = new URLSearchParams(location.search);
  var scenario = q.get('scenario') || '';
  var mock = window.__gvMock = { calls: [], cart: [], events: [], photos: {}, violations: [], tokens: [] };
  // Every record also goes to run.cjs (window.__gvRecord, a Playwright
  // binding) so the assertions survive the redirect to /checkout.
  function record(kind, item) {
    mock[kind].push(item);
    try { if (typeof window.__gvRecord === 'function') window.__gvRecord(kind, JSON.stringify(item)); } catch (e) {}
  }
  var realFetch = window.fetch.bind(window);
  var ALLOWED = ['content-type', 'x-ms-chat-key', 'x-ms-session', 'x-ms-locale'];

  // ---------------------------------------------------------------- designs
  function prng(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }
  function svg(w, h, body, defs) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid slice">' + (defs ? '<defs>' + defs + '</defs>' : '') + body + '</svg>';
  }
  function classic(w, h) {
    var defs = '<radialGradient id="g" cx="0.9" cy="0.05" r="1"><stop offset="0" stop-color="#2c3238"/><stop offset="0.6" stop-color="#191c20"/><stop offset="1" stop-color="#121417"/></radialGradient>' +
      '<pattern id="k" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 2.5h5M2.5 0v5" stroke="#d9dde2" stroke-width="0.32" opacity="0.55"/></pattern>' +
      '<linearGradient id="f" x1="0" x2="1" y1="0" y2="0"><stop offset="0.38" stop-color="#fff" stop-opacity="0"/><stop offset="0.82" stop-color="#fff" stop-opacity="0.85"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient>' +
      '<mask id="m"><rect width="' + w + '" height="' + h + '" fill="url(#f)"/></mask>' +
      '<linearGradient id="c" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#f3e7c6" stop-opacity="0.0"/><stop offset="1" stop-color="#f3e7c6" stop-opacity="0.18"/></linearGradient>';
    return svg(w, h, '<rect width="' + w + '" height="' + h + '" fill="url(#g)"/><rect width="' + w + '" height="' + h + '" fill="url(#k)" mask="url(#m)"/><path d="M' + (w * 0.62) + ' 0 L' + w + ' 0 L' + w + ' ' + h + ' L' + (w * 0.46) + ' ' + h + 'Z" fill="url(#c)"/>', defs);
  }
  function birthday(w, h) {
    var r = prng(11);
    var cols = ['#008ccb', '#7ccdf2', '#00577f', '#f2a541', '#008ccb', '#b9e3f6'];
    var s = '<rect width="' + w + '" height="' + h + '" fill="url(#bg)"/>';
    for (var i = 0; i < 70; i++) {
      var x = w * (0.38 + r() * 0.62);
      var y = h * r();
      if (x < w * 0.55 && y > h * 0.45) continue;
      var c = cols[Math.floor(r() * cols.length)];
      var o = (0.35 + r() * 0.55).toFixed(2);
      if (r() < 0.5) s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (0.8 + r() * 1.9).toFixed(2) + '" fill="' + c + '" opacity="' + o + '"/>';
      else {
        var a = r() * 180;
        s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (3 + r() * 4).toFixed(1) + '" height="1.1" rx="0.55" fill="' + c + '" opacity="' + o + '" transform="rotate(' + a.toFixed(0) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"/>';
      }
    }
    return svg(w, h, s, '<linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef7fc"/></linearGradient>');
  }
  function christmas(w, h) {
    var r = prng(5);
    var s = '<rect width="' + w + '" height="' + h + '" fill="url(#bg)"/>';
    for (var i = 0; i < 90; i++) {
      var x = w * r();
      var y = h * r();
      s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (0.2 + r() * 0.55).toFixed(2) + '" fill="#ffffff" opacity="' + (0.25 + r() * 0.6).toFixed(2) + '"/>';
    }
    function star(cx, cy, R, op) {
      var p = '';
      for (var k = 0; k < 8; k++) {
        var ang = Math.PI / 4 * k - Math.PI / 2;
        var rr = k % 2 ? R * 0.28 : R;
        p += (k ? 'L' : 'M') + (cx + Math.cos(ang) * rr).toFixed(2) + ' ' + (cy + Math.sin(ang) * rr).toFixed(2);
      }
      return '<path d="' + p + 'Z" fill="#d9b26f" opacity="' + op + '"/>';
    }
    s += star(w * 0.8, h * 0.24, 6.5, 0.95) + star(w * 0.68, h * 0.5, 3.4, 0.8) + star(w * 0.9, h * 0.62, 4.2, 0.85) + star(w * 0.58, h * 0.16, 2.6, 0.7);
    s += '<path d="M0 ' + (h * 0.9) + ' Q ' + (w * 0.3) + ' ' + (h * 0.82) + ' ' + (w * 0.6) + ' ' + (h * 0.9) + ' T ' + w + ' ' + (h * 0.86) + ' V ' + h + ' H 0 Z" fill="#ffffff" opacity="0.06"/>';
    return svg(w, h, s, '<radialGradient id="bg" cx="0.75" cy="0.25" r="0.95"><stop offset="0" stop-color="#16406b"/><stop offset="1" stop-color="#0b2440"/></radialGradient>');
  }
  function thanks(w, h) {
    var s = '<rect width="' + w + '" height="' + h + '" fill="#eaf6fc"/>';
    for (var i = 0; i < 14; i++) {
      var y0 = h * 0.08 + i * h * 0.055;
      s += '<path d="M' + (w * 0.3) + ' ' + y0.toFixed(1) + ' C ' + (w * 0.5) + ' ' + (y0 - h * 0.18).toFixed(1) + ', ' + (w * 0.72) + ' ' + (y0 + h * 0.24).toFixed(1) + ', ' + (w * 1.05) + ' ' + (y0 + h * 0.02).toFixed(1) + '" fill="none" stroke="#008ccb" stroke-width="0.55" opacity="' + (0.14 + i * 0.022).toFixed(2) + '"/>';
    }
    return svg(w, h, s);
  }
  function training(w, h) {
    var cx = w * 0.98;
    var cy = h * 0.98;
    var R = Math.max(w, h) * 0.62;
    var s = '<rect width="' + w + '" height="' + h + '" fill="#0f1114"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="#008ccb"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R * 0.86) + '" fill="#0a79ae"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R * 0.83) + '" fill="none" stroke="#5cc3ef" stroke-width="0.6" opacity="0.7"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R * 0.5) + '" fill="#006d9f"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R * 0.2) + '" fill="#1b1f24"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R * 0.09) + '" fill="#0f1114"/>';
    for (var i = 0; i < 72; i++) {
      var a = Math.PI * 2 * i / 72;
      var r1 = R * 0.9;
      var r2 = R * (i % 6 ? 0.94 : 0.97);
      s += '<line x1="' + (cx + Math.cos(a) * r1).toFixed(1) + '" y1="' + (cy + Math.sin(a) * r1).toFixed(1) + '" x2="' + (cx + Math.cos(a) * r2).toFixed(1) + '" y2="' + (cy + Math.sin(a) * r2).toFixed(1) + '" stroke="#bfe6f8" stroke-width="0.5" opacity="0.7"/>';
    }
    return svg(w, h, s);
  }
  function photo(w, h) {
    var s = '<rect width="' + w + '" height="' + h + '" fill="url(#bg)"/>';
    s += '<circle cx="' + (w * 0.72) + '" cy="' + (h * 0.3) + '" r="' + (Math.min(w, h) * 0.09) + '" fill="#f7d48b" opacity="0.85"/>';
    s += '<path d="M0 ' + (h * 0.78) + ' L' + (w * 0.28) + ' ' + (h * 0.44) + ' L' + (w * 0.5) + ' ' + (h * 0.7) + ' L' + (w * 0.68) + ' ' + (h * 0.5) + ' L' + w + ' ' + (h * 0.82) + ' V' + h + ' H0Z" fill="#5c7186" opacity="0.9"/>';
    s += '<path d="M0 ' + (h * 0.9) + ' L' + (w * 0.4) + ' ' + (h * 0.64) + ' L' + (w * 0.75) + ' ' + (h * 0.92) + ' L' + w + ' ' + (h * 0.78) + ' V' + h + ' H0Z" fill="#33414f"/>';
    return svg(w, h, s, '<linearGradient id="bg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#9fb8cf"/><stop offset="1" stop-color="#dfe7ee"/></linearGradient>');
  }
  var DESIGNS = [
    { key: 'classic', name: 'Klassisch', description: 'Anthrazit mit feiner Rändelung – zeitlos edel.', photo: false, gen: classic, colors: { background: '#15171a', ink: '#f3e7c6', accent: '#008ccb', muted: '#9aa3ab', insideBackground: '#fbfaf6', insideInk: '#1b1d20' } },
    { key: 'birthday', name: 'Geburtstag', description: 'Leichtes Konfetti in Blau und Sonnengelb.', photo: false, gen: birthday, colors: { background: '#ffffff', ink: '#0d1b2a', accent: '#008ccb', muted: '#5b6670', insideBackground: '#ffffff', insideInk: '#1b1d20' } },
    { key: 'christmas', name: 'Weihnachten', description: 'Nachtblau mit Sternen und goldenen Akzenten.', photo: false, gen: christmas, colors: { background: '#0b2440', ink: '#ffffff', accent: '#d9b26f', muted: '#a9b8cc', insideBackground: '#fbf8f1', insideInk: '#0b2440' } },
    { key: 'thanks', name: 'Danke', description: 'Helles Blau mit fließenden Linien.', photo: false, gen: thanks, colors: { background: '#eaf6fc', ink: '#00577f', accent: '#008ccb', muted: '#3f6a80', insideBackground: '#ffffff', insideInk: '#10324a' } },
    { key: 'training', name: 'Training', description: 'Kraftvoll: die Hantelscheibe in Markenblau.', photo: false, gen: training, colors: { background: '#0f1114', ink: '#ffffff', accent: '#ffffff', muted: '#9aa3ab', insideBackground: '#f7f8fa', insideInk: '#0f1114' } },
    { key: 'photo', name: 'Eigenes Foto', description: 'Dein Lieblingsbild vorne drauf.', photo: true, gen: photo, colors: { background: '#1d2127', ink: '#ffffff', accent: '#ffffff', muted: '#d0d5dc', insideBackground: '#fbfaf6', insideInk: '#1b1d20' } }
  ];
  function config() {
    return {
      ok: true,
      available: scenario !== 'unavailable',
      unavailableReason: scenario === 'unavailable' ? 'disabled' : null,
      designs: DESIGNS.map(function (d) {
        return { key: d.key, name: d.name, description: d.description, photo: d.photo, colors: d.colors, previewSvg: { landscape: d.gen(210, 148), square: d.gen(140, 140) } };
      }),
      features: { ai: true, photo: true, print: true },
      limits: { recipientName: 40, senderName: 40, message: 350, messageLines: 8, photoMaxBytes: 4000000 },
      occasions: [{ key: 'geburtstag', label: 'Geburtstag' }, { key: 'weihnachten', label: 'Weihnachten' }, { key: 'danke', label: 'Danke' }, { key: 'sport', label: 'Sport' }, { key: 'einfach_so', label: 'Einfach so' }],
      tones: [{ key: 'herzlich', label: 'Herzlich' }, { key: 'witzig', label: 'Witzig' }, { key: 'sportlich', label: 'Sportlich' }, { key: 'kurz', label: 'Kurz' }],
      print: { countries: ['DE'], deliveryNote: '3–6 Werktage' },
      validity: { years: 3, untilExample: '31.12.2029' },
      termsUrl: 'https://www.motionsports.de/pages/gutscheinbedingungen',
      fonts: { script: API + '/api/gift-vouchers/fonts/caveat-500.ttf' }
    };
  }
  var SUGGESTIONS = {
    herzlich: [
      'Liebe {{fuer}},\nalles Gute! Such dir etwas aus, das dich stärker macht – ich freu mich auf deine nächsten Bestleistungen.\nDein {{von}}',
      'Für dich, {{fuer}}, ein kleines Stück Motivation: Gönn dir neues Equipment und ganz viele gute Trainingstage.\nVon Herzen, {{von}}',
      'Hallo {{fuer}}!\nWeil du es dir verdient hast: Viel Freude beim Aussuchen und beim Training.'
    ],
    witzig: [
      'Hey {{fuer}},\nHanteln heben ist wie Kuchen essen – nur andersrum. Viel Spaß beim Aussuchen!\n{{von}}',
      'Achtung, {{fuer}}: Dieser Gutschein kann Muskelkater verursachen. Nebenwirkungen: gute Laune.',
      '{{fuer}}, ab heute gibt es keine Ausreden mehr. Viel Spaß!\nDein {{von}}'
    ]
  };

  // ------------------------------------------------------------- helpers
  function rand(n) {
    var a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    var s = '';
    for (var i = 0; i < n; i++) s += a.charAt(Math.floor(Math.random() * a.length));
    return s;
  }
  function json(status, body, delay) {
    return new Promise(function (res) {
      setTimeout(function () { res(new Response(JSON.stringify(body), { status: status, headers: { 'Content-Type': 'application/json' } })); }, delay == null ? 150 : delay);
    });
  }
  function err(status, code, message, field, delay) {
    var e = { code: code, message: message };
    if (field) e.field = field;
    return json(status, { error: e }, delay);
  }
  function checkHeaders(path, headers, credentials) {
    var keys = Object.keys(headers || {}).map(function (k) { return k.toLowerCase(); });
    keys.forEach(function (k) { if (ALLOWED.indexOf(k) === -1) record('violations', path + ': header ' + k); });
    ['x-ms-chat-key', 'x-ms-session', 'x-ms-locale'].forEach(function (k) { if (keys.indexOf(k) === -1) record('violations', path + ': missing ' + k); });
    if (credentials === 'include') record('violations', path + ': credentials include');
  }
  function lower(h) { var o = {}; Object.keys(h || {}).forEach(function (k) { o[k.toLowerCase()] = h[k]; }); return o; }

  // --------------------------------------------------- the "server" preview
  function loadImg(src) {
    return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
  }
  function svgUri(s) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); }
  function spaced(x, text, px, py, spacing) {
    var cx = px;
    for (var i = 0; i < text.length; i++) { x.fillText(text[i], cx, py); cx += x.measureText(text[i]).width + spacing; }
  }
  function wrap(x, text, maxW) {
    var out = [];
    String(text).split('\n').forEach(function (para) {
      var words = para.split(' ');
      var line = '';
      words.forEach(function (w) {
        var t = line ? line + ' ' + w : w;
        if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
      });
      out.push(line);
    });
    return out;
  }
  function watermark(x, W, H) {
    x.save();
    x.translate(W / 2, H / 2);
    x.rotate(-0.42);
    x.font = '700 ' + Math.round(Math.min(W, H) * 0.24) + 'px Montserrat, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = 'rgba(128,128,128,0.26)';
    x.strokeStyle = 'rgba(255,255,255,0.22)';
    x.lineWidth = 3;
    x.fillText('MUSTER', 0, 0);
    x.strokeText('MUSTER', 0, 0);
    x.restore();
  }
  function lum(hex) {
    var h = hex.replace('#', '');
    var c = [0, 2, 4].map(function (o) { var v = parseInt(h.substr(o, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function euro(cents, whole) {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(cents / 100);
  }
  function drawFront(d, lay, b) {
    var W = 1000;
    var H = lay === 'square' ? 1000 : 705;
    var c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    var x = c.getContext('2d');
    x.fillStyle = d.colors.background;
    x.fillRect(0, 0, W, H);
    var photoUrl = d.photo && b.photoId && mock.photos[b.photoId];
    var src = photoUrl || svgUri(d.gen(lay === 'square' ? 140 : 210, lay === 'square' ? 140 : 148));
    return loadImg(src).then(function (img) {
      if (photoUrl) {
        var s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
        var iw = img.naturalWidth * s;
        var ih = img.naturalHeight * s;
        x.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
        var g = x.createLinearGradient(0, H * 0.4, 0, H);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.66)');
        x.fillStyle = g;
        x.fillRect(0, 0, W, H);
      } else x.drawImage(img, 0, 0, W, H);
      var dark = lum(d.colors.background) < 0.25;
      var ink = d.photo ? '#ffffff' : d.colors.ink;
      var brand = d.photo ? '#ffffff' : (d.key === 'classic' ? d.colors.accent : (dark ? '#ffffff' : '#008ccb'));
      if (d.key === 'christmas') brand = d.colors.accent;
      var muted = d.photo ? 'rgba(255,255,255,0.85)' : d.colors.muted;
      var sq = lay === 'square';
      var pad = sq ? 90 : 76;
      x.textBaseline = 'top';
      x.fillStyle = brand;
      x.font = '700 ' + (sq ? 52 : 40) + 'px Montserrat, sans-serif';
      x.fillText('motion sports', pad, pad * 0.9);
      x.fillStyle = muted;
      x.font = '700 ' + (sq ? 23 : 18) + 'px Montserrat, sans-serif';
      spaced(x, 'GESCHENKGUTSCHEIN', pad, pad * 0.9 + (sq ? 66 : 52), sq ? 7 : 5.5);
      x.textBaseline = 'alphabetic';
      x.fillStyle = ink;
      var vSize = sq ? 190 : 150;
      x.font = '700 ' + vSize + 'px Montserrat, sans-serif';
      var bottom = H - pad;
      var forText = b.recipientName ? 'für ' + b.recipientName : '';
      var vBase = bottom - (forText ? (sq ? 120 : 96) : (sq ? 62 : 50));
      x.fillText(euro(b.amountCents || 5000, true), pad - 6, vBase);
      if (forText) {
        x.font = '700 ' + (sq ? 50 : 38) + 'px Montserrat, sans-serif';
        x.fillText(forText, pad, vBase + (sq ? 70 : 54));
      }
      x.fillStyle = muted;
      x.font = '700 ' + (sq ? 24 : 18) + 'px Montserrat, sans-serif';
      spaced(x, 'motionsports.de', pad, bottom, 1.6);
      watermark(x, W, H);
      return c.toDataURL('image/jpeg', 0.86);
    });
  }
  function drawInside(d, lay, b) {
    var sq = lay === 'square';
    var W = sq ? 2000 : 1000;
    var H = sq ? 1000 : 705;
    var c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    var x = c.getContext('2d');
    x.fillStyle = d.colors.insideBackground;
    x.fillRect(0, 0, W, H);
    var half = W / 2;
    if (sq) {
      var g = x.createLinearGradient(half - 90, 0, half, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.07)');
      x.fillStyle = g;
      x.fillRect(half - 90, 0, 90, H);
    } else {
      x.fillStyle = 'rgba(0,0,0,0.08)';
      x.fillRect(half, H * 0.12, 1.5, H * 0.76);
    }
    var ink = d.colors.insideInk;
    // message (Caveat), auto-sized
    var msg = b.message || 'Viel Freude beim Training!';
    var from = b.senderName ? '— ' + b.senderName : '';
    var padX = half * 0.12;
    var maxW = half - padX * 2;
    var size = sq ? 64 : 46;
    var lines;
    for (; size > 14; size -= 2) {
      x.font = '500 ' + size + 'px "MS GV Caveat", cursive';
      lines = wrap(x, msg, maxW);
      if (lines.length * size * 1.22 + (from ? size * 1.5 : 0) < H * 0.78) break;
    }
    var total = lines.length * size * 1.22 + (from ? size * 1.5 : 0);
    var y = (H - total) / 2 + size;
    x.fillStyle = ink;
    x.textBaseline = 'alphabetic';
    lines.forEach(function (l) { x.fillText(l, padX, y); y += size * 1.22; });
    if (from) { x.textAlign = 'right'; x.fillText(from, half - padX, y + size * 0.3); x.textAlign = 'left'; }
    // code panel
    var px = half + half * 0.1;
    var s = half / 500;
    x.globalAlpha = 0.62;
    x.font = '700 ' + Math.round(17 * s) + 'px Montserrat, sans-serif';
    spaced(x, 'DEIN GUTSCHEINCODE', px, H * 0.22, 3.6 * s);
    x.globalAlpha = 1;
    x.font = '700 ' + Math.round(31 * s) + 'px Montserrat, sans-serif';
    spaced(x, 'XXXX XXXX XXXX XXXX', px, H * 0.22 + 46 * s, 2.2 * s);
    var qs = 118 * s;
    var qx = px;
    var qy = H * 0.22 + 76 * s;
    x.fillStyle = '#fff';
    x.fillRect(qx, qy, qs, qs);
    var rr = prng(7);
    x.fillStyle = ink;
    var n = 21;
    var cell = qs / (n + 2);
    for (var yy = 0; yy < n; yy++) for (var xx = 0; xx < n; xx++) {
      var finder = (xx < 7 && yy < 7) || (xx > n - 8 && yy < 7) || (xx < 7 && yy > n - 8);
      var on = finder ? ((xx % (n - 7) === 0 || xx % (n - 7) === 6 || yy % (n - 7) === 0 || yy % (n - 7) === 6) || ((xx % (n - 7)) >= 2 && (xx % (n - 7)) <= 4 && (yy % (n - 7)) >= 2 && (yy % (n - 7)) <= 4)) : rr() > 0.52;
      if (on) x.fillRect(qx + cell * (xx + 1), qy + cell * (yy + 1), cell + 0.4, cell + 0.4);
    }
    x.font = '700 ' + Math.round(23 * s) + 'px Montserrat, sans-serif';
    x.fillText('Wert ' + euro(b.amountCents || 5000), px, qy + qs + 44 * s);
    x.globalAlpha = 0.8;
    x.font = '700 ' + Math.round(18 * s) + 'px Montserrat, sans-serif';
    x.fillText('Gültig bis 31.12.2029', px, qy + qs + 74 * s);
    x.globalAlpha = 0.6;
    x.font = '400 ' + Math.round(13.5 * s) + 'px Montserrat, sans-serif';
    x.fillText('Code im Checkout auf motionsports.de eingeben.', px, qy + qs + 108 * s);
    x.fillText('Restguthaben bleibt erhalten.', px, qy + qs + 128 * s);
    x.globalAlpha = 1;
    watermark(x, W, H);
    return Promise.resolve(c.toDataURL('image/jpeg', 0.86));
  }
  function preview(b) {
    var d = DESIGNS.filter(function (z) { return z.key === b.designKey; })[0] || DESIGNS[0];
    var lay = b.layout === 'square' ? 'square' : 'landscape';
    var fonts = document.fonts ? Promise.all([document.fonts.load('700 40px Montserrat'), document.fonts.load('500 40px "MS GV Caveat"')]).catch(function () {}) : Promise.resolve();
    return fonts.then(function () { return Promise.all([drawFront(d, lay, b), drawInside(d, lay, b)]); })
      .then(function (r) { return new Promise(function (res) { setTimeout(function () { res(r); }, scenario === 'slow' ? 4000 : 650); }); })
      .then(function (r) { return json(200, { ok: true, front: r[0], inside: r[1] }, 0); });
  }

  // ------------------------------------------------------------------ fetch
  function handleMo(path, init) {
    var method = (init.method || 'GET').toUpperCase();
    var body = null;
    try { body = init.body ? JSON.parse(init.body) : null; } catch (e) { body = init.body; }
    var headers = lower(init.headers);
    record('calls', { method: method, path: path, headers: headers, body: body, credentials: init.credentials || null });
    var route = path.split('?')[0];
    if (method === 'GET' && route === '/api/gift-vouchers/config') {
      if (Object.keys(headers).length) record('violations', 'config: custom headers make it a preflighted request');
      if (scenario === 'down') return new Promise(function (res, rej) { setTimeout(function () { rej(new TypeError('Failed to fetch')); }, 300); });
      return json(200, config(), 250);
    }
    if (method !== 'POST') return err(405, 'method_not_allowed', 'Methode nicht erlaubt.');
    checkHeaders(route, init.headers, init.credentials);
    if (route === '/api/gift-vouchers/suggest') {
      if (!body || !body.occasion || !body.tone) return err(400, 'bad_request', 'Bitte wähle Anlass und Ton.');
      var list = SUGGESTIONS[body.tone] || SUGGESTIONS.herzlich;
      return json(200, { ok: true, suggestions: list.slice(0, 3) }, 950);
    }
    if (route === '/api/gift-vouchers/preview') {
      if (scenario === 'preview-error') return err(503, 'upstream_unavailable', 'Die Vorschau ist gerade nicht verfügbar. Bitte versuche es gleich noch einmal.', null, 700);
      return preview(body || {});
    }
    if (route === '/api/gift-vouchers/drafts') {
      if (scenario === 'draft-error') return err(400, 'bad_request', 'Die Postleitzahl muss aus fünf Ziffern bestehen.', 'address.postalCode', 400);
      var token = 'gvd_' + rand(32);
      record('tokens', token);
      return json(200, { ok: true, token: token }, 350);
    }
    if (route === '/api/gift-vouchers/balance') {
      var code = body && body.code;
      if (code === 'ABCDEFGHJKLMNPQR') return json(200, { ok: true, found: true, balanceCents: 4250, amountCents: 5000, currency: 'EUR', expiresOn: '2029-12-31', state: 'active' }, 500);
      if (code === 'USEDUSEDUSEDUSED') return json(200, { ok: true, found: true, balanceCents: 0, amountCents: 2500, currency: 'EUR', expiresOn: '2028-12-31', state: 'used' }, 500);
      return json(200, { ok: true, found: false }, 500);
    }
    return err(404, 'not_found', 'Nicht gefunden.');
  }
  function handleCartAdd(init) {
    var body = null;
    try { body = JSON.parse(init.body); } catch (e) {}
    record('calls', { method: 'POST', path: '/cart/add.js', headers: lower(init.headers), body: body, credentials: init.credentials || null });
    if (scenario === 'cart-error') return json(422, { status: 422, message: 'Cart Error', description: 'Dieses Produkt ist gerade nicht verfügbar.' }, 300);
    (body && body.items || []).forEach(function (it) { mock.cart.push(it); });
    return json(200, { items: body && body.items || [] }, 300);
  }
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input.url;
    init = init || {};
    if (url.indexOf(API) === 0) return handleMo(url.slice(API.length), init);
    if (/\/cart\/add\.js$/.test(url.split('?')[0])) return handleCartAdd(init);
    return realFetch(input, init);
  };

  // ------------------------------------------------------- XHR (the photo)
  function MockXHR() { this.upload = {}; this.readyState = 0; this.status = 0; this.responseText = ''; this.timeout = 0; this._headers = {}; }
  MockXHR.prototype.open = function (method, url) { this._method = method; this._url = url; this.readyState = 1; };
  MockXHR.prototype.setRequestHeader = function (k, v) { this._headers[k] = v; };
  MockXHR.prototype.send = function (blob) {
    var self = this;
    var path = this._url.indexOf(API) === 0 ? this._url.slice(API.length) : this._url;
    record('calls', { method: this._method, path: path, headers: lower(this._headers), bodySize: blob && blob.size, bodyType: blob && blob.type, xhr: true });
    checkHeaders(path, this._headers, null);
    if (path !== '/api/gift-vouchers/photo') { setTimeout(function () { self.status = 404; self.responseText = '{"error":{"code":"not_found","message":"Nicht gefunden."}}'; if (self.onload) self.onload(); }, 50); return; }
    var total = blob && blob.size || 1;
    var steps = 8;
    var i = 0;
    var tick = setInterval(function () {
      i++;
      if (self.upload.onprogress) self.upload.onprogress({ lengthComputable: true, loaded: Math.round(total * i / steps), total: total });
      if (i < steps) return;
      clearInterval(tick);
      var id = 'gvp_' + rand(30);
      mock.photos[id] = URL.createObjectURL(blob);
      self.status = 200;
      self.readyState = 4;
      self.responseText = JSON.stringify({ ok: true, photoId: id, width: 2400, height: 1600 });
      if (self.onload) self.onload();
    }, 110);
  };
  window.XMLHttpRequest = MockXHR;

  // ------------------------------------------- the theme's cart drawer stub
  var TITLES = { 47110000000099: 'Gutschein Premium-Karte' };
  document.addEventListener('cart:refresh', function () { record('events', 'cart:refresh'); });
  customElements.define('cart-modal', class extends HTMLElement {
    reloadContent() { record('events', 'reloadContent'); return new Promise(function (r) { setTimeout(r, 120); }); }
    show() {
      record('events', 'show');
      var d = document.querySelector('.hx-drawer');
      if (!d) { d = document.createElement('div'); d.className = 'hx-drawer'; document.body.appendChild(d); }
      var html = '<h2>Warenkorb</h2><ul>';
      mock.cart.forEach(function (it) {
        var props = Object.keys(it.properties || {}).filter(function (k) { return k.charAt(0) !== '_'; }).map(function (k) { return '<small>' + k + ': ' + String(it.properties[k]).replace(/</g, '&lt;') + '</small>'; }).join('');
        html += '<li><b>' + (TITLES[it.id] || 'Geschenkgutschein') + '</b>' + props + '</li>';
      });
      d.innerHTML = html + '</ul>';
      requestAnimationFrame(function () { d.classList.add('is-open'); });
    }
  });
})();

#!/usr/bin/env node
/*
 * Playwright run of the Gutschein-Designer harness (tests/gift-voucher/
 * harness.html + mock-mo.js). Not uploaded to Shopify.
 *
 *   NODE_PATH="$(npm root -g)" \
 *   GV_FONTS_DIR=/path/with/ttf  GV_SHOTS_DIR=/path/for/screenshots \
 *   [GV_FINAL_DIR=/path/for/clean/step/screenshots] \
 *   node tests/gift-voucher/run.cjs
 *
 * GV_FINAL_DIR (optional): one clean screenshot per step at 1440 and 390 px
 * (the designer band cut out of a full-page capture, so the theme's sticky
 * header never covers it) plus hero, bar, cart, balance, FAQ and fallback.
 *
 * GV_FONTS_DIR (optional) holds Montserrat_400Regular.ttf,
 * Montserrat_400Regular_Italic.ttf, Montserrat_700Bold.ttf and
 * Caveat_500Medium.ttf (OFL; e.g. from `npm pack @expo-google-fonts/montserrat`
 * / `@expo-google-fonts/caveat`) — without them the page falls back to the
 * system sans-serif. Screenshots: NN-step-width.png at 1440 and 390 px
 * (deviceScaleFactor 1). Exit code 1 when an assertion fails.
 *
 * What it exercises: the whole purchase (amount, design, photo upload,
 * texts, a Mo suggestion with the {{fuer}}/{{von}} placeholders, emoji
 * removal, Premium-Karte + address validation, the exact preview, terms,
 * „Jetzt kaufen“ → drafts → /cart/add.js → /checkout) with the request
 * contract (headers, credentials, cart properties, no names in URLs);
 * „In den Warenkorb“ (cart:refresh + <cart-modal>.reloadContent + show);
 * the sticky bar clear of the Mo launcher; „Guthaben prüfen“; the
 * fallbacks (Mo off, sales off, network down); preview and draft errors;
 * keyboard focus; reduced motion; English strings; no horizontal scroll.
 */
'use strict';
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const FONTS = process.env.GV_FONTS_DIR ? path.resolve(process.env.GV_FONTS_DIR) : '';
const OUT = path.resolve(process.env.GV_SHOTS_DIR || path.join(os.tmpdir(), 'ms-gv-shots'));
fs.mkdirSync(OUT, { recursive: true });
const FINAL = process.env.GV_FINAL_DIR ? path.resolve(process.env.GV_FINAL_DIR) : '';
if (FINAL) fs.mkdirSync(FINAL, { recursive: true });

const ROOT_ID = 'ms-gv-template--gv__main';
const SEL = {
  designer: '[data-ms-gv-designer]',
  stage: '.ms-gv-stage',
  forInput: '#' + ROOT_ID + '-for',
  fromInput: '#' + ROOT_ID + '-from',
  msgInput: '#' + ROOT_ID + '-msg',
  terms: '#' + ROOT_ID + '-terms'
};
const V = { v25: 47110000000001, v50: 47110000000002, v100: 47110000000004, print: 47110000000099 };

// ------------------------------------------------------------------ server
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.ttf': 'font/ttf', '.png': 'image/png', '.json': 'application/json' };
function serve() {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://h');
    const p = decodeURIComponent(u.pathname);
    if (p === '/checkout' || p === '/cart') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><meta charset="utf-8"><title>' + p + '</title><h1 style="font:600 24px sans-serif;padding:40px">' + p + ' (Harness)</h1>');
      return;
    }
    let file = '';
    if (p.startsWith('/__fonts/')) file = FONTS ? path.join(FONTS, path.basename(p)) : '';
    else {
      file = path.normalize(path.join(REPO, p));
      if (!file.startsWith(REPO + path.sep)) file = '';
    }
    if (!file) { res.writeHead(404); res.end(); return; }
    fs.readFile(file, (e, buf) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(buf);
    });
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

// ------------------------------------------------------------------ checks
const results = [];
let failures = 0;
function ok(cond, msg) {
  results.push((cond ? '  ok   ' : '  FAIL ') + msg);
  if (!cond) failures++;
}
const norm = (s) => String(s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

(async () => {
  const srv = await serve();
  const BASE = 'http://127.0.0.1:' + srv.address().port + '/tests/gift-voucher/harness.html';
  const browser = await chromium.launch();

  async function open(width, opts = {}) {
    const mobile = width < 600;
    const ctx = await browser.newContext({
      viewport: { width, height: mobile ? 844 : 900 },
      deviceScaleFactor: 1,
      isMobile: mobile,
      hasTouch: mobile,
      reducedMotion: opts.reducedMotion ? 'reduce' : 'no-preference'
    });
    const rec = { calls: [], events: [], violations: [], tokens: [] };
    await ctx.exposeBinding('__gvRecord', (_src, kind, item) => { if (rec[kind]) rec[kind].push(JSON.parse(item)); });
    if (opts.draft) {
      await ctx.addInitScript((d) => {
        try {
          if (!sessionStorage.getItem('ms-gv-harness')) { sessionStorage.setItem('ms-gv-draft', d); sessionStorage.setItem('ms-gv-harness', '1'); }
        } catch (e) {}
      }, JSON.stringify(opts.draft));
    }
    const page = await ctx.newPage();
    page.rec = rec;
    page.errors = [];
    page.urls = [];
    page.on('pageerror', (e) => page.errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' && !/__fonts|Failed to load resource/.test(m.text())) page.errors.push(m.text()); });
    page.on('request', (r) => page.urls.push(r.url()));
    await page.route('https://mo.example.test/**', (route) => {
      const u = route.request().url();
      if (/\/api\/gift-vouchers\/fonts\/caveat-500\.ttf$/.test(u) && FONTS && fs.existsSync(path.join(FONTS, 'Caveat_500Medium.ttf'))) {
        return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'font/ttf' }, body: fs.readFileSync(path.join(FONTS, 'Caveat_500Medium.ttf')) });
      }
      return route.fulfill({ status: 404, body: '' });
    });
    await page.goto(BASE + (opts.query || ''));
    return { ctx, page };
  }
  async function settle(page, ms = 450) {
    await page.evaluate(() => (document.fonts ? document.fonts.ready : null));
    await page.waitForTimeout(ms);
  }
  async function shot(page, name, selector) {
    const file = path.join(OUT, name + '.png');
    if (selector) {
      const el = await page.$(selector);
      await el.screenshot({ path: file, animations: 'disabled' });
    } else await page.screenshot({ path: file, animations: 'disabled' });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(over <= 0, name + ': no horizontal scroll (' + over + ' px)');
  }
  async function ready(page) {
    await page.waitForSelector(SEL.designer + '[data-state="ready"]', { timeout: 10000 });
    await settle(page, 300);
  }
  async function step(page) {
    return page.$eval('[data-ms-gv-steps] [aria-current="step"]', (n) => Number(n.getAttribute('data-step')));
  }
  // aria-disabled buttons keep their click on purpose (it shows what is
  // open), so Playwright's „enabled“ wait is skipped for them.
  async function press(page, selector) { await page.click(selector, { force: true }); }
  async function next(page, from) {
    await press(page, '[data-panel="' + from + '"] .ms-gv-btn--next');
    await settle(page, 500);
  }
  async function scrollTo(page, selector, offset = 140) {
    await page.$eval(selector, (n, off) => window.scrollTo(0, n.getBoundingClientRect().top + window.scrollY - off), offset);
    await page.waitForTimeout(250);
  }
  function call(page, p) { return page.rec.calls.filter((c) => c.path === p); }
  function headersOk(c) {
    const keys = Object.keys(c.headers || {}).sort().join(',');
    return keys === 'content-type,x-ms-chat-key,x-ms-locale,x-ms-session';
  }

  // ======================================================= the purchase
  async function purchase(W) {
    results.push('— purchase flow ' + W + ' px');
    const { ctx, page } = await open(W);
    await ready(page);
    ok(await page.evaluate(() => Object.keys(window).filter((k) => /gv/i.test(k) && !/^__gv(Mock|Record)$/.test(k)).length === 0), 'no JS globals from the page script');
    await shot(page, '01-hero-' + W);
    await page.screenshot({ path: path.join(OUT, '00-page-' + W + '.png'), fullPage: true, animations: 'disabled' });

    // 1 Betrag
    await page.click('.ms-gv-hero__cta');
    await settle(page, 900);
    ok(await page.getAttribute('.ms-gv-amount[data-variant="' + V.v50 + '"]', 'aria-pressed') === 'true', '50 € is preselected');
    await page.click('.ms-gv-amount[data-variant="' + V.v100 + '"]');
    await settle(page, 350);
    ok(norm(await page.textContent('.ms-gv-preview__card--front .ms-gv-face__value')) === '100 €', 'preview shows 100 €');
    if (W < 600) {
      // The preview sits above the steps: with it in view the panel's own
      // „Weiter“ is below the fold → the bar takes over.
      await scrollTo(page, '.ms-gv-preview', 120);
      await settle(page, 600);
      const bar = await page.$eval('.ms-gv-bar', (b) => {
        const t = b.querySelector('.ms-gv-bar__total');
        const st = b.querySelector('.ms-gv-bar__step');
        const btn = b.querySelector('.ms-gv-bar__btn');
        return { shown: b.classList.contains('is-shown'), r: b.getBoundingClientRect().toJSON(), totalRight: t.getBoundingClientRect().right, btnLeft: btn.getBoundingClientRect().left, totalFits: t.scrollWidth <= t.clientWidth + 1, stepFits: st.scrollWidth <= st.clientWidth + 1 };
      });
      const l = await page.$eval('.ms-chat-launcher', (b) => b.getBoundingClientRect().toJSON());
      ok(bar.shown, 'mobile: sticky bar shown while the panel buttons are out of view');
      ok(bar.r.right <= l.left - 6, 'mobile: bar keeps clear of the Mo launcher (' + Math.round(bar.r.right) + ' ≤ ' + Math.round(l.left - 6) + ')');
      ok(Math.abs((bar.r.top + bar.r.bottom) / 2 - (l.top + l.bottom) / 2) <= 3, 'mobile: bar centred on the launcher');
      ok(norm(await page.textContent('.ms-gv-bar__total')) === '100,00 €', 'mobile: bar total 100,00 €');
      ok(bar.totalFits && bar.stepFits && bar.totalRight <= bar.btnLeft - 4, 'mobile: total and step line fit next to the button (' + Math.round(bar.totalRight) + ' < ' + Math.round(bar.btnLeft) + ')');
      await shot(page, '02-amount-bar-' + W);
    }
    await shot(page, '02-amount-' + W, SEL.stage);
    await next(page, 0);
    ok(await step(page) === 1, 'step 2 after „Weiter zum Motiv“');

    // 2 Motiv: „Eigenes Foto“ opens the picker; without a photo „Weiter“ is
    // blocked; then a photo, then „Geburtstag“.
    const chooser = page.waitForEvent('filechooser', { timeout: 4000 }).then(() => true, () => false);
    await page.click('.ms-gv-design[data-design="photo"]');
    ok(await chooser, '„Eigenes Foto“ opens the file picker at once');
    await settle(page, 300);
    await press(page, '[data-panel="1"] .ms-gv-btn--next');
    await settle(page, 400);
    ok(await step(page) === 1, 'no photo → still step 2');
    ok(await page.isVisible('.ms-gv-upload .ms-gv-field__error'), 'photo missing → message at the box');
    await shot(page, '03-photo-missing-' + W, SEL.stage);
    const png = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 2600; c.height = 1700;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, 1700);
      g.addColorStop(0, '#f6b26b'); g.addColorStop(0.55, '#e88a74'); g.addColorStop(1, '#5d4a7a');
      x.fillStyle = g; x.fillRect(0, 0, 2600, 1700);
      x.fillStyle = '#ffe9a8'; x.beginPath(); x.arc(1750, 760, 230, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#3e3557'; x.beginPath(); x.moveTo(0, 1250); x.lineTo(700, 820); x.lineTo(1250, 1180); x.lineTo(1900, 900); x.lineTo(2600, 1300); x.lineTo(2600, 1700); x.lineTo(0, 1700); x.fill();
      x.fillStyle = '#231e33'; x.beginPath(); x.moveTo(0, 1500); x.lineTo(900, 1150); x.lineTo(1600, 1520); x.lineTo(2600, 1350); x.lineTo(2600, 1700); x.lineTo(0, 1700); x.fill();
      return c.toDataURL('image/png').split(',')[1];
    });
    await page.setInputFiles('.ms-gv-upload input[type="file"]', { name: 'sonnenuntergang.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await page.waitForSelector('.ms-gv-upload__done:not([hidden])', { timeout: 15000 });
    await settle(page, 400);
    const up = call(page, '/api/gift-vouchers/photo')[0];
    const sid = await page.evaluate(() => localStorage.getItem('ms-chat-sid'));
    ok(!!sid, 'ms-chat-sid exists after the first request');
    ok(!!up && up.bodyType === 'image/jpeg' && up.bodySize > 0 && up.bodySize <= 4000000, 'photo: downscaled JPEG uploaded (' + (up && up.bodySize) + ' bytes)');
    const dims = await page.evaluate(() => { const i = document.querySelector('.ms-gv-upload__thumb'); return i ? [i.naturalWidth, i.naturalHeight] : null; });
    ok(!!dims && Math.max(dims[0], dims[1]) <= 720, 'photo: thumbnail ≤ 720 px for the preview');
    ok(!!up && headersOk(up), 'photo: only the allowed headers');
    ok(!!up && up.headers['x-ms-session'] === sid, 'photo: x-ms-session = localStorage ms-chat-sid');
    await shot(page, '03-photo-' + W, SEL.stage);
    await page.click('.ms-gv-design[data-design="birthday"]');
    await settle(page, 350);
    await shot(page, '04-design-' + W, SEL.stage);
    await next(page, 1);
    ok(await step(page) === 2, 'step 3 (Text)');

    // 3 Text + „Mit Mo formulieren“
    await page.fill(SEL.forInput, 'Lena');
    await page.fill(SEL.fromInput, 'Jonas');
    await page.click('.ms-gv-ai__toggle');
    await page.click('.ms-gv-chip:has-text("Geburtstag")');
    await page.click('.ms-gv-ai__go');
    await page.waitForSelector('.ms-gv-sugg--skeleton');
    if (W >= 600) await shot(page, '05-text-loading-' + W, SEL.stage);
    await page.waitForSelector('.ms-gv-sugg__use', { timeout: 10000 });
    await settle(page, 300);
    let texts = await page.$$eval('.ms-gv-sugg__text', (ns) => ns.map((n) => n.textContent));
    ok(texts.length === 3 && texts.every((t) => !/\{\{/.test(t)), 'three suggestions, placeholders filled');
    ok(texts[0].indexOf('Liebe Lena,') === 0 && /Bestleistungen\.$/.test(texts[0]) && !/Jonas/.test(texts[0]), 'suggestion 1: „Liebe Lena,“ … — the closing „Dein {{von}}“ is left to the sender line');
    ok(/\nVon Herzen$/.test(texts[1]), 'suggestion 2: the closing „Von Herzen, {{von}}“ keeps „Von Herzen“');
    const sug = call(page, '/api/gift-vouchers/suggest')[0];
    ok(!!sug && JSON.stringify(sug.body) === JSON.stringify({ occasion: 'geburtstag', tone: 'herzlich', locale: 'de' }), 'suggest: only occasion, tone, locale (no names)');
    await page.fill(SEL.forInput, '');
    await settle(page, 200);
    texts = await page.$$eval('.ms-gv-sugg__text', (ns) => ns.map((n) => n.textContent));
    ok(texts[0].indexOf('alles Gute!') === 0, 'no recipient: the salutation line „Liebe …,“ is dropped');
    ok(texts[1].indexOf('Für dich, ein kleines') === 0, 'no recipient: the placeholder leaves a sentence with its comma');
    ok(texts[2].indexOf('Weil du') === 0, 'no recipient: „Hallo …!“ dropped');
    await page.fill(SEL.forInput, 'Lena');
    await settle(page, 200);
    await shot(page, '05-text-suggestions-' + W, SEL.stage);
    await page.click('.ms-gv-sugg__use >> nth=0');
    await settle(page, 400);
    let msg = await page.inputValue(SEL.msgInput);
    ok(msg.indexOf('Liebe Lena,') === 0 && !/Jonas/.test(msg), 'suggestion applied with the names');
    ok(norm(await page.textContent('.ms-gv-preview__card--inside .ms-gv-face__from')) === '— Jonas', 'inside preview: the sender line „— Jonas“ under the message');
    await page.focus(SEL.msgInput);
    await page.keyboard.press('Control+End');
    await page.keyboard.insertText(' 🎉💪');
    await settle(page, 300);
    msg = await page.inputValue(SEL.msgInput);
    ok(!/[\ud800-\udfff]/.test(msg), 'emoji removed from the message');
    ok(await page.isVisible('#' + ROOT_ID + '-msg-warn'), 'emoji note shown at the field');
    ok(await page.getAttribute('.ms-gv-seg__btn[data-ms-gv-side="inside"]', 'aria-pressed') === 'true', 'message focus turns the preview to the inside');
    await shot(page, '05-text-' + W, SEL.stage);
    await next(page, 2);
    ok(await step(page) === 3, 'step 4 (Versand)');

    // 4 Versand: Premium-Karte + address
    await page.click('.ms-gv-option >> nth=1');
    await settle(page, 450);
    ok(await page.getAttribute('[data-ms-gv-stage]', 'data-layout') === 'square', 'Premium-Karte → square preview');
    await press(page, '[data-panel="3"] .ms-gv-btn--next');
    await settle(page, 400);
    ok(await step(page) === 3, 'empty address → still step 4');
    const errCount = await page.$$eval('.ms-gv-address .ms-gv-field__error:not([hidden])', (n) => n.length);
    ok(errCount === 4, 'empty address → four field messages (' + errCount + ')');
    await shot(page, '06-delivery-errors-' + W, SEL.stage);
    await page.fill('#' + ROOT_ID + '-addr-name', 'Lena Muster');
    await page.fill('#' + ROOT_ID + '-addr-line1', 'Musterstraße');
    await page.fill('#' + ROOT_ID + '-addr-postal', '8033');
    await page.focus('#' + ROOT_ID + '-addr-city');
    await settle(page, 200);
    ok(norm(await page.textContent('#' + ROOT_ID + '-addr-line1-err')) === 'Bitte ergänze die Hausnummer.', 'inline: street without a number');
    ok(norm(await page.textContent('#' + ROOT_ID + '-addr-postal-err')).indexOf('5 Ziffern') !== -1, 'inline: 4-digit postcode');
    await page.fill('#' + ROOT_ID + '-addr-line1', 'Musterstraße 12');
    await page.fill('#' + ROOT_ID + '-addr-postal', '803 31');
    await page.fill('#' + ROOT_ID + '-addr-city', 'München');
    await settle(page, 250);
    await shot(page, '06-delivery-' + W, SEL.stage);
    await next(page, 3);
    ok(await step(page) === 4, 'step 5 (Prüfen & kaufen)');

    // 5 Prüfen & kaufen
    await page.waitForSelector('.ms-gv-preview__stage.has-exact-front', { timeout: 10000 });
    await settle(page, 600);
    const pv = call(page, '/api/gift-vouchers/preview').pop();
    ok(!!pv && pv.body.layout === 'square' && pv.body.designKey === 'birthday' && pv.body.amountCents === 10000, 'preview: square layout, design, amount');
    ok(await page.isVisible('.ms-gv-summary') === (W >= 990), 'summary under the preview only in two columns');
    const rows = await page.$$eval('[data-panel="4"] .ms-gv-review__row', (rs) => rs.map((r) => (r.querySelector('dt').textContent + ' ' + (r.querySelector('.ms-gv-review__text') || r.querySelector('dd')).textContent).replace(/\s+/g, ' ').trim()));
    ok(rows.some((r) => /^Für \/ Von Lena \/ Jonas/.test(r)), 'review: „Für / Von Lena / Jonas“');
    ok(rows.some((r) => /80331 München/.test(r)), 'review: the postcode without the space');
    await shot(page, '07-review-' + W, SEL.stage);
    await page.click('.ms-gv-seg__btn[data-ms-gv-side="inside"]');
    await settle(page, 600);
    await shot(page, '07-review-inside-' + W, '.ms-gv-preview');
    await press(page, '.ms-gv-buy__now');
    await settle(page, 300);
    ok(await page.isVisible('#' + ROOT_ID + '-terms-err'), 'terms unchecked → message');
    ok(!call(page, '/api/gift-vouchers/drafts').length, 'terms unchecked → no draft');
    await page.check(SEL.terms);
    await settle(page, 150);
    const toCheckout = page.waitForURL('**/checkout', { timeout: 10000 });
    await page.click('.ms-gv-buy__now');
    await toCheckout;
    ok(/\/checkout$/.test(page.url()), '„Jetzt kaufen“ → /checkout');

    const dr = call(page, '/api/gift-vouchers/drafts')[0];
    const token = page.rec.tokens[0];
    ok(!!dr && headersOk(dr) && dr.credentials === 'omit', 'drafts: allowed headers only, credentials omit');
    ok(!!dr && dr.headers['x-ms-session'] === sid && dr.headers['x-ms-locale'] === 'de' && dr.headers['x-ms-chat-key'] === 'harness-key-0000', 'drafts: session, locale and key headers');
    const want = {
      designKey: 'birthday', amountCents: 10000, recipientName: 'Lena', senderName: 'Jonas', delivery: 'print', locale: 'de',
      address: { name: 'Lena Muster', line1: 'Musterstraße 12', postalCode: '80331', city: 'München', country: 'DE' }
    };
    ok(!!dr && Object.keys(want).every((k) => JSON.stringify(dr.body[k]) === JSON.stringify(want[k])), 'drafts: body ' + JSON.stringify(dr && dr.body).slice(0, 260));
    ok(!!dr && typeof dr.body.message === 'string' && dr.body.message.indexOf('Liebe Lena,') === 0 && !('photoId' in dr.body), 'drafts: message, no photoId for „Geburtstag“');
    const add = call(page, '/cart/add.js')[0];
    const items = add && add.body && add.body.items;
    ok(!!add && add.credentials === 'same-origin', 'cart add: same-origin');
    ok(Array.isArray(items) && items.length === 2, 'cart add: two lines');
    ok(!!items && JSON.stringify(items[0]) === JSON.stringify({ id: V.v100, quantity: 1, properties: { 'Gutschein für': 'Lena', 'Motiv': 'Geburtstag', 'Versand': 'Premium-Karte per Post', '_mo_gv': token } }), 'cart add: voucher line ' + JSON.stringify(items && items[0]));
    ok(!!items && JSON.stringify(items[1]) === JSON.stringify({ id: V.print, quantity: 1, properties: { 'Für Gutschein an': 'Lena', '_mo_gv': token } }), 'cart add: Premium-Karte line ' + JSON.stringify(items && items[1]));
    ok(page.urls.every((u) => !/Lena|Jonas|Muster|M%C3%BCnchen|80331/.test(u)), 'no name, message or address in any URL');
    ok(!page.rec.violations.length, 'request contract: ' + (page.rec.violations.join('; ') || 'no violations'));

    // Back from the checkout: the draft remembers the cart.
    await page.goBack();
    await ready(page);
    await settle(page, 500);
    ok(await page.isVisible('.ms-gv-added'), 'back from /checkout: „Dein Gutschein liegt im Warenkorb.“');
    await shot(page, '08-back-from-checkout-' + W, '[data-panel="4"]');
    ok(!page.errors.length, 'no script errors: ' + (page.errors.join(' | ') || 'none'));
    await ctx.close();
  }

  // ===================================== „In den Warenkorb“ (restored draft)
  const DRAFT = {
    v: 1, step: 4, done: [true, true, true, true, false], variantId: V.v50, designKey: 'classic', photo: null,
    recipient: 'Max', sender: 'Anna', message: 'Lieber Max,\nfür deine nächsten Bestzeiten – viel Spaß beim Aussuchen!', delivery: 'pdf',
    address: { name: '', line1: '', line2: '', postalCode: '', city: '', country: 'DE' }, occasion: null, tone: null, added: null
  };
  async function toCart(W) {
    results.push('— „In den Warenkorb“ ' + W + ' px (draft restored at step 5)');
    const { ctx, page } = await open(W, { draft: DRAFT });
    await ready(page);
    ok(await step(page) === 4, 'restored at step 5');
    ok(await page.$$eval('.ms-gv-steps__item.is-done', (n) => n.length) === 4, 'steps 1–4 done (ticks)');
    await page.waitForSelector('.ms-gv-preview__stage.has-exact-front', { timeout: 10000 });
    await settle(page, 500);
    await shot(page, '07-review-pdf-' + W, SEL.stage);
    // A done step is clickable: back to „Motiv“ and forward again over the line.
    await page.click('[data-ms-gv-goto="1"]');
    await settle(page, 400);
    ok(await step(page) === 1, 'progress line: click on a done step goes back');
    if (W >= 600) await shot(page, '09-progress-back-' + W, '.ms-gv-progress');
    await page.click('[data-ms-gv-goto="4"]');
    await settle(page, 500);
    ok(await step(page) === 4, 'progress line: forward to a done step');
    await page.check(SEL.terms);
    await page.click('.ms-gv-buy__cart');
    await page.waitForSelector('.hx-drawer.is-open', { timeout: 10000 });
    await settle(page, 500);
    ok(JSON.stringify(page.rec.events) === JSON.stringify(['cart:refresh', 'reloadContent', 'show']), 'drawer: cart:refresh → reloadContent → show (' + page.rec.events.join(', ') + ')');
    const add = call(page, '/cart/add.js')[0];
    ok(!!add && add.body.items.length === 1 && add.body.items[0].properties['Versand'] === 'PDF per E-Mail' && add.body.items[0].properties['Motiv'] === 'Klassisch', 'PDF: one line, „PDF per E-Mail“');
    ok(await page.isVisible('.ms-gv-added'), 'success state with „Zur Kasse“');
    await shot(page, '08-cart-drawer-' + W);
    ok(!page.errors.length, 'no script errors: ' + (page.errors.join(' | ') || 'none'));
    await ctx.close();
  }

  // ======================================================== balance check
  async function balance(W) {
    results.push('— „Guthaben prüfen“ ' + W + ' px');
    const { ctx, page } = await open(W, { query: '#guthaben' });
    await ready(page);
    const input = '[data-ms-gv-balance-input]';
    await page.fill(input, 'abc');
    await page.click('[data-ms-gv-balance-btn]');
    await settle(page, 300);
    ok(await page.isVisible('.ms-gv-result--error'), 'short code → message, no request');
    ok(!call(page, '/api/gift-vouchers/balance').length, 'short code → no request');
    await page.fill(input, 'abcd-efgh jklm.npqr');
    await page.click('[data-ms-gv-balance-btn]');
    await page.waitForSelector('.ms-gv-result--ok', { timeout: 5000 });
    await settle(page, 300);
    const b = call(page, '/api/gift-vouchers/balance')[0];
    ok(!!b && b.body.code === 'ABCDEFGHJKLMNPQR' && headersOk(b), 'balance: normalised code, allowed headers');
    ok(norm(await page.textContent('.ms-gv-result__title')) === '42,50 € Restguthaben', 'balance: 42,50 € Restguthaben');
    await scrollTo(page, '#guthaben', 100);
    await shot(page, '10-balance-' + W, '.ms-gv-balance');
    await page.fill(input, 'ZZZZ ZZZZ ZZZZ ZZZZ');
    await page.click('[data-ms-gv-balance-btn]');
    await page.waitForSelector('.ms-gv-result--error', { timeout: 5000 });
    ok(/kennen wir nicht/.test(await page.textContent('.ms-gv-result__title')), 'unknown code → „Diesen Code kennen wir nicht …“');
    ok(page.urls.every((u) => !/ABCD|ZZZZ/i.test(u)), 'the code never appears in a URL');
    ok(!page.errors.length, 'no script errors: ' + (page.errors.join(' | ') || 'none'));
    await ctx.close();
  }

  // ===================================================== fallbacks + errors
  async function fallbacks(W) {
    results.push('— fallbacks ' + W + ' px');
    for (const [q, name, label] of [['?scenario=unavailable', '11-fallback-unavailable-', 'sales off'], ['?mo=off', '11-fallback-mo-off-', 'Mo off'], ['?scenario=down', '11-fallback-down-', 'network down']]) {
      const { ctx, page } = await open(W, { query: q });
      await page.waitForSelector(SEL.designer + '[data-state="unavailable"]', { timeout: 10000 });
      await settle(page, 300);
      ok(await page.isVisible('[data-ms-gv-fallback] a[href="/products/motion-sports-geschenkgutschein"]'), label + ': fallback link');
      if (q === '?scenario=down') ok(await page.isVisible('[data-ms-gv-retry]'), 'network down: „Erneut versuchen“');
      if (q === '?mo=off') ok(await page.isDisabled('[data-ms-gv-balance-input]'), 'Mo off: balance check disabled with a note');
      if (q !== '?mo=off' || W >= 600) await shot(page, name + W, SEL.stage);
      ok(!page.errors.length, label + ': no script errors');
      await ctx.close();
    }
    for (const [q, label, hint] of [['?products=soldout&design=1', 'every amount unavailable', /Keine Variante des Gutschein-Produkts/], ['?products=giftcard&design=1', 'gift card product picked', /Shopify-Geschenkkarten-Produkt/]]) {
      const { ctx, page } = await open(W, { query: q });
      await page.waitForSelector(SEL.designer + '[data-state="unavailable"]', { timeout: 10000 });
      ok(await page.isVisible('[data-ms-gv-fallback] a[href="/products/motion-sports-geschenkgutschein"]'), label + ': fallback link');
      ok(hint.test(await page.textContent('[data-ms-gv-editor-hint]')), label + ': theme editor says why');
      ok(!call(page, '/api/gift-vouchers/config?locale=de').length, label + ': no config request');
      ok(!page.errors.length, label + ': no script errors');
      await ctx.close();
    }
    {
      const { ctx, page } = await open(W, { query: '?scenario=preview-error', draft: DRAFT });
      await ready(page);
      await page.waitForSelector('.ms-gv-preview__state.is-error', { timeout: 10000 });
      await settle(page, 300);
      ok(/nicht verfügbar/.test(await page.textContent('.ms-gv-preview__state')), 'preview error: Mo\'s message shown');
      ok(await page.isVisible('.ms-gv-preview__retry'), 'preview error: retry');
      await shot(page, '12-preview-error-' + W, '.ms-gv-preview');
      await ctx.close();
    }
    {
      const d = JSON.parse(JSON.stringify(DRAFT));
      d.delivery = 'print';
      d.address = { name: 'Max Beispiel', line1: 'Beispielweg 3', line2: '', postalCode: '12345', city: 'Berlin', country: 'DE' };
      const { ctx, page } = await open(W, { query: '?scenario=draft-error', draft: d });
      await ready(page);
      await page.check(SEL.terms);
      await page.click('.ms-gv-buy__now');
      await page.waitForSelector('.ms-gv-buy__error:not([hidden])', { timeout: 5000 });
      await settle(page, 300);
      ok(/fünf Ziffern/.test(await page.textContent('.ms-gv-buy__error')), 'draft 400: Mo\'s message verbatim');
      ok(!call(page, '/cart/add.js').length, 'draft 400: nothing added to the cart');
      await shot(page, '13-draft-error-' + W, '[data-panel="4"]');
      await page.click('.ms-gv-buy__errbody .ms-gv-link');
      await settle(page, 500);
      ok(await step(page) === 3, 'draft 400: „Angabe ändern“ → step 4');
      ok(/fünf Ziffern/.test(await page.textContent('#' + ROOT_ID + '-addr-postal-err')), 'draft 400: message at the postcode field');
      await ctx.close();
    }
  }

  // ========================================== keyboard, motion, editor, EN
  async function extras() {
    results.push('— keyboard, reduced motion, editor, English');
    {
      const { ctx, page } = await open(1440);
      await ready(page);
      await scrollTo(page, '.ms-gv-progress', 130);
      await page.focus('.ms-gv-amount[data-variant="' + V.v25 + '"]');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      const f = await page.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { v: a.getAttribute('data-variant'), outline: cs.outlineStyle + ' ' + cs.outlineWidth }; });
      ok(f.v === String(47110000000003) && /solid 2px/.test(f.outline), 'Tab moves through the amount tiles with a visible focus ring');
      await page.keyboard.press('Enter');
      await settle(page, 200);
      ok(await page.getAttribute('.ms-gv-amount[data-variant="47110000000003"]', 'aria-pressed') === 'true', 'Enter picks the focused tile');
      await shot(page, '14-keyboard-focus-1440', '[data-panel="0"]');
      await page.click('[data-panel="0"] .ms-gv-btn--next');
      await settle(page, 400);
      ok(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('ms-gv-panel__title')), 'step change moves the focus to the new step\'s heading');
      ok(await page.evaluate(() => !document.querySelector('[data-ms-chat-dock]')), 'no [data-ms-chat-dock] on the page');
      const types = await page.$$eval('.ms-gv button', (bs) => bs.filter((b) => b.type !== 'button' && !b.hasAttribute('data-ms-gv-balance-btn')).length);
      ok(types === 0, 'every designer button is type="button"');
      await ctx.close();
    }
    {
      const { ctx, page } = await open(390, { reducedMotion: true });
      await ready(page);
      const anim = await page.$eval('.ms-gv-panel:not([hidden])', (n) => getComputedStyle(n).animationName);
      ok(anim === 'none', 'reduced motion: no panel animation');
      await ctx.close();
    }
    {
      const { ctx, page } = await open(1440, { query: '?locale=en' });
      await ready(page);
      ok(/How much would you like to give\?/.test(await page.textContent('[data-panel="0"] .ms-gv-panel__heading')), 'English strings with data-locale="en"');
      ok(call(page, '/api/gift-vouchers/config?locale=en').length === 1, 'config requested with locale=en');
      await ctx.close();
    }
  }


  // ===================================== clean screenshots of every step
  // A full-page capture scrolled to the top, cut to the element: the theme's
  // sticky header stays at the top of the page and never covers the band;
  // the harness launcher (fixed) is hidden for the cut-outs.
  async function finalShot(page, name, selector, pad = 0) {
    await page.evaluate(() => { window.scrollTo(0, 0); const l = document.querySelector('[data-harness-launcher]'); if (l) l.style.visibility = 'hidden'; });
    await page.waitForTimeout(350);
    const W = page.viewportSize().width;
    const box = await page.$eval(selector, (n) => { const r = n.getBoundingClientRect(); return { y: r.top + window.scrollY, h: r.height }; });
    const full = await page.evaluate(() => document.documentElement.scrollHeight);
    const y = Math.max(0, Math.floor(box.y - pad));
    const h = Math.min(full - y, Math.ceil(box.h + pad * 2));
    await page.screenshot({ path: path.join(FINAL, name + '.png'), fullPage: true, clip: { x: 0, y, width: W, height: h }, animations: 'disabled' });
    await page.evaluate(() => { const l = document.querySelector('[data-harness-launcher]'); if (l) l.style.visibility = ''; });
  }
  async function viewShot(page, name) {
    await page.screenshot({ path: path.join(FINAL, name + '.png'), animations: 'disabled' });
  }
  async function finalShots(W) {
    results.push('— final screenshots ' + W + ' px');
    const { ctx, page } = await open(W);
    await ready(page);
    await settle(page, 400);
    await page.screenshot({ path: path.join(FINAL, '00-page-' + W + '.png'), fullPage: true, animations: 'disabled' });
    await viewShot(page, '01-hero-' + W);
    // 1 Betrag
    await page.click('.ms-gv-amount[data-variant="' + V.v100 + '"]');
    await settle(page, 400);
    await finalShot(page, '02-schritt1-betrag-' + W, SEL.stage);
    if (W < 600) {
      await scrollTo(page, '.ms-gv-preview', 120);
      await settle(page, 700);
      await viewShot(page, '02a-mobil-leiste-' + W);
    }
    await next(page, 0);
    // 2 Motiv: Geburtstag; photo missing; photo uploaded
    await page.click('.ms-gv-design[data-design="birthday"]');
    await settle(page, 400);
    await finalShot(page, '03-schritt2-motiv-' + W, SEL.stage);
    await page.click('.ms-gv-design[data-design="photo"]');
    await settle(page, 300);
    await press(page, '[data-panel="1"] .ms-gv-btn--next');
    await settle(page, 400);
    await finalShot(page, '03a-schritt2-foto-fehlt-' + W, SEL.stage);
    const png = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 2600; c.height = 1700;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, 1700);
      g.addColorStop(0, '#f6b26b'); g.addColorStop(0.55, '#e88a74'); g.addColorStop(1, '#5d4a7a');
      x.fillStyle = g; x.fillRect(0, 0, 2600, 1700);
      x.fillStyle = '#ffe9a8'; x.beginPath(); x.arc(1750, 760, 230, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#3e3557'; x.beginPath(); x.moveTo(0, 1250); x.lineTo(700, 820); x.lineTo(1250, 1180); x.lineTo(1900, 900); x.lineTo(2600, 1300); x.lineTo(2600, 1700); x.lineTo(0, 1700); x.fill();
      x.fillStyle = '#231e33'; x.beginPath(); x.moveTo(0, 1500); x.lineTo(900, 1150); x.lineTo(1600, 1520); x.lineTo(2600, 1350); x.lineTo(2600, 1700); x.lineTo(0, 1700); x.fill();
      return c.toDataURL('image/png').split(',')[1];
    });
    await page.setInputFiles('.ms-gv-upload input[type="file"]', { name: 'sonnenuntergang.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await page.waitForSelector('.ms-gv-upload__done:not([hidden])', { timeout: 15000 });
    await settle(page, 500);
    await finalShot(page, '03b-schritt2-eigenes-foto-' + W, SEL.stage);
    await page.click('.ms-gv-design[data-design="birthday"]');
    await settle(page, 300);
    await next(page, 1);
    // 3 Text with Mo's suggestions
    await page.fill(SEL.forInput, 'Lena');
    await page.fill(SEL.fromInput, 'Jonas');
    await page.click('.ms-gv-ai__toggle');
    await page.click('.ms-gv-chip:has-text("Geburtstag")');
    await page.click('.ms-gv-ai__go');
    await page.waitForSelector('.ms-gv-sugg__use', { timeout: 10000 });
    await page.click('.ms-gv-sugg__use >> nth=0');
    await settle(page, 400);
    await page.focus(SEL.msgInput);
    await page.keyboard.press('Control+End');
    await page.keyboard.insertText(' 🎉');
    await settle(page, 400);
    await finalShot(page, '04-schritt3-text-' + W, SEL.stage);
    await next(page, 2);
    // 4 Versand: errors, then the filled address
    await page.click('.ms-gv-option >> nth=1');
    await settle(page, 400);
    await press(page, '[data-panel="3"] .ms-gv-btn--next');
    await settle(page, 400);
    await finalShot(page, '05a-schritt4-versand-fehler-' + W, SEL.stage);
    await page.fill('#' + ROOT_ID + '-addr-name', 'Lena Muster');
    await page.fill('#' + ROOT_ID + '-addr-line1', 'Musterstraße 12');
    await page.fill('#' + ROOT_ID + '-addr-postal', '80331');
    await page.fill('#' + ROOT_ID + '-addr-city', 'München');
    await page.focus('.ms-gv-option >> nth=1');
    await settle(page, 400);
    await finalShot(page, '05-schritt4-versand-' + W, SEL.stage);
    await next(page, 3);
    // 5 Prüfen & kaufen: the exact preview, then the inside
    await page.waitForSelector('.ms-gv-preview__stage.has-exact-front', { timeout: 10000 });
    await settle(page, 800);
    await finalShot(page, '06-schritt5-pruefen-' + W, SEL.stage);
    await page.click('.ms-gv-seg__btn[data-ms-gv-side="inside"]');
    await settle(page, 700);
    await finalShot(page, '06a-schritt5-innenseite-' + W, '.ms-gv-preview');
    if (W < 600) {
      await scrollTo(page, '.ms-gv-preview', 120);
      await settle(page, 700);
      await viewShot(page, '06b-mobil-leiste-kaufen-' + W);
    }
    // Back to „Motiv“ over the progress line: done steps and the next open one are clickable
    await page.click('[data-ms-gv-goto="1"]');
    await settle(page, 500);
    await finalShot(page, '07-fortschritt-zurueck-' + W, '.ms-gv-progress', 12);
    await page.click('[data-ms-gv-goto="4"]');
    await settle(page, 600);
    // „In den Warenkorb“ → drawer
    await page.check(SEL.terms);
    await page.click('.ms-gv-buy__cart');
    await page.waitForSelector('.hx-drawer.is-open', { timeout: 10000 });
    await settle(page, 600);
    await viewShot(page, '08-warenkorb-' + W);
    await page.evaluate(() => { const d = document.querySelector('.hx-drawer'); if (d) d.remove(); });
    await finalShot(page, '08a-im-warenkorb-' + W, '[data-panel="4"]', 16);
    ok(!page.errors.length, 'final ' + W + ': no script errors: ' + (page.errors.join(' | ') || 'none'));
    await ctx.close();

    // How it works + FAQ (one answer open), balance with a result
    {
      const { ctx, page } = await open(W, { query: '#guthaben' });
      await ready(page);
      await page.click('.ms-gv-faq__item >> nth=0');
      await settle(page, 300);
      await finalShot(page, '09-so-funktionierts-' + W, '.ms-gv-how');
      await finalShot(page, '09a-faq-' + W, '.ms-gv-faq');
      await page.fill('[data-ms-gv-balance-input]', 'ABCD EFGH JKLM NPQR');
      await page.click('[data-ms-gv-balance-btn]');
      await page.waitForSelector('.ms-gv-result--ok', { timeout: 5000 });
      await settle(page, 400);
      await finalShot(page, '10-guthaben-' + W, '.ms-gv-balance');
      await ctx.close();
    }
    // Fallback (Mo switched off)
    {
      const { ctx, page } = await open(W, { query: '?scenario=unavailable' });
      await page.waitForSelector(SEL.designer + '[data-state="unavailable"]', { timeout: 10000 });
      await settle(page, 400);
      await finalShot(page, '11-fallback-' + W, SEL.stage);
      await ctx.close();
    }
  }

  try {
    await purchase(1440);
    await purchase(390);
    await toCart(1440);
    await toCart(390);
    await balance(1440);
    await balance(390);
    await fallbacks(1440);
    await fallbacks(390);
    await extras();
    if (FINAL) {
      await finalShots(1440);
      await finalShots(390);
    }
  } catch (e) {
    failures++;
    results.push('  FAIL exception: ' + (e && e.stack || e));
  }
  await browser.close();
  srv.close();
  console.log(results.join('\n'));
  console.log('\n' + (failures ? failures + ' failure(s)' : 'all checks passed') + ' — screenshots in ' + OUT + (FINAL ? ' and ' + FINAL : ''));
  process.exit(failures ? 1 : 0);
})();

/*
 * Home-Gym-Konfigurator mit Mo — page logic of
 * sections/ms-home-gym-configurator.liquid (vanilla ES5, no dependencies).
 *
 * Renders the answer cards, keeps the answers (sessionStorage draft, URL
 * prefill), hands them to Mo through window.MS_CHAT.configurator (assets/
 * ms-chat-widget.js) and follows Mo's progress through the widget's
 * `ms-chat:configurator` events (stepper, profile summary). The answer ids are
 * the backend's vocabulary (mo repo: src/lib/configurator-core.mjs) — keep
 * both in sync; the personas are Mo's own customer personas (the old
 * „Ich bin …“ / „Ich will …“ ids still map, see LEGACY_PERSONA). KPI goes
 * through MS_CHAT.configurator.track (ids and enums only); the page view is
 * sent only with Shopify analytics consent.
 */
(function () {
  'use strict';

  var roots = document.querySelectorAll('[data-ms-hgk]');
  for (var r = 0; r < roots.length; r++) setup(roots[r]);

  function setup(root) {
    if (root.__msHgk) return;
    root.__msHgk = true;
    var EN = root.getAttribute('data-locale') === 'en';
    function T(de, en) { return EN ? en : de; }

    // ----- vocabulary (ids = backend configurator-core.mjs) -----------------
    var ICON = {
      target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
      pragmatic_beginner: '<circle cx="12" cy="14.5" r="6"/><path d="M8.6 9.7 8.1 7.6A2 2 0 0 1 10 5h4a2 2 0 0 1 1.9 2.6l-.5 2.1"/>',
      ambitious_home_athlete: '<path d="M6 21V3M18 21V3M4 21h4M16 21h4M3 9h18M8.5 7v4M15.5 7v4"/>',
      strength_focused: '<path d="M2 12h20"/><rect x="5" y="7" width="3" height="10" rx="1"/><rect x="16" y="7" width="3" height="10" rx="1"/>',
      cardio_focused: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/><path d="M6 12h3l1.5-2.5 2 4.5 1.5-2h4"/>',
      design_lifestyle: '<path d="M10 3.5 11.8 8.2 16.5 10l-4.7 1.8L10 16.5l-1.8-4.7L3.5 10l4.7-1.8z"/><path d="M18 14.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/>',
      weight_loss: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.2.5 1.5 1.5 2.7 3 2.7z"/>',
      house: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
      apartment: '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
      garage: '<path d="M3 21V8l9-5 9 5v13"/><path d="M7 21v-9h10v9M7 15h10M7 18h10"/>',
      xs: '<rect x="8" y="8" width="8" height="8" rx="1"/><path d="M3 3l4 4M21 3l-4 4M3 21l4-4M21 21l-4-4"/>',
      s: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
      m: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h16"/>',
      l: '<path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5"/>',
      free_weights: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
      machines: '<path d="M5 21V3h4v18M9 7h10M19 3v18M15 7v6"/><circle cx="15" cy="16" r="2"/>',
      cardio: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
      functional: '<circle cx="13" cy="4" r="2"/><path d="M4 17l4-1 2-4 4 3v5M10 12l2-4 5 2 3-2"/>',
      rookie: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6"/>',
      intermediate: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
      pro: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>'
    };
    function svg(name) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[name] || '') + '</svg>';
    }
    var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    // options: [id, title, subtitle?] — the persona order is Mo's (the URL
    // index 01–06 counts in this order).
    var FIELDS = {
      persona: { label: T('Trainingsfokus', 'Training focus'), short: T('Typ', 'Type'), multi: false, required: true, options: [
        ['pragmatic_beginner', T('Pragmatisch starten', 'Start pragmatically'), T('Kompakte Fitnesslösungen für Einsteiger und begrenzten Platz.', 'Compact fitness solutions for beginners and limited space.')],
        ['ambitious_home_athlete', T('Ambitioniert trainieren', 'Train ambitiously'), T('Facettenreiche Fitnessgeräte in Studioqualität für zu Hause.', 'Versatile studio-quality equipment for your home.')],
        ['strength_focused', T('Kraft und Muskeln aufbauen', 'Build strength and muscle'), T('Gezielt und progressiv stärker werden.', 'Get stronger, step by step.')],
        ['cardio_focused', T('Gesundheit und Ausdauer fördern', 'Boost health and endurance'), T('Fit und aktiv bleiben.', 'Stay fit and active.')],
        ['design_lifestyle', T('Design und Lifestyle leben', 'Live design and lifestyle'), T('Stilvolle Fitnessgeräte Zuhause integrieren.', 'Integrate stylish fitness equipment at home.')],
        ['weight_loss', T('Abnehmen und fit bleiben', 'Lose weight and stay fit'), T('Mit Cardiotraining das Wohlbefinden steigern.', 'Boost your well-being with cardio.')]
      ] },
      location: { label: T('Trainingsort', 'Where'), short: T('Ort', 'Where'), multi: false, required: true, options: [
        ['house', T('Haus / Keller', 'House / basement')],
        ['apartment', T('Wohnung (Mietobjekt)', 'Flat (rented)')],
        ['garage', T('Garage / Outdoor', 'Garage / outdoor')]
      ] },
      space: { label: T('Platz', 'Space'), short: T('Platz', 'Space'), multi: false, required: true, options: [
        ['xs', T('bis 6 m²', 'up to 6 m²')],
        ['s', '6–10 m²'],
        ['m', '10–20 m²'],
        ['l', T('über 20 m²', 'over 20 m²')]
      ] },
      training: { label: T('Trainingsart', 'Training style'), short: T('Training', 'Training'), multi: true, required: false, options: [
        ['free_weights', T('Freie Gewichte', 'Free weights')],
        ['machines', T('Kabelzug & Maschinen', 'Cables & machines')],
        ['cardio', 'Cardio'],
        ['functional', T('Functional & Body­weight', 'Functional & bodyweight')]
      ] },
      level: { label: T('Niveau', 'Level'), short: T('Niveau', 'Level'), multi: false, required: true, options: [
        ['rookie', T('Einsteiger:in', 'Beginner')],
        ['intermediate', T('Fortgeschritten', 'Intermediate')],
        ['pro', T('Profi', 'Advanced')]
      ] }
    };
    var FIELD_KEYS = ['persona', 'location', 'space', 'training', 'level'];
    var GROUPS = [
      { key: 'who', icon: 'target', title: T('Welcher Typ bist du?', 'What type are you?'), sub: T('Wähle deinen Trainingsfokus aus.', 'Choose your training focus.'), fields: ['persona'], seals: true },
      { key: 'where', icon: 'house', title: T('Trainingsort & Platz', 'Place & space'), sub: T('Wo und wie viel Fläche?', 'Where, and how much room?'), fields: ['location', 'space'] },
      { key: 'how', icon: 'free_weights', title: T('Training & Niveau', 'Training & level'), sub: T('Wie trainierst du am liebsten?', 'How do you like to train?'), fields: ['training', 'level'] }
    ];
    var REQUIRED = ['persona', 'location', 'space', 'level'];
    // URL parameter names → field. The persona has two strengths: its own
    // names (rank 1) beat the old goal names (rank 2) when a link has both.
    var ALIASES = {
      persona: 'persona', typ: 'persona', type: 'persona', fokus: 'persona', focus: 'persona',
      target: 'persona', ziel: 'persona', goal: 'persona',
      skills: 'level', skill: 'level', niveau: 'level',
      ort: 'location', platz: 'space'
    };
    var PERSONA_RANK = { persona: 1, typ: 1, type: 1, fokus: 1, focus: 1, target: 2, ziel: 2, goal: 2 };
    // Old persona („Ich bin …“) and goal („Ich will …“) ids → Mo's personas:
    // old links, drafts and threads keep working.
    var LEGACY_PERSONA = {
      busy: 'pragmatic_beginner',
      ambitious: 'ambitious_home_athlete',
      health: 'cardio_focused',
      family: 'pragmatic_beginner',
      best_ager: 'cardio_focused',
      muscle: 'strength_focused',
      fitness: 'weight_loss',
      endurance: 'cardio_focused',
      athletic: 'ambitious_home_athlete'
    };

    // ----- elements ----------------------------------------------------------
    var form = root.querySelector('[data-ms-hgk-form]');
    var groupsEl = root.querySelector('[data-ms-hgk-groups]');
    var cta = root.querySelector('[data-ms-hgk-cta]');
    var ctaLabel = root.querySelector('[data-ms-hgk-cta-label]');
    var cancelBtn = root.querySelector('[data-ms-hgk-cancel]');
    var hintEl = root.querySelector('[data-ms-hgk-hint]');
    var profile = root.querySelector('[data-ms-hgk-profile]');
    var chipsEl = root.querySelector('[data-ms-hgk-chips]');
    var stepsEl = root.querySelector('[data-ms-hgk-steps]');
    var dock = root.querySelector('[data-ms-chat-dock]');
    var fallbackEl = root.querySelector('[data-ms-hgk-fallback]');
    var introHint = root.querySelector('[data-ms-hgk-intro-hint]');
    if (!form || !groupsEl) return;

    // ----- small helpers -----------------------------------------------------
    function ssGet(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }
    function ssSet(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) {} }
    function api() { return window.MS_CHAT && window.MS_CHAT.configurator ? window.MS_CHAT.configurator : null; }
    function optionLabel(key, id) {
      var f = FIELDS[key];
      if (!f) return '';
      for (var i = 0; i < f.options.length; i++) if (f.options[i][0] === id) return f.options[i][1].replace(/\u00ad/g, '');
      return '';
    }
    function hasOption(key, id) { return !!optionLabel(key, id); }
    function analyticsAllowed() {
      try {
        var cp = window.Shopify && window.Shopify.customerPrivacy;
        return !!(cp && typeof cp.analyticsProcessingAllowed === 'function' && cp.analyticsProcessingAllowed() === true);
      } catch (e) { return false; }
    }
    var trackQueue = [];
    function track(event, data) {
      var a = api();
      if (a && typeof a.track === 'function') { a.track(event, data || {}); return; }
      trackQueue.push([event, data || {}]);
    }
    function flushTrack() {
      var a = api();
      if (!a) return;
      while (trackQueue.length) { var t = trackQueue.shift(); a.track(t[0], t[1]); }
    }

    // ----- partner (seal / landing page) ------------------------------------
    var partner = (function () {
      var p = null;
      try {
        var u = new URL(window.location.href);
        var q = (u.searchParams.get('partner') || '').toLowerCase();
        if (q === 'mh' || q === 'wh') p = q;
        if (!p) {
          var src = (u.searchParams.get('utm_source') || '') + ' ' + (u.searchParams.get('utm_campaign') || '');
          src = src.toLowerCase().replace(/[^a-z]/g, '');
          if (src.indexOf('womenshealth') !== -1) p = 'wh';
          else if (src.indexOf('menshealth') !== -1) p = 'mh';
        }
      } catch (e) {}
      if (p) { ssSet('ms-hgk-partner', p); return p; }
      var stored = ssGet('ms-hgk-partner');
      if (stored === 'mh' || stored === 'wh') return stored;
      var def = root.getAttribute('data-partner');
      return def === 'mh' || def === 'wh' ? def : null;
    })();
    if (partner) root.setAttribute('data-active-partner', partner);

    // ----- answers: URL prefill > draft --------------------------------------
    function emptyAnswers() {
      return { persona: null, location: null, space: null, training: [], level: null };
    }
    var answers = emptyAnswers();
    var prefilled = false;
    // One raw value (id, legacy id or 1-based position) → a known option id.
    function optionId(key, raw) {
      var f = FIELDS[key];
      var v = String(raw == null ? '' : raw).toLowerCase().replace(/^\s+|\s+$/g, '');
      if (!f || !v) return '';
      if (/^\d{1,2}$/.test(v)) { var o = f.options[parseInt(v, 10) - 1]; return o ? o[0] : ''; }
      if (key === 'persona' && LEGACY_PERSONA[v]) v = LEGACY_PERSONA[v];
      return hasOption(key, v) ? v : '';
    }
    function setFromRaw(key, raw) {
      var f = FIELDS[key];
      if (!f || raw == null) return false;
      var vals = String(raw).split(',');
      var picked = [];
      for (var i = 0; i < vals.length; i++) {
        var v = optionId(key, vals[i]);
        if (v && picked.indexOf(v) === -1) picked.push(v);
      }
      if (!picked.length) return false;
      if (f.multi) {
        answers[key] = f.options.map(function (o) { return o[0]; }).filter(function (id) { return picked.indexOf(id) !== -1; });
      } else {
        answers[key] = picked[0];
      }
      return true;
    }
    // Answers stored elsewhere (draft, the widget's thread) → this page's
    // vocabulary: unknown ids are dropped, old persona/goal ids mapped.
    function normalizeAnswers(src) {
      var out = emptyAnswers();
      if (!src || typeof src !== 'object') return out;
      var persona = optionId('persona', typeof src.persona === 'string' ? src.persona : '');
      if (!persona && typeof src.goal === 'string') persona = optionId('persona', src.goal);
      out.persona = persona || null;
      ['location', 'space', 'level'].forEach(function (k) {
        out[k] = (typeof src[k] === 'string' && optionId(k, src[k])) || null;
      });
      var list = Array.isArray(src.training) ? src.training : [];
      out.training = FIELDS.training.options.map(function (o) { return o[0]; }).filter(function (id) { return list.indexOf(id) !== -1; });
      return out;
    }
    (function () {
      try { answers = normalizeAnswers(JSON.parse(ssGet('ms-hgk-draft') || 'null')); } catch (e) { answers = emptyAnswers(); }
      try {
        var u = new URL(window.location.href);
        var personaRank = 99;
        u.searchParams.forEach(function (value, name) {
          var n = name.toLowerCase();
          var key = ALIASES[n] || n;
          if (!FIELDS[key]) return;
          if (key === 'persona') {
            var rank = PERSONA_RANK[n] || 1;
            if (rank > personaRank) return;
            if (setFromRaw(key, value)) { prefilled = true; personaRank = rank; }
            return;
          }
          if (setFromRaw(key, value)) prefilled = true;
        });
      } catch (e) {}
    })();
    function saveDraft() { ssSet('ms-hgk-draft', JSON.stringify(answers)); }

    // ----- render the cards ---------------------------------------------------
    // The partner seals, small, in the header of the persona card (only when
    // uploaded: the section renders them into a <template>).
    function smallSeals() {
      var tpl = root.querySelector('template[data-ms-hgk-seals-small]');
      if (!tpl) return null;
      var box = document.createElement('span');
      box.className = 'ms-hgk-card__seals';
      if (tpl.content) box.appendChild(tpl.content.cloneNode(true));
      else box.innerHTML = tpl.innerHTML;
      return box.querySelector('img') ? box : null;
    }
    var optButtons = {};
    groupsEl.innerHTML = '';
    GROUPS.forEach(function (g) {
      var card = document.createElement('div');
      card.className = 'ms-hgk-card ms-hgk-card--' + g.key;
      card.setAttribute('data-group', g.key);
      var head = document.createElement('div');
      head.className = 'ms-hgk-card__head';
      head.innerHTML = '<span class="ms-hgk-card__icon">' + svg(g.icon) + '</span>';
      var titles = document.createElement('div');
      titles.className = 'ms-hgk-card__titles';
      var h = document.createElement('h3');
      h.className = 'ms-hgk-card__title';
      h.textContent = g.title;
      var sub = document.createElement('p');
      sub.className = 'ms-hgk-card__sub';
      sub.textContent = g.sub;
      titles.appendChild(h);
      titles.appendChild(sub);
      head.appendChild(titles);
      var seals = g.seals ? smallSeals() : null;
      if (seals) head.appendChild(seals);
      var done = document.createElement('span');
      done.className = 'ms-hgk-card__done';
      done.innerHTML = CHECK;
      head.appendChild(done);
      card.appendChild(head);
      g.fields.forEach(function (key) {
        var f = FIELDS[key];
        var fs = document.createElement('fieldset');
        fs.className = 'ms-hgk-field';
        var lg = document.createElement('legend');
        lg.className = 'ms-hgk-field__label';
        if (g.fields.length > 1) {
          lg.textContent = f.label;
          if (f.multi) {
            var sm = document.createElement('small');
            sm.textContent = T(' · Mehrfachauswahl', ' · pick several');
            lg.appendChild(sm);
          }
        } else {
          lg.className += ' ms-hgk-sr';
          lg.textContent = g.title;
        }
        fs.appendChild(lg);
        var grid = document.createElement('div');
        grid.className = 'ms-hgk-opts ms-hgk-opts--' + (key === 'persona' ? 'persona' : f.options.length + (key === 'training' ? ' ms-hgk-opts--compact' : ''));
        optButtons[key] = [];
        f.options.forEach(function (o) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'ms-hgk-opt' + (o[2] ? ' ms-hgk-opt--rich' : '');
          b.setAttribute('aria-pressed', 'false');
          b.setAttribute('data-field', key);
          b.setAttribute('data-value', o[0]);
          b.innerHTML = svg(o[0]);
          var text = document.createElement('span');
          text.className = 'ms-hgk-opt__text';
          var title = document.createElement('span');
          title.className = 'ms-hgk-opt__title';
          title.textContent = o[1];
          text.appendChild(title);
          if (o[2]) {
            var desc = document.createElement('span');
            desc.className = 'ms-hgk-opt__sub';
            desc.textContent = o[2];
            text.appendChild(desc);
          }
          b.appendChild(text);
          b.addEventListener('click', function () { choose(key, o[0]); });
          optButtons[key].push(b);
          grid.appendChild(b);
        });
        fs.appendChild(grid);
        card.appendChild(fs);
      });
      groupsEl.appendChild(card);
    });

    // configurator_started: once per configurator run — the first answer picked,
    // or the handover itself when the answers came prefilled from the link.
    // „Neu starten“ begins a new run (reset() clears the flag).
    var startedTracked = false;
    function trackStarted() {
      if (startedTracked || ssGet('ms-hgk-started') === '1') return;
      startedTracked = true;
      ssSet('ms-hgk-started', '1');
      track('configurator_started', { partner: partner || '', prefilled: prefilled });
    }
    function choose(key, value) {
      var f = FIELDS[key];
      if (f.multi) {
        var list = answers[key].slice();
        var i = list.indexOf(value);
        if (i === -1) list.push(value); else list.splice(i, 1);
        answers[key] = f.options.map(function (o) { return o[0]; }).filter(function (id) { return list.indexOf(id) !== -1; });
      } else {
        answers[key] = answers[key] === value ? null : value;
      }
      saveDraft();
      paint();
      trackStarted();
    }

    function missing() {
      return REQUIRED.filter(function (k) { return !answers[k]; });
    }

    var mode = 'start'; // start | live | edit
    var sentAnswers = null;

    function paint() {
      var k, i;
      for (k in optButtons) {
        if (!Object.prototype.hasOwnProperty.call(optButtons, k)) continue;
        for (i = 0; i < optButtons[k].length; i++) {
          var b = optButtons[k][i];
          var v = b.getAttribute('data-value');
          var on = FIELDS[k].multi ? answers[k].indexOf(v) !== -1 : answers[k] === v;
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        }
      }
      GROUPS.forEach(function (g) {
        var card = groupsEl.querySelector('[data-group="' + g.key + '"]');
        var complete = g.fields.every(function (fk) { return FIELDS[fk].multi ? answers[fk].length > 0 || !FIELDS[fk].required : !!answers[fk]; });
        if (card) card.classList.toggle('is-complete', complete);
      });
      var miss = missing();
      var ready = !miss.length && mode !== 'unavailable';
      if (mode === 'edit') ready = !miss.length && changedFields().length > 0;
      cta.disabled = !ready;
      if (mode === 'edit') {
        hintEl.textContent = !changedFields().length ? T('Ändere eine Angabe – Mo passt die Empfehlung an.', 'Change an answer – Mo adapts the recommendation.') : '';
      } else if (mode === 'unavailable') {
        hintEl.textContent = T('Mo ist gerade nicht erreichbar.', 'Mo is not available right now.');
      } else if (miss.length) {
        hintEl.textContent = T('Noch offen: ', 'Still open: ') + miss.map(function (m) { return FIELDS[m].short; }).join(', ');
      } else {
        hintEl.textContent = T('Perfekt – Mo übernimmt ab hier.', 'Perfect – Mo takes it from here.');
      }
    }

    function changedFields() {
      if (!sentAnswers) return [];
      var out = [];
      FIELD_KEYS.forEach(function (k) {
        var a = FIELDS[k].multi ? answers[k].join(',') : (answers[k] || '');
        var b = FIELDS[k].multi ? (sentAnswers[k] || []).join(',') : (sentAnswers[k] || '');
        if (a !== b) out.push(k);
      });
      return out;
    }

    function payload() {
      return {
        persona: answers.persona,
        location: answers.location,
        space: answers.space,
        training: answers.training.slice(),
        level: answers.level
      };
    }

    // ----- stepper + profile -------------------------------------------------
    var STEPS = ['start', 'questions', 'plan', 'cart'];
    function setStep(stage) {
      var idx = STEPS.indexOf(stage);
      if (idx === -1) return;
      var items = stepsEl ? stepsEl.querySelectorAll('[data-step]') : [];
      for (var i = 0; i < items.length; i++) {
        var si = STEPS.indexOf(items[i].getAttribute('data-step'));
        items[i].classList.toggle('is-done', si < idx || (stage === 'cart' && si === idx));
        items[i].classList.toggle('is-current', si === idx && stage !== 'cart');
        if (si === idx) items[i].setAttribute('aria-current', 'step'); else items[i].removeAttribute('aria-current');
      }
    }
    var extras = {}; // topic -> answer text from Mo's chips (budget / wishes)
    function renderProfile() {
      chipsEl.innerHTML = '';
      function chip(iconName, text, mo) {
        var li = document.createElement('li');
        li.className = 'ms-hgk-chip' + (mo ? ' ms-hgk-chip--mo' : '');
        li.innerHTML = iconName ? svg(iconName) : '';
        var s = document.createElement('span');
        s.textContent = text;
        li.appendChild(s);
        chipsEl.appendChild(li);
      }
      ['persona', 'location', 'space', 'level'].forEach(function (k) {
        if (answers[k]) chip(answers[k], optionLabel(k, answers[k]));
      });
      answers.training.forEach(function (id) { chip(id, optionLabel('training', id)); });
      if (extras.budget) chip(null, T('Budget: ', 'Budget: ') + extras.budget, true);
      if (extras.wishes) chip(null, T('Wünsche: ', 'Wishes: ') + extras.wishes, true);
    }

    function setMode(next) {
      mode = next;
      var live = next === 'live';
      form.hidden = live;
      profile.hidden = !live;
      cancelBtn.hidden = next !== 'edit';
      ctaLabel.textContent = next === 'edit'
        ? T('Änderungen an Mo senden', 'Send changes to Mo')
        : T('Weiter – Mo berät mich', 'Next – Mo advises me');
      if (live) renderProfile();
      paint();
    }

    // ----- handover ------------------------------------------------------------
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (cta.disabled) return;
      var a = api();
      if (!a) { showUnavailable(); return; }
      if (mode === 'edit') {
        var changed = changedFields();
        var parts = changed.map(function (k) {
          var text = FIELDS[k].multi
            ? answers[k].map(function (id) { return optionLabel(k, id); }).join(', ') || T('keine Angabe', 'none')
            : optionLabel(k, answers[k]);
          return FIELDS[k].label + ': ' + text;
        });
        var msg = T('Ich habe meine Angaben geändert – ', 'I changed my answers – ') + parts.join('; ') + T('. Bitte passe deine Empfehlung an.', '. Please adapt your recommendation.');
        if (!a.update(payload(), msg)) {
          hintEl.textContent = T('Mo antwortet gerade – bitte gleich nochmal.', 'Mo is replying – please try again in a moment.');
          return;
        }
        track('configurator_answers_changed', { fields: changed.join(',') });
        sentAnswers = JSON.parse(JSON.stringify(answers));
        setMode('live');
        showDock();
        return;
      }
      trackStarted();
      if (!a.start(payload(), { partner: partner, prefilled: prefilled })) {
        hintEl.textContent = T('Mo ist gerade ausgelastet – bitte in ein paar Sekunden nochmal.', 'Mo is busy – please try again in a few seconds.');
        return;
      }
      sentAnswers = JSON.parse(JSON.stringify(answers));
      extras = {};
      setMode('live');
      setStep('questions');
      showDock();
    });
    cancelBtn.addEventListener('click', function () {
      if (sentAnswers) { answers = JSON.parse(JSON.stringify(sentAnswers)); saveDraft(); }
      setMode('live');
      showDock();
    });
    // Hiding the long form shortens the page above the visitor's scroll
    // position, so at every width Mo would end up above the viewport. Bring
    // the dock to its resting place below the sticky header (scroll-margin-top
    // in the CSS; it is the header height + 16 px) unless it is already fully
    // in view. The delay lets the widget switch the dock to its live height.
    function showDock() {
      if (!dock) return;
      setTimeout(function () {
        try {
          var r = dock.getBoundingClientRect();
          var margin = parseFloat(window.getComputedStyle(dock).scrollMarginTop) || 0;
          var vh = window.innerHeight || document.documentElement.clientHeight;
          if (r.top >= margin - 16 && r.bottom <= vh) return;
          dock.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
        } catch (err) {}
      }, 120);
    }
    root.querySelector('[data-ms-hgk-edit]').addEventListener('click', function () {
      setMode('edit');
      try { form.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }); } catch (e) {}
    });
    root.querySelector('[data-ms-hgk-restart]').addEventListener('click', function () {
      var a = api();
      if (a) a.restart();
      else reset();
    });

    function reset() {
      startedTracked = false;
      ssSet('ms-hgk-started', '0');
      sentAnswers = null;
      extras = {};
      setMode('start');
      setStep('start');
    }
    function reducedMotion() {
      try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }

    // ----- widget events ---------------------------------------------------------
    document.addEventListener('ms-chat:configurator', function (e) {
      var d = (e && e.detail) || {};
      switch (d.type) {
        case 'ready':
          clearTimeout(unavailableTimer);
          // No configurator thread to restore: whatever ran before (in this tab,
          // maybe ended on another page) is over — the next start is a new run.
          startedTracked = false;
          ssSet('ms-hgk-started', '0');
          flushTrack();
          trackView();
          break;
        case 'restored':
          clearTimeout(unavailableTimer);
          flushTrack();
          trackView();
          if (d.answers) {
            answers = normalizeAnswers(d.answers);
            if (d.partner === 'mh' || d.partner === 'wh') { partner = d.partner; root.setAttribute('data-active-partner', partner); }
            saveDraft();
            sentAnswers = JSON.parse(JSON.stringify(answers));
            setMode('live');
          }
          setStep(d.stage || 'questions');
          break;
        case 'started':
          setStep('questions');
          break;
        case 'stage':
          if (d.stage) setStep(d.stage);
          break;
        case 'reply':
          if ((d.topic === 'budget' || d.topic === 'wishes') && d.values && d.values.length) {
            extras[d.topic] = d.values.join(', ');
            if (mode === 'live') renderProfile();
          }
          break;
        case 'reset':
          reset();
          break;
      }
    });

    // Widget missing (Mo switched off, script blocked, secret empty): say so
    // instead of a dead button.
    var unavailableTimer = null;
    function showUnavailable() {
      mode = mode === 'start' ? 'unavailable' : mode;
      if (fallbackEl) fallbackEl.hidden = false;
      if (introHint) introHint.hidden = true;
      paint();
    }
    if (root.getAttribute('data-mo') !== 'on') showUnavailable();
    else if (!api()) unavailableTimer = setTimeout(function () { if (!api()) showUnavailable(); }, 8000);

    // Page view — only with analytics consent, once per tab session.
    var viewTracked = false;
    function trackView() {
      if (viewTracked || ssGet('ms-hgk-viewed') === '1' || !analyticsAllowed()) return;
      viewTracked = true;
      ssSet('ms-hgk-viewed', '1');
      track('configurator_viewed', { partner: partner || '' });
    }
    try { document.addEventListener('visitorConsentCollected', trackView); } catch (e) {}

    // Sticky offset below the theme's sticky header.
    function measureHeader() {
      try {
        var h = document.querySelector('sticky-header') || document.querySelector('.section-header');
        var px = h ? Math.round(h.getBoundingClientRect().height) : 0;
        if (px > 40 && px < 260) root.style.setProperty('--hgk-sticky-top', (px + 16) + 'px');
      } catch (e) {}
    }
    measureHeader();
    window.addEventListener('resize', measureHeader);

    // The hero headline stays on ONE line from 990 px up (CSS: nowrap + a size
    // that fits the default text). A longer text from the theme editor is
    // scaled down to the column instead of running out of it.
    var heroTitle = root.querySelector('.ms-hgk-hero__title');
    function fitTitle() {
      if (!heroTitle) return;
      heroTitle.style.fontSize = '';
      try {
        if (!window.matchMedia('(min-width: 990px)').matches) return;
        var avail = heroTitle.parentNode.clientWidth;
        var need = heroTitle.scrollWidth;
        if (!avail || need <= avail) return;
        var size = parseFloat(window.getComputedStyle(heroTitle).fontSize) || 0;
        if (size) heroTitle.style.fontSize = Math.max(24, Math.floor(size * avail / need * 0.98)) + 'px';
      } catch (e) {}
    }
    fitTitle();
    var fitTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(fitTimer);
      fitTimer = setTimeout(fitTitle, 80);
    });
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTitle); } catch (e) {}

    // Smooth in-page links of the hero.
    var links = root.querySelectorAll('[data-ms-hgk-scroll]');
    for (var li = 0; li < links.length; li++) {
      links[li].addEventListener('click', function (e) {
        var id = (this.getAttribute('href') || '').replace(/^#/, '');
        var target = id && document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        try { target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }); } catch (err) { target.scrollIntoView(); }
      });
    }

    // The widget may have booted before this script (state() answers then).
    var already = api() && api().state ? api().state() : null;
    if (already && already.answers) {
      answers = normalizeAnswers(already.answers);
      sentAnswers = JSON.parse(JSON.stringify(answers));
      setMode('live');
      setStep(already.stage || 'questions');
    } else {
      setMode('start');
      setStep('start');
    }
    if (api()) { flushTrack(); trackView(); }
  }
})();

/*
 * Home-Gym-Konfigurator mit Mo — page logic of
 * sections/ms-home-gym-configurator.liquid (vanilla ES5, no dependencies).
 *
 * Renders the answer cards, keeps the answers (sessionStorage draft, URL
 * prefill), hands them to Mo through window.MS_CHAT.configurator (assets/
 * ms-chat-widget.js) and follows Mo's progress through the widget's
 * `ms-chat:configurator` events (stepper, profile summary). The answer ids are
 * the backend's vocabulary (mo repo: src/lib/configurator-core.mjs) — keep
 * both in sync. KPI goes through MS_CHAT.configurator.track (ids and enums
 * only); the page view is sent only with Shopify analytics consent.
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
      busy: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
      ambitious: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
      health: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
      family: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
      best_ager: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
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
      pro: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
      muscle: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
      fitness: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.2.5 1.5 1.5 2.7 3 2.7z"/>',
      goal_health: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12h6M12 9v6"/>',
      endurance: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
      athletic: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>'
    };
    function svg(name) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[name] || '') + '</svg>';
    }
    var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    var FIELDS = {
      persona: { label: T('Ich bin', 'I am'), short: T('Ich bin', 'I am'), multi: false, required: true, options: [
        ['busy', T('Berufstätig & wenig Zeit', 'Busy, little time')],
        ['ambitious', T('Sportlich ambitioniert', 'Ambitious')],
        ['health', T('Gesundheits­bewusst', 'Health-conscious')],
        ['family', T('Zu zweit / Familie', 'Couple / family')],
        ['best_ager', T('Aktiv mit 50+', 'Active at 50+')]
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
      ] },
      goal: { label: T('Ich will', 'I want to'), short: T('Ziel', 'Goal'), multi: false, required: true, options: [
        ['muscle', T('Muskeln & Kraft aufbauen', 'Build muscle & strength')],
        ['fitness', T('Fitter werden & abnehmen', 'Get fitter & lose weight')],
        ['health', T('Rücken & Gesundheit stärken', 'Strengthen back & health')],
        ['endurance', T('Ausdauer steigern', 'Improve endurance')],
        ['athletic', T('Athletik & Performance', 'Athleticism & performance')]
      ] }
    };
    var ICON_FOR = { goal: { health: 'goal_health' } };
    var GROUPS = [
      { key: 'who', icon: 'family', title: T('Ich bin …', 'I am …'), sub: T('Wer trainiert?', 'Who is training?'), fields: ['persona'] },
      { key: 'where', icon: 'house', title: T('Trainingsort & Platz', 'Place & space'), sub: T('Wo und wie viel Fläche?', 'Where, and how much room?'), fields: ['location', 'space'] },
      { key: 'how', icon: 'free_weights', title: T('Training & Niveau', 'Training & level'), sub: T('Wie trainierst du am liebsten?', 'How do you like to train?'), fields: ['training', 'level'] },
      { key: 'goal', icon: 'athletic', title: T('Ich will …', 'I want to …'), sub: T('Was ist dir am wichtigsten?', 'What matters most?'), fields: ['goal'] }
    ];
    var REQUIRED = ['persona', 'location', 'space', 'level', 'goal'];
    var ALIASES = { target: 'goal', ziel: 'goal', skills: 'level', skill: 'level', niveau: 'level', ort: 'location', platz: 'space', typ: 'persona' };

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
      for (var i = 0; i < f.options.length; i++) if (f.options[i][0] === id) return f.options[i][1].replace(/­/g, '');
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
    var answers = { persona: null, location: null, space: null, training: [], level: null, goal: null };
    var prefilled = false;
    function setFromRaw(key, raw) {
      var f = FIELDS[key];
      if (!f || raw == null) return false;
      var vals = String(raw).toLowerCase().split(',');
      var picked = [];
      for (var i = 0; i < vals.length; i++) {
        var v = vals[i].trim();
        if (/^\d{1,2}$/.test(v)) { var o = f.options[parseInt(v, 10) - 1]; v = o ? o[0] : ''; }
        if (v && hasOption(key, v) && picked.indexOf(v) === -1) picked.push(v);
      }
      if (!picked.length) return false;
      if (f.multi) answers[key] = picked; else answers[key] = picked[0];
      return true;
    }
    (function () {
      try {
        var draft = JSON.parse(ssGet('ms-hgk-draft') || 'null');
        if (draft && typeof draft === 'object') {
          for (var k in answers) {
            if (!Object.prototype.hasOwnProperty.call(answers, k)) continue;
            if (FIELDS[k].multi && Array.isArray(draft[k])) setFromRaw(k, draft[k].join(','));
            else if (typeof draft[k] === 'string') setFromRaw(k, draft[k]);
          }
        }
      } catch (e) {}
      try {
        var u = new URL(window.location.href);
        u.searchParams.forEach(function (value, name) {
          var key = ALIASES[name.toLowerCase()] || name.toLowerCase();
          if (FIELDS[key] && setFromRaw(key, value)) prefilled = true;
        });
      } catch (e) {}
    })();
    function saveDraft() { ssSet('ms-hgk-draft', JSON.stringify(answers)); }

    // ----- render the cards ---------------------------------------------------
    var optButtons = {};
    groupsEl.innerHTML = '';
    GROUPS.forEach(function (g) {
      var card = document.createElement('div');
      card.className = 'ms-hgk-card';
      card.setAttribute('data-group', g.key);
      var head = document.createElement('div');
      head.className = 'ms-hgk-card__head';
      head.innerHTML = '<span class="ms-hgk-card__icon">' + svg(g.icon) + '</span>';
      var titles = document.createElement('div');
      var h = document.createElement('h3');
      h.className = 'ms-hgk-card__title';
      h.textContent = g.title;
      var sub = document.createElement('p');
      sub.className = 'ms-hgk-card__sub';
      sub.textContent = g.sub;
      titles.appendChild(h);
      titles.appendChild(sub);
      head.appendChild(titles);
      var done = document.createElement('span');
      done.className = 'ms-hgk-card__done';
      done.innerHTML = CHECK;
      head.appendChild(done);
      card.appendChild(head);
      g.fields.forEach(function (key) {
        var f = FIELDS[key];
        var fs = document.createElement('fieldset');
        fs.className = 'ms-hgk-field';
        if (g.fields.length > 1) {
          var lg = document.createElement('legend');
          lg.className = 'ms-hgk-field__label';
          lg.textContent = f.label;
          if (f.multi) {
            var sm = document.createElement('small');
            sm.textContent = T(' · Mehrfachauswahl', ' · pick several');
            lg.appendChild(sm);
          }
          fs.appendChild(lg);
        } else {
          var lgh = document.createElement('legend');
          lgh.className = 'ms-hgk-field__label';
          lgh.style.position = 'absolute';
          lgh.style.width = '1px';
          lgh.style.height = '1px';
          lgh.style.overflow = 'hidden';
          lgh.style.clip = 'rect(0 0 0 0)';
          lgh.textContent = g.title;
          fs.appendChild(lgh);
        }
        var grid = document.createElement('div');
        grid.className = 'ms-hgk-opts ms-hgk-opts--' + f.options.length + (key === 'goal' || key === 'training' ? ' ms-hgk-opts--compact' : '');
        optButtons[key] = [];
        f.options.forEach(function (o) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'ms-hgk-opt';
          b.setAttribute('aria-pressed', 'false');
          b.setAttribute('data-field', key);
          b.setAttribute('data-value', o[0]);
          var iconName = (ICON_FOR[key] && ICON_FOR[key][o[0]]) || o[0];
          b.innerHTML = svg(iconName);
          var span = document.createElement('span');
          span.textContent = o[1];
          b.appendChild(span);
          b.addEventListener('click', function () { choose(key, o[0]); });
          optButtons[key].push(b);
          grid.appendChild(b);
        });
        fs.appendChild(grid);
        card.appendChild(fs);
      });
      groupsEl.appendChild(card);
    });

    var startedTracked = false;
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
      if (!startedTracked && ssGet('ms-hgk-started') !== '1') {
        startedTracked = true;
        ssSet('ms-hgk-started', '1');
        track('configurator_started', { partner: partner || '', prefilled: prefilled });
      }
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
      for (var k in answers) {
        if (!Object.prototype.hasOwnProperty.call(answers, k)) continue;
        var a = FIELDS[k].multi ? answers[k].join(',') : (answers[k] || '');
        var b = FIELDS[k].multi ? (sentAnswers[k] || []).join(',') : (sentAnswers[k] || '');
        if (a !== b) out.push(k);
      }
      return out;
    }

    function payload() {
      return {
        persona: answers.persona,
        location: answers.location,
        space: answers.space,
        training: answers.training.slice(),
        level: answers.level,
        goal: answers.goal
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
      ['persona', 'location', 'space', 'level', 'goal'].forEach(function (k) {
        if (answers[k]) chip((ICON_FOR[k] && ICON_FOR[k][answers[k]]) || answers[k], optionLabel(k, answers[k]));
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
        return;
      }
      if (!a.start(payload(), { partner: partner, prefilled: prefilled })) {
        hintEl.textContent = T('Mo ist gerade ausgelastet – bitte in ein paar Sekunden nochmal.', 'Mo is busy – please try again in a few seconds.');
        return;
      }
      sentAnswers = JSON.parse(JSON.stringify(answers));
      extras = {};
      setMode('live');
      setStep('questions');
      if (window.matchMedia && window.matchMedia('(max-width: 989px)').matches && dock) {
        setTimeout(function () {
          try { dock.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }); } catch (err) {}
        }, 120);
      }
    });
    cancelBtn.addEventListener('click', function () {
      if (sentAnswers) { answers = JSON.parse(JSON.stringify(sentAnswers)); saveDraft(); }
      setMode('live');
    });
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
          flushTrack();
          trackView();
          break;
        case 'restored':
          clearTimeout(unavailableTimer);
          flushTrack();
          trackView();
          if (d.answers) {
            answers = { persona: d.answers.persona || null, location: d.answers.location || null, space: d.answers.space || null, training: (d.answers.training || []).slice(), level: d.answers.level || null, goal: d.answers.goal || null };
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
      answers = { persona: already.answers.persona || null, location: already.answers.location || null, space: already.answers.space || null, training: (already.answers.training || []).slice(), level: already.answers.level || null, goal: already.answers.goal || null };
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

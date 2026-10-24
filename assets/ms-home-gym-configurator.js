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
 *
 * Missing answers: „Weiter – Mo berät mich“ stays clickable (aria-disabled,
 * the disabled look); a click outlines every card with an open answer, shows
 * the line at the field and moves to the first one. Konfigurator-Rabatt: the
 * backend's offer (GET /api/configurator/offer, switched off by default) as a
 * pop-up once per browser and code, then a banner above the plan.
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
    var ALERT = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5v5.5M12 16.5v.01" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

    // options: [id, title, subtitle?] — the persona order is Mo's (the URL
    // index 01–06 counts in this order). „|“ in a persona title is its line
    // break on the tiles (every title on two lines); labels elsewhere read it
    // as a space (optionLabel). The subtitles are the backend's (Mo reads
    // them too): mo repo, src/lib/configurator-core.mjs.
    var FIELDS = {
      persona: { label: T('Trainingsfokus', 'Training focus'), short: T('Typ', 'Type'), multi: false, required: true, error: T('Bitte wähle deinen Trainingsfokus aus.', 'Please choose your training focus.'), options: [
        ['pragmatic_beginner', T('Pragmatisch|starten', 'Start|pragmatically'), T('Platzsparende Fitnesslösungen für den optimalen Einstieg.', 'Space-saving fitness solutions for the ideal start.')],
        ['ambitious_home_athlete', T('Ambitioniert|trainieren', 'Train|ambitiously'), T('Vielseitige Fitnessgeräte in erstklassiger Qualität.', 'Versatile fitness equipment in first-class quality.')],
        ['strength_focused', T('Kraft und Muskeln|aufbauen', 'Build strength|and muscle'), T('Stärke gezielt und progressiv weiterentwickeln.', 'Develop your strength in a targeted, progressive way.')],
        ['cardio_focused', T('Gesundheit und|Ausdauer fördern', 'Boost health|and endurance'), T('Langfristig fit, gesund und aktiv bleiben.', 'Stay fit, healthy and active for the long term.')],
        ['design_lifestyle', T('Design und|Lifestyle leben', 'Live design|and lifestyle'), T('Stilvolle Fitnessgeräte Zuhause integrieren.', 'Integrate stylish fitness equipment at home.')],
        ['weight_loss', T('Abnehmen und fit|bleiben', 'Lose weight|and stay fit'), T('Mit Cardiotraining das Wohlbefinden steigern.', 'Boost your well-being with cardio.')]
      ] },
      location: { label: T('Trainingsort', 'Where'), short: T('Ort', 'Where'), multi: false, required: true, error: T('Bitte wähle deinen Trainingsort aus.', 'Please choose where you train.'), options: [
        ['house', T('Haus / Keller', 'House / basement')],
        ['apartment', T('Wohnung (Mietobjekt)', 'Flat (rented)')],
        ['garage', T('Garage / Outdoor', 'Garage / outdoor')]
      ] },
      space: { label: T('Platz', 'Space'), short: T('Platz', 'Space'), multi: false, required: true, error: T('Bitte wähle deine Fläche aus.', 'Please choose your space.'), options: [
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
      level: { label: T('Niveau', 'Level'), short: T('Niveau', 'Level'), multi: false, required: true, error: T('Bitte wähle dein Niveau aus.', 'Please choose your level.'), options: [
        ['rookie', T('Einsteiger:in', 'Beginner')],
        ['intermediate', T('Fortgeschritten', 'Intermediate')],
        ['pro', T('Profi', 'Advanced')]
      ] }
    };
    var FIELD_KEYS = ['persona', 'location', 'space', 'training', 'level'];
    // step: the card's badge „SCHRITT 01“ (colour per step in the CSS).
    var GROUPS = [
      { key: 'who', step: '01', title: T('Welcher Typ bist du?', 'What type are you?'), sub: T('Wähle deinen Trainingsfokus aus.', 'Choose your training focus.'), fields: ['persona'], seals: true },
      { key: 'where', step: '02', title: T('Trainingsort & Platz', 'Place & space'), sub: T('Wo und wie viel Fläche?', 'Where, and how much room?'), fields: ['location', 'space'] },
      { key: 'how', step: '03', title: T('Training & Niveau', 'Training & level'), sub: T('Wie trainierst du am liebsten?', 'How do you like to train?'), fields: ['training', 'level'] }
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
    var planHost = root.querySelector('[data-ms-chat-plan]');
    if (!form || !groupsEl) return;
    var uid = root.id || 'ms-hgk';

    // ----- small helpers -----------------------------------------------------
    function ssGet(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }
    function ssSet(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) {} }
    function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
    function api() { return window.MS_CHAT && window.MS_CHAT.configurator ? window.MS_CHAT.configurator : null; }
    function optionLabel(key, id) {
      var f = FIELDS[key];
      if (!f) return '';
      for (var i = 0; i < f.options.length; i++) if (f.options[i][0] === id) return f.options[i][1].replace(/\u00ad/g, '').replace(/\s*\|\s*/g, ' ');
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
    var cardEls = {};   // group key -> card
    var fieldEls = {};  // field key -> fieldset
    var errEls = {};    // field key -> its error line („Bitte wähle …“)
    groupsEl.innerHTML = '';
    GROUPS.forEach(function (g) {
      var card = document.createElement('div');
      card.className = 'ms-hgk-card ms-hgk-card--' + g.key;
      card.setAttribute('data-group', g.key);
      cardEls[g.key] = card;
      var head = document.createElement('div');
      head.className = 'ms-hgk-card__head';
      // The step badge („SCHRITT“ + „01“); the done tick sits on its corner.
      var badge = document.createElement('span');
      badge.className = 'ms-hgk-card__badge ms-hgk-card__badge--' + g.step;
      badge.innerHTML = '<span class="ms-hgk-card__badge-label">' + T('Schritt', 'Step') + '</span><span class="ms-hgk-card__badge-num">' + g.step + '</span>';
      head.appendChild(badge);
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
      if (seals) {
        head.appendChild(seals);
        card.className += ' ms-hgk-card--seals';
      }
      var done = document.createElement('span');
      done.className = 'ms-hgk-card__done';
      done.innerHTML = CHECK;
      badge.appendChild(done);
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
        fieldEls[key] = fs;
        // The line under the label, shown after a click on „Weiter“ while the
        // answer is open (aria-describedby of the fieldset then).
        if (f.required && f.error) {
          var err = document.createElement('p');
          err.className = 'ms-hgk-field__error';
          err.id = uid + '-err-' + key;
          err.hidden = true;
          err.innerHTML = ALERT;
          var errText = document.createElement('span');
          errText.textContent = f.error;
          err.appendChild(errText);
          fs.appendChild(err);
          errEls[key] = err;
        }
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
          // „Pragmatisch|starten“ → two lines; the space keeps the words apart
          // where the break is hidden (one tile per row on phones).
          o[1].split('|').forEach(function (part, i) {
            if (i) {
              title.appendChild(document.createTextNode(' '));
              var br = document.createElement('br');
              br.className = 'ms-hgk-opt__br';
              title.appendChild(br);
            }
            title.appendChild(document.createTextNode(part));
          });
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

    var mode = 'start'; // start | live | edit | unavailable
    var sentAnswers = null;
    // Fields that were open at the last blocked click and are still open: their
    // card is outlined, their line shown. Answering removes a field; only the
    // next click adds fields again.
    var flagged = {};
    function answered(k) { return FIELDS[k].multi ? answers[k].length > 0 : !!answers[k]; }

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
      var changed = mode === 'edit' ? changedFields().length : 0;
      // `disabled` only where a click has nothing to show: Mo unavailable, or
      // the edit mode before an answer changed. Open answers keep the button
      // clickable (aria-disabled, same look) — the click marks them.
      var off = mode === 'unavailable' || (mode === 'edit' && !miss.length && !changed);
      cta.disabled = off;
      if (!off && miss.length) cta.setAttribute('aria-disabled', 'true');
      else cta.removeAttribute('aria-disabled');
      if (mode === 'unavailable') {
        hintEl.textContent = T('Mo ist gerade nicht erreichbar.', 'Mo is not available right now.');
      } else if (miss.length) {
        hintEl.textContent = T('Noch offen: ', 'Still open: ') + miss.map(function (m) { return FIELDS[m].short; }).join(', ');
      } else if (mode === 'edit') {
        hintEl.textContent = !changed ? T('Ändere eine Angabe – Mo passt die Empfehlung an.', 'Change an answer – Mo adapts the recommendation.') : '';
      } else {
        hintEl.textContent = T('Perfekt – Mo übernimmt ab hier.', 'Perfect – Mo takes it from here.');
      }
      paintErrors();
    }

    function paintErrors() {
      FIELD_KEYS.forEach(function (k) {
        if (flagged[k] && answered(k)) delete flagged[k];
        var on = !!flagged[k];
        var err = errEls[k];
        var fs = fieldEls[k];
        if (err) err.hidden = !on;
        if (!fs) return;
        if (on && err) {
          fs.setAttribute('aria-invalid', 'true');
          fs.setAttribute('aria-describedby', err.id);
        } else {
          fs.removeAttribute('aria-invalid');
          fs.removeAttribute('aria-describedby');
        }
      });
      GROUPS.forEach(function (g) {
        var bad = g.fields.some(function (k) { return !!flagged[k]; });
        if (cardEls[g.key]) cardEls[g.key].classList.toggle('is-invalid', bad);
      });
    }

    // A click on „Weiter“ with open answers: outline their cards, show the
    // lines, announce them once (one alert per click, not one per field), move
    // to the first open card (below the sticky header) and focus its first
    // option.
    var alertEl = document.createElement('p');
    alertEl.className = 'ms-hgk-sr';
    alertEl.setAttribute('role', 'alert');
    form.appendChild(alertEl);
    var alertTimer = null;
    hintEl.id = hintEl.id || uid + '-hint';
    cta.setAttribute('aria-describedby', hintEl.id);
    function blockMissing() {
      var miss = missing();
      flagged = {};
      miss.forEach(function (k) { flagged[k] = true; });
      paint();
      clearTimeout(alertTimer);
      alertEl.textContent = '';
      var msg = miss.map(function (k) { return FIELDS[k].error; }).join(' ');
      alertTimer = setTimeout(function () { alertEl.textContent = msg; }, 60);
      track('configurator_validation_blocked', { fields: miss.join(',') });
      var card = null;
      var target = null;
      for (var i = 0; i < GROUPS.length && !target; i++) {
        for (var j = 0; j < GROUPS[i].fields.length; j++) {
          var k = GROUPS[i].fields[j];
          if (flagged[k] && optButtons[k] && optButtons[k][0]) { card = cardEls[GROUPS[i].key]; target = optButtons[k][0]; break; }
        }
      }
      if (!card) return;
      try {
        var r = card.getBoundingClientRect();
        var margin = parseFloat(window.getComputedStyle(card).scrollMarginTop) || 0;
        var vh = window.innerHeight || document.documentElement.clientHeight;
        if (!(r.top >= margin - 1 && r.bottom <= vh)) card.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      } catch (err) {}
      try { target.focus({ preventScroll: true }); } catch (err) { try { target.focus(); } catch (err2) {} }
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
      fitSteps();
    }
    // The progress labels are never cut off: when the four labels do not fit
    // in the row (e.g. a wider theme font), only the current one stays visible,
    // as on phones (CSS: .ms-hgk-steps--compact).
    function fitSteps() {
      if (!stepsEl) return;
      stepsEl.classList.remove('ms-hgk-steps--compact');
      if (stepsEl.scrollWidth > stepsEl.clientWidth + 1) stepsEl.classList.add('ms-hgk-steps--compact');
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
      flagged = {};
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
      if (missing().length) { blockMissing(); return; }
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
      offerHandedOver = true;
      maybeOffer();
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
      offerHandedOver = false;
      offerPlanSeen = false;
      clearTimeout(offerTimer);
      offerTimer = null;
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
        case 'plan':
          if (Number(d.items) >= 1 && !offerPlanSeen) { offerPlanSeen = true; maybeOffer(); }
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
    function fitAll() { fitTitle(); fitSteps(); }
    window.addEventListener('resize', function () {
      clearTimeout(fitTimer);
      fitTimer = setTimeout(fitAll, 80);
    });
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll); } catch (e) {}

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

    // ----- Konfigurator-Rabatt ---------------------------------------------------
    // The operator's offer from the Mo backend (admin: Konfigurator → „Mo im
    // Konfigurator“ → Konfigurator-Rabatt; off by default). GET
    // {apiBase}/api/configurator/offer once per load → { ok, offer: null |
    // { code, title, text, terms, trigger } }. Nothing is rendered without an
    // offer (or when the request fails). trigger "start": ~1 s after the
    // handover; "plan": when the first product lands in the plan. The pop-up
    // shows once per browser and code (localStorage ms-hgk-discount-<code> =
    // shown | activated), then a slim banner above the plan keeps the code.
    // „Rabatt aktivieren“ calls Shopify's /discount/<code>, which stores the
    // code for the checkout.
    var offer = null;
    var offerState = null;        // null | 'shown' | 'activated'
    var offerHandedOver = false;  // a handover happened on this page view
    var offerPlanSeen = false;    // the plan reported ≥ 1 line
    var offerTimer = null;
    var offerTries = 0;
    var offerOpen = false;
    var offerBusy = false;
    var offerFailed = false;
    var offerDialog = null;
    var offerBar = null;
    var offerLastFocus = null;
    var offerEls = {};
    var OFFER_DELAY = { start: 1000, plan: 1200 };

    function cleanText(v, max) {
      return typeof v === 'string' ? v.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '').slice(0, max) : '';
    }
    // Fails closed: without a valid code, a title and the conditions (stated in
    // full — API_CONTRACT §3c: terms never "") there is no offer.
    function cleanOffer(o) {
      if (!o || typeof o !== 'object') return null;
      var code = cleanText(o.code, 40);
      var title = cleanText(o.title, 60);
      var terms = cleanText(o.terms, 200);
      if (!/^[A-Za-z0-9_-]{3,40}$/.test(code) || !title || !terms) return null;
      return { code: code, title: title, text: cleanText(o.text, 200), terms: terms, trigger: o.trigger === 'plan' ? 'plan' : 'start' };
    }
    function offerKey() { return 'ms-hgk-discount-' + offer.code; }
    function readOfferState() {
      var v = lsGet(offerKey());
      return v === 'shown' || v === 'activated' ? v : null;
    }
    function loadOffer() {
      if (root.getAttribute('data-mo') !== 'on' || typeof window.fetch !== 'function') return;
      var cfg = window.MS_CHAT_CONFIG || {};
      var base = typeof cfg.apiBase === 'string' ? cfg.apiBase.replace(/\/+$/, '') : '';
      if (!base) return;
      try {
        window.fetch(base + '/api/configurator/offer', { method: 'GET' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (body) {
            var o = body && body.ok === true ? cleanOffer(body.offer) : null;
            if (!o) return;
            offer = o;
            offerState = readOfferState();
            if (offerState) renderOfferBar();
            maybeOffer();
          })
          .catch(function () {});
      } catch (e) {}
    }

    function maybeOffer() {
      if (!offer || offerState || offerOpen || offerTimer) return;
      if (offer.trigger === 'plan' ? !offerPlanSeen : !offerHandedOver) return;
      offerTimer = setTimeout(openOffer, OFFER_DELAY[offer.trigger]);
    }
    // Not over Mo's own pop-up (sign-in / newsletter gate in the dock) and not
    // while the visitor is typing a message: try again a little later.
    function offerWait() {
      if (document.querySelector('.ms-chat-gate')) return true;
      var ae = document.activeElement;
      return !!(ae && ae.tagName === 'TEXTAREA' && dock && dock.contains(ae) && ae.value);
    }
    function openOffer() {
      offerTimer = null;
      if (!offer || offerState || offerOpen) return;
      if (offerWait() && offerTries < 90) {
        offerTries++;
        offerTimer = setTimeout(openOffer, 1000);
        return;
      }
      offerState = 'shown';
      lsSet(offerKey(), 'shown');
      renderOfferBar();
      var d = buildOfferDialog();
      if (!d || typeof d.showModal !== 'function') return; // no <dialog>: the banner alone
      offerLastFocus = document.activeElement;
      try { d.showModal(); } catch (e) { return; }
      offerOpen = true;
      try { offerEls.box.focus({ preventScroll: true }); } catch (e) {}
      track('configurator_discount_shown', { trigger: offer.trigger });
    }

    function el(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text) n.textContent = text;
      return n;
    }
    var TAG_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>';
    var CLOSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

    // The pop-up: a modal <dialog> (top layer — above the sticky header and any
    // theme stacking context; the page behind it is inert, Esc closes).
    function buildOfferDialog() {
      if (offerDialog) return offerDialog;
      var d = document.createElement('dialog');
      if (typeof d.showModal !== 'function') return null;
      d.className = 'ms-hgk-offer';
      d.setAttribute('aria-labelledby', uid + '-offer-title');
      // Described by the text and the conditions, so both are read on opening.
      d.setAttribute('aria-describedby', (offer.text ? uid + '-offer-text ' : '') + uid + '-offer-terms');
      var box = el('div', 'ms-hgk-offer__box');
      box.setAttribute('tabindex', '-1');
      var close = el('button', 'ms-hgk-offer__close');
      close.type = 'button';
      close.setAttribute('aria-label', T('Schließen', 'Close'));
      close.innerHTML = CLOSE_ICON;
      close.addEventListener('click', function () { d.close(); });
      box.appendChild(close);
      box.appendChild(el('p', 'ms-hgk-kicker ms-hgk-offer__kicker', T('Dein Konfigurator-Vorteil', 'Your configurator benefit')));
      var title = el('h2', 'ms-hgk-offer__title', offer.title);
      title.id = uid + '-offer-title';
      box.appendChild(title);
      if (offer.text) {
        var text = el('p', 'ms-hgk-offer__text', offer.text);
        text.id = uid + '-offer-text';
        box.appendChild(text);
      }
      var codeRow = el('div', 'ms-hgk-offer__code');
      var codeBox = el('div', 'ms-hgk-offer__codebox');
      codeBox.appendChild(el('span', 'ms-hgk-offer__codelabel', T('Dein Code', 'Your code')));
      var codeValue = el('span', 'ms-hgk-offer__codevalue', offer.code);
      codeBox.appendChild(codeValue);
      codeRow.appendChild(codeBox);
      var copy = el('button', 'ms-hgk-btn ms-hgk-btn--secondary ms-hgk-offer__copy');
      copy.type = 'button';
      var copyLabel = el('span', '', T('Code kopieren', 'Copy code'));
      copy.appendChild(copyLabel);
      copy.addEventListener('click', function () { copyCode(copy, copyLabel, codeValue); });
      codeRow.appendChild(copy);
      box.appendChild(codeRow);
      var activate = el('button', 'ms-hgk-btn ms-hgk-btn--primary ms-hgk-offer__activate');
      activate.type = 'button';
      var activateLabel = el('span', '', T('Rabatt aktivieren', 'Activate discount'));
      activate.appendChild(activateLabel);
      activate.addEventListener('click', activateOffer);
      box.appendChild(activate);
      // Shopify stores any code; whether it applies is checked at the checkout.
      var done = el('p', 'ms-hgk-offer__done', T('Aktiviert ✓ – wird an der Kasse abgezogen, sobald die Bedingungen erfüllt sind.', 'Activated ✓ – deducted at checkout once the conditions are met.'));
      done.setAttribute('tabindex', '-1');
      box.appendChild(done);
      var fail = el('p', 'ms-hgk-offer__error', T('Das hat nicht geklappt – gib den Code einfach an der Kasse ein.', 'That did not work – just enter the code at checkout.'));
      fail.setAttribute('role', 'alert');
      box.appendChild(fail);
      var terms = el('p', 'ms-hgk-offer__terms', offer.terms);
      terms.id = uid + '-offer-terms';
      box.appendChild(terms);
      d.appendChild(box);
      // Backdrop: a click whose press and release both land outside the box.
      var downOutside = false;
      d.addEventListener('mousedown', function (e) { downOutside = e.target === d; });
      d.addEventListener('click', function (e) {
        if (e.target === d && (downOutside || e.detail === 0)) d.close();
        downOutside = false;
      });
      d.addEventListener('close', function () {
        offerOpen = false;
        track('configurator_discount_closed', {});
        restoreOfferFocus();
      });
      offerEls.box = box;
      offerEls.activate = activate;
      offerEls.activateLabel = activateLabel;
      offerEls.done = done;
      offerEls.fail = fail;
      root.appendChild(d);
      offerDialog = d;
      paintOffer();
      return d;
    }
    function focusable(n) {
      if (!n || n === document.body || !n.focus || !document.documentElement.contains(n)) return false;
      if (n.disabled || n.closest && n.closest('[hidden], [inert]')) return false;
      return !!(n.offsetWidth || n.offsetHeight || (n.getClientRects && n.getClientRects().length));
    }
    function restoreOfferFocus() {
      var target = focusable(offerLastFocus) ? offerLastFocus : offerBar;
      offerLastFocus = null;
      if (!target) return;
      try { target.focus({ preventScroll: true }); } catch (e) {}
    }

    // The banner directly above the plan host (it follows the plan on phones).
    function renderOfferBar() {
      if (offerBar || !offer || !planHost || !planHost.parentNode) return;
      var bar = el('div', 'ms-hgk-offerbar');
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', T('Konfigurator-Vorteil', 'Configurator benefit'));
      bar.setAttribute('tabindex', '-1');
      var icon = el('span', 'ms-hgk-offerbar__icon');
      icon.innerHTML = TAG_ICON;
      bar.appendChild(icon);
      // Grid (…configurator.css): icon | line | action, the conditions under
      // the line; on phones the action sits next to „Bedingungen“.
      var line = el('p', 'ms-hgk-offerbar__line');
      line.appendChild(el('strong', '', T('Konfigurator-Vorteil: ', 'Configurator benefit: ')));
      line.appendChild(el('span', '', offer.title));
      line.appendChild(el('span', 'ms-hgk-offerbar__sep', ' · '));
      var code = el('span', 'ms-hgk-offerbar__code', 'Code\u00a0');
      code.appendChild(el('b', 'ms-hgk-offerbar__codevalue', offer.code));
      line.appendChild(code);
      bar.appendChild(line);
      var terms = el('details', 'ms-hgk-offerbar__terms');
      terms.appendChild(el('summary', '', T('Bedingungen', 'Conditions')));
      terms.appendChild(el('p', '', offer.terms));
      bar.appendChild(terms);
      var fail = el('p', 'ms-hgk-offerbar__error', T('Nicht geklappt – gib den Code an der Kasse ein.', 'Did not work – enter the code at checkout.'));
      fail.setAttribute('role', 'alert');
      bar.appendChild(fail);
      var act = el('div', 'ms-hgk-offerbar__action');
      var btn = el('button', 'ms-hgk-link ms-hgk-offerbar__activate', T('Aktivieren', 'Activate'));
      btn.type = 'button';
      btn.addEventListener('click', activateOffer);
      act.appendChild(btn);
      var status = el('span', 'ms-hgk-offerbar__status', T('Aktiviert ✓', 'Activated ✓'));
      status.setAttribute('tabindex', '-1');
      act.appendChild(status);
      bar.appendChild(act);
      offerEls.barBtn = btn;
      offerEls.barStatus = status;
      offerEls.barFail = fail;
      planHost.parentNode.insertBefore(bar, planHost);
      offerBar = bar;
      paintOffer();
    }

    function paintOffer() {
      var on = offerState === 'activated';
      if (offerEls.activate) {
        offerEls.activate.hidden = on;
        offerEls.activate.setAttribute('aria-busy', offerBusy ? 'true' : 'false');
        offerEls.activateLabel.textContent = offerBusy ? T('Wird aktiviert …', 'Activating …') : T('Rabatt aktivieren', 'Activate discount');
        offerEls.done.hidden = !on;
        offerEls.fail.hidden = !offerFailed || on;
      }
      if (offerEls.barBtn) {
        offerEls.barBtn.hidden = on;
        offerEls.barBtn.textContent = offerBusy ? T('Wird aktiviert …', 'Activating …') : T('Aktivieren', 'Activate');
        offerEls.barStatus.hidden = !on;
        offerEls.barFail.hidden = !offerFailed || on;
      }
      if (offerBar) offerBar.classList.toggle('is-active', on);
    }
    function activateOffer() {
      if (!offer || offerBusy || offerState === 'activated') return;
      offerBusy = true;
      offerFailed = false;
      paintOffer();
      var finish = function (ok) {
        var ae = document.activeElement;
        offerBusy = false;
        if (ok) {
          offerState = 'activated';
          lsSet(offerKey(), 'activated');
          track('configurator_discount_activated', {});
        } else {
          offerFailed = true;
        }
        paintOffer();
        // The pressed button is gone after the activation: keep focus nearby.
        if (ok && ae === offerEls.activate) { try { offerEls.done.focus({ preventScroll: true }); } catch (e) {} }
        if (ok && ae === offerEls.barBtn) { try { offerEls.barStatus.focus({ preventScroll: true }); } catch (e) {} }
      };
      try {
        // redirect 'manual': the 302 (which sets the cookie) is the answer —
        // no need to download the home page it points to.
        window.fetch('/discount/' + encodeURIComponent(offer.code), { credentials: 'same-origin', redirect: 'manual' })
          .then(function (r) { finish(!!(r && (r.ok || r.type === 'opaqueredirect'))); }, function () { finish(false); });
      } catch (e) { finish(false); }
    }

    function copyCode(btn, label, codeValue) {
      var shown = function (ok) {
        if (ok) {
          label.textContent = T('Kopiert ✓', 'Copied ✓');
          track('configurator_discount_copied', {});
          setTimeout(function () { label.textContent = T('Code kopieren', 'Copy code'); }, 2500);
          return;
        }
        // No clipboard: select the code so it can be copied by hand.
        try { window.getSelection().selectAllChildren(codeValue); } catch (e) {}
      };
      var fallback = function () {
        var ok = false;
        try {
          var ta = document.createElement('textarea');
          ta.value = offer.code;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.top = '0';
          ta.style.left = '0';
          ta.style.opacity = '0';
          // Inside the dialog: the page behind the modal is inert.
          (offerDialog && offerOpen ? offerDialog : document.body).appendChild(ta);
          ta.select();
          ok = document.execCommand('copy');
          ta.parentNode.removeChild(ta);
          btn.focus({ preventScroll: true });
        } catch (e) {}
        return ok;
      };
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(offer.code).then(function () { shown(true); }, function () { shown(fallback()); });
          return;
        }
      } catch (e) {}
      shown(fallback());
    }
    loadOffer();

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

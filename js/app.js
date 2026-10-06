/* app.js — the state, and what everything else is wired to.

   This file owns the settings object and the preview, and hands the rest out:
   schema.js says what the panel contains, controls.js builds a row, stage.js
   runs the artboard, exporters.js writes the files. Those modules never reach
   for the state directly — they get it through the small context built at the
   bottom of this file, which is what keeps the seams honest.
*/
(function () {
  'use strict';

  const t = (...a) => I18N.t.apply(null, a);
  const $ = sel => document.querySelector(sel);

  /* ---------------- state ---------------- */
  let S = Schema.defaults();
  let IMG = null;
  let TOKEN = 'none';
  let rafId = 0;
  let controls = [];
  let srcLabel = null;    // null = the bundled example, else the uploaded file's name
  let playing = false;    // animation preview
  let playRaf = 0;
  let playT0 = 0;
  let scrubT = 0;         // 0..1, where the scrubber is parked while stopped

  const view = $('#view');
  const vctx = view.getContext('2d');

  /* ---------------- saved looks ---------------- */
  function strokeSettings() {
    const o = {};
    Schema.STROKE_KEYS.forEach(k => { o[k] = Array.isArray(S[k]) ? S[k].slice() : S[k]; });
    return o;
  }

  function applyStrokeSettings(o) {
    Schema.STROKE_KEYS.forEach(k => {
      if (o[k] === undefined) return;
      S[k] = Array.isArray(o[k]) ? o[k].slice() : o[k];
    });
    Engine.clearCache();
    buildUI();
    scheduleRender();
    save();
  }

  /* ---------------- the sidebar ---------------- */

  function buildUI() {
    buildRail();
    buildPanel();
    applyStaticText();
  }

  function buildRail() {
    const rail = $('#railItems');
    rail.innerHTML = '';
    Schema.SECTIONS.forEach(sec => {
      if (sec.rule) rail.appendChild(U.el('div', 'railRule'));
      const b = U.el('button', 'railBtn' + (S.tab === sec.id ? ' on' : ''));
      b.type = 'button';
      b.setAttribute('aria-pressed', S.tab === sec.id);
      const ico = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      ico.setAttribute('viewBox', '0 0 24 24');
      ico.setAttribute('aria-hidden', 'true');
      ico.innerHTML = Schema.ICONS[sec.icon] || '';
      b.appendChild(ico);
      b.appendChild(U.el('span', null, t('tab.' + sec.id)));
      b.onclick = () => {
        if (sec.id !== 'anim') stopPlay();
        S.tab = sec.id;
        buildUI();
        save();
        $('#panel').scrollTop = 0;
      };
      rail.appendChild(b);
    });
  }

  function buildPanel() {
    const root = $('#groups');
    const typed = $('#presetName') ? $('#presetName').value : null;
    // the panel owns every control, so rebuilding it starts the list over —
    // otherwise a preset-driven rebuild quietly piles a second copy on top
    controls = [];
    root.innerHTML = '';
    const sec = Schema.section(S.tab);
    $('#sectionTitle').textContent = t('tab.' + sec.id);

    sec.groups.forEach(group => {
      const closed = !!S.closedGroups[group.id];
      const box = U.el('section', 'grp' + (closed ? ' closed' : ''));

      const head = U.el('button', 'grpHead');
      head.type = 'button';
      head.setAttribute('aria-expanded', String(!closed));
      head.appendChild(U.el('span', 'grpName', t('g.' + group.id)));
      head.appendChild(U.el('span', 'chev'));
      head.onclick = () => {
        const now = !S.closedGroups[group.id];
        S.closedGroups[group.id] = now;
        box.classList.toggle('closed', now);
        head.setAttribute('aria-expanded', String(!now));
        save();
      };

      const body = U.el('div', 'grpBody');
      group.items.forEach(item => body.appendChild(Controls.build(item)));

      box.appendChild(head);
      box.appendChild(body);
      root.appendChild(box);
    });

    refresh();
    if (typed && $('#presetName')) $('#presetName').value = typed;
  }

  function applyStaticText() {
    $('#pick').textContent = t('ui.upload');
    $('#dropHint').textContent = t('ui.drop');
    $('#fit').textContent = t('ui.fit');
    $('#stage').dataset.drop = t('ui.dropOver');
    $('#srcinfo').textContent = srcLabel === null ? t('ui.exampleLoaded') : srcLabel;
    document.documentElement.lang = I18N.getLang();
    [...document.querySelectorAll('#lang button')].forEach(b => {
      b.classList.toggle('on', b.dataset.lang === I18N.getLang());
      b.setAttribute('aria-pressed', b.dataset.lang === I18N.getLang());
    });
  }

  /* ---------------- reactions ---------------- */

  function commit(it, v) {
    if (it.k === 'animScrub') {
      stopPlay();
      scrubT = U.clamp(v, 0, 100) / 100;
      renderAnimFrame(scrubT);
      return;
    }
    S[it.k] = v;
    onChange(it);
  }

  function onChange(it) {
    if (it.k === 'sizePreset' && S.sizePreset !== 'custom') {
      const p = Schema.SIZE_PRESETS[S.sizePreset];
      if (p) { S.units = p.units; S.cw = p.cw; S.ch = p.ch; S.dpi = p.dpi; }
    }
    if (it.k === 'cw' || it.k === 'ch' || it.k === 'units' || it.k === 'dpi') S.sizePreset = 'custom';
    refresh();
    if (playing) { save(); return; }     // the play loop draws its own frames
    scheduleRender();
    save();
  }

  /* buttons name an action; this is the only place that knows what they mean */
  const ACTIONS = {
    reset: () => resetAll(),
    bgToggle: () => {
      S.bgMode = S.bgMode === 'off' ? 'auto' : 'off';
      refresh(); scheduleRender(); save();
    },
    animPlay: () => togglePlay(),
    animExport: () => { stopPlay(); Exporters.animation(); },
    drawToggle: () => Stage.setTool(Stage.tool === 'paint' ? 'pan' : 'paint'),
    undoDraw: () => { S.paint.pop(); scheduleRender(); save(); },
    clearDraw: () => { S.paint = []; scheduleRender(); save(); status(t('ui.cleared')); },
    exportPng: () => Exporters.png(),
    exportSvg: () => Exporters.svg()
  };

  function act(name, it) {
    const fn = ACTIONS[name];
    if (fn) fn(it);
  }

  function refresh() {
    const px = Engine.canvasPx(S);
    const unit = Engine.computeUnit(S.basis, px.W, px.H);
    controls.forEach(it => {
      if (!it._row) return;
      const vis = it.show ? it.show(S) : true;
      it._row.style.display = vis ? '' : 'none';
      if (!vis) return;

      if (it.t === 'button') {
        if (it.k === 'drawToggle') {
          const on = Stage.tool === 'paint';
          it._input.textContent = t(on ? 'l.drawToggleOn' : 'l.drawToggle');
          it._input.classList.toggle('active', on);
        } else if (it.k === 'animPlay') {
          it._input.textContent = t(playing ? 'l.animStop' : 'l.animPlay');
          it._input.classList.toggle('active', playing);
        } else if (it.k === 'animExport') {
          const gif = S.animFormat === 'gif';
          const n = gif ? Anim.gifFrameCount(S) : Anim.frameCount(S);
          const rate = gif ? Anim.gifRate(S) : Anim.fps(S);
          it._input.textContent = t('l.animExport') + '  ·  ' + n + ' × ' + rate + 'fps';
        } else if (it.k === 'bgToggle') {
          const on = S.bgMode !== 'off';
          it._input.textContent = t(on ? 'l.bgToggleOn' : 'l.bgToggle');
          it._input.classList.toggle('active', on);
        }
        return;
      }
      if (it.t === 'align') return;

      if (it.k === 'animScrub') {
        const pc = Math.round(scrubT * 100);
        it._input.value = pc;
        it._num.value = pc;
        it._input.style.setProperty('--fill', pc + '%');
        it._val.innerHTML = '<span class="pct">' + pc + '%</span>';
        return;
      }

      const v = S[it.k];
      if (it.t === 'range') {
        it._input.value = v;
        it._num.value = Math.round(v * 1000) / 1000;
        const pct = (v - it.min) / (it.max - it.min) * 100;
        it._input.style.setProperty('--fill', U.clamp(pct, 0, 100) + '%');
        it._val.innerHTML = it.px
          ? '<span class="px">' + U.nice(v / 100 * unit, 1) + 'px</span>' : '';
      } else if (it.t === 'check') it._input.checked = !!v;
      else if (it.t === 'palette') it._render();
      else if (it.t === 'presets') it._render();
      else if (it.t === 'color') it._show(v);
      else if (it._input && it._input.tagName) it._input.value = v;
    });
  }

  /* ---------------- render ---------------- */

  function scheduleRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => { rafId = 0; doRender(); });
  }

  /* Render the preview at the resolution it is actually SHOWN at, times the
     display's pixel ratio — not at the canvas's own size. An upload plus its
     margin is often only ~700px and the artboard magnifies it to fill the pane;
     rendering 744px across 1800 physical pixels is what made uploads look soft.
     Capped by the quality setting, and never past twice the canvas, beyond which
     there is nothing left to resolve. */
  function previewDims() {
    const c = Engine.canvasPx(S);
    const long = Math.max(c.W, c.H);
    const vp = $('#viewport');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const availW = Math.max(160, vp.clientWidth - 56);
    const availH = Math.max(160, vp.clientHeight - 56);
    const fit = Math.min(availW / c.W, availH / c.H, 4);
    const shown = long * fit * dpr;
    const target = U.clamp(shown, 320, Math.min(+S.previewQuality, long * 2));
    const k = target / long;
    return { w: Math.max(2, Math.round(c.W * k)), h: Math.max(2, Math.round(c.H * k)) };
  }

  function doRender() {
    const c = Engine.canvasPx(S);
    const d = previewDims();
    const t0 = performance.now();
    let out;
    try {
      out = Engine.render(S, IMG, d.w, d.h, TOKEN);
    } catch (e) {
      status(t('ui.renderFail') + e.message, true);
      console.error(e);
      return;
    }
    view.width = d.w; view.height = d.h;
    vctx.clearRect(0, 0, d.w, d.h);
    vctx.drawImage(out, 0, 0);
    Stage.fitView();
    Stage.drawFrame();
    const mp = c.W * c.H / 1e6;
    $('#dims').textContent = c.W + ' × ' + c.H;
    $('#scaleinfo').textContent = Math.round(performance.now() - t0) + 'ms';
    if (mp > 40) status(t('ui.heavy', U.nice(mp, 0)));
  }

  function status(msg, bad) {
    const s = $('#status');
    s.textContent = msg || '';          // also drops any Save link still shown
    s.className = bad ? 'bad' : '';
  }

  /* ---------------- image loading ---------------- */

  function resetImageSettings() {
    const d = Schema.defaults();
    Schema.PER_IMAGE_KEYS.forEach(k => { S[k] = d[k]; });
  }

  function loadFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        IMG = im;
        resetImageSettings();
        fitCanvasToPicture(im);
        Stage.setSelected(false);
        TOKEN = file.name + ':' + file.size + ':' + Date.now();
        Engine.clearCache();
        srcLabel = file.name + ' — ' + im.naturalWidth + '×' + im.naturalHeight;
        $('#srcinfo').textContent = srcLabel;
        buildUI();
        scheduleRender();
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  /* The canvas takes the picture's pixel size PLUS room around it, and the
     picture is placed at exactly 1:1 so it stays as sharp as the file. Matching
     the picture exactly leaves the silhouette filling the frame, so every stroke
     lands outside the canvas and the tool appears to do nothing: the strokes
     need somewhere to go. */
  function fitCanvasToPicture(im) {
    const iw = im.naturalWidth, ih = im.naturalHeight;
    const margin = Math.max(64, Math.round(Math.min(iw, ih) * 0.18));
    S.units = 'px';
    S.cw = iw + margin * 2;
    S.ch = ih + margin * 2;
    S.sizePreset = 'custom';
    S.fit = 'contain';
    S.fitSubject = false;
    // contain would scale the picture up to fill the larger canvas; cancel that
    // exactly, so the placement matrix comes out at 1:1 and the pixels are kept
    const base = Math.min(S.cw / iw, S.ch / ih);
    S.imgScale = U.clamp(100 / base, 5, 300);
    S.imgX = 0;
    S.imgY = 0;
  }

  function exampleImage(i) {
    i = i || 0;
    if (i >= Schema.EXAMPLE_SRC.length) { generatedExample(); return; }
    const im = new Image();
    im.onload = () => {
      IMG = im;
      TOKEN = 'example:' + Schema.EXAMPLE_SRC[i];
      Engine.clearCache();
      srcLabel = null;
      $('#srcinfo').textContent = t('ui.exampleLoaded');
      scheduleRender();
    };
    im.onerror = () => exampleImage(i + 1);
    im.src = Schema.EXAMPLE_SRC[i];
  }

  /* Transparent background, so it behaves like a real cut-out and the default
     Photo mode still shows the strokes around it. */
  function generatedExample() {
    const c = U.createCanvas(1000, 1000);
    const x = c.getContext('2d');
    x.fillStyle = '#1A2321';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = '900 230px Impact, "Arial Black", Haettenschweiler, sans-serif';
    x.fillText('AH', 500, 330);
    x.fillText('SHIFT', 500, 560);
    x.font = '700 74px Impact, "Arial Black", sans-serif';
    x.fillText('HERE WE GO', 500, 720);
    const im = new Image();
    im.onload = () => {
      IMG = im;
      TOKEN = 'generated';
      Engine.clearCache();
      srcLabel = null;
      $('#srcinfo').textContent = t('ui.exampleLoaded');
      scheduleRender();
    };
    im.src = c.toDataURL();
  }

  /* Move the image so the subject itself sits against the chosen edge. Strokes
     may bleed off the edge — lower Scale if you don't want that. */
  function alignImage(hx, vy) {
    const c = Engine.canvasPx(S);
    const r = Engine.subjectRect(IMG, S, c.W, c.H, TOKEN);
    if (!r) return;
    const unit = Engine.computeUnit(S.basis, c.W, c.H);
    S.imgX = U.clamp(S.imgX + (hx * (c.W - r.w) - r.x) / unit * 100, -150, 150);
    S.imgY = U.clamp(S.imgY + (vy * (c.H - r.h) - r.y) / unit * 100, -150, 150);
    refresh(); scheduleRender(); save();
  }

  /* ---------------- animation playback ----------------

     Playback gets its own ceiling. A frame costs about 50ms at 700px and scales
     with area, so the full preview resolution would drop the loop to a few
     frames a second; the export renders at the real size regardless. */
  const ANIM_PREVIEW_MAX = 700;

  function animDims() {
    const d = previewDims();
    const long = Math.max(d.w, d.h);
    if (long <= ANIM_PREVIEW_MAX) return d;
    const k = ANIM_PREVIEW_MAX / long;
    return { w: Math.max(2, Math.round(d.w * k)), h: Math.max(2, Math.round(d.h * k)) };
  }

  function renderAnimFrame(at) {
    const d = animDims();
    const A = Anim.frameSettings(S, at, d.w, d.h);
    let out;
    try { out = Engine.render(A, IMG, d.w, d.h, TOKEN); }
    catch (e) { stopPlay(); status(t('ui.renderFail') + e.message, true); return; }
    if (view.width !== d.w || view.height !== d.h) { view.width = d.w; view.height = d.h; }
    vctx.clearRect(0, 0, d.w, d.h);
    vctx.drawImage(out, 0, 0);
    Stage.fitView();
  }

  function tick(now) {
    if (!playing) return;
    const ms = Math.max(100, S.animSeconds * 1000);
    const at = ((now - playT0) % ms) / ms;
    scrubT = at;
    renderAnimFrame(at);
    playRaf = requestAnimationFrame(tick);
  }

  function startPlay() {
    if (playing || !IMG) return;
    playing = true;
    Stage.setTool('pan');
    Stage.setSelected(false);
    playT0 = performance.now() - scrubT * Math.max(100, S.animSeconds * 1000);
    playRaf = requestAnimationFrame(tick);
    refresh();
  }

  function stopPlay() {
    if (!playing) return;
    playing = false;
    cancelAnimationFrame(playRaf);
    playRaf = 0;
    refresh();
    renderAnimFrame(scrubT);
  }

  function togglePlay() { playing ? stopPlay() : startPlay(); }

  /* ---------------- persistence ---------------- */

  function save() {
    try { localStorage.setItem('offset.settings', JSON.stringify(S)); } catch (e) { /* ignore */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem('offset.settings');
      if (raw) S = Object.assign(Schema.defaults(), JSON.parse(raw));
    } catch (e) { /* ignore */ }
    if (!S.closedGroups || typeof S.closedGroups !== 'object') S.closedGroups = {};
    if (!Schema.SECTIONS.some(x => x.id === S.tab)) S.tab = 'strokes';
  }

  function setLang(l) {
    S.lang = l;
    I18N.setLang(l);
    buildUI();
    save();
  }

  function resetAll() {
    if (!confirm(t('ui.resetConfirm'))) return;
    const lang = S.lang, tab = S.tab, closed = S.closedGroups;
    S = Schema.defaults();
    S.lang = lang; S.tab = tab; S.closedGroups = closed;
    Stage.setTool('pan');
    Stage.setSelected(false);
    Engine.clearCache();
    buildUI();
    scheduleRender();
    save();
  }

  /* ---------------- the context the other modules see ---------------- */
  const CTX = {
    get S() { return S; },
    get IMG() { return IMG; },
    get TOKEN() { return TOKEN; },
    view: view,
    vctx: vctx,
    commit: commit,
    act: act,
    push: (it) => controls.push(it),
    render: scheduleRender,
    refresh: refresh,
    save: save,
    status: status,
    align: alignImage,
    strokeSettings: strokeSettings,
    applyStrokeSettings: applyStrokeSettings
  };

  /* ---------------- boot ---------------- */
  function boot() {
    load();
    I18N.setLang(S.lang);

    Controls.init(CTX);
    Stage.init(CTX);
    Exporters.init(CTX);

    buildUI();

    $('#pick').onclick = () => $('#file').click();
    $('#file').onchange = e => loadFile(e.target.files[0]);

    [...document.querySelectorAll('#lang button')].forEach(b => {
      b.onclick = () => setLang(b.dataset.lang);
    });

    const stage = $('#stage');
    ['dragenter', 'dragover'].forEach(ev => stage.addEventListener(ev, e => {
      e.preventDefault(); stage.classList.add('over');
    }));
    ['dragleave', 'drop'].forEach(ev => stage.addEventListener(ev, e => {
      e.preventDefault(); stage.classList.remove('over');
    }));
    stage.addEventListener('drop', e => {
      if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
    });
    window.addEventListener('paste', e => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (const it of items) if (it.type.indexOf('image') === 0) loadFile(it.getAsFile());
    });

    Stage.bind();
    $('#fit').onclick = Stage.fitView;
    window.addEventListener('resize', Stage.fitView);

    window.OFFSET = {
      get settings() { return S; },
      get image() { return IMG; },
      get tool() { return Stage.tool; },
      render: doRender,
      align: alignImage,
      defaults: Schema.defaults,
      setLang: setLang
    };

    Presets.onChange(() => { if (S.tab === 'presets') buildPanel(); });
    Presets.init();

    exampleImage();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();

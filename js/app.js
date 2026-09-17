/* app.js — parameter schema, UI generation, live preview and export wiring */
(function () {
  'use strict';

  const t = (...a) => I18N.t.apply(null, a);

  /* ---------------- presets ---------------- */
  const SIZE_PRESETS = {
    'ig-post': { units: 'px', cw: 1080, ch: 1080, dpi: 72 },
    'ig-story': { units: 'px', cw: 1080, ch: 1920, dpi: 72 },
    'ig-land': { units: 'px', cw: 1350, ch: 1080, dpi: 72 },
    'web-hero': { units: 'px', cw: 2560, ch: 1080, dpi: 72 },
    'a5': { units: 'mm', cw: 148, ch: 210, dpi: 300 },
    'a4': { units: 'mm', cw: 210, ch: 297, dpi: 300 },
    'a3': { units: 'mm', cw: 297, ch: 420, dpi: 200 },
    'b2': { units: 'mm', cw: 500, ch: 700, dpi: 120 },
    'banner': { units: 'mm', cw: 3000, ch: 1000, dpi: 25 },
    'sticker': { units: 'mm', cw: 100, ch: 100, dpi: 300 }
  };

  const PALETTES = {
    'shift-yellow': { bg: '#FFD400', rings: ['#16A9A0', '#1E9B57'], ink: '#FFFFFF' },
    'shift-cream': { bg: '#FBF6EA', rings: ['#FFD400', '#16A9A0'], ink: '#E8492B' },
    'acid': { bg: '#0B0B0B', rings: ['#C6FF00', '#00E5FF', '#FF2D95'], ink: '#FFFFFF' },
    'risograph': { bg: '#F3EFE6', rings: ['#FF4B33', '#0050FF'], ink: '#111111' },
    'mono': { bg: '#FFFFFF', rings: ['#000000'], ink: '#000000' },
    'sunset': { bg: '#2B1055', rings: ['#FF6B6B', '#FFD93D', '#6BCB77'], ink: '#FFFFFF' }
  };

  /* Tried in order; the first that loads wins. A browser can't list a directory,
     so the example has to be one of these known names. */
  const EXAMPLE_SRC = [
    'assets/example.png', 'assets/example.jpg', 'assets/example.jpeg',
    'assets/example.webp', 'assets/example.avif'
  ];

  /* ---------------- defaults ---------------- */
  function defaults() {
    return {
      lang: 'en',
      // canvas
      sizePreset: 'ig-post', units: 'px', cw: 1080, ch: 1080, dpi: 72,
      basis: 'short', previewQuality: 1200, bg: '#FFD400',
      // placement
      fit: 'contain', fitSubject: true, imgScale: 78, imgX: 0, imgY: 0, rotate: 0, flipH: false, flipV: false,
      // silhouette
      maskSource: 'auto', maskThreshold: 160, maskInvert: false, maskFillHoles: true,
      maskSmooth: 0.8, maskExpand: 0,
      // strokes
      ringCount: 4, strokeW: 2.4, ringGap: 0, ringOffset: 1.6, ringGrowth: 1,
      ringColors: ['#16A9A0', '#1E9B57'],
      gapUseBg: true, gapColor: '#ffffff',
      haloUseBg: true, haloColor: '#ffffff',
      fillUseBg: true, fillColor: '#ffffff',
      innerRings: 0, aa: true,
      // artwork
      artMode: 'photo', artOpacity: 100, brightness: 0, contrast: 10, saturation: 100,
      artInvert: false, posterize: 0,
      bwThreshold: 150, ditherMode: 'none', ditherStrength: 100, ditherScale: 0.08,
      crispPixels: true, artClip: false, inkOn: 'dark', inkColor: '#FFFFFF',
      paperColor: '#000000', paperTransparent: true,
      // background removal
      bgMode: 'off', bgKeyColor: '#ffffff', bgTolerance: 12, bgContiguous: true,
      bgFeather: 0.15, bgBrushSize: 3, bgBrush: [], bgRev: 0,
      // drawing
      paint: [], brushColor: '#0B63B0', brushWidth: 1.6, brushType: 'scribble',
      // halftone
      halftoneAngle: 45, halftoneShape: 'dot',
      // grain
      grainAmount: 0, grainScale: 0.2, grainMono: true,
      // misc
      seed: 7, svgSimplify: 0.5, svgRes: 1800, exportScale: 1
    };
  }

  /* ---------------- control schema ----------------
     Labels, hints and option names are i18n keys, resolved at build time. */
  const sizeOpts = [['custom', 'size.custom']].concat(
    Object.keys(SIZE_PRESETS).map(k => [k, 'size.' + k]));

  const SCHEMA = [
    {
      id: 'canvas', open: true, items: [
        { k: 'sizePreset', t: 'select', o: sizeOpts },
        { k: 'units', t: 'select', o: [['px', 'units.px'], ['mm', 'units.mm'], ['in', 'units.in']] },
        { k: 'cw', t: 'num', min: 1, step: 1 },
        { k: 'ch', t: 'num', min: 1, step: 1 },
        { k: 'dpi', t: 'num', min: 10, max: 1200, step: 1, show: s => s.units !== 'px' },
        {
          k: 'basis', t: 'select', hint: true,
          o: [['short', 'basis.short'], ['long', 'basis.long'], ['width', 'basis.width'], ['height', 'basis.height'], ['diag', 'basis.diag']]
        },
        { k: 'bg', t: 'color' },
        { k: 'previewQuality', t: 'select', o: [[700, 'pq.700'], [1200, 'pq.1200'], [1800, 'pq.1800'], [2600, 'pq.2600']] }
      ]
    },
    {
      id: 'place', items: [
        { k: 'fit', t: 'select', o: [['contain', 'fit.contain'], ['cover', 'fit.cover']] },
        { k: 'fitSubject', t: 'check', hint: true },
        { k: 'imgScale', t: 'range', min: 5, max: 300, step: 0.5, u: '%' },
        { k: 'imgX', t: 'range', min: -60, max: 60, step: 0.1, u: '%' },
        { k: 'imgY', t: 'range', min: -60, max: 60, step: 0.1, u: '%' },
        { k: 'rotate', t: 'range', min: -180, max: 180, step: 0.5, u: '°' },
        { k: 'flipH', t: 'check' },
        { k: 'flipV', t: 'check' }
      ]
    },
    {
      id: 'bg', items: [
        { k: 'bgMode', t: 'select', hint: true, o: [['off', 'bg.off'], ['auto', 'bg.auto'], ['color', 'bg.color']] },
        { k: 'bgKeyColor', t: 'color', show: s => s.bgMode === 'color' },
        { k: 'bgTolerance', t: 'range', min: 0, max: 100, step: 0.5, u: '%', show: s => s.bgMode !== 'off' },
        { k: 'bgContiguous', t: 'check', hint: true, show: s => s.bgMode !== 'off' },
        { k: 'bgFeather', t: 'range', min: 0, max: 3, step: 0.01, u: '%', show: s => s.bgMode !== 'off' },
        { k: 'bgBrushSize', t: 'range', min: 0.2, max: 25, step: 0.1, u: '%', hint: true }
      ]
    },
    {
      id: 'mask', items: [
        { k: 'maskSource', t: 'select', o: [['auto', 'ms.auto'], ['alpha', 'ms.alpha'], ['dark', 'ms.dark'], ['light', 'ms.light']] },
        { k: 'maskThreshold', t: 'range', min: 0, max: 255, step: 1 },
        { k: 'maskInvert', t: 'check' },
        { k: 'maskFillHoles', t: 'check' },
        { k: 'maskSmooth', t: 'range', min: 0, max: 6, step: 0.05, u: '%', px: true },
        { k: 'maskExpand', t: 'range', min: -8, max: 8, step: 0.05, u: '%', px: true }
      ]
    },
    {
      id: 'strokes', open: true, items: [
        { k: 'ringCount', t: 'range', min: 0, max: 40, step: 1 },
        { k: 'strokeW', t: 'range', min: 0.05, max: 15, step: 0.01, u: '%', px: true, hint: true },
        { k: 'ringGap', t: 'range', min: 0, max: 15, step: 0.01, u: '%', px: true },
        { k: 'ringOffset', t: 'range', min: 0, max: 25, step: 0.01, u: '%', px: true },
        { k: 'ringGrowth', t: 'range', min: 0.5, max: 2, step: 0.01, u: '×', hint: true },
        { k: 'ringColors', t: 'palette' },
        { k: 'palettePreset', t: 'select', o: [['', 'pal.placeholder']].concat(Object.keys(PALETTES).map(p => [p, null, p])) },
        { k: 'haloUseBg', t: 'check' },
        { k: 'haloColor', t: 'color', show: s => !s.haloUseBg },
        { k: 'gapUseBg', t: 'check' },
        { k: 'gapColor', t: 'color', show: s => !s.gapUseBg },
        { k: 'fillUseBg', t: 'check' },
        { k: 'fillColor', t: 'color', show: s => !s.fillUseBg },
        { k: 'innerRings', t: 'range', min: 0, max: 40, step: 1, hint: true },
        { k: 'aa', t: 'check' }
      ]
    },
    {
      id: 'art', items: [
        { k: 'artMode', t: 'select', o: [['photo', 'am.photo'], ['bitmap', 'am.bitmap'], ['silhouette', 'am.silhouette'], ['none', 'am.none']] },
        { k: 'artOpacity', t: 'range', min: 0, max: 100, step: 1, u: '%' },
        { k: 'inkColor', t: 'color', show: s => s.artMode === 'bitmap' || s.artMode === 'silhouette' },
        { k: 'inkOn', t: 'select', o: [['dark', 'ink.dark'], ['light', 'ink.light']], show: s => s.artMode === 'bitmap' },
        { k: 'paperTransparent', t: 'check', show: s => s.artMode === 'bitmap' },
        { k: 'paperColor', t: 'color', show: s => s.artMode === 'bitmap' && !s.paperTransparent },
        { k: 'bwThreshold', t: 'range', min: 0, max: 255, step: 1, show: s => s.artMode === 'bitmap' },
        {
          k: 'ditherMode', t: 'select', show: s => s.artMode === 'bitmap',
          o: [['none', 'dm.none'], ['halftone', 'dm.halftone'], ['bayer4', 'dm.bayer4'], ['bayer8', 'dm.bayer8'], ['floyd', 'dm.floyd'], ['noise', 'dm.noise']]
        },
        { k: 'halftoneAngle', t: 'range', min: 0, max: 90, step: 1, u: '°', hint: true, show: s => s.artMode === 'bitmap' && s.ditherMode === 'halftone' },
        { k: 'halftoneShape', t: 'select', o: [['dot', 'hs.dot'], ['square', 'hs.square'], ['line', 'hs.line']], show: s => s.artMode === 'bitmap' && s.ditherMode === 'halftone' },
        { k: 'ditherStrength', t: 'range', min: 0, max: 200, step: 1, u: '%', show: s => s.artMode === 'bitmap' && s.ditherMode !== 'none' && s.ditherMode !== 'floyd' },
        { k: 'ditherScale', t: 'range', min: 0.02, max: 4, step: 0.01, u: '%', px: true, hint: true, show: s => s.artMode === 'photo' || s.artMode === 'bitmap' },
        { k: 'crispPixels', t: 'check', show: s => s.artMode === 'photo' || s.artMode === 'bitmap' },
        { k: 'artClip', t: 'check', hint: true, show: s => s.artMode === 'photo' || s.artMode === 'bitmap' },
        { k: 'brightness', t: 'range', min: -100, max: 100, step: 1, show: s => s.artMode !== 'silhouette' && s.artMode !== 'none' },
        { k: 'contrast', t: 'range', min: -99, max: 99, step: 1, show: s => s.artMode !== 'silhouette' && s.artMode !== 'none' },
        { k: 'saturation', t: 'range', min: 0, max: 300, step: 1, u: '%', show: s => s.artMode === 'photo' },
        { k: 'posterize', t: 'range', min: 0, max: 12, step: 1, hint: true, show: s => s.artMode === 'photo' },
        { k: 'artInvert', t: 'check', show: s => s.artMode !== 'silhouette' && s.artMode !== 'none' }
      ]
    },
    {
      id: 'draw', items: [
        { k: 'brushType', t: 'select', o: [['marker', 'bt.marker'], ['scribble', 'bt.scribble'], ['highlighter', 'bt.highlighter']] },
        { k: 'brushColor', t: 'color' },
        { k: 'brushWidth', t: 'range', min: 0.1, max: 12, step: 0.05, u: '%', px: true, hint: true }
      ]
    },
    {
      id: 'grain', items: [
        { k: 'grainAmount', t: 'range', min: 0, max: 100, step: 1, u: '%' },
        { k: 'grainScale', t: 'range', min: 0.02, max: 3, step: 0.01, u: '%', px: true },
        { k: 'grainMono', t: 'check' },
        { k: 'seed', t: 'num', min: 0, max: 9999, step: 1, hint: true }
      ]
    },
    {
      id: 'out', items: [
        { k: 'exportScale', t: 'select', o: [[0.5, 'es.0.5'], [1, 'es.1'], [2, 'es.2'], [3, 'es.3'], [4, 'es.4']] },
        { k: 'svgRes', t: 'select', o: [[900, 'sr.900'], [1800, 'sr.1800'], [3000, 'sr.3000'], [4500, 'sr.4500']] },
        { k: 'svgSimplify', t: 'range', min: 0, max: 3, step: 0.05, hint: true }
      ]
    }
  ];

  /* ---------------- state ---------------- */
  let S = defaults();
  let IMG = null;
  let TOKEN = 'none';
  let rafId = 0;
  let controls = [];
  let srcLabel = null;   // null = the bundled example, else the uploaded file's name
  let TOOL = 'pan';      // pan | paint | erase | restore | pick
  let drawing = null;    // the stroke currently under the pointer

  const $ = sel => document.querySelector(sel);
  const view = $('#view');
  const vctx = view.getContext('2d');

  /* ---------------- UI builder ---------------- */
  function buildUI() {
    const root = $('#panels');
    root.innerHTML = '';
    controls = [];
    SCHEMA.forEach(group => {
      const sec = U.el('section', 'grp' + (group.open ? '' : ' closed'));
      const head = U.el('h3', 'grp-h');
      head.appendChild(U.el('span', 'chev'));
      head.appendChild(document.createTextNode(t('g.' + group.id)));
      head.onclick = () => sec.classList.toggle('closed');
      sec.appendChild(head);
      const body = U.el('div', 'grp-b');
      group.items.forEach(item => body.appendChild(buildControl(item)));
      sec.appendChild(body);
      root.appendChild(sec);
      if (group.id === 'strokes') sec.appendChild(U.el('div', 'measure')).id = 'measure';
    });
    applyStaticText();
    refresh();
  }

  function applyStaticText() {
    $('#pick').textContent = t('ui.upload');
    $('#dropHint').textContent = t('ui.drop');
    $('#reset').textContent = t('ui.reset');
    $('#fit').textContent = t('ui.fit');
    $('#exportPng').textContent = t('ui.png');
    $('#exportSvg').textContent = t('ui.svg');
    $('#stage').dataset.drop = t('ui.dropOver');
    const toolNames = { pan: 'tPan', paint: 'tPaint', erase: 'tErase', restore: 'tRestore', pick: 'tPick' };
    [...document.querySelectorAll('#tools button')].forEach(b => {
      b.textContent = t('ui.' + toolNames[b.dataset.tool]);
      b.classList.toggle('on', b.dataset.tool === TOOL);
      b.setAttribute('aria-pressed', b.dataset.tool === TOOL);
    });
    $('#clearDraw').textContent = t('ui.clearDraw');
    $('#undoDraw').textContent = t('ui.undoDraw');
    $('#clearBg').textContent = t('ui.clearBg');
    $('#srcinfo').textContent = srcLabel === null ? t('ui.exampleLoaded') : srcLabel;
    document.documentElement.lang = I18N.getLang();
    [...document.querySelectorAll('#lang button')].forEach(b => {
      b.classList.toggle('on', b.dataset.lang === I18N.getLang());
      b.setAttribute('aria-pressed', b.dataset.lang === I18N.getLang());
    });
  }

  function buildControl(it) {
    const row = U.el('div', 'row');
    const lab = U.el('label', 'lab', t('l.' + it.k));
    row.appendChild(lab);
    const val = U.el('span', 'val');
    let input;

    const commit = (v, heavy) => { S[it.k] = v; onChange(it, heavy); };

    if (it.t === 'range') {
      input = U.el('input');
      input.type = 'range';
      input.id = 'c-' + it.k;
      input.min = it.min; input.max = it.max; input.step = it.step;
      input.oninput = () => commit(parseFloat(input.value));
      const num = U.el('input', 'numbox');
      num.type = 'number';
      num.id = 'n-' + it.k;
      num.min = it.min; num.max = it.max; num.step = it.step;
      num.onchange = () => { const v = U.clamp(parseFloat(num.value) || 0, it.min, it.max); input.value = v; commit(v); };
      row.classList.add('rng');
      lab.appendChild(val);
      row.appendChild(input);
      row.appendChild(num);
      it._num = num;
    } else if (it.t === 'num') {
      input = U.el('input', 'numbox wide');
      input.type = 'number';
      input.id = 'c-' + it.k;
      if (it.min != null) input.min = it.min;
      if (it.max != null) input.max = it.max;
      input.step = it.step || 1;
      input.onchange = () => commit(parseFloat(input.value) || 0, true);
      row.appendChild(input);
    } else if (it.t === 'select') {
      input = U.el('select');
      input.id = 'c-' + it.k;
      it.o.forEach(o => {
        // o = [value, i18nKey] or [value, null, literalLabel]
        const op = U.el('option', null, o[1] ? t('o.' + o[1]) : o[2]);
        op.value = o[0];
        input.appendChild(op);
      });
      input.onchange = () => {
        let v = input.value;
        if (typeof it.o[0][0] === 'number') v = parseFloat(v);
        commit(v, true);
      };
      row.appendChild(input);
    } else if (it.t === 'check') {
      input = U.el('input');
      input.type = 'checkbox';
      input.id = 'c-' + it.k;
      input.onchange = () => commit(input.checked, true);
      row.classList.add('chk');
      row.insertBefore(input, lab);
      lab.htmlFor = input.id;
    } else if (it.t === 'color') {
      input = U.el('input', 'swatch');
      input.type = 'color';
      input.id = 'c-' + it.k;
      input.oninput = () => commit(input.value);
      row.appendChild(input);
    } else if (it.t === 'palette') {
      input = U.el('div', 'pal');
      row.classList.add('col');
      row.appendChild(input);
      it._render = () => renderPalette(input);
    }

    if (it.hint) {
      row.classList.add('col');
      row.appendChild(U.el('div', 'hint2', t('h.' + it.k)));
    }
    it._row = row;
    it._input = input;
    it._val = val;
    controls.push(it);
    return row;
  }

  function renderPalette(box) {
    box.innerHTML = '';
    S.ringColors.forEach((c, i) => {
      const w = U.el('div', 'chip');
      const inp = U.el('input');
      inp.type = 'color';
      inp.value = c;
      inp.oninput = () => { S.ringColors[i] = inp.value; scheduleRender(); save(); };
      const del = U.el('button', 'x', '×');
      del.onclick = () => {
        if (S.ringColors.length <= 1) return;
        S.ringColors.splice(i, 1);
        renderPalette(box);
        scheduleRender();
        save();
      };
      w.appendChild(inp);
      w.appendChild(del);
      box.appendChild(w);
    });
    const add = U.el('button', 'chip add', '+');
    add.onclick = () => {
      S.ringColors.push(S.ringColors[S.ringColors.length - 1] || '#000000');
      renderPalette(box);
      scheduleRender();
      save();
    };
    box.appendChild(add);
  }

  /* ---------------- reactions ---------------- */
  function onChange(it) {
    if (it.k === 'palettePreset') {
      const p = PALETTES[S.palettePreset];
      if (p) { S.bg = p.bg; S.ringColors = p.rings.slice(); S.inkColor = p.ink; }
      S.palettePreset = '';
    }
    if (it.k === 'sizePreset' && S.sizePreset !== 'custom') {
      const p = SIZE_PRESETS[S.sizePreset];
      if (p) { S.units = p.units; S.cw = p.cw; S.ch = p.ch; S.dpi = p.dpi; }
    }
    if (it.k === 'cw' || it.k === 'ch' || it.k === 'units' || it.k === 'dpi') S.sizePreset = 'custom';
    refresh();
    scheduleRender();
    save();
  }

  function refresh() {
    const px = Engine.canvasPx(S);
    const unit = Engine.computeUnit(S.basis, px.W, px.H);
    controls.forEach(it => {
      if (!it._row) return;
      const vis = it.show ? it.show(S) : true;
      it._row.style.display = vis ? '' : 'none';
      if (!vis) return;
      const v = S[it.k];
      if (it.t === 'range') {
        it._input.value = v;
        it._num.value = Math.round(v * 1000) / 1000;
        let s = '<span class="pct">' + U.nice(v, 2) + (it.u || '') + '</span>';
        if (it.px) s += ' <span class="px">' + U.nice(v / 100 * unit, 1) + 'px</span>';
        it._val.innerHTML = s;
      } else if (it.t === 'check') it._input.checked = !!v;
      else if (it.t === 'palette') it._render();
      else if (it._input && it._input.tagName) it._input.value = v;
    });
    updateMeasure(px, unit);
  }

  /* the "does my stroke match everywhere" readout */
  function updateMeasure(px, unit) {
    const m = $('#measure');
    if (!m) return;
    const strokePx = S.strokeW / 100 * unit;
    const mm = S.units === 'px' ? null : strokePx / S.dpi * 25.4;
    const band = Engine.ringBands(S, unit, S.ringCount).max;

    const samples = [
      [t('m.igpost'), 1080, 1080],
      [t('m.a4'), 2480, 3508],
      [t('m.banner'), 5906, 1969]
    ];
    const rows = samples.map(s => {
      const u = Engine.computeUnit(S.basis, s[1], s[2]);
      const w = S.strokeW / 100 * u;
      const rel = w / Math.min(s[1], s[2]) * 100;
      return '<tr><td>' + s[0] + '</td><td>' + U.nice(w, 1) + 'px</td><td>' + U.nice(rel, 2) + '%</td></tr>';
    }).join('');

    m.innerHTML =
      '<div class="mh">' + t('m.title') + '</div>' +
      '<div class="mbig">' + U.nice(strokePx, 1) + ' px' +
      (mm ? '<span> / ' + U.nice(mm, 2) + ' mm</span>' : '') + '</div>' +
      '<div class="msub">' + t('m.basis', U.nice(unit, 0), U.nice(band, 0), U.nice(band / unit * 100, 2)) + '</div>' +
      '<table class="mt"><tbody>' + rows + '</tbody></table>' +
      '<div class="hint2">' + t('m.note') + '</div>';
  }

  /* ---------------- render ---------------- */
  function scheduleRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => { rafId = 0; doRender(); });
  }

  function doRender() {
    const c = Engine.canvasPx(S);
    const q = +S.previewQuality;
    const k = Math.min(1, q / Math.max(c.W, c.H));
    const rw = Math.max(2, Math.round(c.W * k));
    const rh = Math.max(2, Math.round(c.H * k));
    const t0 = performance.now();
    let out;
    try {
      out = Engine.render(S, IMG, rw, rh, TOKEN);
    } catch (e) {
      status(t('ui.renderFail') + e.message, true);
      console.error(e);
      return;
    }
    view.width = rw; view.height = rh;
    vctx.clearRect(0, 0, rw, rh);
    vctx.drawImage(out, 0, 0);
    fitView();
    const mp = c.W * c.H / 1e6;
    $('#dims').textContent = c.W + ' × ' + c.H + ' px' +
      (S.units !== 'px' ? '  (' + S.cw + '×' + S.ch + ' ' + S.units + ' @' + S.dpi + ')' : '');
    $('#scaleinfo').textContent = t('ui.preview') + ' ' + rw + '×' + rh + ' · ' + Math.round(performance.now() - t0) + 'ms';
    status(mp > 40 ? t('ui.heavy', U.nice(mp, 0)) : '');
  }

  function fitView() {
    const vp = $('#viewport');
    const pad = 80;
    const aw = vp.clientWidth - pad, ah = vp.clientHeight - pad;
    const s = Math.min(aw / view.width, ah / view.height, 4);
    view.style.width = (view.width * s) + 'px';
    view.style.height = (view.height * s) + 'px';
  }

  function status(msg, bad) {
    const s = $('#status');
    s.textContent = msg || '';
    s.className = bad ? 'bad' : '';
  }

  /* ---------------- image loading ---------------- */
  function loadFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        IMG = im;
        TOKEN = file.name + ':' + file.size + ':' + Date.now();
        Engine.clearCache();
        S.bgBrush = [];
        S.bgRev++;
        srcLabel = file.name + ' — ' + im.naturalWidth + '×' + im.naturalHeight;
        $('#srcinfo').textContent = srcLabel;
        scheduleRender();
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  /* The bundled example. Falls back to a generated one if no file is present. */
  function exampleImage(i) {
    i = i || 0;
    if (i >= EXAMPLE_SRC.length) { generatedExample(); return; }
    const im = new Image();
    im.onload = () => {
      IMG = im;
      TOKEN = 'example:' + EXAMPLE_SRC[i];
      Engine.clearCache();
      srcLabel = null;
      $('#srcinfo').textContent = t('ui.exampleLoaded');
      scheduleRender();
    };
    im.onerror = () => exampleImage(i + 1);
    im.src = EXAMPLE_SRC[i];
  }

  /* Transparent background, so it behaves like the real cut-out example and the
     default Photo mode still shows the strokes around it. */
  function generatedExample() {
    const c = U.createCanvas(1000, 1000);
    const g = c.getContext('2d');
    g.fillStyle = '#141C1B';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '900 230px Impact, "Arial Black", Haettenschweiler, sans-serif';
    g.fillText('AH', 500, 330);
    g.fillText('SHIFT', 500, 560);
    g.font = '700 74px Impact, "Arial Black", sans-serif';
    g.fillText('HERE WE GO', 500, 720);
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


  /* ---------------- artboard tools ---------------- */

  /* pointer -> canvas coords, in the render's own pixel space */
  function pointerPos(e) {
    const r = view.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width * view.width,
      y: (e.clientY - r.top) / r.height * view.height
    };
  }

  function setTool(name) {
    TOOL = name;
    view.classList.toggle('drawing', name === 'paint' || name === 'erase' || name === 'restore');
    view.classList.toggle('picking', name === 'pick');
    const hints = { paint: 'hintPaint', erase: 'hintErase', restore: 'hintRestore', pick: 'hintPick' };
    status(hints[name] ? t('ui.' + hints[name]) : '');
    applyStaticText();
  }

  function beginStroke(e) {
    if (TOOL === 'pan') return;
    const q = pointerPos(e);

    if (TOOL === 'pick') {
      const hex = Engine.pickColor(IMG, S, view.width, view.height, q.x, q.y);
      if (!hex) { status(t('ui.pickFail'), true); return; }
      S.bgKeyColor = hex;
      if (S.bgMode !== 'color') S.bgMode = 'color';
      Engine.clearCache();
      refresh(); scheduleRender(); save();
      status(t('ui.picked', hex));
      return;
    }

    view.setPointerCapture(e.pointerId);

    if (TOOL === 'paint') {
      drawing = {
        kind: 'paint',
        stroke: {
          color: S.brushColor, width: S.brushWidth, type: S.brushType,
          points: [[q.x / view.width, q.y / view.height]]
        }
      };
      S.paint.push(drawing.stroke);
    } else {
      // erase / restore act on the photo, so points live in source-image space
      const sp = Engine.canvasToSource(IMG, S, view.width, view.height, q.x, q.y);
      if (!sp) return;
      drawing = {
        kind: 'bg',
        stroke: { kind: TOOL, size: S.bgBrushSize, points: [[sp.x, sp.y]] }
      };
      S.bgBrush.push(drawing.stroke);
      S.bgRev++;
    }
    scheduleRender();
  }

  function extendStroke(e) {
    if (!drawing) return;
    const q = pointerPos(e);
    const pts = drawing.stroke.points;
    if (drawing.kind === 'paint') {
      const nx = q.x / view.width, ny = q.y / view.height;
      const last = pts[pts.length - 1];
      if (Math.hypot(nx - last[0], ny - last[1]) < 0.002) return;
      pts.push([nx, ny]);
    } else {
      const sp = Engine.canvasToSource(IMG, S, view.width, view.height, q.x, q.y);
      if (!sp) return;
      const last = pts[pts.length - 1];
      if (Math.hypot(sp.x - last[0], sp.y - last[1]) < 0.002) return;
      pts.push([sp.x, sp.y]);
      S.bgRev++;
      Engine.clearCache();
    }
    scheduleRender();
  }

  function endStroke(e) {
    if (!drawing) return;
    if (drawing.kind === 'bg') { S.bgRev++; Engine.clearCache(); }
    drawing = null;
    try { view.releasePointerCapture(e.pointerId); } catch (err) { /* already gone */ }
    scheduleRender();
    save();
  }

  function bindTools() {
    [...document.querySelectorAll('#tools button')].forEach(b => {
      b.onclick = () => setTool(b.dataset.tool);
    });
    view.addEventListener('pointerdown', beginStroke);
    view.addEventListener('pointermove', extendStroke);
    view.addEventListener('pointerup', endStroke);
    view.addEventListener('pointercancel', endStroke);

    $('#undoDraw').onclick = () => {
      S.paint.pop();
      scheduleRender(); save();
    };
    $('#clearDraw').onclick = () => {
      S.paint = [];
      scheduleRender(); save();
      status(t('ui.cleared'));
    };
    $('#clearBg').onclick = () => {
      S.bgBrush = [];
      S.bgRev++;
      Engine.clearCache();
      scheduleRender(); save();
      status(t('ui.cleared'));
    };

    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && S.paint.length) {
        e.preventDefault();
        S.paint.pop();
        scheduleRender(); save();
      }
      const keys = { v: 'pan', b: 'paint', e: 'erase', r: 'restore', i: 'pick' };
      if (keys[e.key]) setTool(keys[e.key]);
    });
  }

  /* ---------------- export ---------------- */
  function exportPNG() {
    const c = Engine.canvasPx(S);
    const W = Math.round(c.W * S.exportScale), H = Math.round(c.H * S.exportScale);
    status(t('ui.rendering', W, H));
    setTimeout(() => {
      try {
        const out = Engine.render(S, IMG, W, H, TOKEN);
        out.toBlob(b => {
          U.download(b, 'strokes-' + W + 'x' + H + '.png');
          status(t('ui.savedPng', W, H));
        }, 'image/png');
      } catch (e) {
        status(t('ui.exportFail') + e.message, true);
      }
    }, 30);
  }

  function exportSVG() {
    const c = Engine.canvasPx(S);
    status(t('ui.tracing'));
    setTimeout(() => {
      try {
        const svg = Engine.toSVG(S, IMG, c.W, c.H, TOKEN, +S.svgRes);
        U.download(new Blob([svg], { type: 'image/svg+xml' }), 'strokes-' + c.W + 'x' + c.H + '.svg');
        status(t('ui.savedSvg', Math.round(svg.length / 1024)));
      } catch (e) {
        status(t('ui.svgFail') + e.message, true);
        console.error(e);
      }
    }, 30);
  }

  /* ---------------- persistence ---------------- */
  function save() {
    try { localStorage.setItem('offset.settings', JSON.stringify(S)); } catch (e) { /* ignore */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem('offset.settings');
      if (raw) S = Object.assign(defaults(), JSON.parse(raw));
    } catch (e) { /* ignore */ }
  }

  function setLang(l) {
    S.lang = l;
    I18N.setLang(l);
    buildUI();
    doRender();
    save();
  }

  /* ---------------- boot ---------------- */
  function boot() {
    load();
    I18N.setLang(S.lang);
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

    bindTools();

    $('#exportPng').onclick = exportPNG;
    $('#exportSvg').onclick = exportSVG;
    $('#fit').onclick = fitView;
    $('#reset').onclick = () => {
      if (!confirm(t('ui.resetConfirm'))) return;
      const lang = S.lang;
      S = defaults();
      S.lang = lang;
      TOOL = 'pan';
      Engine.clearCache();
      buildUI();
      scheduleRender();
      save();
    };
    window.addEventListener('resize', fitView);

    // debug handle: lets you poke at state from the console
    window.OFFSET = {
      get settings() { return S; },
      get image() { return IMG; },
      render: doRender,
      defaults: defaults,
      setLang: setLang
    };

    exampleImage();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();

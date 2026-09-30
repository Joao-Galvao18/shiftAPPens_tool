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

  /* Everything the Strokes tab owns, plus the background the palette was picked
     against — without it a saved look lands on the wrong ground. */
  const STROKE_KEYS = [
    'bg',
    'ringCount', 'strokeW', 'ringGap', 'ringOffset', 'ringGrowth', 'innerRings',
    'ringColors', 'gapUseBg', 'gapColor', 'haloUseBg', 'haloColor',
    'fillUseBg', 'fillColor', 'aa',
    'maskSource', 'maskThreshold', 'maskSmooth', 'maskExpand', 'maskFillHoles', 'maskInvert'
  ];

  function strokeSettings() {
    const o = {};
    STROKE_KEYS.forEach(k => { o[k] = Array.isArray(S[k]) ? S[k].slice() : S[k]; });
    return o;
  }

  function applyStrokeSettings(o) {
    STROKE_KEYS.forEach(k => {
      if (o[k] === undefined) return;
      S[k] = Array.isArray(o[k]) ? o[k].slice() : o[k];
    });
    Engine.clearCache();
    buildUI();
    scheduleRender();
    save();
  }

  const EXAMPLE_SRC = [
    'assets/example.png', 'assets/example.jpg', 'assets/example.jpeg',
    'assets/example.webp', 'assets/example.avif'
  ];

  /* ---------------- defaults ---------------- */
  function defaults() {
    return {
      lang: 'en', tab: 'strokes', canvasOpen: true,
      // canvas
      sizePreset: 'ig-post', units: 'px', cw: 1080, ch: 1080, dpi: 72,
      basis: 'short', previewQuality: 1200, bg: '#FFD400',
      // placement
      fit: 'contain', fitSubject: false, imgScale: 100, imgX: 0, imgY: 0,
      rotate: 0, flipH: false, flipV: false,
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
      // background removal — one switch, everything else read from the picture
      bgMode: 'off',
      // artwork
      artMode: 'photo', artOpacity: 100, brightness: 0, contrast: 10, saturation: 100,
      artInvert: false, posterize: 0,
      bwThreshold: 150, ditherMode: 'none', ditherStrength: 100, ditherScale: 0.08,
      halftoneAngle: 45, halftoneShape: 'dot',
      crispPixels: true, artClip: false, inkOn: 'dark', inkColor: '#FFFFFF',
      paperColor: '#000000', paperTransparent: true,
      // drawing
      paint: [], brushColor: '#DB6AC3', brushWidth: 1.6, brushType: 'scribble',
      // grain
      grainAmount: 0, grainScale: 0.2, grainMono: true,
      // animation
      animType: 'radiate', animDir: 'out', animSeconds: 1.5,
      animAmount: 35, animScale: 1, animFormat: 'gif',
      animEase: true, animGrain: 0, animGrainScale: 0.25, animGrainMono: true,
      // misc
      seed: 7, svgSimplify: 0.5, svgRes: 1800, exportScale: 1
    };
  }

  /* ---------------- the canvas block, always visible above the tabs ---------------- */
  const sizeOpts = [['custom', 'size.custom']].concat(
    Object.keys(SIZE_PRESETS).map(k => [k, 'size.' + k]));

  const CANVAS_ITEMS = [
    { k: 'sizePreset', t: 'select', o: sizeOpts },
    { k: 'cw', t: 'num', min: 1, step: 1, pair: true },
    { k: 'ch', t: 'num', min: 1, step: 1, pair: true },
    { k: 'units', t: 'select', o: [['px', 'units.px'], ['mm', 'units.mm'], ['in', 'units.in']] },
    { k: 'dpi', t: 'num', min: 10, max: 1200, step: 1, show: s => s.units !== 'px' },
    { k: 'bg', t: 'color' },
    { k: 'reset', t: 'button', danger: true, act: () => resetAll() }
  ];

  /* ---------------- tabs ---------------- */
  const TABS = [
{
      id: 'image', groups: [
        {
          id: 'placement', items: [
            { k: 'align', t: 'align', hint: true },
            { k: 'fit', t: 'select', o: [['contain', 'fit.contain'], ['cover', 'fit.cover']] },
            { k: 'fitSubject', t: 'check' },
            { k: 'imgScale', t: 'range', min: 5, max: 300, step: 0.5, u: '%' },
            { k: 'imgX', t: 'range', min: -150, max: 150, step: 0.1, u: '%' },
            { k: 'imgY', t: 'range', min: -150, max: 150, step: 0.1, u: '%' },
            { k: 'rotate', t: 'range', min: -180, max: 180, step: 0.5, u: '°' },
            { k: 'flipH', t: 'check' },
            { k: 'flipV', t: 'check' }
          ]
        },
        {
          id: 'bg', items: [
            {
              k: 'bgToggle', t: 'button', hint: true,
              act: () => {
                S.bgMode = S.bgMode === 'off' ? 'auto' : 'off';
                refresh(); scheduleRender(); save();
              }
            }
          ]
        },
        {
          id: 'treat', items: [
            { k: 'artMode', t: 'select', o: [['photo', 'am.photo'], ['bitmap', 'am.bitmap'], ['silhouette', 'am.silhouette'], ['none', 'am.none']] },
            { k: 'inkColor', t: 'color', show: s => s.artMode === 'bitmap' || s.artMode === 'silhouette' },
            { k: 'inkOn', t: 'select', o: [['dark', 'ink.dark'], ['light', 'ink.light']], show: s => s.artMode === 'bitmap' },
            { k: 'bwThreshold', t: 'range', min: 0, max: 255, step: 1, show: s => s.artMode === 'bitmap' },
            {
              k: 'ditherMode', t: 'select', show: s => s.artMode === 'bitmap',
              o: [['none', 'dm.none'], ['halftone', 'dm.halftone'], ['bayer4', 'dm.bayer4'], ['bayer8', 'dm.bayer8'], ['floyd', 'dm.floyd'], ['noise', 'dm.noise']]
            },
            { k: 'ditherScale', t: 'range', min: 0.02, max: 4, step: 0.01, u: '%', px: true, show: s => s.artMode === 'bitmap' && s.ditherMode !== 'none' },
            { k: 'halftoneAngle', t: 'range', min: 0, max: 90, step: 1, u: '°', show: s => s.artMode === 'bitmap' && s.ditherMode === 'halftone' },
            { k: 'halftoneShape', t: 'select', o: [['dot', 'hs.dot'], ['square', 'hs.square'], ['line', 'hs.line']], show: s => s.artMode === 'bitmap' && s.ditherMode === 'halftone' },
            { k: 'ditherStrength', t: 'range', min: 0, max: 200, step: 1, u: '%', show: s => s.artMode === 'bitmap' && s.ditherMode !== 'none' && s.ditherMode !== 'floyd' },
            { k: 'paperTransparent', t: 'check', show: s => s.artMode === 'bitmap' },
            { k: 'paperColor', t: 'color', show: s => s.artMode === 'bitmap' && !s.paperTransparent },
            { k: 'brightness', t: 'range', min: -100, max: 100, step: 1, show: s => s.artMode === 'photo' || s.artMode === 'bitmap' },
            { k: 'contrast', t: 'range', min: -99, max: 99, step: 1, show: s => s.artMode === 'photo' || s.artMode === 'bitmap' },
            { k: 'saturation', t: 'range', min: 0, max: 300, step: 1, u: '%', show: s => s.artMode === 'photo' },
            { k: 'posterize', t: 'range', min: 0, max: 12, step: 1, show: s => s.artMode === 'photo' },
            { k: 'artOpacity', t: 'range', min: 0, max: 100, step: 1, u: '%' },
            { k: 'artInvert', t: 'check', show: s => s.artMode === 'photo' || s.artMode === 'bitmap' },
            { k: 'artClip', t: 'check', hint: true, show: s => s.artMode === 'photo' || s.artMode === 'bitmap' }
          ]
        },
        {
          id: 'grain', items: [
            { k: 'grainAmount', t: 'range', min: 0, max: 100, step: 1, u: '%' },
            { k: 'grainScale', t: 'range', min: 0.02, max: 3, step: 0.01, u: '%', px: true, show: s => s.grainAmount > 0 },
            { k: 'grainMono', t: 'check', show: s => s.grainAmount > 0 },
            { k: 'seed', t: 'num', min: 0, max: 9999, step: 1, show: s => s.grainAmount > 0 || s.ditherMode === 'noise' }
          ]
        }
      ]
    },
    {
      id: 'strokes', groups: [
        {
          id: 'shape', items: [
            { k: 'ringCount', t: 'range', min: 0, max: 40, step: 1 },
            { k: 'strokeW', t: 'range', min: 0.05, max: 15, step: 0.01, u: '%', px: true, hint: true },
            { k: 'ringGap', t: 'range', min: 0, max: 15, step: 0.01, u: '%', px: true },
            { k: 'ringOffset', t: 'range', min: 0, max: 25, step: 0.01, u: '%', px: true },
            { k: 'ringGrowth', t: 'range', min: 0.5, max: 2, step: 0.01, u: '×' },
            { k: 'innerRings', t: 'range', min: 0, max: 40, step: 1 }
          ]
        },
        {
          id: 'colours', items: [
            { k: 'ringColors', t: 'palette' },
            { k: 'palettePreset', t: 'select', o: [['', 'pal.placeholder']].concat(Object.keys(PALETTES).map(p => [p, null, p])) },
            { k: 'haloUseBg', t: 'check' },
            { k: 'haloColor', t: 'color', show: s => !s.haloUseBg },
            { k: 'gapUseBg', t: 'check' },
            { k: 'gapColor', t: 'color', show: s => !s.gapUseBg },
            { k: 'fillUseBg', t: 'check' },
            { k: 'fillColor', t: 'color', show: s => !s.fillUseBg }
          ]
        },
        {
          id: 'silhouette', items: [
            { k: 'maskSource', t: 'select', o: [['auto', 'ms.auto'], ['alpha', 'ms.alpha'], ['dark', 'ms.dark'], ['light', 'ms.light']] },
            { k: 'maskThreshold', t: 'range', min: 0, max: 255, step: 1, show: s => s.maskSource === 'dark' || s.maskSource === 'light' },
            { k: 'maskSmooth', t: 'range', min: 0, max: 6, step: 0.05, u: '%', px: true, hint: true },
            { k: 'maskExpand', t: 'range', min: -8, max: 8, step: 0.05, u: '%', px: true },
            { k: 'maskFillHoles', t: 'check' },
            { k: 'maskInvert', t: 'check' },
            { k: 'aa', t: 'check' }
          ]
        }
      ]
    },
    {
      id: 'anim', groups: [
        {
          id: 'motion', items: [
            { k: 'animPlay', t: 'button', act: () => togglePlay() },
            {
              k: 'animType', t: 'select', hint: true,
              o: [['radiate', 'an.radiate'], ['breathe', 'an.breathe'], ['chase', 'an.chase'],
                  ['reveal', 'an.reveal'], ['wobble', 'an.wobble'], ['hue', 'an.hue']]
            },
            { k: 'animDir', t: 'select', o: [['out', 'an.out'], ['in', 'an.in']], show: s => s.animType === 'radiate' || s.animType === 'hue' },
            { k: 'animAmount', t: 'range', min: 5, max: 100, step: 1, u: '%', show: s => s.animType === 'breathe' || s.animType === 'wobble' },
            { k: 'animEase', t: 'check', show: s => s.animType === 'reveal' },
            { k: 'animSeconds', t: 'range', min: 0.3, max: 8, step: 0.1, u: 's' },
            { k: 'animScrub', t: 'range', min: 0, max: 100, step: 1, u: '%' }
          ]
        },
        {
          id: 'anmgrain', items: [
            { k: 'animGrain', t: 'range', min: 0, max: 100, step: 1, u: '%', hint: true },
            { k: 'animGrainScale', t: 'range', min: 0.05, max: 3, step: 0.01, u: '%', px: true, show: s => s.animGrain > 0 },
            { k: 'animGrainMono', t: 'check', show: s => s.animGrain > 0 }
          ]
        },
        {
          id: 'anmexport', items: [
            { k: 'animFormat', t: 'select', o: [['gif', 'af.gif'], ['webm', 'af.webm'], ['png', 'af.png']] },
            { k: 'animScale', t: 'select', o: [[0.5, 'es.0.5'], [1, 'es.1'], [2, 'es.2']] },
            { k: 'animExport', t: 'button', hint: true, act: () => exportAnimation() }
          ]
        }
      ]
    },
    {
      id: 'draw', groups: [
        {
          id: 'brush', items: [
            { k: 'drawToggle', t: 'button', act: () => setTool(TOOL === 'paint' ? 'pan' : 'paint') },
            {
              k: 'brushType', t: 'select',
              o: [['marker', 'bt.marker'], ['pen', 'bt.pen'], ['scribble', 'bt.scribble'],
                  ['calligraphy', 'bt.calligraphy'], ['chalk', 'bt.chalk'], ['spray', 'bt.spray'],
                  ['dashed', 'bt.dashed'], ['highlighter', 'bt.highlighter']]
            },
            { k: 'brushColor', t: 'color' },
            { k: 'brushWidth', t: 'range', min: 0.1, max: 12, step: 0.05, u: '%', px: true, hint: true },
            { k: 'undoDraw', t: 'button', act: () => { S.paint.pop(); scheduleRender(); save(); } },
            { k: 'clearDraw', t: 'button', danger: true, act: () => { S.paint = []; scheduleRender(); save(); status(t('ui.cleared')); } }
          ]
        }
      ]
    },
    {
      id: 'presets', groups: [
        {
          id: 'saved', items: [
            { k: 'presetList', t: 'presets' }
          ]
        }
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
  let TOOL = 'pan';      // pan | paint
  let drawing = null;
  let dragImage = null;   // click-drag on the artboard moves the picture
  let selected = false;   // the frame and handles only show once you pick the picture up
  let playing = false;    // animation preview
  let playRaf = 0;
  let playT0 = 0;
  let scrubT = 0;         // 0..1, where the scrubber is parked while stopped

  const $ = sel => document.querySelector(sel);
  const view = $('#view');
  const vctx = view.getContext('2d');

  /* ---------------- UI builder ---------------- */
  let canvasCount = 0;   // controls owned by the always-visible canvas block

  function buildUI() {
    controls = [];
    buildCanvasBlock();
    canvasCount = controls.length;
    buildTabStrip();
    buildTabBody();
    applyStaticText();
  }

  function buildCanvasBlock() {
    const root = $('#canvasBlock');
    root.innerHTML = '';
    CANVAS_ITEMS.forEach(it => root.appendChild(buildControl(it)));
    const card = $('#canvasCard');
    card.classList.toggle('closed', !S.canvasOpen);
    $('#canvasTitle').textContent = t('ui.canvas');
    const c = Engine.canvasPx(S);
    $('#canvasSummary').textContent = c.W + ' \u00d7 ' + c.H;
  }

  function buildTabStrip() {
    const strip = $('#tabs');
    strip.innerHTML = '';
    TABS.forEach(tab => {
      const b = U.el('button', S.tab === tab.id ? 'on' : '', t('tab.' + tab.id));
      b.type = 'button';
      b.setAttribute('aria-pressed', S.tab === tab.id);
      b.onclick = () => {
        if (tab.id !== 'anim') stopPlay();
        S.tab = tab.id;
        buildUI();
        save();
      };
      strip.appendChild(b);
    });
  }

  function buildTabBody() {
    const root = $('#panels');
    // drop the previous tab's controls rather than piling more on top
    controls.length = canvasCount;
    const typed = $('#presetName') ? $('#presetName').value : null;
    root.innerHTML = '';
    const tab = TABS.find(x => x.id === S.tab) || TABS[0];
    tab.groups.forEach(group => {
      const sec = U.el('section', 'sec');
      sec.appendChild(U.el('h3', 'sec-h', t('g.' + group.id)));
      group.items.forEach(item => sec.appendChild(buildControl(item)));
      root.appendChild(sec);
    });
    refresh();
    if (typed && $('#presetName')) $('#presetName').value = typed;
  }

  function applyStaticText() {
    $('#pick').textContent = t('ui.upload');
    $('#dropHint').textContent = t('ui.drop');
    $('#fit').textContent = t('ui.fit');
    $('#exportPng').textContent = t('ui.png');
    $('#exportSvg').textContent = t('ui.svg');
    $('#stage').dataset.drop = t('ui.dropOver');
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
    const val = U.el('span', 'val');
    let input;

    const commit = (v) => {
      if (it.k === 'animScrub') { stopPlay(); scrubT = U.clamp(v, 0, 100) / 100; renderAnimFrame(scrubT); return; }
      S[it.k] = v;
      onChange(it);
    };

    if (it.t === 'button') {
      input = U.el('button', 'btn small full' + (it.danger ? ' danger' : ''), t('l.' + it.k));
      input.type = 'button';
      input.onclick = it.act;
      row.classList.add('col');
      row.appendChild(input);
      it._row = row; it._input = input; it._val = val;
      controls.push(it);
      return row;
    }

    row.appendChild(lab);

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
      input.onchange = () => commit(parseFloat(input.value) || 0);
      row.appendChild(input);
    } else if (it.t === 'select') {
      input = U.el('select');
      input.id = 'c-' + it.k;
      it.o.forEach(o => {
        const op = U.el('option', null, o[1] ? t('o.' + o[1]) : o[2]);
        op.value = o[0];
        input.appendChild(op);
      });
      input.onchange = () => {
        let v = input.value;
        if (typeof it.o[0][0] === 'number') v = parseFloat(v);
        commit(v);
      };
      row.appendChild(input);
    } else if (it.t === 'check') {
      input = U.el('input');
      input.type = 'checkbox';
      input.id = 'c-' + it.k;
      input.setAttribute('role', 'switch');
      input.onchange = () => commit(input.checked);
      lab.htmlFor = input.id;
      row.appendChild(input);
    } else if (it.t === 'color') {
      input = U.el('div', 'colorField');
      const sw = U.el('input', 'swatch');
      sw.type = 'color';
      sw.id = 'c-' + it.k;
      const hex = U.el('input', 'hex');
      hex.type = 'text';
      hex.maxLength = 7;
      hex.spellcheck = false;
      hex.setAttribute('aria-label', t('l.' + it.k) + ' hex');

      const show = (v) => { sw.value = v; hex.value = String(v).toUpperCase(); };
      sw.oninput = () => { hex.value = sw.value.toUpperCase(); commit(sw.value); };
      const takeHex = () => {
        let v = hex.value.trim();
        if (v && v[0] !== '#') v = '#' + v;
        if (/^#[0-9a-fA-F]{3}$/.test(v)) v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
        if (!/^#[0-9a-fA-F]{6}$/.test(v)) { show(S[it.k]); return; }   // put back what it was
        show(v);
        commit(v);
      };
      hex.onchange = takeHex;
      hex.onkeydown = (e) => { if (e.key === 'Enter') { takeHex(); hex.blur(); } };

      input.appendChild(hex);      // the code first: it is what people type
      input.appendChild(sw);
      row.appendChild(input);
      it._show = show;
    } else if (it.t === 'palette') {
      input = U.el('div', 'pal');
      row.classList.add('col');
      row.appendChild(input);
      it._render = () => renderPalette(input);
    } else if (it.t === 'presets') {
      input = U.el('div', 'presets');
      row.classList.add('col');
      row.appendChild(input);
      it._render = () => renderPresets(input);
    } else if (it.t === 'align') {
      input = U.el('div', 'align');
      for (let vy = 0; vy < 3; vy++) {
        for (let hx = 0; hx < 3; hx++) {
          const b = U.el('button');
          b.type = 'button';
          b.dataset.h = hx;
          b.dataset.v = vy;
          b.title = ['left', 'centre', 'right'][hx] + ' / ' + ['top', 'middle', 'bottom'][vy];
          b.onclick = () => alignImage(hx / 2, vy / 2);
          input.appendChild(b);
        }
      }
      row.appendChild(input);
    }

    if (it.hint) {
      // the alignment grid keeps the normal label-left / control-right row; a hint
      // below it spans the full width on its own
      if (it.t !== 'align') row.classList.add('col');
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
      inp.title = String(c).toUpperCase();
      inp.oninput = () => {
        S.ringColors[i] = inp.value;
        inp.title = inp.value.toUpperCase();
        scheduleRender(); save();
      };
      const del = U.el('button', 'x', '×');
      del.type = 'button';
      del.onclick = () => {
        if (S.ringColors.length <= 1) return;
        S.ringColors.splice(i, 1);
        renderPalette(box);
        scheduleRender(); save();
      };
      w.appendChild(inp);
      w.appendChild(del);
      box.appendChild(w);
    });
    const add = U.el('button', 'chip add', '+');
    add.type = 'button';
    add.onclick = () => {
      S.ringColors.push(S.ringColors[S.ringColors.length - 1] || '#000000');
      renderPalette(box);
      scheduleRender(); save();
    };
    box.appendChild(add);
  }

  function renderPresets(box) {
    box.innerHTML = '';

    // save row
    const bar = U.el('div', 'preset-new');
    const name = U.el('input', 'numbox');
    name.type = 'text';
    name.id = 'presetName';
    name.placeholder = t('ui.presetName');
    name.maxLength = 60;
    const add = U.el('button', 'btn small');
    add.type = 'button';
    add.textContent = t('ui.presetSave');
    const commit = async () => {
      const n = name.value.trim();
      if (!n) { name.focus(); return; }
      add.disabled = true;
      try {
        await Presets.save(n, strokeSettings());
        name.value = '';
        status(t('ui.presetSaved', n));
      } catch (e) {
        status(t('ui.presetFail'), true);
      }
      add.disabled = false;
    };
    add.onclick = commit;
    name.onkeydown = e => { if (e.key === 'Enter') commit(); };
    bar.appendChild(name);
    bar.appendChild(add);
    if (Presets.canWrite) box.appendChild(bar);

    // where these live
    const note = U.el('div', 'hint2');
    note.textContent = Presets.mode === 'shared' ? t('ui.presetShared')
      : Presets.mode === 'local' ? t('ui.presetLocal') : t('ui.presetLoading');
    box.appendChild(note);

    const list = U.el('div', 'preset-list');
    box.appendChild(list);

    const items = Presets.items;
    if (!items.length) {
      list.appendChild(U.el('div', 'hint2', t('ui.presetEmpty')));
      return;
    }

    const rows = [];
    items.forEach(pr => {
      const row = U.el('div', 'preset');

      const sw = U.el('div', 'preset-sw');
      const cols = [pr.settings && pr.settings.bg].concat((pr.settings && pr.settings.ringColors) || []);
      cols.filter(Boolean).slice(0, 5).forEach(c => {
        const d = U.el('i');
        d.style.background = c;
        sw.appendChild(d);
      });

      const meta = U.el('div', 'preset-meta');
      const nm = U.el('div', 'preset-name');
      nm.textContent = pr.name || 'Untitled';
      const by = U.el('div', 'preset-by');
      by.textContent = ' ';
      meta.appendChild(nm);
      meta.appendChild(by);

      const use = U.el('button', 'btn small');
      use.type = 'button';
      use.textContent = t('ui.presetApply');
      use.onclick = () => { applyStrokeSettings(pr.settings || {}); status(t('ui.presetApplied', pr.name || '')); };

      row.appendChild(sw);
      row.appendChild(meta);
      row.appendChild(use);

      const mine = !pr.builtin &&
        (Presets.mode === 'local' || (pr.by && pr.by === Presets.uid));
      if (mine) {
        const del = U.el('button', 'btn small danger');
        del.type = 'button';
        del.textContent = '\u00d7';
        del.title = t('ui.presetDelete');
        del.onclick = async () => {
          if (!confirm(t('ui.presetConfirm', pr.name || ''))) return;
          try { await Presets.remove(pr.id); } catch (e) { status(t('ui.presetFail'), true); }
        };
        row.appendChild(del);
      }

      if (pr.builtin) by.textContent = t('ui.presetBuiltin');
      list.appendChild(row);
      if (!pr.builtin) rows.push({ by: pr.by, el: by });
    });

    // names resolve per viewer, so ask on every render rather than storing them
    const ids = [...new Set(rows.map(r => r.by).filter(Boolean))];
    if (ids.length) {
      Presets.names(ids).then(ps => {
        rows.forEach(r => {
          if (!r.by) return;
          const prof = ps[r.by];
          r.el.textContent = prof && prof.name ? prof.name : t('ui.someone');
        });
      });
    }
  }

  /* Move the image so the subject itself sits against the chosen edge. An earlier
     version also reserved room for the strokes, but at ordinary scales that made
     the padded box taller than the canvas and every position landed in the same
     place. Strokes may now bleed off the edge — lower Scale if you don't want
     that. */
  function alignImage(hx, vy) {
    const c = Engine.canvasPx(S);
    const r = Engine.subjectRect(IMG, S, c.W, c.H, TOKEN);
    if (!r) return;
    const unit = Engine.computeUnit(S.basis, c.W, c.H);
    S.imgX = U.clamp(S.imgX + (hx * (c.W - r.w) - r.x) / unit * 100, -150, 150);
    S.imgY = U.clamp(S.imgY + (vy * (c.H - r.h) - r.y) / unit * 100, -150, 150);
    refresh(); scheduleRender(); save();
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
    if (playing) { save(); return; }     // the play loop draws its own frames
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
      if (it.t === 'button') {
        if (it.k === 'drawToggle') {
          it._input.textContent = t(TOOL === 'paint' ? 'l.drawToggleOn' : 'l.drawToggle');
          it._input.classList.toggle('active', TOOL === 'paint');
        } else if (it.k === 'animPlay') {
          it._input.textContent = t(playing ? 'l.animStop' : 'l.animPlay');
          it._input.classList.toggle('active', playing);
        } else if (it.k === 'animExport') {
          const gif = S.animFormat === 'gif';
          const n = gif ? Anim.gifFrameCount(S) : Anim.frameCount(S);
          const rate = gif ? Anim.gifRate() : Anim.FPS;
          it._input.textContent = t('l.animExport') + '  \u00b7  ' + n + ' \u00d7 ' + rate + 'fps';
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
        it._val.innerHTML = '<span class="pct">' + Math.round(scrubT * 100) + '%</span>';
        return;
      }
      const v = S[it.k];
      if (it.t === 'range') {
        it._input.value = v;
        it._num.value = Math.round(v * 1000) / 1000;
        const pct = (v - it.min) / (it.max - it.min) * 100;
        it._input.style.setProperty('--fill', U.clamp(pct, 0, 100) + '%');
        let s = '<span class="pct">' + U.nice(v, 2) + (it.u || '') + '</span>';
        if (it.px) s += ' <span class="px">' + U.nice(v / 100 * unit, 1) + 'px</span>';
        it._val.innerHTML = s;
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
     display's pixel ratio — not at the canvas's own size.

     An upload plus its margin is often only ~700px, and the artboard then
     magnifies it to fill the pane: rendering 744px and displaying it across 1800
     physical pixels is what made uploads look soft. Capped by the quality
     setting, and never past twice the canvas, beyond which there is nothing left
     to resolve. */
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
    const rw = d.w, rh = d.h;
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
    drawFrame();
    const mp = c.W * c.H / 1e6;
    $('#dims').textContent = c.W + ' × ' + c.H + ' px';
    $('#scaleinfo').textContent = Math.round(performance.now() - t0) + 'ms';
    if (mp > 40) status(t('ui.heavy', U.nice(mp, 0)));
  }

  function fitView() {
    const vp = $('#viewport');
    const pad = 64;
    const aw = vp.clientWidth - pad, ah = vp.clientHeight - pad;
    const s = Math.min(aw / view.width, ah / view.height, 4);
    const w = Math.round(view.width * s), h = Math.round(view.height * s);
    view.style.width = w + 'px';
    view.style.height = h + 'px';
    const board = $('#board'), cur = $('#cursor');
    if (board) { board.style.width = w + 'px'; board.style.height = h + 'px'; }
    if (cur) {
      cur.style.width = w + 'px';
      cur.style.height = h + 'px';
      if (cur.width !== view.width || cur.height !== view.height) {
        cur.width = view.width; cur.height = view.height;
      }
    }
  }

  /* Hand a finished file to the viewer.

     A browser will only start a download it can attribute to a click, and
     Safari in particular refuses one that lands seconds later — which is every
     GIF, since encoding a loop takes far longer than a PNG. So the automatic
     save is still attempted, and the status bar also gets a real link: clicking
     that is a genuine gesture and always works. */
  function offerFile(blob, name, msg) {
    const url = URL.createObjectURL(blob);
    const bar = $('#status');
    bar.className = '';
    bar.textContent = msg + '  ';
    const link = U.el('a', 'savelink', t('ui.save'));
    link.href = url;
    link.download = name;
    bar.appendChild(link);

    const auto = document.createElement('a');
    auto.href = url;
    auto.download = name;
    auto.style.display = 'none';
    document.body.appendChild(auto);
    try { auto.click(); } catch (e) { /* blocked: the link above still works */ }
    auto.remove();

    // keep the object alive long enough for the manual link to be used
    setTimeout(() => URL.revokeObjectURL(url), 180000);
  }

  function status(msg, bad) {
    const s = $('#status');
    s.textContent = msg || '';          // also drops any Save link still shown
    s.className = bad ? 'bad' : '';
  }

  /* ---------------- image loading ---------------- */
  /* A new picture starts clean. Without this, whatever you did to the last image —
     background removed, thresholded, cropped to its cut-out — silently lands on
     the next one. Canvas, strokes and colours are your design, so they stay. */
  function resetImageSettings() {
    const d = defaults();
    [
      'fit', 'fitSubject', 'imgScale', 'imgX', 'imgY', 'rotate', 'flipH', 'flipV',
      'maskSource', 'maskThreshold', 'maskInvert', 'maskFillHoles', 'maskSmooth', 'maskExpand',
      'bgMode', 'artMode', 'artOpacity', 'brightness', 'contrast', 'saturation',
      'artInvert', 'posterize', 'bwThreshold', 'ditherMode', 'ditherStrength',
      'ditherScale', 'artClip', 'paperTransparent', 'grainAmount'
    ].forEach(k => { S[k] = d[k]; });
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
        selected = false;
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
     picture is placed at exactly 1:1 so it stays as sharp as the file.

     Matching the picture's size exactly — which is what this did at first —
     leaves the silhouette filling the whole frame, so every stroke lands outside
     the canvas and the tool appears to do nothing at all. The strokes need
     somewhere to go. */
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

  /* Transparent background, so it behaves like a real cut-out and the default
     Photo mode still shows the strokes around it. */
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

  /* Pointer -> canvas pixel space. clientWidth/Height round to whole pixels, so
     derive the content box from the fractional rect instead. */
  function pointerPos(e) {
    const r = view.getBoundingClientRect();
    const bx = view.clientLeft, by = view.clientTop;
    const cw = r.width - bx * 2 || 1;
    const ch = r.height - by * 2 || 1;
    return {
      x: (e.clientX - r.left - bx) / cw * view.width,
      y: (e.clientY - r.top - by) / ch * view.height
    };
  }

  function setTool(name) {
    TOOL = name;
    const board = $('#board');
    board.classList.toggle('tool', name === 'paint');
    board.classList.toggle('move', name !== 'paint');
    if (name !== 'paint') { clearCursor(); drawFrame(); }
    status(name === 'paint' ? t('ui.hintPaint') : '');
    applyStaticText();
    refresh();
  }

  function clearCursor() {
    const c = $('#cursor');
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
  }

  /* the picture's frame and its four grab handles */
  function drawFrame() {
    const c = $('#cursor');
    if (c.width !== view.width || c.height !== view.height) {
      c.width = view.width; c.height = view.height;
    }
    const x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    if (TOOL === 'paint' || dragImage || !selected) return;
    const cs = frameCorners();
    if (!cs) return;
    const k = Math.max(1, view.width / 900);
    x.strokeStyle = 'rgba(28,174,166,.85)';
    x.lineWidth = k;
    x.setLineDash([6 * k, 4 * k]);
    x.beginPath();
    x.moveTo(cs[0].x, cs[0].y);
    for (let i = 1; i < 4; i++) x.lineTo(cs[i].x, cs[i].y);
    x.closePath();
    x.stroke();
    x.setLineDash([]);
    const h = 5 * k;
    for (const p of cs) {
      x.fillStyle = '#fff';
      x.fillRect(p.x - h, p.y - h, h * 2, h * 2);
      x.strokeStyle = '#1CAEA6';
      x.lineWidth = 1.5 * k;
      x.strokeRect(p.x - h, p.y - h, h * 2, h * 2);
    }
  }

  function drawCursor(e) {
    const c = $('#cursor');
    if (TOOL !== 'paint') {
      if (!dragImage) {
        const q = pointerPos(e);
        const board = $('#board');
        board.classList.toggle('resizing', handleAt(q) >= 0);
        board.classList.toggle('over-image', overImage(q));
      }
      return;
    }
    if (c.width !== view.width || c.height !== view.height) {
      c.width = view.width; c.height = view.height;
    }
    const x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    const q = pointerPos(e);
    const d = Math.max(4, S.brushWidth / 100 * Engine.computeUnit(S.basis, view.width, view.height));
    x.lineWidth = Math.max(1, view.width / 600);
    x.strokeStyle = '#16191A';
    x.beginPath();
    x.arc(q.x, q.y, d / 2, 0, Math.PI * 2);
    x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.85)';
    x.beginPath();
    x.arc(q.x, q.y, d / 2 + x.lineWidth, 0, Math.PI * 2);
    x.stroke();
  }

  /* Drag the picture around, corners to scale, wheel to zoom.

     A move re-renders at about a second a frame, because shifting the picture
     moves the silhouette and the distance transform has to run again. But the
     strokes and the artwork all translate WITH the picture, and the background is
     a flat fill — so during the drag the last rendered frame is simply blitted at
     an offset, which is exact and costs one drawImage. The real render happens
     once, on release. Scaling previews the same way; that one is approximate
     (stroke weights scale with it) and snaps true when you let go. */
  let dragBase = null;

  function snapshot() {
    const c = U.createCanvas(view.width, view.height);
    c.getContext('2d').drawImage(view, 0, 0);
    return c;
  }

  function blit(dx, dy, scale, ax, ay) {
    vctx.setTransform(1, 0, 0, 1, 0, 0);
    vctx.fillStyle = S.bg;
    vctx.fillRect(0, 0, view.width, view.height);
    vctx.save();
    if (scale !== 1) {
      vctx.translate(ax, ay);
      vctx.scale(scale, scale);
      vctx.translate(-ax, -ay);
    }
    vctx.drawImage(dragBase, dx, dy);
    vctx.restore();
  }

  /* corners of the picture on the artboard, in canvas pixels */
  function frameCorners() {
    if (!IMG) return null;
    const r = Engine.subjectRect(IMG, S, view.width, view.height, TOKEN);
    if (!r) return null;
    return [
      { x: r.x, y: r.y }, { x: r.x + r.w, y: r.y },
      { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }
    ];
  }

  function handleAt(q) {
    if (!selected) return -1;
    const cs = frameCorners();
    if (!cs) return -1;
    const reach = Math.max(10, view.width * 0.022);
    for (let i = 0; i < 4; i++) {
      if (Math.hypot(q.x - cs[i].x, q.y - cs[i].y) <= reach) return i;
    }
    return -1;
  }

  function overImage(q) {
    const cs = frameCorners();
    if (!cs) return false;
    const xs = cs.map(c => c.x), ys = cs.map(c => c.y);
    const pad = Math.max(2, view.width * 0.004);
    return q.x >= Math.min.apply(null, xs) - pad && q.x <= Math.max.apply(null, xs) + pad &&
           q.y >= Math.min.apply(null, ys) - pad && q.y <= Math.max.apply(null, ys) + pad;
  }

  function setSelected(on) {
    if (selected === on) return;
    selected = on;
    $('#board').classList.toggle('picked', on);
    drawFrame();
  }

  function beginDrag(e) {
    if (!IMG) return;
    const q = pointerPos(e);
    const h = handleAt(q);
    // clicking off the picture puts it down again
    if (h < 0 && !overImage(q)) { setSelected(false); return; }
    setSelected(true);
    dragBase = snapshot();
    const common = {
      id: e.pointerId, x: e.clientX, y: e.clientY,
      imgX: S.imgX, imgY: S.imgY, scale: S.imgScale, css: viewScale()
    };
    if (h >= 0) {
      const cs = frameCorners();
      const anchor = cs[(h + 2) % 4];          // the corner you are pulling against
      const src = Engine.canvasToSource(IMG, S, view.width, view.height, anchor.x, anchor.y);
      const d0 = Math.hypot(q.x - anchor.x, q.y - anchor.y);
      dragImage = Object.assign({ mode: 'scale', anchor: anchor, src: src, d0: Math.max(1, d0) }, common);
    } else {
      dragImage = Object.assign({ mode: 'move' }, common);
    }
    view.setPointerCapture(e.pointerId);
    $('#board').classList.add('grabbing');
    clearCursor();
  }

  /* canvas pixels per CSS pixel, so a drag tracks the pointer exactly */
  function viewScale() {
    const r = view.getBoundingClientRect();
    return view.width / (r.width || 1);
  }

  function moveDrag(e) {
    if (!dragImage) return;
    const unit = Engine.computeUnit(S.basis, view.width, view.height);

    if (dragImage.mode === 'move') {
      const dx = (e.clientX - dragImage.x) * dragImage.css;
      const dy = (e.clientY - dragImage.y) * dragImage.css;
      S.imgX = U.clamp(dragImage.imgX + dx / unit * 100, -150, 150);
      S.imgY = U.clamp(dragImage.imgY + dy / unit * 100, -150, 150);
      blit(dx, dy, 1, 0, 0);
      return;
    }

    const q = pointerPos(e);
    const a = dragImage.anchor;
    const f = Math.hypot(q.x - a.x, q.y - a.y) / dragImage.d0;
    const next = U.clamp(dragImage.scale * f, 5, 300);
    S.imgScale = next;
    // hold the opposite corner still
    S.imgX = dragImage.imgX; S.imgY = dragImage.imgY;
    const now = Engine.sourceToCanvas(IMG, S, view.width, view.height, dragImage.src.x, dragImage.src.y);
    S.imgX = U.clamp(dragImage.imgX + (a.x - now.x) / unit * 100, -150, 150);
    S.imgY = U.clamp(dragImage.imgY + (a.y - now.y) / unit * 100, -150, 150);
    blit(0, 0, next / dragImage.scale, a.x, a.y);
  }

  function endDrag(e) {
    if (!dragImage) return;
    dragImage = null;
    dragBase = null;
    try { view.releasePointerCapture(e.pointerId); } catch (err) { /* gone */ }
    $('#board').classList.remove('grabbing');
    refresh(); save();
    scheduleRender();
  }

  /* zoom about the pointer: the bit of picture under the cursor stays put */
  function wheelZoom(e) {
    if (!IMG || TOOL === 'paint') return;
    e.preventDefault();
    const q = pointerPos(e);
    const before = Engine.canvasToSource(IMG, S, view.width, view.height, q.x, q.y);
    if (!before) return;
    const factor = Math.exp(-e.deltaY * 0.0015);
    S.imgScale = U.clamp(S.imgScale * factor, 5, 300);
    const after = Engine.sourceToCanvas(IMG, S, view.width, view.height, before.x, before.y);
    const unit = Engine.computeUnit(S.basis, view.width, view.height);
    S.imgX = U.clamp(S.imgX + (q.x - after.x) / unit * 100, -150, 150);
    S.imgY = U.clamp(S.imgY + (q.y - after.y) / unit * 100, -150, 150);
    scheduleRender();
    clearTimeout(wheelZoom._t);
    wheelZoom._t = setTimeout(() => { refresh(); save(); }, 200);
  }

  function beginStroke(e) {
    if (TOOL !== 'paint') { beginDrag(e); return; }
    const q = pointerPos(e);
    view.setPointerCapture(e.pointerId);
    drawing = {
      color: S.brushColor, width: S.brushWidth, type: S.brushType,
      points: [[q.x / view.width, q.y / view.height]]
    };
    S.paint.push(drawing);
    scheduleRender();
  }

  function extendStroke(e) {
    drawCursor(e);
    if (dragImage) { moveDrag(e); return; }
    if (!drawing) return;
    const q = pointerPos(e);
    const nx = q.x / view.width, ny = q.y / view.height;
    const last = drawing.points[drawing.points.length - 1];
    if (Math.hypot(nx - last[0], ny - last[1]) < 0.002) return;
    drawing.points.push([nx, ny]);
    scheduleRender();          // cheap: the base layer is cached
  }

  function endStroke(e) {
    if (dragImage) { endDrag(e); return; }
    if (!drawing) return;
    drawing = null;
    try { view.releasePointerCapture(e.pointerId); } catch (err) { /* already gone */ }
    save();
  }

  function bindTools() {
    view.addEventListener('pointerdown', beginStroke);
    view.addEventListener('pointermove', extendStroke);
    view.addEventListener('pointerup', endStroke);
    view.addEventListener('pointercancel', endStroke);
    view.addEventListener('wheel', wheelZoom, { passive: false });
    view.addEventListener('pointerleave', () => {
      if (drawing || dragImage) return;
      clearCursor();
      drawFrame();
      $('#board').classList.remove('resizing', 'over-image');
    });

    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && S.paint.length) {
        e.preventDefault();
        S.paint.pop();
        scheduleRender(); save();
        return;
      }
      if (e.key === 'Escape') { setSelected(false); return; }
      if (e.key === 'b') setTool(TOOL === 'paint' ? 'pan' : 'paint');
    });
  }

  /* ---------------- animation ---------------- */

  /* Playback gets its own ceiling. A frame costs about 50ms at 700px and scales
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
    fitView();
  }

  function tick(now) {
    if (!playing) return;
    const ms = Math.max(100, S.animSeconds * 1000);
    const t = ((now - playT0) % ms) / ms;
    scrubT = t;
    renderAnimFrame(t);
    playRaf = requestAnimationFrame(tick);
  }

  function startPlay() {
    if (playing || !IMG) return;
    playing = true;
    setTool('pan');
    setSelected(false);
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

  async function exportAnimation() {
    if (!IMG) return;
    stopPlay();
    const c = Engine.canvasPx(S);
    const W = Math.round(c.W * S.animScale), H = Math.round(c.H * S.animScale);
    const n = Anim.frameCount(S);
    const step = (i, total) => status(t('ui.animProgress', Math.round(i / total * 100)));
    const stamp = W + 'x' + H;

    try {
      if (S.animFormat === 'png') {
        if (n > 40 && !confirm(t('ui.animManyFrames', n))) return;
        status(t('ui.animProgress', 0));
        const list = Anim.frames(S, IMG, W, H, TOKEN, step);
        for (let i = 0; i < list.length; i++) {
          const blob = await new Promise(r => list[i].toBlob(r, 'image/png'));
          U.download(blob, 'stroke-' + stamp + '-' + String(i + 1).padStart(3, '0') + '.png');
          await new Promise(r => setTimeout(r, 120));   // browsers throttle bursts
        }
        status(t('ui.animSavedFrames', list.length));
        return;
      }
      if (S.animFormat === 'webm') {
        const blob = await Anim.toWebM(S, IMG, W, H, TOKEN, step);
        offerFile(blob, 'stroke-' + stamp + '.webm',
          t('ui.animSaved', 'WebM', Math.round(blob.size / 1024)));
        return;
      }
      const blob = await Anim.toGIF(S, IMG, W, H, TOKEN, step);
      offerFile(blob, 'stroke-' + stamp + '.gif',
        t('ui.animSaved', 'GIF', Math.round(blob.size / 1024)));
    } catch (e) {
      status(t('ui.animFail') + e.message, true);
      console.error(e);
    }
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
          offerFile(b, 'strokes-' + W + 'x' + H + '.png', t('ui.savedPng', W, H));
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
        offerFile(new Blob([svg], { type: 'image/svg+xml' }),
          'strokes-' + c.W + 'x' + c.H + '.svg', t('ui.savedSvg', Math.round(svg.length / 1024)));
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
    save();
  }

  function resetAll() {
    if (!confirm(t('ui.resetConfirm'))) return;
    const lang = S.lang, tab = S.tab;
    S = defaults();
    S.lang = lang; S.tab = tab;
    TOOL = 'pan';
    selected = false;
    Engine.clearCache();
    buildUI();
    scheduleRender();
    save();
  }

  /* ---------------- boot ---------------- */
  function boot() {
    load();
    I18N.setLang(S.lang);
    buildUI();

    $('#canvasToggle').onclick = () => {
      S.canvasOpen = !S.canvasOpen;
      $('#canvasCard').classList.toggle('closed', !S.canvasOpen);
      save();
    };

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
    $('#board').classList.add('move');

    $('#exportPng').onclick = exportPNG;
    $('#exportSvg').onclick = exportSVG;
    $('#fit').onclick = fitView;
    window.addEventListener('resize', fitView);

    window.OFFSET = {
      get settings() { return S; },
      get image() { return IMG; },
      get tool() { return TOOL; },
      render: doRender,
      align: alignImage,
      defaults: defaults,
      setLang: setLang
    };

    Presets.onChange(() => {
      if (S.tab === 'presets') buildTabBody();
    });
    Presets.init();

    exampleImage();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();

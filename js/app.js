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
      lang: 'en', tab: 'strokes',
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
      id: 'presets', groups: [
        {
          id: 'saved', items: [
            { k: 'presetList', t: 'presets' }
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
  }

  function buildTabStrip() {
    const strip = $('#tabs');
    strip.innerHTML = '';
    TABS.forEach(tab => {
      const b = U.el('button', S.tab === tab.id ? 'on' : '', t('tab.' + tab.id));
      b.type = 'button';
      b.setAttribute('aria-pressed', S.tab === tab.id);
      b.onclick = () => { S.tab = tab.id; buildUI(); save(); };
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

    const commit = (v) => { S[it.k] = v; onChange(it); };

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
      input.onchange = () => commit(input.checked);
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
      inp.oninput = () => { S.ringColors[i] = inp.value; scheduleRender(); save(); };
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

      const mine = Presets.mode === 'local' || (pr.by && pr.by === Presets.uid);
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

      list.appendChild(row);
      rows.push({ by: pr.by, el: by });
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
        } else if (it.k === 'bgToggle') {
          const on = S.bgMode !== 'off';
          it._input.textContent = t(on ? 'l.bgToggleOn' : 'l.bgToggle');
          it._input.classList.toggle('active', on);
        }
        return;
      }
      if (it.t === 'align') return;
      const v = S[it.k];
      if (it.t === 'range') {
        it._input.value = v;
        it._num.value = Math.round(v * 1000) / 1000;
        let s = '<span class="pct">' + U.nice(v, 2) + (it.u || '') + '</span>';
        if (it.px) s += ' <span class="px">' + U.nice(v / 100 * unit, 1) + 'px</span>';
        it._val.innerHTML = s;
      } else if (it.t === 'check') it._input.checked = !!v;
      else if (it.t === 'palette') it._render();
      else if (it.t === 'presets') it._render();
      else if (it._input && it._input.tagName) it._input.value = v;
    });
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

  function status(msg, bad) {
    const s = $('#status');
    s.textContent = msg || '';
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

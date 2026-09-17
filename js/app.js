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
      fit: 'contain', fitSubject: true, imgScale: 78, imgX: 0, imgY: 0,
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
      // background removal
      bgMode: 'off', bgKeyColor: '#ffffff', bgTolerance: 12,
      bgContiguous: true, bgFeather: 0.15,
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
    { k: 'bg', t: 'color' }
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
            { k: 'maskThreshold', t: 'range', min: 0, max: 255, step: 1, show: s => s.maskSource !== 'alpha' },
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
            { k: 'bgMode', t: 'select', hint: true, o: [['off', 'bg.off'], ['auto', 'bg.auto'], ['color', 'bg.color']] },
            { k: 'bgKeyColor', t: 'color', show: s => s.bgMode === 'color' },
            { k: 'bgTolerance', t: 'range', min: 0, max: 100, step: 0.5, u: '%', show: s => s.bgMode !== 'off' },
            { k: 'bgFeather', t: 'range', min: 0, max: 3, step: 0.01, u: '%', show: s => s.bgMode !== 'off' },
            { k: 'bgContiguous', t: 'check', hint: true, show: s => s.bgMode !== 'off' }
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
      id: 'draw', groups: [
        {
          id: 'brush', items: [
            { k: 'drawToggle', t: 'button', act: () => setTool(TOOL === 'paint' ? 'pan' : 'paint') },
            { k: 'brushType', t: 'select', o: [['marker', 'bt.marker'], ['scribble', 'bt.scribble'], ['highlighter', 'bt.highlighter']] },
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
  let TOOL = 'pan';      // pan | paint | pick
  let drawing = null;

  const $ = sel => document.querySelector(sel);
  const view = $('#view');
  const vctx = view.getContext('2d');

  /* ---------------- UI builder ---------------- */
  function buildUI() {
    controls = [];
    buildCanvasBlock();
    buildTabStrip();
    buildTabBody();
    applyStaticText();
    refresh();
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
    root.innerHTML = '';
    const tab = TABS.find(x => x.id === S.tab) || TABS[0];
    tab.groups.forEach(group => {
      const sec = U.el('section', 'sec');
      sec.appendChild(U.el('h3', 'sec-h', t('g.' + group.id)));
      group.items.forEach(item => sec.appendChild(buildControl(item)));
      root.appendChild(sec);
    });
  }

  function applyStaticText() {
    $('#pick').textContent = t('ui.upload');
    $('#dropHint').textContent = t('ui.drop');
    $('#reset').textContent = t('ui.reset');
    $('#fit').textContent = t('ui.fit');
    $('#exportPng').textContent = t('ui.png');
    $('#exportSvg').textContent = t('ui.svg');
    $('#stage').dataset.drop = t('ui.dropOver');
    $('#srcinfo').textContent = srcLabel === null ? t('ui.exampleLoaded') : srcLabel;
    const names = { pan: 'tPan', paint: 'tPaint', pick: 'tPick' };
    [...document.querySelectorAll('#tools button')].forEach(b => {
      b.textContent = t('ui.' + names[b.dataset.tool]);
      b.classList.toggle('on', b.dataset.tool === TOOL);
      b.setAttribute('aria-pressed', b.dataset.tool === TOOL);
    });
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
    } else if (it.t === 'align') {
      input = U.el('div', 'align');
      row.classList.add('col');
      for (let vy = 0; vy < 3; vy++) {
        for (let hx = 0; hx < 3; hx++) {
          const b = U.el('button');
          b.type = 'button';
          b.title = ['left', 'centre', 'right'][hx] + ' / ' + ['top', 'middle', 'bottom'][vy];
          b.onclick = () => alignImage(hx / 2, vy / 2);
          input.appendChild(b);
        }
      }
      row.appendChild(input);
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

  /* Move the image so the subject — plus the space its strokes need — sits against
     the chosen edge. Aligning left should not push the outermost stroke off. */
  function alignImage(hx, vy) {
    const c = Engine.canvasPx(S);
    const r = Engine.subjectRect(IMG, S, c.W, c.H, TOKEN);
    if (!r) return;
    const unit = Engine.computeUnit(S.basis, c.W, c.H);
    const pad = Engine.strokeExtent(S, unit);
    const x0 = r.x - pad, y0 = r.y - pad;
    const w = r.w + pad * 2, h = r.h + pad * 2;
    S.imgX = U.clamp(S.imgX + (hx * (c.W - w) - x0) / unit * 100, -150, 150);
    S.imgY = U.clamp(S.imgY + (vy * (c.H - h) - y0) / unit * 100, -150, 150);
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
  function loadFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        IMG = im;
        TOKEN = file.name + ':' + file.size + ':' + Date.now();
        Engine.clearCache();
        srcLabel = file.name + ' — ' + im.naturalWidth + '×' + im.naturalHeight;
        $('#srcinfo').textContent = srcLabel;
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
    board.classList.toggle('picking', name === 'pick');
    if (name !== 'paint') clearCursor();
    const hints = { paint: 'hintPaint', pick: 'hintPick' };
    status(hints[name] ? t('ui.' + hints[name]) : '');
    applyStaticText();
    refresh();
  }

  function clearCursor() {
    const c = $('#cursor');
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
  }

  function drawCursor(e) {
    const c = $('#cursor');
    if (TOOL !== 'paint') return;
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

  function beginStroke(e) {
    if (TOOL === 'pan') return;
    const q = pointerPos(e);

    if (TOOL === 'pick') {
      const hex = Engine.pickColor(IMG, S, view.width, view.height, q.x, q.y);
      if (!hex) { status(t('ui.pickFail'), true); return; }
      S.bgKeyColor = hex;
      if (S.bgMode !== 'color') S.bgMode = 'color';
      if (S.tab !== 'image') { S.tab = 'image'; buildUI(); }
      refresh(); scheduleRender(); save();
      status(t('ui.picked', hex));
      return;
    }

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
    if (!drawing) return;
    const q = pointerPos(e);
    const nx = q.x / view.width, ny = q.y / view.height;
    const last = drawing.points[drawing.points.length - 1];
    if (Math.hypot(nx - last[0], ny - last[1]) < 0.002) return;
    drawing.points.push([nx, ny]);
    scheduleRender();          // cheap: the base layer is cached
  }

  function endStroke(e) {
    if (!drawing) return;
    drawing = null;
    try { view.releasePointerCapture(e.pointerId); } catch (err) { /* already gone */ }
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
    view.addEventListener('pointerleave', () => { if (!drawing) clearCursor(); });

    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && S.paint.length) {
        e.preventDefault();
        S.paint.pop();
        scheduleRender(); save();
        return;
      }
      const keys = { v: 'pan', b: 'paint', i: 'pick' };
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

    window.OFFSET = {
      get settings() { return S; },
      get image() { return IMG; },
      get tool() { return TOOL; },
      render: doRender,
      align: alignImage,
      defaults: defaults,
      setLang: setLang
    };

    exampleImage();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();

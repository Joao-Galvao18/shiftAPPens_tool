/* schema.js — what the tool is made of, as data.

   Everything the sidebar shows is described here and nowhere else: the sections
   in the rail, the groups inside each one, and every control in a group. The
   builder in controls.js reads this; app.js reacts to it. Nothing in this file
   touches the DOM or the engine, which is what makes the panel safe to rearrange.

   An item is:
     k      the settings key it edits, and the i18n label l.<k>
     t      control kind: range | num | select | check | color | palette |
            presets | align | button
     act    for a button, the name of an action app.js dispatches
     show   a predicate on the settings — the control hides when it is false
     u/px   display unit, and whether to also show the pixel value it works out to
     hint   render h.<k> underneath
*/
(function (g) {
  'use strict';

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

  /* The project palette. These are the colours the UI itself is built from, so
     they are one click away when you are colouring the artwork too. */
  const BRAND = ['#DF48B6', '#FFEA00', '#FE593B', '#32C4BA', '#039545', '#1A2321', '#FFFBF8'];

  /* Everything the Strokes section owns, plus the background the palette was
     picked against — without it a saved look lands on the wrong ground. */
  const STROKE_KEYS = [
    'bg',
    'ringCount', 'strokeW', 'ringGap', 'ringOffset', 'ringGrowth', 'innerRings',
    'ringColors', 'gapUseBg', 'gapColor', 'haloUseBg', 'haloColor',
    'fillUseBg', 'fillColor', 'aa',
    'maskSource', 'maskThreshold', 'maskSmooth', 'maskExpand', 'maskFillHoles', 'maskInvert'
  ];

  const EXAMPLE_SRC = [
    'assets/example.png', 'assets/example.jpg', 'assets/example.jpeg',
    'assets/example.webp', 'assets/example.avif'
  ];

  /* Settings a new picture should not inherit from the last one. Canvas, strokes
     and colours are your design, so they stay put. */
  const PER_IMAGE_KEYS = [
    'fit', 'fitSubject', 'imgScale', 'imgX', 'imgY', 'rotate', 'flipH', 'flipV',
    'maskSource', 'maskThreshold', 'maskInvert', 'maskFillHoles', 'maskSmooth', 'maskExpand',
    'bgMode', 'artMode', 'artOpacity', 'brightness', 'contrast', 'saturation',
    'artInvert', 'posterize', 'bwThreshold', 'ditherMode', 'ditherStrength',
    'ditherScale', 'artClip', 'paperTransparent', 'grainAmount'
  ];

  function defaults() {
    return {
      lang: 'en', tab: 'strokes', closedGroups: {},
      // canvas
      sizePreset: 'ig-post', units: 'px', cw: 1080, ch: 1080, dpi: 72,
      basis: 'short', previewQuality: 1200, bg: '#FFEA00',
      // placement
      fit: 'contain', fitSubject: false, imgScale: 100, imgX: 0, imgY: 0,
      rotate: 0, flipH: false, flipV: false,
      // silhouette
      maskSource: 'auto', maskThreshold: 160, maskInvert: false, maskFillHoles: true,
      maskSmooth: 0.8, maskExpand: 0,
      // strokes
      ringCount: 4, strokeW: 2.4, ringGap: 0, ringOffset: 1.6, ringGrowth: 1,
      ringColors: ['#32C4BA', '#039545'],
      gapUseBg: true, gapColor: '#FFFBF8',
      haloUseBg: true, haloColor: '#FFFBF8',
      fillUseBg: true, fillColor: '#FFFBF8',
      innerRings: 0, aa: true,
      // background removal — one switch, everything else read from the picture
      bgMode: 'off',
      // artwork
      artMode: 'photo', artOpacity: 100, brightness: 0, contrast: 10, saturation: 100,
      artInvert: false, posterize: 0,
      bwThreshold: 150, ditherMode: 'none', ditherStrength: 100, ditherScale: 0.08,
      halftoneAngle: 45, halftoneShape: 'dot',
      crispPixels: true, artClip: false, inkOn: 'dark', inkColor: '#FFFBF8',
      paperColor: '#1A2321', paperTransparent: true,
      // drawing
      paint: [], brushColor: '#DF48B6', brushWidth: 1.6, brushType: 'scribble',
      // grain
      grainAmount: 0, grainScale: 0.2, grainMono: true,
      // animation
      animType: 'radiate', animDir: 'out', animSeconds: 1.5,
      animAmount: 35, animScale: 1, animFormat: 'gif',
      animEase: true, animGrain: 0, animGrainScale: 0.25, animGrainMono: true,
      // output
      seed: 7, svgSimplify: 0.5, svgRes: 1800, exportScale: 1
    };
  }

  /* Rail icons, drawn in the same hairline geometry as the rest of the chrome. */
  const ICONS = {
    image: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><circle cx="8.5" cy="10" r="1.6"/><path d="M3 16.5 8.5 12l4 3.5L16 13l5 4.2"/>',
    strokes: '<path d="M12 3.6c4.6 0 8.4 3.8 8.4 8.4s-3.8 8.4-8.4 8.4S3.6 16.6 3.6 12 7.4 3.6 12 3.6Z"/><path d="M12 7c2.8 0 5 2.2 5 5s-2.2 5-5 5-5-2.2-5-5 2.2-5 5-5Z"/><circle cx="12" cy="12" r="1.7"/>',
    motion: '<path d="M6 3v7M6 14v7M12 3v4M12 11v10M18 3v12M18 19v2"/><circle cx="6" cy="12" r="1.9"/><circle cx="12" cy="9" r="1.9"/><circle cx="18" cy="17" r="1.9"/>',
    brush: '<path d="M14.5 3.8 20.2 9.5 9.9 19.8a3 3 0 0 1-1.5.8l-4.6 1 1-4.6a3 3 0 0 1 .8-1.5Z"/><path d="M12.6 5.7 18.3 11.4"/>',
    layers: '<path d="M12 3.2 21 8l-9 4.8L3 8Z"/><path d="M3 12.5 12 17.3l9-4.8"/><path d="M3 16.8 12 21.6l9-4.8"/>',
    frame: '<path d="M8 2.5v19M16 2.5v19M2.5 8h19M2.5 16h19"/>',
    exp: '<path d="M5 3.5h9l5 5v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z"/><path d="M12 17v-7"/><path d="M9 12.6 12 9.6l3 3"/>'
  };

  const sizeOpts = [['custom', 'size.custom']].concat(
    Object.keys(SIZE_PRESETS).map(k => [k, 'size.' + k]));

  const isBitmap = s => s.artMode === 'bitmap';
  const isPhoto = s => s.artMode === 'photo';
  const isPicture = s => s.artMode === 'photo' || s.artMode === 'bitmap';

  /* ---- the rail, top to bottom. `rule` draws the divider above an entry, the
     way the reference separates what you are making from where it goes. ---- */
  const SECTIONS = [
    {
      id: 'image', icon: 'image', groups: [
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
            { k: 'bgToggle', t: 'button', act: 'bgToggle', hint: true }
          ]
        },
        {
          id: 'treat', items: [
            { k: 'artMode', t: 'select', o: [['photo', 'am.photo'], ['bitmap', 'am.bitmap'], ['silhouette', 'am.silhouette'], ['none', 'am.none']] },
            { k: 'inkColor', t: 'color', show: s => s.artMode === 'bitmap' || s.artMode === 'silhouette' },
            { k: 'inkOn', t: 'select', o: [['dark', 'ink.dark'], ['light', 'ink.light']], show: isBitmap },
            { k: 'bwThreshold', t: 'range', min: 0, max: 255, step: 1, show: isBitmap },
            {
              k: 'ditherMode', t: 'select', show: isBitmap,
              o: [['none', 'dm.none'], ['halftone', 'dm.halftone'], ['bayer4', 'dm.bayer4'], ['bayer8', 'dm.bayer8'], ['floyd', 'dm.floyd'], ['noise', 'dm.noise']]
            },
            { k: 'ditherScale', t: 'range', min: 0.02, max: 4, step: 0.01, u: '%', px: true, show: s => isBitmap(s) && s.ditherMode !== 'none' },
            { k: 'halftoneAngle', t: 'range', min: 0, max: 90, step: 1, u: '°', show: s => isBitmap(s) && s.ditherMode === 'halftone' },
            { k: 'halftoneShape', t: 'select', o: [['dot', 'hs.dot'], ['square', 'hs.square'], ['line', 'hs.line']], show: s => isBitmap(s) && s.ditherMode === 'halftone' },
            { k: 'ditherStrength', t: 'range', min: 0, max: 200, step: 1, u: '%', show: s => isBitmap(s) && s.ditherMode !== 'none' && s.ditherMode !== 'floyd' },
            { k: 'crispPixels', t: 'check', show: isBitmap },
            { k: 'paperTransparent', t: 'check', show: isBitmap },
            { k: 'paperColor', t: 'color', show: s => isBitmap(s) && !s.paperTransparent },
            { k: 'brightness', t: 'range', min: -100, max: 100, step: 1, show: isPicture },
            { k: 'contrast', t: 'range', min: -99, max: 99, step: 1, show: isPicture },
            { k: 'saturation', t: 'range', min: 0, max: 300, step: 1, u: '%', show: isPhoto },
            { k: 'posterize', t: 'range', min: 0, max: 12, step: 1, show: isPhoto },
            { k: 'artOpacity', t: 'range', min: 0, max: 100, step: 1, u: '%' },
            { k: 'artInvert', t: 'check', show: isPicture },
            { k: 'artClip', t: 'check', hint: true, show: isPicture }
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
      id: 'strokes', icon: 'strokes', groups: [
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
      id: 'anim', icon: 'motion', groups: [
        {
          id: 'motion', items: [
            { k: 'animPlay', t: 'button', act: 'animPlay' },
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
            { k: 'animExport', t: 'button', act: 'animExport', hint: true }
          ]
        }
      ]
    },

    {
      id: 'draw', icon: 'brush', groups: [
        {
          id: 'brush', items: [
            { k: 'drawToggle', t: 'button', act: 'drawToggle' },
            {
              k: 'brushType', t: 'select',
              o: [['marker', 'bt.marker'], ['pen', 'bt.pen'], ['scribble', 'bt.scribble'],
                  ['calligraphy', 'bt.calligraphy'], ['chalk', 'bt.chalk'], ['spray', 'bt.spray'],
                  ['dashed', 'bt.dashed'], ['highlighter', 'bt.highlighter']]
            },
            { k: 'brushColor', t: 'color' },
            { k: 'brushWidth', t: 'range', min: 0.1, max: 12, step: 0.05, u: '%', px: true, hint: true },
            { k: 'undoDraw', t: 'button', act: 'undoDraw' },
            { k: 'clearDraw', t: 'button', act: 'clearDraw', danger: true }
          ]
        }
      ]
    },

    {
      id: 'presets', icon: 'layers', groups: [
        { id: 'saved', items: [{ k: 'presetList', t: 'presets' }] }
      ]
    },

    {
      id: 'canvas', icon: 'frame', rule: true, groups: [
        {
          id: 'size', items: [
            { k: 'sizePreset', t: 'select', o: sizeOpts },
            { k: 'cw', t: 'num', min: 1, step: 1 },
            { k: 'ch', t: 'num', min: 1, step: 1 },
            { k: 'units', t: 'select', o: [['px', 'units.px'], ['mm', 'units.mm'], ['in', 'units.in']] },
            { k: 'dpi', t: 'num', min: 10, max: 1200, step: 1, show: s => s.units !== 'px' },
            { k: 'bg', t: 'color' }
          ]
        },
        {
          id: 'quality', items: [
            {
              k: 'basis', t: 'select', hint: true,
              o: [['short', 'basis.short'], ['long', 'basis.long'], ['width', 'basis.width'],
                  ['height', 'basis.height'], ['diag', 'basis.diag']]
            },
            { k: 'previewQuality', t: 'range', min: 400, max: 3000, step: 50, u: 'px' },
            { k: 'reset', t: 'button', act: 'reset', danger: true }
          ]
        }
      ]
    },

    {
      id: 'export', icon: 'exp', groups: [
        {
          id: 'still', items: [
            { k: 'exportScale', t: 'select', o: [[0.5, 'es.0.5'], [1, 'es.1'], [2, 'es.2']] },
            { k: 'exportPng', t: 'button', act: 'exportPng', primary: true }
          ]
        },
        {
          id: 'vector', items: [
            { k: 'svgRes', t: 'range', min: 400, max: 4000, step: 100, u: 'px', hint: true },
            { k: 'svgSimplify', t: 'range', min: 0, max: 3, step: 0.05 },
            { k: 'exportSvg', t: 'button', act: 'exportSvg' }
          ]
        }
      ]
    }
  ];

  g.Schema = {
    SIZE_PRESETS: SIZE_PRESETS,
    BRAND: BRAND,
    STROKE_KEYS: STROKE_KEYS,
    PER_IMAGE_KEYS: PER_IMAGE_KEYS,
    EXAMPLE_SRC: EXAMPLE_SRC,
    SECTIONS: SECTIONS,
    ICONS: ICONS,
    defaults: defaults,
    section: (id) => SECTIONS.find(s => s.id === id) || SECTIONS[0]
  };
})(window);

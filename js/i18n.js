/* i18n.js — English / Portuguese strings.
   Keys are grouped: g = group titles, l = control labels, h = control hints,
   o = select option labels, m = measure card, ui = everything else. */
(function (g) {
  'use strict';

  const en = {
    g: {
      canvas: 'Canvas', place: 'Image placement', bg: 'Background removal', mask: 'Silhouette',
      strokes: 'Strokes', art: 'Image treatment', draw: 'Drawing', grain: 'Grain', out: 'Export'
    },
    l: {
      sizePreset: 'Format', units: 'Units', cw: 'Width', ch: 'Height', dpi: 'DPI',
      basis: 'Scale strokes to', bg: 'Background', previewQuality: 'Preview quality',
      fit: 'Fit', fitSubject: 'Frame on cut-out', imgScale: 'Scale', imgX: 'Offset X', imgY: 'Offset Y', rotate: 'Rotate',
      flipH: 'Flip horizontal', flipV: 'Flip vertical',
      maskSource: 'Detect shape from', maskThreshold: 'Threshold', maskInvert: 'Invert shape',
      maskFillHoles: 'Fill enclosed holes', maskSmooth: 'Smooth outline', maskExpand: 'Expand / contract',
      ringCount: 'Number of strokes', strokeW: 'Stroke weight', ringGap: 'Gap between strokes',
      ringOffset: 'Offset from image', ringGrowth: 'Weight growth', ringColors: 'Stroke colours',
      palettePreset: 'Palette', haloUseBg: 'Offset = background', haloColor: 'Offset colour',
      gapUseBg: 'Gaps = background', gapColor: 'Gap colour',
      fillUseBg: 'Behind image = background', fillColor: 'Behind image',
      innerRings: 'Inward strokes', aa: 'Anti-alias edges',
      artMode: 'Mode', artOpacity: 'Opacity', inkColor: 'Ink colour', inkOn: 'Ink covers',
      paperTransparent: 'Rest transparent', paperColor: 'Rest colour', bwThreshold: 'Threshold',
      ditherMode: 'Dither', ditherStrength: 'Dither strength', ditherScale: 'Pixel / dot size',
      crispPixels: 'Hard pixel edges', artClip: 'Clip image to silhouette',
      brightness: 'Brightness', contrast: 'Contrast', saturation: 'Saturation',
      posterize: 'Posterize', artInvert: 'Invert',
      grainAmount: 'Amount', grainScale: 'Grain size', grainMono: 'Monochrome', seed: 'Noise seed',
      exportScale: 'PNG scale', svgRes: 'SVG trace detail', svgSimplify: 'SVG smoothing',
      bgMode: 'Remove', bgKeyColor: 'Colour to remove', bgTolerance: 'Tolerance',
      bgContiguous: 'Only from the edges inwards', bgFeather: 'Soften edge',
      bgBrushSize: 'Brush size',
      halftoneAngle: 'Screen angle', halftoneShape: 'Dot shape',
      brushColor: 'Colour', brushWidth: 'Nib width', brushType: 'Brush'
    },
    h: {
      fitSubject: 'Ignores empty transparent margins, so Fit and Scale measure the subject itself rather than the file’s edges. Only affects images with transparency.',
      basis: 'All % sizes are measured against this. Short side keeps weights stable across formats.',
      strokeW: 'Percent of the basis dimension — identical proportion at every export size.',
      ringGrowth: 'Multiplies each stroke against the previous one. 1 = all equal.',
      innerRings: 'Repeats the strokes inside the silhouette.',
      artClip: 'Keeps dither and grain off the background of a photo that has no transparency.',
      ditherScale: 'Also scales with the canvas, so halftones stay proportional.',
      posterize: '0 = off',
      seed: 'Starting number for the random pattern used by grain and by the Random noise dither. The same seed always draws the same speckle, so the preview and the export match; change it to reshuffle. It has no effect when grain is 0 and the dither is not Random noise.',
      svgSimplify: 'Higher = fewer points, softer curves.',
      bgMode: 'Auto reads the colour from the four corners. Pick a colour lets you sample one with the eyedropper in the toolbar.',
      bgContiguous: 'On, it only eats background connected to the border, so a colour that also appears inside the subject survives. Off, it removes that colour everywhere.',
      bgBrushSize: 'Use Erase and Restore in the toolbar to fix what the automatic pass got wrong. Marks are stored against the photo, so they hold when you change canvas or scale.',
      halftoneAngle: 'Traditional screens sit at 45 degrees, where the dot pattern is least visible to the eye.',
      brushWidth: 'Percentage of the basis dimension, like every other size here, so a scribble keeps its proportion at any export size.'
    },
    o: {
      'size.custom': 'Custom', 'size.ig-post': 'Instagram post 1080²', 'size.ig-story': 'Instagram story',
      'size.ig-land': 'Instagram landscape', 'size.web-hero': 'Web hero 2560×1080',
      'size.a5': 'A5 flyer 300dpi', 'size.a4': 'A4 300dpi', 'size.a3': 'A3 poster 200dpi',
      'size.b2': 'Poster 50×70cm 120dpi', 'size.banner': 'Banner 3×1m 25dpi', 'size.sticker': 'Sticker 10×10cm',
      'units.px': 'Pixels', 'units.mm': 'Millimetres', 'units.in': 'Inches',
      'basis.short': 'Short side', 'basis.long': 'Long side', 'basis.width': 'Width',
      'basis.height': 'Height', 'basis.diag': 'Diagonal',
      'pq.700': 'Fast', 'pq.1200': 'Normal', 'pq.1800': 'High', 'pq.2600': 'Very high',
      'fit.contain': 'Contain', 'fit.cover': 'Cover',
      'ms.auto': 'Auto', 'ms.alpha': 'Transparency', 'ms.dark': 'Dark pixels', 'ms.light': 'Light pixels',
      'pal.placeholder': 'Load a palette…',
      'am.photo': 'Photo', 'am.bitmap': '1-bit / threshold', 'am.silhouette': 'Flat silhouette', 'am.none': 'Hide image',
      'ink.dark': 'Dark areas', 'ink.light': 'Light areas',
      'dm.none': 'None', 'dm.bayer4': 'Ordered 4×4', 'dm.bayer8': 'Ordered 8×8',
      'dm.floyd': 'Floyd–Steinberg', 'dm.noise': 'Random noise', 'dm.halftone': 'Halftone screen',
      'bg.off': 'Nothing', 'bg.auto': 'Auto (from corners)', 'bg.color': 'A colour I pick',
      'hs.dot': 'Round dot', 'hs.square': 'Square', 'hs.line': 'Line screen',
      'bt.marker': 'Marker', 'bt.scribble': 'Scribble', 'bt.highlighter': 'Highlighter',
      'es.0.5': '0.5×', 'es.1': '1× (canvas size)', 'es.2': '2×', 'es.3': '3×', 'es.4': '4×',
      'sr.900': 'Draft', 'sr.1800': 'Normal', 'sr.3000': 'Fine', 'sr.4500': 'Maximum'
    },
    m: {
      title: 'Stroke weight check',
      basis: (u, band, pct) => 'basis ' + u + 'px · whole stroke band ' + band + 'px = ' + pct + '% of basis',
      note: 'Right column is the stroke as a share of each format’s short side. Matching values mean the design reads identically at any output size.',
      igpost: 'IG post', a4: 'A4 @300', banner: '3m banner @50dpi'
    },
    ui: {
      upload: 'Upload image',
      drop: 'or drop a file here, or paste with Ctrl + V',
      dropOver: 'Drop image',
      exampleLoaded: 'example image loaded',
      reset: 'Reset all',
      resetConfirm: 'Reset all settings to defaults?',
      fit: 'Fit', png: 'Export PNG', svg: 'Export SVG',
      preview: 'preview',
      rendering: (w, h) => 'Rendering ' + w + '×' + h + '…',
      savedPng: (w, h) => 'Saved PNG ' + w + '×' + h,
      tracing: 'Tracing vectors…',
      savedSvg: (kb) => 'Saved SVG — strokes are real vector paths (' + kb + ' kB)',
      renderFail: 'Render failed: ',
      exportFail: 'Export failed: ',
      svgFail: 'SVG export failed: ',
      heavy: (mp) => 'Heads up: export is ' + mp + ' megapixels — it may take a while.',
      tPan: 'Move', tPaint: 'Draw', tErase: 'Erase', tRestore: 'Restore', tPick: 'Pick colour',
      clearDraw: 'Clear drawing', undoDraw: 'Undo stroke', clearBg: 'Clear brush marks',
      picked: (c) => 'Background colour set to ' + c,
      pickFail: 'That point is outside the photo.',
      cleared: 'Cleared.',
      hintPaint: 'Drag on the artboard to draw.',
      hintErase: 'Paint over what should disappear.',
      hintRestore: 'Paint over what the removal took by mistake.',
      hintPick: 'Click the colour you want gone.'
    }
  };

  const pt = {
    g: {
      canvas: 'Tela', place: 'Posicionamento da imagem', bg: 'Remover fundo', mask: 'Silhueta',
      strokes: 'Contornos', art: 'Tratamento da imagem', draw: 'Desenho', grain: 'Grão', out: 'Exportar'
    },
    l: {
      sizePreset: 'Formato', units: 'Unidades', cw: 'Largura', ch: 'Altura', dpi: 'DPI',
      basis: 'Escalar contornos a', bg: 'Fundo', previewQuality: 'Qualidade da pré-visualização',
      fit: 'Ajuste', fitSubject: 'Enquadrar pelo recorte', imgScale: 'Escala', imgX: 'Deslocamento X', imgY: 'Deslocamento Y', rotate: 'Rodar',
      flipH: 'Espelhar na horizontal', flipV: 'Espelhar na vertical',
      maskSource: 'Detetar forma a partir de', maskThreshold: 'Limiar', maskInvert: 'Inverter forma',
      maskFillHoles: 'Preencher buracos fechados', maskSmooth: 'Suavizar contorno', maskExpand: 'Expandir / contrair',
      ringCount: 'Número de contornos', strokeW: 'Espessura do contorno', ringGap: 'Espaço entre contornos',
      ringOffset: 'Afastamento da imagem', ringGrowth: 'Crescimento da espessura', ringColors: 'Cores dos contornos',
      palettePreset: 'Paleta', haloUseBg: 'Afastamento = fundo', haloColor: 'Cor do afastamento',
      gapUseBg: 'Espaços = fundo', gapColor: 'Cor dos espaços',
      fillUseBg: 'Atrás da imagem = fundo', fillColor: 'Atrás da imagem',
      innerRings: 'Contornos interiores', aa: 'Suavizar arestas',
      artMode: 'Modo', artOpacity: 'Opacidade', inkColor: 'Cor da tinta', inkOn: 'A tinta cobre',
      paperTransparent: 'Resto transparente', paperColor: 'Cor do resto', bwThreshold: 'Limiar',
      ditherMode: 'Pontilhado', ditherStrength: 'Intensidade do pontilhado', ditherScale: 'Tamanho do píxel / ponto',
      crispPixels: 'Arestas de píxel duras', artClip: 'Recortar imagem pela silhueta',
      brightness: 'Brilho', contrast: 'Contraste', saturation: 'Saturação',
      posterize: 'Posterizar', artInvert: 'Inverter',
      grainAmount: 'Quantidade', grainScale: 'Tamanho do grão', grainMono: 'Monocromático', seed: 'Semente do ruído',
      exportScale: 'Escala do PNG', svgRes: 'Detalhe do traçado SVG', svgSimplify: 'Suavização do SVG',
      bgMode: 'Remover', bgKeyColor: 'Cor a remover', bgTolerance: 'Tolerância',
      bgContiguous: 'Só das margens para dentro', bgFeather: 'Suavizar limite',
      bgBrushSize: 'Tamanho do pincel',
      halftoneAngle: 'Ângulo da trama', halftoneShape: 'Forma do ponto',
      brushColor: 'Cor', brushWidth: 'Espessura do traço', brushType: 'Pincel'
    },
    h: {
      fitSubject: 'Ignora as margens transparentes vazias, para que o Ajuste e a Escala meçam o recorte em si e não os limites do ficheiro. Só afeta imagens com transparência.',
      basis: 'Todos os tamanhos em % são medidos em relação a isto. O lado curto mantém as espessuras estáveis entre formatos.',
      strokeW: 'Percentagem da dimensão base — proporção idêntica em qualquer tamanho de exportação.',
      ringGrowth: 'Multiplica cada contorno em relação ao anterior. 1 = todos iguais.',
      innerRings: 'Repete os contornos dentro da silhueta.',
      artClip: 'Mantém o pontilhado e o grão fora do fundo de uma fotografia sem transparência.',
      ditherScale: 'Também escala com a tela, para que as meias-tintas se mantenham proporcionais.',
      posterize: '0 = desligado',
      seed: 'Número inicial do padrão aleatório usado pelo grão e pelo pontilhado Ruído aleatório. A mesma semente desenha sempre o mesmo salpico, por isso a pré-visualização e a exportação coincidem; altere-a para baralhar. Não tem efeito quando o grão está a 0 e o pontilhado não é Ruído aleatório.',
      svgSimplify: 'Mais alto = menos pontos, curvas mais suaves.',
      bgMode: 'O automático lê a cor dos quatro cantos. Escolher uma cor permite recolhê-la com o conta-gotas na barra de ferramentas.',
      bgContiguous: 'Ligado, só come o fundo ligado à margem, por isso uma cor que também apareça dentro do motivo sobrevive. Desligado, remove essa cor em todo o lado.',
      bgBrushSize: 'Use Apagar e Restaurar na barra de ferramentas para corrigir o que a passagem automática falhou. As marcas ficam guardadas em relação à fotografia, por isso aguentam mudanças de tela ou de escala.',
      halftoneAngle: 'As tramas tradicionais ficam a 45 graus, o ângulo em que o padrão de pontos é menos visível ao olho.',
      brushWidth: 'Percentagem da dimensão base, como todos os outros tamanhos aqui, para que um rabisco mantenha a proporção em qualquer tamanho de exportação.'
    },
    o: {
      'size.custom': 'Personalizado', 'size.ig-post': 'Publicação Instagram 1080²', 'size.ig-story': 'Story Instagram',
      'size.ig-land': 'Instagram horizontal', 'size.web-hero': 'Banner web 2560×1080',
      'size.a5': 'Panfleto A5 300dpi', 'size.a4': 'A4 300dpi', 'size.a3': 'Cartaz A3 200dpi',
      'size.b2': 'Cartaz 50×70cm 120dpi', 'size.banner': 'Lona 3×1m 25dpi', 'size.sticker': 'Autocolante 10×10cm',
      'units.px': 'Píxeis', 'units.mm': 'Milímetros', 'units.in': 'Polegadas',
      'basis.short': 'Lado curto', 'basis.long': 'Lado longo', 'basis.width': 'Largura',
      'basis.height': 'Altura', 'basis.diag': 'Diagonal',
      'pq.700': 'Rápida', 'pq.1200': 'Normal', 'pq.1800': 'Alta', 'pq.2600': 'Muito alta',
      'fit.contain': 'Conter', 'fit.cover': 'Cobrir',
      'ms.auto': 'Automático', 'ms.alpha': 'Transparência', 'ms.dark': 'Píxeis escuros', 'ms.light': 'Píxeis claros',
      'pal.placeholder': 'Carregar paleta…',
      'am.photo': 'Fotografia', 'am.bitmap': '1-bit / limiar', 'am.silhouette': 'Silhueta sólida', 'am.none': 'Ocultar imagem',
      'ink.dark': 'Zonas escuras', 'ink.light': 'Zonas claras',
      'dm.none': 'Nenhum', 'dm.bayer4': 'Ordenado 4×4', 'dm.bayer8': 'Ordenado 8×8',
      'dm.floyd': 'Floyd–Steinberg', 'dm.noise': 'Ruído aleatório', 'dm.halftone': 'Trama de meio-tom',
      'bg.off': 'Nada', 'bg.auto': 'Automático (pelos cantos)', 'bg.color': 'Uma cor à minha escolha',
      'hs.dot': 'Ponto redondo', 'hs.square': 'Quadrado', 'hs.line': 'Trama de linhas',
      'bt.marker': 'Marcador', 'bt.scribble': 'Rabisco', 'bt.highlighter': 'Marcador fluorescente',
      'es.0.5': '0,5×', 'es.1': '1× (tamanho da tela)', 'es.2': '2×', 'es.3': '3×', 'es.4': '4×',
      'sr.900': 'Rascunho', 'sr.1800': 'Normal', 'sr.3000': 'Fino', 'sr.4500': 'Máximo'
    },
    m: {
      title: 'Verificação da espessura',
      basis: (u, band, pct) => 'base ' + u + 'px · banda total ' + band + 'px = ' + pct + '% da base',
      note: 'A coluna da direita é o contorno como fração do lado curto de cada formato. Valores iguais significam que o design se lê da mesma forma em qualquer tamanho.',
      igpost: 'Publicação IG', a4: 'A4 @300', banner: 'Lona 3m @50dpi'
    },
    ui: {
      upload: 'Carregar imagem',
      drop: 'ou arraste um ficheiro para aqui, ou cole com Ctrl + V',
      dropOver: 'Largue a imagem',
      exampleLoaded: 'imagem de exemplo carregada',
      reset: 'Repor tudo',
      resetConfirm: 'Repor todas as definições?',
      fit: 'Ajustar', png: 'Exportar PNG', svg: 'Exportar SVG',
      preview: 'pré-visualização',
      rendering: (w, h) => 'A renderizar ' + w + '×' + h + '…',
      savedPng: (w, h) => 'PNG guardado ' + w + '×' + h,
      tracing: 'A traçar vetores…',
      savedSvg: (kb) => 'SVG guardado — os contornos são caminhos vetoriais reais (' + kb + ' kB)',
      renderFail: 'Falha ao renderizar: ',
      exportFail: 'Falha ao exportar: ',
      svgFail: 'Falha ao exportar SVG: ',
      heavy: (mp) => 'Atenção: a exportação tem ' + mp + ' megapíxeis — pode demorar.',
      tPan: 'Mover', tPaint: 'Desenhar', tErase: 'Apagar', tRestore: 'Restaurar', tPick: 'Recolher cor',
      clearDraw: 'Limpar desenho', undoDraw: 'Anular traço', clearBg: 'Limpar marcas',
      picked: (c) => 'Cor de fundo definida como ' + c,
      pickFail: 'Esse ponto está fora da fotografia.',
      cleared: 'Limpo.',
      hintPaint: 'Arraste sobre a prancha para desenhar.',
      hintErase: 'Pinte sobre o que deve desaparecer.',
      hintRestore: 'Pinte sobre o que a remoção levou por engano.',
      hintPick: 'Clique na cor que quer eliminar.'
    }
  };

  const DICT = { en: en, pt: pt };
  let lang = 'en';

  function setLang(l) { lang = DICT[l] ? l : 'en'; }
  function getLang() { return lang; }

  /* t('l.strokeW') or t('ui.rendering', 100, 200) for the function-valued strings */
  function t(path) {
    const parts = path.split('.');
    const ns = parts.shift();
    const key = parts.join('.');
    const table = DICT[lang][ns] || {};
    let v = table[key];
    if (v === undefined) v = (DICT.en[ns] || {})[key];
    if (v === undefined) return path;
    if (typeof v === 'function') return v.apply(null, [].slice.call(arguments, 1));
    return v;
  }

  g.I18N = { t: t, setLang: setLang, getLang: getLang, langs: ['en', 'pt'] };
})(window);

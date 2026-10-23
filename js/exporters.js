/* exporters.js — getting the work out of the tool.

   Handing over a finished file is its own small problem. A browser only starts a
   download it can attribute to a click, and Safari refuses one that lands
   seconds later — which is every GIF, since encoding a loop takes far longer
   than a PNG. So the automatic save is still attempted, and the status bar also
   gets a real link: clicking that is a genuine gesture and always works.
*/
(function (g) {
  'use strict';

  let ctx = null;
  const t = (...a) => I18N.t.apply(null, a);
  const S = () => ctx.S;

  function init(c) { ctx = c; }

  let lastOffered = null;

  function offerFile(blob, name, msg) {
    /* Each of these pins a whole file in memory for as long as the link lives.
       Exporting a few large animations in a row used to keep every one of them
       alive for three minutes at once, so the previous file is released as soon
       as a new one takes its place. */
    if (lastOffered) { URL.revokeObjectURL(lastOffered.url); clearTimeout(lastOffered.timer); }
    const url = URL.createObjectURL(blob);
    const bar = document.querySelector('#status');
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
    lastOffered = { url: url, timer: setTimeout(() => { URL.revokeObjectURL(url); lastOffered = null; }, 180000) };
  }

  function png() {
    const c = Engine.canvasPx(S());
    const W = Math.round(c.W * S().exportScale), H = Math.round(c.H * S().exportScale);
    ctx.status(t('ui.rendering', W, H));
    setTimeout(() => {
      try {
        const out = Engine.render(S(), ctx.IMG, W, H, ctx.TOKEN);
        out.toBlob(b => {
          offerFile(b, 'strokes-' + W + 'x' + H + '.png', t('ui.savedPng', W, H));
        }, 'image/png');
      } catch (e) {
        ctx.status(t('ui.exportFail') + e.message, true);
      }
    }, 30);
  }

  function svg() {
    const c = Engine.canvasPx(S());
    ctx.status(t('ui.tracing'));
    setTimeout(() => {
      try {
        const out = Engine.toSVG(S(), ctx.IMG, c.W, c.H, ctx.TOKEN, +S().svgRes);
        offerFile(new Blob([out], { type: 'image/svg+xml' }),
          'strokes-' + c.W + 'x' + c.H + '.svg', t('ui.savedSvg', Math.round(out.length / 1024)));
      } catch (e) {
        ctx.status(t('ui.svgFail') + e.message, true);
        console.error(e);
      }
    }, 30);
  }

  async function animation() {
    if (!ctx.IMG) return;
    const c = Engine.canvasPx(S());
    let W = Math.round(c.W * S().animScale), H = Math.round(c.H * S().animScale);
    // H.264 only encodes even dimensions. Trim here rather than inside the
    // encoder, so the frames are rendered at the size the file actually is and
    // the name on it is the truth.
    if (S().animFormat === 'mp4') { W -= W % 2; H -= H % 2; }
    const n = Anim.frameCount(S());
    const step = (i, total) => ctx.status(t('ui.animProgress', Math.round(i / total * 100)));
    const stamp = W + 'x' + H;

    try {
      if (S().animFormat === 'png') {
        if (n > 40 && !confirm(t('ui.animManyFrames', n))) return;
        ctx.status(t('ui.animProgress', 0));
        // one frame at a time: written out and dropped before the next is drawn
        const saved = await Anim.eachFrame(S(), ctx.IMG, W, H, ctx.TOKEN, async (canvas, i, total) => {
          const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
          U.download(blob, 'stroke-' + stamp + '-' + String(i + 1).padStart(3, '0') + '.png');
          step(i + 1, total);
          await new Promise(r => setTimeout(r, 120));   // browsers throttle bursts
        });
        ctx.status(t('ui.animSavedFrames', saved));
        return;
      }
      if (S().animFormat === 'mp4') {
        const blob = await Anim.toMP4(S(), ctx.IMG, W, H, ctx.TOKEN, step);
        offerFile(blob, 'stroke-' + stamp + '.mp4',
          t('ui.animSaved', 'MP4', Math.round(blob.size / 1024)));
        return;
      }
      if (S().animFormat === 'webm') {
        const blob = await Anim.toWebM(S(), ctx.IMG, W, H, ctx.TOKEN, step);
        offerFile(blob, 'stroke-' + stamp + '.webm',
          t('ui.animSaved', 'WebM', Math.round(blob.size / 1024)));
        return;
      }
      const blob = await Anim.toGIF(S(), ctx.IMG, W, H, ctx.TOKEN, step);
      offerFile(blob, 'stroke-' + stamp + '.gif',
        t('ui.animSaved', 'GIF', Math.round(blob.size / 1024)));
    } catch (e) {
      ctx.status(t('ui.animFail') + e.message, true);
      console.error(e);
    }
  }

  g.Exporters = { init: init, png: png, svg: svg, animation: animation, offerFile: offerFile };
})(window);

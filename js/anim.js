/* anim.js — animating the strokes.

   Every movement here is a function of normalised loop time t in [0,1), and
   every one returns to its starting frame at t=1, so the loop is seamless by
   construction rather than by trimming.

   All five touch only the ring compositing — the silhouette's distance field and
   the treated artwork are identical in every frame, and the engine caches both.
   That is what makes a frame cheap enough to play live: the expensive half of a
   render happens once, not thirty times a second. Nothing here animates
   smoothing or placement, which WOULD move the distance field.
*/
(function (g) {
  'use strict';

  const TYPES = ['radiate', 'breathe', 'chase', 'reveal', 'wobble'];

  function frameCount(S) {
    return Math.max(2, Math.round(S.animSeconds * S.animFps));
  }

  /* how many bands it takes to run past the far corner, so a travelling band
     never pops out of existence at the edge of the stack */
  function fillCount(S, W, H) {
    const unit = Engine.computeUnit(S.basis, W, H);
    const period = Math.max(0.01, S.strokeW + S.ringGap);
    const reach = Math.hypot(W, H) / unit * 100;
    return Math.min(60, Math.ceil((reach - S.ringOffset) / period) + 2);
  }

  /* settings for one frame: a shallow copy with the animated fields replaced */
  function frameSettings(S, t, W, H) {
    const A = Object.assign({}, S);
    const cols = Math.max(1, (S.ringColors || []).length);
    const dir = S.animDir === 'in' ? -1 : 1;
    const amt = S.animAmount / 100;

    switch (S.animType) {
      case 'radiate': {
        // travel a whole colour cycle, so bands AND colours land back where they
        // started; one period alone would loop the geometry but rotate the palette
        const period = Math.max(0.01, S.strokeW + S.ringGap);
        const span = period * cols;
        let off = S.ringOffset + dir * t * span;
        off = ((off - S.ringOffset) % span + span) % span + S.ringOffset;
        A.ringOffset = off;
        if (S.animFill && W) A.ringCount = Math.max(S.ringCount, fillCount(S, W, H));
        break;
      }
      case 'breathe':
        A.strokeW = Math.max(0.05, S.strokeW * (1 + Math.sin(t * 2 * Math.PI) * amt));
        break;
      case 'chase': {
        const shift = Math.floor(t * cols) % cols;
        A.ringColors = (S.ringColors || []).slice(shift).concat((S.ringColors || []).slice(0, shift));
        break;
      }
      case 'reveal': {
        const ping = 1 - Math.abs(1 - 2 * t);          // 0 -> 1 -> 0
        A.ringCount = Math.max(0, Math.round(S.ringCount * ping));
        break;
      }
      case 'wobble':
        A.maskExpand = S.maskExpand + Math.sin(t * 2 * Math.PI) * amt * 4;
        break;
    }
    return A;
  }

  /* ---------- exporting ---------- */

  function frames(S, img, W, H, token, onStep) {
    const n = frameCount(S);
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(Engine.render(frameSettings(S, i / n, W, H), img, W, H, token));
      if (onStep) onStep(i + 1, n);
    }
    return out;
  }

  /* GIF delays are whole hundredths of a second, so the real rate is 100/delay */
  function gifDelay(fps) { return Math.max(2, Math.round(100 / fps)); }
  function gifRate(fps) { return 100 / gifDelay(fps); }

  async function toGIF(S, img, W, H, token, onStep) {
    const n = frameCount(S);
    const enc = new GIF.Encoder(W, H, gifDelay(S.animFps));
    for (let i = 0; i < n; i++) {
      const c = Engine.render(frameSettings(S, i / n, W, H), img, W, H, token);
      enc.add(c.getContext('2d').getImageData(0, 0, W, H));
      if (onStep) onStep(i + 1, n + 1);
      await new Promise(r => setTimeout(r, 0));     // let the progress paint
    }
    if (onStep) onStep(n + 1, n + 1);
    return enc.render();
  }

  /* MediaRecorder timestamps frames by the wall clock, so the frames are all
     rendered FIRST and then played into the recorder at an exact cadence —
     pacing a render loop directly would stretch the video by the render time. */
  async function toWebM(S, img, W, H, token, onStep) {
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      .find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
    if (!mime) throw new Error('no webm support');

    const n = frameCount(S);
    const bmps = [];
    for (let i = 0; i < n; i++) {
      const c = Engine.render(frameSettings(S, i / n, W, H), img, W, H, token);
      bmps.push(await createImageBitmap(c));
      if (onStep) onStep(i + 1, n + n);
      await new Promise(r => setTimeout(r, 0));
    }

    const cv = U.createCanvas(W, H);
    const ctx = cv.getContext('2d');
    ctx.drawImage(bmps[0], 0, 0);          // give the track a frame before it opens
    const stream = cv.captureStream(0);
    const track = stream.getVideoTracks()[0];
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12e6 });
    const chunks = [];

    // wait for BOTH the final data and the stop event, with a ceiling so a
    // stalled encoder surfaces as an error instead of hanging
    let sawData = false, sawStop = false, settle = null;
    const finished = new Promise(res => {
      settle = res;
      const check = () => { if (sawData && sawStop) res(); };
      rec.ondataavailable = e => {
        if (e.data && e.data.size) chunks.push(e.data);
        sawData = true; check();
      };
      rec.onstop = () => { sawStop = true; check(); };
    });

    const dt = 1000 / S.animFps;
    rec.start();
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      ctx.drawImage(bmps[i], 0, 0);
      if (track.requestFrame) track.requestFrame();
      if (onStep) onStep(n + i + 1, n + n);
      const due = t0 + (i + 1) * dt;
      await new Promise(r => setTimeout(r, Math.max(0, due - performance.now())));
    }
    rec.stop();
    await Promise.race([finished, new Promise(r => setTimeout(() => { settle(); r(); }, 4000))]);
    bmps.forEach(b => b.close && b.close());

    const blob = new Blob(chunks, { type: mime });
    // the recorder can come back empty (a throttled background tab is the usual
    // reason); an empty file downloaded silently is the worst possible outcome
    if (!blob.size) throw new Error('the recorder returned no video');
    return blob;
  }

  g.Anim = {
    TYPES: TYPES,
    frameCount: frameCount,
    frameSettings: frameSettings,
    frames: frames,
    gifRate: gifRate,
    toGIF: toGIF,
    toWebM: toWebM
  };
})(window);

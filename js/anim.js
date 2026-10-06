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

  const TYPES = ['radiate', 'breathe', 'chase', 'reveal', 'wobble', 'hue'];

  /* The frame rate is yours to pick, 60 by default: below about 50 a travelling
     band visibly steps, and nothing here is expensive enough per frame to need
     less. GIF is the one format that cannot keep up — see gifDelay below.

     Playback is unaffected either way; it samples the loop by clock time, so it
     runs at whatever the display refreshes at. */
  const DEFAULT_FPS = 60;

  function fps(S) {
    const v = Math.round(+(S && S.animFps) || DEFAULT_FPS);
    return Math.min(240, Math.max(8, v));
  }

  function frameCount(S) {
    return Math.max(2, Math.round(S.animSeconds * fps(S)));
  }

  /* Bits per second for the video formats. Rate scales with pixels AND with
     frame rate, because doubling either doubles how much has to be described;
     the quality setting is bits per pixel per frame. Flat colour with hard
     edges is the worst case for a block codec, so even "standard" here is
     generous by streaming standards. */
  const BPP = { standard: 0.07, high: 0.16, max: 0.32 };

  function bitrate(S, W, H) {
    const bpp = BPP[S.animQuality] || BPP.high;
    const want = W * H * fps(S) * bpp;
    return Math.round(Math.min(160e6, Math.max(2e6, want)));
  }

  /* smoothstep, for the movements that travel out and back */
  function ease(t, on) { return on ? t * t * (3 - 2 * t) : t; }

  const MAX_BANDS = 120;          // the engine's ceiling on band colour codes

  /* how many bands it takes to run past the far corner starting from `from`, so
     a travelling band only ever leaves by going out of sight */
  function fillCount(S, from, W, H) {
    const unit = Engine.computeUnit(S.basis, W, H);
    const period = Math.max(0.01, S.strokeW + S.ringGap);
    const reach = Math.hypot(W, H) / unit * 100;
    return Math.min(MAX_BANDS, Math.ceil((reach - from) / period) + 2);
  }

  const mod = (a, n) => ((a % n) + n) % n;

  /* settings for one frame: a shallow copy with the animated fields replaced */
  function frameSettings(S, t, W, H) {
    const A = Object.assign({}, S);
    const cols = Math.max(1, (S.ringColors || []).length);
    const dir = S.animDir === 'in' ? -1 : 1;
    const amt = S.animAmount / 100;

    switch (S.animType) {
      case 'radiate': {
        /* Bands EMERGE from the silhouette and travel out; they never leave
           except by going off the canvas.

           Sliding the whole stack outward (what this used to do) opens a gap
           between the subject and the innermost band that grows for the length
           of the loop and then snaps shut — the visible cut. Instead the
           innermost band start is held within one period of the subject, so
           every period a new band appears hugging the cut-out, and the palette
           rotates by one to compensate so each band keeps its own colour as it
           travels.

           Seamless at t=1: travel is period × colours, so mod(travel, period)
           is 0 — the same geometry as t=0 — and steps is a whole number of
           colours, so the rotation is 0 too. */
        const period = Math.max(0.01, S.strokeW + S.ringGap);
        const travel = dir * t * period * cols;

        /* The stack starts at a NEGATIVE phase, never at "Distance from image".
           Keeping that distance leaves a ring of background between the cut-out
           and the innermost band which widens by a whole period and then snaps —
           the pop. Starting in [-period, 0) means a band always overlaps the
           silhouette's edge, so one is forever sliding out of it. */
        A.ringOffset = mod(travel, period) - period;
        const steps = Math.floor(travel / period);
        const rot = mod(-steps, cols);
        const src = S.ringColors || [];
        A.ringColors = src.slice(rot).concat(src.slice(0, rot));

        A.ringGrowth = 1;      // a stack whose bands widen is not periodic
        if (W) A.ringCount = fillCount(A, A.ringOffset, W, H);
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
        const ping = ease(1 - Math.abs(1 - 2 * t), S.animEase);   // 0 -> 1 -> 0
        A.ringCount = Math.max(0, Math.round(S.ringCount * ping));
        break;
      }
      case 'wobble':
        A.maskExpand = S.maskExpand + Math.sin(t * 2 * Math.PI) * amt * 4;
        break;
      case 'hue': {
        // a full turn of the colour wheel lands on the colours it started with
        const deg = t * 360 * dir;
        A.ringColors = (S.ringColors || []).map(c => U.rotateHue(c, deg));
        if (!S.haloUseBg) A.haloColor = U.rotateHue(S.haloColor, deg);
        if (!S.gapUseBg) A.gapColor = U.rotateHue(S.gapColor, deg);
        break;
      }
    }

    /* Grain that redraws every frame — the film-grain shimmer. It rides on top
       of the cached base layer, so it costs nothing extra per frame. */
    if (S.animGrain > 0) {
      A.grainAmount = S.animGrain;
      A.grainScale = S.animGrainScale;
      A.grainMono = S.animGrainMono;
      A.seed = (S.seed + Math.round(t * frameCount(S))) % 9973;
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

  /* GIF frame delays are whole hundredths of a second, so most rates are not
     representable: delay 1 is treated as 10fps by most decoders, leaving delay 2
     — 50fps — as the fastest the format can honestly hold.

     So a GIF is rendered at ITS OWN rate rather than resampled from the one you
     picked. Writing 60 frames a second and then stamping each with 20ms played
     every export back a fifth too slow and spent a fifth of the file on frames
     no decoder shows. The loop is a function of normalised time, so asking for
     50 samples a second instead costs nothing and lands on exactly animSeconds. */
  function gifDelay(S) { return Math.max(2, Math.round(100 / fps(S))); }
  function gifRate(S) { return 100 / gifDelay(S); }
  function gifFrameCount(S) {
    return Math.max(2, Math.round(S.animSeconds * gifRate(S)));
  }

  async function toGIF(S, img, W, H, token, onStep) {
    const n = gifFrameCount(S);
    const enc = new GIF.Encoder(W, H, gifDelay(S));
    const probes = Math.min(n, 6);
    const total = probes + n;

    // learn the palette from a few frames spread across the loop, so the whole
    // animation shares one colour table without ever holding every frame
    for (let i = 0; i < probes; i++) {
      const c = Engine.render(frameSettings(S, i / probes, W, H), img, W, H, token);
      enc.sample(c.getContext('2d').getImageData(0, 0, W, H));
      if (onStep) onStep(i + 1, total);
      await new Promise(r => setTimeout(r, 0));
    }
    enc.begin();

    for (let i = 0; i < n; i++) {
      const c = Engine.render(frameSettings(S, i / n, W, H), img, W, H, token);
      enc.addFrame(c.getContext('2d').getImageData(0, 0, W, H));
      if (onStep) onStep(probes + i + 1, total);
      await new Promise(r => setTimeout(r, 0));     // let the progress paint
    }
    return enc.finish();
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
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate(S, W, H) });
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

    const dt = 1000 / fps(S);
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
    /* The recorder can come back with nothing in it — a throttled tab is the
       usual reason, and captureStream's requestFrame simply never lands. A
       non-empty blob is not proof of anything either: an EBML header alone is
       about a hundred bytes and downloads perfectly happily. So the file is
       opened before it is handed over, and a video that will not even report
       its own width is reported as the failure it is. */
    if (blob.size < 1024 || !(await playable(blob))) {
      throw new Error('the recorder produced an unplayable file — export MP4 instead');
    }
    return blob;
  }

  /* can a video element make sense of this? */
  function playable(blob) {
    return new Promise(res => {
      const url = URL.createObjectURL(blob);
      const v = document.createElement('video');
      v.muted = true;
      v.preload = 'metadata';
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        URL.revokeObjectURL(url);
        res(ok);
      };
      // a recorded WebM often reports an infinite duration, so only the frame
      // size is worth trusting here
      v.onloadedmetadata = () => done(v.videoWidth > 0 && v.videoHeight > 0);
      v.onerror = () => done(false);
      setTimeout(() => done(false), 5000);
      v.src = url;
    });
  }

  /* H.264, straight from the frames. Nothing is held in memory but the encoded
     chunks: each frame is rendered, handed to the encoder and dropped, so a long
     clip at full size costs no more than a short one. */
  async function toMP4(S, img, W, H, token, onStep) {
    if (!window.MP4 || !MP4.available()) {
      throw new Error('this browser cannot encode H.264 — try WebM');
    }
    const n = frameCount(S);
    const scratch = U.createCanvas(2, 2);
    return MP4.encode({
      width: W, height: H, fps: fps(S), frames: n, bitrate: bitrate(S, W, H),
      onStep: onStep,
      draw: (i, w, h) => {
        const c = Engine.render(frameSettings(S, i / n, W, H), img, W, H, token);
        if (w === W && h === H) return c;
        // the codec needs even dimensions; redraw rather than hand it an odd canvas
        if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h; }
        const x = scratch.getContext('2d');
        x.clearRect(0, 0, w, h);
        x.drawImage(c, 0, 0);
        return scratch;
      }
    });
  }

  g.Anim = {
    TYPES: TYPES,
    fps: fps,
    bitrate: bitrate,
    frameCount: frameCount,
    frameSettings: frameSettings,
    frames: frames,
    gifRate: gifRate,
    gifFrameCount: gifFrameCount,
    toGIF: toGIF,
    toWebM: toWebM,
    toMP4: toMP4
  };
})(window);

/* bg.js — background removal.

   Everything here works in SOURCE-IMAGE space, which is fixed per file and so is
   already independent of the canvas size. Brush strokes are stored normalised to
   [0..1] of the source image, so they survive a change of canvas or export scale.
*/
(function (g) {
  'use strict';

  /* average colour of the four corners, used by Auto */
  function cornerKey(data, w, h) {
    const n = Math.max(2, Math.round(Math.min(w, h) * 0.04));
    let r = 0, gg = 0, b = 0, c = 0;
    const box = (x0, y0) => {
      for (let y = y0; y < y0 + n; y++) {
        for (let x = x0; x < x0 + n; x++) {
          const p = (y * w + x) * 4;
          if (data[p + 3] < 128) continue;
          r += data[p]; gg += data[p + 1]; b += data[p + 2]; c++;
        }
      }
    };
    box(0, 0); box(w - n, 0); box(0, h - n); box(w - n, h - n);
    if (!c) return [255, 255, 255];
    return [r / c, gg / c, b / c];
  }

  /* 0..1, 1 = opposite corners of the RGB cube */
  const MAXD = Math.sqrt(3 * 255 * 255);

  /* One button means no tolerance slider, so pick one from the picture: when the
     four corners agree the background is flat and a tight threshold is safest;
     when they disagree it is lit or graded and needs more slack. */
  function autoTolerance(data, w, h, key) {
    const n = Math.max(2, Math.round(Math.min(w, h) * 0.04));
    let worst = 0;
    const corner = (x0, y0) => {
      let r = 0, g = 0, b = 0, c = 0;
      for (let y = y0; y < y0 + n; y++) {
        for (let x = x0; x < x0 + n; x++) {
          const p = (y * w + x) * 4;
          if (data[p + 3] < 128) continue;
          r += data[p]; g += data[p + 1]; b += data[p + 2]; c++;
        }
      }
      if (!c) return;
      const d = Math.sqrt((r / c - key[0]) ** 2 + (g / c - key[1]) ** 2 + (b / c - key[2]) ** 2);
      if (d > worst) worst = d;
    };
    corner(0, 0); corner(w - n, 0); corner(0, h - n); corner(w - n, h - n);
    return U.clamp(0.10 + (worst / MAXD) * 2.5, 0.10, 0.34);
  }

  function removed(data, w, h, key, tol, contiguous) {
    const n = w * h;
    const out = new Float32Array(n);
    const kr = key[0], kg = key[1], kb = key[2];
    const limit = tol * MAXD;

    const near = (p) => {
      const dr = data[p] - kr, dg = data[p + 1] - kg, db = data[p + 2] - kb;
      return Math.sqrt(dr * dr + dg * dg + db * db) <= limit;
    };

    if (!contiguous) {
      for (let i = 0, p = 0; i < n; i++, p += 4) if (near(p)) out[i] = 1;
      return out;
    }

    // flood fill inwards from every border pixel
    const seen = new Uint8Array(n);
    const stack = new Int32Array(n);
    let sp = 0;
    const push = (i) => {
      if (seen[i]) return;
      seen[i] = 1;
      if (!near(i * 4)) return;      // visited but not background: stop here
      out[i] = 1;
      stack[sp++] = i;
    };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (sp > 0) {
      const i = stack[--sp];
      const x = i % w, y = (i / w) | 0;
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (y > 0) push(i - w);
      if (y < h - 1) push(i + w);
    }
    return out;
  }

  /* img (or canvas) -> canvas with the background knocked out */
  function apply(img, S) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const c = U.createCanvas(iw, ih);
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);

    if (S.bgMode === 'off') return c;

    const id = x.getImageData(0, 0, iw, ih);
    const data = id.data;
    const n = iw * ih;

    const orig = new Float32Array(n);
    for (let i = 0, p = 3; i < n; i++, p += 4) orig[i] = data[p] / 255;

    let alpha;
    {
      const key = cornerKey(data, iw, ih);
      const cut = removed(data, iw, ih, key, autoTolerance(data, iw, ih, key), true);
      const feather = 0.0015 * Math.min(iw, ih);
      if (feather > 0.3) EDT.blur(cut, iw, ih, feather);
      alpha = new Float32Array(n);
      for (let i = 0; i < n; i++) alpha[i] = orig[i] * (1 - U.clamp(cut[i], 0, 1));
    }

    for (let i = 0, p = 3; i < n; i++, p += 4) data[p] = U.clamp(alpha[i] * 255, 0, 255);
    x.putImageData(id, 0, 0);
    return c;
  }

  /* what Auto would pick, so the UI can show it */
  function autoKey(img) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const k = Math.min(1, 200 / Math.max(iw, ih));
    const w = Math.max(4, Math.round(iw * k)), h = Math.max(4, Math.round(ih * k));
    const c = U.createCanvas(w, h);
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, w, h);
    return cornerKey(x.getImageData(0, 0, w, h).data, w, h);
  }

  g.BG = { apply: apply, autoKey: autoKey };
})(window);

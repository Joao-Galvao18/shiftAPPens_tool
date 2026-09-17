/* bg.js — background removal.

   The first version keyed on one colour: the average of the four corners. That
   fails on anything but a flat backdrop — average two different corners and you
   get a colour that matches neither, so it either eats nothing or eats the
   subject. This version:

     1. builds a small PALETTE of background colours from the whole border ring,
        so a graded or two-tone backdrop is described rather than averaged away;
     2. picks its threshold from how far those border pixels actually scatter
        around that palette, instead of a guess;
     3. grows inward from the edges, so a colour that also appears inside the
        subject survives;
     4. gives edge pixels PARTIAL alpha across a soft band rather than a hard
        cut, which is what stops the cut-out looking stamped;
     5. drops stray specks left behind in the background.

   It works in source-image space, which is fixed per file and so already
   independent of canvas size.
*/
(function (g) {
  'use strict';

  const MAXD = Math.sqrt(3 * 255 * 255);   // corner-to-corner of the RGB cube

  /* A picture that already carries real transparency is already a cut-out. */
  function alreadyCutOut(data) {
    let clear = 0, n = 0;
    for (let i = 3; i < data.length; i += 4 * 29) { n++; if (data[i] < 200) clear++; }
    return n > 0 && clear / n > 0.05;
  }

  function borderVisit(w, h, fn) {
    const band = Math.max(2, Math.round(Math.min(w, h) * 0.035));
    const step = Math.max(1, Math.round(Math.min(w, h) / 320));
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        if (x < band || y < band || x >= w - band || y >= h - band) fn(x, y);
      }
    }
  }

  /* Representative backdrop colours, by coarse colour bucket. Keeping several
     means a gradient or a two-tone wall is matched at both ends. */
  function bgPalette(data, w, h) {
    const buckets = new Map();
    borderVisit(w, h, (x, y) => {
      const p = (y * w + x) * 4;
      if (data[p + 3] < 128) return;
      const key = ((data[p] >> 4) << 8) | ((data[p + 1] >> 4) << 4) | (data[p + 2] >> 4);
      let b = buckets.get(key);
      if (!b) { b = { n: 0, r: 0, g: 0, b: 0 }; buckets.set(key, b); }
      b.n++; b.r += data[p]; b.g += data[p + 1]; b.b += data[p + 2];
    });
    const list = [...buckets.values()].sort((a, b) => b.n - a.n);
    const total = list.reduce((s, b) => s + b.n, 0) || 1;
    const pal = [];
    let acc = 0;
    for (const b of list) {
      pal.push([b.r / b.n, b.g / b.n, b.b / b.n]);
      acc += b.n / total;
      if (pal.length >= 6 || acc > 0.92) break;
    }
    return pal.length ? pal : [[255, 255, 255]];
  }

  function nearest(data, p, pal) {
    let best = Infinity;
    for (let i = 0; i < pal.length; i++) {
      const c = pal[i];
      const dr = data[p] - c[0], dg = data[p + 1] - c[1], db = data[p + 2] - c[2];
      const d = dr * dr + dg * dg + db * db;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  /* Threshold from the data: how far do border pixels really sit from the
     palette? Kept deliberately TIGHT — a backdrop that genuinely varies is
     handled by following it locally (below), not by opening this up. Widening
     it instead is what let a graded backdrop swallow the subject. */
  function toleranceFor(data, w, h, pal) {
    const ds = [];
    borderVisit(w, h, (x, y) => {
      const p = (y * w + x) * 4;
      if (data[p + 3] < 128) return;
      ds.push(nearest(data, p, pal));
    });
    if (!ds.length) return MAXD * 0.05;
    ds.sort((a, b) => a - b);
    const p75 = ds[Math.min(ds.length - 1, Math.floor(ds.length * 0.75))];
    return U.clamp(p75 * 1.15 + MAXD * 0.010, MAXD * 0.030, MAXD * 0.13);
  }

  /* Grow inward from the border. A pixel joins the background if it is close to
     the palette, OR if it is barely different from the background pixel it was
     reached from — which walks a gradient down smoothly while a hard colour step
     (the subject's edge) stops it dead. The local rule is capped so a long chain
     of small steps cannot drift all the way across the picture.
     Returns how much of each pixel to remove, 0..1, soft across the boundary. */
  function matte(data, w, h, pal, tol) {
    const n = w * h;
    const rem = new Float32Array(n);
    const seen = new Uint8Array(n);
    const stack = new Int32Array(n);
    let sp = 0;
    const hi = tol * 1.9;
    const localTol = MAXD * 0.045;
    const driftCap = tol * 3.5;

    const coverage = (d) => {
      if (d <= tol) return 1;
      if (d >= hi) return 0;
      const t = (d - tol) / (hi - tol);
      return 1 - t * t * (3 - 2 * t);      // smoothstep, so edges ramp
    };

    const consider = (j, from) => {
      if (seen[j]) return;
      seen[j] = 1;
      const p = j * 4;
      if (data[p + 3] < 8) { rem[j] = 1; stack[sp++] = j; return; }
      let d = nearest(data, p, pal);
      if (d > tol && d <= driftCap && from >= 0) {
        const q = from * 4;
        const dr = data[p] - data[q], dg = data[p + 1] - data[q + 1], db = data[p + 2] - data[q + 2];
        if (Math.sqrt(dr * dr + dg * dg + db * db) <= localTol) d = tol;   // gradient continues
      }
      const v = coverage(d);
      if (v <= 0.04) return;               // solidly subject: stop here
      rem[j] = v;
      if (v > 0.3) stack[sp++] = j;        // only travel through confident background
    };

    for (let x = 0; x < w; x++) { consider(x, -1); consider((h - 1) * w + x, -1); }
    for (let y = 0; y < h; y++) { consider(y * w, -1); consider(y * w + w - 1, -1); }
    while (sp > 0) {
      const i = stack[--sp];
      const x = i % w, y = (i / w) | 0;
      if (x > 0) consider(i - 1, i);
      if (x < w - 1) consider(i + 1, i);
      if (y > 0) consider(i - w, i);
      if (y < h - 1) consider(i + w, i);
    }
    return rem;
  }

  /* Specks of backdrop the grow left behind get folded into the background. */
  function despeckle(rem, w, h) {
    const n = w * h;
    const seen = new Uint8Array(n);
    const stack = new Int32Array(n);
    const minArea = Math.max(24, Math.round(n * 0.0006));
    for (let s = 0; s < n; s++) {
      if (seen[s] || rem[s] >= 0.5) continue;
      let sp = 0, big = false;
      const comp = [];
      seen[s] = 1; stack[sp++] = s;
      while (sp > 0) {
        const i = stack[--sp];
        if (!big) {
          comp.push(i);
          if (comp.length > minArea) { big = true; comp.length = 0; }
        }
        const x = i % w, y = (i / w) | 0;
        const nb = (j) => { if (!seen[j] && rem[j] < 0.5) { seen[j] = 1; stack[sp++] = j; } };
        if (x > 0) nb(i - 1);
        if (x < w - 1) nb(i + 1);
        if (y > 0) nb(i - w);
        if (y < h - 1) nb(i + w);
      }
      if (!big) for (let k = 0; k < comp.length; k++) rem[comp[k]] = 1;
    }
  }

  /* img (or canvas) -> canvas with the background lifted out */
  function apply(img, S) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const c = U.createCanvas(iw, ih);
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    if (S.bgMode === 'off') return c;

    const id = x.getImageData(0, 0, iw, ih);
    const data = id.data;
    if (alreadyCutOut(data)) return c;     // nothing to do, and nothing to damage

    const pal = bgPalette(data, iw, ih);
    const tol = toleranceFor(data, iw, ih, pal);
    const rem = matte(data, iw, ih, pal, tol);
    despeckle(rem, iw, ih);
    EDT.blur(rem, iw, ih, 0.0012 * Math.min(iw, ih));

    const n = iw * ih;
    for (let i = 0, p = 3; i < n; i++, p += 4) {
      data[p] = U.clamp(data[p] * (1 - U.clamp(rem[i], 0, 1)), 0, 255);
    }
    x.putImageData(id, 0, 0);
    return c;
  }

  g.BG = { apply: apply };
})(window);

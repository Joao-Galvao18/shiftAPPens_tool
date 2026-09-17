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

  /* Paint every brush stroke into ONE mask, in the order they were drawn, so the
     most recent stroke over a pixel is the one that counts — otherwise you could
     never take back an erase by painting restore over it.
     Restore draws white, erase draws black; source-over means the last stroke
     wins. The result carries coverage in alpha and the verdict in red. */
  function brushMask(strokes, w, h) {
    const hits = (strokes || []).filter(s => s.points && s.points.length);
    if (!hits.length) return null;
    const c = U.createCanvas(w, h);
    const x = c.getContext('2d');
    x.lineCap = 'round';
    x.lineJoin = 'round';
    const unit = Math.min(w, h);
    for (const st of hits) {
      const tone = st.kind === 'restore' ? '#ffffff' : '#000000';
      x.strokeStyle = tone;
      x.fillStyle = tone;
      x.lineWidth = Math.max(1, st.size / 100 * unit);
      const pts = st.points;
      if (pts.length === 1) {
        x.beginPath();
        x.arc(pts[0][0] * w, pts[0][1] * h, x.lineWidth / 2, 0, Math.PI * 2);
        x.fill();
        continue;
      }
      x.beginPath();
      x.moveTo(pts[0][0] * w, pts[0][1] * h);
      for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0] * w, pts[i][1] * h);
      x.stroke();
    }
    return x.getImageData(0, 0, w, h).data;
  }

  /* img (or canvas) -> canvas with the background knocked out */
  function apply(img, S) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const c = U.createCanvas(iw, ih);
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);

    const strokes = S.bgBrush || [];
    if (S.bgMode === 'off' && !strokes.length) return c;

    const id = x.getImageData(0, 0, iw, ih);
    const data = id.data;
    const n = iw * ih;

    const orig = new Float32Array(n);
    for (let i = 0, p = 3; i < n; i++, p += 4) orig[i] = data[p] / 255;

    let alpha = orig;
    if (S.bgMode !== 'off') {
      const key = S.bgMode === 'auto' ? cornerKey(data, iw, ih) : U.hex2rgb(S.bgKeyColor);
      const cut = removed(data, iw, ih, key, S.bgTolerance / 100, S.bgContiguous);
      const feather = S.bgFeather / 100 * Math.min(iw, ih);
      if (feather > 0.3) EDT.blur(cut, iw, ih, feather);
      alpha = new Float32Array(n);
      for (let i = 0; i < n; i++) alpha[i] = orig[i] * (1 - U.clamp(cut[i], 0, 1));
    } else {
      alpha = orig.slice();
    }

    const brush = brushMask(strokes, iw, ih);
    if (brush) {
      for (let i = 0, q = 0; i < n; i++, q += 4) {
        const cov = brush[q + 3] / 255;
        if (!cov) continue;
        const wantRestore = brush[q] / 255;          // 1 = restore, 0 = erase
        const rAmt = cov * wantRestore;
        const eAmt = cov * (1 - wantRestore);
        alpha[i] = alpha[i] + (orig[i] - alpha[i]) * rAmt;
        alpha[i] *= (1 - eAmt);
      }
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

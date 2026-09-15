/* edt.js — exact Euclidean distance transform (Felzenszwalb & Huttenlocher),
   separable box/gaussian blur, and a hole filler. All O(n). */
(function (g) {
  'use strict';
  const INF = 1e20;

  /* 1-D squared EDT along one row/column of `grid` */
  function edt1d(grid, offset, stride, length, f, v, z) {
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    f[0] = grid[offset];

    for (let q = 1, k = 0, s = 0; q < length; q++) {
      f[q] = grid[offset + q * stride];
      const q2 = q * q;
      do {
        const r = v[k];
        s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
      } while (s <= z[k] && --k > -1);
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }

    for (let q = 0, k = 0; q < length; q++) {
      while (z[k + 1] < q) k++;
      const r = v[k];
      const qr = q - r;
      grid[offset + q * stride] = f[r] + qr * qr;
    }
  }

  /* in-place 2-D squared EDT */
  function edt2d(grid, w, h) {
    const m = Math.max(w, h);
    const f = new Float64Array(m);
    const v = new Int32Array(m);
    const z = new Float64Array(m + 1);
    for (let x = 0; x < w; x++) edt1d(grid, x, w, h, f, v, z);
    for (let y = 0; y < h; y++) edt1d(grid, y * w, 1, w, f, v, z);
    return grid;
  }

  /* signed distance: >0 outside the shape, <0 inside, in pixels */
  function signedDistance(mask, w, h) {
    const n = w * h;
    const outer = new Float32Array(n);
    const inner = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (mask[i] > 0.5) { outer[i] = 0; inner[i] = INF; }
      else { outer[i] = INF; inner[i] = 0; }
    }
    edt2d(outer, w, h);
    edt2d(inner, w, h);
    for (let i = 0; i < n; i++) outer[i] = Math.sqrt(outer[i]) - Math.sqrt(inner[i]);
    return outer;
  }

  /* ---- blur ---- */
  function boxesForGauss(sigma, n) {
    const wIdeal = Math.sqrt((12 * sigma * sigma / n) + 1);
    let wl = Math.floor(wIdeal);
    if (wl % 2 === 0) wl--;
    const wu = wl + 2;
    const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
    const m = Math.round(mIdeal);
    const sizes = [];
    for (let i = 0; i < n; i++) sizes.push(i < m ? wl : wu);
    return sizes;
  }

  function boxH(src, dst, w, h, r) {
    if (r < 1) { dst.set(src); return; }
    r = Math.min(r, (w - 1) >> 1);
    if (r < 1) { dst.set(src); return; }
    const iarr = 1 / (r + r + 1);
    for (let i = 0; i < h; i++) {
      let ti = i * w, li = ti, ri = ti + r;
      const fv = src[ti], lv = src[ti + w - 1];
      let val = (r + 1) * fv;
      for (let j = 0; j < r; j++) val += src[ti + j];
      for (let j = 0; j <= r; j++) { val += src[ri++] - fv; dst[ti++] = val * iarr; }
      for (let j = r + 1; j < w - r; j++) { val += src[ri++] - src[li++]; dst[ti++] = val * iarr; }
      for (let j = w - r; j < w; j++) { val += lv - src[li++]; dst[ti++] = val * iarr; }
    }
  }

  function boxV(src, dst, w, h, r) {
    if (r < 1) { dst.set(src); return; }
    r = Math.min(r, (h - 1) >> 1);
    if (r < 1) { dst.set(src); return; }
    const iarr = 1 / (r + r + 1);
    for (let i = 0; i < w; i++) {
      let ti = i, li = ti, ri = ti + r * w;
      const fv = src[ti], lv = src[ti + w * (h - 1)];
      let val = (r + 1) * fv;
      for (let j = 0; j < r; j++) val += src[ti + j * w];
      for (let j = 0; j <= r; j++) { val += src[ri] - fv; dst[ti] = val * iarr; ri += w; ti += w; }
      for (let j = r + 1; j < h - r; j++) { val += src[ri] - src[li]; dst[ti] = val * iarr; li += w; ri += w; ti += w; }
      for (let j = h - r; j < h; j++) { val += lv - src[li]; dst[ti] = val * iarr; li += w; ti += w; }
    }
  }

  function blur(src, w, h, sigma) {
    if (!(sigma > 0.3)) return src;
    const tmp = new Float32Array(src.length);
    const boxes = boxesForGauss(sigma, 3);
    for (let i = 0; i < 3; i++) {
      const r = (boxes[i] - 1) / 2;
      boxH(src, tmp, w, h, r);
      boxV(tmp, src, w, h, r);
    }
    return src;
  }

  /* flood-fill enclosed background pockets so the silhouette is one solid blob */
  function fillHoles(mask, w, h) {
    const n = w * h;
    const seen = new Uint8Array(n);
    const stack = new Int32Array(n);
    let sp = 0;
    const push = (i) => { if (!seen[i] && mask[i] <= 0.5) { seen[i] = 1; stack[sp++] = i; } };
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
    for (let i = 0; i < n; i++) if (mask[i] <= 0.5 && !seen[i]) mask[i] = 1;
  }

  g.EDT = { signedDistance, edt2d, blur, fillHoles, INF };
})(window);

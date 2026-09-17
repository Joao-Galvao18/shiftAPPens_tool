/* engine.js — placement, silhouette extraction, ring compositing, image FX, export.

   RESOLUTION INDEPENDENCE
   -----------------------
   Every spatial parameter (stroke, gap, offset, smoothing, dither cell, grain,
   image offset) is stored as a PERCENTAGE of a basis dimension of the canvas.
   At render time:  px = pct / 100 * unit,  unit = f(width, height).
   Preview and export run the exact same maths at different scales, so the design
   is proportionally identical from a 1080px post to an 8000px banner.
*/
(function (g) {
  'use strict';

  const MAXCODE = 64;

  function computeUnit(basis, W, H) {
    switch (basis) {
      case 'long': return Math.max(W, H);
      case 'width': return W;
      case 'height': return H;
      case 'diag': return Math.hypot(W, H) / Math.SQRT2;
      default: return Math.min(W, H);
    }
  }

  function canvasPx(S) {
    let W, H;
    if (S.units === 'px') { W = S.cw; H = S.ch; }
    else if (S.units === 'mm') { W = S.cw / 25.4 * S.dpi; H = S.ch / 25.4 * S.dpi; }
    else { W = S.cw * S.dpi; H = S.ch * S.dpi; }
    return { W: Math.max(2, Math.round(W)), H: Math.max(2, Math.round(H)) };
  }

  /* ---------- 1. place the source image on the canvas ---------- */

  /* Bounding box of the non-transparent pixels, in source-image coordinates.
     Cut-out PNGs usually carry a lot of empty margin; framing on this instead of
     on the file's own edges is what makes Scale mean "how big is the subject".
     Returns null when the image has no transparency to measure. */
  function subjectBox(img) {
    if (img._box !== undefined) return img._box;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    let box = null;
    if (hasAlpha(img)) {
      const k = Math.min(1, 480 / Math.max(iw, ih));
      const w = Math.max(1, Math.round(iw * k)), h = Math.max(1, Math.round(ih * k));
      const c = U.createCanvas(w, h);
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) {
        for (let xx = 0; xx < w; xx++) {
          if (d[(y * w + xx) * 4 + 3] > 128) {
            if (xx < x0) x0 = xx;
            if (xx > x1) x1 = xx;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      if (x1 >= x0 && y1 >= y0) {
        box = {
          x: x0 / k, y: y0 / k,
          w: (x1 - x0 + 1) / k, h: (y1 - y0 + 1) / k
        };
      }
    }
    img._box = box;
    return box;
  }

  /* The source after background removal. Cached separately, because it is the
     expensive step and a colour tweak must never re-run it. */
  let srcCache = { key: null };

  function preparedSource(img, S, token) {
    if (!img) return null;
    const key = [token, S.bgMode, S.bgKeyColor, S.bgTolerance, S.bgContiguous, S.bgFeather].join('|');
    if (srcCache.key === key) return srcCache.val;
    const val = S.bgMode === 'off' ? img : BG.apply(img, S);
    srcCache = { key: key, val: val };
    return val;
  }

  /* source-image coords -> canvas coords. Built as a matrix so it can be
     inverted: the eyedropper and the background brush need to go the other way. */
  function placementMatrix(src, W, H, S, unit) {
    const iw = src.naturalWidth || src.width, ih = src.naturalHeight || src.height;
    let fx = 0, fy = 0, fw = iw, fh = ih;
    if (S.fitSubject) {
      const b = subjectBox(src);
      if (b) { fx = b.x; fy = b.y; fw = b.w; fh = b.h; }
    }
    const base = S.fit === 'cover' ? Math.max(W / fw, H / fh) : Math.min(W / fw, H / fh);
    const s = base * (S.imgScale / 100);
    const m = new DOMMatrix();
    m.translateSelf(W / 2 + S.imgX / 100 * unit, H / 2 + S.imgY / 100 * unit);
    if (S.rotate) m.rotateSelf(S.rotate);
    m.scaleSelf(s * (S.flipH ? -1 : 1), s * (S.flipV ? -1 : 1));
    m.translateSelf(-(fx + fw / 2), -(fy + fh / 2));
    return m;
  }

  function placeImage(src, W, H, S, unit) {
    const c = U.createCanvas(W, H);
    const x = c.getContext('2d');
    if (!src) return c;
    const iw = src.naturalWidth || src.width, ih = src.naturalHeight || src.height;
    if (!iw || !ih) return c;
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = 'high';
    const m = placementMatrix(src, W, H, S, unit);
    x.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    x.drawImage(src, 0, 0, iw, ih);
    x.setTransform(1, 0, 0, 1, 0, 0);
    return c;
  }

  /* canvas point -> point in the source image, normalised to [0..1] */
  function canvasToSource(img, S, W, H, px, py) {
    if (!img) return null;
    const unit = computeUnit(S.basis, W, H);
    const m = placementMatrix(img, W, H, S, unit).inverse();
    const p = m.transformPoint(new DOMPoint(px, py));
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    return { x: p.x / iw, y: p.y / ih, inside: p.x >= 0 && p.y >= 0 && p.x < iw && p.y < ih };
  }

  /* How far the strokes reach beyond the silhouette, in canvas pixels. Alignment
     uses it so "align left" puts the outermost stroke against the edge rather
     than pushing it off the canvas. */
  function strokeExtent(S, unit) {
    const bands = ringBands(S, unit, Math.min(S.ringCount, MAXCODE));
    return bands.max + Math.max(0, S.maskExpand / 100 * unit);
  }

  /* Axis-aligned bounding box of the placed subject, in canvas pixels. The four
     corners go through the same matrix the render uses, so rotation is handled. */
  function subjectRect(img, S, W, H, token) {
    const src = preparedSource(img, S, token);
    if (!src) return null;
    const iw = src.naturalWidth || src.width, ih = src.naturalHeight || src.height;
    let fx = 0, fy = 0, fw = iw, fh = ih;
    const b = S.fitSubject ? subjectBox(src) : null;
    if (b) { fx = b.x; fy = b.y; fw = b.w; fh = b.h; }
    const m = placementMatrix(src, W, H, S, computeUnit(S.basis, W, H));
    const pts = [[fx, fy], [fx + fw, fy], [fx + fw, fy + fh], [fx, fy + fh]]
      .map(c => m.transformPoint(new DOMPoint(c[0], c[1])));
    const xs = pts.map(q => q.x), ys = pts.map(q => q.y);
    const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    const y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /* how many canvas pixels one source pixel covers, so the UI can show the
     background brush at its true size on the artboard */
  function sourceScale(img, S, W, H) {
    if (!img) return 1;
    const m = placementMatrix(img, W, H, S, computeUnit(S.basis, W, H));
    return Math.hypot(m.a, m.b);
  }

  /* colour under a canvas point, read from the ORIGINAL image so the eyedropper
     keeps working after the background has been knocked out */
  function pickColor(img, S, W, H, px, py) {
    const q = canvasToSource(img, S, W, H, px, py);
    if (!q || !q.inside) return null;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const c = U.createCanvas(1, 1);
    const x = c.getContext('2d');
    x.drawImage(img, Math.floor(q.x * iw), Math.floor(q.y * ih), 1, 1, 0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data;
    return U.rgb2hex([d[0], d[1], d[2]]);
  }

  /* ---------- 2. silhouette mask + signed distance field ---------- */

  /* Does the SOURCE image carry real transparency? Checked on the image itself,
     not on the placement canvas, whose margins are always transparent. */
  function hasAlpha(img) {
    if (!img) return false;
    if (img._hasAlpha != null) return img._hasAlpha;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const k = Math.min(1, 160 / Math.max(iw, ih));
    const c = U.createCanvas(Math.max(1, iw * k), Math.max(1, ih * k));
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let found = false;
    for (let i = 3; i < d.length; i += 4) { if (d[i] < 250) { found = true; break; } }
    img._hasAlpha = found;
    return found;
  }

  function buildMask(data, W, H, S, img) {
    const n = W * H;
    const m = new Float32Array(n);
    let src = S.maskSource;
    if (src === 'auto') src = hasAlpha(img) ? 'alpha' : 'dark';
    const thr = S.maskThreshold;
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const a = data[p + 3];
      let v;
      if (src === 'alpha') v = a > thr ? 1 : 0;
      else {
        const lum = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
        v = (src === 'dark' ? lum < thr : lum > thr) ? 1 : 0;
        if (a < 128) v = 0;
      }
      m[i] = v;
    }
    if (S.maskInvert) for (let i = 0; i < n; i++) m[i] = 1 - m[i];
    if (S.maskFillHoles) EDT.fillHoles(m, W, H);
    return m;
  }

  function buildSDF(data, W, H, S, unit, img) {
    const m = buildMask(data, W, H, S, img);
    const smooth = S.maskSmooth / 100 * unit;
    if (smooth > 0.3) {
      EDT.blur(m, W, H, smooth);
      for (let i = 0; i < m.length; i++) m[i] = m[i] > 0.5 ? 1 : 0;
      if (S.maskFillHoles) EDT.fillHoles(m, W, H);
    }
    return { sdf: EDT.signedDistance(m, W, H), mask: m };
  }

  /* ---------- 3. ring lookup table ----------
     codes: 0..n-1 ring index | -1 gap | -2 halo | -3 background | -4 inner fill */
  const LUT_STEP = 0.25;

  function ringBands(S, unit, count) {
    const px = p => p / 100 * unit;
    const bands = [];
    let d = px(S.ringOffset);
    let w = px(S.strokeW);
    const gap = px(S.ringGap);
    for (let i = 0; i < count; i++) {
      if (w < 0.01) break;
      bands.push({ s: d, e: d + w, c: i });
      d += w + gap;
      w *= S.ringGrowth;
    }
    return { bands, halo: px(S.ringOffset), max: d };
  }

  function buildLUT(S, unit, count, haloCode) {
    const r = ringBands(S, unit, count);
    const size = Math.max(2, Math.ceil(r.max / LUT_STEP) + 2);
    const lut = new Int8Array(size).fill(-1);
    const hi = Math.min(size, Math.ceil(r.halo / LUT_STEP));
    for (let i = 0; i < hi; i++) lut[i] = haloCode;
    for (const b of r.bands) {
      const a = Math.max(0, Math.round(b.s / LUT_STEP));
      const z = Math.min(size, Math.round(b.e / LUT_STEP));
      for (let i = a; i < z; i++) lut[i] = Math.min(b.c, MAXCODE - 1);
    }
    return lut;
  }

  function palette(S) {
    const r = new Float32Array(MAXCODE + 8);
    const gg = new Float32Array(MAXCODE + 8);
    const b = new Float32Array(MAXCODE + 8);
    const put = (code, hex) => {
      const c = U.hex2rgb(hex);
      r[code + 4] = c[0]; gg[code + 4] = c[1]; b[code + 4] = c[2];
    };
    put(-3, S.bg);
    put(-1, S.gapUseBg ? S.bg : S.gapColor);
    put(-2, S.haloUseBg ? S.bg : S.haloColor);
    put(-4, S.fillUseBg ? S.bg : S.fillColor);
    const cols = S.ringColors.length ? S.ringColors : ['#000000'];
    for (let i = 0; i < MAXCODE; i++) put(i, cols[i % cols.length]);
    return { r: r, g: gg, b: b };
  }

  /* ---------- 4. paint the rings ---------- */
  function paintRings(sdf, W, H, S, unit) {
    const out = new ImageData(W, H);
    const d8 = out.data;
    const pal = palette(S);
    const lutO = buildLUT(S, unit, Math.min(S.ringCount, MAXCODE), -2);
    const lutI = S.innerRings > 0 ? buildLUT(S, unit, Math.min(S.innerRings, MAXCODE), -4) : null;
    const nO = lutO.length, nI = lutI ? lutI.length : 0;
    const expand = S.maskExpand / 100 * unit;
    const inv = 1 / LUT_STEP;

    // 3 taps along the field gradient => cheap, accurate anti-aliasing
    const taps = S.aa ? [-0.42, 0, 0.42] : [0];
    const wts = S.aa ? [0.25, 0.5, 0.25] : [1];
    const nt = taps.length;

    const n = W * H;
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const base = sdf[i] - expand;
      let R = 0, G = 0, B = 0;
      for (let t = 0; t < nt; t++) {
        const d = base + taps[t];
        let code;
        if (d <= 0) {
          if (lutI) { const k = (-d * inv) | 0; code = k < nI ? lutI[k] : -4; }
          else code = -4;
        } else {
          const k = (d * inv) | 0;
          code = k < nO ? lutO[k] : -3;
        }
        const ci = code + 4, wt = wts[t];
        R += pal.r[ci] * wt; G += pal.g[ci] * wt; B += pal.b[ci] * wt;
      }
      d8[p] = R; d8[p + 1] = G; d8[p + 2] = B; d8[p + 3] = 255;
    }
    return out;
  }

  /* ---------- 5. artwork treatment (threshold / dither / noise / posterize) ---------- */
  const BAYER8 = [
    0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
    12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21
  ].map(v => (v + 0.5) / 64);
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

  function buildArt(placed, mask, W, H, S, unit) {
    if (S.artMode === 'none') return null;

    if (S.artMode === 'silhouette') {
      const c = U.createCanvas(W, H);
      const id = new ImageData(W, H);
      const col = U.hex2rgb(S.inkColor);
      const d = id.data;
      for (let i = 0, p = 0; i < W * H; i++, p += 4) {
        if (mask[i] > 0.5) { d[p] = col[0]; d[p + 1] = col[1]; d[p + 2] = col[2]; d[p + 3] = 255; }
      }
      c.getContext('2d').putImageData(id, 0, 0);
      return c;
    }

    const halftone = S.artMode === 'bitmap' && S.ditherMode === 'halftone';
    // a halftone screen needs full resolution; its cell size carries the scaling
    const block = halftone ? 1 : Math.max(1, Math.round(S.ditherScale / 100 * unit));
    const w2 = Math.max(1, Math.round(W / block));
    const h2 = Math.max(1, Math.round(H / block));

    const work = U.createCanvas(w2, h2);
    const wx = work.getContext('2d');
    wx.imageSmoothingEnabled = true;
    wx.imageSmoothingQuality = 'high';
    wx.drawImage(placed, 0, 0, w2, h2);

    const id = wx.getImageData(0, 0, w2, h2);
    const d = id.data;
    const n = w2 * h2;

    const br = S.brightness / 100;
    const ct = Math.tan((U.clamp(S.contrast, -99, 99) / 100 + 1) * Math.PI / 4);
    const sat = S.saturation / 100;
    const lv = S.posterize > 1 ? S.posterize : 0;

    for (let p = 0; p < d.length; p += 4) {
      let r = d[p] / 255, gg = d[p + 1] / 255, b = d[p + 2] / 255;
      r += br; gg += br; b += br;
      r = (r - 0.5) * ct + 0.5; gg = (gg - 0.5) * ct + 0.5; b = (b - 0.5) * ct + 0.5;
      if (sat !== 1) {
        const l = 0.299 * r + 0.587 * gg + 0.114 * b;
        r = l + (r - l) * sat; gg = l + (gg - l) * sat; b = l + (b - l) * sat;
      }
      if (S.artInvert) { r = 1 - r; gg = 1 - gg; b = 1 - b; }
      if (lv) {
        r = Math.round(r * (lv - 1)) / (lv - 1);
        gg = Math.round(gg * (lv - 1)) / (lv - 1);
        b = Math.round(b * (lv - 1)) / (lv - 1);
      }
      d[p] = U.clamp(r * 255, 0, 255);
      d[p + 1] = U.clamp(gg * 255, 0, 255);
      d[p + 2] = U.clamp(b * 255, 0, 255);
    }

    if (S.artMode === 'bitmap') {
      const lum = new Float32Array(n);
      for (let i = 0, p = 0; i < n; i++, p += 4) {
        lum[i] = (0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]) / 255;
      }
      const thr = S.bwThreshold / 255;
      const bits = new Uint8Array(n);
      const mode = S.ditherMode;

      if (mode === 'halftone') {
        /* Classic rotated dot screen: inside each cell the ink dot grows as the
           tone darkens, its AREA proportional to coverage (hence the sqrt).
           The cell is a percentage of the basis, so the screen ruling scales with
           the canvas instead of dissolving into noise on a large export. */
        const cell = Math.max(2, S.ditherScale / 100 * unit);
        const a = S.halftoneAngle * Math.PI / 180;
        const ca = Math.cos(a), sa = Math.sin(a);
        const shape = S.halftoneShape;
        const gain = Math.max(0.01, S.ditherStrength / 100);
        for (let y = 0; y < h2; y++) {
          for (let x = 0; x < w2; x++) {
            const i = y * w2 + x;
            const u = (x * ca - y * sa) / cell;
            const v = (x * sa + y * ca) / cell;
            const cov = U.clamp((thr - lum[i]) * gain + 0.5, 0, 1);  // 1 = solid ink
            let d;
            if (shape === 'line') {
              d = Math.abs(v - Math.floor(v) - 0.5) * 2;
            } else {
              const fu = u - Math.floor(u) - 0.5;
              const fv = v - Math.floor(v) - 0.5;
              d = shape === 'square'
                ? Math.max(Math.abs(fu), Math.abs(fv)) * 2
                : Math.hypot(fu, fv) * 2;
            }
            bits[i] = d < Math.sqrt(cov) * 1.128 ? 0 : 1;   // 0 = ink
          }
        }
      } else if (mode === 'floyd') {
        for (let y = 0; y < h2; y++) {
          const rev = y % 2 === 1;
          for (let k = 0; k < w2; k++) {
            const x = rev ? w2 - 1 - k : k;
            const i = y * w2 + x;
            const old = lum[i];
            const nv = old > thr ? 1 : 0;
            bits[i] = nv;
            const err = old - nv;
            const dx = rev ? -1 : 1;
            const add = (xx, yy, f) => {
              if (xx < 0 || xx >= w2 || yy >= h2) return;
              lum[yy * w2 + xx] += err * f;
            };
            add(x + dx, y, 7 / 16);
            add(x - dx, y + 1, 3 / 16);
            add(x, y + 1, 5 / 16);
            add(x + dx, y + 1, 1 / 16);
          }
        }
      } else {
        const amp = S.ditherStrength / 100;
        for (let y = 0; y < h2; y++) {
          for (let x = 0; x < w2; x++) {
            const i = y * w2 + x;
            let t = thr;
            if (mode === 'bayer8') t = thr + (BAYER8[(y % 8) * 8 + (x % 8)] - 0.5) * amp;
            else if (mode === 'bayer4') t = thr + (BAYER4[(y % 4) * 4 + (x % 4)] - 0.5) * amp;
            else if (mode === 'noise') t = thr + (U.hash(x, y, S.seed) - 0.5) * amp;
            bits[i] = lum[i] > t ? 1 : 0;
          }
        }
      }

      const ink = U.hex2rgb(S.inkColor);
      const paper = U.hex2rgb(S.paperColor);
      const inkLight = S.inkOn === 'light';
      for (let i = 0, p = 0; i < n; i++, p += 4) {
        const isInk = inkLight ? bits[i] === 1 : bits[i] === 0;
        const a = d[p + 3];
        if (a < 20) { d[p + 3] = 0; continue; }
        if (isInk) { d[p] = ink[0]; d[p + 1] = ink[1]; d[p + 2] = ink[2]; d[p + 3] = 255; }
        else if (S.paperTransparent) { d[p + 3] = 0; }
        else { d[p] = paper[0]; d[p + 1] = paper[1]; d[p + 2] = paper[2]; d[p + 3] = 255; }
      }
    }

    wx.putImageData(id, 0, 0);

    const out = U.createCanvas(W, H);
    const ox = out.getContext('2d');
    ox.imageSmoothingEnabled = block <= 1 ? true : !S.crispPixels;
    ox.drawImage(work, 0, 0, W, H);

    if (S.artClip) {
      const mc = U.createCanvas(W, H);
      const mid = new ImageData(W, H);
      const md = mid.data;
      for (let i = 0, p = 0; i < W * H; i++, p += 4) {
        if (mask[i] > 0.5) { md[p] = md[p + 1] = md[p + 2] = 0; md[p + 3] = 255; }
      }
      mc.getContext('2d').putImageData(mid, 0, 0);
      ox.globalCompositeOperation = 'destination-in';
      ox.drawImage(mc, 0, 0);
      ox.globalCompositeOperation = 'source-over';
    }
    return out;
  }

  /* ---------- 6. grain overlay ---------- */
  function grain(ctx, W, H, S, unit) {
    if (!(S.grainAmount > 0)) return;
    const block = Math.max(1, Math.round(S.grainScale / 100 * unit));
    const w2 = Math.max(1, Math.round(W / block));
    const h2 = Math.max(1, Math.round(H / block));
    const nc = U.createCanvas(w2, h2);
    const id = new ImageData(w2, h2);
    const d = id.data;
    for (let y = 0, i = 0; y < h2; y++) {
      for (let x = 0; x < w2; x++, i += 4) {
        if (S.grainMono) {
          const v = U.hash(x, y, S.seed + 7) * 255;
          d[i] = d[i + 1] = d[i + 2] = v;
        } else {
          d[i] = U.hash(x, y, S.seed + 1) * 255;
          d[i + 1] = U.hash(x, y, S.seed + 2) * 255;
          d[i + 2] = U.hash(x, y, S.seed + 3) * 255;
        }
        d[i + 3] = 255;
      }
    }
    nc.getContext('2d').putImageData(id, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = U.clamp(S.grainAmount / 100, 0, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(nc, 0, 0, W, H);
    ctx.restore();
  }

  /* ---------- 7. full render (cached so colour tweaks are instant) ---------- */
  let cache = { key: null };

  function fieldKey(S, W, H, token) {
    return [W, H, S.basis, S.fit, S.fitSubject, S.imgScale, S.imgX, S.imgY, S.rotate, S.flipH, S.flipV,
      S.bgMode, S.bgKeyColor, S.bgTolerance, S.bgContiguous, S.bgFeather,
      S.maskSource, S.maskThreshold, S.maskInvert, S.maskFillHoles, S.maskSmooth, token].join('|');
  }

  function field(S, img, W, H, token) {
    const key = fieldKey(S, W, H, token);
    if (cache.key === key) return cache.val;
    const unit = computeUnit(S.basis, W, H);
    const src = preparedSource(img, S, token);
    const placed = placeImage(src, W, H, S, unit);
    const data = placed.getContext('2d').getImageData(0, 0, W, H).data;
    const r = buildSDF(data, W, H, S, unit, src);
    cache = { key: key, val: { placed: placed, sdf: r.sdf, mask: r.mask } };
    return cache.val;
  }

  /* Everything under the drawing layer: rings plus the treated artwork. Cached,
     so dragging a brush redraws only the cheap top layers instead of re-running
     the distance transform and the halftone screen on every pointer move. */
  let baseCache = { key: null };

  function baseKey(S, W, H, token) {
    const o = {};
    const skip = {
      paint: 1, lang: 1, sizePreset: 1, previewQuality: 1,
      grainAmount: 1, grainScale: 1, grainMono: 1,
      brushColor: 1, brushWidth: 1, brushType: 1,
      exportScale: 1, svgRes: 1, svgSimplify: 1,
    };
    for (const k in S) if (!skip[k]) o[k] = S[k];
    return W + 'x' + H + '|' + token + '|' + JSON.stringify(o);
  }

  function baseLayer(S, img, W, H, token, unit) {
    const key = baseKey(S, W, H, token);
    if (baseCache.key === key) return baseCache.val;
    const f = field(S, img, W, H, token);
    const base = U.createCanvas(W, H);
    const bx = base.getContext('2d');
    bx.putImageData(paintRings(f.sdf, W, H, S, unit), 0, 0);
    const art = buildArt(f.placed, f.mask, W, H, S, unit);
    if (art) {
      bx.globalAlpha = U.clamp(S.artOpacity / 100, 0, 1);
      bx.drawImage(art, 0, 0);
      bx.globalAlpha = 1;
    }
    // don't hold on to enormous export canvases
    if (W * H <= 16e6) baseCache = { key: key, val: base };
    return base;
  }

  function render(S, img, W, H, token) {
    const unit = computeUnit(S.basis, W, H);
    const out = U.createCanvas(W, H);
    const ctx = out.getContext('2d');
    ctx.drawImage(baseLayer(S, img, W, H, token, unit), 0, 0);
    Paint.render(ctx, S.paint, W, H, unit);
    grain(ctx, W, H, S, unit);
    return out;
  }

  /* ---------- 8. SVG export: rings become real vector paths ---------- */
  function toSVG(S, img, W, H, token, res) {
    const k = Math.min(1, res / Math.max(W, H));
    const rw = Math.max(64, Math.round(W * k));
    const rh = Math.max(64, Math.round(H * k));
    const runit = computeUnit(S.basis, rw, rh);
    const f = field(S, img, rw, rh, token + '#svg');

    const P = 3;
    const padded = Contour.pad(f.sdf, rw, rh, P, 1e6);
    const sx = W / rw, sy = H / rh;
    const expand = S.maskExpand / 100 * runit;
    const eps = S.svgSimplify;

    const loopsAt = (lvl) => Contour.marchingSquares(padded.field, padded.w, padded.h, lvl + expand);
    const dOf = (loops) => Contour.toPath(loops, sx, sy, P, P, eps);

    const parts = [];
    parts.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + S.bg + '"/>');

    const push = (outerLvl, innerLvl, fill) => {
      let dd = dOf(loopsAt(outerLvl));
      if (innerLvl != null) dd += dOf(loopsAt(innerLvl));
      if (dd) parts.push('<path fill="' + fill + '" fill-rule="evenodd" d="' + dd + '"/>');
    };

    const rb = ringBands(S, runit, Math.min(S.ringCount, MAXCODE));
    const bands = rb.bands;
    const halo = S.ringOffset / 100 * runit;

    if (!S.haloUseBg && halo > 0.01) push(halo, 0, S.haloColor);
    if (!S.gapUseBg) {
      for (let i = 0; i < bands.length - 1; i++) {
        if (bands[i + 1].s - bands[i].e > 0.01) push(bands[i + 1].s, bands[i].e, S.gapColor);
      }
    }
    const cols = S.ringColors.length ? S.ringColors : ['#000000'];
    for (let i = 0; i < bands.length; i++) push(bands[i].e, bands[i].s, cols[i % cols.length]);
    push(0, null, S.fillUseBg ? S.bg : S.fillColor);

    // artwork stays raster (keeps photographic detail) but at full export resolution
    const fFull = field(S, img, W, H, token);
    const art = buildArt(fFull.placed, fFull.mask, W, H, S, computeUnit(S.basis, W, H));
    if (art) {
      parts.push('<image x="0" y="0" width="' + W + '" height="' + H + '" opacity="' +
        (S.artOpacity / 100) + '" xlink:href="' + art.toDataURL('image/png') + '"/>');
    }

    if (S.paint && S.paint.length) {
      const pc = U.createCanvas(W, H);
      Paint.render(pc.getContext('2d'), S.paint, W, H, computeUnit(S.basis, W, H));
      parts.push('<image x="0" y="0" width="' + W + '" height="' + H +
        '" xlink:href="' + pc.toDataURL('image/png') + '"/>');
    }

    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
      'width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">\n' +
      '<defs><clipPath id="clip"><rect width="' + W + '" height="' + H + '"/></clipPath></defs>\n' +
      '<g clip-path="url(#clip)">' + parts.join('') + '</g>\n</svg>\n';
  }

  g.Engine = {
    render: render,
    toSVG: toSVG,
    canvasPx: canvasPx,
    computeUnit: computeUnit,
    ringBands: ringBands,
    canvasToSource: canvasToSource,
    sourceScale: sourceScale,
    subjectRect: subjectRect,
    strokeExtent: strokeExtent,
    pickColor: pickColor,
    preparedSource: preparedSource,
    clearCache: function () { cache = { key: null }; srcCache = { key: null }; baseCache = { key: null }; }
  };
})(window);

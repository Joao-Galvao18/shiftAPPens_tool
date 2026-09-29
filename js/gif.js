/* gif.js — a small, self-contained animated-GIF encoder.

   No dependency: the artifact sandbox blocks fetching a worker script from a CDN,
   and the tool has no build step, so the encoder lives here. It is the format
   people actually paste into a chat or a story, so it is worth the ~200 lines.

   Median-cut quantisation over a 15-bit histogram, one palette shared by every
   frame (the frames of these animations use the same handful of colours, so a
   shared table both looks right and keeps the file small), then standard
   variable-width LZW per frame.
*/
(function (g) {
  'use strict';

  /* ---------- growable byte sink ---------- */
  function Buf() { this.a = new Uint8Array(1 << 16); this.n = 0; }
  Buf.prototype.b = function (v) {
    if (this.n === this.a.length) {
      const t = new Uint8Array(this.a.length * 2);
      t.set(this.a); this.a = t;
    }
    this.a[this.n++] = v & 255;
  };
  Buf.prototype.s = function (str) { for (let i = 0; i < str.length; i++) this.b(str.charCodeAt(i)); };
  Buf.prototype.u16 = function (v) { this.b(v); this.b(v >> 8); };
  Buf.prototype.out = function () { return this.a.subarray(0, this.n); };

  /* ---------- palette: median cut over a 15-bit histogram ---------- */
  function newHist() {
    return {
      count: new Uint32Array(32768),
      sr: new Float64Array(32768),
      sg: new Float64Array(32768),
      sb: new Float64Array(32768)
    };
  }

  function accumulate(h, d, step) {
    for (let i = 0; i < d.length; i += 4 * step) {
      const r = d[i], gg = d[i + 1], bb = d[i + 2];
      const k = ((r >> 3) << 10) | ((gg >> 3) << 5) | (bb >> 3);
      h.count[k]++; h.sr[k] += r; h.sg[k] += gg; h.sb[k] += bb;
    }
  }

  function quantize(h, maxColors) {
    const bins = [];
    for (let k = 0; k < 32768; k++) if (h.count[k]) bins.push(k);
    if (!bins.length) return [[0, 0, 0]];

    const boxFor = (list) => {
      let rmin = 31, rmax = 0, gmin = 31, gmax = 0, bmin = 31, bmax = 0, n = 0;
      for (const k of list) {
        const r = (k >> 10) & 31, gg = (k >> 5) & 31, bb = k & 31;
        if (r < rmin) rmin = r; if (r > rmax) rmax = r;
        if (gg < gmin) gmin = gg; if (gg > gmax) gmax = gg;
        if (bb < bmin) bmin = bb; if (bb > bmax) bmax = bb;
        n += h.count[k];
      }
      return { list: list, n: n, rr: rmax - rmin, gr: gmax - gmin, br: bmax - bmin };
    };

    let boxes = [boxFor(bins)];
    while (boxes.length < maxColors) {
      // split the box with the most pixels that still has room to split
      let pick = -1, best = 0;
      for (let i = 0; i < boxes.length; i++) {
        const bx = boxes[i];
        if (bx.list.length < 2) continue;
        if (bx.n > best) { best = bx.n; pick = i; }
      }
      if (pick < 0) break;
      const bx = boxes[pick];
      const axis = bx.rr >= bx.gr && bx.rr >= bx.br ? 10 : (bx.gr >= bx.br ? 5 : 0);
      const sorted = bx.list.slice().sort((a, b) => ((a >> axis) & 31) - ((b >> axis) & 31));
      let half = bx.n / 2, acc = 0, cut = 0;
      for (; cut < sorted.length - 1; cut++) {
        acc += h.count[sorted[cut]];
        if (acc >= half) break;
      }
      boxes.splice(pick, 1, boxFor(sorted.slice(0, cut + 1)), boxFor(sorted.slice(cut + 1)));
    }

    return boxes.map(bx => {
      let r = 0, gg = 0, bb = 0, n = 0;
      for (const k of bx.list) { r += h.sr[k]; gg += h.sg[k]; bb += h.sb[k]; n += h.count[k]; }
      n = n || 1;
      return [Math.round(r / n), Math.round(gg / n), Math.round(bb / n)];
    });
  }

  /* nearest-colour lookup, memoised over the 15-bit cube */
  function mapper(pal) {
    const cache = new Int16Array(32768).fill(-1);
    return function (r, gg, bb) {
      const k = ((r >> 3) << 10) | ((gg >> 3) << 5) | (bb >> 3);
      let v = cache[k];
      if (v >= 0) return v;
      let best = 0, bd = Infinity;
      for (let i = 0; i < pal.length; i++) {
        const c = pal[i];
        const dr = r - c[0], dg = gg - c[1], db = bb - c[2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bd) { bd = d; best = i; }
      }
      cache[k] = best;
      return best;
    };
  }

  /* ---------- LZW, written into 255-byte sub-blocks ---------- */
  function lzw(indices, minCode, out) {
    const clear = 1 << minCode, eoi = clear + 1;
    let size = minCode + 1, next = eoi + 1;
    let dict = new Map();
    let cur = 0, bits = 0;
    const block = [];

    const flush = () => {
      if (!block.length) return;
      out.b(block.length);
      for (const v of block) out.b(v);
      block.length = 0;
    };
    const emit = (code) => {
      cur |= code << bits;
      bits += size;
      while (bits >= 8) {
        block.push(cur & 255);
        cur >>= 8; bits -= 8;
        if (block.length === 255) flush();
      }
    };

    out.b(minCode);
    emit(clear);
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i];
      const key = prefix * 4096 + k;
      const found = dict.get(key);
      if (found !== undefined) { prefix = found; continue; }
      emit(prefix);
      dict.set(key, next++);
      if (next > (1 << size)) {
        if (size < 12) size++;
        else { emit(clear); dict = new Map(); size = minCode + 1; next = eoi + 1; }
      }
      prefix = k;
    }
    emit(prefix);
    emit(eoi);
    if (bits > 0) { block.push(cur & 255); if (block.length === 255) flush(); }
    flush();
    out.b(0);
  }

  /* ---------- the encoder ----------
     Three phases, so nothing holds every frame at once: SAMPLE a handful of
     frames to learn the palette, BEGIN to write the header, then stream each
     frame through addFrame. At 60fps a two second loop is 120 frames — keeping
     their pixels around would be hundreds of megabytes. */
  function Encoder(w, h, delayCs) {
    this.w = w; this.h = h;
    this.delay = Math.max(2, delayCs | 0);
    this._hist = newHist();
    this._out = new Buf();
    this._map = null;
    this._bits = 0;
    this._idx = new Uint8Array(w * h);
  }

  Encoder.prototype.sample = function (imageData) {
    accumulate(this._hist, imageData.data, 3);
  };

  Encoder.prototype.begin = function () {
    const pal = quantize(this._hist, 256);
    const bits = Math.max(1, Math.ceil(Math.log2(Math.max(2, pal.length))));
    const size = 1 << bits;
    this._bits = bits;
    this._map = mapper(pal);
    const out = this._out;

    out.s('GIF89a');
    out.u16(this.w); out.u16(this.h);
    out.b(0x80 | ((bits - 1) << 4) | (bits - 1));   // global table, its size
    out.b(0); out.b(0);
    for (let i = 0; i < size; i++) {
      const c = pal[i] || [0, 0, 0];
      out.b(c[0]); out.b(c[1]); out.b(c[2]);
    }

    // loop forever
    out.b(0x21); out.b(0xFF); out.b(11);
    out.s('NETSCAPE2.0');
    out.b(3); out.b(1); out.u16(0); out.b(0);
  };

  Encoder.prototype.addFrame = function (imageData) {
    const out = this._out, d = imageData.data, idx = this._idx;
    const n = this.w * this.h;
    for (let i = 0, p = 0; i < n; i++, p += 4) idx[i] = this._map(d[p], d[p + 1], d[p + 2]);

    out.b(0x21); out.b(0xF9); out.b(4);
    out.b(0);                       // no transparency, disposal "unspecified"
    out.u16(this.delay);
    out.b(0); out.b(0);

    out.b(0x2C);
    out.u16(0); out.u16(0);
    out.u16(this.w); out.u16(this.h);
    out.b(0);                       // no local table, not interlaced

    lzw(idx, Math.max(2, this._bits), out);
  };

  Encoder.prototype.finish = function () {
    this._out.b(0x3B);
    return new Blob([this._out.out()], { type: 'image/gif' });
  };

  g.GIF = { Encoder: Encoder };
})(window);

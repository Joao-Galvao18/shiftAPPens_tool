/* util.js — tiny helpers */
(function (g) {
  'use strict';
  const U = {};

  U.el = function (tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  U.hex2rgb = function (h) {
    h = String(h || '#000').replace('#', '').trim();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  U.rgb2hex = (a) => '#' + a.map(v => U.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');

  U.createCanvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  };

  U.download = function (blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  };

  U.nice = function (n, d) {
    d = d == null ? 1 : d;
    if (!isFinite(n)) return '–';
    const s = Number(n).toFixed(d);
    return s.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  };

  /* rotate a colour's hue, keeping its saturation and lightness */
  U.rotateHue = function (hex, deg) {
    const c = U.hex2rgb(hex).map(v => v / 255);
    const max = Math.max(c[0], c[1], c[2]), min = Math.min(c[0], c[1], c[2]);
    const l = (max + min) / 2;
    let h = 0, sat = 0;
    if (max !== min) {
      const d = max - min;
      sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === c[0]) h = (c[1] - c[2]) / d + (c[1] < c[2] ? 6 : 0);
      else if (max === c[1]) h = (c[2] - c[0]) / d + 2;
      else h = (c[0] - c[1]) / d + 4;
      h /= 6;
    }
    h = (h + deg / 360) % 1;
    if (h < 0) h += 1;
    if (!sat) return U.rgb2hex([l * 255, l * 255, l * 255]);
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
    const pp = 2 * l - q;
    const hue = (t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return pp + (q - pp) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return pp + (q - pp) * (2 / 3 - t) * 6;
      return pp;
    };
    return U.rgb2hex([hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255]);
  };

  /* deterministic hash-noise, used for grain so results are reproducible */
  U.hash = function (x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  g.U = U;
})(window);

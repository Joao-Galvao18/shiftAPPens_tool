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

  /* deterministic hash-noise, used for grain so results are reproducible */
  U.hash = function (x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  g.U = U;
})(window);

/* contour.js — marching squares over the distance field -> closed loops -> SVG paths.
   This is what makes the strokes true vectors, so a banner stays razor sharp. */
(function (g) {
  'use strict';

  /* Pads the field with "far outside" so shapes touching the edge still close. */
  function pad(field, w, h, p, far) {
    const W = w + p * 2, H = h + p * 2;
    const out = new Float32Array(W * H).fill(far);
    for (let y = 0; y < h; y++) out.set(field.subarray(y * w, y * w + w), (y + p) * W + p);
    return { field: out, w: W, h: H, p };
  }

  function marchingSquares(field, w, h, level) {
    const seg = new Map();      // startEdgeKey -> {to, a:[x,y], b:[x,y]}
    const pt = new Map();       // edgeKey -> [x,y]

    const ix = (x, y) => field[y * w + x];

    function cross(v1, v2) {
      const d = v2 - v1;
      return d === 0 ? 0.5 : (level - v1) / d;
    }

    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w - 1; x++) {
        const v0 = ix(x, y), v1 = ix(x + 1, y), v2 = ix(x + 1, y + 1), v3 = ix(x, y + 1);
        const s0 = v0 < level, s1 = v1 < level, s2 = v2 < level, s3 = v3 < level;
        if (s0 === s1 && s1 === s2 && s2 === s3) continue;

        const cr = [];
        // walk cell border clockwise: T(0->1) R(1->2) B(2->3) L(3->0)
        if (s0 !== s1) { const t = cross(v0, v1); cr.push({ k: 'h' + x + ',' + y, x: x + t, y: y, io: s0 }); }
        if (s1 !== s2) { const t = cross(v1, v2); cr.push({ k: 'v' + (x + 1) + ',' + y, x: x + 1, y: y + t, io: s1 }); }
        if (s2 !== s3) { const t = cross(v2, v3); cr.push({ k: 'h' + x + ',' + (y + 1), x: x + 1 - t, y: y + 1, io: s2 }); }
        if (s3 !== s0) { const t = cross(v3, v0); cr.push({ k: 'v' + x + ',' + y, x: x, y: y + 1 - t, io: s3 }); }

        for (const c of cr) if (!pt.has(c.k)) pt.set(c.k, [c.x, c.y]);

        const link = (a, b) => { if (!seg.has(a.k)) seg.set(a.k, b.k); };

        if (cr.length === 2) {
          if (cr[0].io) link(cr[0], cr[1]); else link(cr[1], cr[0]);
        } else if (cr.length === 4) {
          let c = cr;
          if (!c[0].io) c = [cr[1], cr[2], cr[3], cr[0]];
          const centre = (v0 + v1 + v2 + v3) / 4;
          if (centre < level) { link(c[0], c[1]); link(c[2], c[3]); }
          else { link(c[0], c[3]); link(c[2], c[1]); }
        }
      }
    }

    // stitch segments into closed loops
    const loops = [];
    const used = new Set();
    for (const start of seg.keys()) {
      if (used.has(start)) continue;
      const loop = [];
      let k = start, guard = 0;
      while (k != null && !used.has(k) && guard++ < 4000000) {
        used.add(k);
        const p = pt.get(k);
        if (p) loop.push(p);
        k = seg.get(k);
      }
      if (loop.length > 2) loops.push(loop);
    }
    return loops;
  }

  /* Ramer–Douglas–Peucker on a closed loop */
  function simplify(points, eps) {
    if (points.length < 4 || eps <= 0) return points;
    const keep = new Uint8Array(points.length);
    keep[0] = 1; keep[points.length - 1] = 1;
    const stack = [[0, points.length - 1]];
    const e2 = eps * eps;
    while (stack.length) {
      const [i, j] = stack.pop();
      if (j - i < 2) continue;
      const [ax, ay] = points[i], [bx, by] = points[j];
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      let best = -1, bestD = 0;
      for (let k = i + 1; k < j; k++) {
        const [px, py] = points[k];
        let d;
        if (len2 === 0) { const ex = px - ax, ey = py - ay; d = ex * ex + ey * ey; }
        else {
          let t = ((px - ax) * dx + (py - ay) * dy) / len2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const ex = px - (ax + t * dx), ey = py - (ay + t * dy);
          d = ex * ex + ey * ey;
        }
        if (d > bestD) { bestD = d; best = k; }
      }
      if (bestD > e2 && best > 0) { keep[best] = 1; stack.push([i, best], [best, j]); }
    }
    const out = [];
    for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
    return out;
  }

  /* loops -> SVG path data, mapped from grid space to canvas space */
  function toPath(loops, sx, sy, ox, oy, eps, prec) {
    const d = [];
    const P = prec == null ? 2 : prec;
    for (let loop of loops) {
      loop = simplify(loop, eps);
      if (loop.length < 3) continue;
      let s = 'M';
      for (let i = 0; i < loop.length; i++) {
        const x = (loop[i][0] - ox) * sx, y = (loop[i][1] - oy) * sy;
        s += (i ? 'L' : '') + x.toFixed(P) + ' ' + y.toFixed(P);
      }
      d.push(s + 'Z');
    }
    return d.join('');
  }

  g.Contour = { marchingSquares, simplify, toPath, pad };
})(window);

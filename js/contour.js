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

  /* loops -> SVG path data, mapped from grid space to canvas space.

     Marching squares gives a polygon, and a polygon drawn at poster size shows
     every one of its corners. The points are kept — the curve passes exactly
     through them — but the joins between them are turned into cubic segments
     with Catmull-Rom tangents, so a traced outline reads as a drawn one.

     A real corner has to survive, or a logo's square edges would melt. Where the
     direction changes by more than `corner`, the tangents are dropped on that
     side and the join stays sharp. */
  const CORNER = Math.cos(60 * Math.PI / 180);

  function toPath(loops, sx, sy, ox, oy, eps, prec, smoothCurves) {
    const d = [];
    const P = prec == null ? 2 : prec;
    const smooth = smoothCurves !== false;

    for (let loop of loops) {
      loop = simplify(loop, eps);
      const n = loop.length;
      if (n < 3) continue;

      const X = new Float64Array(n), Y = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        X[i] = (loop[i][0] - ox) * sx;
        Y[i] = (loop[i][1] - oy) * sy;
      }

      if (!smooth) {
        let s = 'M' + X[0].toFixed(P) + ' ' + Y[0].toFixed(P);
        for (let i = 1; i < n; i++) s += 'L' + X[i].toFixed(P) + ' ' + Y[i].toFixed(P);
        d.push(s + 'Z');
        continue;
      }

      // is the turn at vertex i gentle enough to carry a tangent through it?
      const soft = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const a = (i - 1 + n) % n, b = (i + 1) % n;
        const ux = X[i] - X[a], uy = Y[i] - Y[a];
        const vx = X[b] - X[i], vy = Y[b] - Y[i];
        const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
        soft[i] = (lu > 1e-9 && lv > 1e-9 && (ux * vx + uy * vy) / (lu * lv) > CORNER) ? 1 : 0;
      }

      const seg = (a, b) => Math.hypot(X[b] - X[a], Y[b] - Y[a]);

      /* A tangent is built from the chord between a point's NEIGHBOURS, which
         after simplification can be a long way off. Left unchecked, a gentle
         turn at the end of a long straight run gets a tangent as long as that
         run and the curve bows far outside the outline it is meant to trace —
         a traced square came out 36px oversize on every side. Each tangent is
         held to a third of the shorter segment it joins, which is the usual
         guard against that overshoot and leaves genuine curves untouched. */
      const hold = (tx, ty, la, lb) => {
        const m = Math.min(la, lb) / 3;
        const l = Math.hypot(tx, ty);
        return (l > m && l > 1e-9) ? [tx * m / l, ty * m / l] : [tx, ty];
      };

      let s = 'M' + X[0].toFixed(P) + ' ' + Y[0].toFixed(P);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const h = (i - 1 + n) % n, k = (j + 1) % n;
        // tangents, dropped at whichever end is a corner
        let t1x = soft[i] ? (X[j] - X[h]) / 6 : 0;
        let t1y = soft[i] ? (Y[j] - Y[h]) / 6 : 0;
        let t2x = soft[j] ? (X[k] - X[i]) / 6 : 0;
        let t2y = soft[j] ? (Y[k] - Y[i]) / 6 : 0;
        if (t1x || t1y) { const r = hold(t1x, t1y, seg(h, i), seg(i, j)); t1x = r[0]; t1y = r[1]; }
        if (t2x || t2y) { const r = hold(t2x, t2y, seg(i, j), seg(j, k)); t2x = r[0]; t2y = r[1]; }
        if (!t1x && !t1y && !t2x && !t2y) {
          s += 'L' + X[j].toFixed(P) + ' ' + Y[j].toFixed(P);
        } else {
          s += 'C' + (X[i] + t1x).toFixed(P) + ' ' + (Y[i] + t1y).toFixed(P) + ' ' +
                     (X[j] - t2x).toFixed(P) + ' ' + (Y[j] - t2y).toFixed(P) + ' ' +
                     X[j].toFixed(P) + ' ' + Y[j].toFixed(P);
        }
      }
      d.push(s + 'Z');
    }
    return d.join('');
  }

  g.Contour = { marchingSquares, simplify, toPath, pad };
})(window);

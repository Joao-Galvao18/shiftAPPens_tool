/* paint.js — the drawing layer.

   Strokes are stored in NORMALISED canvas coordinates (x and y in [0..1]) and the
   nib width as a percentage of the basis dimension, exactly like every other
   spatial parameter. A scribble drawn on the 1200px preview therefore comes out
   at the same proportion on an 8000px banner.
*/
(function (g) {
  'use strict';

  function smoothPath(ctx, pts, W, H) {
    ctx.beginPath();
    if (pts.length === 1) return;
    ctx.moveTo(pts[0][0] * W, pts[0][1] * H);
    if (pts.length === 2) {
      ctx.lineTo(pts[1][0] * W, pts[1][1] * H);
      return;
    }
    for (let i = 1; i < pts.length - 1; i++) {
      const x0 = pts[i][0] * W, y0 = pts[i][1] * H;
      const x1 = pts[i + 1][0] * W, y1 = pts[i + 1][1] * H;
      ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
    }
    ctx.lineTo(pts[pts.length - 1][0] * W, pts[pts.length - 1][1] * H);
  }

  /* walk the path at roughly one step per `spacing` px, for the stamped nibs */
  function walk(pts, W, H, spacing, fn) {
    let carry = 0;
    for (let i = 1; i < pts.length; i++) {
      const x0 = pts[i - 1][0] * W, y0 = pts[i - 1][1] * H;
      const x1 = pts[i][0] * W, y1 = pts[i][1] * H;
      const len = Math.hypot(x1 - x0, y1 - y0);
      if (!len) continue;
      for (let d = carry; d < len; d += spacing) {
        const t = d / len;
        fn(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, i);
      }
      carry = Math.max(0, spacing - ((len - carry) % spacing));
    }
  }

  function drawOne(ctx, st, W, H, unit, index) {
    const pts = st.points;
    if (!pts || !pts.length) return;
    const w = Math.max(0.5, st.width / 100 * unit);
    const type = st.type;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = st.color;
    ctx.fillStyle = st.color;
    ctx.lineWidth = w;

    if (type === 'highlighter') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.45;
    }

    const dot = (x, y, r) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    const single = () => dot(pts[0][0] * W, pts[0][1] * H, w / 2);

    /* --- stamped nibs --- */
    if (type === 'chalk' || type === 'spray') {
      const dense = type === 'spray' ? 26 : 9;
      const spread = type === 'spray' ? w * 0.95 : w * 0.42;
      const grit = type === 'spray' ? w * 0.09 : w * 0.16;
      let k = 0;
      const stamp = (x, y) => {
        for (let j = 0; j < dense; j++) {
          k++;
          const a = U.hash(index + 1, k, 11) * Math.PI * 2;
          const rr = Math.sqrt(U.hash(index + 3, k, 17)) * spread;
          ctx.globalAlpha = (type === 'spray' ? 0.5 : 0.75) * (0.45 + U.hash(index + 5, k, 23) * 0.55);
          dot(x + Math.cos(a) * rr, y + Math.sin(a) * rr, grit * (0.6 + U.hash(index + 7, k, 29) * 0.8));
        }
      };
      if (pts.length === 1) stamp(pts[0][0] * W, pts[0][1] * H);
      else walk(pts, W, H, Math.max(1, w * 0.22), stamp);
      ctx.restore();
      return;
    }

    /* --- calligraphic nib: width follows the direction of travel --- */
    if (type === 'calligraphy') {
      if (pts.length === 1) { single(); ctx.restore(); return; }
      const nib = Math.PI / 4;
      for (let i = 1; i < pts.length; i++) {
        const x0 = pts[i - 1][0] * W, y0 = pts[i - 1][1] * H;
        const x1 = pts[i][0] * W, y1 = pts[i][1] * H;
        const a = Math.atan2(y1 - y0, x1 - x0);
        ctx.lineWidth = Math.max(0.5, w * (0.16 + 0.84 * Math.abs(Math.sin(a - nib))));
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    /* --- three offset passes give the hand-drawn marker edge; deterministic,
           so the preview and the export are identical --- */
    if (type === 'scribble') {
      const j = w * 0.22;
      for (let k = 0; k < 3; k++) {
        const ox = (U.hash(index + 1, k + 1, 3) - 0.5) * 2 * j;
        const oy = (U.hash(index + 1, k + 7, 5) - 0.5) * 2 * j;
        ctx.save();
        ctx.translate(ox, oy);
        ctx.lineWidth = w * (0.72 + 0.2 * k);
        ctx.globalAlpha = k === 0 ? 1 : 0.65;
        if (pts.length === 1) single(); else { smoothPath(ctx, pts, W, H); ctx.stroke(); }
        ctx.restore();
      }
      ctx.restore();
      return;
    }

    /* --- plain strokes --- */
    if (type === 'dashed') ctx.setLineDash([w * 1.7, w * 1.4]);
    if (type === 'pen') {
      // crisp: mitred joins and straight segments, no curve smoothing
      ctx.lineJoin = 'miter';
      ctx.lineCap = 'butt';
      if (pts.length === 1) { single(); ctx.restore(); return; }
      ctx.beginPath();
      ctx.moveTo(pts[0][0] * W, pts[0][1] * H);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * W, pts[i][1] * H);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (pts.length === 1) single();
    else { smoothPath(ctx, pts, W, H); ctx.stroke(); }
    ctx.restore();
  }

  function render(ctx, strokes, W, H, unit) {
    if (!strokes || !strokes.length) return;
    for (let i = 0; i < strokes.length; i++) drawOne(ctx, strokes[i], W, H, unit, i);
  }

  g.Paint = { render: render };
})(window);

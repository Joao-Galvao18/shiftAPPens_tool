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

  function drawOne(ctx, st, W, H, unit, index) {
    const pts = st.points;
    if (!pts || !pts.length) return;
    const w = Math.max(0.5, st.width / 100 * unit);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = st.color;
    ctx.fillStyle = st.color;

    if (st.type === 'highlighter') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.45;
    }

    const dot = () => {
      ctx.beginPath();
      ctx.arc(pts[0][0] * W, pts[0][1] * H, w / 2, 0, Math.PI * 2);
      ctx.fill();
    };

    if (st.type === 'scribble') {
      // three offset passes give the hand-drawn marker edge; deterministic so the
      // preview and the export are identical
      const j = w * 0.22;
      for (let k = 0; k < 3; k++) {
        const ox = (U.hash(index + 1, k + 1, 3) - 0.5) * 2 * j;
        const oy = (U.hash(index + 1, k + 7, 5) - 0.5) * 2 * j;
        ctx.save();
        ctx.translate(ox, oy);
        ctx.lineWidth = w * (0.72 + 0.2 * k);
        ctx.globalAlpha = (st.type === 'highlighter' ? 0.45 : 1) * (k === 0 ? 1 : 0.65);
        if (pts.length === 1) dot(); else { smoothPath(ctx, pts, W, H); ctx.stroke(); }
        ctx.restore();
      }
      ctx.restore();
      return;
    }

    ctx.lineWidth = w;
    if (pts.length === 1) dot();
    else { smoothPath(ctx, pts, W, H); ctx.stroke(); }
    ctx.restore();
  }

  function render(ctx, strokes, W, H, unit) {
    if (!strokes || !strokes.length) return;
    for (let i = 0; i < strokes.length; i++) drawOne(ctx, strokes[i], W, H, unit, i);
  }

  g.Paint = { render: render };
})(window);

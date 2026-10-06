/* stage.js — the artboard: what the pointer does over the picture.

   Moving or scaling the picture moves the silhouette, so the distance transform
   has to run again and a real render costs about a second a frame. But the
   strokes and the artwork all translate WITH the picture and the background is a
   flat fill, so during a drag the last rendered frame is simply blitted at an
   offset — exact, and one drawImage. The true render happens once, on release.
   Scaling previews the same way; that one is approximate (stroke weights scale
   with it) and snaps true when you let go.
*/
(function (g) {
  'use strict';

  let ctx = null;
  const t = (...a) => I18N.t.apply(null, a);
  const $ = sel => document.querySelector(sel);

  let TOOL = 'pan';        // pan | paint
  let selected = false;    // the frame and handles only show once you pick the picture up
  let dragImage = null;
  let dragBase = null;
  let drawing = null;

  const S = () => ctx.S;
  const view = () => ctx.view;

  function init(c) { ctx = c; }

  /* Pointer -> canvas pixel space. clientWidth/Height round to whole pixels, so
     derive the content box from the fractional rect instead. */
  function pointerPos(e) {
    const v = view();
    const r = v.getBoundingClientRect();
    const bx = v.clientLeft, by = v.clientTop;
    const cw = r.width - bx * 2 || 1;
    const ch = r.height - by * 2 || 1;
    return {
      x: (e.clientX - r.left - bx) / cw * v.width,
      y: (e.clientY - r.top - by) / ch * v.height
    };
  }

  function fitView() {
    const v = view();
    const vp = $('#viewport');
    const pad = 72;
    const aw = vp.clientWidth - pad, ah = vp.clientHeight - pad;
    const s = Math.min(aw / v.width, ah / v.height, 4);
    const w = Math.round(v.width * s), h = Math.round(v.height * s);
    v.style.width = w + 'px';
    v.style.height = h + 'px';
    const board = $('#board'), cur = $('#cursor');
    if (board) { board.style.width = w + 'px'; board.style.height = h + 'px'; }
    if (cur) {
      cur.style.width = w + 'px';
      cur.style.height = h + 'px';
      if (cur.width !== v.width || cur.height !== v.height) {
        cur.width = v.width; cur.height = v.height;
      }
    }
  }

  function setTool(name) {
    TOOL = name;
    const board = $('#board');
    board.classList.toggle('tool', name === 'paint');
    board.classList.toggle('move', name !== 'paint');
    if (name !== 'paint') { clearCursor(); drawFrame(); }
    ctx.status(name === 'paint' ? t('ui.hintPaint') : '');
    ctx.refresh();
  }

  function clearCursor() {
    const c = $('#cursor');
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
  }

  /* the picture's frame and its four grab handles */
  function drawFrame() {
    const v = view();
    const c = $('#cursor');
    if (c.width !== v.width || c.height !== v.height) {
      c.width = v.width; c.height = v.height;
    }
    const x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    if (TOOL === 'paint' || dragImage || !selected) return;
    const cs = frameCorners();
    if (!cs) return;
    const k = Math.max(1, v.width / 900);
    x.strokeStyle = 'rgba(50,196,186,.9)';
    x.lineWidth = k;
    x.setLineDash([6 * k, 4 * k]);
    x.beginPath();
    x.moveTo(cs[0].x, cs[0].y);
    for (let i = 1; i < 4; i++) x.lineTo(cs[i].x, cs[i].y);
    x.closePath();
    x.stroke();
    x.setLineDash([]);
    const h = 5 * k;
    for (const p of cs) {
      x.fillStyle = '#FFFBF8';
      x.fillRect(p.x - h, p.y - h, h * 2, h * 2);
      x.strokeStyle = '#32C4BA';
      x.lineWidth = 1.5 * k;
      x.strokeRect(p.x - h, p.y - h, h * 2, h * 2);
    }
  }

  function drawCursor(e) {
    const v = view();
    const c = $('#cursor');
    if (TOOL !== 'paint') {
      if (!dragImage) {
        const q = pointerPos(e);
        const board = $('#board');
        board.classList.toggle('resizing', handleAt(q) >= 0);
        board.classList.toggle('over-image', overImage(q));
      }
      return;
    }
    if (c.width !== v.width || c.height !== v.height) {
      c.width = v.width; c.height = v.height;
    }
    const x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    const q = pointerPos(e);
    const d = Math.max(4, S().brushWidth / 100 * Engine.computeUnit(S().basis, v.width, v.height));
    x.lineWidth = Math.max(1, v.width / 600);
    x.strokeStyle = '#1A2321';
    x.beginPath();
    x.arc(q.x, q.y, d / 2, 0, Math.PI * 2);
    x.stroke();
    x.strokeStyle = 'rgba(255,251,248,.85)';
    x.beginPath();
    x.arc(q.x, q.y, d / 2 + x.lineWidth, 0, Math.PI * 2);
    x.stroke();
  }

  function snapshot() {
    const v = view();
    const c = U.createCanvas(v.width, v.height);
    c.getContext('2d').drawImage(v, 0, 0);
    return c;
  }

  function blit(dx, dy, scale, ax, ay) {
    const v = view(), vctx = ctx.vctx;
    vctx.setTransform(1, 0, 0, 1, 0, 0);
    vctx.fillStyle = S().bg;
    vctx.fillRect(0, 0, v.width, v.height);
    vctx.save();
    if (scale !== 1) {
      vctx.translate(ax, ay);
      vctx.scale(scale, scale);
      vctx.translate(-ax, -ay);
    }
    vctx.drawImage(dragBase, dx, dy);
    vctx.restore();
  }

  /* corners of the picture on the artboard, in canvas pixels */
  function frameCorners() {
    const v = view();
    if (!ctx.IMG) return null;
    const r = Engine.subjectRect(ctx.IMG, S(), v.width, v.height, ctx.TOKEN);
    if (!r) return null;
    return [
      { x: r.x, y: r.y }, { x: r.x + r.w, y: r.y },
      { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }
    ];
  }

  function handleAt(q) {
    if (!selected) return -1;
    const cs = frameCorners();
    if (!cs) return -1;
    const reach = Math.max(10, view().width * 0.022);
    for (let i = 0; i < 4; i++) {
      if (Math.hypot(q.x - cs[i].x, q.y - cs[i].y) <= reach) return i;
    }
    return -1;
  }

  function overImage(q) {
    const cs = frameCorners();
    if (!cs) return false;
    const xs = cs.map(c => c.x), ys = cs.map(c => c.y);
    const pad = Math.max(2, view().width * 0.004);
    return q.x >= Math.min.apply(null, xs) - pad && q.x <= Math.max.apply(null, xs) + pad &&
           q.y >= Math.min.apply(null, ys) - pad && q.y <= Math.max.apply(null, ys) + pad;
  }

  function setSelected(on) {
    if (selected === on) return;
    selected = on;
    $('#board').classList.toggle('picked', on);
    drawFrame();
  }

  /* canvas pixels per CSS pixel, so a drag tracks the pointer exactly */
  function viewScale() {
    const v = view();
    const r = v.getBoundingClientRect();
    return v.width / (r.width || 1);
  }

  function beginDrag(e) {
    const v = view();
    if (!ctx.IMG) return;
    const q = pointerPos(e);
    const h = handleAt(q);
    if (h < 0 && !overImage(q)) { setSelected(false); return; }   // clicking off puts it down
    setSelected(true);
    dragBase = snapshot();
    const common = {
      id: e.pointerId, x: e.clientX, y: e.clientY,
      imgX: S().imgX, imgY: S().imgY, scale: S().imgScale, css: viewScale()
    };
    if (h >= 0) {
      const cs = frameCorners();
      const anchor = cs[(h + 2) % 4];          // the corner you are pulling against
      const src = Engine.canvasToSource(ctx.IMG, S(), v.width, v.height, anchor.x, anchor.y);
      const d0 = Math.hypot(q.x - anchor.x, q.y - anchor.y);
      dragImage = Object.assign({ mode: 'scale', anchor: anchor, src: src, d0: Math.max(1, d0) }, common);
    } else {
      dragImage = Object.assign({ mode: 'move' }, common);
    }
    try { v.setPointerCapture(e.pointerId); } catch (err) { /* works without it */ }
    $('#board').classList.add('grabbing');
    clearCursor();
  }

  function moveDrag(e) {
    if (!dragImage) return;
    const v = view();
    const unit = Engine.computeUnit(S().basis, v.width, v.height);

    if (dragImage.mode === 'move') {
      const dx = (e.clientX - dragImage.x) * dragImage.css;
      const dy = (e.clientY - dragImage.y) * dragImage.css;
      S().imgX = U.clamp(dragImage.imgX + dx / unit * 100, -150, 150);
      S().imgY = U.clamp(dragImage.imgY + dy / unit * 100, -150, 150);
      blit(dx, dy, 1, 0, 0);
      return;
    }

    const q = pointerPos(e);
    const a = dragImage.anchor;
    const f = Math.hypot(q.x - a.x, q.y - a.y) / dragImage.d0;
    const next = U.clamp(dragImage.scale * f, 5, 300);
    S().imgScale = next;
    // hold the opposite corner still
    S().imgX = dragImage.imgX; S().imgY = dragImage.imgY;
    const now = Engine.sourceToCanvas(ctx.IMG, S(), v.width, v.height, dragImage.src.x, dragImage.src.y);
    S().imgX = U.clamp(dragImage.imgX + (a.x - now.x) / unit * 100, -150, 150);
    S().imgY = U.clamp(dragImage.imgY + (a.y - now.y) / unit * 100, -150, 150);
    blit(0, 0, next / dragImage.scale, a.x, a.y);
  }

  function endDrag(e) {
    if (!dragImage) return;
    dragImage = null;
    dragBase = null;
    try { view().releasePointerCapture(e.pointerId); } catch (err) { /* gone */ }
    $('#board').classList.remove('grabbing');
    ctx.refresh(); ctx.save();
    ctx.render();
  }

  /* zoom about the pointer: the bit of picture under the cursor stays put */
  function wheelZoom(e) {
    const v = view();
    if (!ctx.IMG || TOOL === 'paint') return;
    e.preventDefault();
    const q = pointerPos(e);
    const before = Engine.canvasToSource(ctx.IMG, S(), v.width, v.height, q.x, q.y);
    if (!before) return;
    const factor = Math.exp(-e.deltaY * 0.0015);
    S().imgScale = U.clamp(S().imgScale * factor, 5, 300);
    const after = Engine.sourceToCanvas(ctx.IMG, S(), v.width, v.height, before.x, before.y);
    const unit = Engine.computeUnit(S().basis, v.width, v.height);
    S().imgX = U.clamp(S().imgX + (q.x - after.x) / unit * 100, -150, 150);
    S().imgY = U.clamp(S().imgY + (q.y - after.y) / unit * 100, -150, 150);
    ctx.render();
    clearTimeout(wheelZoom._t);
    wheelZoom._t = setTimeout(() => { ctx.refresh(); ctx.save(); }, 200);
  }

  function beginStroke(e) {
    const v = view();
    if (TOOL !== 'paint') { beginDrag(e); return; }
    const q = pointerPos(e);
    try { v.setPointerCapture(e.pointerId); } catch (err) { /* works without it */ }
    drawing = {
      color: S().brushColor, width: S().brushWidth, type: S().brushType,
      points: [[q.x / v.width, q.y / v.height]]
    };
    S().paint.push(drawing);
    ctx.render();
  }

  function extendStroke(e) {
    const v = view();
    drawCursor(e);
    if (dragImage) { moveDrag(e); return; }
    if (!drawing) return;
    const q = pointerPos(e);
    const nx = q.x / v.width, ny = q.y / v.height;
    const last = drawing.points[drawing.points.length - 1];
    if (Math.hypot(nx - last[0], ny - last[1]) < 0.002) return;
    drawing.points.push([nx, ny]);
    ctx.render();          // cheap: the base layer is cached
  }

  function endStroke(e) {
    if (dragImage) { endDrag(e); return; }
    if (!drawing) return;
    drawing = null;
    try { view().releasePointerCapture(e.pointerId); } catch (err) { /* already gone */ }
    ctx.save();
  }

  function bind() {
    const v = view();
    v.addEventListener('pointerdown', beginStroke);
    v.addEventListener('pointermove', extendStroke);
    v.addEventListener('pointerup', endStroke);
    v.addEventListener('pointercancel', endStroke);
    v.addEventListener('wheel', wheelZoom, { passive: false });
    v.addEventListener('pointerleave', () => {
      if (drawing || dragImage) return;
      clearCursor();
      drawFrame();
      $('#board').classList.remove('resizing', 'over-image');
    });

    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && S().paint.length) {
        e.preventDefault();
        S().paint.pop();
        ctx.render(); ctx.save();
        return;
      }
      if (e.key === 'Escape') { setSelected(false); return; }
      if (e.key === 'b') setTool(TOOL === 'paint' ? 'pan' : 'paint');
    });

    $('#board').classList.add('move');
  }

  g.Stage = {
    init: init,
    bind: bind,
    fitView: fitView,
    drawFrame: drawFrame,
    clearCursor: clearCursor,
    setTool: setTool,
    setSelected: setSelected,
    get tool() { return TOOL; }
  };
})(window);

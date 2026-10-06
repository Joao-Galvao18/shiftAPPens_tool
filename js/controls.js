/* controls.js — turning a schema item into a row you can operate.

   Every control is built the same shape: a label on its own line, then the thing
   you touch underneath it, full width. That is what lets a slider and its number
   box sit side by side without either being squeezed, and it is why a long label
   never pushes a control off the edge.

   This module owns the colour chips and the preset list too, since both are
   control kinds. It knows nothing about rendering or exporting — it reports a
   new value through ctx.commit and lets app.js decide what that means.
*/
(function (g) {
  'use strict';

  let ctx = null;
  const t = (...a) => I18N.t.apply(null, a);
  const S = () => ctx.S;

  function init(c) { ctx = c; }

  /* ---------------- one control ---------------- */

  function build(it) {
    const row = U.el('div', 'row');
    const head = U.el('div', 'rowHead');
    const lab = U.el('label', 'lab', t('l.' + it.k));
    const val = U.el('span', 'val');
    let input;

    const commit = (v) => ctx.commit(it, v);

    if (it.t === 'button') {
      input = U.el('button', 'btn' + (it.danger ? ' danger' : '') + (it.primary ? ' primary' : ''), t('l.' + it.k));
      input.type = 'button';
      input.onclick = () => ctx.act(it.act, it);
      row.appendChild(input);
      if (it.hint) row.appendChild(U.el('div', 'hint2', t('h.' + it.k)));
      return finish(it, row, input, val);
    }

    head.appendChild(lab);
    head.appendChild(val);

    if (it.t === 'check') {
      // a switch reads better beside its label than under it
      row.classList.add('switchRow');
      input = U.el('input');
      input.type = 'checkbox';
      input.id = 'c-' + it.k;
      input.setAttribute('role', 'switch');
      input.onchange = () => commit(input.checked);
      lab.htmlFor = input.id;
      row.appendChild(lab);
      row.appendChild(input);
      if (it.hint) row.appendChild(U.el('div', 'hint2', t('h.' + it.k)));
      return finish(it, row, input, val);
    }

    row.appendChild(head);

    if (it.t === 'range') {
      const line = U.el('div', 'slide');
      input = U.el('input');
      input.type = 'range';
      input.id = 'c-' + it.k;
      input.min = it.min; input.max = it.max; input.step = it.step;
      input.oninput = () => commit(parseFloat(input.value));
      const num = U.el('input', 'numbox');
      num.type = 'number';
      num.id = 'n-' + it.k;
      num.min = it.min; num.max = it.max; num.step = it.step;
      num.onchange = () => {
        const v = U.clamp(parseFloat(num.value) || 0, it.min, it.max);
        input.value = v;
        commit(v);
      };
      line.appendChild(input);
      line.appendChild(num);
      if (it.u) line.appendChild(U.el('span', 'unit', it.u));
      row.appendChild(line);
      it._num = num;

    } else if (it.t === 'num') {
      input = U.el('input', 'numbox wide');
      input.type = 'number';
      input.id = 'c-' + it.k;
      if (it.min != null) input.min = it.min;
      if (it.max != null) input.max = it.max;
      input.step = it.step || 1;
      input.onchange = () => commit(parseFloat(input.value) || 0);
      row.appendChild(input);

    } else if (it.t === 'select') {
      input = U.el('select');
      input.id = 'c-' + it.k;
      it.o.forEach(o => {
        const op = U.el('option', null, o[1] ? t('o.' + o[1]) : o[2]);
        op.value = o[0];
        input.appendChild(op);
      });
      input.onchange = () => {
        let v = input.value;
        if (typeof it.o[0][0] === 'number') v = parseFloat(v);
        commit(v);
      };
      row.appendChild(input);

    } else if (it.t === 'color') {
      input = U.el('input', 'swatch wide');
      input.type = 'color';
      input.id = 'c-' + it.k;
      input.oninput = () => commit(input.value);
      row.appendChild(input);
      it._show = (v) => { input.value = v; val.textContent = String(v).toUpperCase(); };

    } else if (it.t === 'palette') {
      input = U.el('div', 'pal');
      row.appendChild(input);
      it._render = () => renderPalette(input);

    } else if (it.t === 'presets') {
      input = U.el('div', 'presets');
      row.appendChild(input);
      it._render = () => renderPresets(input);

    } else if (it.t === 'align') {
      input = U.el('div', 'align');
      for (let vy = 0; vy < 3; vy++) {
        for (let hx = 0; hx < 3; hx++) {
          const b = U.el('button');
          b.type = 'button';
          b.dataset.h = hx;
          b.dataset.v = vy;
          b.title = ['left', 'centre', 'right'][hx] + ' / ' + ['top', 'middle', 'bottom'][vy];
          b.onclick = () => ctx.align(hx / 2, vy / 2);
          input.appendChild(b);
        }
      }
      row.appendChild(input);
    }

    if (it.hint) row.appendChild(U.el('div', 'hint2', t('h.' + it.k)));
    return finish(it, row, input, val);
  }

  function finish(it, row, input, val) {
    it._row = row;
    it._input = input;
    it._val = val;
    ctx.push(it);
    return row;
  }

  /* ---------------- colour chips ----------------

     The chips are a colour AND an order: stroke 1 takes the first chip, stroke 2
     the second, and the list cycles. Moving a chip along the row changes which
     band it paints, which is why they can be dragged.

     One chip serves both jobs. A press that stays put opens the system colour
     wheel — that is where a code gets typed or a colour picked by eye. A press
     that travels a real distance is a drag, and only then is the click that
     follows swallowed. */
  let chipDrag = null;

  function chipIndexAt(box, x, y) {
    const chips = [...box.querySelectorAll('.chip:not(.add)')];
    let best = -1, bd = Infinity;
    chips.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const dx = x - (r.left + r.width / 2);
      const dy = y - (r.top + r.height / 2);
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  function beginChipDrag(box, i, ev) {
    if (ev.button != null && ev.button !== 0) return;
    /* No pointer capture here. Capturing on every press is a good way to lose
       the click that opens the wheel; the capture is taken below, once the press
       has become a drag and that click is unwanted anyway. */
    chipDrag = { box: box, from: i, at: i, x: ev.clientX, y: ev.clientY, moved: false, id: ev.pointerId };
  }

  function moveChipDrag(ev) {
    const d = chipDrag;
    if (!d) return;
    if (!d.moved) {
      // real distance, not |dx|+|dy|: the sum trips at 3px across and 3px down,
      // which is ordinary hand tremor on a trackpad, not an attempt to drag
      const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
      if (dx * dx + dy * dy < 64) return;
      d.moved = true;
      d.box.classList.add('dragging');
      try { d.box.setPointerCapture(d.id); d.captured = true; } catch (e) { /* fine without */ }
    }
    ev.preventDefault();
    const to = chipIndexAt(d.box, ev.clientX, ev.clientY);
    if (to < 0 || to === d.at) return;
    S().ringColors.splice(to, 0, S().ringColors.splice(d.at, 1)[0]);
    d.at = to;
    renderPalette(d.box);
    ctx.render();
  }

  function endChipDrag() {
    const d = chipDrag;
    if (!d) return;
    chipDrag = null;
    if (d.captured) { try { d.box.releasePointerCapture(d.id); } catch (e) { /* gone */ } }
    d.box.classList.remove('dragging');
    if (!d.moved) return;                 // never moved: the click opens the wheel

    /* A press that wandered but put the chip back where it started is a click as
       far as anyone is concerned, so it must still open the wheel: swallow
       nothing, and do not re-render either, since rebuilding the row would
       destroy the very input the click is on its way to. */
    if (d.from === d.at) {
      const held = d.box.querySelector('.chip.held');
      if (held) held.classList.remove('held');
      return;
    }

    const swallow = (e) => { e.stopPropagation(); e.preventDefault(); };
    d.box.addEventListener('click', swallow, true);
    setTimeout(() => d.box.removeEventListener('click', swallow, true), 0);
    ctx.save();
    renderPalette(d.box);
  }

  function renderPalette(box) {
    box.innerHTML = '';
    if (!box._wired) {
      box.addEventListener('pointermove', moveChipDrag);
      box.addEventListener('pointerup', endChipDrag);
      box.addEventListener('pointercancel', endChipDrag);
      box._wired = true;
    }

    const row = U.el('div', 'chiprow');
    S().ringColors.forEach((c, i) => {
      const w = U.el('div', 'chip' + (chipDrag && chipDrag.at === i ? ' held' : ''));
      const inp = U.el('input', 'sw');
      inp.type = 'color';
      inp.value = c;
      inp.title = String(c).toUpperCase();
      inp.oninput = () => {
        S().ringColors[i] = inp.value;
        inp.title = inp.value.toUpperCase();
        ctx.render(); ctx.save();
      };
      w.onpointerdown = (ev) => beginChipDrag(box, i, ev);

      const del = U.el('button', 'x', '×');
      del.type = 'button';
      del.onpointerdown = (ev) => ev.stopPropagation();     // the × is not a handle
      del.onclick = () => {
        if (S().ringColors.length <= 1) return;
        S().ringColors.splice(i, 1);
        renderPalette(box);
        ctx.render(); ctx.save();
      };
      w.appendChild(inp);
      w.appendChild(del);
      row.appendChild(w);
    });

    const add = U.el('button', 'chip add', '+');
    add.type = 'button';
    add.onclick = () => {
      S().ringColors.push(S().ringColors[S().ringColors.length - 1] || '#1A2321');
      renderPalette(box);
      ctx.render(); ctx.save();
    };
    row.appendChild(add);
    box.appendChild(row);

    const brand = U.el('div', 'brandrow');
    brand.appendChild(U.el('span', 'brandcap', t('ui.brandRow')));
    Schema.BRAND.forEach(c => {
      const b = U.el('button', 'brandchip');
      b.type = 'button';
      b.style.background = c;
      b.title = c;
      b.setAttribute('aria-label', c);
      b.onclick = () => { S().ringColors.push(c); renderPalette(box); ctx.render(); ctx.save(); };
      brand.appendChild(b);
    });
    box.appendChild(brand);
  }

  /* ---------------- saved looks ---------------- */

  function renderPresets(box) {
    box.innerHTML = '';

    const bar = U.el('div', 'preset-new');
    const name = U.el('input', 'numbox');
    name.type = 'text';
    name.id = 'presetName';
    name.placeholder = t('ui.presetName');
    name.maxLength = 60;
    const add = U.el('button', 'btn');
    add.type = 'button';
    add.textContent = t('ui.presetSave');
    const commit = async () => {
      const n = name.value.trim();
      if (!n) { name.focus(); return; }
      add.disabled = true;
      try {
        await Presets.save(n, ctx.strokeSettings());
        name.value = '';
        ctx.status(t('ui.presetSaved', n));
      } catch (e) {
        ctx.status(t('ui.presetFail'), true);
      }
      add.disabled = false;
    };
    add.onclick = commit;
    name.onkeydown = e => { if (e.key === 'Enter') commit(); };
    bar.appendChild(name);
    bar.appendChild(add);
    if (Presets.canWrite) box.appendChild(bar);

    const note = U.el('div', 'hint2');
    note.textContent = Presets.mode === 'shared' ? t('ui.presetShared')
      : Presets.mode === 'local' ? t('ui.presetLocal') : t('ui.presetLoading');
    box.appendChild(note);

    const list = U.el('div', 'preset-list');
    box.appendChild(list);

    const items = Presets.items;
    if (!items.length) {
      list.appendChild(U.el('div', 'hint2', t('ui.presetEmpty')));
      return;
    }

    const rows = [];
    items.forEach(pr => {
      const row = U.el('div', 'preset');

      const sw = U.el('div', 'preset-sw');
      const cols = [pr.settings && pr.settings.bg].concat((pr.settings && pr.settings.ringColors) || []);
      cols.filter(Boolean).slice(0, 5).forEach(c => {
        const d = U.el('i');
        d.style.background = c;
        sw.appendChild(d);
      });

      const meta = U.el('div', 'preset-meta');
      const nm = U.el('div', 'preset-name');
      nm.textContent = pr.name || 'Untitled';
      const by = U.el('div', 'preset-by');
      by.textContent = ' ';
      meta.appendChild(nm);
      meta.appendChild(by);

      const use = U.el('button', 'btn');
      use.type = 'button';
      use.textContent = t('ui.presetApply');
      use.onclick = () => {
        ctx.applyStrokeSettings(pr.settings || {});
        ctx.status(t('ui.presetApplied', pr.name || ''));
      };

      row.appendChild(sw);
      row.appendChild(meta);
      row.appendChild(use);

      const mine = !pr.builtin &&
        (Presets.mode === 'local' || (pr.by && pr.by === Presets.uid));
      if (mine) {
        const del = U.el('button', 'btn danger');
        del.type = 'button';
        del.textContent = '×';
        del.title = t('ui.presetDelete');
        del.onclick = async () => {
          if (!confirm(t('ui.presetConfirm', pr.name || ''))) return;
          try { await Presets.remove(pr.id); } catch (e) { ctx.status(t('ui.presetFail'), true); }
        };
        row.appendChild(del);
      }

      if (pr.builtin) by.textContent = t('ui.presetBuiltin');
      list.appendChild(row);
      if (!pr.builtin) rows.push({ by: pr.by, el: by });
    });

    // names resolve per viewer, so ask on every render rather than storing them
    const ids = [...new Set(rows.map(r => r.by).filter(Boolean))];
    if (ids.length) {
      Presets.names(ids).then(ps => {
        rows.forEach(r => {
          if (!r.by) return;
          const prof = ps[r.by];
          r.el.textContent = prof && prof.name ? prof.name : t('ui.someone');
        });
      });
    }
  }

  g.Controls = { init: init, build: build };
})(window);

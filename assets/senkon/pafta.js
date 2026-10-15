/* The sample sheet (ornek-pafta.svg) on /tasarim/: a pan and zoom viewer. The script fetches the SVG that
   img.pafta-static points to and puts it inline in the image's place, so the drawing's lines stay sharp at any
   zoom. On the page a trackpad pinch (ctrl + wheel) zooms about the pointer, and the plain wheel does too once
   the sheet is zoomed in; over the whole sheet the plain wheel scrolls the page untouched. In the full-screen
   dialog the plain wheel always zooms. Dragging pans, a double click or double tap jumps between the whole sheet
   and 4x (a drag or a pinch is not a tap), and the +/- buttons zoom 1.5x about the centre. At the whole-sheet
   scale a finger still scrolls the page (touch-action pan-y); once zoomed in it drags the sheet instead.
   "Tam ekran" moves the same inline SVG into dialog.pafta-dlg (moved, not cloned, so the hatch pattern id stays
   unique) and back on close, resetting the view each time; the dialog has its own +/- buttons. Without
   JavaScript, or if the fetch fails, the plain image stays as it is and nothing else changes.
   The maths is a state v = { s, x, y, w, h }: scale, offset in CSS px, viewport size in CSS px; a sheet point
   (u, v) in viewport px sits at (u*s + x, v*s + y) and the sheet always covers the viewport. view, zoomAt,
   pan, toggle, touchAction, wheelZooms, wheelPixels and tapped are pure and exported for tests. */
(function () {
  'use strict';

  const MAX = 8, TAP = 4, SLOP = 10, VBW = 420, VBH = 297;   // TAP: the double-tap scale; SLOP: px a tap may move

  function clampPan(v) {
    const lx = -v.w * (v.s - 1), ly = -v.h * (v.s - 1);
    return { s: v.s, x: Math.min(0, Math.max(lx, v.x)), y: Math.min(0, Math.max(ly, v.y)), w: v.w, h: v.h };
  }
  function view(w, h) { return { s: 1, x: 0, y: 0, w, h }; }
  function zoomAt(v, factor, px, py) {
    const s = Math.min(MAX, Math.max(1, v.s * factor)), k = s / v.s;
    return clampPan({ s, x: px - (px - v.x) * k, y: py - (py - v.y) * k, w: v.w, h: v.h });
  }
  function pan(v, dx, dy) { return clampPan({ s: v.s, x: v.x + dx, y: v.y + dy, w: v.w, h: v.h }); }
  function toggle(v, px, py) { return v.s === 1 ? zoomAt(v, TAP, px, py) : view(v.w, v.h); }
  function touchAction(s) { return s === 1 ? 'pan-y' : 'none'; }
  function echo(last, now) { return last != null && now - last < 500; }   // a dblclick right after a touch toggle is the browser's echo of it

  function wheelZooms(ctrl, s, inDialog) { return inDialog || ctrl || s > 1; }
  function wheelPixels(dy, mode, pageH) { return mode === 1 ? dy * 16 : mode === 2 ? dy * pageH : dy; }   // deltaMode line, page
  function tapped(down, up, pinched) { return !pinched && !!down && Math.hypot(up[0] - down[0], up[1] - down[1]) < SLOP; }

  if (typeof module !== 'undefined') module.exports = { view, zoomAt, pan, toggle, touchAction, echo, wheelZooms, wheelPixels, tapped };
  if (typeof document === 'undefined') return;

  const fig = document.querySelector('figure.pafta'), img = fig && fig.querySelector('img.pafta-static');
  if (!img || !window.fetch) return;
  const dlg = fig.querySelector('dialog.pafta-dlg') || document.querySelector('dialog.pafta-dlg');

  fetch(img.getAttribute('src')).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }).then(txt => {
    const doc = new DOMParser().parseFromString(txt, 'image/svg+xml'), root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) throw new Error('svg');
    const svg = document.importNode(root, true), sheet = svg.querySelector('.pafta-sheet');
    if (!sheet) throw new Error('sheet');
    svg.setAttribute('class', 'pafta-svg');
    svg.removeAttribute('width'); svg.removeAttribute('height');
    if (img.getAttribute('alt')) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', img.getAttribute('alt')); }
    img.replaceWith(svg);
    fig.classList.add('pafta-live');
    start(svg, sheet);
  }).catch(() => {});

  function start(svg, sheet) {
    let v = view(VBW, VBH), ox = 0, oy = 0, k = 1;      // k: CSS px per viewBox unit; ox, oy: letterbox offset
    const ptrs = new Map(), starts = new Map();          // pointer id -> current / pointerdown position
    let lastTap = null, pinch = 0, pinched = false, toggledAt = null;

    function measure() {                                 // the sheet is drawn "meet" inside the svg box
      const r = svg.getBoundingClientRect();
      k = Math.min(r.width / VBW, r.height / VBH) || 1;
      ox = (r.width - VBW * k) / 2; oy = (r.height - VBH * k) / 2;
      v = view(VBW * k, VBH * k);
    }
    function apply() {
      const u = 1 / k;
      sheet.setAttribute('transform', 'translate(' + v.x * u + ' ' + v.y * u + ') scale(' + v.s + ')');
      svg.style.touchAction = touchAction(v.s);
      svg.classList.toggle('pafta-zoomed', v.s > 1);
    }
    function reset() { measure(); apply(); }
    function local(e) { const r = svg.getBoundingClientRect(); return [e.clientX - r.left - ox, e.clientY - r.top - oy]; }

    svg.addEventListener('wheel', e => {
      if (!wheelZooms(e.ctrlKey, v.s, !!dlg && svg.parentNode === dlg)) return;   // the page scrolls untouched
      const dy = wheelPixels(e.deltaY, e.deltaMode, window.innerHeight);
      const [px, py] = local(e), nv = zoomAt(v, Math.exp(-dy * 0.002), px, py);
      if (nv.s === v.s && !e.ctrlKey) return;            // at the limit the wheel scrolls again (ctrl + wheel would zoom the browser)
      e.preventDefault(); v = nv; apply();
    }, { passive: false });

    svg.addEventListener('pointerdown', e => {
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      starts.set(e.pointerId, [e.clientX, e.clientY]);
      if (svg.setPointerCapture) { try { svg.setPointerCapture(e.pointerId); } catch (_) {} }
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); pinched = true; }
    });
    svg.addEventListener('pointermove', e => {
      const prev = ptrs.get(e.pointerId);
      if (!prev) return;
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), r = svg.getBoundingClientRect();
        if (pinch > 0 && d > 0) {
          v = zoomAt(v, d / pinch, (a[0] + b[0]) / 2 - r.left - ox, (a[1] + b[1]) / 2 - r.top - oy);
          apply();
        }
        pinch = d;
      } else if (ptrs.size === 1 && v.s > 1) {
        v = pan(v, e.clientX - prev[0], e.clientY - prev[1]); apply();
      }
    });
    function up(e) {
      const had = ptrs.delete(e.pointerId), down = starts.get(e.pointerId), wasPinch = pinched;
      starts.delete(e.pointerId);
      pinch = 0;
      if (!ptrs.size) pinched = false;                   // the pinch ends with its last finger
      if (!had || e.type !== 'pointerup' || e.pointerType === 'mouse') return;   // a mouse uses dblclick
      if (!tapped(down, [e.clientX, e.clientY], wasPinch)) { lastTap = null; return; }   // a drag or a pinch is not a tap
      const now = e.timeStamp;
      if (lastTap && now - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 10) {
        const [px, py] = local(e); v = toggle(v, px, py); apply(); lastTap = null; toggledAt = now;
      } else lastTap = { t: now, x: e.clientX, y: e.clientY };
    }
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('dblclick', e => { if (echo(toggledAt, e.timeStamp)) return; const [px, py] = local(e); v = toggle(v, px, py); apply(); });

    function step(f) { v = zoomAt(v, f, v.w / 2, v.h / 2); apply(); }
    const btn = (sel, fn) => {                           // the figure's buttons and the dialog's own +/-
      const all = Array.from(fig.querySelectorAll(sel));
      if (dlg && !fig.contains(dlg)) all.push(...dlg.querySelectorAll(sel));
      all.forEach(b => b.addEventListener('click', fn));
    };
    btn('.pafta-in', () => step(1.5));
    btn('.pafta-out', () => step(1 / 1.5));

    const home = svg.parentNode, mark = document.createComment('pafta');
    btn('.pafta-full', () => {
      if (!dlg || !dlg.showModal) return;
      home.insertBefore(mark, svg);
      dlg.appendChild(svg);
      dlg.showModal();
      reset();
    });
    if (dlg) {
      dlg.addEventListener('close', () => {
        if (mark.parentNode) { mark.parentNode.insertBefore(svg, mark); mark.remove(); }
        reset();
      });
      const close = dlg.querySelector('.pafta-close');
      if (close) close.addEventListener('click', () => dlg.close());
    }
    window.addEventListener('resize', reset);
    reset();
  }
})();

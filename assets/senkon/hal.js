/* Erection animation for the steel hall: every <figure data-hall="…json"> erects Fırat's lattice-column hall
   piece by piece on a canvas over the still picture, once per page load, then leaves the finished
   drawing. The JSON (written by tools/make-hall.js from the viewer's GLB) holds the members as projected
   members [x1, y1, z1, x2, y2, z2, width m] with the camera and its framing, the erection pieces (towers, posts, floor bays, whole roof
   truss lines, roof bays) with their member indices and the site order of the pieces. The picture is cut into LANES vertical zones that assemble at once, each zone's pieces one after
   another in site order, swinging down from above the zone like crane loads; the whole erection takes
   TOTAL seconds at speed 1 (data-speed runs it faster), a little more when the big roof pieces, which swing in longer, land last. The members come in metres (format 2) and are
   projected every frame, so once the last piece lands the hall turns slowly by itself and the visitor can
   drag it to turn and tilt it; a touch stops the turning, and IDLE seconds after the visitor lets go it turns again. Members are painted far to near, an ink stroke under a
   white one, so the front hides the back like a line drawing; farther members fade a little. Without
   JavaScript, with reduced motion, or if anything fails, the still picture simply shows.
   Specs: docs/superpowers/specs/2026-10-14-hall-erection-design.md and 2026-10-14-hall-rotate-design.md */
(function () {
  'use strict';

  // ---- camera math, shared in spirit with tools/make-hall.js and tools/make-hall-still.py (spec section 3)
  const EL_MIN = 0.0524, EL_MAX = 0.4887;      // elevation limits, 3° and 28°: steeper tilts push the hall out of the frame
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  function basis(cam) { const fwd = norm(sub(cam.at, cam.eye)), right = norm(cross(fwd, [0, 1, 0])); return { fwd, right, up: cross(right, fwd) }; }
  // a point in metres -> [x, y, depth] on a W × H canvas, with the data file's framing scale and offset applied
  function project(p, cam, W, H, b) {
    b = b || basis(cam);
    const d = sub(p, cam.eye), depth = dot(d, b.fwd), f = cam.focal * W / 2 / depth;
    return [(W / 2 + dot(d, b.right) * f) * cam.s + cam.dx, (H / 2 - dot(d, b.up) * f) * cam.s + cam.dy, depth];
  }
  const widthPx = (wm, depth, cam, W) => wm * cam.focal * W / 2 / depth * cam.s;
  // the eye about the target in spherical terms, the viewer's convention: az = 0 looks along -z from +z
  function spherical(eye, at) { const d = sub(eye, at), dist = Math.hypot(d[0], d[1], d[2]); return { dist, az: Math.atan2(d[0], d[2]), el: Math.asin(d[1] / dist) }; }
  const eyeAt = (at, dist, az, el) => [at[0] + dist * Math.cos(el) * Math.sin(az), at[1] + dist * Math.sin(el), at[2] + dist * Math.cos(el) * Math.cos(az)];
  const clampEl = el => Math.max(EL_MIN, Math.min(EL_MAX, el));

  // the erection timeline: each zone's pieces come one after another, every step seconds, each swinging in for OVERLAP steps,
  // the zone's last piece landing at TOTAL; a piece spanning more than SPAN of the canvas (a whole roof truss) swings in longer
  // in proportion, and the erection ends when the last piece has landed. lane[pi] is a piece's zone, span[pi] its size as a
  // fraction of the canvas; order lists every piece
  function schedule(order, lane, span, T) {
    const n = order.length, count = new Int32Array(T.LANES), pos = new Int32Array(T.LANES);
    const startAt = new Float64Array(n), flyOf = new Float64Array(n);
    order.forEach(pi => { count[lane[pi]]++; });
    let end = 0;
    order.forEach(pi => {
      const l = lane[pi], step = T.TOTAL / (count[l] - 1 + T.OVERLAP);
      startAt[pi] = pos[l]++ * step; flyOf[pi] = step * T.OVERLAP * Math.max(1, span[pi] / T.SPAN);
      end = Math.max(end, startAt[pi] + flyOf[pi]);
    });
    return { startAt, flyOf, end };
  }

  if (typeof module !== 'undefined') module.exports = { project, widthPx, spherical, eyeAt, clampEl, basis, schedule };
  if (typeof window === 'undefined') return;
  if (!('fetch' in window) || !('IntersectionObserver' in window)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!document.createElement('canvas').getContext) return;

  const TOTAL = 15, LANES = 5;                 // seconds for the whole erection at speed 1 (the tempo of the 25 s, 536-piece build, with the roof now 21 pieces); work fronts assembling at once
  const OVERLAP = 1.4;                         // a lane's next piece starts when the previous one is 1/OVERLAP of the way in
  const SPAN = 0.3;                            // a piece spanning more of the canvas than this swings in longer, in proportion: the roof trusses
  const SWING_X = 0.35, SWING_Y = -0.3, LIFT = 0.08;   // how far off a piece starts, as fractions of the canvas, and the arc's rise
  const INK = '#3a3f44', A_NEAR = 0.95, A_FAR = 0.45, W_MIN = 1.2, W_MAX = 6;   // widths in the picture's pixels (1500 wide), as in the still
  const TURN = 60, DRAG_AZ = 0.006, DRAG_EL = 0.005, IDLE = 4;   // seconds per revolution after the erection; radians per dragged pixel; idle seconds before the turn resumes
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;   // ease in and out

  document.querySelectorAll('figure[data-hall]').forEach(fig => {
    const stage = fig.querySelector('.hall-stage'), still = fig.querySelector('.hall-static');
    if (!stage || !still) return;
    const SRC = still.getAttribute('src'), V = SRC.indexOf('?') > -1 ? SRC.slice(SRC.indexOf('?')) : '';
    const speed = parseFloat(fig.getAttribute('data-speed')) || 1;
    let data = null, seen = false, ran = false;
    const maybeStart = () => { if (data && seen && !ran) { ran = true; run(fig, stage, data, speed); } };
    fetch(fig.getAttribute('data-hall') + V).then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { data = d; maybeStart(); }).catch(() => {});
    const io = new IntersectionObserver(entries => {
      const on = entries.some(e => e.isIntersecting);
      fig.__inView = on;
      if (fig.__wake) fig.__wake(on);
      if (!on) return;
      seen = true; maybeStart();
    }, { threshold: 0.25 });
    io.observe(fig);
  });

  function run(fig, stage, data, speed) {
    if (data.v !== 2 || !data.cam || !data.members || !data.pieces || !data.order) return;   // an old or odd file: the still stays
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = stage.clientWidth || data.w, k = cssW * dpr / data.w;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(data.w * k); canvas.height = Math.round(data.h * k); canvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    stage.appendChild(canvas); fig.setAttribute('data-live', '1');

    const M = data.members, pieces = data.pieces, order = data.order, N = M.length, W = data.w, H = data.h;
    const cam = { eye: data.cam.eye.slice(), at: data.cam.at, focal: data.cam.focal, s: data.cam.s, dx: data.cam.dx, dy: data.cam.dy };
    const sph = spherical(cam.eye, cam.at), dist = sph.dist;
    let az = sph.az, el = sph.el;

    // the current view: every member projected to canvas pixels, sorted far to near
    const px1 = new Float32Array(N), py1 = new Float32Array(N), px2 = new Float32Array(N), py2 = new Float32Array(N);
    const depth = new Float32Array(N), width = new Float32Array(N), idx = new Int32Array(N);
    for (let i = 0; i < N; i++) idx[i] = i;
    let dMin = 0, dMax = 1;
    function view() {
      cam.eye = eyeAt(cam.at, dist, az, el);
      const b = basis(cam); dMin = Infinity; dMax = -Infinity;
      for (let i = 0; i < N; i++) {
        const m = M[i], a = project(m, cam, W, H, b), c = project([m[3], m[4], m[5]], cam, W, H, b);
        px1[i] = a[0] * k; py1[i] = a[1] * k; px2[i] = c[0] * k; py2[i] = c[1] * k;
        depth[i] = (a[2] + c[2]) / 2;
        width[i] = Math.max(W_MIN, Math.min(W_MAX, widthPx(m[6], depth[i], cam, W))) * k;   // picture px scaled by k, as in the still
        if (depth[i] < dMin) dMin = depth[i]; if (depth[i] > dMax) dMax = depth[i];
      }
      idx.sort((i, j) => depth[j] - depth[i]);
    }
    view();                                                            // the default view, for the lanes below

    // five work fronts: the picture is cut into LANES vertical zones; each zone erects its own pieces in site order,
    // one after another, all zones finishing together at TOTAL; a piece swings in from above its zone, leaning in from the outside
    const pieceOf = new Int32Array(N), lane = new Int32Array(pieces.length), span = new Float64Array(pieces.length);
    pieces.forEach((p, pi) => {
      let sx = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      p.m.forEach(i => {
        pieceOf[i] = pi; sx += px1[i] + px2[i];
        x0 = Math.min(x0, px1[i], px2[i]); x1 = Math.max(x1, px1[i], px2[i]); y0 = Math.min(y0, py1[i], py2[i]); y1 = Math.max(y1, py1[i], py2[i]);
      });
      lane[pi] = Math.min(LANES - 1, Math.max(0, Math.floor(sx / (2 * p.m.length) / canvas.width * LANES)));
      span[pi] = Math.max((x1 - x0) / canvas.width, (y1 - y0) / canvas.height);
    });
    const { startAt, flyOf, end } = schedule(order, lane, span, { TOTAL, LANES, OVERLAP, SPAN });
    const swingX = SWING_X * canvas.width, swingY = SWING_Y * canvas.height, lift = LIFT * canvas.height;
    const sideOf = l => (l - (LANES - 1) / 2) / ((LANES - 1) / 2);     // -1 at the left edge, +1 at the right, 0 in the middle
    const border = 1.5 * k, whiteFrom = 2 * k;
    const started = new Uint8Array(N), progress = new Float64Array(pieces.length);
    ctx.lineCap = 'butt';

    // states: building (the erection, view fixed) -> turning (slow orbit) -> held (dragging) -> still (idle, no frames)
    let state = 'building', start = null, paused = 0, hiddenAt = null, last = null, looping = true, holdX = 0, holdY = 0, holdId = null, resumeTimer = null;
    let inView = fig.__inView !== false;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) hiddenAt = performance.now();
      else if (hiddenAt !== null) { paused += performance.now() - hiddenAt; hiddenAt = null; }
      last = null;                                                     // no jump in the turn after a hidden tab
    });
    function frame(now) {
      if (start === null) start = now;
      if (document.hidden) { last = null; requestAnimationFrame(frame); return; }
      let t = end + 1;
      if (state === 'building') {
        t = (now - start - paused) / 1000 * speed;
        if (t >= end + 0.1) { state = 'turning'; fig.setAttribute('data-done', '1'); canvas.style.cursor = 'grab'; }
      }
      if (state === 'turning' && last !== null) az += 2 * Math.PI / TURN * (now - last) / 1000;
      last = now;
      if (state !== 'building') view();
      for (let pi = 0; pi < pieces.length; pi++) progress[pi] = Math.min(Math.max((t - startAt[pi]) / flyOf[pi], 0), 1);
      for (let i = 0; i < N; i++) started[i] = t >= startAt[pieceOf[i]] ? 1 : 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const dRange = dMax - dMin || 1;
      for (let q = 0; q < N; q++) {
        const i = idx[q];
        if (!started[i]) continue;                                   // nothing shows through from the future
        const pi = pieceOf[i], p = progress[pi], e = ease(p);
        const dx = sideOf(lane[pi]) * swingX * (1 - e), dy = swingY * (1 - e) - lift * Math.sin(Math.PI * p);   // the swing: down from above its zone, leaning in from the outside
        const w = width[i], alpha = A_NEAR - (A_NEAR - A_FAR) * (depth[i] - dMin) / dRange;
        ctx.globalAlpha = alpha * Math.min(1, 0.15 + p * 2.5); ctx.strokeStyle = INK; ctx.lineWidth = w + border;
        ctx.beginPath(); ctx.moveTo(px1[i] + dx, py1[i] + dy); ctx.lineTo(px2[i] + dx, py2[i] + dy); ctx.stroke();
        if (w >= whiteFrom) { ctx.strokeStyle = '#fff'; ctx.lineWidth = w; ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
      if (!inView && state !== 'building') { looping = false; return; }   // scrolled away: the turn waits, no frames
      looping = state !== 'still';
      if (state === 'still') return;
      requestAnimationFrame(frame);
    }
    const kick = () => { if (!looping) { looping = true; last = null; requestAnimationFrame(frame); } };
    fig.__wake = on => { inView = on; if (on) kick(); };
    const release = () => {
      if (state !== 'held') return;
      state = 'still'; holdId = null; canvas.style.cursor = 'grab'; kick();
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => { if (state === 'still') { state = 'turning'; last = null; kick(); } }, IDLE * 1000);   // left alone: it turns again from here
    };
    canvas.addEventListener('pointerdown', e => {
      if (state === 'building') return;                              // the erection is never interrupted
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (state === 'held') { release(); return; }                    // a second finger ends the hold; it never steers
      clearTimeout(resumeTimer);
      state = 'held'; holdId = e.pointerId; holdX = e.clientX; holdY = e.clientY; canvas.style.cursor = 'grabbing';
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* capture is a courtesy */ }
      kick();
    });
    canvas.addEventListener('pointermove', e => {
      if (state !== 'held' || e.pointerId !== holdId) return;
      az -= (e.clientX - holdX) * DRAG_AZ; el = clampEl(el + (e.clientY - holdY) * DRAG_EL);
      holdX = e.clientX; holdY = e.clientY; kick();
    });
    canvas.addEventListener('pointerup', e => { if (e.pointerId === holdId) release(); });
    canvas.addEventListener('pointercancel', e => { if (e.pointerId === holdId) release(); });   // the browser took the touch for scrolling or a pinch
    canvas.addEventListener('lostpointercapture', e => { if (e.pointerId === holdId) release(); });
    requestAnimationFrame(frame);
  }
})();

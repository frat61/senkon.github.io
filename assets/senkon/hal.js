/* Erection animation for the steel hall: every <figure data-hall="…json"> erects Fırat's lattice-column hall
   piece by piece on a canvas over the still picture, once per page load, then leaves the finished
   drawing. The JSON (written by tools/make-hall.js from the viewer's GLB) holds the members as projected
   lines [x1, y1, x2, y2, width px, depth], the erection pieces (towers, posts, floor bays, roof truss
   lines, roof bays) with their member indices, the site order of the pieces and the members' far-to-near
   order. The picture is cut into LANES vertical zones that assemble at once, each zone's pieces one after
   another in site order, swinging down from above the zone like crane loads; the whole erection takes
   TOTAL seconds at speed 1 (data-speed runs it faster). Members are painted far to near, an ink stroke under a
   white one, so the front hides the back like a line drawing; farther members fade a little. Without
   JavaScript, with reduced motion, or if anything fails, the still picture simply shows.
   Spec: docs/superpowers/specs/2026-10-14-hall-erection-design.md */
(function () {
  'use strict';

  // ---- camera math, shared in spirit with tools/make-hall.js and tools/make-hall-still.py (spec section 3)
  const EL_MIN = 0.0524, EL_MAX = 1.2217;      // elevation limits, 3° and 70°
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

  if (typeof module !== 'undefined') module.exports = { project, widthPx, spherical, eyeAt, clampEl, basis };
  if (typeof window === 'undefined') return;
  if (!('fetch' in window) || !('IntersectionObserver' in window)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!document.createElement('canvas').getContext) return;

  const TOTAL = 25, LANES = 5;                 // seconds for the whole erection at speed 1; work fronts assembling at once
  const OVERLAP = 1.4;                         // a lane's next piece starts when the previous one is 1/OVERLAP of the way in
  const SWING_X = 0.35, SWING_Y = -0.3, LIFT = 0.08;   // how far off a piece starts, as fractions of the canvas, and the arc's rise
  const INK = '#3a3f44', A_NEAR = 0.95, A_FAR = 0.45, W_MIN = 1.2, W_MAX = 6;   // widths in the picture's pixels (1500 wide), as in the still
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
      if (!entries.some(e => e.isIntersecting)) return;
      io.disconnect(); seen = true; maybeStart();
    }, { threshold: 0.25 });
    io.observe(fig);
  });

  function run(fig, stage, data, speed) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = stage.clientWidth || data.w, k = cssW * dpr / data.w;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(data.w * k); canvas.height = Math.round(data.h * k); canvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    stage.appendChild(canvas); fig.setAttribute('data-live', '1');

    const M = data.members, pieces = data.pieces, order = data.order, depthOrder = data.depthOrder;
    // five work fronts: the picture is cut into LANES vertical zones; each zone erects its own pieces in site order,
    // one after another, all zones finishing together at TOTAL; a piece swings in from above its zone, leaning in from the outside
    const pieceOf = new Int32Array(M.length), lane = new Int32Array(pieces.length), startAt = new Float64Array(pieces.length), flyOf = new Float64Array(pieces.length);
    pieces.forEach((p, pi) => {
      let sx = 0; p.m.forEach(i => { pieceOf[i] = pi; sx += M[i][0] + M[i][2]; });
      lane[pi] = Math.min(LANES - 1, Math.floor(sx / (2 * p.m.length) / data.w * LANES));
    });
    const count = new Int32Array(LANES); order.forEach(pi => { count[lane[pi]]++; });
    const pos = new Int32Array(LANES);
    order.forEach(pi => { const l = lane[pi], n = count[l], step = TOTAL / (n - 1 + OVERLAP); startAt[pi] = pos[l] * step; flyOf[pi] = step * OVERLAP; pos[l]++; });
    const swingX = SWING_X * canvas.width, swingY = SWING_Y * canvas.height, lift = LIFT * canvas.height;
    const sideOf = l => (l - (LANES - 1) / 2) / ((LANES - 1) / 2);     // -1 at the left edge, +1 at the right, 0 in the middle
    let dMin = Infinity, dMax = -Infinity;
    M.forEach(m => { dMin = Math.min(dMin, m[5]); dMax = Math.max(dMax, m[5]); });
    // widths live in the picture's own pixels (the still is drawn with the same clamps), so they scale with the canvas by k, never by dpr alone
    const alphaOf = m => A_NEAR - (A_NEAR - A_FAR) * (m[5] - dMin) / (dMax - dMin || 1);
    const widthOf = m => Math.max(W_MIN, Math.min(W_MAX, m[4])) * k;
    const alpha = new Float32Array(M.length), width = new Float32Array(M.length);
    M.forEach((m, i) => { alpha[i] = alphaOf(m); width[i] = widthOf(m); });
    const border = 1.5 * k, whiteFrom = 2 * k;
    const started = new Uint8Array(M.length), progress = new Float64Array(pieces.length);
    ctx.lineCap = 'butt';

    let start = null, paused = 0, hiddenAt = null;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) hiddenAt = performance.now();
      else if (hiddenAt !== null) { paused += performance.now() - hiddenAt; hiddenAt = null; }
    });
    function frame(now) {
      if (start === null) start = now;
      if (document.hidden) { requestAnimationFrame(frame); return; }
      const t = (now - start - paused) / 1000 * speed;
      for (let pi = 0; pi < pieces.length; pi++) progress[pi] = Math.min(Math.max((t - startAt[pi]) / flyOf[pi], 0), 1);
      for (let i = 0; i < M.length; i++) started[i] = t >= startAt[pieceOf[i]] ? 1 : 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let q = 0; q < depthOrder.length; q++) {
        const i = depthOrder[q];
        if (!started[i]) continue;                                   // nothing shows through from the future
        const m = M[i], pi = pieceOf[i], p = progress[pi], e = ease(p);
        const dx = sideOf(lane[pi]) * swingX * (1 - e), dy = swingY * (1 - e) - lift * Math.sin(Math.PI * p);   // the swing: down from above its zone, leaning in from the outside
        const w = width[i];
        ctx.globalAlpha = alpha[i] * Math.min(1, 0.15 + p * 2.5); ctx.strokeStyle = INK; ctx.lineWidth = w + border;
        ctx.beginPath(); ctx.moveTo(m[0] * k + dx, m[1] * k + dy); ctx.lineTo(m[2] * k + dx, m[3] * k + dy); ctx.stroke();
        if (w >= whiteFrom) { ctx.strokeStyle = '#fff'; ctx.lineWidth = w; ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
      if (t < TOTAL + 0.1) requestAnimationFrame(frame);
      else fig.setAttribute('data-done', '1');
    }
    requestAnimationFrame(frame);
  }
})();

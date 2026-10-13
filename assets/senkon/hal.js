/* Erection animation for the steel hall: every <figure data-hall="…json"> erects Fırat's lattice-column hall
   element by element on a canvas over the still picture, once per page load, then leaves the finished
   drawing. The JSON (written by tools/make-hall.js from the viewer's GLB) holds the members as projected
   lines [x1, y1, x2, y2, width px, depth], the erection pieces (towers, posts, floor beams and bracing,
   roof trusses) with their member indices and fly-in distance, the site order of the pieces and the
   members' far-to-near order. A piece appears above its place, descends on a hook line and settles;
   the whole erection takes TOTAL seconds at speed 1 (data-speed runs it faster), each piece flying FLY
   seconds. Members are painted far to near, an ink stroke under a white one, so the front hides the back
   like a line drawing; farther members fade a little. Without JavaScript, with reduced motion, or if
   anything fails, the still picture simply shows. Spec: docs/superpowers/specs/2026-10-14-hall-erection-design.md */
(function () {
  'use strict';
  if (!('fetch' in window) || !('IntersectionObserver' in window)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!document.createElement('canvas').getContext) return;

  const TOTAL = 25, FLY = 0.6;                 // seconds for the whole erection at speed 1; seconds a piece is in the air
  const INK = '#3a3f44', A_NEAR = 0.95, A_FAR = 0.45, W_MIN = 1.2, W_MAX = 6;   // widths in CSS px
  const ease = p => 1 - Math.pow(1 - p, 3);

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
    const n = order.length, step = n > 1 ? (TOTAL - FLY) / (n - 1) : 0;
    const startAt = new Float64Array(pieces.length), pieceOf = new Int32Array(M.length), fly = new Float64Array(pieces.length);
    const top = new Float64Array(pieces.length), left = new Float64Array(pieces.length), right = new Float64Array(pieces.length);
    order.forEach((pi, pos) => { startAt[pi] = pos * step; });
    pieces.forEach((p, pi) => {
      fly[pi] = p.fly * k; let y0 = Infinity, x0 = Infinity, x1 = -Infinity;
      p.m.forEach(i => { pieceOf[i] = pi; const m = M[i]; y0 = Math.min(y0, m[1], m[3]); x0 = Math.min(x0, m[0], m[2]); x1 = Math.max(x1, m[0], m[2]); });
      top[pi] = y0 * k; left[pi] = x0 * k; right[pi] = x1 * k;
    });
    let dMin = Infinity, dMax = -Infinity;
    M.forEach(m => { dMin = Math.min(dMin, m[5]); dMax = Math.max(dMax, m[5]); });
    const alphaOf = m => A_NEAR - (A_NEAR - A_FAR) * (m[5] - dMin) / (dMax - dMin || 1);
    const widthOf = m => Math.max(W_MIN, Math.min(W_MAX, m[4])) * dpr;
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
      for (let pi = 0; pi < pieces.length; pi++) progress[pi] = Math.min(Math.max((t - startAt[pi]) / FLY, 0), 1);
      for (let i = 0; i < M.length; i++) started[i] = t >= startAt[pieceOf[i]] ? 1 : 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let q = 0; q < depthOrder.length; q++) {
        const i = depthOrder[q];
        if (!started[i]) continue;                                   // nothing shows through from the future
        const m = M[i], pi = pieceOf[i], p = progress[pi], dy = -fly[pi] * (1 - ease(p));
        const a = alphaOf(m) * (0.25 + 0.75 * p), w = widthOf(m);
        ctx.globalAlpha = a; ctx.strokeStyle = INK; ctx.lineWidth = w + 1.5 * dpr;
        ctx.beginPath(); ctx.moveTo(m[0] * k, m[1] * k + dy); ctx.lineTo(m[2] * k, m[3] * k + dy); ctx.stroke();
        if (w >= 2 * dpr) { ctx.strokeStyle = '#fff'; ctx.lineWidth = w; ctx.stroke(); }
      }
      ctx.globalAlpha = 0.8; ctx.strokeStyle = INK; ctx.lineWidth = 1 * dpr;
      for (let pi = 0; pi < pieces.length; pi++) {                   // hook lines on the pieces in the air
        const p = progress[pi];
        if (p <= 0 || p >= 1) continue;
        const x = (left[pi] + right[pi]) / 2, y = top[pi] - fly[pi] * (1 - ease(p));
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, -10); ctx.moveTo(x - 3 * dpr, y); ctx.lineTo(x + 3 * dpr, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (t < TOTAL + 0.1) requestAnimationFrame(frame);
      else fig.setAttribute('data-done', '1');
    }
    requestAnimationFrame(frame);
  }
})();

/* Skyline band: raises every building of assets/senkon/skyline.webp at once, each with its own tower
   crane and a little dust at the working level, once per page load, then leaves the finished picture.
   assets/senkon/skyline.json (written by tools/measure-skyline.py) gives each building's column and
   top in image pixels. Without JavaScript, with reduced motion, or if anything fails, the static
   picture simply shows. */
(function () {
  'use strict';
  const fig = document.getElementById('skyline');
  if (!fig || !('fetch' in window) || !('IntersectionObserver' in window)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const stage = fig.querySelector('.skyline-stage');
  const stat = fig.querySelector('.skyline-static');
  if (!stage || !stat) return;
  const SRC = stat.getAttribute('src'), V = SRC.indexOf('?') > -1 ? SRC.slice(SRC.indexOf('?')) : '';

  const SETUP = 1.0, TEARDOWN = 1.0;        // seconds to erect / dismantle a crane
  const MIN_BUILD = 3.2, MAX_BUILD = 7.0;   // seconds per building, scaled by its height
  const STAGGER = 0.05;                     // seconds between neighbouring starts, a ripple left to right
  const LEAD = 48;                          // crane mast stays this far (image px) above the current top
  const PUFFS = 6, PUFF_CYCLE = 1.8;        // dust puffs per building and seconds per puff

  fetch('assets/senkon/skyline.json' + V).then(r => r.ok ? r.json() : Promise.reject(r.status)).then(prepare).catch(() => {});

  function prepare(data) {
    const W = data.w, H = data.h, G = data.ground, cols = data.cols || [];
    if (!cols.length) return;
    const hmax = Math.max.apply(null, cols.map(c => G - c.top));

    const jobs = cols.map((c, i) => {
      const dur = MIN_BUILD + (MAX_BUILD - MIN_BUILD) * (G - c.top) / hmax;
      const next = cols[i + 1], prev = cols[i - 1];
      const gapR = (next ? next.x0 : W) - c.x1, gapL = c.x0 - (prev ? prev.x1 : 0);
      const side = gapR >= 20 || gapR >= gapL ? 1 : -1;        // cranes stand to the right, so no two share a gap
      const off = Math.min(Math.max(side > 0 ? gapR : gapL, 14) / 2, 18);
      const t0 = i * STAGGER;
      return { c: c, t0: t0, b0: t0 + SETUP, b1: t0 + SETUP + dur, t1: t0 + SETUP + dur + TEARDOWN, side: side,
        mx: side > 0 ? c.x1 + off : c.x0 - off, jib: Math.min(c.x1 - c.x0 + 24 + off, 170), phase: i * 1.7 };
    });
    const total = Math.max.apply(null, jobs.map(j => j.t1)) + 0.2;

    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      io.disconnect(); run();
    }, { threshold: 0.25 });
    io.observe(fig);

    function layer(x0, x1, clipTop) {
      const d = document.createElement('div');
      d.style.left = (x0 / W * 100) + '%'; d.style.width = ((x1 - x0 + 1) / W * 100) + '%';
      d.style.clipPath = 'inset(' + clipTop + '% 0 0 0)';
      const im = document.createElement('img'); im.src = SRC; im.alt = ''; im.draggable = false;
      im.style.left = (-x0 / (x1 - x0 + 1) * 100) + '%';
      d.appendChild(im); return d;
    }
    function el(name) { return document.createElementNS('http://www.w3.org/2000/svg', name); }
    function run() {
      const ground = layer(0, W - 1, (G - 2) / H * 100); ground.className = 'sk-ground';
      const wrap = document.createElement('div'); wrap.setAttribute('aria-hidden', 'true');
      wrap.appendChild(ground);
      jobs.forEach(j => { j.el = layer(j.c.x0, j.c.x1, G / H * 100); j.el.className = 'sk-b'; if (j.c.name) j.el.title = j.c.name; wrap.appendChild(j.el); });
      const svg = el('svg');
      svg.setAttribute('class', 'sk-cranes'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('preserveAspectRatio', 'none');
      const cs = getComputedStyle(document.documentElement);
      const ink = cs.getPropertyValue('--ink').trim() || '#1d2b33', dust = cs.getPropertyValue('--muted').trim() || '#5b6a73';
      const dustG = el('g'); dustG.setAttribute('fill', dust); svg.appendChild(dustG);
      jobs.forEach(j => {
        j.puffs = [];
        for (let q = 0; q < PUFFS; q++) { const o = el('circle'); o.setAttribute('r', '0'); dustG.appendChild(o); j.puffs.push(o); }
        const p = el('path');
        p.setAttribute('fill', 'none'); p.setAttribute('stroke', ink); p.setAttribute('stroke-width', '1.1'); p.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(p); j.path = p;
      });
      wrap.appendChild(svg); stage.appendChild(wrap); fig.setAttribute('data-live', '1');

      let start = null, paused = 0, hiddenAt = null;
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) hiddenAt = performance.now();
        else if (hiddenAt !== null) { paused += performance.now() - hiddenAt; hiddenAt = null; }
      });
      function frame(now) {
        if (start === null) start = now;
        if (document.hidden) { requestAnimationFrame(frame); return; }
        const t = (now - start - paused) / 1000;
        jobs.forEach(j => {
          if (j.finished) return;
          const p = Math.min(Math.max((t - j.b0) / (j.b1 - j.b0), 0), 1);
          const curTop = G - p * (G - j.c.top);
          if (p > 0 && !j.done) {
            j.el.style.clipPath = 'inset(' + (curTop / H * 100).toFixed(3) + '% 0 0 0)';
            if (p === 1) j.done = true;
          }
          puffs(j, t, p, curTop);
          if (t < j.t1) j.path.setAttribute('d', crane(j, t, p, curTop));
          else { j.path.setAttribute('d', ''); j.finished = true; }
        });
        if (t < total) requestAnimationFrame(frame);
        else { svg.remove(); fig.setAttribute('data-done', '1'); }
      }
      requestAnimationFrame(frame);
    }

    // dust at the working level: small puffs rising from the current top and fading
    function hash(n) { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); }
    function puffs(j, t, p, curTop) {
      const c = j.c, w = c.x1 - c.x0;
      for (let q = 0; q < PUFFS; q++) {
        const o = j.puffs[q];
        if (p <= 0 || p >= 1) { o.setAttribute('r', '0'); continue; }
        const u = (t + q * PUFF_CYCLE / PUFFS + j.phase) / PUFF_CYCLE, cycle = Math.floor(u), age = u - cycle;
        const seed = cycle * PUFFS + q + j.phase;
        const x = c.x0 + w * (0.1 + 0.8 * hash(seed)) + (hash(seed + 0.5) - 0.5) * 10 * age;
        const y = curTop + 3 - age * 16;
        o.setAttribute('cx', x.toFixed(1)); o.setAttribute('cy', y.toFixed(1));
        o.setAttribute('r', (2 + age * 6).toFixed(1)); o.setAttribute('opacity', (0.22 * (1 - age)).toFixed(3));
      }
    }

    // one crane's line drawing at time t, in image pixels
    function L(a, b, c, d) { return 'M' + a.toFixed(1) + ' ' + b.toFixed(1) + 'L' + c.toFixed(1) + ' ' + d.toFixed(1); }
    function crane(j, t, p, curTop) {
      const c = j.c, x = j.mx, s = j.side;
      let mastTop = Math.max(curTop - LEAD, c.top - LEAD, 8);
      let scale = 1;
      if (t < j.t0) return '';
      if (t < j.b0) { scale = (t - j.t0) / SETUP; mastTop = G - LEAD; }
      else if (t >= j.b1) { scale = 1 - (t - j.b1) / TEARDOWN; }
      scale = Math.min(Math.max(scale, 0), 1);
      const e = scale * scale * (3 - 2 * scale);                 // smooth erect / dismantle
      const top = G - e * (G - mastTop);
      const mw = 9, half = mw / 2;
      let d = L(x - half, G, x - half, top) + L(x + half, G, x + half, top);
      for (let y = G - 14; y > top + 6; y -= 14) d += L(x - half, y, x + half, y - 14) + L(x + half, y, x - half, y - 14);
      if (e < 0.3) return d;                                     // only the mast while erecting / dismantling
      const jibScale = Math.min((e - 0.3) / 0.5, 1);
      const sw = 0.5 + 0.5 * Math.cos(t * 0.33 + j.phase);       // slewing: projected jib length
      const jl = j.jib * (0.45 + 0.55 * sw) * jibScale * -s;      // jib points over the building
      const cl = -jl * 0.38;                                     // counter-jib
      const ty = top - 2;
      d += L(x - half, ty, x + jl, ty) + L(x + half, ty + 5, x + jl * 0.97, ty + 5);       // jib chords
      const n = Math.max(2, Math.floor(Math.abs(jl) / 12));
      for (let i = 0; i < n; i++) { const a = x + jl * i / n, b = x + jl * (i + 1) / n; d += L(a, ty + 5, b, ty); }
      d += L(x + half, ty, x + cl, ty) + L(x + half, ty + 5, x + cl, ty + 5) + L(x + cl, ty, x + cl, ty + 5);   // counter-jib
      const cw = 7 * (Math.sign(cl) || 1);
      d += L(x + cl, ty + 5, x + cl, ty + 13) + L(x + cl, ty + 13, x + cl - cw, ty + 13) + L(x + cl - cw, ty + 13, x + cl - cw, ty + 5);  // counterweight
      const apex = ty - 16;
      d += L(x - half, ty, x, apex) + L(x + half, ty, x, apex) + L(x, apex, x + jl * 0.95, ty) + L(x, apex, x + cl, ty);   // tower top and ties
      const cx = x + half * s, cx2 = cx - 7 * s;
      d += L(cx, ty + 5, cx2, ty + 5) + L(cx2, ty + 5, cx2, ty + 12) + L(cx2, ty + 12, cx, ty + 12);  // cab
      if (p > 0 && p < 1) {                                      // trolley, hook cable and a lifted beam
        const f = 0.45 + 0.4 * Math.sin(t * 0.5 + j.phase), tx = x + jl * f;
        const hy = Math.max(curTop - 10, ty + 20);
        d += L(tx - 3, ty + 5, tx + 3, ty + 5) + L(tx, ty + 5, tx, hy) + L(tx - 7, hy, tx + 7, hy) + L(tx - 7, hy + 3, tx + 7, hy + 3);
      }
      return d;
    }
  }
})();

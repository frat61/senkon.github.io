/* Skyline band: raises every building of assets/senkon/skyline.webp at once, each with its own small
   tower cranes working a lifting cycle, a soft unfinished edge and a little dust, once per page load,
   then leaves the finished picture. assets/senkon/skyline.json (written by tools/measure-skyline.py)
   gives each building's column and top in image pixels. Without JavaScript, with reduced motion, or
   if anything fails, the static picture simply shows. */
(function () {
  'use strict';
  const fig = document.getElementById('skyline');
  if (!fig || !('fetch' in window) || !('IntersectionObserver' in window)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const stage = fig.querySelector('.skyline-stage');
  const stat = fig.querySelector('.skyline-static');
  if (!stage || !stat) return;
  const SRC = stat.getAttribute('src'), V = SRC.indexOf('?') > -1 ? SRC.slice(SRC.indexOf('?')) : '';
  const HERE = document.currentScript && document.currentScript.src ? document.currentScript.src : location.href;

  const SETUP = 1.2, TEARDOWN = 1.6;        // seconds to erect / climb down a crane
  const MIN_BUILD = 6, MAX_BUILD = 11;      // seconds per building, scaled by its height
  const STAGGER = 0.05;                     // seconds between neighbouring starts, a ripple left to right
  const CYCLE = 7;                          // seconds per lifting cycle
  const TALLEST_M = 828;                    // metres of the tallest building, sets the metre scale
  const JIB_M = 70, LUFF_M = 60, MAST_M = 28, TWO_CRANES_PX = 40;
  const PUFFS = 3, PUFF_CYCLE = 2.2, EDGE_PX = 10;

  fetch(new URL('skyline.json' + V, HERE).href).then(r => r.ok ? r.json() : Promise.reject(r.status)).then(prepare).catch(() => {});

  function prepare(data) {
    const W = data.w, H = data.h, G = data.ground, cols = data.cols || [];
    if (!cols.length) return;
    const hmax = Math.max.apply(null, cols.map(c => G - c.top));
    const m = hmax / TALLEST_M;                                  // image pixels per metre

    const jobs = cols.map((c, i) => {
      const dur = MIN_BUILD + (MAX_BUILD - MIN_BUILD) * (G - c.top) / hmax;
      const t0 = i * STAGGER, w = c.x1 - c.x0;
      const cranes = [];
      if (w >= TWO_CRANES_PX) {                                  // climbing cranes riding on the deck
        cranes.push({ kind: 'hammer', fx: 0.3, dir: -1, mast: MAST_M * m, phase: i * 2.3, climb: true });
        cranes.push({ kind: 'luff', fx: 0.72, dir: 1, mast: MAST_M * 1.35 * m, phase: i * 2.3 + 3.1, climb: true });
      } else {                                                   // one crane beside a slender tower, tied to it
        cranes.push({ kind: i % 2 ? 'luff' : 'hammer', fx: 1, x: c.x1 + 9, dir: -1, mast: MAST_M * m, phase: i * 2.3, climb: false });
      }
      cranes.forEach(k => { if (k.x === undefined) k.x = c.x0 + w * k.fx; });
      return { c: c, i: i, t0: t0, b0: t0 + SETUP, b1: t0 + SETUP + dur, t1: t0 + SETUP + dur + TEARDOWN, cranes: cranes };
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
      jobs.forEach(j => {
        j.el = layer(j.c.x0, j.c.x1, G / H * 100); j.el.className = 'sk-b'; if (j.c.name) j.el.title = j.c.name;
        j.edge = document.createElement('div'); j.edge.className = 'sk-edge'; j.edge.style.height = (EDGE_PX / H * 100) + '%';
        j.el.appendChild(j.edge); wrap.appendChild(j.el);
      });
      const svg = el('svg');
      svg.setAttribute('class', 'sk-cranes'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('preserveAspectRatio', 'none');
      const cs = getComputedStyle(document.documentElement);
      const ink = cs.getPropertyValue('--ink').trim() || '#1d2b33', dust = cs.getPropertyValue('--muted').trim() || '#5b6a73';
      const dustG = el('g'); dustG.setAttribute('fill', dust); svg.appendChild(dustG);
      jobs.forEach(j => {
        j.puffs = [];
        for (let q = 0; q < PUFFS; q++) { const o = el('circle'); o.setAttribute('r', '0'); dustG.appendChild(o); j.puffs.push(o); }
        j.cranes.forEach(k => {
          const p = el('path');
          p.setAttribute('fill', 'none'); p.setAttribute('stroke', ink); p.setAttribute('stroke-width', '1.1'); p.setAttribute('stroke-linejoin', 'round');
          svg.appendChild(p); k.path = p;
        });
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
            j.edge.style.top = (curTop / H * 100).toFixed(3) + '%';
            if (p === 1) { j.done = true; j.edge.style.display = 'none'; }
          }
          puffs(j, t, p, curTop);
          if (t < j.t1) j.cranes.forEach(k => k.path.setAttribute('d', crane(j, k, t, p, curTop)));
          else { j.cranes.forEach(k => k.path.setAttribute('d', '')); j.finished = true; }
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
        const u = (t + q * PUFF_CYCLE / PUFFS + j.i) / PUFF_CYCLE, cycle = Math.floor(u), age = u - cycle;
        const seed = cycle * PUFFS + q + j.i;
        const x = c.x0 + w * (0.1 + 0.8 * hash(seed)) + (hash(seed + 0.5) - 0.5) * 8 * age;
        const y = curTop + 2 - age * 12;
        o.setAttribute('cx', x.toFixed(1)); o.setAttribute('cy', y.toFixed(1));
        o.setAttribute('r', (1.5 + age * 4.5).toFixed(1)); o.setAttribute('opacity', (0.2 * (1 - age)).toFixed(3));
      }
    }

    // lifting cycle: slew out, hook down to the ground, lift, slew back, set the load on the deck
    function ease(u) { u = Math.min(Math.max(u, 0), 1); return u * u * (3 - 2 * u); }
    function seg(u, a, b) { return ease((u - a) / (b - a)); }
    function cycle(t, phase) {
      const u = ((t + phase) / CYCLE) % 1;
      let out, hook, target = 'ground', load = false;
      if (u < 0.15) out = seg(u, 0, 0.15);
      else if (u < 0.62) out = 1;
      else if (u < 0.78) out = 1 - seg(u, 0.62, 0.78);
      else out = 0;
      if (u < 0.2) hook = 0.1;
      else if (u < 0.33) hook = 0.1 + 0.9 * seg(u, 0.2, 0.33);
      else if (u < 0.4) hook = 1;
      else if (u < 0.62) hook = 1 - 0.85 * seg(u, 0.4, 0.62);
      else if (u < 0.78) hook = 0.15;
      else if (u < 0.86) { hook = 0.15 + 0.85 * seg(u, 0.78, 0.86); target = 'deck'; }
      else if (u < 0.95) { hook = 1 - 0.9 * seg(u, 0.86, 0.95); target = 'deck'; }
      else { hook = 0.1; target = 'deck'; }
      load = u >= 0.36 && u < 0.84;
      return { out: out, hook: hook, target: target, load: load };
    }

    // one crane's line drawing at time t, in image pixels
    function L(a, b, c, d) { return 'M' + a.toFixed(1) + ' ' + b.toFixed(1) + 'L' + c.toFixed(1) + ' ' + d.toFixed(1); }
    function crane(j, k, t, p, curTop) {
      if (t < j.t0) return '';
      const c = j.c, x = k.x, dir = k.dir;
      let base = k.climb ? (p > 0 ? curTop : G) : G;             // climbing cranes ride on the deck
      let mastH = k.climb ? k.mast : (G - curTop) + k.mast;        // tied cranes stand on the ground
      let e = 1, cyc = cycle(t, k.phase);
      if (t < j.b0) { e = ease((t - j.t0) / SETUP); cyc = { out: 0, hook: 0.1, target: 'deck', load: false }; base = G; mastH = k.mast; }
      else if (t >= j.b1) {                                        // climb down the facade, jib pulled in
        const d = ease((t - j.b1) / TEARDOWN);
        cyc = { out: 0, hook: 0.1, target: 'deck', load: false };
        if (k.climb) base = curTop + d * (G - curTop); else mastH = mastH * (1 - d);
        if (k.climb) e = 1 - Math.max(0, (d - 0.8) / 0.2); else e = 1;
      }
      if (e <= 0 || mastH <= 0) return '';
      const top = base - mastH * e, mw = 5, half = mw / 2;
      let d = L(x - half, base, x - half, top) + L(x + half, base, x + half, top);
      for (let y = base - 7; y > top + 3; y -= 7) d += L(x - half, y, x + half, y - 7) + L(x + half, y, x - half, y - 7);
      if (!k.climb) for (let y = base - 30; y > Math.max(curTop, top) + 10; y -= 30) d += L(x - half, y, c.x1, y);   // ties to the shaft
      if (e < 0.6) return d;
      const ty = top - 1, cabX = x + half * dir;
      d += L(cabX, ty + 2, cabX + 3 * dir, ty + 2) + L(cabX + 3 * dir, ty + 2, cabX + 3 * dir, ty + 6) + L(cabX + 3 * dir, ty + 6, cabX, ty + 6);   // cab
      let hookX, hookTopY, apex = ty - 7;
      if (k.kind === 'hammer') {
        const jl = JIB_M * m * (0.45 + 0.55 * cyc.out) * dir, cl = -jl * 0.35;
        d += L(x - half, ty, x + jl, ty) + L(x + half, ty + 2.5, x + jl * 0.97, ty + 2.5);
        const n = Math.max(2, Math.floor(Math.abs(jl) / 6));
        for (let i = 0; i < n; i++) d += L(x + jl * i / n, ty + 2.5, x + jl * (i + 1) / n, ty);
        d += L(x + half, ty, x + cl, ty) + L(x + half, ty + 2.5, x + cl, ty + 2.5) + L(x + cl, ty, x + cl, ty + 7) + L(x + cl, ty + 7, x + cl + 3 * dir, ty + 7) + L(x + cl + 3 * dir, ty + 7, x + cl + 3 * dir, ty + 2.5);
        d += L(x - half, ty, x, apex) + L(x + half, ty, x, apex) + L(x, apex, x + jl * 0.95, ty) + L(x, apex, x + cl, ty);
        hookX = x + jl * 0.8; hookTopY = ty + 2.5;
      } else {
        const ang = (62 - 34 * cyc.out) * Math.PI / 180, lj = LUFF_M * m;
        const tipX = x + Math.cos(ang) * lj * dir, tipY = ty - Math.sin(ang) * lj;
        d += L(x - half, ty, tipX, tipY) + L(x + half, ty + 2, tipX, tipY) + L(x, apex, tipX, tipY);   // jib and pendant
        const cl = -lj * 0.22 * dir;
        d += L(x, ty, x + cl, ty) + L(x + cl, ty, x + cl, ty + 6) + L(x + cl, ty + 6, x + cl + 3 * dir, ty + 6) + L(x + cl + 3 * dir, ty + 6, x + cl + 3 * dir, ty);
        d += L(x - half, ty, x, apex) + L(x + half, ty, x, apex);
        hookX = tipX; hookTopY = tipY;
      }
      const targetY = cyc.target === 'ground' ? G - 3 : Math.max(curTop - 3, hookTopY + 6);
      const hookY = hookTopY + (targetY - hookTopY) * cyc.hook;
      d += L(hookX, hookTopY, hookX, hookY);
      if (cyc.load) d += L(hookX - 4, hookY, hookX + 4, hookY) + L(hookX - 4, hookY + 2, hookX + 4, hookY + 2) + L(hookX - 4, hookY, hookX - 4, hookY + 2) + L(hookX + 4, hookY, hookX + 4, hookY + 2);
      else d += L(hookX - 1.5, hookY, hookX + 1.5, hookY);
      return d;
    }
  }
})();

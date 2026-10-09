/* Hero frame: draws assets/senkon/hero-model.json as a slowly turning line model with three.js.
   Loads three.js and the builder only when the hero is visible and motion is allowed; otherwise
   the static hero.svg stays. One rotation per 40 s; paused off-screen and in hidden tabs. */
(function () {
  'use strict';
  const fig = document.getElementById('hero');
  if (!fig) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) return;
  if (!(function () { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { return false; } })()) return;

  const ROLES = { column: 'ink', rafter: 'accent', tie: 'ink', purlin: 'faint', brace: 'faint', windpost: 'ink' };
  const PERIOD = 40;   // seconds per rotation
  let started = false;

  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.defer = true; s.onload = res; s.onerror = () => rej(new Error(src)); document.head.appendChild(s); });
  }
  function colors() {
    const cs = getComputedStyle(document.documentElement);
    return { ink: cs.getPropertyValue('--ink').trim() || '#1d2b33', accent: cs.getPropertyValue('--accent').trim() || '#c47a5a', faint: cs.getPropertyValue('--rule').trim() || '#b9c2c7', ground: cs.getPropertyValue('--ground').trim() || '#ffffff' };
  }

  async function start() {
    if (started) return; started = true;
    try {
      const [model] = await Promise.all([
        fetch('assets/senkon/hero-model.json').then(r => { if (!r.ok) throw new Error('model'); return r.json(); }),
        loadScript('model/vendor/three.r128.min.js').then(() => loadScript('model/builder.js'))
      ]);
      run(model);
    } catch (e) { console.warn('hero fallback', e); }
  }

  function run(model) {
    const built = SenkonBuilder.build(model);
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Beş açıklıklı çelik çerçevenin dönen çizgi modeli');
    const stat = document.getElementById('heroStatic');
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(22, 1, 0.1, 500);
    const pivot = new THREE.Group(); scene.add(pivot);
    const inner = new THREE.Group(); pivot.add(inner);
    const groups = {}, lines = {};
    let c = colors();
    ['ink', 'accent', 'faint'].forEach(k => { groups[k] = []; });
    built.items.forEach(it => {
      if ((it.kind !== 'bar' && it.kind !== 'rod') || !ROLES[it.role]) return;
      groups[ROLES[it.role]].push(it.a[0], it.a[2], it.a[1], it.b[0], it.b[2], it.b[1]);   // plan [x,y,z] -> scene (x, z, y)
    });
    Object.keys(groups).forEach(k => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(groups[k], 3));
      const m = new THREE.LineBasicMaterial({ color: new THREE.Color(c[k]), transparent: k === 'faint', opacity: k === 'faint' ? 0.7 : 1 });
      lines[k] = new THREE.LineSegments(g, m); inner.add(lines[k]);
    });
    // centre the frame on the pivot so it turns about its own middle
    const box = new THREE.Box3().setFromObject(inner), ctr = new THREE.Vector3(); box.getCenter(ctr); inner.position.sub(ctr);
    const dims = box.getSize(new THREE.Vector3()), size = dims.length();
    const rxz = Math.hypot(dims.x, dims.z) / 2, rv = dims.y / 2 + rxz * 0.4;   // turning-circle radius and vertical reach
    const dir = new THREE.Vector3(0, 0.42, 1.15).normalize();
    // back the camera off until the whole turning frame fits the figure at any angle, tall or wide
    function place() {
      const vh = THREE.MathUtils.degToRad(cam.fov) / 2, hh = Math.atan(Math.tan(vh) * cam.aspect);
      cam.position.copy(dir).multiplyScalar(Math.max(rxz / Math.sin(hh), rv / Math.sin(vh)) * 1.04);
      cam.lookAt(0, 0, 0);
    }
    place();
    pivot.rotation.x = 0.0;

    fig.appendChild(canvas); fig.dataset.live = '1';
    if (stat) stat.setAttribute('aria-hidden', 'true');
    function resize() { const w = fig.clientWidth, h = fig.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); place(); }
    resize(); window.addEventListener('resize', resize);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { c = colors(); Object.keys(lines).forEach(k => lines[k].material.color.set(c[k])); });

    let visible = true, last = performance.now(), angle = -0.6, raf = 0;
    function frame(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      angle += dt * Math.PI * 2 / PERIOD; pivot.rotation.y = angle;
      renderer.render(scene, cam);
      raf = requestAnimationFrame(frame);
    }
    function wake() { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    new IntersectionObserver(es => { visible = es[0].isIntersecting; wake(); }, { threshold: 0.05 }).observe(fig);
    document.addEventListener('visibilitychange', wake);
    reduce.addEventListener('change', () => { if (reduce.matches) { visible = false; fig.dataset.live = ''; if (stat) stat.removeAttribute('aria-hidden'); } });
    wake();
  }

  // start when the hero is near the viewport, after first paint
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1500 }); else setTimeout(start, 300); } }, { rootMargin: '200px' });
  io.observe(fig);
})();

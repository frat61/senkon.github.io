/* SenkonViewer: three.js renderer and interaction for SenkonBuilder output.
   Global: SenkonViewer.mount(container, model, opts) -> handle (spec section 5).
   Needs THREE r128 and SenkonBuilder loaded first. Plan [x, y, z] maps to scene (x, z, y):
   three.js Y is up, so plan z becomes Y and plan y (south) becomes Z. */
(function (root) {
  'use strict';

  const BAR_COLORS = { steel: 0x2f363d, raf: 0xb3261e, tie: 0x0b7f93, brace: 0x1557b0, pur: 0x9aa1a9, door: 0xe08a00, fix: 0xd6a500,
    floorBeam: 0x6a4c93, al: 0x59626b, fr: 0x232b33, step: 0x8d949b, ridgeCap: 0x8a939c, gutter: 0x3d6f8a };

  function makeMaterials() {
    const M = {};
    Object.keys(BAR_COLORS).forEach(k => { M[k] = new THREE.MeshStandardMaterial({ color: BAR_COLORS[k], roughness: 0.6, metalness: 0.25 }); });
    M.slab = new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.95 });
    M.leaf = new THREE.MeshStandardMaterial({ color: 0x2f4654, transparent: true, opacity: 0.72, roughness: 0.1, metalness: 0.4 });
    M.wallFace = new THREE.MeshBasicMaterial({ color: 0xc3ccd5, transparent: true, opacity: 0.30, side: THREE.DoubleSide, depthWrite: false });
    M.wallEdge = new THREE.LineBasicMaterial({ color: 0x7d8791 });
    M.glassPane = new THREE.MeshStandardMaterial({ color: 0x6fb4cf, transparent: true, opacity: 0.36, roughness: 0.05, metalness: 0.35, side: THREE.DoubleSide, depthWrite: false });
    M.clad = new THREE.MeshStandardMaterial({ color: 0xe6e9ec, roughness: 0.8, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
    M.cladLine = new THREE.LineBasicMaterial({ color: 0x8a939c });
    M.skin = new THREE.MeshStandardMaterial({ color: 0xd3d8dd, roughness: 0.7, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
    M.deck = new THREE.MeshStandardMaterial({ color: 0x8d99a6, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
    M.dimLine = new THREE.LineBasicMaterial({ color: 0x3b4651 });
    M.meas = new THREE.MeshBasicMaterial({ color: 0xd81b60, depthTest: false });
    M.measLine = new THREE.LineBasicMaterial({ color: 0xd81b60, depthTest: false });
    return M;
  }

  const V = p => new THREE.Vector3(p[0], p[2], p[1]);
  function swapYZ(flat) {
    const o = new Array(flat.length);
    for (let i = 0; i < flat.length; i += 3) { o[i] = flat[i]; o[i + 1] = flat[i + 2]; o[i + 2] = flat[i + 1]; }
    return o;
  }

  function mount(container, model, opts) {
    opts = opts || {};
    if (typeof SenkonBuilder === 'undefined' || typeof THREE === 'undefined') throw new Error('SenkonBuilder and THREE must be loaded first');

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const canvas = renderer.domElement; canvas.style.touchAction = 'none'; container.appendChild(canvas);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, 1, 0.1, 4000);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a9099, 0.85); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 0.55); sun.position.set(-20, 40, 30); scene.add(sun);
    const M = makeMaterials();
    const rootG = new THREE.Group(), measG = new THREE.Group(), siteG = new THREE.Group(); scene.add(rootG, measG, siteG);

    // state
    const G = {}, tags = [], layerState = {}, measureCbs = [];
    let built = null, snaps = [], shotMode = false, tagMul = 1, measuring = false, mPts = [];
    const tgt = new THREE.Vector3(); let az = -0.62, el = 0.5, dist = 58;

    // ---- theme: clear colour follows the page's --bg variable
    const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    function applyTheme() { renderer.setClearColor(new THREE.Color(css('--bg') || '#e9ecef'), 1); }
    const mq = matchMedia('(prefers-color-scheme: dark)'), onTheme = () => { applyTheme(); draw(); };
    mq.addEventListener('change', onTheme);
    const mo = new MutationObserver(onTheme); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // ---- sprites
    function makeTag(t, p, col, k) {
      const c = document.createElement('canvas'), ctx = c.getContext('2d'); ctx.font = '600 44px Arial';
      const w = Math.ceil(ctx.measureText(t).width) + 36; c.width = w; c.height = 64; ctx.font = '600 44px Arial';
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, 64); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.strokeRect(2, 2, w - 4, 60);
      ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, w / 2, 35);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, sizeAttenuation: false }));
      sp.userData.ar = w / 64; sp.userData.k = k || 1; sp.position.copy(p); sp.renderOrder = 10; tags.push(sp); return sp;
    }
    function makeBubble(t, p) {
      const c = document.createElement('canvas'); c.width = c.height = 128; const k = c.getContext('2d');
      k.beginPath(); k.arc(64, 64, 54, 0, 7); k.fillStyle = '#fff'; k.fill(); k.lineWidth = 8; k.strokeStyle = '#b3261e'; k.stroke();
      k.fillStyle = '#b3261e'; k.font = '700 68px Arial'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText(t, 64, 70);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
      s.scale.set(1.5, 1.5, 1); s.position.copy(p); return s;
    }

    // ---- builder items -> three.js objects
    function toObject(it) {
      const mat = M[it.mat];
      switch (it.kind) {
        case 'bar': case 'rod': {
          const a = V(it.a), b = V(it.b), len = a.distanceTo(b);
          if (len < 1e-6) return null;
          let g;
          if (it.kind === 'bar') g = new THREE.BoxGeometry(it.w, it.h, len);
          else { g = new THREE.CylinderGeometry(it.r, it.r, len, 10); g.rotateX(Math.PI / 2); }
          const o = new THREE.Mesh(g, mat); o.position.copy(a).add(b).multiplyScalar(0.5); o.lookAt(b); return o;
        }
        case 'box': {
          const o = new THREE.Mesh(new THREE.BoxGeometry(it.size[0], it.size[2], it.size[1]), mat);
          o.position.set(it.center[0], it.center[2], it.center[1]); return o;
        }
        case 'tris': {
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(swapYZ(it.pos), 3));
          g.computeVertexNormals(); return new THREE.Mesh(g, mat);
        }
        case 'lines': {
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(swapYZ(it.pos), 3));
          return new THREE.LineSegments(g, mat);
        }
        case 'tag': return makeTag(it.text, V(it.p), it.color, it.k);
        case 'bubble': return makeBubble(it.text, V(it.p));
      }
      return null;
    }
    function clear() {
      rootG.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) { o.material.map.dispose(); o.material.dispose(); } });
      while (rootG.children.length) rootG.remove(rootG.children[0]);
      Object.keys(G).forEach(k => delete G[k]); tags.length = 0; clearMeas();
    }
    function build(m) {
      clear();
      built = SenkonBuilder.build(m); snaps = built.snaps.map(V);
      built.layers.forEach(l => {
        const g = new THREE.Group(); g.name = l.key;
        g.visible = l.key in layerState ? layerState[l.key] : l.visible !== false;
        G[l.key] = g; rootG.add(g);
      });
      built.items.forEach(it => { const g = G[it.layer] || G.steel; const o = toObject(it); if (o && g) g.add(o); });
      tgt.set(built.center[0], 2.6, built.center[1]);
      fitTags();
    }

    // ---- camera: simple orbit around tgt
    const compact = () => opts.compact !== undefined ? opts.compact : window.innerWidth < 640;
    function views() {
      const s = built ? built.size : 35;
      return { iso: [-0.62, 0.5, s * (compact() ? 3.2 : 1.65)], west: [-1.45, 0.3, s * 1.48], south: [0, 0.3, s * 1.6], top: [0, 1.5, s * 1.77] };
    }
    function place() {
      const s = built ? built.size : 35;
      el = Math.max(0.03, Math.min(1.55, el)); dist = Math.max(8, Math.min(140 * s / 35, dist));
      cam.position.set(tgt.x + dist * Math.cos(el) * Math.sin(az), tgt.y + dist * Math.sin(el), tgt.z + dist * Math.cos(el) * Math.cos(az));
      cam.lookAt(tgt);
    }
    function draw() { place(); renderer.render(scene, cam); }
    function fitTags() {
      const w = container.clientWidth || 1, h = container.clientHeight || 1, th = (w < 640 ? 13 : 17) / h * tagMul;
      tags.forEach(t => t.scale.set(th * t.userData.ar * t.userData.k, th * t.userData.k, 1));
    }
    function resize() {
      const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 58 : 38;
      if (w > 900 && !shotMode) cam.setViewOffset(w, h, opts.offsetX !== undefined ? opts.offsetX : -150, 0, w, h); else cam.clearViewOffset();
      cam.updateProjectionMatrix(); fitTags(); draw();
    }
    function setView(name) {
      const vw = views()[name] || views().iso; az = vw[0]; el = vw[1]; dist = vw[2];
      if (built) tgt.set(built.center[0], 2.6, built.center[1]); draw();
    }

    // ---- measuring: tap two points, snap to column bases, tops and levels
    function shown(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
    function emit(r) { measureCbs.forEach(f => f(r)); }
    function clearMeas() { mPts = []; while (measG.children.length) { const c = measG.children.pop(); const i = tags.indexOf(c); if (i >= 0) tags.splice(i, 1); } }
    function pickAt(cx, cy) {
      const r = canvas.getBoundingClientRect(), rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1), cam);
      const list = []; rootG.traverse(o => { if (o.isMesh && !o.material.transparent && shown(o)) list.push(o); });
      const hit = rc.intersectObjects(list, false)[0]; if (!hit) return;
      let p = hit.point.clone(), best = 0.8; snaps.forEach(q => { const d = q.distanceTo(hit.point); if (d < best) { best = d; p = q.clone(); } });
      if (mPts.length === 2) clearMeas();
      mPts.push(p); const mk = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), M.meas); mk.position.copy(p); mk.renderOrder = 9; measG.add(mk);
      if (mPts.length === 2) {
        const a = mPts[0], b = mPts[1], d = a.distanceTo(b), hz = Math.hypot(a.x - b.x, a.z - b.z), vt = Math.abs(a.y - b.y);
        measG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), M.measLine));
        measG.add(makeTag(d.toFixed(2) + ' m', a.clone().add(b).multiplyScalar(0.5), '#d81b60', 1)); fitTags();
        emit({ d: d, hz: hz, vt: vt });
      } else emit({ pending: true });
      draw();
    }
    function setMeasuring(on) { measuring = !!on; clearMeas(); canvas.style.cursor = measuring ? 'crosshair' : ''; emit(null); draw(); }

    // ---- pointer input: drag rotates, right drag or shift pans, wheel zooms, two fingers pinch and pan
    const ptr = new Map(); let pinch = 0;
    const onCtx = e => e.preventDefault();
    const onDown = e => { canvas.setPointerCapture(e.pointerId); ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, sx: e.clientX, sy: e.clientY }); };
    const onUp = e => { const p = ptr.get(e.pointerId); ptr.delete(e.pointerId); pinch = 0;
      if (measuring && p && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 7) pickAt(e.clientX, e.clientY); };
    const onCancel = e => { ptr.delete(e.pointerId); pinch = 0; };
    const onMove = e => { const p = ptr.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
      if (ptr.size === 2) { const v = Array.from(ptr.values()), d = Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y); if (pinch) dist *= pinch / d; pinch = d;
        const s = dist * 0.0006; tgt.addScaledVector(right, -dx * s); tgt.y += dy * s; }
      else if (p.b === 2 || e.shiftKey) { const s = dist * 0.0012; tgt.addScaledVector(right, -dx * s); tgt.y += dy * s; }
      else { az -= dx * 0.006; el += dy * 0.005; }
      draw(); };
    const onWheel = e => { e.preventDefault(); dist *= Math.exp(e.deltaY * 0.0012); draw(); };
    canvas.addEventListener('contextmenu', onCtx); canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel); canvas.addEventListener('pointermove', onMove); canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', resize);

    // ---- still renders: window.__shot({layers:{...}, opaque:true, view:[az,el,dist], tgt:[x,y,z], fov, tagScale})
    function shot(o) {
      o = o || {}; shotMode = true;
      Object.keys(o.layers || {}).forEach(k => { if (G[k]) G[k].visible = !!o.layers[k]; });
      if (o.opaque) {
        [[M.clad, 0xe4e8ec], [M.skin, 0xc2c9d0]].forEach(([mm, col]) => { mm.transparent = false; mm.opacity = 1; mm.depthWrite = true; mm.color.set(col); mm.needsUpdate = true; });
        M.glassPane.opacity = 0.5; M.glassPane.color.set(0x4f8fae); M.door.color.set(0x3a4149);
        scene.background = new THREE.Color(0xcfdde9); hemi.intensity = 0.68;
        scene.traverse(x => { if (x.isMesh && x.material === M.fix) x.visible = false; });
        const c = built.center, ol = built.model.outline;
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: 0xb3b9ab, roughness: 1 }));
        ground.rotation.x = -Math.PI / 2; ground.position.set(c[0], -0.13, c[1]); siteG.add(ground);
        const apron = new THREE.Mesh(new THREE.BoxGeometry(ol.x + 6, 0.05, ol.y + 6), new THREE.MeshStandardMaterial({ color: 0xa3a8ad, roughness: 1 }));
        apron.position.set(c[0], -0.1, c[1]); siteG.add(apron);
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        sun.position.set(-18, 34, 46); sun.intensity = 0.62; sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
        const sc = sun.shadow.camera, r = built.size * 1.3; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 1; sc.far = 160; sc.updateProjectionMatrix();
        sun.target.position.set(c[0], 0, c[1]); scene.add(sun.target); sun.shadow.bias = -0.0006;
        scene.traverse(x => { if (x.isMesh) { x.castShadow = !x.material.transparent; x.receiveShadow = true; } });
      }
      if (o.view) { az = o.view[0]; el = o.view[1]; dist = o.view[2]; }
      if (o.tgt) tgt.set(o.tgt[0], o.tgt[1], o.tgt[2]);
      resize();
      if (o.tagScale) { tagMul = o.tagScale; fitTags(); }
      if (o.fov) { cam.fov = o.fov; cam.updateProjectionMatrix(); }
      draw();
    }

    function dispose() {
      window.removeEventListener('resize', resize); mq.removeEventListener('change', onTheme); mo.disconnect();
      canvas.removeEventListener('contextmenu', onCtx); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('wheel', onWheel);
      clear(); renderer.dispose(); if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    build(model); setView('iso'); applyTheme(); resize();

    return {
      get layers() { return built ? built.layers.map(l => ({ key: l.key, label: l.label, button: l.button, visible: G[l.key] ? G[l.key].visible : false })) : []; },
      setLayer(key, on) { const g = G[key]; if (!g) return false; g.visible = !!on; layerState[key] = g.visible; draw(); return g.visible; },
      setView: setView,
      setMeasuring: setMeasuring,
      onMeasure(fn) { measureCbs.push(fn); },
      rebuild(m) { build(m); draw(); },
      resize: resize,
      shot: shot,
      draw: draw,
      dispose: dispose,
      built: () => built
    };
  }

  root.SenkonViewer = { mount: mount };
})(window);

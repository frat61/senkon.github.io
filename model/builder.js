/* SenkonBuilder: pure geometry builder for SENKON parametric models (format v1).
   Input: a model data object (docs/superpowers/specs/2026-10-08-model-viewer-design.md, section 6).
   Output: plain JS objects only; no three.js, no DOM. All coordinates are plan coordinates
   [x east, y south, z up] in metres. The viewer turns these items into three.js objects. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SenkonBuilder = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = 1;
  const SIDES = ['north', 'east', 'south', 'west'];
  const DEFAULTS = {
    interiorRows: [],
    levels: { ceiling: 4.0, deck: 4.45, eave: 5.75, ridge: 6.3 },
    roof: { type: 'gable', ridgeAxisY: 1, purlinBays: 14 },
    frame: { type: 'beams', column: 0.25, fixedBases: true },
    deck: { enabled: true, secondarySpacing: 2.2 },
    facades: { north: 'panel', east: 'panel', west: 'panel', south: 'panel' },
    claddingOffset: 0.16,
    glassModule: 1.2,
    windPosts: { west: [], east: [] },
    entrance: null,
    walls: [], doors: [], rooms: [], labels: [],
    source: ''
  };
  // Layer catalogue. button:false layers are always visible and get no switch in the page.
  const LAYERS = [
    { key: 'base',  label: 'Zemin',            visible: true,  button: false },
    { key: 'steel', label: 'Çelik',            visible: true,  button: false },
    { key: 'raf',   label: 'Çatı kirişleri',   visible: true,  button: false },
    { key: 'doors', label: 'Kapılar',          visible: true,  button: false },
    { key: 'axes',  label: 'Akslar',           visible: true,  button: false },
    { key: 'clad',  label: 'Paneller',         visible: true,  button: true },
    { key: 'skin',  label: 'Çatı kaplaması',   visible: true,  button: true },
    { key: 'walls', label: 'İç duvarlar',      visible: true,  button: true },
    { key: 'floor', label: 'Döşeme kirişleri', visible: true,  button: true },
    { key: 'deck',  label: 'Döşeme',           visible: true,  button: true },
    { key: 'roof',  label: 'Aşıklar',          visible: true,  button: true },
    { key: 'glass', label: 'Cam cephe',        visible: true,  button: true },
    { key: 'rb',    label: 'Çatı çaprazları',  visible: true,  button: true },
    { key: 'dim',   label: 'Ölçüler',          visible: true,  button: true },
    { key: 'rooms', label: 'Mahal adları',     visible: false, button: true }
  ];

  function normalize(model) {
    if (!model || typeof model !== 'object') throw new Error('model missing');
    if ((model.v || 1) > VERSION) throw new Error('unsupported model version ' + model.v);
    const ax = model.axes;
    if (!ax || !Array.isArray(ax.x) || ax.x.length < 2 || !Array.isArray(ax.y) || ax.y.length < 2) throw new Error('axes missing: need at least two x and two y axes');
    const m = { v: VERSION };
    Object.keys(DEFAULTS).forEach(k => {
      const d = DEFAULTS[k], given = model[k];
      if (d && typeof d === 'object' && !Array.isArray(d)) m[k] = Object.assign({}, d, given || {});
      else m[k] = given !== undefined && given !== null ? given : d;
    });
    m.axes = { x: ax.x.map(Number).sort((a, b) => a - b), y: ax.y.map(Number).sort((a, b) => a - b) };
    const nx = m.axes.x.length - 1, ny = m.axes.y.length - 1;
    m.outline = Object.assign({ x: +(m.axes.x[nx] + 0.1).toFixed(3), y: +(m.axes.y[ny] + 0.1).toFixed(3) }, model.outline || {});
    m.interiorRows = (m.interiorRows || []).map(Number).filter(i => i > 0 && i < ny);
    return m;
  }

  // y position of the ridge (gable) or valley (butterfly). Falls back to mid-span when the
  // ridge axis index is not an interior row.
  function ridgeY(m) {
    const ys = m.axes.y, ny = ys.length - 1, k = m.roof.ridgeAxisY;
    return (k >= 1 && k <= ny - 1) ? ys[k] : (ys[0] + ys[ny]) / 2;
  }

  // Roof height at plan position y (top of steel). The only place that depends on roof.type.
  function roofProfile(m) {
    const ys = m.axes.y, ny = ys.length - 1, L = m.levels;
    if (m.roof.type === 'mono') return y => L.eave + (L.ridge - L.eave) * (y - ys[0]) / (ys[ny] - ys[0]);
    const yr = ridgeY(m);
    return y => y <= yr ? L.eave + (L.ridge - L.eave) * (y - ys[0]) / (yr - ys[0])
                        : L.eave + (L.ridge - L.eave) * (ys[ny] - y) / (ys[ny] - yr);
  }

  // Named roof levels for the dimension tags: [[y, z, name], ...]
  function levelTags(m, zt) {
    const ys = m.axes.y, ny = ys.length - 1, L = m.levels;
    if (m.roof.type === 'mono') {
      const lo = L.eave <= L.ridge ? ys[0] : ys[ny], hi = lo === ys[0] ? ys[ny] : ys[0];
      return [[lo, zt(lo), 'saçak'], [hi, zt(hi), 'üst saçak']];
    }
    const yr = ridgeY(m);
    return [[ys[ny], zt(ys[ny]), 'saçak'], [yr, zt(yr), m.roof.type === 'butterfly' ? 'dere' : 'mahya']];
  }

  const quad = (a, b, c, d) => [].concat(a, b, c, a, c, d);

  const PARTS = [];  // sub-builders (frame, floor, envelope, architecture, annotations), each called with the context

  function build(model) {
    const m = normalize(model);
    const xs = m.axes.x, ys = m.axes.y, nx = xs.length - 1, ny = ys.length - 1;
    const L = m.levels, zt = roofProfile(m), yr = ridgeY(m);
    const items = [], snaps = [];
    const add = (layer, it) => { it.layer = layer; items.push(it); return it; };
    const ctx = {
      m, xs, ys, nx, ny, L, zt, yr, items, snaps, quad, SIDES,
      bar: (layer, role, a, b, w, h, mat) => add(layer, { kind: 'bar', role, a, b, w, h, mat }),
      rod: (layer, role, a, b, r, mat) => add(layer, { kind: 'rod', role, a, b, r, mat }),
      box: (layer, role, center, size, mat) => add(layer, { kind: 'box', role, center, size, mat }),
      tris: (layer, role, pos, mat) => add(layer, { kind: 'tris', role, pos, mat }),
      lines: (layer, role, pos, mat) => add(layer, { kind: 'lines', role, pos, mat }),
      tag: (layer, role, text, p, color, k) => add(layer, { kind: 'tag', role, text, p, color, k: k || 1 }),
      bubble: (text, p) => add('axes', { kind: 'bubble', role: 'axis', text, p })
    };
    PARTS.forEach(f => f(ctx));
    const anyGlass = SIDES.some(s => m.facades[s] === 'glass'), anyPanel = SIDES.some(s => m.facades[s] === 'panel');
    const keep = { floor: m.deck.enabled, deck: m.deck.enabled, glass: anyGlass, clad: anyPanel,
      walls: m.walls.length > 0, rooms: m.rooms.length + m.labels.length > 0 };
    const layers = LAYERS.filter(l => keep[l.key] !== false).map(l => Object.assign({}, l));
    return {
      v: VERSION, items, snaps, layers,
      center: [m.outline.x / 2, m.outline.y / 2], size: Math.max(m.outline.x, m.outline.y),
      levels: { ceiling: L.ceiling, deck: L.deck, eave: L.eave, ridge: L.ridge },
      model: m
    };
  }

  return { VERSION, LAYERS, DEFAULTS, normalize, ridgeY, roofProfile, levelTags, quad, build, parts: PARTS };
});

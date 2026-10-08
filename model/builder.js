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

  // y positions where the roof profile changes slope strictly between a and b: the ridge or
  // valley of a gable or butterfly roof. Mono roofs have none.
  function roofKinks(m, a, b) {
    if (m.roof.type === 'mono') return [];
    const yr = ridgeY(m);
    return yr > a && yr < b ? [yr] : [];
  }

  const quad = (a, b, c, d) => [].concat(a, b, c, a, c, d);

  // ---- primary steel: columns, rafters or trusses, eave and ridge beams
  function buildFrame(c) {
    const { m, xs, ys, nx, ny, L, zt, bar, snaps } = c;
    const truss = m.frame.type === 'truss';
    const rows = truss ? [0, ny] : [0].concat(m.interiorRows, [ny]).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
    const cw = m.frame.column;
    c.box('base', 'slab', [m.outline.x / 2, m.outline.y / 2, -0.06], [m.outline.x + 1.2, m.outline.y + 1.2, 0.12], 'slab');
    xs.forEach(x => {
      rows.forEach(i => {
        const y = ys[i], top = zt(y);
        bar('steel', 'column', [x, y, 0], [x, y, top], cw, cw, 'steel');
        if (m.frame.fixedBases) bar('steel', 'base', [x, y, 0], [x, y, 0.06], 0.6, 0.6, 'fix');
        bar('raf', 'joint', [x, y, top - 0.36], [x, y, top + 0.02], 0.34, 0.34, 'fix');   // rigid joint zone
        [0, L.ceiling].concat(m.deck.enabled ? [L.deck] : [], [top]).forEach(z => snaps.push([x, y, z]));
      });
      if (!truss) {
        for (let k = 0; k < rows.length - 1; k++) {
          const pts = [ys[rows[k]]].concat(roofKinks(m, ys[rows[k]], ys[rows[k + 1]]), [ys[rows[k + 1]]]);
          for (let j = 0; j < pts.length - 1; j++)
            bar('raf', 'rafter', [x, pts[j], zt(pts[j]) - 0.135], [x, pts[j + 1], zt(pts[j + 1]) - 0.135], 0.135, 0.27, 'raf');
        }
      } else trussAt(c, x);
    });
    ys.forEach(y => bar('steel', 'tie', [xs[0], y, zt(y) - 0.2], [xs[nx], y, zt(y) - 0.2], 0.15, 0.3, 'tie'));
  }

  // Clear-span lattice truss on one x axis: level bottom chord at the deck level, top chord
  // along the roof, N-diagonals with posts at about 2.2 m, pinned on the two outer columns.
  function trussAt(c, x) {
    const { m, ys, ny, L, zt, bar } = c;
    const zb = m.deck.enabled ? L.deck : L.ceiling, top = y => zt(y) - 0.08;
    bar('raf', 'trussChord', [x, ys[0], zb], [x, ys[ny], zb], 0.14, 0.14, 'raf');
    const nodes = [];
    for (let i = 0; i < ny; i++) { nodes.push(ys[i]); nodes.push.apply(nodes, roofKinks(m, ys[i], ys[i + 1])); }
    nodes.push(ys[ny]);
    for (let i = 0; i < nodes.length - 1; i++) bar('raf', 'trussChord', [x, nodes[i], top(nodes[i])], [x, nodes[i + 1], top(nodes[i + 1])], 0.14, 0.14, 'raf');
    const pts = [nodes[0]];
    for (let i = 0; i < nodes.length - 1; i++) {
      const n = Math.max(2, Math.round((nodes[i + 1] - nodes[i]) / 2.2));
      for (let j = 1; j <= n; j++) pts.push(nodes[i] + (nodes[i + 1] - nodes[i]) * j / n);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (i % 2 === 0) bar('raf', 'trussDiag', [x, a, zb], [x, b, top(b)], 0.08, 0.08, 'raf');
      else bar('raf', 'trussDiag', [x, a, top(a)], [x, b, zb], 0.08, 0.08, 'raf');
      if (i > 0) bar('raf', 'trussPost', [x, a, zb], [x, a, top(a)], 0.06, 0.06, 'raf');
    }
    [ys[0], ys[ny]].forEach(y => bar('raf', 'joint', [x, y, zb - 0.12], [x, y, zb + 0.12], 0.34, 0.34, 'fix'));
  }

  // ---- mechanical floor: primary beams on the frames (beams type only), edge beams on every
  // row, secondaries at about deck.secondarySpacing, and the translucent deck plane
  function buildFloor(c) {
    const { m, xs, ys, nx, ny, L, bar, tris, quad } = c;
    if (!m.deck.enabled) return;
    const ZB = L.deck, beams = m.frame.type === 'beams';
    xs.forEach(x => {
      if (!beams) return;
      for (let i = 0; i < ny; i++) bar('floor', 'floorPrimary', [x, ys[i], ZB - 0.2], [x, ys[i + 1], ZB - 0.2], 0.18, 0.4, 'floorBeam');
      ys.forEach(y => bar('floor', 'floorJoint', [x, y, ZB - 0.5], [x, y, ZB + 0.05], 0.34, 0.34, 'fix'));
    });
    ys.forEach(y => bar('floor', 'floorEdge', [xs[0], y, ZB - 0.17], [xs[nx], y, ZB - 0.17], 0.16, 0.33, 'floorBeam'));
    for (let i = 0; i < ny; i++) {
      const n = Math.max(1, Math.round((ys[i + 1] - ys[i]) / m.deck.secondarySpacing));
      for (let j = 1; j < n; j++) {
        const y = ys[i] + (ys[i + 1] - ys[i]) * j / n;
        bar('floor', 'floorSecondary', [xs[0], y, ZB - 0.12], [xs[nx], y, ZB - 0.12], 0.1, 0.24, 'floorBeam');
      }
    }
    const z = ZB + 0.03;
    tris('deck', 'deck', quad([xs[0], ys[0], z], [xs[nx], ys[0], z], [xs[nx], ys[ny], z], [xs[0], ys[ny], z]), 'deck');
  }

  // ---- fixed dimensions, level tags and axis bubbles
  function buildAnnotations(c) {
    const { m, xs, ys, nx, ny, L, zt, tag, lines, bubble } = c;
    const pts = [], DC = '#3b4651', h = 0.05, f2 = v => v.toFixed(2);
    const seg = (a, b) => pts.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    // bays and total along the south side
    const y1 = ys[ny] + 1.0, y2 = ys[ny] + 3.2;
    seg([xs[0], y1, h], [xs[nx], y1, h]); xs.forEach(x => seg([x, y1 - 0.3, h], [x, y1 + 0.3, h]));
    for (let i = 0; i < nx; i++) tag('dim', 'bay', f2(xs[i + 1] - xs[i]), [(xs[i] + xs[i + 1]) / 2, y1, h], DC);
    seg([xs[0], y2, h], [xs[nx], y2, h]); [xs[0], xs[nx]].forEach(x => seg([x, y2 - 0.3, h], [x, y2 + 0.3, h]));
    tag('dim', 'total', f2(xs[nx] - xs[0]) + ' m', [(xs[0] + xs[nx]) / 2, y2, h], DC);
    // spans and total along the east side
    const x1 = xs[nx] + 1.0, x2 = xs[nx] + 3.2;
    seg([x1, ys[0], h], [x1, ys[ny], h]); ys.forEach(y => seg([x1 - 0.3, y, h], [x1 + 0.3, y, h]));
    for (let j = 0; j < ny; j++) tag('dim', 'span', f2(ys[j + 1] - ys[j]), [x1, (ys[j] + ys[j + 1]) / 2, h], DC);
    seg([x2, ys[0], h], [x2, ys[ny], h]); [ys[0], ys[ny]].forEach(y => seg([x2 - 0.3, y, h], [x2 + 0.3, y, h]));
    tag('dim', 'total', f2(ys[ny] - ys[0]) + ' m', [x2, (ys[0] + ys[ny]) / 2, h], DC);
    // levels on the west gable
    const xl = xs[0] - 1.0, yl = ys[ny];
    seg([xl, yl, 0], [xl, yl, zt(yl)]); [0, L.ceiling, zt(yl)].forEach(z => seg([xl - 0.3, yl, z], [xl + 0.3, yl, z]));
    tag('dim', 'level', 'tavan +' + f2(L.ceiling), [xl, yl, L.ceiling - 0.25], DC);
    if (m.deck.enabled) tag('dim', 'level', 'mekanik kat +' + f2(L.deck), [xl, yl, L.deck + 0.25], DC);
    levelTags(m, zt).forEach(([y, z, name]) => {
      if (y !== yl) { seg([xl, y, 0], [xl, y, z]); [0, z].forEach(zz => seg([xl - 0.3, y, zz], [xl + 0.3, y, zz])); }
      tag('dim', 'level', name + ' +' + f2(z), [xl, y, z], DC);
    });
    lines('dim', 'dimLine', pts, 'dimLine');
    // axis bubbles: numbers along x, letters along y
    xs.forEach((x, i) => bubble(String(i + 1), [x, ys[ny] + 2.0, 0.2]));
    ys.forEach((y, j) => bubble('ABCDEFGHIJKLMNOPQRSTUVWXYZ'[j % 26], [xs[0] - 4.8, y, 0.2]));
  }

  // ---- facade helpers. A side frame maps (along, out, z) on a facade to plan coordinates;
  // "along" runs with x on north/south and with y on east/west, "out" points outwards.
  function sideFrame(m, side) {
    const xs = m.axes.x, ys = m.axes.y, nx = xs.length - 1, ny = ys.length - 1, o = m.claddingOffset;
    const x0 = xs[0] - o, x1 = xs[nx] + o, yN = ys[0] - o, yS = ys[ny] + o;
    switch (side) {
      case 'north': return { P: (a, out, z) => [a, yN - out, z], a0: x0, a1: x1, alongX: true };
      case 'south': return { P: (a, out, z) => [a, yS + out, z], a0: x0, a1: x1, alongX: true };
      case 'west':  return { P: (a, out, z) => [x0 - out, a, z], a0: yN, a1: yS, alongX: false };
      default:      return { P: (a, out, z) => [x1 + out, a, z], a0: yN, a1: yS, alongX: false };
    }
  }
  // Top edge of a facade as [[along, z], ...]. North/south are level at the eave of their row;
  // east/west follow the roof line through every y axis.
  function profile(m, side, zt, lift) {
    const f = sideFrame(m, side), ys = m.axes.y, ny = ys.length - 1;
    if (side === 'north') return [[f.a0, zt(ys[0]) + lift], [f.a1, zt(ys[0]) + lift]];
    if (side === 'south') return [[f.a0, zt(ys[ny]) + lift], [f.a1, zt(ys[ny]) + lift]];
    const p = [[f.a0, zt(ys[0]) + lift]];
    for (let i = 0; i < ny; i++) {
      roofKinks(m, ys[i], ys[i + 1]).forEach(y => p.push([y, zt(y) + lift]));
      if (i < ny - 1) p.push([ys[i + 1], zt(ys[i + 1]) + lift]);
    }
    p.push([f.a1, zt(ys[ny]) + lift]);
    return p;
  }
  function heightAt(prof, a) {
    if (a <= prof[0][0]) return prof[0][1];
    for (let i = 0; i < prof.length - 1; i++) {
      const [a0, h0] = prof[i], [a1, h1] = prof[i + 1];
      if (a <= a1) return a1 === a0 ? h1 : h0 + (h1 - h0) * (a - a0) / (a1 - a0);
    }
    return prof[prof.length - 1][1];
  }
  // Sub-profile between a0 and a1 (keeps the interior points in between).
  function clipProfile(prof, a0, a1) {
    const p = [[a0, heightAt(prof, a0)]];
    prof.forEach(([a, h]) => { if (a > a0 && a < a1) p.push([a, h]); });
    p.push([a1, heightAt(prof, a1)]);
    return p;
  }
  // Portions of a horizontal line at height z that lie under the profile: [[a0, a1], ...]
  function under(prof, z) {
    const out = [];
    for (let i = 0; i < prof.length - 1; i++) {
      const [a0, h0] = prof[i], [a1, h1] = prof[i + 1];
      if (h0 > z && h1 > z) out.push([a0, a1]);
      else if (h0 > z || h1 > z) { const ac = a0 + (a1 - a0) * (z - h0) / (h1 - h0); out.push(h0 > z ? [a0, ac] : [ac, a1]); }
    }
    const merged = [];
    out.forEach(s => { const last = merged[merged.length - 1]; if (last && Math.abs(last[1] - s[0]) < 1e-9) last[1] = s[1]; else merged.push(s.slice()); });
    return merged;
  }
  function facePos(P, prof, quad) {
    const pos = [];
    for (let i = 0; i < prof.length - 1; i++) {
      const [a0, h0] = prof[i], [a1, h1] = prof[i + 1];
      pos.push.apply(pos, quad(P(a0, 0, 0), P(a1, 0, 0), P(a1, 0, h1), P(a0, 0, h0)));
    }
    return pos;
  }

  // ---- envelope: cladding, glazing, entrance, roof skin, ridge cap and gutters, purlins,
  // gable wind posts, roof bracing
  function buildEnvelope(c) {
    const { m, xs, ys, nx, ny, L, zt, yr, bar, rod, box, tris, lines, quad } = c;
    const o = m.claddingOffset;
    SIDES.forEach(side => {
      const kind = m.facades[side];
      if (kind !== 'panel' && kind !== 'glass') return;
      const f = sideFrame(m, side);
      if (kind === 'panel') {
        const prof = profile(m, side, zt, 0.25);
        tris('clad', 'panel', facePos(f.P, prof, quad), 'clad');
        const ln = [], hmax = Math.max.apply(null, prof.map(p => p[1]));
        for (let z = 1; z < hmax; z += 1) under(prof, z).forEach(([a0, a1]) => ln.push.apply(ln, f.P(a0, 0, z).concat(f.P(a1, 0, z))));
        lines('clad', 'panelLine', ln, 'cladLine');
      } else {
        const gp = clipProfile(profile(m, side, zt, 0.10), f.a0 + 0.04, f.a1 - 0.04);
        tris('glass', 'glassPane', facePos(f.P, gp, quad), 'glassPane');
        const w = gp[gp.length - 1][0] - gp[0][0], n = Math.max(1, Math.round(w / m.glassModule));
        const e = m.entrance && m.entrance.side === side ? m.entrance : null, eh = e ? (e.height || 2.4) : 0;
        for (let i = 0; i <= n; i++) {
          const a = gp[0][0] + w * i / n, h = heightAt(gp, a);
          const inDoor = e && a > e.from - 0.05 && a < e.to + 0.05;
          bar('glass', 'mullion', f.P(a, 0, inDoor ? eh + 0.05 : 0), f.P(a, 0, h), 0.06, 0.12, 'al');
        }
        const hmax = Math.max.apply(null, gp.map(p => p[1]));
        [0.03, 2.6, L.ceiling + 0.15, hmax - 0.03].forEach(z => under(gp, z).forEach(([a0, a1]) => bar('glass', 'transom', f.P(a0, 0, z), f.P(a1, 0, z), 0.06, 0.1, 'al')));
      }
    });
    // entrance: frame, two leaves, canopy and step on the facade of entrance.side
    if (m.entrance && SIDES.indexOf(m.entrance.side) >= 0) {
      const e = m.entrance, f = sideFrame(m, e.side), eh = e.height || 2.4, mid = (e.from + e.to) / 2, out = 0.04;
      const sideBox = (role, a, outPos, z, along, depth, height, mat) =>
        box('doors', role, f.P(a, outPos, z), f.alongX ? [along, depth, height] : [depth, along, height], mat);
      [e.from, e.to].forEach(a => bar('doors', 'entranceFrame', f.P(a, out, 0), f.P(a, out, eh), 0.1, 0.16, 'fr'));
      bar('doors', 'entranceFrame', f.P(e.from, out, eh), f.P(e.to, out, eh), 0.16, 0.1, 'fr');
      bar('doors', 'entranceFrame', f.P(mid, out, 0), f.P(mid, out, eh), 0.05, 0.1, 'fr');
      [[e.from + 0.05, mid - 0.03], [mid + 0.03, e.to - 0.05]].forEach(([a, b]) => sideBox('leaf', (a + b) / 2, out, eh / 2, b - a, 0.05, eh - 0.1, 'leaf'));
      if (e.canopy !== false) {
        sideBox('canopy', mid, out + 0.75, eh + 0.22, e.to - e.from + 1.2, 1.5, 0.1, 'fr');
        sideBox('step', mid, out + 0.9, 0, e.to - e.from + 1.2, 1.5, 0.06, 'step');
      }
    }
    // roof skin: one strip per y bay, extended by the cladding offset at both ends
    (function () {
      const x0 = xs[0] - o, x1 = xs[nx] + o, t = 0.2, pos = [];
      const nodes = [];
      for (let i = 0; i < ny; i++) { nodes.push(ys[i]); nodes.push.apply(nodes, roofKinks(m, ys[i], ys[i + 1])); }
      nodes.push(ys[ny]);
      for (let i = 0; i < nodes.length - 1; i++) {
        const ya = i === 0 ? nodes[0] - o : nodes[i], yb = i === nodes.length - 2 ? nodes[nodes.length - 1] + o : nodes[i + 1];
        const za = zt(nodes[i]) + t, zb = zt(nodes[i + 1]) + t;
        pos.push.apply(pos, quad([x0, ya, za], [x1, ya, za], [x1, yb, zb], [x0, yb, zb]));
      }
      tris('skin', 'roofSkin', pos, 'skin');
    })();
    // ridge cap and gutters
    const gutter = (yAxis, y) => bar('steel', 'gutter', [xs[0] - 0.3, y, zt(yAxis) + 0.12], [xs[nx] + 0.3, y, zt(yAxis) + 0.12], 0.2, 0.14, 'gutter');
    if (m.roof.type === 'gable') {
      bar('steel', 'ridgeCap', [xs[0] - 0.3, yr, zt(yr) + 0.24], [xs[nx] + 0.3, yr, zt(yr) + 0.24], 0.5, 0.06, 'ridgeCap');
      gutter(ys[0], ys[0] - 0.3); gutter(ys[ny], ys[ny] + 0.3);
    } else if (m.roof.type === 'butterfly') gutter(yr, yr);
    else if (L.eave <= L.ridge) gutter(ys[0], ys[0] - 0.3); else gutter(ys[ny], ys[ny] + 0.3);
    // purlins
    const pb = Math.max(1, m.roof.purlinBays | 0);
    for (let i = 0; i <= pb; i++) { const y = ys[0] + (ys[ny] - ys[0]) * i / pb; bar('roof', 'purlin', [xs[0], y, zt(y) + 0.08], [xs[nx], y, zt(y) + 0.08], 0.05, 0.12, 'pur'); }
    // gable wind posts
    [[xs[0], m.windPosts.west || []], [xs[nx], m.windPosts.east || []]].forEach(([x, list]) =>
      list.forEach(y => bar('steel', 'windpost', [x, y, 0], [x, y, zt(y) - 0.36], 0.16, 0.16, 'brace')));
    // roof bracing in the end bays, crossing between mid-bay points
    const pts = [ys[0]];
    for (let i = 0; i < ny; i++) pts.push((ys[i] + ys[i + 1]) / 2, ys[i + 1]);
    const bays = nx >= 2 ? [[0, 1], [nx - 1, nx]] : [[0, 1]];
    bays.forEach(([i, j]) => { for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      rod('rb', 'brace', [xs[i], a, zt(a) - 0.05], [xs[j], b, zt(b) - 0.05], 0.025, 'brace');
      rod('rb', 'brace', [xs[i], b, zt(b) - 0.05], [xs[j], a, zt(a) - 0.05], 0.025, 'brace');
    } });
  }

  const PARTS = [];  // sub-builders (frame, floor, envelope, architecture, annotations), each called with the context
  PARTS.push(buildFrame, buildFloor, buildEnvelope, buildAnnotations);

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

// Draws the hero frame (assets/senkon/hero-model.json) as a static SVG with the same lines
// the three.js hero draws, so the page has an instant, no-JS, reduced-motion fallback.
// Usage: node tools/make-hero-svg.js   (writes assets/senkon/hero.svg)
'use strict';
const fs = require('fs'), path = require('path');
const B = require('../model/builder.js');

const ROLES = { column: 'ink', rafter: 'accent', tie: 'ink', purlin: 'faint', brace: 'faint', windpost: 'ink' };
const COLORS = { ink: '#1d2b33', accent: '#c47a5a', faint: '#b9c2c7' };
const WIDTHS = { ink: 1.6, accent: 2.2, faint: 1.1 };

// Member centre lines of the frame, plan coordinates [x, y, z].
function lines(model) {
  return B.build(model).items
    .filter(it => (it.kind === 'bar' || it.kind === 'rod') && ROLES[it.role])
    .map(it => ({ a: it.a, b: it.b, role: it.role }));
}
// Orthographic view: yaw about the vertical axis, then pitch (looking slightly down).
// Returns screen coordinates with y growing downwards; vertical lines stay vertical.
function project(points, view) {
  const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  return points.map(([x, y, z]) => {
    const rx = x * cy - y * sy, ry = x * sy + y * cy;        // rotate the plan
    return [rx, -(z * cp) + ry * sp];                          // tilt: depth lifts the far side
  });
}
function svg(model, opts) {
  opts = opts || {};
  const W = opts.width || 520, Hh = opts.height || 360, pad = opts.pad || 18;
  const view = { yaw: opts.yaw !== undefined ? opts.yaw : 0.6, pitch: opts.pitch !== undefined ? opts.pitch : 0.45 };
  const ls = lines(model);
  const pts = project(ls.flatMap(l => [l.a, l.b]), view);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const s = Math.min((W - 2 * pad) / (maxX - minX), (Hh - 2 * pad) / (maxY - minY));
  const ox = (W - (maxX - minX) * s) / 2 - minX * s, oy = (Hh - (maxY - minY) * s) / 2 - minY * s;
  const f = v => (Math.round(v * 100) / 100).toFixed(2);
  const groups = { faint: [], ink: [], accent: [] };
  ls.forEach((l, i) => {
    const a = pts[2 * i], b = pts[2 * i + 1];
    groups[ROLES[l.role]].push(`<line x1="${f(a[0] * s + ox)}" y1="${f(a[1] * s + oy)}" x2="${f(b[0] * s + ox)}" y2="${f(b[1] * s + oy)}"/>`);
  });
  const g = Object.keys(groups).map(k => `<g stroke="${COLORS[k]}" stroke-width="${WIDTHS[k]}" class="${k}">\n${groups[k].join('\n')}\n</g>`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" role="img" aria-label="Çelik çerçeve çizgi modeli" fill="none" stroke-linecap="round">\n${g}\n</svg>\n`;
}
module.exports = { ROLES, COLORS, WIDTHS, lines, project, svg };

if (require.main === module) {
  const model = JSON.parse(fs.readFileSync(path.join('assets', 'senkon', 'hero-model.json'), 'utf8'));
  fs.writeFileSync(path.join('assets', 'senkon', 'hero.svg'), svg(model, { width: 520, height: 360 }));
  console.log('assets/senkon/hero.svg written, ' + lines(model).length + ' lines');
}

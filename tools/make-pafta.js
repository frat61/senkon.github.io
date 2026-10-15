#!/usr/bin/env node
'use strict';
/* The sample sheet on /tasarim/ ("ÖRNEK PAFTA"): an A3 steel drawing made from the office's own hall model
   (assets/senkon/hal.json, members [x1,y1,z1, x2,y2,z2, w] in metres, Y up; see the top of tools/make-hall.js).
   The left of the sheet is one transverse frame of the hall drawn from the model at 1/500 with its axes, levels
   and two dimensions; the connection detail and the title block are hand-written fragments in tools/pafta/
   (sheet millimetres) placed as they are. Spec: docs/superpowers/specs/2026-10-15-tasarim-redesign-design.md §3.
     node tools/make-pafta.js          writes assets/senkon/ornek-pafta.svg
     node tools/make-pafta.js --list   prints the most populated member planes (constant z, then constant x)
   tests/pafta-svg.test.js checks the file is what build() writes. */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HALL = path.join(ROOT, 'assets', 'senkon', 'hal.json');
const OUT = path.join(ROOT, 'assets', 'senkon', 'ornek-pafta.svg');
const PIECES = path.join(__dirname, 'pafta');

/* The frame on the sheet. The hall's main frames are the constant-x planes x = 0, 10, … 100: each is two lattice
   towers 3 m wide (chords at z = −42.89/−39.89 and 50.11/53.11, ground y = −35) carrying the pitched roof truss
   that spans 93 m between the tower axes, ridge at z ≈ 5.1. x = 0 and x = 100 are the gable ends (more members:
   the gable wall), so the frame drawn is an interior one, x = 50 (axis 6), which has both towers and the whole
   truss. The constant-z planes are the long sections through the roof, not frames: `node tools/make-pafta.js
   --list` shows both. */
const FRAME = { axis: 'x', at: 50, name: '6' };

const IDX = { x: [0, 3], y: [1, 4], z: [2, 5] };   // member array positions of each coordinate
const ACROSS = { z: 0, x: 2 };                      // the horizontal coordinate of an elevation of that plane
const r3 = v => Math.round(v * 1000) / 1000;

// planes(members, axis = 'z') -> [{ z, count }]: members lying in one constant-`axis` plane, most members first
function planes(members, axis) {
  axis = axis || 'z';
  const [a, b] = IDX[axis], count = new Map();
  for (const m of members) {
    if (Math.abs(m[a] - m[b]) > 0.001) continue;
    const k = r3(m[a]);
    count.set(k, (count.get(k) || 0) + 1);
  }
  return [...count].sort((p, q) => q[1] - p[1] || p[0] - q[0]).map(([v, n]) => ({ [axis]: v, count: n }));
}

// elevation(members, at, axis = 'z') -> { lines: [[h1,y1,h2,y2,w]], box: [h0,y0,h1,y1] } in metres, y up;
// h is x for a constant-z plane and z for a constant-x plane (seen from −x, so z runs to the right)
function elevation(members, at, axis) {
  axis = axis || 'z';
  const [a, b] = IDX[axis], h = ACROSS[axis], lines = [];
  for (const m of members) {
    if (Math.abs(m[a] - at) > 0.005 || Math.abs(m[b] - at) > 0.005) continue;
    lines.push([m[h], m[1], m[h + 3], m[4], m[6]]);
  }
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [h1, y1, h2, y2] of lines) {
    box[0] = Math.min(box[0], h1, h2); box[1] = Math.min(box[1], y1, y2);
    box[2] = Math.max(box[2], h1, h2); box[3] = Math.max(box[3], y1, y2);
  }
  return { lines, box };
}

// ---- the sheet
const f = v => String(Math.round(v * 100) / 100);
const FONT = 'font-family="Work Sans, sans-serif"';
const MEMBER = 0.5, DIM = 0.25, THIN = 0.18, CENTRE = '6 2 1 2';

function text(x, y, s, size, extra) {
  return `<text x="${f(x)}" y="${f(y)}" font-size="${size}" fill="#000" stroke="none"${extra ? ' ' + extra : ''}>${s}</text>`;
}
const line = (x1, y1, x2, y2, w, extra) =>
  `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke-width="${w}"${extra ? ' ' + extra : ''}/>`;

// A dimension between two points along x (horizontal) or y (vertical), oblique ticks, text above / left
function dimension(x1, y1, x2, y2, label) {
  const out = [], t = 1.2;
  out.push(line(x1, y1, x2, y2, DIM));
  for (const [x, y] of [[x1, y1], [x2, y2]]) out.push(line(x - t, y + t, x + t, y - t, 0.35));
  if (y1 === y2) out.push(text((x1 + x2) / 2, y1 - 1, label, 2.5, 'text-anchor="middle"'));
  else {
    const cx = x1 - 1, cy = (y1 + y2) / 2;
    out.push(text(cx, cy, label, 2.5, `text-anchor="middle" transform="rotate(-90 ${f(cx)} ${f(cy)})"`));
  }
  return out.join('');
}

// A level mark: a short line, an open triangle standing on it, the level written beside
function level(x, y, label, toLeft) {
  const s = 1.6, tx = toLeft ? x - s - 0.8 : x + s + 0.8;
  return line(x - 4, y, x + 4, y, DIM) +
    `<path d="M${f(x)} ${f(y)}l${-s} ${f(-s * 1.5)}h${2 * s}z" fill="none" stroke-width="${DIM}"/>` +
    text(tx, y - 1.2, label, 2.5, toLeft ? 'text-anchor="end"' : '');
}

function bubble(x, y, label) {
  return `<circle cx="${f(x)}" cy="${f(y)}" r="4" fill="#fff" stroke-width="${DIM}"/>` +
    text(x, y + 1.25, label, 3.5, 'text-anchor="middle" font-weight="600"');
}

function frameElevation(members) {
  const { lines, box } = elevation(members, FRAME.at, FRAME.axis);
  const K = 2;                                          // 1/500: 1 m is 2 mm on the sheet
  const X0 = 34, Y0 = 32;                               // sheet position of the left end and the top of the frame
  const X = h => X0 + (h - box[0]) * K, Y = y => Y0 + (box[3] - y) * K;
  const ground = box[1];
  // the tower axes: midway between each tower's two chords (the long members standing on the ground)
  const legs = [...new Set(lines.filter(l => Math.min(l[1], l[3]) === ground && l[0] === l[2]).map(l => l[0]))].sort((a, b) => a - b);
  const axes = [(legs[0] + legs[1]) / 2, (legs[2] + legs[3]) / 2];
  const towerTop = Math.min(...lines.filter(l => l[0] === l[2] && legs.includes(l[0])).map(l => Math.max(l[1], l[3])));
  const chordAxis = 0;                                  // the truss bottom chord axis (its edges at ±0.403)
  const lv = y => (y - ground).toFixed(2);
  const out = [];

  // ground line with a short earth hatch
  const gy = Y(ground), gx0 = X(box[0]) - 6, gx1 = X(box[2]) + 6;
  out.push(line(gx0, gy, gx1, gy, DIM));
  for (let x = gx0 + 1; x < gx1; x += 2) out.push(line(x, gy + 1.6, x + 1.6, gy, THIN));

  // the members
  out.push(`<g stroke-width="${MEMBER}" stroke-linecap="round">` +
    lines.map(([h1, y1, h2, y2]) => `<line x1="${f(X(h1))}" y1="${f(Y(y1))}" x2="${f(X(h2))}" y2="${f(Y(y2))}"/>`).join('') + '</g>');

  // axes A and B with their bubbles, and the span between them
  const by = gy + 17;
  axes.forEach((h, i) => {
    out.push(line(X(h), Y(box[3]) - 4, X(h), by - 4, THIN, `stroke-dasharray="${CENTRE}"`));
    out.push(bubble(X(h), by, 'AB'[i]));
  });
  out.push(dimension(X(axes[0]), gy + 8, X(axes[1]), gy + 8, String(Math.round((axes[1] - axes[0]) * 1000))));

  // column height on the right of tower B
  const dx = X(box[2]) + 6;
  out.push(line(X(legs[3]) + 1, Y(towerTop), dx + 1.5, Y(towerTop), THIN));
  out.push(dimension(dx, gy, dx, Y(towerTop), String(Math.round((towerTop - ground) * 1000))));

  // levels on the left of tower A, the ridge level above the ridge
  const lx = X(box[0]) - 8;
  out.push(level(lx, gy, '±0.00', true));
  out.push(level(lx, Y(chordAxis), '+' + lv(chordAxis), true));
  out.push(level(lx, Y(towerTop), '+' + lv(towerTop), true));
  const ridge = lines.reduce((best, l) => (l[3] > best[1] ? [l[2], l[3]] : l[1] > best[1] ? [l[0], l[1]] : best), [0, -Infinity]);
  out.push(level(X(ridge[0]), Y(ridge[1]) - 1, '+' + lv(ridge[1]) + ' mahya', false));

  // detail 1: the head of tower A, where the truss chords meet the inner tower chord
  const cx = X(legs[1]) - 1, cy = Y(1.6);
  out.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="6.5" fill="none" stroke-width="${DIM}"/>`);
  const bx = cx + 13, by1 = Y0 - 3;
  out.push(line(cx + 4.6, cy - 4.6, bx - 2.8, by1 + 2.8, DIM));
  out.push(bubble(bx, by1, '1'));

  // the drawing's name under it
  const tx = (X(box[0]) + X(box[2])) / 2, ty = by + 15;
  out.push(text(tx, ty, `${FRAME.name} AKSI ÇERÇEVE GÖRÜNÜŞÜ · ÖLÇEK 1/500`, 3.5, 'text-anchor="middle" font-weight="600"'));
  out.push(line(tx - 38, ty + 1.2, tx + 38, ty + 1.2, DIM));
  return out.join('\n');
}

const NOTES = [
  'Ölçüler mm, kotlar m cinsindendir. Kotlar zemin üstünden verilmiştir.',
  'Profil ve levhalar S355J2 (TS EN 10025-2).',
  'Bulonlar 10.9 sınıfı, öngermeli (TS EN 14399); delik çapı d0 = d + 2 mm.',
  'Kenar mesafeleri en az 1,2 d0, bulon aralıkları en az 2,2 d0.',
  'Kaynak gösterimi TS EN ISO 2553; belirtilmeyen köşe kaynakları a = 5 mm.',
  'Yüzeyler Sa 2½ kalitesinde temizlenip astar boya ile boyanacaktır.',
  'Detaylardaki sistem çizgileri modeldeki eleman eksenleridir.',
];

function notes() {
  const x = 16, y = 200;
  const out = [text(x, y, 'GENEL NOTLAR', 3.5, 'font-weight="600"'), line(x, y + 1.2, x + 27, y + 1.2, DIM)];
  NOTES.forEach((s, i) => {
    out.push(text(x, y + 8 + i * 5, `${i + 1}.`, 2.5));
    out.push(text(x + 4.5, y + 8 + i * 5, s, 2.5));
  });
  return out.join('\n');
}

function piece(name) {
  return fs.readFileSync(path.join(PIECES, name), 'utf8').trim();
}

function build() {
  const hall = JSON.parse(fs.readFileSync(HALL, 'utf8'));
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" class="pafta-svg" viewBox="0 0 420 297">',
    `<g class="pafta-sheet" ${FONT} fill="none" stroke="#000">`,
    '<rect x="0" y="0" width="420" height="297" fill="#fff" stroke="none"/>',
    `<rect x="10" y="10" width="400" height="277" fill="none" stroke-width="${MEMBER}"/>`,
    '<g class="pafta-frame">', frameElevation(hall.members), '</g>',
    '<g class="pafta-notes">', notes(), '</g>',
    '<g class="pafta-detail">', piece('detail.svg'), '</g>',
    '<g class="pafta-title">', piece('title.svg'), '</g>',
    '</g>',
    '</svg>',
    '',
  ].join('\n');
}

if (typeof module !== 'undefined') module.exports = { planes, elevation, build, FRAME };

if (require.main === module) {
  if (process.argv.includes('--list')) {
    const { members } = JSON.parse(fs.readFileSync(HALL, 'utf8'));
    for (const axis of ['z', 'x']) {
      console.log(`constant-${axis} planes (members):`);
      console.log(planes(members, axis).slice(0, 12).map(p => `  ${axis} = ${p[axis]}: ${p.count}`).join('\n'));
    }
    console.log(`frame on the sheet: ${FRAME.axis} = ${FRAME.at} (axis ${FRAME.name})`);
  } else {
    fs.writeFileSync(OUT, build());
    console.log('wrote ' + path.relative(ROOT, OUT));
  }
}

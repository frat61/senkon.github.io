'use strict';
/* The construction logic of the hall erection, checked on the timeline the visitor sees: assets/senkon/hal.json
   (every piece with its grid key and its crew slot, written by tools/make-hall.js) turned into seconds by
   timeline() in assets/senkon/hal.js, landing times included. The rules are a site's, agreed with Fırat
   (spec section 12 of docs/superpowers/specs/2026-10-14-hall-erection-design.md):
     1. supported before placed: a floor piece after the towers at its corners, a post after the towers either side;
     2. bottom up: a cell's floor levels from the lowest, each after the one below has landed;
     3. columns tied before loaded: a roof truss after all the towers of its line and the floors of the bays either side;
     4. trusses before the roof between them: a bay's purlins and bracing after both trusses;
     5. a compact front moving along the hall: towers line by line from x = 0, front row to back row, no tower
        standing untied for long, the floors and the roof following the columns closely.
   Skipped when the data file is absent (it is built from the gitignored model). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const R = require('../assets/senkon/hal.js');

const file = path.join(__dirname, '..', 'assets', 'senkon', 'hal.json');
const skip = !fs.existsSync(file);
const d = skip ? { pieces: [], members: [] } : JSON.parse(fs.readFileSync(file, 'utf8'));
const tl = skip ? null : R.timeline(d);
const P = d.pieces, EPS = 1e-9;
const start = pi => tl.startAt[pi], land = pi => tl.startAt[pi] + tl.flyOf[pi];
const of = t => P.map((p, i) => i).filter(i => P[i].t === t);
const key = pi => P[pi].t + ' ' + JSON.stringify(P[pi].k);
const after = (pi, dep, why) => assert.ok(start(pi) >= land(dep) - EPS, `${key(pi)} starts at ${start(pi).toFixed(2)} s, before ${key(dep)} lands at ${land(dep).toFixed(2)} s: ${why}`);

// the grid as the keys describe it: tower lines (x in metres) and rows; a floor cell is (bay, strip), and the strip
// index of a cell is the row index of the towers along its near edge
const xs = [...new Set(of('tower').map(i => P[i].k.x))].sort((a, b) => a - b);
const rows = [...new Set(of('tower').map(i => P[i].k.row))].sort((a, b) => a - b);
const line = x => xs.indexOf(x);
const towerAt = new Map(); of('tower').forEach(i => towerAt.set(P[i].k.row + ',' + line(P[i].k.x), i));
const roofAt = new Map(); of('roof').forEach(i => roofAt.set(line(P[i].k.x), i));
const cells = new Map(); of('floor').forEach(i => { const c = P[i].k.x + ',' + P[i].k.z; if (!cells.has(c)) cells.set(c, []); cells.get(c).push(i); });
const cornersOf = i => [[P[i].k.z, P[i].k.x], [P[i].k.z, P[i].k.x + 1], [P[i].k.z + 1, P[i].k.x], [P[i].k.z + 1, P[i].k.x + 1]].map(([r, l]) => towerAt.get(r + ',' + l)).filter(t => t !== undefined);
const zOf = i => { let s = 0; P[i].m.forEach(m => { s += d.members[m][2] + d.members[m][5]; }); return s / (2 * P[i].m.length); };
const floorsTouching = (r, l) => of('floor').filter(i => (P[i].k.x === l || P[i].k.x === l - 1) && (P[i].k.z === r || P[i].k.z === r - 1));

test('the data file describes the grid the rules need: 11 tower lines, 10 rows, every piece keyed and slotted', { skip }, () => {
  assert.equal(d.v, 3);
  assert.equal(xs.length, 11); assert.equal(rows.length, 10); assert.deepEqual(rows, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(towerAt.size, 110);
  assert.ok(P.every(p => p.k && Number.isInteger(p.at) && p.at >= 0));
  assert.ok(P.some(p => p.at === 0));
  of('floor').forEach(i => { assert.ok(rows.includes(P[i].k.z), key(i)); assert.ok(P[i].k.x >= 0 && P[i].k.x < 10, key(i)); assert.ok(cornersOf(i).length >= 2, key(i) + ' has no towers at its corners'); });
  assert.equal(roofAt.size, 11); assert.equal(of('roofx').length, 10);
});

test('1. supported before placed: a floor piece starts after the towers at its corners have landed', { skip }, () => {
  of('floor').forEach(i => cornersOf(i).forEach(t => after(i, t, 'a beam needs its columns')));
});

test('1. supported before placed: an end-wall post starts after the towers either side of it have landed', { skip }, () => {
  of('post').forEach(i => {
    const l = line(P[i].k.x), z = P[i].k.z, onLine = of('tower').filter(t => line(P[t].k.x) === l);
    const below = onLine.filter(t => zOf(t) < z).sort((a, b) => zOf(b) - zOf(a))[0], above = onLine.filter(t => zOf(t) > z).sort((a, b) => zOf(a) - zOf(b))[0];
    assert.ok(below !== undefined && above !== undefined, key(i) + ' stands between two towers');
    after(i, below, 'a post needs the tower beside it'); after(i, above, 'a post needs the tower beside it');
  });
});

test('2. bottom up: in every cell the floor levels go in from the lowest, each after the one below has landed', { skip }, () => {
  cells.forEach(list => {
    const byLevel = list.slice().sort((a, b) => P[a].k.level - P[b].k.level);
    for (let i = 1; i < byLevel.length; i++) after(byLevel[i], byLevel[i - 1], 'floors go in bottom up');
  });
});

test('3. columns tied before loaded: a roof truss waits for all the towers of its line and the floors of the bays either side', { skip }, () => {
  roofAt.forEach((r, l) => {
    const towers = of('tower').filter(t => line(P[t].k.x) === l);
    assert.equal(towers.length, 10, key(r) + ' sits on ten towers');
    towers.forEach(t => after(r, t, 'a truss needs its columns'));
    of('floor').filter(f => P[f].k.x === l - 1 || P[f].k.x === l).forEach(f => after(r, f, 'the columns are tied before they carry the truss'));
  });
});

test("4. trusses before the roof between them: a bay's purlins and bracing wait for the trusses either side", { skip }, () => {
  of('roofx').forEach(i => { const b = P[i].k.x; [b, b + 1].forEach(l => { assert.ok(roofAt.has(l)); after(i, roofAt.get(l), 'the roof between two trusses needs both'); }); });
});

test('5. the column front: towers go up line by line from x = 0, front row to back row, the first piece a tower at the near corner', { skip }, () => {
  const first = xs.map((x, l) => Math.min(...rows.map(r => start(towerAt.get(r + ',' + l)))));
  for (let l = 1; l < xs.length; l++) assert.ok(first[l] >= first[l - 1] - EPS, `line ${xs[l]} starts before line ${xs[l - 1]}`);
  xs.forEach((x, l) => { for (let r = 1; r < rows.length; r++) assert.ok(start(towerAt.get(r + ',' + l)) >= start(towerAt.get((r - 1) + ',' + l)) - EPS, `line ${x}: row ${r} before row ${r - 1}`); });
  assert.equal(start(towerAt.get('0,0')), 0);
  assert.ok(P.every((p, i) => start(i) >= 0));
  // the front is compact: a line's towers all go up after the line before has started, and after the floors two bays
  // back are complete (which has the line before landed too)
  for (let l = 1; l < xs.length; l++) rows.forEach(r => rows.forEach(q => assert.ok(start(towerAt.get(r + ',' + l)) >= start(towerAt.get(q + ',' + (l - 1))) - EPS, `line ${xs[l]} row ${r} starts before line ${xs[l - 1]} row ${q}: columns go up line by line`)));
  for (let l = 2; l < xs.length; l++) rows.forEach(r => of('floor').filter(f => P[f].k.x === l - 2).forEach(f => after(towerAt.get(r + ',' + l), f, 'the column front keeps one bay ahead of the floors')));
});

test('5. no tower stands untied for long: its first beam lands within TIE seconds of the tower landing', { skip }, () => {
  const TIE = 1;                                                     // seconds at speed 1, 0.7 s on the page; measured 0.8 s
  towerAt.forEach((t, rl) => {
    const [r, l] = rl.split(',').map(Number), beams = floorsTouching(r, l);
    assert.ok(beams.length > 0, key(t) + ' is tied by at least one floor piece');
    const tied = Math.min(...beams.map(land));
    assert.ok(tied - land(t) <= TIE, `${key(t)} lands at ${land(t).toFixed(2)} s and is tied only at ${tied.toFixed(2)} s`);
  });
});

test('5. the floors and the roof follow the columns closely', { skip }, () => {
  const firstTower = l => Math.min(...rows.map(r => start(towerAt.get(r + ',' + l))));
  for (let l = 2; l < xs.length; l++) {                              // when a line's towers start, the floors two bays back are complete
    of('floor').filter(f => P[f].k.x <= l - 2).forEach(f => assert.ok(land(f) <= firstTower(l) + EPS, `${key(f)} lands after line ${xs[l]} starts: the floors lag the columns`));
  }
  for (let l = 4; l < xs.length; l++) {                              // and the roof trusses three lines back are in
    for (let m = 0; m <= l - 3; m++) assert.ok(land(roofAt.get(m)) <= firstTower(l) + EPS, `roof line ${xs[m]} lands after line ${xs[l]} starts: the roof lags the columns`);
  }
});

test('the erection ends with the roof closing at the far end, at about TOTAL seconds', { skip }, () => {
  const lastLanding = P.map((p, i) => i).sort((a, b) => land(b) - land(a))[0];
  assert.ok(P[lastLanding].t === 'roofx' || P[lastLanding].t === 'roof', 'the last piece is roof: ' + key(lastLanding));
  assert.ok(tl.end >= R.T.TOTAL - EPS && tl.end <= R.T.TOTAL + 1.5, `end ${tl.end.toFixed(2)} s`);
});

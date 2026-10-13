'use strict';
// assets/senkon/surec.js: the six-picture story on deprem-performans/. setup() is driven here by a tiny fake DOM and
// a hand-fed clock (tick(now)), so every timing rule is checked without a browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, label } = require('../assets/senkon/surec.js');

// the few DOM features the script touches
function el(tag, cls) {
  const classes = new Set(cls ? [cls] : []), attrs = {}, handlers = {}, node = {
    tag, children: [], style: {}, complete: true,
    classList: {
      add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c),
      toggle: (c, on) => { (on === undefined ? !classes.has(c) : on) ? classes.add(c) : classes.delete(c); },
    },
    setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: k => attrs[k] ?? null, removeAttribute: k => { delete attrs[k]; },
    addEventListener: (type, fn) => { (handlers[type] = handlers[type] || []).push(fn); },
    dispatch: (type, ev) => { (handlers[type] || []).forEach(fn => fn(Object.assign({ preventDefault() {} }, ev))); },
    querySelectorAll: sel => all(node).filter(n => matches(n, sel)),
    querySelector: sel => sel.split(' ').reduce((from, part) => from && (all(from).find(n => matches(n, part)) || null), node),
    offsetHeight: 0,
  };
  return node;
}
function all(n) { return n.children.flatMap(c => [c, ...all(c)]); }
function matches(n, sel) { return sel.startsWith('.') ? n.classList.contains(sel.slice(1)) : n.tag === sel; }

function dom() {
  const fig = el('figure', 'surec-stage'), list = el('ol', 'steps');
  const imgs = [], lis = [];
  for (let i = 0; i < 6; i++) { const im = el('img'); imgs.push(im); fig.children.push(im); const li = el('li', 'item'); lis.push(li); list.children.push(li); }
  const ctrl = el('div', 'surec-ctrl'), prev = el('button', 'surec-prev'), next = el('button', 'surec-next'), bar = el('span', 'surec-bar'), fill = el('i');
  bar.children.push(fill); ctrl.children.push(prev, next, bar); fig.children.push(ctrl);
  const s = setup(fig, list);
  s.enter(); s.tick(0);
  return { s, fig, imgs, lis, prev, next, fill };
}

test('starts on frame 1 and advances after 5 s', () => {
  const { s, imgs, lis } = dom();
  assert.equal(s.cur, 0);
  s.tick(4999); assert.equal(s.cur, 0);
  s.tick(5001); assert.equal(s.cur, 1);
  assert.ok(imgs[1].classList.contains('on') && !imgs[0].classList.contains('on'));
  assert.ok(lis[1].classList.contains('on') && !lis[0].classList.contains('on'));
});

test('after frame 6 it loops to 1', () => {
  const { s } = dom();
  s.show(5); s.tick(100); s.tick(5101);
  assert.equal(s.cur, 0);
});

test('clicking a step jumps there and pauses for 6 s, then resumes', () => {
  const { s, lis } = dom();
  s.tick(1000);
  lis[3].dispatch('click');
  assert.equal(s.cur, 3); assert.equal(s.playing, false);
  s.tick(1000 + 5999); assert.equal(s.cur, 3); assert.equal(s.playing, false);
  s.tick(1000 + 6001); assert.equal(s.playing, true); assert.equal(s.cur, 3);
  s.tick(1000 + 6001 + 5001); assert.equal(s.cur, 4);
});

test('Önceki on the first frame wraps to the last; Sonraki moves on', () => {
  const { s, prev, next } = dom();
  prev.dispatch('click'); assert.equal(s.cur, 5);
  next.dispatch('click'); assert.equal(s.cur, 0);
});

test('Enter or Space on a focused step selects it', () => {
  const { s, lis } = dom();
  lis[2].dispatch('keydown', { key: 'Enter' }); assert.equal(s.cur, 2);
  lis[4].dispatch('keydown', { key: ' ' }); assert.equal(s.cur, 4);
  lis[1].dispatch('keydown', { key: 'a' }); assert.equal(s.cur, 4);
});

test('mouse over the picture pauses, leaving resumes', () => {
  const { s, fig } = dom();
  fig.dispatch('pointerenter', { pointerType: 'mouse' });
  s.tick(9000); assert.equal(s.cur, 0); assert.equal(s.playing, false);
  fig.dispatch('pointerleave', { pointerType: 'mouse' });
  s.tick(9000 + 100); assert.equal(s.cur, 0);
  s.tick(9000 + 100 + 5001); assert.equal(s.cur, 1);
});

test('a finger on the picture (touch pointerenter with no pointerleave) does not pause for good', () => {
  const { s, fig, next } = dom();
  fig.dispatch('pointerenter', { pointerType: 'touch' });
  fig.dispatch('mouseenter');                       // the compatibility event phones send after a tap
  next.dispatch('click');
  assert.equal(s.cur, 1); assert.equal(s.playing, false);
  s.tick(6001); assert.equal(s.playing, true);
  s.tick(6001 + 5001); assert.equal(s.cur, 2);
});

test('keyboard focus on a step pauses while it stays; pointer focus does not', () => {
  const { s, lis } = dom();
  lis[3].dispatch('focusin');                       // Tab landed here
  s.tick(9000); assert.equal(s.cur, 0); assert.equal(s.playing, false);
  lis[3].dispatch('focusout');
  s.tick(9100); assert.equal(s.playing, true); assert.equal(s.cur, 0);   // resumed: a fresh 5 s from here
  s.tick(9100 + 5001); assert.equal(s.cur, 1);
  lis[2].dispatch('pointerdown'); lis[2].dispatch('focusin'); lis[2].dispatch('click');   // a click focuses too
  assert.equal(s.cur, 2);
  s.tick(9100 + 5001 + 6001); assert.equal(s.playing, true);
});

test('leaving and re-entering the viewport keeps the current frame', () => {
  const { s } = dom();
  s.show(2); s.tick(100);
  s.leave();
  s.tick(60000); assert.equal(s.cur, 2);
  s.enter();
  s.tick(60100); assert.equal(s.cur, 2);
  s.tick(60100 + 5001); assert.equal(s.cur, 3);
});

test('advances past a frame whose image never loads', () => {
  const { s, imgs } = dom();
  imgs[1].complete = false;
  s.tick(5001); assert.equal(s.cur, 1);
  s.tick(10002); assert.equal(s.cur, 2);
});

test('the progress bar fills over the 5 s and empties on a touch', () => {
  const { s, fill, lis } = dom();
  s.tick(2500); assert.equal(fill.style.width, '50%');
  lis[0].dispatch('click'); assert.equal(fill.style.width, '0%');
});

test('marks the figure live, the list items focusable, the lit step aria-current, no live region', () => {
  const { s, fig, lis } = dom();
  assert.ok(fig.classList.contains('surec-live'));
  lis.forEach(l => assert.equal(l.getAttribute('tabindex'), '0'));
  assert.equal(fig.getAttribute('aria-live'), null);
  assert.equal(lis[0].getAttribute('aria-current'), 'step');
  s.show(4);
  assert.equal(lis[0].getAttribute('aria-current'), null);
  assert.equal(lis[4].getAttribute('aria-current'), 'step');
});

// the pen-drawing order: ink pixels grouped into connected strokes, strokes in top-left-first order, each stroke
// growing outward from its first pixel
function pic(rows) { const h = rows.length, w = rows[0].length, g = new Uint8Array(w * h); rows.forEach((r, y) => [...r].forEach((c, x) => { g[y * w + x] = c === '#' ? 0 : 255; })); return { g, w, h }; }

test('label(): three separate strokes come out as three groups, top-left first, each whole before the next', () => {
  const { g, w, h } = pic([
    '##........',
    '..........',
    '....###...',
    '..........',
    '.........#',
  ]);
  const { order, groups } = label(g, w, h);
  assert.equal(groups, 3);
  assert.deepEqual([...order], [0, 1, 24, 25, 26, 49]);
});

test('label(): a line is drawn along its length from its first pixel, and diagonal touches count as one stroke', () => {
  const { g, w, h } = pic([
    '#####.....',
    '.....#....',
  ]);
  const { order, groups } = label(g, w, h);
  assert.equal(groups, 1);
  assert.deepEqual([...order], [0, 1, 2, 3, 4, 15]);
});

test('label(): light grey is paper, dark grey is ink', () => {
  const g = new Uint8Array([255, 230, 120, 0]);
  assert.deepEqual([...label(g, 4, 1).order], [2, 3]);
});

test('show() calls the onshow hook with the new frame index', () => {
  const { s } = dom();
  const seen = []; s.onshow = i => seen.push(i);
  s.show(3); s.show(3); s.show(0);
  assert.deepEqual(seen, [3, 0]);
});

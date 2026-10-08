'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../model/slug.js');

test('slug has 12 characters from the look-alike-free alphabet', () => {
  assert.equal(S.ALPHABET, 'abcdefghjkmnpqrstuvwxyz23456789');
  assert.equal(S.ALPHABET.length, 31);
  for (let i = 0; i < 50; i++) {
    const s = S.randomSlug();
    assert.equal(s.length, 12);
    assert.ok(S.isSlug(s), s);
    assert.ok(!/[01ilo]/.test(s), 'no look-alikes in ' + s);
  }
});

test('two slugs differ', () => {
  assert.notEqual(S.randomSlug(), S.randomSlug());
});

test('isSlug rejects wrong length, characters and types', () => {
  assert.equal(S.isSlug('abcdefghjkm'), false);
  assert.equal(S.isSlug('abcdefghjkm1'), false);
  assert.equal(S.isSlug('ABCDEFGHJKMN'), false);
  assert.equal(S.isSlug(12), false);
  assert.equal(S.isSlug('hwh8zs6h4h7k'), true);
});

test('bytes of 248 and above are discarded (no modulo bias)', () => {
  const rng = { getRandomValues(a) { for (let i = 0; i < a.length; i++) a[i] = i < 12 ? 255 : (i - 12) % 31; return a; } };
  assert.equal(S.randomSlug(12, rng), S.ALPHABET.slice(0, 12));
});

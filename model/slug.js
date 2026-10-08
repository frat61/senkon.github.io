/* SenkonSlug: random, unguessable link codes. 12 symbols from a 31-letter alphabet without
   look-alikes (no 0/1/i/l/o), drawn from crypto.getRandomValues with rejection sampling.
   Usable as a browser global (SenkonSlug) and from Node (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SenkonSlug = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';   // 31 symbols
  const LIMIT = 248;                                     // 8 * 31: bytes at or above are discarded
  function platformCrypto() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) return crypto;
    return require('node:crypto').webcrypto;
  }
  function randomSlug(n, rng) {
    n = n || 12;
    const c = rng || platformCrypto(), out = [];
    while (out.length < n) {
      const buf = c.getRandomValues(new Uint8Array(n * 2));
      for (let i = 0; i < buf.length && out.length < n; i++) if (buf[i] < LIMIT) out.push(ALPHABET[buf[i] % 31]);
    }
    return out.join('');
  }
  const RE = new RegExp('^[' + ALPHABET + ']{12}$');
  const isSlug = s => typeof s === 'string' && RE.test(s);
  return { ALPHABET, randomSlug, isSlug };
});

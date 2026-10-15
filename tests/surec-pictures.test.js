'use strict';
// assets/senkon/surec/ and assets/senkon/tasarim-surec/: the six story pictures for the Deprem performans
// and Tasarım pages, as tools/make-surec.py writes them
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

for (const dir of ['surec', 'tasarim-surec']) {
  const DIR = path.join(__dirname, '..', 'assets', 'senkon', dir);
  test(`six pictures 01–06 in ${dir}, each a WebP under 120 KB`, () => {
    for (let n = 1; n <= 6; n++) {
      const f = path.join(DIR, `0${n}.webp`);
      assert.ok(fs.existsSync(f), f);
      const b = fs.readFileSync(f);
      assert.equal(b.slice(0, 4).toString(), 'RIFF');
      assert.equal(b.slice(8, 12).toString(), 'WEBP');
      assert.ok(b.length < 120 * 1024, `${f} is ${b.length} bytes`);
    }
  });
}

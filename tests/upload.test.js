'use strict';
// assets/senkon/upload.js (pure rules): file names, folder names, limits, summary, and the shared path pattern.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EXT, MAX_FILES, MAX_BYTES, PATH_RE, cleanName, folderName, check, summary } = require('../assets/senkon/upload.js');

test('constants', () => {
  assert.deepEqual(EXT, ['pdf', 'dwg', 'dxf', 'ifc', 'zip', 'jpg', 'jpeg', 'png']);
  assert.equal(MAX_FILES, 10);
  assert.equal(MAX_BYTES, 52428800);
  assert.equal(PATH_RE.flags, 'i');
});

test('cleanName', () => {
  assert.equal(cleanName('Zemin Etüdü (son).v2.PDF'), 'Zemin-Etudu-son.v2.pdf');
  assert.equal(cleanName('ŞÇĞİÖÜ ışığ.dwg'), 'SCGIOU-isig.dwg');
  assert.equal(cleanName('???.pdf'), 'dosya.pdf');
  assert.equal(cleanName('a   b -- c.png'), 'a-b-c.png');
  assert.equal(cleanName('x'.repeat(200) + '.zip'), 'x'.repeat(80) + '.zip');
});

test('folderName', () => {
  assert.equal(folderName(new Date(2026, 9, 15), () => 0), '20261015-aaaaaaaaaaaa');
  assert.match(folderName(new Date(2026, 0, 5), () => 0.9999999), /^20260105-[a-z0-9]{12}$/);
});

test('every cleaned name fits PATH_RE', () => {
  let s = 12345;
  const rand = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const pool = 'abcçdeğfgıhiİjklmnoöprsştuüvyzABC ŞÜ0123456789 ._-()[]/\\?*:"<>|éñ日本';
  for (let i = 0; i < 200; i++) {
    let n = '';
    for (let k = 0, len = Math.floor(rand() * 120); k < len; k++) n += pool[Math.floor(rand() * pool.length)];
    const p = folderName(new Date(2026, 9, 15), rand) + '/' + cleanName(n + '.pdf');
    assert.ok(PATH_RE.test(p), p);
  }
});

test('PATH_RE rejects', () => {
  for (const p of ['../x.pdf', '20261015-abc/x.pdf', '20261015-aaaaaaaaaaaa/x.exe', '20261015-aaaaaaaaaaaa/a/b.pdf'])
    assert.equal(PATH_RE.test(p), false, p);
  assert.ok(PATH_RE.test('20261015-aaaaaaaaaaaa/X.PDF'));
});

test('check', () => {
  const ok = { name: 'a.pdf', size: 100 };
  const badType = 'Bu dosya türü kabul edilmiyor (PDF, DWG, DXF, IFC, ZIP, JPG, PNG).';
  assert.equal(check(ok, []), null);
  assert.equal(check({ name: 'a.exe', size: 1 }, []), badType);
  assert.equal(check({ name: 'noext', size: 1 }, []), badType);
  assert.equal(check({ name: 'a.pdf', size: MAX_BYTES + 1 }, []), "Dosya 50 MB'tan büyük.");
  assert.equal(check({ name: 'a.pdf', size: MAX_BYTES }, []), null);
  const ten = Array.from({ length: 10 }, (_, i) => ({ name: 'f' + i + '.pdf', size: 1 }));
  assert.equal(check(ok, ten.slice(0, 9)), null);
  assert.equal(check(ok, ten), 'En fazla 10 dosya eklenebilir.');
  assert.equal(check(ok, [ok]), 'Bu dosya zaten eklendi.');
  assert.equal(check({ name: 'a.pdf', size: 101 }, [ok]), null);
});

test('summary', () => {
  assert.equal(summary('20261015-aaaaaaaaaaaa', [{ name: 'a.pdf', size: 1258291 }]), 'talepler/20261015-aaaaaaaaaaaa: a.pdf (1,2 MB)');
  assert.equal(summary('f', [{ name: 'a.pdf', size: 10 }, { name: 'b.dwg', size: 5242880 }]), 'talepler/f: a.pdf (0,1 MB); b.dwg (5,0 MB)');
  assert.equal(summary('f', []), '');
});

test('the SQL policy carries the PATH_RE source verbatim', () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'docs', 'model', 'schema-talepler.sql'), 'utf8');
  assert.ok(sql.includes(PATH_RE.source), 'schema-talepler.sql must contain ' + PATH_RE.source);
});

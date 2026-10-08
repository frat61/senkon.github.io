'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../model/ingest.js');
const B = require('../model/builder.js');

test('classify accepts the four extensions and rejects others', () => {
  assert.deepEqual(I.classify('bina.glb', 100), { ext: 'glb', kind: 'file', error: null });
  assert.deepEqual(I.classify('Bina.GLTF', 100), { ext: 'gltf', kind: 'file', error: null });
  assert.deepEqual(I.classify('bina.ifc', 100), { ext: 'ifc', kind: 'file', error: null });
  assert.deepEqual(I.classify('bina.json', 100), { ext: 'json', kind: 'parametric', error: null });
  assert.equal(I.classify('bina.skp', 100).kind, null);
  assert.match(I.classify('bina.skp', 100).error, /Desteklenmeyen/);
  assert.match(I.classify('bina', 100).error, /Desteklenmeyen/);
});

test('classify enforces the 50 MB limit and refuses empty files', () => {
  assert.equal(I.LIMIT_BYTES, 52428800);
  assert.equal(I.classify('a.glb', 52428800).error, null);
  assert.match(I.classify('a.glb', 52428801).error, /50 MB/);
  assert.match(I.classify('a.glb', 0).error, /boş/);
  assert.match(I.classify('a.glb', undefined).error, /okunamadı/);
});

test('validateName', () => {
  assert.match(I.validateName(''), /gerekli/);
  assert.match(I.validateName('   '), /gerekli/);
  assert.match(I.validateName('x'.repeat(121)), /120/);
  assert.equal(I.validateName('Laboratuvar'), null);
});

test('parseModelJson accepts a bare data sheet and a row-shaped file', () => {
  const bare = JSON.stringify({ v: 1, axes: { x: [0, 6], y: [0, 10] } });
  const p1 = I.parseModelJson(bare, B);
  assert.deepEqual(p1.data.axes, { x: [0, 6], y: [0, 10] }); assert.equal(p1.name, null);
  const row = JSON.stringify({ name: 'Ad', description: 'Açıklama', data: { v: 1, axes: { x: [0, 6], y: [0, 10] } } });
  const p2 = I.parseModelJson(row, B);
  assert.equal(p2.name, 'Ad'); assert.equal(p2.description, 'Açıklama'); assert.ok(p2.data.axes);
});

test('parseModelJson rejects bad input with Turkish messages', () => {
  assert.throws(() => I.parseModelJson('{', B), /JSON okunamadı/);
  assert.throws(() => I.parseModelJson('[1]', B), /nesne/);
  assert.throws(() => I.parseModelJson('{"v":1}', B), /Veri sayfası geçersiz/);
  assert.throws(() => I.parseModelJson('{"v":2,"axes":{"x":[0,1],"y":[0,1]}}', B), /sürümü/);
});

test('isEmbeddedGltf', () => {
  assert.equal(I.isEmbeddedGltf('{"asset":{"version":"2.0"},"buffers":[{"uri":"data:application/octet-stream;base64,AA=="}]}'), true);
  assert.equal(I.isEmbeddedGltf('{"asset":{"version":"2.0"},"buffers":[{"uri":"scene.bin"}]}'), false);
  assert.equal(I.isEmbeddedGltf('{"asset":{"version":"2.0"},"buffers":[{"uri":"data:x;base64,AA=="}],"images":[{"uri":"tex.png"}]}'), false);
  assert.equal(I.isEmbeddedGltf('{"asset":{"version":"2.0"},"buffers":[{"uri":"data:x;base64,AA=="}],"images":[{"bufferView":0}]}'), true);
  assert.equal(I.isEmbeddedGltf('not json'), false);
});

test('storage path and public URL', () => {
  assert.equal(I.storagePath('hwh8zs6h4h7k'), 'hwh8zs6h4h7k/model.glb');
  assert.equal(I.publicFileUrl('https://x.supabase.co/', 'a/model.glb'), 'https://x.supabase.co/storage/v1/object/public/models/a/model.glb');
});

test('fileMetadata and makeRow', () => {
  const meta = I.fileMetadata({ ext: 'ifc', name: 'bina.ifc', bytes: 10, glbBytes: 20, converter: 'web-ifc 0.0.78', source: 'P-01' });
  assert.deepEqual(meta, { source_format: 'ifc', original_name: 'bina.ifc', original_bytes: 10, glb_bytes: 20, converter: 'web-ifc 0.0.78', source: 'P-01' });
  const f = I.makeRow({ slug: 'hwh8zs6h4h7k', name: ' Bina ', description: '', kind: 'file', metadata: meta });
  assert.deepEqual(f, { slug: 'hwh8zs6h4h7k', name: 'Bina', description: null, kind: 'file', data: { metadata: meta }, file_path: 'hwh8zs6h4h7k/model.glb', file_format: 'glb' });
  const p = I.makeRow({ slug: 'hwh8zs6h4h7k', name: 'Lab', description: 'x', kind: 'parametric', data: { v: 1 } });
  assert.deepEqual(p, { slug: 'hwh8zs6h4h7k', name: 'Lab', description: 'x', kind: 'parametric', data: { v: 1 }, file_path: null, file_format: null });
});

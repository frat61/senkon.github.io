/* SenkonIngest: pure decisions for the owner page's "Model ekle" flow: what a chosen file is,
   whether it is allowed, how a .json data sheet is read, where a GLB is stored, and what
   row goes into the models table. No DOM, no network; testable in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SenkonIngest = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const LIMIT_BYTES = 50 * 1024 * 1024;
  const KIND_BY_EXT = { glb: 'file', gltf: 'file', ifc: 'file', json: 'parametric' };
  const THUMB = { width: 480, height: 300, quality: 0.7, mime: 'image/jpeg' };
  const MIME_GLB = 'model/gltf-binary';

  function extensionOf(name) {
    const m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
    return m ? m[1].toLowerCase() : '';
  }
  function classify(name, bytes) {
    const ext = extensionOf(name), kind = KIND_BY_EXT[ext] || null;
    if (!kind) return { ext, kind, error: 'Desteklenmeyen dosya türü: yalnızca .glb, .gltf, .ifc veya .json' };
    if (typeof bytes !== 'number' || !(bytes >= 0)) return { ext, kind, error: 'Dosya boyutu okunamadı' };
    if (bytes === 0) return { ext, kind, error: 'Dosya boş' };
    if (bytes > LIMIT_BYTES) return { ext, kind, error: 'Dosya 50 MB sınırını aşıyor' };
    return { ext, kind, error: null };
  }
  function validateName(name) {
    const s = String(name || '').trim();
    if (!s) return 'Model adı gerekli';
    if (s.length > 120) return 'Model adı en fazla 120 karakter olabilir';
    return null;
  }
  // A .json upload is either a row-shaped object { name, description, data } or a bare data sheet.
  function parseModelJson(text, builder) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { throw new Error('JSON okunamadı'); }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('JSON bir nesne olmalı');
    const rowShaped = !!(obj.data && typeof obj.data === 'object' && !obj.axes);
    const data = rowShaped ? obj.data : obj;
    if ((data.v || 1) > builder.VERSION) throw new Error('Model sürümü desteklenmiyor');
    try { builder.normalize(data); } catch (e) { throw new Error('Veri sayfası geçersiz: ' + e.message); }
    return {
      data,
      name: rowShaped && typeof obj.name === 'string' ? obj.name : null,
      description: rowShaped && typeof obj.description === 'string' ? obj.description : null
    };
  }
  // Only a self-contained .gltf is accepted (buffers and images embedded as data URIs).
  function isEmbeddedGltf(text) {
    let g;
    try { g = JSON.parse(text); } catch (e) { return false; }
    if (!g || !Array.isArray(g.buffers)) return false;
    const isData = u => typeof u === 'string' && u.slice(0, 5) === 'data:';
    return g.buffers.every(b => b && isData(b.uri)) && (g.images || []).every(i => i && (i.bufferView !== undefined || isData(i.uri)));
  }
  const storagePath = slug => slug + '/model.glb';
  const publicFileUrl = (supabaseUrl, path) => String(supabaseUrl).replace(/\/$/, '') + '/storage/v1/object/public/models/' + path;
  function fileMetadata(o) {
    return { source_format: o.ext, original_name: o.name, original_bytes: o.bytes, glb_bytes: o.glbBytes, converter: o.converter || null, source: o.source || null };
  }
  function makeRow(o) {
    const row = { slug: o.slug, name: String(o.name).trim(), description: o.description && String(o.description).trim() ? String(o.description).trim() : null, kind: o.kind };
    if (o.kind === 'parametric') { row.data = o.data; row.file_path = null; row.file_format = null; }
    else { row.data = { metadata: o.metadata }; row.file_path = storagePath(o.slug); row.file_format = 'glb'; }
    return row;
  }
  return { LIMIT_BYTES, THUMB, MIME_GLB, extensionOf, classify, validateName, parseModelJson, isEmbeddedGltf, storagePath, publicFileUrl, fileMetadata, makeRow };
});

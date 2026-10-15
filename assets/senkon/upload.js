/* Project-file upload on /tasarim/. This first part is pure rules, shared by the page and by tests: which files are
   accepted, how a file name is made safe, how the per-request folder is named, and the one-line summary that goes
   into the request. PATH_RE is the same pattern the storage policy in docs/model/schema-talepler.sql applies to
   every object name, so the browser never builds a path the bucket would refuse. */
(function () {
  'use strict';

  const EXT = ['pdf', 'dwg', 'dxf', 'ifc', 'zip', 'jpg', 'jpeg', 'png'];
  const MAX_FILES = 10, MAX_BYTES = 52428800;   // 50 MB each
  const PATH_RE = new RegExp('^[0-9]{8}-[a-z0-9]{12}/[^/]+\\.(pdf|dwg|dxf|ifc|zip|jpg|jpeg|png)$', 'i');

  const TR = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'İ': 'I', 'ö': 'o', 'ş': 's', 'ü': 'u', 'Ç': 'C', 'Ğ': 'G', 'Ö': 'O', 'Ş': 'S', 'Ü': 'U' };

  function cleanPart(s) {
    return s.replace(/[çğıİöşüÇĞÖŞÜ]/g, c => TR[c]).replace(/\s+/g, '-').replace(/[^A-Za-z0-9._-]/g, '').replace(/-+/g, '-');
  }
  function cleanName(name) {
    const s = String(name), dot = s.lastIndexOf('.');
    const rawBase = dot >= 0 ? s.slice(0, dot) : s, ext = dot >= 0 ? cleanPart(s.slice(dot + 1)).toLowerCase() : '';
    const base = cleanPart(rawBase).slice(0, 80) || 'dosya';
    return ext ? base + '.' + ext : base;
  }

  function folderName(date, rand) {
    const p = (n, w) => String(n).padStart(w, '0'), a = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 12; i++) id += a[Math.min(a.length - 1, Math.floor(rand() * a.length))];
    return p(date.getFullYear(), 4) + p(date.getMonth() + 1, 2) + p(date.getDate(), 2) + '-' + id;
  }

  function check(file, list) {
    const m = /\.([^.]+)$/.exec(file.name), ext = m ? m[1].toLowerCase() : '';
    if (EXT.indexOf(ext) < 0) return 'Bu dosya türü kabul edilmiyor (PDF, DWG, DXF, IFC, ZIP, JPG, PNG).';
    if (file.size > MAX_BYTES) return 'Dosya 50 MB\'tan büyük.';
    if (list.length >= MAX_FILES) return 'En fazla 10 dosya eklenebilir.';
    if (list.some(f => f.name === file.name && f.size === file.size)) return 'Bu dosya zaten eklendi.';
    return null;
  }

  function mb(size) { return Math.max(0.1, Math.round(size / 1048576 * 10) / 10).toFixed(1).replace('.', ','); }
  function summary(folder, files) {
    if (!files.length) return '';
    return 'talepler/' + folder + ': ' + files.map(f => f.name + ' (' + mb(f.size) + ' MB)').join('; ');
  }

  if (typeof module !== 'undefined') module.exports = { EXT, MAX_FILES, MAX_BYTES, PATH_RE, cleanName, folderName, check, summary };
  if (typeof document === 'undefined') return;
})();

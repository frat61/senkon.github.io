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

  /* The file box in the form. Each chosen or dropped file is checked, gets a row, and uploads at once by
     XMLHttpRequest (for the progress bar) to POST <url>/storage/v1/object/talepler/<folder>/<name>. One folder per
     visit, made when the first file arrives. While anything uploads, Gönder waits; after every change the hidden
     dosyalar field is rewritten with the uploaded files, by the names they are stored under. The file input has no
     name, so the form post (track.js) never carries the files themselves. opts = { url, key, XHR, now, rand }. */
  function attach(form, opts) {
    const doc = form.ownerDocument, XHR = opts.XHR || XMLHttpRequest;
    const now = opts.now || (() => new Date()), rand = opts.rand || Math.random;
    const box = form.querySelector('.lead-files'), input = box.querySelector('input[type="file"]'), list = box.querySelector('.lead-flist');
    const out = form.querySelector('input[name="dosyalar"]'), btn = form.querySelector('button[type="submit"]');
    const label = btn.textContent, files = [], used = {};
    let folder = null, held = false;
    const msg = doc.createElement('p');
    msg.className = 'lead-fmsg'; msg.hidden = true; msg.setAttribute('role', 'status');
    box.appendChild(msg);

    const el = (tag, cls, text) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
    function busy() { return files.some(f => f.state === 'up'); }
    function refresh() {
      // only release the button this box held, so the form's own sending state (track.js) is left alone
      if (busy() && !held) { held = true; btn.disabled = true; btn.textContent = 'Dosyalar yükleniyor…'; }
      else if (!busy() && held) { held = false; btn.disabled = false; btn.textContent = label; }
      out.value = summary(folder, files.filter(f => f.state === 'done').map(f => ({ name: f.path.slice(folder.length + 1), size: f.size })));
    }
    function pathFor(name) {   // two names can clean to the same one; the bucket refuses a second object under a name
      const c = cleanName(name), dot = c.lastIndexOf('.');
      let p = folder + '/' + c;
      for (let i = 2; used[p]; i++) p = folder + '/' + c.slice(0, dot) + '-' + i + c.slice(dot);
      used[p] = true;
      return p;
    }
    function draw(f) {
      const row = f.row;
      row.textContent = '';
      row.className = 'lead-frow ' + f.state;
      row.appendChild(el('span', 'lead-fname', f.name));
      row.appendChild(el('span', 'lead-fsize', mb(f.size) + ' MB'));
      const bar = row.appendChild(el('span', 'lead-fbar')), fill = bar.appendChild(el('i'));
      fill.style.width = f.pct + '%';
      row.appendChild(el('span', 'lead-fstate', f.state === 'up' ? '%' + f.pct : f.state === 'done' ? 'Yüklendi' : 'Yüklenemedi, tekrar deneyin'));
      if (f.state === 'fail') {
        const again = row.appendChild(el('button', 'lead-retry', 'Tekrar dene'));
        again.type = 'button';
        again.addEventListener('click', () => send(f));
      }
      const x = row.appendChild(el('button', 'lead-x', '×'));
      x.type = 'button';
      x.setAttribute('aria-label', f.name + ' dosyasını kaldır');
      x.addEventListener('click', () => drop(f));
    }
    function set(f, state, pct) { f.state = state; f.pct = pct; draw(f); refresh(); }
    function send(f) {
      const r = new XHR();
      f.xhr = r;
      r.open('POST', opts.url + '/storage/v1/object/talepler/' + f.path);
      r.setRequestHeader('apikey', opts.key);
      r.setRequestHeader('Authorization', 'Bearer ' + opts.key);
      r.setRequestHeader('x-upsert', 'false');
      r.setRequestHeader('Content-Type', f.file.type || 'application/octet-stream');
      r.upload.onprogress = e => { if (e.lengthComputable && f.xhr === r) { f.pct = Math.min(99, Math.round(e.loaded / e.total * 100)); draw(f); } };
      r.onload = () => { if (f.xhr === r) set(f, r.status >= 200 && r.status < 300 ? 'done' : 'fail', r.status >= 200 && r.status < 300 ? 100 : 0); };
      r.onerror = () => { if (f.xhr === r) set(f, 'fail', 0); };
      set(f, 'up', 0);
      r.send(f.file);
    }
    function drop(f) {   // anon cannot delete: a removed upload stays in the bucket and is cleared from the owner panel
      const i = files.indexOf(f);
      if (i < 0) return;
      files.splice(i, 1);
      if (f.state === 'up') f.xhr.abort();
      f.xhr = null;
      f.row.remove();
      refresh();
    }
    function add(chosen) {
      const refused = [];
      for (const file of Array.prototype.slice.call(chosen || [])) {
        const why = check(file, files);
        if (why) { refused.push(file.name + ': ' + why); continue; }
        if (!folder) folder = folderName(now(), rand);
        const f = { name: file.name, size: file.size, path: pathFor(file.name), state: 'up', pct: 0, file, xhr: null, row: el('li') };
        files.push(f);
        list.appendChild(f.row);
        send(f);
      }
      msg.textContent = refused.join('\n');
      msg.hidden = !refused.length;
    }

    input.addEventListener('change', () => { add(input.files); input.value = ''; });
    box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('drag'); });
    box.addEventListener('dragleave', () => box.classList.remove('drag'));
    box.addEventListener('drop', e => { e.preventDefault(); box.classList.remove('drag'); add(e.dataTransfer && e.dataTransfer.files); });
    box.hidden = false;
    return { files, busy };
  }

  if (typeof module !== 'undefined') module.exports = { EXT, MAX_FILES, MAX_BYTES, PATH_RE, cleanName, folderName, check, summary, attach };
  if (typeof document === 'undefined') return;

  const form = document.querySelector('.lead-form'), cfg = window.SENKON_CONFIG || {};
  if (form && !form.hidden && form.querySelector('.lead-files') && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY)
    attach(form, { url: cfg.SUPABASE_URL, key: cfg.SUPABASE_ANON_KEY });
})();

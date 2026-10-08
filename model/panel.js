/* Owner page: login, model list with previews, add / replace / delete. Writes go through
   supabase-js with the owner's session; files go to the "models" bucket as GLB. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const C = window.SENKON_CONFIG || {}, I = SenkonIngest;
  const SITE = 'https://senkonmuhendislik.com/model/?m=';
  const state = $('state');
  let sb = null, models = [], replacing = null, delTarget = null;

  const say = (el, msg) => { el.textContent = msg || ''; };
  const step = (text, p) => { $('addStep').textContent = text; if (p !== undefined) $('addProg').value = p; };
  const busy = on => { $('addOk').disabled = on; $('addCancel').disabled = on; $('mFile').disabled = on; $('addProg').hidden = !on; if (!on) step(''); };

  // ---- auth
  async function init() {
    if (!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY) { state.textContent = 'Yapılandırma eksik: config.js'; return; }
    sb = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
    const { data } = await sb.auth.getSession();
    showAuth(!!data.session);
    sb.auth.onAuthStateChange((event, session) => { if (event !== 'INITIAL_SESSION') showAuth(!!session); });
  }
  function showAuth(on) {
    state.hidden = true; $('login').hidden = on; $('list').hidden = !on; $('topActions').hidden = !on;
    if (on) refresh(); else { models = []; $('cards').innerHTML = ''; }
  }
  $('loginForm').onsubmit = async e => {
    e.preventDefault(); say($('loginMsg'), '');
    const email = $('email').value.trim(), password = $('password').value;
    if (!email || !password) return say($('loginMsg'), 'E-posta ve şifre gerekli');
    $('loginBtn').disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    $('loginBtn').disabled = false;
    if (error) say($('loginMsg'), /invalid|credentials/i.test(error.message) ? 'E-posta veya şifre hatalı' : 'Bağlantı kurulamadı, tekrar deneyin');
    else $('password').value = '';
  };
  $('logout').onclick = () => sb.auth.signOut();

  // ---- list
  async function refresh() {
    const { data, error } = await sb.from('models').select('id,slug,name,description,kind,file_path,updated_at,thumbnail').order('updated_at', { ascending: false });
    if (error) { state.hidden = false; state.textContent = 'Liste alınamadı: ' + error.message; return; }
    models = data || []; draw();
  }
  function draw() {
    const cards = $('cards'); cards.innerHTML = ''; $('empty').hidden = models.length > 0;
    models.forEach(m => {
      const n = $('cardT').content.cloneNode(true), img = n.querySelector('img');
      if (m.thumbnail) img.src = m.thumbnail; else img.classList.add('none');
      n.querySelector('h3').textContent = m.name;
      n.querySelector('.meta').textContent = (m.kind === 'file' ? 'Dosya' : 'Parametrik') + ' · ' + new Date(m.updated_at).toLocaleDateString('tr-TR');
      n.querySelector('.open').href = './?m=' + encodeURIComponent(m.slug);
      n.querySelector('.copy').onclick = ev => copyLink(ev.currentTarget, m.slug);
      const rep = n.querySelector('.replace'); if (m.kind !== 'file') rep.hidden = true; else rep.onclick = () => openAdd(m);
      n.querySelector('.del').onclick = () => askDelete(m);
      cards.appendChild(n);
    });
  }
  async function copyLink(btn, slug) {
    const link = SITE + slug;
    try { await navigator.clipboard.writeText(link); const t = btn.textContent; btn.textContent = 'Kopyalandı'; setTimeout(() => { btn.textContent = t; }, 1500); }
    catch (e) { window.prompt('Bağlantı:', link); }
  }

  // ---- add / replace
  $('add').onclick = () => openAdd(null);
  function openAdd(m) {
    replacing = m;
    $('addTitle').textContent = m ? 'Dosyayı değiştir: ' + m.name : 'Model ekle';
    $('mName').value = m ? m.name : ''; $('mName').disabled = !!m;
    $('mDesc').value = m ? (m.description || '') : ''; $('mDesc').disabled = !!m;
    $('mSource').value = ''; $('mFile').value = ''; $('mFile').accept = m ? '.glb,.gltf,.ifc' : '.glb,.gltf,.ifc,.json';
    $('addOk').textContent = m ? 'Değiştir' : 'Ekle';
    say($('addMsg'), ''); step(''); $('addProg').hidden = true; $('addProg').value = 0;
    $('addDlg').showModal();
  }
  $('addCancel').onclick = () => $('addDlg').close();
  $('addForm').onsubmit = async e => {
    e.preventDefault(); say($('addMsg'), '');
    const file = $('mFile').files[0];
    const nameErr = replacing ? null : I.validateName($('mName').value);
    if (nameErr) return say($('addMsg'), nameErr);
    if (!file) return say($('addMsg'), 'Dosya seçin');
    const cls = I.classify(file.name, file.size);
    if (cls.error) return say($('addMsg'), cls.error);
    if (replacing && cls.kind !== 'file') return say($('addMsg'), 'Değiştirmek için bir 3B dosya seçin (.glb, .gltf, .ifc)');
    busy(true);
    try {
      if (replacing) await replaceModel(replacing, file, cls); else await addModel(file, cls);
      busy(false); $('addDlg').close(); await refresh();
    } catch (err) { console.error(err); busy(false); say($('addMsg'), err.message || 'İşlem başarısız'); }
  };
  const parseGltf = input => new Promise((res, rej) => new THREE.GLTFLoader().parse(input, '', res, () => rej(new Error('Model dosyası okunamadı'))));
  const exportGlb = scene => new Promise((res, rej) => { try { new THREE.GLTFExporter().parse(scene, res, { binary: true }); } catch (e) { rej(e); } });
  // Turn the chosen file into { glb, scene, converter }.
  async function toGlb(file, cls) {
    step('Okunuyor', 0.1);
    const buf = await file.arrayBuffer();
    if (cls.ext === 'glb') { const gltf = await parseGltf(buf); return { glb: buf, scene: gltf.scene, converter: null }; }
    if (cls.ext === 'gltf') {
      const text = new TextDecoder().decode(buf);
      if (!I.isEmbeddedGltf(text)) throw new Error('Yalnızca tek dosyalı .glb veya gömülü .gltf yüklenebilir');
      const gltf = await parseGltf(text);
      step('Dönüştürülüyor', 0.4);
      return { glb: await exportGlb(gltf.scene), scene: gltf.scene, converter: 'three r128 GLTFExporter' };
    }
    step('Dönüştürülüyor', 0.3);
    const r = await SenkonIfc.convert(buf, { wasmPath: 'vendor/web-ifc/', onProgress: (d, t) => step('Dönüştürülüyor: ' + d + (t ? ' / ' + t : '') + ' eleman', t ? 0.3 + 0.3 * d / t : 0.4) });
    if (r.glb.byteLength > I.LIMIT_BYTES) throw new Error('Dönüştürülen model çok büyük (' + Math.round(r.glb.byteLength / 1048576) + ' MB). Modeli sadeleştirin veya bilgisayarda GLB olarak dışa aktarın.');
    return { glb: r.glb, scene: r.scene, converter: 'web-ifc ' + r.version };
  }
  async function upload(path, glb) {
    step('Yükleniyor', 0.7);
    const { error } = await sb.storage.from('models').upload(path, new Blob([glb], { type: I.MIME_GLB }), { contentType: I.MIME_GLB, upsert: true });
    if (error) throw new Error('Yükleme başarısız: ' + error.message);
  }
  // Render once in the hidden 480x300 stage and capture a JPEG. Returns null on failure.
  function thumbnail(mountFn) {
    step('Önizleme', 0.9);
    const st = $('thumbStage'); let v = null;
    try { v = mountFn(st); v.setView('iso'); v.draw(); return st.querySelector('canvas').toDataURL(I.THUMB.mime, I.THUMB.quality); }
    catch (e) { console.warn('thumbnail failed', e); return null; }
    finally { if (v) v.dispose(); }
  }
  async function addModel(file, cls) {
    const slug = SenkonSlug.randomSlug(), name = $('mName').value, description = $('mDesc').value, source = $('mSource').value.trim();
    let row, mountFn;
    if (cls.kind === 'parametric') {
      const p = I.parseModelJson(await file.text(), SenkonBuilder);
      if (source) p.data.source = source;
      row = I.makeRow({ slug, name, description: description || p.description, kind: 'parametric', data: p.data });
      mountFn = st => SenkonViewer.mount(st, p.data, { compact: false });
    } else {
      const g = await toGlb(file, cls);
      await upload(I.storagePath(slug), g.glb);
      row = I.makeRow({ slug, name, description, kind: 'file', metadata: I.fileMetadata({ ext: cls.ext, name: file.name, bytes: file.size, glbBytes: g.glb.byteLength, converter: g.converter, source }) });
      mountFn = st => SenkonViewer.mountFile(st, g.scene, { compact: false });
    }
    const ins = await sb.from('models').insert(row).select('id').single();
    if (ins.error) throw new Error('Kayıt başarısız: ' + ins.error.message);
    const thumb = thumbnail(mountFn);
    if (thumb) { const up = await sb.from('models').update({ thumbnail: thumb }).eq('id', ins.data.id); if (up.error) console.warn('thumbnail not saved', up.error); }
  }
  async function replaceModel(m, file, cls) {
    const g = await toGlb(file, cls);
    await upload(I.storagePath(m.slug), g.glb);
    const meta = I.fileMetadata({ ext: cls.ext, name: file.name, bytes: file.size, glbBytes: g.glb.byteLength, converter: g.converter, source: $('mSource').value.trim() || null });
    const thumb = thumbnail(st => SenkonViewer.mountFile(st, g.scene, { compact: false }));
    const up = await sb.from('models').update({ data: { metadata: meta }, file_path: I.storagePath(m.slug), file_format: 'glb', thumbnail: thumb }).eq('id', m.id);
    if (up.error) throw new Error('Kayıt güncellenemedi: ' + up.error.message);
  }

  // ---- delete
  function askDelete(m) { delTarget = m; $('delName').textContent = m.name; say($('delMsg'), ''); $('delDlg').showModal(); }
  $('delCancel').onclick = () => $('delDlg').close();
  $('delOk').onclick = async () => {
    const m = delTarget; $('delOk').disabled = true; say($('delMsg'), '');
    try {
      if (m.kind === 'file' && m.file_path) { const { error } = await sb.storage.from('models').remove([m.file_path]); if (error) throw new Error('Dosya silinemedi: ' + error.message); }
      const { error } = await sb.from('models').delete().eq('id', m.id);
      if (error) throw new Error('Kayıt silinemedi: ' + error.message);
      $('delDlg').close(); await refresh();
    } catch (err) { console.error(err); say($('delMsg'), err.message); }
    $('delOk').disabled = false;
  };

  init();
})();

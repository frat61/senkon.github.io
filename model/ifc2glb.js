/* SenkonIfc: converts an IFC file to a GLB in the owner's browser using web-ifc (WASM).
   Geometry is merged per (entity type, colour) into one mesh each, grouped by type, so the
   result stays light for phones. web-ifc returns metres and Y-up coordinates. Loads the
   vendored web-ifc bundle on first use. Browser only. */
(function (root) {
  'use strict';
  const VERSION = '0.0.78';
  let apiPromise = null;

  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('web-ifc yüklenemedi')); document.head.appendChild(s); });
  }
  async function getApi(wasmPath) {
    if (!apiPromise) apiPromise = (async () => {
      if (typeof WebIFC === 'undefined') await loadScript(wasmPath + 'web-ifc-api-iife.js');
      const api = new WebIFC.IfcAPI();
      api.SetWasmPath(wasmPath, true);
      await api.Init();
      return api;
    })();
    return apiPromise;
  }
  function colourKey(c) { return [c.x, c.y, c.z, c.w].map(v => v.toFixed(3)).join(','); }

  async function convert(buffer, opts) {
    opts = opts || {};
    const api = await getApi(opts.wasmPath || 'vendor/web-ifc/');
    const modelID = api.OpenModel(new Uint8Array(buffer), { COORDINATE_TO_ORIGIN: true });
    if (modelID < 0) throw new Error('IFC dosyası okunamadı');
    try {
      const groups = new Map();   // "type|colour" -> { type, color, pos[], nor[], idx[], count }
      let meshes = 0;
      const m4 = new THREE.Matrix4(), m3 = new THREE.Matrix3(), v = new THREE.Vector3();
      api.StreamAllMeshes(modelID, mesh => {
        meshes++;
        if (opts.onProgress && meshes % 25 === 0) opts.onProgress(meshes, 0);
        let typeName = 'IFCELEMENT';
        try { typeName = api.GetNameFromTypeCode(api.GetLineType(modelID, mesh.expressID)) || typeName; } catch (e) { /* unknown type: keep default */ }
        const n = mesh.geometries.size();
        for (let i = 0; i < n; i++) {
          const pg = mesh.geometries.get(i);
          const geom = api.GetGeometry(modelID, pg.geometryExpressID);
          const verts = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());   // x y z nx ny nz per vertex
          const idx = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());
          m4.fromArray(pg.flatTransformation); m3.getNormalMatrix(m4);
          const key = typeName + '|' + colourKey(pg.color);
          let g = groups.get(key);
          if (!g) { g = { type: typeName, color: pg.color, pos: [], nor: [], idx: [], count: 0 }; groups.set(key, g); }
          const base = g.count;
          for (let k = 0; k < verts.length; k += 6) {
            v.set(verts[k], verts[k + 1], verts[k + 2]).applyMatrix4(m4); g.pos.push(v.x, v.y, v.z);
            v.set(verts[k + 3], verts[k + 4], verts[k + 5]).applyMatrix3(m3).normalize(); g.nor.push(v.x, v.y, v.z);
          }
          for (let k = 0; k < idx.length; k++) g.idx.push(idx[k] + base);
          g.count += verts.length / 6;
          geom.delete();
        }
      });
      if (!groups.size) throw new Error('IFC dosyasında geometri bulunamadı');
      const scene = new THREE.Group(); scene.name = 'ifc';
      const byType = new Map();
      groups.forEach(g => {
        const bg = new THREE.BufferGeometry();
        bg.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
        bg.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
        bg.setIndex(g.idx);
        const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(g.color.x, g.color.y, g.color.z), roughness: 0.8, metalness: 0.1,
          transparent: g.color.w < 1, opacity: g.color.w, side: THREE.DoubleSide });
        let parent = byType.get(g.type);
        if (!parent) { parent = new THREE.Group(); parent.name = g.type; byType.set(g.type, parent); scene.add(parent); }
        parent.add(new THREE.Mesh(bg, mat));
      });
      if (opts.onProgress) opts.onProgress(meshes, meshes);
      const glb = await new Promise((res, rej) => { try { new THREE.GLTFExporter().parse(scene, res, { binary: true }); } catch (e) { rej(e); } });
      return { glb, scene, version: VERSION, stats: { meshes, groups: groups.size, types: byType.size } };
    } finally {
      api.CloseModel(modelID);
    }
  }
  root.SenkonIfc = { convert, VERSION };
})(window);

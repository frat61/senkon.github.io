// Builds local/lab-model.json (a row-shaped object) from the original lab-frame-3d.html.
// The walls, doors and axes come from the DATA constant in the file; every other value was
// hard-coded in its script and is written out here in the v1 data format.
// Usage: node tools/extract-lab-model.js local/lab-frame-3d.html
'use strict';
const fs = require('fs'), path = require('path');
const file = process.argv[2] || path.join('local', 'lab-frame-3d.html');
const src = fs.readFileSync(file, 'utf8');
const m = src.match(/const DATA=(\{[\s\S]*?\});\r?\n/);
if (!m) throw new Error('DATA constant not found in ' + file);
const D = JSON.parse(m[1]);

const rooms = [['Lab', 8.9, 15.2], ['Kimyasal depo', 7.6, 4.2], ['Numune giriş', 3.0, 7.3], ['Numune kabul', 3.0, 12.3],
  ['Kadın soyunma', 13.6, 7.0], ['WC', 16.9, 7.0], ['WC', 19.8, 7.0], ['Erkek soyunma', 22.9, 7.0], ['Arşiv', 26.0, 7.0],
  ['Çay ocağı', 24.0, 1.6], ['Temizlik', 19.8, 1.6], ['Koridor', 14.0, 10.0], ['Analiz', 20.3, 15.3], ['Toplantı', 25.2, 13.8],
  ['Ofis', 25.2, 18.0], ['Ofis 1', 32.2, 17.7], ['Ofis 2', 32.2, 13.8], ['Ofis 3', 32.2, 9.9], ['Ofis 4', 32.2, 6.0], ['Ofis 5', 32.2, 2.0]];
const labels = [['Malzeme girişi', -0.3, 2.35, 2.9], ['Numune girişi', -0.3, 10.06, 2.9], ['Bina girişi', 28.45, 18.6, 2.9], ['Acil çıkış', 28.24, -0.3, 2.9]];

const row = {
  name: 'Laboratuvar binası, taşıyıcı sistem ön tasarımı',
  description: 'Tek katlı çelik çerçeve, 35.05 × 19.66 m. 4.00 m tavan yüksekliğinde laboratuvar katı, üzerinde mekanik kat ve az eğimli çatı. Üç cephe panel, güney cephe cam.',
  kind: 'parametric',
  updated_at: '2026-10-05T00:00:00Z',
  data: {
    v: 1,
    outline: { x: 35.05, y: 19.66 },
    axes: { x: D.xs, y: D.ys },
    interiorRows: [1],
    levels: { ceiling: 4.0, deck: 4.45, eave: 5.75, ridge: 6.3 },
    roof: { type: 'gable', ridgeAxisY: 1, purlinBays: 14 },
    frame: { type: 'beams', column: 0.25, fixedBases: true },
    deck: { enabled: true, secondarySpacing: 2.2 },
    facades: { north: 'panel', east: 'panel', west: 'panel', south: 'glass' },
    claddingOffset: 0.16,
    glassModule: 1.2,
    windPosts: { west: [5.65, 13.53], east: [4.04, 11.84, 15.74] },
    entrance: { side: 'south', from: 27.55, to: 29.35, height: 2.4, canopy: true },
    walls: D.walls,
    doors: D.doors,
    rooms: rooms.map(([name, x, y]) => ({ name, x, y })),
    labels: labels.map(([name, x, y, z]) => ({ name, x, y, z })),
    source: 'ENL-26_336-F-001 (02.10.2026)'
  }
};
fs.mkdirSync('local', { recursive: true });
fs.writeFileSync(path.join('local', 'lab-model.json'), JSON.stringify(row, null, 1));
console.log('walls', D.walls.length, 'doors', D.doors.length, 'xs', D.xs.length, 'ys', D.ys.length);

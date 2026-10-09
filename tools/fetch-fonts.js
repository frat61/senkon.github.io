// Downloads the Fraunces and Work Sans woff2 files (latin + latin-ext) from Google Fonts once
// and writes assets/senkon/fonts/fonts.css with local urls, so the site makes no third-party
// font request. Usage: node tools/fetch-fonts.js
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const CSS_URL = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Work+Sans:wght@400;500;600&display=swap';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const OUT = path.join('assets', 'senkon', 'fonts');
const KEEP = new Set(['latin', 'latin-ext']);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const css = await (await fetch(CSS_URL, { headers: { 'User-Agent': UA } })).text();
  const blocks = css.split('/* ').slice(1);     // "subset */\n@font-face {...}"
  const out = [], hashes = [], seen = new Map();   // sha256 -> file name already written
  for (const b of blocks) {
    const subset = b.slice(0, b.indexOf(' */'));
    if (!KEEP.has(subset)) continue;
    const face = b.slice(b.indexOf('@font-face'));
    const family = /font-family: '([^']+)'/.exec(face)[1];
    const weight = /font-weight: ([0-9 ]+);/.exec(face)[1].replace(' ', '-');
    const url = /url\(([^)]+)\)/.exec(face)[1];
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    let name = seen.get(sha);
    if (name) {
      hashes.push(`${family.toLowerCase().replace(/\s+/g, '-')}-${weight}-${subset}  (same file as ${name})`);
    } else {
      name = `${family.toLowerCase().replace(/\s+/g, '-')}-${subset}-${sha.slice(0, 8)}.woff2`;
      seen.set(sha, name);
      fs.writeFileSync(path.join(OUT, name), buf);
      hashes.push(`${name}  ${sha}  ${buf.length}`);
    }
    out.push('/* ' + subset + ' */\n' + face.replace(url, './' + name).trim());
  }
  fs.writeFileSync(path.join(OUT, 'fonts.css'), out.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'SOURCES.txt'), `Downloaded ${new Date().toISOString()} from\n${CSS_URL}\n\n${hashes.join('\n')}\n`);
  console.log(seen.size + ' font files written to ' + OUT + ' (' + out.length + ' @font-face blocks)');
})().catch(e => { console.error(e); process.exit(1); });

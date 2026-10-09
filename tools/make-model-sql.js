// Prints an INSERT for one model row from a row-shaped JSON file ({name, description, kind, data}).
// A fresh random slug is generated each run; the owner is looked up by e-mail in auth.users.
// Usage: node tools/make-model-sql.js local/lab-model.json owner@example.com > local/lab-model.sql
'use strict';
const fs = require('fs');
const file = process.argv[2], email = process.argv[3];
if (!file || !email) { console.error('usage: node tools/make-model-sql.js <row.json> <owner-email>'); process.exit(1); }
const row = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!row.name || !row.data) { console.error('row.json needs name and data'); process.exit(1); }

const { randomSlug } = require('../model/slug.js');
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const json = JSON.stringify(row.data);
if (json.indexOf('$j$') >= 0) throw new Error('data contains the $j$ delimiter');
const slug = randomSlug(12);
process.stdout.write(
  '-- generated ' + new Date().toISOString() + ' from ' + file + '\n' +
  'insert into public.models (slug, name, description, kind, data, owner)\n' +
  'values (' + q(slug) + ', ' + q(row.name) + ', ' + (row.description ? q(row.description) : 'null') + ', ' + q(row.kind || 'parametric') + ',\n' +
  '  $j$' + json + '$j$::jsonb,\n' +
  '  (select id from auth.users where email = ' + q(email) + '));\n' +
  '-- share link: https://senkonmuhendislik.com/model/?m=' + slug + '\n');

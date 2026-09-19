import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const fail = (m) => { console.error(`FAIL: ${m}`); process.exitCode = 1; };
const pass = (m) => console.log(`PASS: ${m}`);

const required = [
  'index.html','app.js','styles.css','sw.js','manifest.webmanifest','config.js',
  'vendor/supabase-lite.js','restore.html','roster-print.html','PROJECT_MASTER.md','QA_MATRIX.md'
];
for (const f of required) fs.existsSync(f) ? pass(`exists ${f}`) : fail(`missing ${f}`);

const index = read('index.html');
const app = read('app.js');
const sw = read('sw.js');
const cfg = read('config.js');
const restore = read('restore.html');
const roster = read('roster-print.html');

if (index.includes('"https://esm.sh/@supabase/supabase-js@2":"./vendor/supabase-lite.js"')) pass('import map resolves Supabase to same-origin vendor');
else fail('import map missing same-origin Supabase mapping');

if (app.includes("from 'https://esm.sh/@supabase/supabase-js@2'")) pass('app import specifier matches import map');
else fail('app import specifier differs from import map key');

if (restore.includes("from './vendor/supabase-lite.js'")) pass('restore uses local Supabase client');
else fail('restore has non-local Supabase client');

if (roster.includes("from './vendor/supabase-lite.js'")) pass('roster print uses local Supabase client');
else fail('roster print has non-local Supabase client');

if (sw.includes("u.origin!==self.location.origin")) pass('service worker ignores cross-origin requests');
else fail('service worker may cache cross-origin API responses');

if (sw.includes("'./vendor/supabase-lite.js'")) pass('local Supabase client is pre-cached');
else fail('local Supabase client missing from core cache');

if (/service[_-]?role/i.test(cfg)) fail('config contains service-role material');
else pass('config contains no service-role marker');

const legacyParts = fs.readdirSync('.').filter(n => /^app\.part.*\.txt$/i.test(n));
if (legacyParts.length) fail(`legacy app.part files remain: ${legacyParts.join(', ')}`);
else pass('legacy split app.part files absent');

for (const [name, text] of [['app.js',app],['restore.html',restore],['roster-print.html',roster]]) {
  const external = [...text.matchAll(/https:\/\/[^'"`\s)]+/g)].map(m => m[0]).filter(u => !u.startsWith('https://esm.sh/@supabase/supabase-js@2'));
  if (external.length) fail(`${name} unexpected runtime external URLs: ${[...new Set(external)].join(', ')}`);
  else pass(`${name} has no unexpected runtime external URL`);
}

JSON.parse(read('manifest.webmanifest'));
pass('manifest JSON parses');

if (process.exitCode) process.exit(process.exitCode);

const partNames = ['./app.part1.txt', './app.part2.txt', './app.part3.txt', './app.part4.txt'];
const source = (await Promise.all(partNames.map(async p => { const r = await fetch(new URL(p, import.meta.url)); if (!r.ok) throw new Error(`PWA module load failed: ${p}`); return r.text(); }))).join('');
const url = URL.createObjectURL(new Blob([source], {type:'text/javascript'}));
try { await import(url); } finally { URL.revokeObjectURL(url); }

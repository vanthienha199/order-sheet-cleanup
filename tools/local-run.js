// Runs the same Clean.gs logic locally on the sample export and writes tab separated files
// that can be pasted into a sheet with Paste values only. Used for the screenshots because
// Google blocks unverified scripts on the demo account.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const mod = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'apps-script', 'Clean.gs'), 'utf8'), { module: mod, Math, Date, String, Object, JSON, parseInt, parseFloat, isNaN });
const { cleanOrders_, summarize_, CLEAN_HEADERS } = mod.exports;

function readCsv(file) {
  return fs.readFileSync(file, 'utf8').trim().split('\n').map((line) => {
    const r = [];
    let c = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q && ch === '"' && line[i + 1] === '"') { c += '"'; i++; }
      else if (ch === '"') q = !q;
      else if (ch === ',' && !q) { r.push(c); c = ''; }
      else c += ch;
    }
    r.push(c);
    return r;
  });
}

const raw = readCsv(path.join(ROOT, 'data', 'raw_orders.csv'));
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'catalog.json'), 'utf8'));
const { clean, stats } = cleanOrders_(raw.slice(1), catalog);
const summary = summarize_(clean, process.argv[2] || '2026-10-04');

const tsv = (rows) => rows.map((r) => r.map((v) => String(v).replace(/\t|\n/g, ' ')).join('\t')).join('\n');
const out = path.join(ROOT, 'local-run');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'raw.tsv'), tsv(raw));
fs.writeFileSync(path.join(out, 'clean.tsv'), tsv([CLEAN_HEADERS, ...clean]));
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ stats, summary }, null, 2));
console.log(JSON.stringify(stats));
console.log(JSON.stringify(summary.kpis));

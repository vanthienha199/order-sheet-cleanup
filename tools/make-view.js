// Builds preview/data.js for the run view: the cleaned sheet, which cells the
// script changed, which rows it held back, and a log of what it did.
//
// It runs the same Clean.gs logic the Apps Script runs, with no Google calls,
// so nothing here is mocked up. Google blocks unverified scripts on the demo
// account, which is why the view is built from a local run and says so.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const mod = { exports: {} };
vm.runInNewContext(
  fs.readFileSync(path.join(ROOT, 'apps-script', 'Clean.gs'), 'utf8'),
  { module: mod, Math, Date, String, Object, JSON, parseInt, parseFloat, isNaN }
);
const { cleanOrders_, summarize_, CLEAN_HEADERS } = mod.exports;

// Which column each fix or issue belongs to, so a changed cell can be shown
// where it actually sits rather than only named in a note.
const COLUMN_OF = {
  'order id': 0, date: 1, name: 2, customer: 2, email: 3, region: 4,
  sku: 5, product: 6, qty: 7, price: 8, 'price from catalog': 8,
  total: 9, 'total recalculated': 9, status: 10,
};

function readCsv(file) {
  return fs.readFileSync(file, 'utf8').trim().split('\n').map((line) => {
    const cells = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted && ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) { cells.push(cell); cell = ''; }
      else cell += ch;
    }
    cells.push(cell);
    return cells;
  });
}

function columnsFromNote(note) {
  if (!note) return { changed: [], flagged: [] };
  if (note.indexOf('Check:') === 0) {
    const names = note.slice(6).split(',').map((s) => s.trim());
    return { changed: [], flagged: names.map((n) => COLUMN_OF[n]).filter((n) => n !== undefined) };
  }
  const names = note.split(',').map((s) => s.trim());
  return { changed: names.map((n) => COLUMN_OF[n]).filter((n) => n !== undefined), flagged: [] };
}

function main() {
  const raw = readCsv(path.join(ROOT, 'data', 'raw_orders.csv'));
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'catalog.json'), 'utf8'));
  const { clean, stats } = cleanOrders_(raw.slice(1), catalog);
  const summary = summarize_(clean, '2026-09-30');

  const rows = clean.map((r) => {
    const note = r[11];
    const { changed, flagged } = columnsFromNote(note);
    return { cells: r.slice(0, 11), note, changed, flagged };
  });

  // The log is this run only. There is no invented history of past runs.
  const log = rows
    .filter((r) => r.changed.length || r.flagged.length)
    .map((r) => ({
      id: r.cells[0],
      kind: r.flagged.length ? 'held' : 'fixed',
      what: r.note.replace(/^Check: /, ''),
      count: r.flagged.length || r.changed.length,
    }));

  // The raw export as it arrives, so the before and after are the same view
  // rather than two different kinds of picture.
  const rawHeaders = raw[0];
  const rawRows = raw.slice(1, 60).map((cells) => ({ cells }));

  const payload = {
    rawHeaders,
    rawRows,
    generated: new Date().toISOString().slice(0, 16).replace('T', ' '),
    headers: CLEAN_HEADERS.slice(0, 11),
    rows,
    log,
    stats,
    summary: summary.kpis,
    source: 'data/raw_orders.csv',
    note: 'Built by running the same Clean.gs logic locally, because the demo Google account blocks unverified scripts.',
  };

  const out = path.join(ROOT, 'preview', 'data.js');
  fs.writeFileSync(out, 'window.RUN = ' + JSON.stringify(payload) + ';\n');
  console.log(
    `${stats.input} rows in, ${stats.output} out, ${stats.fixes} cells fixed, ` +
    `${stats.flagged} held for a person, ${stats.duplicates} duplicates and ${stats.blank} blanks dropped`
  );
  console.log(`  wrote ${path.relative(ROOT, out)}`);
}

main();

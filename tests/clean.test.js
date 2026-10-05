const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const mod = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'apps-script', 'Clean.gs'), 'utf8'), { module: mod, Math, Date, String, Object, JSON, parseInt, parseFloat, isNaN });
const { cleanOrders_, summarize_, parseDate_, parseMoney_, cleanEmail_, weekStart_, CLEAN_HEADERS } = mod.exports;

function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8').trim();
  const rows = [];
  for (const line of text.split('\n')) {
    const row = [];
    let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q && ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = !q;
      else if (ch === ',' && !q) { row.push(cur); cur = ''; }
      else cur += ch;
    }
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

const raw = readCsv(path.join(ROOT, 'data', 'raw_orders.csv')).slice(1);
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'catalog.json'), 'utf8'));

test('dates in five formats become ISO', () => {
  for (const s of ['2026-09-14', '9/14/2026', '09/14/26', '14 Sep 2026', 'Sep 14, 2026']) assert.equal(parseDate_(s), '2026-09-14', s);
  assert.equal(parseDate_('2/30/2026'), null);
  assert.equal(parseDate_('soon'), null);
});

test('money strings become numbers', () => {
  assert.equal(parseMoney_('$1,204.50'), 1204.5);
  assert.equal(parseMoney_('1204.5 USD'), 1204.5);
  assert.equal(parseMoney_('USD 89.00'), 89);
  assert.equal(parseMoney_('(12.00)'), -12);
  assert.equal(parseMoney_('n/a'), null);
});

test('emails are lowercased and common typos fixed', () => {
  assert.equal(cleanEmail_(' HANNAH.VARGA@EXAMPLE.COM '), 'hannah.varga@example.com');
  assert.equal(cleanEmail_('leila.nguyen24@example.con'), 'leila.nguyen24@example.com');
  assert.equal(cleanEmail_('not an email'), '');
});

test('weeks start on Monday', () => {
  assert.equal(weekStart_('2026-10-04'), '2026-09-28');
  assert.equal(weekStart_('2026-09-28'), '2026-09-28');
});

test('the full messy export cleans without losing real orders', () => {
  const { clean, stats } = cleanOrders_(raw, catalog);
  const ids = raw.filter((r) => r.some((c) => c.trim())).map((r) => r[0].toUpperCase().replace(/^#/, '').replace(/^FN-?/, 'FN-'));
  const unique = new Set(ids);
  assert.equal(stats.blank, raw.length - ids.length);
  assert.equal(stats.duplicates, ids.length - unique.size);
  assert.equal(clean.length, unique.size);
  assert.equal(new Set(clean.map((r) => r[0])).size, clean.length);
  for (const r of clean) {
    assert.equal(r.length, CLEAN_HEADERS.length);
    assert.match(r[0], /^FN-\d+$/);
    assert.match(r[1], /^2026-\d\d-\d\d$/);
    assert.ok(['Delivered', 'Shipped', 'Pending', 'Refunded', 'Cancelled'].includes(r[10]), r[10]);
    assert.ok(['Northeast', 'Southeast', 'Midwest', 'West', 'Southwest'].includes(r[4]), r[4]);
    assert.equal(r[2], r[2].trim());
    if (r[7] !== '' && r[8] !== '') assert.equal(r[9], Math.round(r[7] * r[8] * 100) / 100);
  }
  console.log(JSON.stringify(stats));
});

test('rows that cannot be fixed are flagged, not dropped', () => {
  const { clean, stats } = cleanOrders_([['FN-1', 'someday', 'Ana Ruiz', 'ana@x.io', 'W', 'PEN-GEL-07', 'Gel Pen', '2', '3.25', '6.50', 'shipped']], catalog);
  assert.equal(clean.length, 1);
  assert.equal(stats.flagged, 1);
  assert.match(clean[0][11], /Check: order id, date/);
});

test('summary numbers add up', () => {
  const { clean } = cleanOrders_(raw, catalog);
  const s = summarize_(clean, '2026-10-04');
  assert.equal(s.week, '2026-09-28');
  const counted = clean.filter((r) => r[10] !== 'Cancelled');
  const net = counted.reduce((a, r) => a + (r[10] === 'Refunded' ? 0 : r[9]), 0);
  const weeklySum = s.weekly.reduce((a, w) => a + w[2], 0);
  assert.ok(Math.abs(weeklySum - net) < 0.05);
  assert.ok(Math.abs(s.regions.reduce((a, r) => a + r[1], 0) - net) < 0.05);
  assert.ok(s.kpis.revenue > 0 && s.kpis.orders > 0);
  console.log(JSON.stringify(s.kpis));
});

test('weekly email html has the numbers from the summary', () => {
  const rmod = { exports: {} };
  const ctx = { module: rmod, Math, Date, String, JSON };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'apps-script', 'Report.gs'), 'utf8'), ctx);
  const { clean, stats } = cleanOrders_(raw, catalog);
  const s = summarize_(clean, '2026-10-04');
  const html = rmod.exports.buildReportHtml_(s, stats, { company: 'Fieldnote Supply Co. (sample)' });
  assert.ok(html.includes(rmod.exports.money_(s.kpis.revenue)));
  assert.ok(html.includes('Week of Sep 28 to Oct 4, 2026'));
  assert.ok(html.includes(s.products[0][0]));
  assert.ok(html.includes(`${stats.duplicates} duplicates removed`));
  fs.mkdirSync(path.join(ROOT, 'preview'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'preview', 'weekly-email.html'), `<!doctype html><meta charset="utf-8"><body style="margin:0">${html}</body>`);
});

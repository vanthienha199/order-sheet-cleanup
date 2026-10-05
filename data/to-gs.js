// Writes apps-script/SampleData.gs from data/raw_orders.csv and data/catalog.json, so the demo sheet can load itself.
const fs = require('fs');
const path = require('path');
const text = fs.readFileSync(path.join(__dirname, 'raw_orders.csv'), 'utf8').trim();
const rows = text.split('\n').map((line) => {
  const r = []; let c = '', q = false;
  for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q && ch === '"' && line[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = !q; else if (ch === ',' && !q) { r.push(c); c = ''; } else c += ch; }
  r.push(c); return r;
});
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog.json'), 'utf8'));
const out = `/** Synthetic sample data for the demo. Halvorsen Office Supply is fictional and every name is made up. */
var SAMPLE_RAW_ORDERS = ${JSON.stringify(rows)};
var SAMPLE_CATALOG = ${JSON.stringify([['SKU', 'Product', 'Price'], ...Object.entries(catalog).map(([s, v]) => [s, v.name, v.price])])};

function loadSampleData() {
  var ss = SpreadsheetApp.getActive();
  var put = function (name, values) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.clear();
    sh.getRange(1, 1, values.length, values[0].length).setNumberFormat('@').setValues(values);
    styleHeader_(sh.getRange(1, 1, 1, values[0].length));
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, values[0].length);
    return sh;
  };
  put(TAB.raw, SAMPLE_RAW_ORDERS);
  put(TAB.catalog, SAMPLE_CATALOG);
  var settings = put(TAB.settings, [['Setting', 'Value'], ['Report recipients', Session.getActiveUser().getEmail()]]);
  settings.getRange('A3').setValue('Separate several addresses with commas.').setFontColor(COLOR.muted);
  var first = ss.getSheets()[0];
  if (first.getName() !== TAB.raw && first.getLastRow() === 0) ss.deleteSheet(first);
  ss.setActiveSheet(ss.getSheetByName(TAB.raw));
  ss.toast((SAMPLE_RAW_ORDERS.length - 1) + ' messy order rows loaded into "' + TAB.raw + '".', 'Sample data ready', 6);
}
`;
fs.writeFileSync(path.join(__dirname, '..', 'apps-script', 'SampleData.gs'), out);
console.log('SampleData.gs rows:', rows.length - 1, 'bytes:', out.length);

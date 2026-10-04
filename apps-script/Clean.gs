/**
 * Pure cleaning logic, no SpreadsheetApp calls, so the same file runs in Apps Script and in Node tests.
 */

var CLEAN_HEADERS = ['Order ID', 'Order date', 'Customer', 'Email', 'Region', 'SKU', 'Product', 'Qty', 'Unit price', 'Total', 'Status', 'Fixes applied'];

var STATUS_MAP = {
  shipped: 'Shipped', shiped: 'Shipped', 'ship': 'Shipped', sent: 'Shipped', delivered: 'Delivered', dlvrd: 'Delivered',
  pending: 'Pending', 'pend': 'Pending', processing: 'Pending', 'in progress': 'Pending',
  refunded: 'Refunded', refund: 'Refunded', returned: 'Refunded', cancelled: 'Cancelled', canceled: 'Cancelled', cancel: 'Cancelled'
};

var REGION_MAP = {
  ne: 'Northeast', northeast: 'Northeast', 'north east': 'Northeast',
  se: 'Southeast', southeast: 'Southeast', 'south east': 'Southeast',
  mw: 'Midwest', midwest: 'Midwest', 'mid west': 'Midwest',
  w: 'West', west: 'West', 'west coast': 'West',
  sw: 'Southwest', southwest: 'Southwest', 'south west': 'Southwest'
};

var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };

function squish_(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}

function titleCase_(s) {
  return s.toLowerCase().replace(/(^|[\s'\-])([a-z])/g, function (m, p, c) { return p + c.toUpperCase(); })
    .replace(/\bMc([a-z])/g, function (m, c) { return 'Mc' + c.toUpperCase(); });
}

function pad_(n) { return (n < 10 ? '0' : '') + n; }

function isoDate_(y, m, d) {
  var dt = new Date(Date.UTC(y, m, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m || dt.getUTCDate() !== d) return null;
  return y + '-' + pad_(m + 1) + '-' + pad_(d);
}

/** Accepts 2026-09-14, 09/14/2026, 9/14/26, 14 Sep 2026, Sep 14, 2026, and real Date objects. */
function parseDate_(value) {
  if (value instanceof Date && !isNaN(value)) return isoDate_(value.getFullYear(), value.getMonth(), value.getDate());
  var s = squish_(value).toLowerCase().replace(/,/g, '');
  var m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return isoDate_(+m[1], +m[2] - 1, +m[3]);
  if ((m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})$/))) {
    var y = +m[3];
    if (y < 100) y += 2000;
    return isoDate_(y, +m[1] - 1, +m[2]);
  }
  if ((m = s.match(/^(\d{1,2}) ([a-z]+) (\d{4})$/)) && MONTHS[m[2].slice(0, 4)] != null) return isoDate_(+m[3], MONTHS[m[2].slice(0, 4)], +m[1]);
  if ((m = s.match(/^([a-z]+) (\d{1,2}) (\d{4})$/)) && MONTHS[m[1].slice(0, 4)] != null) return isoDate_(+m[3], MONTHS[m[1].slice(0, 4)], +m[2]);
  if ((m = s.match(/^([a-z]{3})[a-z]* (\d{1,2}) (\d{4})$/)) && MONTHS[m[1]] != null) return isoDate_(+m[3], MONTHS[m[1]], +m[2]);
  return null;
}

/** "$1,204.50", "1204.5 USD", "USD 89", "(12.00)", 42 */
function parseMoney_(value) {
  if (typeof value === 'number') return Math.round(value * 100) / 100;
  var s = squish_(value).toUpperCase().replace(/USD|US\$|\$|,|\s/g, '');
  var neg = /^\(.*\)$/.test(s) || s.indexOf('-') === 0;
  s = s.replace(/[()\-]/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  var n = Math.round(parseFloat(s) * 100) / 100;
  return neg ? -n : n;
}

function parseQty_(value) {
  if (typeof value === 'number') return Math.round(value);
  var m = squish_(value).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function cleanEmail_(value) {
  var s = squish_(value).toLowerCase().replace(/\s/g, '').replace(/,$/, '').replace(/\.con$/, '.com').replace(/@gmial\./, '@gmail.');
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(s) ? s : '';
}

/**
 * rows: array of arrays with the raw export columns
 * [Order ID, Date, Customer, Email, Region, SKU, Product, Qty, Unit price, Total, Status]
 * returns { clean: [...rows matching CLEAN_HEADERS], flagged: count, duplicates: count, blank: count }
 */
function cleanOrders_(rows, catalog) {
  var seen = {};
  var out = [];
  var stats = { input: rows.length, blank: 0, duplicates: 0, flagged: 0, fixes: 0 };

  rows.forEach(function (r) {
    if (!r || r.every(function (c) { return squish_(c) === ''; })) { stats.blank++; return; }
    var fixes = [];
    var issues = [];

    var id = squish_(r[0]).toUpperCase().replace(/^#/, '').replace(/^FN-?/, 'FN-');
    if (!/^FN-\d{4,}$/.test(id)) issues.push('order id');
    if (seen[id]) { stats.duplicates++; return; }
    seen[id] = true;

    var date = parseDate_(r[1]);
    if (!date) issues.push('date');
    else if (squish_(r[1]) !== date) fixes.push('date');

    var rawName = squish_(r[2]);
    var name = rawName ? titleCase_(rawName) : '';
    if (!name) issues.push('customer');
    else if (name !== String(r[2])) fixes.push('name');

    var email = cleanEmail_(r[3]);
    if (!email) issues.push('email');
    else if (email !== String(r[3])) fixes.push('email');

    var regionKey = squish_(r[4]).toLowerCase();
    var region = REGION_MAP[regionKey] || '';
    if (!region) issues.push('region');
    else if (region !== r[4]) fixes.push('region');

    var sku = squish_(r[5]).toUpperCase().replace(/\s|_/g, '-');
    var product = (catalog && catalog[sku] && catalog[sku].name) || titleCase_(squish_(r[6]));
    if (product !== r[6]) fixes.push('product');

    var qty = parseQty_(r[7]);
    if (!qty || qty < 1) { issues.push('qty'); qty = null; }

    var price = parseMoney_(r[8]);
    if (price == null && catalog && catalog[sku]) { price = catalog[sku].price; fixes.push('price from catalog'); }
    if (price == null) issues.push('price');

    var total = parseMoney_(r[9]);
    var expected = qty != null && price != null ? Math.round(qty * price * 100) / 100 : null;
    if (expected != null && (total == null || Math.abs(total - expected) > 0.01)) { total = expected; fixes.push('total recalculated'); }
    if (total == null) issues.push('total');

    var status = STATUS_MAP[squish_(r[10]).toLowerCase()] || '';
    if (!status) issues.push('status');
    else if (status !== r[10]) fixes.push('status');

    if (issues.length) stats.flagged++;
    stats.fixes += fixes.length;
    var note = issues.length ? 'Check: ' + issues.join(', ') : (fixes.length ? fixes.join(', ') : '');
    out.push([id, date || squish_(r[1]), name, email, region, sku, product, qty == null ? '' : qty, price == null ? '' : price, total == null ? '' : total, status, note]);
  });

  out.sort(function (a, b) { return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : (a[0] < b[0] ? -1 : 1); });
  stats.output = out.length;
  return { clean: out, stats: stats };
}

/** Monday of the ISO week for a yyyy-mm-dd string. */
function weekStart_(iso) {
  var p = iso.split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  var dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.getUTCFullYear() + '-' + pad_(d.getUTCMonth() + 1) + '-' + pad_(d.getUTCDate());
}

/** Builds the numbers for the Summary tab and the weekly email from cleaned rows. */
function summarize_(clean, asOfIso) {
  var counted = clean.filter(function (r) { return r[1] && /^\d{4}-/.test(r[1]) && r[9] !== '' && r[10] !== 'Cancelled'; });
  var weeks = {};
  var regions = {};
  var products = {};
  counted.forEach(function (r) {
    var w = weekStart_(r[1]);
    var net = r[10] === 'Refunded' ? 0 : r[9];
    weeks[w] = weeks[w] || { revenue: 0, orders: 0, refunds: 0 };
    weeks[w].orders++;
    weeks[w].revenue += net;
    if (r[10] === 'Refunded') weeks[w].refunds++;
    regions[r[4] || 'Unknown'] = (regions[r[4] || 'Unknown'] || 0) + net;
    products[r[6]] = products[r[6]] || { revenue: 0, units: 0 };
    products[r[6]].revenue += net;
    products[r[6]].units += r[10] === 'Refunded' ? 0 : r[7];
  });

  var weekKeys = Object.keys(weeks).sort();
  var current = asOfIso ? weekStart_(asOfIso) : weekKeys[weekKeys.length - 1];
  var idx = weekKeys.indexOf(current);
  var thisWeek = weeks[current] || { revenue: 0, orders: 0, refunds: 0 };
  var lastWeek = idx > 0 ? weeks[weekKeys[idx - 1]] : { revenue: 0, orders: 0, refunds: 0 };
  var r2 = function (n) { return Math.round(n * 100) / 100; };
  var delta = function (a, b) { return b ? r2((a - b) / b) : null; };

  return {
    week: current,
    kpis: {
      revenue: r2(thisWeek.revenue),
      orders: thisWeek.orders,
      aov: thisWeek.orders ? r2(thisWeek.revenue / (thisWeek.orders - thisWeek.refunds || 1)) : 0,
      refundRate: thisWeek.orders ? r2(thisWeek.refunds / thisWeek.orders) : 0,
      revenueDelta: delta(thisWeek.revenue, lastWeek.revenue),
      ordersDelta: delta(thisWeek.orders, lastWeek.orders)
    },
    weekly: weekKeys.map(function (k) { return [k, weeks[k].orders, r2(weeks[k].revenue), weeks[k].refunds]; }),
    regions: Object.keys(regions).map(function (k) { return [k, r2(regions[k])]; }).sort(function (a, b) { return b[1] - a[1]; }),
    products: Object.keys(products).map(function (k) { return [k, products[k].units, r2(products[k].revenue)]; }).sort(function (a, b) { return b[2] - a[2]; })
  };
}

if (typeof module !== 'undefined') {
  module.exports = { cleanOrders_: cleanOrders_, summarize_: summarize_, parseDate_: parseDate_, parseMoney_: parseMoney_, cleanEmail_: cleanEmail_, weekStart_: weekStart_, CLEAN_HEADERS: CLEAN_HEADERS };
}

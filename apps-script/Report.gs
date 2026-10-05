/**
 * Weekly email body. Pure string building so it can be previewed and tested outside Apps Script.
 */

function money_(n) {
  var s = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-$' : '$') + s;
}

function pct_(n) {
  if (n == null) return 'n/a';
  return (n > 0 ? '+' : '') + Math.round(n * 1000) / 10 + '%';
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function prettyWeek_(iso) {
  var m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var p = iso.split('-');
  var start = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  var end = new Date(start.getTime() + 6 * 86400000);
  return m[start.getUTCMonth()] + ' ' + start.getUTCDate() + ' to ' + m[end.getUTCMonth()] + ' ' + end.getUTCDate() + ', ' + end.getUTCFullYear();
}

function buildReportHtml_(summary, stats, opts) {
  opts = opts || {};
  var k = summary.kpis;
  var ink = '#15171B', muted = '#6E6A63', line = '#E6E1D8', accent = '#111111', tile = '#F6F3EE';
  var deltaColor = function (n) { return n == null ? muted : n >= 0 ? '#2E7D4F' : '#B3432F'; };
  var tileHtml = function (label, value, delta) {
    return '<td style="padding:16px;background:' + tile + ';border-radius:10px;width:25%;vertical-align:top">' +
      '<div style="font:600 11px Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:' + muted + '">' + label + '</div>' +
      '<div style="font:700 24px Arial,sans-serif;color:' + ink + ';margin-top:6px">' + value + '</div>' +
      (delta !== undefined ? '<div style="font:12px Arial,sans-serif;color:' + deltaColor(delta) + ';margin-top:4px">' + pct_(delta) + ' vs last week</div>' : '') +
      '</td>';
  };
  var maxRev = Math.max.apply(null, summary.weekly.map(function (w) { return w[2]; }).concat([1]));
  var bars = summary.weekly.slice(-6).map(function (w) {
    var h = Math.max(4, Math.round(w[2] / maxRev * 90));
    var on = w[0] === summary.week;
    return '<td style="vertical-align:bottom;text-align:center;padding:0 6px">' +
      '<div style="font:11px Arial,sans-serif;color:' + muted + ';margin-bottom:4px">' + money_(Math.round(w[2])).replace('.00', '') + '</div>' +
      '<div style="height:' + h + 'px;background:' + (on ? '#F2B705' : '#CFC9BE') + ';border-radius:4px 4px 0 0"></div>' +
      '<div style="font:11px Arial,sans-serif;color:' + muted + ';margin-top:4px">' + w[0].slice(5).replace('-', '/') + '</div></td>';
  }).join('');
  var top = summary.products.slice(0, 5).map(function (p, i) {
    return '<tr><td style="padding:8px 0;border-top:1px solid ' + line + ';font:14px Arial,sans-serif;color:' + ink + '">' + (i + 1) + '. ' + esc_(p[0]) + '</td>' +
      '<td style="padding:8px 0;border-top:1px solid ' + line + ';font:14px Arial,sans-serif;color:' + muted + ';text-align:right">' + p[1] + ' units</td>' +
      '<td style="padding:8px 0;border-top:1px solid ' + line + ';font:600 14px Arial,sans-serif;color:' + ink + ';text-align:right">' + money_(p[2]) + '</td></tr>';
  }).join('');
  var regions = summary.regions.map(function (r) {
    return '<tr><td style="padding:6px 0;font:14px Arial,sans-serif;color:' + ink + '">' + esc_(r[0]) + '</td><td style="padding:6px 0;font:14px Arial,sans-serif;color:' + ink + ';text-align:right">' + money_(r[1]) + '</td></tr>';
  }).join('');

  return '<div style="background:#EFEBE4;padding:24px 0">' +
    '<table role="presentation" width="600" align="center" style="background:#fff;border-radius:12px;border-collapse:separate;padding:32px">' +
    '<tr><td>' +
    '<div style="font:600 12px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:' + accent + '">' + esc_(opts.company || 'Weekly report') + '</div>' +
    '<h1 style="font:700 26px Arial,sans-serif;color:' + ink + ';margin:6px 0 4px">Week of ' + prettyWeek_(summary.week) + '</h1>' +
    '<p style="font:14px Arial,sans-serif;color:' + muted + ';margin:0 0 20px">Sent automatically from the order sheet every Monday at 7 AM.</p>' +
    '<table role="presentation" width="100%" style="border-collapse:separate;border-spacing:8px 0;margin:0 -8px"><tr>' +
    tileHtml('Net revenue', money_(k.revenue), k.revenueDelta) + tileHtml('Orders', k.orders, k.ordersDelta) +
    tileHtml('Avg order', money_(k.aov)) + tileHtml('Refund rate', Math.round(k.refundRate * 1000) / 10 + '%') +
    '</tr></table>' +
    '<h2 style="font:700 16px Arial,sans-serif;color:' + ink + ';margin:28px 0 10px">Revenue by week</h2>' +
    '<table role="presentation" width="100%" style="border-collapse:collapse;height:130px"><tr>' + bars + '</tr></table>' +
    '<h2 style="font:700 16px Arial,sans-serif;color:' + ink + ';margin:28px 0 4px">Top products</h2>' +
    '<table role="presentation" width="100%" style="border-collapse:collapse">' + top + '</table>' +
    '<h2 style="font:700 16px Arial,sans-serif;color:' + ink + ';margin:28px 0 4px">Revenue by region, all weeks</h2>' +
    '<table role="presentation" width="100%" style="border-collapse:collapse">' + regions + '</table>' +
    '<p style="font:13px Arial,sans-serif;color:' + muted + ';margin:28px 0 0;padding-top:16px;border-top:1px solid ' + line + '">' +
    'Data cleanup this run: ' + stats.input + ' raw rows, ' + stats.duplicates + ' duplicates removed, ' + stats.blank + ' blank rows skipped, ' +
    stats.flagged + ' rows flagged for a human check.' + (opts.sheetUrl ? ' <a href="' + opts.sheetUrl + '" style="color:' + accent + '">Open the sheet</a>' : '') + '</p>' +
    '</td></tr></table></div>';
}

if (typeof module !== 'undefined') module.exports = { buildReportHtml_: buildReportHtml_, money_: money_, pct_: pct_ };

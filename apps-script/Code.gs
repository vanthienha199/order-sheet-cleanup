/**
 * Order cleanup and weekly report for a Google Sheet.
 * Tabs: "Raw Orders" (pasted export), "Catalog" (SKU, name, price), "Settings" (report recipients).
 * Creates: "Clean Orders", "Summary", "Run Log".
 */

var TAB = { raw: 'Raw Orders', catalog: 'Catalog', clean: 'Clean Orders', summary: 'Summary', settings: 'Settings', log: 'Run Log' };
var COLOR = { ink: '#111111', muted: '#5E5C57', head: '#111111', headInk: '#FFFFFF', band: '#F7F6F1', flag: '#F2B705', chart: '#111111', line: '#E4E2DA' };
var FONT = { display: 'Zilla Slab', body: 'IBM Plex Sans', mono: 'IBM Plex Mono' };
var COMPANY = 'Halvorsen Office Supply';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Order tools')
    .addItem('Load sample data', 'loadSampleData')
    .addItem('Run everything', 'runAll')
    .addSeparator()
    .addItem('1. Clean raw orders', 'cleanOrders')
    .addItem('2. Build summary', 'buildSummary')
    .addItem('3. Email weekly report now', 'sendWeeklyReport')
    .addSeparator()
    .addItem('Schedule weekly email (Mondays 7 AM)', 'installWeeklyTrigger')
    .addToUi();
}

function runAll() {
  var result = cleanOrders();
  buildSummary();
  sendWeeklyReport();
  return result;
}

function sheet_(name, create) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(name);
  if (!sh && create) sh = ss.insertSheet(name);
  if (!sh) throw new Error('Missing tab "' + name + '".');
  return sh;
}

function readCatalog_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(TAB.catalog);
  var out = {};
  if (!sh) return out;
  sh.getDataRange().getValues().slice(1).forEach(function (r) {
    if (r[0]) out[String(r[0]).trim().toUpperCase()] = { name: String(r[1]).trim(), price: Number(r[2]) };
  });
  return out;
}

function styleHeader_(range) {
  range.setBackground(COLOR.head).setFontColor(COLOR.headInk).setFontWeight('bold').setFontFamily(FONT.display).setVerticalAlignment('middle');
}

function log_(action, detail) {
  var sh = sheet_(TAB.log, true);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['When', 'Action', 'Detail']);
    styleHeader_(sh.getRange(1, 1, 1, 3));
    sh.setFrozenRows(1);
  }
  sh.appendRow([new Date(), action, detail]);
}

function cleanOrders() {
  var raw = sheet_(TAB.raw).getDataRange().getDisplayValues().slice(1);
  var result = cleanOrders_(raw, readCatalog_());
  var sh = sheet_(TAB.clean, true);
  sh.clear();
  sh.getBandings().forEach(function (b) { b.remove(); });
  if (sh.getFilter()) sh.getFilter().remove();

  var all = [CLEAN_HEADERS].concat(result.clean);
  sh.getRange(1, 1, all.length, CLEAN_HEADERS.length).setValues(all).setFontFamily(FONT.body).setFontSize(10);
  styleHeader_(sh.getRange(1, 1, 1, CLEAN_HEADERS.length));
  sh.setRowHeight(1, 32);
  sh.setFrozenRows(1);
  var body = sh.getRange(2, 1, result.clean.length, CLEAN_HEADERS.length);
  body.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false).setFirstRowColor('#FFFFFF').setSecondRowColor(COLOR.band);
  sh.getRange(2, 2, result.clean.length, 1).setNumberFormat('yyyy-mm-dd');
  sh.getRange(2, 8, result.clean.length, 1).setNumberFormat('0');
  sh.getRange(2, 9, result.clean.length, 2).setNumberFormat('$#,##0.00');
  sh.getRange(2, 12, result.clean.length, 1).setFontColor(COLOR.muted).setFontStyle('italic');

  var flagged = sh.getRange(2, 1, result.clean.length, CLEAN_HEADERS.length);
  var rule = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=LEFT($L2,6)="Check:"').setBackground(COLOR.flag).setRanges([flagged]).build();
  sh.setConditionalFormatRules([rule]);
  sh.getRange(1, 1, all.length, CLEAN_HEADERS.length).createFilter();
  sh.autoResizeColumns(1, CLEAN_HEADERS.length);
  sh.setColumnWidth(12, 240);

  var s = result.stats;
  var detail = s.input + ' raw rows, ' + s.output + ' clean orders, ' + s.duplicates + ' duplicates removed, ' + s.blank + ' blank rows, ' + s.fixes + ' fields fixed, ' + s.flagged + ' flagged';
  log_('Clean', detail);
  PropertiesService.getDocumentProperties().setProperty('lastStats', JSON.stringify(s));
  SpreadsheetApp.getActive().toast(detail, 'Cleanup finished', 8);
  return s;
}

function readClean_() {
  return sheet_(TAB.clean).getDataRange().getValues().slice(1).map(function (r) {
    var d = r[1] instanceof Date ? Utilities.formatDate(r[1], SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd') : String(r[1]);
    return [r[0], d, r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11]];
  });
}

function buildSummary() {
  var clean = readClean_();
  var s = summarize_(clean, todayIso_());
  var sh = sheet_(TAB.summary, true);
  sh.clear();
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  sh.setHiddenGridlines(true);
  sh.getRange('A:Z').setFontFamily(FONT.body).setFontColor(COLOR.ink);
  sh.setColumnWidth(1, 24);
  [2, 3, 4, 5, 6, 7, 8, 9].forEach(function (c) { sh.setColumnWidth(c, 132); });

  sh.getRange('B2').setValue(COMPANY).setFontSize(10).setFontColor(COLOR.muted).setFontWeight('bold');
  sh.getRange('B3').setValue('Week of ' + prettyWeek_(s.week)).setFontSize(20).setFontWeight('bold').setFontFamily(FONT.display);

  var tiles = [
    ['Net revenue', s.kpis.revenue, '$#,##0.00', s.kpis.revenueDelta],
    ['Orders', s.kpis.orders, '0', s.kpis.ordersDelta],
    ['Avg order', s.kpis.aov, '$#,##0.00', null],
    ['Refund rate', s.kpis.refundRate, '0.0%', null]
  ];
  tiles.forEach(function (t, i) {
    var col = 2 + i * 2;
    var box = sh.getRange(5, col, 3, 2);
    box.setBackground(COLOR.band);
    sh.getRange(5, col).setValue(t[0].toUpperCase()).setFontSize(9).setFontColor(COLOR.muted).setFontWeight('bold');
    sh.getRange(6, col).setValue(t[1]).setNumberFormat(t[2]).setFontSize(20).setFontWeight('bold');
    if (t[3] != null) sh.getRange(7, col).setValue(pct_(t[3]) + ' vs last week').setFontSize(9).setFontColor(t[3] >= 0 ? '#2E7D4F' : '#B3432F');
  });

  var w0 = 10;
  sh.getRange(w0, 2).setValue('Revenue by week').setFontWeight('bold').setFontSize(12);
  var weekly = [['Week starting', 'Orders', 'Net revenue', 'Refunds']].concat(s.weekly);
  sh.getRange(w0 + 1, 2, weekly.length, 4).setValues(weekly);
  styleHeader_(sh.getRange(w0 + 1, 2, 1, 4));
  sh.getRange(w0 + 2, 4, s.weekly.length, 1).setNumberFormat('$#,##0.00');

  var p0 = w0 + weekly.length + 2;
  sh.getRange(p0, 2).setValue('Top products').setFontWeight('bold').setFontSize(12);
  var products = [['Product', 'Units', 'Net revenue']].concat(s.products.slice(0, 8));
  sh.getRange(p0 + 1, 2, products.length, 3).setValues(products);
  styleHeader_(sh.getRange(p0 + 1, 2, 1, 3));
  sh.getRange(p0 + 2, 4, products.length - 1, 1).setNumberFormat('$#,##0.00');

  var r0 = p0 + products.length + 2;
  sh.getRange(r0, 2).setValue('Revenue by region').setFontWeight('bold').setFontSize(12);
  var regions = [['Region', 'Net revenue']].concat(s.regions);
  sh.getRange(r0 + 1, 2, regions.length, 2).setValues(regions);
  styleHeader_(sh.getRange(r0 + 1, 2, 1, 2));
  sh.getRange(r0 + 2, 3, regions.length - 1, 1).setNumberFormat('$#,##0.00');

  sh.insertChart(sh.newChart().asColumnChart()
    .addRange(sh.getRange(w0 + 1, 2, weekly.length, 1)).addRange(sh.getRange(w0 + 1, 4, weekly.length, 1))
    .setPosition(w0, 7, 0, 0).setOption('title', 'Net revenue by week').setOption('legend', { position: 'none' })
    .setOption('colors', [COLOR.chart]).setOption('width', 560).setOption('height', 260)
    .setOption('vAxis', { format: '$#,##0', gridlines: { color: COLOR.line } }).build());
  sh.insertChart(sh.newChart().asBarChart()
    .addRange(sh.getRange(r0 + 1, 2, regions.length, 2))
    .setPosition(p0, 7, 0, 30).setOption('title', 'Revenue by region').setOption('legend', { position: 'none' })
    .setOption('colors', ['#8C877E']).setOption('width', 560).setOption('height', 240)
    .setOption('hAxis', { format: '$#,##0', gridlines: { color: COLOR.line } }).build());

  log_('Summary', 'Week ' + s.week + ': ' + s.kpis.orders + ' orders, ' + pct_(s.kpis.revenueDelta) + ' revenue vs last week');
  return s;
}

function todayIso_() {
  return Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
}

function recipients_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(TAB.settings);
  var v = sh ? String(sh.getRange('B2').getValue()).trim() : '';
  return v || Session.getActiveUser().getEmail();
}

function sendWeeklyReport() {
  var clean = readClean_();
  var s = summarize_(clean, todayIso_());
  var stats = JSON.parse(PropertiesService.getDocumentProperties().getProperty('lastStats') || '{"input":0,"duplicates":0,"blank":0,"flagged":0}');
  var html = buildReportHtml_(s, stats, { company: COMPANY, sheetUrl: SpreadsheetApp.getActive().getUrl() });
  var to = recipients_();
  MailApp.sendEmail({ to: to, subject: 'Weekly orders: ' + money_(s.kpis.revenue) + ' net, ' + pct_(s.kpis.revenueDelta) + ' vs last week', htmlBody: html, name: 'Order sheet' });
  log_('Email', 'Weekly report sent to ' + to);
}

function weeklyJob() {
  cleanOrders();
  buildSummary();
  sendWeeklyReport();
}

function installWeeklyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'weeklyJob') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('weeklyJob').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();
  log_('Schedule', 'Weekly email scheduled for Mondays at 7 AM');
  SpreadsheetApp.getActive().toast('Every Monday at 7 AM the sheet cleans itself and emails the report.', 'Scheduled', 6);
}

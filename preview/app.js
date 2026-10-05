const R = window.RUN;
const sheet = document.getElementById("sheet");
const log = document.getElementById("log");
const foot = document.getElementById("foot");

const esc = (s) => String(s === null || s === undefined ? "" : s)
  .replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]));
const colRef = (i) => String.fromCharCode(65 + i);
const NUMERIC = new Set([7, 8, 9]);

function fail(message) {
  document.querySelector(".split").innerHTML =
    `<div class="log"><h2>The run data did not load</h2>
     <p class="state">${esc(message)}</p>
     <p class="state">Run <strong>node tools/make-view.js</strong>, which runs the same Clean.gs
        logic on the sample export and writes <strong>preview/data.js</strong>, then reload.</p></div>`;
  document.querySelector(".controls").style.display = "none";
}

let showRaw = false;

if (!R || !R.rows || !R.rows.length) {
  fail("No cleaned rows were found on this page.");
} else {
  draw(false);
  document.getElementById("mode").addEventListener("click", (event) => {
    showRaw = !showRaw;
    event.target.textContent = showRaw ? "Show the cleaned sheet" : "Show the raw export";
    document.getElementById("sub").textContent = showRaw
      ? "The export as it arrives: five date formats, prices as text, shouted emails, region nicknames."
      : "The order sheet after the cleanup, and what the script changed to get there.";
    draw(false);
  });
  document.getElementById("replay").addEventListener("click", () => flash());
  document.getElementById("onlyheld").addEventListener("click", (event) => {
    const on = sheet.classList.toggle("held-only");
    event.target.textContent = on ? "Show every row" : "Show only held rows";
    draw(on);
  });
}

function draw(heldOnly) {
  if (showRaw) return drawRaw();
  const rows = heldOnly ? R.rows.filter((r) => r.flagged.length) : R.rows;

  if (!rows.length) {
    sheet.innerHTML = `<div style="padding:26px"><h2 style="font-family:'Zilla Slab',Georgia,serif;
      font-weight:600;font-size:17px;margin:0 0 6px">Nothing is waiting for a person</h2>
      <p class="state">Every row in this run cleaned without a question. The held list fills up
         when the script meets something it will not guess at, such as an address it cannot repair.</p></div>`;
  } else {
    const head = `<tr><th class="ref"></th>${R.headers.map((h, i) =>
      `<th>${esc(h)} <span style="color:#8C8880;font-weight:400">${colRef(i)}</span></th>`).join("")}</tr>`;
    const body = rows.map((row, n) => {
      const cells = row.cells.map((value, i) => {
        const classes = [];
        if (NUMERIC.has(i)) classes.push("num");
        if (row.changed.includes(i)) classes.push("changed");
        if (row.flagged.includes(i)) classes.push("flagged");
        return `<td class="${classes.join(" ")}" data-col="${i}">${esc(value)}</td>`;
      }).join("");
      return `<tr class="${row.flagged.length ? "held" : ""}"><td class="ref">${n + 2}</td>${cells}</tr>`;
    }).join("");
    sheet.innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
  }

  drawLog();
  foot.textContent =
    `${R.note} Source ${R.source}, run ${R.generated}. Fictional business, invented data.`;
  flash();
}

function drawRaw() {
  const head = `<tr><th class="ref"></th>${R.rawHeaders.map((h, i) =>
    `<th>${esc(h)} <span style="color:#8C8880;font-weight:400">${colRef(i)}</span></th>`).join("")}</tr>`;
  const body = R.rawRows.map((row, n) =>
    `<tr><td class="ref">${n + 2}</td>${row.cells.map((value, i) =>
      `<td class="${NUMERIC.has(i) ? "num" : ""}">${esc(value)}</td>`).join("")}</tr>`).join("");
  sheet.innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
  drawLog();
  foot.textContent = `The first ${R.rawRows.length} rows of ${R.source} exactly as exported. Fictional business, invented data.`;
}

function drawLog() {
  const held = R.log.filter((entry) => entry.kind === "held");
  const fixed = R.log.filter((entry) => entry.kind === "fixed");
  const entries = held.concat(fixed).slice(0, 40).map((entry) => `
    <div class="entry ${entry.kind}">
      <span class="id">${esc(entry.id)}</span>
      <span class="what">${entry.kind === "held" ? "held, check " : ""}${esc(entry.what)}</span>
    </div>`).join("");

  log.innerHTML = `
    <h2>What the script did</h2>
    <p class="when">Run ${esc(R.generated)}</p>
    <div class="tot">
      <div><b>${R.stats.input}</b>rows read</div>
      <div><b>${R.stats.fixes}</b>cells fixed</div>
      <div><b>${R.stats.flagged}</b>held for a person</div>
    </div>
    <p class="state" style="margin:0 0 10px">${R.stats.duplicates} duplicates and ${R.stats.blank} blank rows
       were dropped, leaving ${R.stats.output} orders.</p>
    ${entries}
    ${R.log.length > 40 ? `<p class="state" style="margin-top:10px">and ${R.log.length - 40} more rows touched</p>` : ""}`;
}

function flash() {
  const cells = sheet.querySelectorAll("td.changed");
  cells.forEach((cell) => cell.classList.remove("flash"));
  void sheet.offsetWidth;                       // restart the animation
  cells.forEach((cell) => cell.classList.add("flash"));
}

// Renders a text file (real command output) as a terminal window PNG, for the gallery.
// node tools/terminal-shot.js <output.txt> <out.png> "<command shown in the prompt>"
const { chromium } = require('playwright');
const fs = require('fs');

const [file, out, command] = process.argv.slice(2);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const lines = fs.readFileSync(file, 'utf8').trimEnd().split('\n').map((l) => {
  let cls = '';
  if (l.startsWith('✔')) cls = 'ok';
  else if (/^ℹ (pass|tests)/.test(l)) cls = 'sum';
  else if (l.startsWith('ℹ')) cls = 'dim';
  else if (l.startsWith('{')) cls = 'dim';
  return `<div class="${cls}">${esc(l)}</div>`;
});

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1180, height: 720 }, deviceScaleFactor: 2 });
  await p.setContent(`<!doctype html><meta charset="utf-8"><style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap');
    body{margin:0;background:#15171B;font:15px/1.65 'JetBrains Mono',monospace;color:#D9D4CA}
    .win{margin:0;min-height:720px;box-sizing:border-box;padding:0}
    .bar{height:40px;background:#1E2126;display:flex;align-items:center;gap:8px;padding:0 16px;color:#A7A39B;font-size:13px}
    .bar i{width:12px;height:12px;border-radius:50%;background:#3A3E46;display:inline-block}
    .bar span{margin-left:12px}
    pre{margin:0;padding:24px 28px;white-space:pre-wrap;font:inherit}
    .prompt{color:#F2994A}.ok{color:#9FD8A8}.sum{color:#F3EFE7;font-weight:600}.dim{color:#7E7A73}
  </style><div class="win"><div class="bar"><i></i><i></i><i></i><span>sheets-automation-demo</span></div>
  <pre><div><span class="prompt">$</span> ${esc(command)}</div>${lines.join('')}</pre></div>`);
  await p.waitForTimeout(800);
  const h = await p.evaluate(() => document.querySelector('pre').getBoundingClientRect().bottom + 24);
  await p.setViewportSize({ width: 1180, height: Math.ceil(h) });
  await p.screenshot({ path: out });
  await b.close();
})();

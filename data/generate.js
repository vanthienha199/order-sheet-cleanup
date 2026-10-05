// Generates the messy order export used by the demo. Seeded, so every run gives the same file.
// Fieldnote Supply Co. is a fictional stationery shop; every name and email is made up.
const fs = require('fs');
const path = require('path');

let seed = 20261004;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rand() * a.length)];
const chance = (p) => rand() < p;

const catalog = [
  ['NB-A5-DOT', 'A5 Dot Grid Notebook', 18.5],
  ['NB-A5-LIN', 'A5 Lined Notebook', 18.5],
  ['NB-POCKET-3', 'Pocket Notebook 3 Pack', 14.75],
  ['PEN-GEL-07', 'Gel Pen 0.7 Black', 3.25],
  ['PEN-FINE-SET', 'Fineliner Set of 12', 24.9],
  ['PEN-FTN-STL', 'Steel Fountain Pen', 42.0],
  ['INK-BTL-BLU', 'Bottled Ink Blue Black 50ml', 16.4],
  ['PLN-2027-WK', '2027 Weekly Planner', 31.0],
  ['DSK-MAT-FLT', 'Felt Desk Mat', 38.6],
  ['STK-WASHI-6', 'Washi Tape 6 Pack', 11.95],
  ['CRD-KRAFT-20', 'Kraft Note Cards 20 Pack', 13.2],
  ['BAG-CANVAS', 'Canvas Pencil Case', 21.8],
];

const first = ['Maya', 'Daniel', 'Priya', 'Lucas', 'Aaliyah', 'Tomás', 'Hannah', 'Kenji', 'Olivia', 'Marcus', 'Sofia', 'Ethan', 'Leila', 'Grace', 'Noah', 'Zara', 'Owen', 'Camila', 'Isaac', 'Nadia', 'Felix', 'Imani', 'Ruth', 'Diego', 'Chloe', 'Arjun', 'Bianca', 'Theo', 'Yara', 'Caleb'];
const last = ['Rahman', 'Okafor', 'Castillo', 'Nguyen', 'Brennan', 'Moreau', 'Patel', 'Lindqvist', 'Haddad', 'Whitaker', 'Kowalski', 'Tanaka', 'Mensah', 'McAllister', "O'Neill", 'Silva', 'Ferreira', 'Abara', 'Holt', 'Varga', 'Delgado', 'Chen', 'Osei', 'Iyer', 'Kerr'];
const domains = ['example.com', 'example.org', 'example.net', 'mail.example', 'post.example', 'inbox.example'];
const regions = {
  Northeast: ['NE', 'northeast', 'North East', 'Northeast'],
  Southeast: ['SE', 'southeast', 'Southeast', 'South east'],
  Midwest: ['MW', 'midwest', 'Mid West', 'Midwest'],
  West: ['W', 'west', 'West Coast', 'West'],
  Southwest: ['SW', 'southwest', 'Southwest'],
};
const statusVariants = {
  Delivered: ['Delivered', 'delivered', 'DLVRD', 'delivered '],
  Shipped: ['Shipped', 'shipped', 'SHIPPED ', 'Shiped', 'sent'],
  Pending: ['Pending', 'pending', 'processing', 'In Progress'],
  Refunded: ['Refunded', 'refund', 'returned'],
  Cancelled: ['Cancelled', 'canceled'],
};
const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const customers = Array.from({ length: 70 }, () => {
  const f = pick(first);
  const l = pick(last);
  return { name: `${f} ${l}`, email: `${f.normalize('NFD').replace(/[\u0300-\u036f]/g, '')}.${l.replace(/'/g, '')}${chance(0.4) ? Math.floor(rand() * 90 + 10) : ''}@${pick(domains)}`.toLowerCase(), region: pick(Object.keys(regions)) };
});

function messyDate(d) {
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  return pick([
    () => `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    () => `${m + 1}/${day}/${y}`,
    () => `${String(m + 1).padStart(2, '0')}/${String(day).padStart(2, '0')}/${String(y).slice(2)}`,
    () => `${day} ${monthsShort[m]} ${y}`,
    () => `${monthsShort[m]} ${day}, ${y}`,
  ])();
}

function messyMoney(n) {
  return pick([() => n.toFixed(2), () => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, () => `${n} USD`, () => `USD ${n.toFixed(2)}`, () => n.toFixed(2)])();
}

function messyName(n) {
  return pick([() => n, () => n.toLowerCase(), () => n.toUpperCase(), () => `  ${n}`, () => n.replace(' ', '  '), () => n]);
}

const rows = [];
const start = Date.UTC(2026, 7, 24);
const end = Date.UTC(2026, 9, 4);
let orderNo = 41207;
for (let t = start; t <= end; t += 86400000) {
  const day = new Date(t);
  const weekend = [0, 6].includes(day.getUTCDay());
  const growth = 1 + (t - start) / (end - start) * 0.35;
  const n = Math.round((weekend ? 4 : 7) * growth * (0.7 + rand() * 0.6));
  for (let i = 0; i < n; i++) {
    const c = pick(customers);
    const [sku, name, price] = pick(catalog);
    const qty = pick([1, 1, 1, 1, 2, 2, 3, 4, 6]);
    const total = Math.round(qty * price * 100) / 100;
    const ageDays = (end - t) / 86400000;
    let status = ageDays > 9 ? pick(['Delivered', 'Delivered', 'Delivered', 'Delivered', 'Delivered', 'Delivered', 'Refunded', 'Cancelled']) : ageDays > 3 ? pick(['Shipped', 'Shipped', 'Delivered', 'Refunded']) : pick(['Pending', 'Pending', 'Shipped']);

    const row = [
      pick([`FN-${orderNo}`, `FN-${orderNo}`, `fn${orderNo}`, `#FN-${orderNo}`]),
      messyDate(day),
      messyName(c.name)(),
      chance(0.15) ? c.email.toUpperCase() : chance(0.04) ? c.email.replace('.com', '.con') : chance(0.03) ? '' : c.email,
      pick(regions[c.region]),
      chance(0.2) ? sku.toLowerCase().replace(/-/g, chance(0.5) ? '_' : '-') : sku,
      chance(0.25) ? name.toLowerCase() : name,
      chance(0.1) ? `${qty} pcs` : qty,
      chance(0.04) ? '' : messyMoney(price),
      chance(0.06) ? messyMoney(Math.round((total + pick([-1, 1, 10])) * 100) / 100) : messyMoney(total),
      pick(statusVariants[status]),
    ];
    rows.push(row);
    if (chance(0.035)) rows.push([...row]);
    if (chance(0.02)) rows.push(['', '', '', '', '', '', '', '', '', '', '']);
    orderNo += 1;
  }
}

const header = ['Order ID', 'Date', 'Customer', 'Email', 'Region', 'SKU', 'Product', 'Qty', 'Unit price', 'Total', 'Status'];
const csv = [header, ...rows].map((r) => r.map((v) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');
fs.writeFileSync(path.join(__dirname, 'raw_orders.csv'), csv + '\n');
fs.writeFileSync(path.join(__dirname, 'catalog.json'), JSON.stringify(Object.fromEntries(catalog.map(([s, n, p]) => [s, { name: n, price: p }])), null, 2) + '\n');
console.log(`wrote ${rows.length} raw rows`);

// Regression test for the TDS Challan Desk. Run before every release; it must print PASS.
//   node tests/regression.js            (or, without Node, VS Code as Node:)
//   set ELECTRON_RUN_AS_NODE=1 && "%LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe" tests\regression.js
// Results also go to tests/last-run.txt, because VS Code does not show console output.
// It loads index.html with a stub page and checks the built-in September 2026 samples against figures agreed with the advisor.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('function compute('));

const checks = `
const res = [];
const expect = (name, got, want, tol = 1) => res.push([Math.abs(got - want) <= tol ? 'PASS' : 'FAIL', name, got, want]);
loadEntity('tech'); state.overrides = {}; render();
expect('AXI Tech Sep 2026 TDS', M.totTds, 371138);
expect('SWAI over certificate limit, Sep 2026', sum(M.invs.filter(i => /swai/i.test(i.vendor)), 'overLimit'), 12478413);
expect('AXI Tech Sep 2026 Indiqube rent at 1%', sum(M.invs.filter(i => i.section === '194-I(b)'), 'tds'), 41392);
loadEntity('digital'); state.overrides = {}; render();
expect('AXI Digital Sep 2026 TDS', M.totTds, __DIGITAL__);
// After a later month is uploaded, September must stay in the year with its full TDS
loadEntity('tech');
store('upload', {invoices: [{vendor:'Treta Advisors', number:'T-1', date:'2026-10-01', amount:118000, tax:18000, desc:'Business support', key:'treta advisors|T-1'}], bank: [], srcInv: {status:'loaded', name:'test', detail:'1 invoice'}, srcBank: {status:'missing'}, payDate: '2026-11-06'});
loadEntity('tech'); render();
expect('Uploaded month', M.perMI, 2026 * 12 + 9, 0);
expect('September kept in the year after upload', r2(sum(state.history.filter(h => h.month === '2026-09'), 'tds')), 371137.45);
expect('Payment date remembered (no interest when paid by 7 Nov)', M.totInt, 0, 0);
// With October uploaded, September's SWAI 134 (part 1%, part 2%) uses up the certificate and is not flagged as uncovered;
// Indiqube's event and IT bills under the rent code do not get the rent-limit note
{ const swai = state.rules.find(r => r.cert === '1NB0526BXL'), pc = priorChecks(M.perMI).map(p => p[1]).join(' | ');
  expect('SWAI certificate used up by October', certUsage(swai, M.perMI).used, 50000000, 1);
  expect('SWAI 134 not flagged as uncovered', /SWAI[^|]*no certificate cover/i.test(pc) ? 1 : 0, 0, 0);
  expect('No rent-limit note on Indiqube event or IT bills', /(KA\\/JUN26\\/1630|KA\\/JUL26\\/1825)<\\/b>: rent of/.test(pc) ? 1 : 0, 0, 0); }
store('upload', null); loadEntity('tech');
// A top-up challan later in the month clears the month before (31 Oct 2026 pattern)
loadEntity('tech'); { const base = computeGL().ends.find(e => monthKey(e.m) === '2026-08');
  state.gl = {...state.gl, rows: state.gl.rows.concat([{date: new Date(2026, 8, 25), doc: 'TDS challan', memo: 'Top-up for August', jnl: 'GJ', cur: 'INR', amt: 1000, dr: 10.5, cr: 0, bal: 0}])};
  const top = computeGL().ends.find(e => monthKey(e.m) === '2026-08');
  expect('Top-up challan adds to what clears August', r2(top.cleared - base.cleared), 1000, 0.01); }
// A 250500 report starting 1 July must reconcile like the April one: the 7 Jul SWAI 2%-to-1% journals clear June,
// and known items open at 30 June are not counted twice (Nov 2026 uploads showed -1,13,258 and 45,659 unexplained)
for (const k of ['tech', 'digital']) {
  loadEntity(k); const full = computeGL();
  const jul = 2026 * 12 + 6, before = state.gl.rows.filter(r => mi(r.date) < jul);
  state.gl = {...state.gl, asOf: new Date(2026, 6, 1), openUsd: before[before.length - 1].bal, rows: state.gl.rows.filter(r => mi(r.date) >= jul)};
  const mid = computeGL(), unx = G => G.ends.filter(e => e.m >= jul && !e.pending).map(e => e.newUn);
  expect(k + ' GL from July: no new unexplained', Math.max(...unx(mid).map(Math.abs)), 0, 2);
  expect(k + ' GL from July: opening difference as from April', mid.openDiff, full.openDiff, 300);
}
// Payment date comes from the bank's CBDT line (CIN 260907 = 7 Sep 2026), not the GL posting date
loadEntity('tech'); { const aug = computeGL().ends.find(e => monthKey(e.m) === '2026-08');
  expect('Aug challan paid date from CIN', aug.paidOn ? aug.paidOn.getDate() : 0, 7, 0);
  expect('Aug challan not late', aug.late === false ? 1 : 0, 1, 0); }
// Differences for an earlier month check only that month's lines
loadEntity('tech'); { const aug = priorChecks(M.perMI, 2026 * 12 + 7).map(p => p[1]).join(' | ');
  expect('Aug differences mention Aug invoice KA/JUL26/1808', /KA\\/JUL26\\/1808/.test(aug) ? 1 : 0, 1, 0);
  expect('Aug differences leave out June invoice KA/JUN26/1219', /KA\\/JUN26\\/1219/.test(aug) ? 1 : 0, 0, 0); }
// Invoice detail follows the month picked under Challan
loadEntity('tech'); state.view = 2026 * 12 + 7; render();
expect('Invoice detail for Aug 2026 shows Aug lines', M.invView.length, state.history.filter(h => h.month === '2026-08').length, 0);
expect('Invoice detail for Aug 2026 has no other month', M.invView.filter(l => l.mi !== 2026 * 12 + 7).length, 0, 0);
state.view = 'cur'; render();
expect('Invoice detail for the uploaded month', M.invView.length, M.invs.length, 0);
globalThis.__RES = res;
`;
const digital = '153311'; // ₹1,44,130 + SWAI 1% top-up ₹9,181 (AXI Digital has no certificate)
const code = main.replace(/\r?\nvaultInit\(\);\r?\n/,'\n' + checks.replace('__DIGITAL__', digital) + '\nvaultInit();\n');

const el = () => new Proxy(function(){}, { get(t, p) {
  if (p === Symbol.toPrimitive) return () => ''; if (p === 'value' || p === 'textContent' || p === 'innerHTML') return '';
  if (p === 'checked' || p === 'hidden') return false; if (p === 'dataset' || p === 'style') return {}; if (p === 'length') return 0;
  if (p === 'querySelectorAll') return () => []; return el(); }, set() { return true; }, apply() { return el(); } });
Object.assign(global, { window: global, self: global, top: global, addEventListener(){}, matchMedia: () => ({ matches: false, addEventListener(){} }),
  location: { hash: '', search: '' }, fetch: () => new Promise(() => {}), requestAnimationFrame: () => 0 });
global.document = { querySelector: () => el(), querySelectorAll: () => [], getElementById: () => el(), addEventListener(){}, createElement: () => el(), body: el(), documentElement: el(), head: el() };
const store = {}; global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };

let out;
try { (0, eval)(code); const r = globalThis.__RES;
  out = r.map(([s, n, g, w]) => s + '  ' + n + ': ' + g + (s === 'FAIL' ? ' (expected ' + w + ')' : '')).join('\n') + '\n' + (r.every(x => x[0] === 'PASS') ? 'PASS' : 'FAIL');
} catch (e) { out = 'FAIL  could not run the page: ' + (e.stack || e); }
fs.writeFileSync(path.join(__dirname, 'last-run.txt'), out + '\n');
console.log(out);
process.exitCode = out.endsWith('PASS') ? 0 : 1;

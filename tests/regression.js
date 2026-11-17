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
store('upload', null); loadEntity('tech');
globalThis.__RES = res;
`;
const digital = '153311'; // ₹1,44,130 + SWAI 1% top-up ₹9,181 (AXI Digital has no certificate)
const code = main.replace(/\nvaultInit\(\);\n/, '\n' + checks.replace('__DIGITAL__', digital) + '\nvaultInit();\n');

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

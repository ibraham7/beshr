// Generates placeholder cover artwork (brand palette) for the sample portfolio items.
// Run: node scripts/gen-covers.js   — the owner replaces these from the admin panel.
const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, '..', 'public', 'assets', 'works');
fs.mkdirSync(out, { recursive: true });

const P = { teal: '#1e5060', deep: '#0e2a33', mint: '#c4e3c2', sage: '#8da58f', cream: '#eef6ee', ink: '#0a1d24' };
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const diamond = (x, y, s, r, fill, o = 1) => `<rect x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" rx="${s * 0.08}" transform="rotate(${r} ${x} ${y})" fill="${fill}" opacity="${o}"/>`;

const covers = [
  { n: 'work-1', w: 1000, h: 1250, bg: P.teal, body: (w, h) => { // diamond grid
    let s = ''; for (let i = 0; i < 6; i++) for (let j = 0; j < 8; j++) s += diamond(90 + i * 165 + (j % 2) * 80, 90 + j * 160, 110, 45, j % 3 === 0 ? P.mint : P.cream, j % 3 === 0 ? 1 : 0.08 + rnd() * 0.12);
    return s + `<circle cx="${w / 2}" cy="${h / 2}" r="230" fill="${P.deep}"/><circle cx="${w / 2}" cy="${h / 2}" r="230" fill="none" stroke="${P.mint}" stroke-width="3"/>` + diamond(w / 2, h / 2, 150, 45, P.mint); } },
  { n: 'work-2', w: 1200, h: 1200, bg: P.cream, body: (w, h) => { // concentric arcs
    let s = ''; for (let i = 0; i < 9; i++) s += `<circle cx="${w * 0.2}" cy="${h * 0.85}" r="${120 + i * 120}" fill="none" stroke="${i % 2 ? P.sage : P.teal}" stroke-width="${i % 2 ? 2 : 18}" opacity="${i % 2 ? 0.7 : 1}"/>`;
    return s + diamond(w * 0.78, h * 0.22, 190, 45, P.mint) + diamond(w * 0.78, h * 0.22, 90, 45, P.teal); } },
  { n: 'work-3', w: 1400, h: 900, bg: P.deep, body: (w, h) => { // big circle + stripes
    let s = `<circle cx="${w * 0.62}" cy="${h / 2}" r="330" fill="${P.mint}"/>`;
    for (let i = 0; i < 14; i++) s += `<rect x="0" y="${i * 66}" width="${w}" height="14" fill="${P.teal}" opacity="${0.15 + (i % 4) * 0.12}"/>`;
    return s + `<circle cx="${w * 0.62}" cy="${h / 2}" r="190" fill="${P.teal}"/>` + diamond(w * 0.62, h / 2, 140, 45, P.cream) + diamond(w * 0.18, h * 0.3, 70, 45, P.mint) + diamond(w * 0.12, h * 0.72, 46, 45, P.sage); } },
  { n: 'work-4', w: 1000, h: 1300, bg: P.sage, body: (w, h) => { // blobs
    return `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.mint}"/><stop offset="1" stop-color="${P.teal}"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="40"/></filter></defs>` +
      `<g filter="url(#b)"><circle cx="300" cy="400" r="320" fill="url(#g)"/><circle cx="740" cy="900" r="360" fill="${P.deep}" opacity=".85"/><circle cx="780" cy="260" r="180" fill="${P.cream}" opacity=".7"/></g>` +
      diamond(w / 2, h * 0.5, 260, 45, P.cream, 0.0) + `<rect x="120" y="${h - 220}" width="${w - 240}" height="3" fill="${P.cream}" opacity=".8"/>` + diamond(150, h - 220, 28, 45, P.cream); } },
  { n: 'work-5', w: 1200, h: 800, bg: P.teal, body: (w, h) => { // bars
    let s = ''; const bars = [380, 560, 300, 620, 440, 520, 260]; bars.forEach((b, i) => { s += `<rect x="${110 + i * 150}" y="${h - 90 - b}" width="96" height="${b}" rx="48" fill="${i % 3 === 1 ? P.mint : P.cream}" opacity="${i % 3 === 1 ? 1 : 0.9 - i * 0.07}"/>`; });
    return s + diamond(w * 0.86, 150, 120, 45, P.mint) + `<rect x="110" y="90" width="260" height="10" rx="5" fill="${P.sage}"/><rect x="110" y="120" width="170" height="10" rx="5" fill="${P.sage}" opacity=".6"/>`; } },
  { n: 'work-6', w: 1000, h: 1000, bg: P.mint, body: (w, h) => { // overlapping rounded squares
    let s = ''; [[260, 260, 420, P.teal, 0], [500, 330, 380, P.deep, 12], [380, 560, 360, P.sage, -9], [640, 600, 300, P.cream, 20]].forEach(([x, y, z, c, r], i) => { s += `<rect x="${x}" y="${y}" width="${z}" height="${z}" rx="${z * 0.18}" transform="rotate(${r} ${x + z / 2} ${y + z / 2})" fill="${c}" opacity="${i === 3 ? 0.92 : 1}"/>`; });
    return s + diamond(250, 200, 80, 45, P.cream) + diamond(780, 820, 60, 45, P.teal); } },
  { n: 'work-7', w: 1400, h: 900, bg: P.ink, body: (w, h) => { // waves
    let s = `<defs><linearGradient id="w" x1="0" x2="1"><stop offset="0" stop-color="${P.mint}"/><stop offset="1" stop-color="${P.sage}"/></linearGradient></defs>`;
    for (let i = 0; i < 12; i++) { const y = 200 + i * 48; s += `<path d="M0 ${y} C ${w * 0.25} ${y - 140 + i * 6}, ${w * 0.5} ${y + 140 - i * 6}, ${w * 0.75} ${y - 60} S ${w} ${y + 60}, ${w} ${y}" fill="none" stroke="${i % 4 === 0 ? 'url(#w)' : P.teal}" stroke-width="${i % 4 === 0 ? 5 : 2.5}" opacity="${0.4 + i * 0.05}"/>`; }
    return s + diamond(w * 0.82, h * 0.2, 110, 45, P.mint) + diamond(w * 0.1, h * 0.78, 54, 45, P.cream, 0.8); } },
  { n: 'work-8', w: 1000, h: 1250, bg: P.deep, body: (w, h) => { // dots field
    let s = ''; for (let i = 0; i < 11; i++) for (let j = 0; j < 14; j++) { const d = Math.hypot(i - 5, j - 6.5); s += `<circle cx="${70 + i * 86}" cy="${70 + j * 86}" r="${Math.max(3, 34 - d * 5)}" fill="${d < 3 ? P.mint : d < 5 ? P.sage : P.teal}"/>`; }
    return s + diamond(w / 2, h / 2 + 20, 120, 45, P.cream); } },
];

for (const c of covers) {
  seed = 7;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${c.w} ${c.h}" width="${c.w}" height="${c.h}"><rect width="100%" height="100%" fill="${c.bg}"/>${c.body(c.w, c.h)}</svg>`;
  fs.writeFileSync(path.join(out, c.n + '.svg'), svg);
}
console.log('covers written:', covers.length);

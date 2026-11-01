// Beshr Kashkoush portfolio — zero-dependency Node server.
// Serves the site, a JSON content API, uploads, contact messages and the admin panel.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data');
const UPLOADS = path.join(DATA, 'uploads');
const BACKUPS = path.join(DATA, 'backups');
const CONTENT_FILE = path.join(DATA, 'content.json');
const DEFAULT_FILE = path.join(ROOT, 'content.default.json');
const AUTH_FILE = path.join(DATA, 'auth.json');
const SECRET_FILE = path.join(DATA, 'secret.key');
const MSG_FILE = path.join(DATA, 'messages.json');
const PORT = process.env.PORT || 3000;
const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || 'beshr@2026';

for (const d of [DATA, UPLOADS, BACKUPS]) fs.mkdirSync(d, { recursive: true });
if (!fs.existsSync(CONTENT_FILE)) fs.copyFileSync(DEFAULT_FILE, CONTENT_FILE);
if (!fs.existsSync(MSG_FILE)) fs.writeFileSync(MSG_FILE, '[]');
if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString('hex'));
const SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};
const UPLOAD_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg', '.ico', '.mp4', '.webm', '.pdf']);

/* ---------- helpers ---------- */
const readJSON = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } };
const writeAtomic = (f, data) => { const t = f + '.tmp'; fs.writeFileSync(t, data); fs.renameSync(t, f); };
const send = (res, code, body, headers = {}) => {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(code, { 'X-Content-Type-Options': 'nosniff', ...(isObj ? { 'Content-Type': 'application/json; charset=utf-8' } : {}), ...headers });
  res.end(isObj ? JSON.stringify(body) : body);
};
const readBody = (req, limit) => new Promise((resolve, reject) => {
  const chunks = []; let size = 0;
  req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});
const readJSONBody = async (req, limit = 5 * 1024 * 1024) => JSON.parse((await readBody(req, limit)).toString('utf8') || '{}');
const safeName = (n) => n.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- auth ---------- */
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
function getAuth() {
  let a = readJSON(AUTH_FILE, null);
  if (!a) {
    const salt = crypto.randomBytes(16).toString('hex');
    a = { salt, hash: hashPw(DEFAULT_PASSWORD, salt), custom: false };
    writeAtomic(AUTH_FILE, JSON.stringify(a));
  }
  return a;
}
const checkPw = (pw) => {
  const a = getAuth();
  const x = Buffer.from(hashPw(String(pw), a.salt), 'hex'), y = Buffer.from(a.hash, 'hex');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const makeToken = () => { const exp = Date.now() + 7 * 864e5; return `${exp}.${sign(String(exp))}`; };
const validToken = (t) => {
  if (!t) return false;
  const [exp, sig] = t.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = Buffer.from(sign(exp)), got = Buffer.from(sig);
  return good.length === got.length && crypto.timingSafeEqual(good, got);
};
const getCookie = (req, name) => (req.headers.cookie || '').split(/;\s*/).map((c) => c.split('=')).find(([k]) => k === name)?.[1];
const isAuthed = (req) => validToken(getCookie(req, 'bsid'));

// naive in-memory rate limiter
const hits = new Map();
const limited = (key, max, windowMs) => {
  const now = Date.now(); const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(key, arr); return arr.length > max;
};
const ipOf = (req) => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();

/* ---------- content ---------- */
const getContent = () => readJSON(CONTENT_FILE, readJSON(DEFAULT_FILE, {}));
function saveContent(obj) {
  if (fs.existsSync(CONTENT_FILE)) {
    fs.copyFileSync(CONTENT_FILE, path.join(BACKUPS, `content-${new Date().toISOString().replace(/[:.]/g, '-')}.json`));
    const old = fs.readdirSync(BACKUPS).filter((f) => f.startsWith('content-')).sort();
    old.slice(0, Math.max(0, old.length - 30)).forEach((f) => fs.unlinkSync(path.join(BACKUPS, f)));
  }
  writeAtomic(CONTENT_FILE, JSON.stringify(obj, null, 2));
}
const tr = (v, lang = 'ar') => (v && typeof v === 'object' ? v[lang] || v.ar || v.en || '' : v || '');

function themeCSS(c) {
  const col = (c.settings && c.settings.colors) || {};
  const ok = (v) => /^#[0-9a-f]{3,8}$/i.test(v || '');
  return ':root{' + Object.entries(col).filter(([k, v]) => /^[a-z0-9]+$/i.test(k) && ok(v)).map(([k, v]) => `--c-${k}:${v}`).join(';') + '}';
}

function renderIndex(req) {
  const c = getContent(); const s = c.settings || {};
  let html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  const json = JSON.stringify(c).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, '');
  const og = s.ogImage || s.logoMark || '';
  return html
    .replace('{{TITLE}}', esc(tr(s.siteTitle))).replace('{{DESC}}', esc(tr(s.description)))
    .replace('{{OG}}', esc(og)).replace('{{FAVICON}}', esc(s.favicon || s.logoMark || ''))
    .replace('{{THEME}}', themeCSS(c)).replace('{{CONTENT}}', json)
    .replace('{{LANG}}', s.defaultLang === 'en' ? 'en' : 'ar').replace('{{DIR}}', s.defaultLang === 'en' ? 'ltr' : 'rtl');
}

/* ---------- static ---------- */
function serveFile(req, res, file, opts = {}) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    const ext = path.extname(file).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' };
    headers['Cache-Control'] = ['.html', '.js', '.css'].includes(ext) ? 'no-cache' : 'public, max-age=3600';
    if (opts.sandbox) headers['Content-Security-Policy'] = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:";
    const range = req.headers.range;
    if (range && /^bytes=/.test(range)) { // video seeking
      const [a, b] = range.replace('bytes=', '').split('-');
      const start = parseInt(a, 10) || 0, end = b ? parseInt(b, 10) : st.size - 1;
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    headers['Content-Length'] = st.size; headers['Accept-Ranges'] = 'bytes';
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  });
}
const inside = (base, target) => { const r = path.relative(base, target); return r && !r.startsWith('..') && !path.isAbsolute(r); };

/* ---------- server ---------- */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const p = decodeURIComponent(url.pathname);
    const m = req.method;

    /* API */
    if (p.startsWith('/api/')) {
      if (p === '/api/content' && m === 'GET') return send(res, 200, getContent(), { 'Cache-Control': 'no-cache' });

      if (p === '/api/login' && m === 'POST') {
        if (limited('login:' + ipOf(req), 8, 10 * 60e3)) return send(res, 429, { error: 'محاولات كثيرة، حاول لاحقاً' });
        const { password } = await readJSONBody(req, 4096);
        if (!checkPw(password)) { await new Promise((r) => setTimeout(r, 600)); return send(res, 401, { error: 'كلمة المرور غير صحيحة' }); }
        const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
        return send(res, 200, { ok: true, custom: getAuth().custom }, { 'Set-Cookie': `bsid=${makeToken()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${7 * 86400}${secure}` });
      }
      if (p === '/api/logout' && m === 'POST') return send(res, 200, { ok: true }, { 'Set-Cookie': 'bsid=; HttpOnly; Path=/; Max-Age=0' });
      if (p === '/api/messages' && m === 'POST') { // public contact form
        if (limited('msg:' + ipOf(req), 5, 3600e3)) return send(res, 429, { error: 'rate' });
        const b = await readJSONBody(req, 20000);
        if (b.website) return send(res, 200, { ok: true }); // honeypot
        const clip = (v, n) => String(v || '').trim().slice(0, n);
        const msg = { id: crypto.randomUUID(), date: new Date().toISOString(), name: clip(b.name, 120), contact: clip(b.contact, 160), service: clip(b.service, 120), message: clip(b.message, 4000), read: false };
        if (!msg.name || !msg.message) return send(res, 400, { error: 'missing' });
        const all = readJSON(MSG_FILE, []); all.unshift(msg); writeAtomic(MSG_FILE, JSON.stringify(all.slice(0, 500), null, 2));
        return send(res, 200, { ok: true });
      }

      // ---- everything below needs login ----
      if (!isAuthed(req)) return send(res, 401, { error: 'unauthorized' });

      if (p === '/api/me') return send(res, 200, { ok: true, custom: getAuth().custom });
      if (p === '/api/default' && m === 'GET') return send(res, 200, readJSON(DEFAULT_FILE, {}));
      if (p === '/api/content' && m === 'PUT') {
        const body = await readJSONBody(req, 8 * 1024 * 1024);
        if (!body || typeof body !== 'object' || !body.settings || !Array.isArray(body.sections)) return send(res, 400, { error: 'invalid content' });
        saveContent(body); return send(res, 200, { ok: true });
      }
      if (p === '/api/password' && m === 'POST') {
        const { current, next } = await readJSONBody(req, 4096);
        if (!checkPw(current)) return send(res, 403, { error: 'كلمة المرور الحالية غير صحيحة' });
        if (String(next || '').length < 8) return send(res, 400, { error: 'كلمة المرور الجديدة قصيرة (8 أحرف على الأقل)' });
        const salt = crypto.randomBytes(16).toString('hex');
        writeAtomic(AUTH_FILE, JSON.stringify({ salt, hash: hashPw(String(next), salt), custom: true }));
        return send(res, 200, { ok: true });
      }
      if (p === '/api/upload' && m === 'POST') {
        const orig = decodeURIComponent(req.headers['x-filename'] || 'file');
        const ext = path.extname(orig).toLowerCase();
        if (!UPLOAD_EXT.has(ext)) return send(res, 400, { error: 'نوع الملف غير مسموح' });
        const buf = await readBody(req, 40 * 1024 * 1024);
        const name = `${Date.now().toString(36)}-${safeName(path.basename(orig, ext))}${ext}`;
        fs.writeFileSync(path.join(UPLOADS, name), buf);
        return send(res, 200, { ok: true, url: '/uploads/' + name, name });
      }
      if (p === '/api/media' && m === 'GET') {
        const list = fs.readdirSync(UPLOADS).map((f) => { const st = fs.statSync(path.join(UPLOADS, f)); return { name: f, url: '/uploads/' + f, size: st.size, date: st.mtimeMs }; }).sort((a, b) => b.date - a.date);
        return send(res, 200, list);
      }
      if (p.startsWith('/api/media/') && m === 'DELETE') {
        const f = path.join(UPLOADS, path.basename(p));
        if (inside(UPLOADS, f) && fs.existsSync(f)) fs.unlinkSync(f);
        return send(res, 200, { ok: true });
      }
      if (p === '/api/messages' && m === 'GET') return send(res, 200, readJSON(MSG_FILE, []));
      if (p.startsWith('/api/messages/')) {
        const id = path.basename(p); let all = readJSON(MSG_FILE, []);
        if (m === 'DELETE') all = all.filter((x) => x.id !== id);
        else if (m === 'PATCH') all = all.map((x) => (x.id === id ? { ...x, read: true } : x));
        writeAtomic(MSG_FILE, JSON.stringify(all, null, 2)); return send(res, 200, { ok: true });
      }
      return send(res, 404, { error: 'not found' });
    }

    /* pages */
    if (m !== 'GET' && m !== 'HEAD') return send(res, 405, 'Method not allowed', { 'Content-Type': 'text/plain' });
    if (p === '/' || p === '/index.html') return send(res, 200, renderIndex(req), { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    if (p === '/admin' || p === '/admin/') return serveFile(req, res, path.join(PUB, 'admin', 'index.html'));
    if (p.startsWith('/uploads/')) {
      const f = path.join(UPLOADS, p.slice(9));
      return inside(UPLOADS, f) ? serveFile(req, res, f, { sandbox: true }) : send(res, 403, 'Forbidden');
    }
    const f = path.join(PUB, p);
    if (!inside(PUB, f)) return send(res, 403, 'Forbidden');
    return serveFile(req, res, f);
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'server error' });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Beshr portfolio running → http://localhost:${PORT}`);
  console.log(`  Admin panel            → http://localhost:${PORT}/admin`);
  if (!getAuth().custom) console.log(`  Default admin password : ${DEFAULT_PASSWORD}  (change it from Security tab)\n`);
});

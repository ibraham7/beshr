/* Admin panel — schema-driven editor for content.json with live preview. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'value') el.value = v; else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
    return el;
  }
  const tr = (v) => (v && typeof v === 'object' ? v.ar || v.en || '' : v || '');

  /* ---------- api ---------- */
  async function api(url, opt = {}) {
    const r = await fetch(url, { credentials: 'same-origin', ...opt, headers: { ...(opt.body && typeof opt.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...(opt.headers || {}) } });
    if (r.status === 401 && url !== '/api/login') { showLogin(); throw new Error('unauthorized'); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'خطأ');
    return data;
  }
  const toast = (m, bad) => { const t = $('#toast'); t.textContent = m; t.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = 'toast'), 2600); };

  /* ---------- state ---------- */
  let content = null, savedStr = '', tab = 'general';
  const open = new Set();
  const frame = $('#frame');

  const dirty = () => JSON.stringify(content) !== savedStr;
  function refreshStatus() { const s = $('#status'), d = dirty(); s.textContent = d ? 'تغييرات غير محفوظة' : 'كل شيء محفوظ'; s.className = 'status ' + (d ? 'dirty' : 'ok'); $('#save').disabled = !d; }
  let pushT;
  const pushPreview = () => { clearTimeout(pushT); pushT = setTimeout(() => { try { frame.contentWindow.postMessage({ type: 'bs-preview', content }, location.origin); } catch { } }, 220); };
  const touch = () => { refreshStatus(); pushPreview(); };
  frame.addEventListener('load', () => { try { frame.contentWindow.postMessage({ type: 'bs-preview', content }, location.origin); } catch { } });

  /* ---------- schema ---------- */
  const T = (k, l, x = {}) => ({ t: 'text', k, l, ...x });
  const A = (k, l, x = {}) => ({ t: 'area', k, l, ...x });
  const I = (k, l, x = {}) => ({ t: 'i18n', k, l, ...x });
  const IA = (k, l, x = {}) => ({ t: 'i18na', k, l, ...x });
  const IMG = (k, l, x = {}) => ({ t: 'image', k, l, ...x });
  const B = (k, l) => ({ t: 'bool', k, l });
  const S = (k, l, opts, x = {}) => ({ t: 'select', k, l, opts, ...x });
  const N = (k, l) => ({ t: 'range', k, l });
  const G = (k, l, f) => ({ t: 'group', k, l, f });
  const L = (k, l, item, title, x = {}) => ({ t: 'list', k, l, item, title, ...x });
  const LBL = (key, label) => ({ k: 'label', f: I('label', 'النص') });

  const ICONS = [['brand', 'طبقات (هوية)'], ['pen', 'قلم (شعار)'], ['type', 'خط'], ['social', 'جوال (سوشيال)'], ['print', 'طباعة'], ['layout', 'واجهة'], ['palette', 'ألوان'], ['video', 'فيديو'], ['box', 'تغليف'], ['spark', 'نجمة'], ['camera', 'كاميرا'], ['globe', 'عالم']];
  const catOpts = () => (content.works.categories || []).map((c) => [c.id, tr(c.name)]);
  const SECNAMES = { hero: 'الرئيسية', marquee: 'الشريط المتحرك', about: 'من أنا', services: 'الخدمات', works: 'الأعمال', process: 'آلية العمل', contact: 'التواصل' };
  const CTA = (k, l) => G(k, l, [I('label', 'نص الزر'), T('link', 'الرابط', { hint: 'مثال: #works أو #contact أو رابط خارجي' })]);

  const TABS = [
    { id: 'general', label: 'الإعدادات العامة', ico: '⚙', root: 'settings', sec: 'hero', sub: 'اسم الموقع، الشعارات، الألوان واللغة.', fields: [
      G(null, 'الهوية', [I('brandName', 'الاسم'), I('siteTitle', 'عنوان الصفحة (SEO)'), IA('description', 'وصف الموقع (SEO)'), S('defaultLang', 'اللغة الافتراضية', [['ar', 'العربية'], ['en', 'English']]), B('showLangSwitch', 'إظهار زر تبديل اللغة'), B('showThemeSwitch', 'إظهار زر الوضع الليلي / النهاري')]),
      G(null, 'الشعارات', [IMG('logoMark', 'رمز الشعار (الهيدر والتحميل والصفحة الرئيسية)', { hint: 'يفضّل PNG شفاف، فاتح اللون لأن خلفية الموقع داكنة.' }), IMG('logoMarkOnLight', 'رمز الشعار للوضع النهاري', { hint: 'نسخة داكنة تظهر على الخلفية الفاتحة.' }), IMG('logoOnLight', 'الشعار الكامل للوضع النهاري (الفوتر)'), IMG('logoFull', 'الشعار الكامل (الفوتر)'), IMG('favicon', 'أيقونة المتصفح'), IMG('ogImage', 'صورة المشاركة (روابط السوشيال)')]),
      { t: 'colors', k: 'colors', l: 'ألوان الموقع' }] },
    { id: 'sections', label: 'ترتيب الأقسام', ico: '☰', sec: 'hero', sub: 'أظهر/أخفِ الأقسام، غيّر ترتيبها، وعدّل أسماءها في القائمة.', custom: 'sections' },
    { id: 'hero', label: 'الواجهة الرئيسية', ico: '◆', root: 'hero', sec: 'hero', fields: [I('eyebrow', 'العبارة الصغيرة'), IA('title', 'العنوان الكبير', { hint: 'كل سطر في سطر جديد — السطر الأخير يظهر بلون مميز.', rows: 4 }), IA('subtitle', 'الوصف'), CTA('cta1', 'الزر الأول'), CTA('cta2', 'الزر الثاني'), IMG('image', 'صورة شخصية (اختياري)', { hint: 'إن تُركت فارغة يظهر رمز الشعار.' }), I('scroll', 'نص "مرّر للأسفل"')] },
    { id: 'marquee', label: 'الشريط المتحرك', ico: '↔', root: 'marquee', sec: 'marquee', fields: [L('items', 'العبارات', [I('text', 'النص')], (it) => tr(it.text))] },
    { id: 'about', label: 'من أنا', ico: '☺', root: 'about', sec: 'about', fields: [I('eyebrow', 'العبارة الصغيرة'), IA('title', 'العنوان', { rows: 3 }), IA('lead', 'المقدمة'), IA('body', 'النبذة الكاملة', { rows: 5 }),
      L('stats', 'الإحصائيات', [T('value', 'الرقم (مثال: 120+)'), I('label', 'الوصف')], (it) => `${it.value} ${tr(it.label)}`),
      L('skills', 'المهارات', [I('name', 'المهارة'), N('level', 'المستوى %')], (it) => tr(it.name)),
      T('tools', 'الأدوات التي تستخدمها'), G('cv', 'السيرة الذاتية', [I('label', 'نص الزر'), IMG('file', 'ملف PDF', { file: true, hint: 'اتركه فارغاً لإخفاء الزر.' })])] },
    { id: 'services', label: 'الخدمات', ico: '✦', root: 'services', sec: 'services', fields: [I('eyebrow', 'العبارة الصغيرة'), IA('title', 'العنوان', { rows: 3 }), L('items', 'الخدمات', [S('icon', 'الأيقونة', ICONS), I('title', 'الاسم'), IA('desc', 'الوصف')], (it) => tr(it.title))] },
    { id: 'works', label: 'الأعمال', ico: '▣', root: 'works', sec: 'works', fields: [I('eyebrow', 'العبارة الصغيرة'), IA('title', 'العنوان', { rows: 3 }),
      L('categories', 'التصنيفات', [T('id', 'المعرّف (إنجليزي بدون مسافات)', { hint: 'يُستخدم لربط الأعمال بالتصنيف، لا تغيّره بعد الاستخدام.' }), I('name', 'الاسم')], (it) => tr(it.name)),
      L('items', 'الأعمال', [I('title', 'عنوان العمل'), S('category', 'التصنيف', catOpts), T('year', 'السنة'), T('client', 'العميل (اختياري)'), IMG('image', 'الصورة الرئيسية', { video: true }), { t: 'gallery', k: 'gallery', l: 'صور إضافية (تظهر عند فتح العمل)' }, IA('desc', 'وصف العمل')], (it) => tr(it.title), { thumb: 'image', addAtTop: true }),
      I('allLabel', 'نص زر "الكل"'), I('viewLabel', 'نص المؤشر "عرض"')] },
    { id: 'process', label: 'آلية العمل', ico: '⟶', root: 'process', sec: 'process', fields: [I('eyebrow', 'العبارة الصغيرة'), IA('title', 'العنوان', { rows: 3 }), L('steps', 'الخطوات', [I('title', 'الاسم'), IA('desc', 'الوصف')], (it) => tr(it.title))] },
    { id: 'contact', label: 'التواصل', ico: '✉', root: 'contact', sec: 'contact', fields: [I('eyebrow', 'العبارة الصغيرة'), IA('title', 'العنوان', { rows: 3 }), IA('subtitle', 'الوصف'), I('cta', 'نص الزر الدائري', { hint: 'اتركه فارغاً لإخفاء الزر.' }), I('status', 'حالة التوفر', { hint: 'مثال: متاح لمشاريع جديدة — اتركه فارغاً للإخفاء.' }), I('response', 'مدة الرد'), T('email', 'البريد الإلكتروني'), T('phone', 'الهاتف', { hint: 'مثال: +963 900 000 000' }), T('whatsapp', 'واتساب', { hint: 'الرقم مع رمز الدولة، مثال: 963900000000' }), I('location', 'الموقع'),
      L('socials', 'حسابات التواصل', [T('name', 'الاسم (Instagram…)'), T('url', 'الرابط')], (it) => it.name + (it.url ? '' : ' — فارغ')),
      G('form', 'نصوص النموذج', [I('name', 'حقل الاسم'), I('contact', 'حقل البريد/الهاتف'), I('service', 'حقل نوع المشروع'), I('message', 'حقل الرسالة'), I('send', 'زر الإرسال'), I('ok', 'رسالة النجاح'), I('fail', 'رسالة الفشل')])] },
    { id: 'footer', label: 'الفوتر', ico: '▁', root: 'footer', sec: 'contact', fields: [I('text', 'حقوق النشر'), I('tagline', 'العبارة'), I('top', 'نص "للأعلى"')] },
    { sep: true },
    { id: 'messages', label: 'الرسائل', ico: '✉', custom: 'messages', sec: 'contact', sub: 'الرسائل التي أرسلها الزوار من نموذج التواصل.' },
    { id: 'media', label: 'مكتبة الوسائط', ico: '🖼', custom: 'media', sub: 'كل الصور والملفات المرفوعة.' },
    { id: 'security', label: 'الأمان', ico: '🔒', custom: 'security', sub: 'تغيير كلمة مرور لوحة التحكم.' },
  ];

  const makeDefault = (fields) => { const o = {}; fields.forEach((f) => { if (!f.k) return; o[f.k] = f.t === 'i18n' || f.t === 'i18na' ? { ar: '', en: '' } : f.t === 'bool' ? true : f.t === 'range' ? 80 : f.t === 'gallery' ? [] : f.t === 'group' ? makeDefault(f.f) : f.t === 'select' ? (typeof f.opts === 'function' ? (f.opts()[0] || [''])[0] : f.opts[0][0]) : ''; }); return o; };

  /* ---------- field renderers ---------- */
  function field(f, obj, path) {
    const key = f.k;
    if (f.t === 'group') { const target = key ? (obj[key] ??= {}) : obj; return h('div', { class: 'group' }, h('div', { class: 'gt', text: f.l }), f.f.map((x) => field(x, target, path + '.' + (key || '')))); }
    if (f.t === 'colors') return colorsField(f, obj);
    if (f.t === 'list') return listField(f, obj, path);
    if (f.t === 'bool') return h('label', { class: 'chk fld' }, h('input', { type: 'checkbox', ...(obj[key] !== false ? { checked: '' } : {}), onchange: (e) => { obj[key] = e.target.checked; touch(); } }), h('span', { text: f.l }));
    const wrap = h('div', { class: 'fld' }, f.l ? h('label', { text: f.l }) : null);
    if (f.t === 'text') wrap.append(h('input', { type: 'text', value: obj[key] ?? '', oninput: (e) => { obj[key] = e.target.value; touch(); } }));
    else if (f.t === 'area') wrap.append(h('textarea', { rows: f.rows || 3, oninput: (e) => { obj[key] = e.target.value; touch(); } }, obj[key] ?? ''));
    else if (f.t === 'i18n' || f.t === 'i18na') {
      const v = (obj[key] = obj[key] && typeof obj[key] === 'object' ? obj[key] : { ar: String(obj[key] || ''), en: '' });
      const box = h('div', { class: 'i18n' });
      ['ar', 'en'].forEach((lg) => {
        const inp = f.t === 'i18n' ? h('input', { type: 'text', lang: lg, value: v[lg] ?? '', placeholder: lg === 'ar' ? 'بالعربية' : 'In English', oninput: (e) => { v[lg] = e.target.value; touch(); } })
          : h('textarea', { lang: lg, rows: f.rows || 3, placeholder: lg === 'ar' ? 'بالعربية' : 'In English', oninput: (e) => { v[lg] = e.target.value; touch(); } }, v[lg] ?? '');
        box.append(h('div', { class: 'row' }, h('span', { class: 'lg', text: lg.toUpperCase() }), inp));
      });
      wrap.append(box);
    } else if (f.t === 'select') {
      const opts = typeof f.opts === 'function' ? f.opts() : f.opts;
      wrap.append(h('select', { onchange: (e) => { obj[key] = e.target.value; touch(); } }, opts.map(([v, l]) => h('option', { value: v, ...(obj[key] === v ? { selected: '' } : {}) }, l))));
    } else if (f.t === 'range') {
      const out = h('b', { text: (obj[key] ?? 0) + '%', style: 'color:var(--accent);font-family:Inter' });
      wrap.firstChild.append(' ', out);
      wrap.append(h('input', { type: 'range', min: 0, max: 100, value: obj[key] ?? 0, style: 'padding:0;accent-color:#c4e3c2', oninput: (e) => { obj[key] = +e.target.value; out.textContent = e.target.value + '%'; touch(); } }));
    } else if (f.t === 'image') wrap.append(imageField(f, obj));
    else if (f.t === 'gallery') wrap.append(galleryField(obj, key));
    if (f.hint) wrap.append(h('div', { class: 'hint', text: f.hint }));
    return wrap;
  }

  function colorsField(f, obj) {
    const c = (obj[f.k] ??= {});
    const names = { bg: 'الخلفية', surface: 'البطاقات', primary: 'الأساسي (الأزرق)', accent: 'المميّز (الأخضر الفاتح)', sage: 'الثانوي (المريمي)', text: 'النص' };
    return h('div', { class: 'group' }, h('div', { class: 'gt', text: f.l }), h('div', { class: 'colors' }, Object.keys(names).map((k) => {
      const txt = h('input', { type: 'text', value: c[k] || '', maxlength: 9 });
      const pick = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(c[k]) ? c[k] : '#000000' });
      pick.addEventListener('input', () => { c[k] = txt.value = pick.value; touch(); });
      txt.addEventListener('input', () => { c[k] = txt.value; if (/^#[0-9a-f]{6}$/i.test(txt.value)) pick.value = txt.value; touch(); });
      return h('div', { class: 'fld' }, h('label', { text: names[k] }), h('div', { class: 'cw' }, pick, txt));
    })), h('div', { class: 'hint', style: 'margin:12px 0', text: 'الألوان الأصلية مأخوذة من الشعار: #1e5060 · #c4e3c2 · #8da58f' }),
    h('button', { class: 'btn sm', style: 'margin-bottom:14px', onclick: () => { Object.assign(c, { bg: '#0b2129', surface: '#102d37', primary: '#1e5060', accent: '#c4e3c2', sage: '#8da58f', text: '#eef6ee' }); touch(); render(); } }, 'استعادة ألوان الشعار'));
  }

  function imageField(f, obj) {
    const key = f.k;
    const th = h('div', { class: 'thumb' });
    const inp = h('input', { type: 'text', value: obj[key] ?? '', placeholder: 'رابط الصورة أو ارفع ملفاً', style: 'direction:ltr' });
    const set = (u) => { obj[key] = u; inp.value = u; paint(); touch(); };
    const paint = () => { const u = obj[key]; const isImg = u && /\.(png|jpe?g|webp|gif|svg|avif|ico)$/i.test(u); th.className = 'thumb' + (isImg ? ' has' : ''); th.style.backgroundImage = isImg ? `url("${u.startsWith('/') || /^https?:/.test(u) ? u : '/' + u}")` : ''; th.textContent = u && !isImg ? (/\.pdf$/i.test(u) ? 'PDF' : '▶') : (isImg ? '' : 'لا صورة'); };
    inp.addEventListener('input', () => { obj[key] = inp.value; paint(); touch(); });
    paint();
    const file = h('input', { type: 'file', hidden: true, accept: f.file ? 'application/pdf' : f.video ? 'image/*,video/mp4,video/webm' : 'image/*' });
    file.addEventListener('change', async () => { if (file.files[0]) { try { set((await upload(file.files[0])).url); } catch (e) { toast(e.message, true); } } });
    return h('div', { class: 'img' }, th, h('div', {}, inp, h('div', { class: 'acts' },
      h('button', { class: 'btn sm', type: 'button', onclick: () => file.click() }, 'رفع ملف'),
      f.file ? null : h('button', { class: 'btn sm', type: 'button', onclick: () => mediaPicker(set) }, 'من المكتبة'),
      h('button', { class: 'btn sm danger', type: 'button', onclick: () => set('') }, 'حذف'), file)));
  }

  function galleryField(obj, key) {
    const arr = (obj[key] ??= []);
    const g = h('div', { class: 'gal' });
    const draw = () => {
      g.replaceChildren(...arr.map((u, i) => h('div', { class: 'g', style: `background-image:url("${u.startsWith('/') || /^https?:/.test(u) ? u : '/' + u}")` }, h('button', { type: 'button', 'aria-label': 'حذف', onclick: () => { arr.splice(i, 1); draw(); touch(); } }, '✕'))));
      const file = h('input', { type: 'file', multiple: true, hidden: true, accept: 'image/*,video/mp4,video/webm' });
      file.addEventListener('change', async () => { for (const f of file.files) { try { arr.push((await upload(f)).url); } catch (e) { toast(e.message, true); } } draw(); touch(); });
      g.append(h('button', { class: 'add', type: 'button', onclick: () => file.click(), 'aria-label': 'إضافة' }, '+'), file);
    };
    draw(); return g;
  }

  function listField(f, obj, path) {
    const arr = (obj[f.k] ??= []); const wrap = h('div', { class: 'fld' }, h('label', { text: f.l }));
    const list = h('div', { class: 'list' });
    const mv = (i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; touch(); render(true); };
    arr.forEach((it, i) => {
      const id = `${path}.${f.k}.${i}`;
      const body = h('div', { class: 'item-b' });
      let built = false;
      const item = h('div', { class: 'item' + (open.has(id) ? ' open' : '') });
      const fill = () => { if (!built) { built = true; f.item.forEach((x) => body.append(field(x, it, id))); } };
      const head = h('div', { class: 'item-h', onclick: (e) => { if (e.target.closest('.ic')) return; item.classList.toggle('open'); item.classList.contains('open') ? (open.add(id), fill()) : open.delete(id); } },
        f.thumb ? h('span', { class: 'th', style: it[f.thumb] ? `background-image:url("${it[f.thumb].startsWith('/') || /^https?:/.test(it[f.thumb]) ? it[f.thumb] : '/' + it[f.thumb]}")` : '' }) : h('span', { class: 'n', text: i + 1 }),
        h('span', { class: 'tt', text: f.title(it) || '(بدون عنوان)' }),
        h('button', { class: 'ic', type: 'button', title: 'أعلى', onclick: () => mv(i, -1) }, '↑'), h('button', { class: 'ic', type: 'button', title: 'أسفل', onclick: () => mv(i, 1) }, '↓'),
        h('button', { class: 'ic del', type: 'button', title: 'حذف', onclick: () => { if (confirm('حذف هذا العنصر؟')) { arr.splice(i, 1); touch(); render(true); } } }, '🗑'));
      if (open.has(id)) fill();
      item.append(head, body); list.append(item);
      // keep header title live
      body.addEventListener('input', () => { $('.tt', head).textContent = f.title(it) || '(بدون عنوان)'; });
    });
    wrap.append(list, h('button', { class: 'btn', type: 'button', onclick: () => { const n = makeDefault(f.item); f.addAtTop ? arr.unshift(n) : arr.push(n); open.add(`${path}.${f.k}.${f.addAtTop ? 0 : arr.length - 1}`); touch(); render(true); } }, '+ إضافة'));
    return wrap;
  }

  /* ---------- custom tabs ---------- */
  function sectionsTab(box) {
    const secs = content.sections;
    const mv = (i, d) => { const j = i + d; if (j < 0 || j >= secs.length) return; [secs[i], secs[j]] = [secs[j], secs[i]]; touch(); render(true); };
    secs.forEach((s, i) => {
      s.nav = s.nav && typeof s.nav === 'object' ? s.nav : { ar: '', en: '' };
      box.append(h('div', { class: 'sec-row' },
        h('label', { class: 'chk', title: 'إظهار' }, h('input', { type: 'checkbox', ...(s.visible ? { checked: '' } : {}), onchange: (e) => { s.visible = e.target.checked; touch(); } })),
        h('span', { class: 'nm', text: SECNAMES[s.id] || s.id }),
        h('div', { class: 'nv' }, h('input', { value: s.nav.ar || '', placeholder: 'اسم في القائمة (AR)', oninput: (e) => { s.nav.ar = e.target.value; touch(); } }), h('input', { value: s.nav.en || '', placeholder: 'Menu label (EN)', style: 'direction:ltr', oninput: (e) => { s.nav.en = e.target.value; touch(); } })),
        h('button', { class: 'btn sm', onclick: () => mv(i, -1) }, '↑'), h('button', { class: 'btn sm', onclick: () => mv(i, 1) }, '↓')));
    });
    box.append(h('div', { class: 'hint', text: 'ملاحظة: الاسم الفارغ في القائمة يعني أن القسم لا يظهر في قائمة التنقل.' }));
  }

  async function messagesTab(box) {
    let list = []; try { list = await api('/api/messages'); } catch { return; }
    updateBadge(list);
    if (!list.length) return box.append(h('div', { class: 'empty', text: 'لا توجد رسائل بعد.' }));
    list.forEach((m) => box.append(h('div', { class: 'msg' + (m.read ? '' : ' unread') },
      h('div', { class: 'mh' }, h('b', { text: m.name }), h('small', { text: new Date(m.date).toLocaleString('ar') })),
      h('div', { class: 'meta', text: [m.contact, m.service].filter(Boolean).join('  ·  ') }), h('p', { text: m.message }),
      h('div', { style: 'display:flex;gap:8px' },
        m.contact ? h('a', { class: 'btn sm', href: /@/.test(m.contact) ? 'mailto:' + m.contact : 'tel:' + m.contact.replace(/\s/g, '') }, 'رد') : null,
        m.read ? null : h('button', { class: 'btn sm', onclick: async () => { await api('/api/messages/' + m.id, { method: 'PATCH' }); render(); } }, 'تعليم كمقروءة'),
        h('button', { class: 'btn sm danger', onclick: async () => { if (confirm('حذف الرسالة؟')) { await api('/api/messages/' + m.id, { method: 'DELETE' }); render(); } } }, 'حذف')))));
  }
  const updateBadge = (list) => { const n = list.filter((m) => !m.read).length; const b = $('.tab[data-id=messages] .bd'); if (b) { b.textContent = n; b.hidden = !n; } };

  async function mediaTab(box) {
    const file = h('input', { type: 'file', multiple: true, hidden: true });
    const drop = h('div', { class: 'drop', onclick: () => file.click() }, 'اضغط أو اسحب الملفات هنا للرفع', file);
    const up = async (files) => { for (const f of files) { try { await upload(f); } catch (e) { toast(e.message, true); } } toast('تم الرفع'); render(); };
    file.addEventListener('change', () => up(file.files));
    ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => up(e.dataTransfer.files));
    box.append(drop);
    let list = []; try { list = await api('/api/media'); } catch { return; }
    if (!list.length) return box.append(h('div', { class: 'empty', text: 'لا توجد ملفات مرفوعة.' }));
    box.append(h('div', { class: 'media' }, list.map((m) => h('div', { class: 'mi' }, h('div', { class: 'pic', style: /\.(png|jpe?g|webp|gif|svg|avif|ico)$/i.test(m.name) ? `background-image:url("${m.url}")` : '' }),
      h('div', { class: 'mb' }, h('span', { text: m.name }), h('span', { text: (m.size / 1024).toFixed(0) + ' KB' }),
        h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { navigator.clipboard.writeText(location.origin + m.url); toast('تم نسخ الرابط'); } }, 'نسخ'),
          h('button', { class: 'btn danger', onclick: async () => { if (confirm('حذف الملف نهائياً؟')) { await api('/api/media/' + encodeURIComponent(m.name), { method: 'DELETE' }); render(); } } }, 'حذف')))))));
  }

  function securityTab(box) {
    const cur = h('input', { type: 'password', autocomplete: 'current-password' }), nw = h('input', { type: 'password', autocomplete: 'new-password' }), nw2 = h('input', { type: 'password', autocomplete: 'new-password' });
    box.append(h('div', { class: 'group', style: 'max-width:420px' },
      h('div', { class: 'fld' }, h('label', { text: 'كلمة المرور الحالية' }), cur), h('div', { class: 'fld' }, h('label', { text: 'كلمة المرور الجديدة (8 أحرف على الأقل)' }), nw), h('div', { class: 'fld' }, h('label', { text: 'تأكيد كلمة المرور الجديدة' }), nw2),
      h('button', { class: 'btn primary', style: 'margin-bottom:14px', onclick: async () => {
        if (nw.value !== nw2.value) return toast('كلمتا المرور غير متطابقتين', true);
        try { await api('/api/password', { method: 'POST', body: JSON.stringify({ current: cur.value, next: nw.value }) }); toast('تم تغيير كلمة المرور'); cur.value = nw.value = nw2.value = ''; } catch (e) { toast(e.message, true); }
      } }, 'تغيير كلمة المرور')));
  }

  /* ---------- upload & media picker ---------- */
  async function upload(file) {
    toast('جاري الرفع…');
    const r = await fetch('/api/upload', { method: 'POST', credentials: 'same-origin', headers: { 'x-filename': encodeURIComponent(file.name) }, body: file });
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'فشل الرفع'); toast('تم الرفع'); return d;
  }
  async function mediaPicker(cb) {
    const modal = $('#modal'); const close = () => { modal.hidden = true; modal.replaceChildren(); };
    const builtin = ['logo-mark-light.png', 'logo-mark.png', 'logo-full-light.png', 'logo-full.png'].map((n) => ({ name: n, url: '/assets/' + n }));
    let list = []; try { list = await api('/api/media'); } catch { }
    const file = h('input', { type: 'file', hidden: true, accept: 'image/*,video/mp4,video/webm' });
    file.addEventListener('change', async () => { if (file.files[0]) { try { const r = await upload(file.files[0]); cb(r.url); close(); } catch (e) { toast(e.message, true); } } });
    const grid = (items) => h('div', { class: 'media' }, items.map((m) => h('div', { class: 'mi pick', onclick: () => { cb(m.url); close(); } }, h('div', { class: 'pic', style: /\.(png|jpe?g|webp|gif|svg|avif|ico)$/i.test(m.name) ? `background-image:url("${m.url}")` : '' }), h('div', { class: 'mb' }, h('span', { text: m.name })))));
    modal.replaceChildren(h('div', { class: 'box' }, h('div', { class: 'mh' }, h('span', { text: 'اختر من المكتبة' }), h('div', { style: 'display:flex;gap:8px' }, h('button', { class: 'btn primary sm', onclick: () => file.click() }, 'رفع جديد'), h('button', { class: 'btn sm', onclick: close }, 'إغلاق'), file)),
      h('div', { class: 'mb' }, list.length ? [h('div', { class: 'lbl', text: 'الملفات المرفوعة' }), grid(list)] : null, h('div', { class: 'lbl', style: 'margin-top:16px', text: 'الشعارات' }), grid(builtin))));
    modal.hidden = false; modal.onclick = (e) => { if (e.target === modal) close(); };
  }

  /* ---------- render ---------- */
  async function render(keepScroll) {
    const ed = $('#editor'), y = ed.scrollTop;
    $('#tabs').replaceChildren(...TABS.map((x) => x.sep ? h('div', { class: 'tab-sep' }) : h('button', { class: 'tab' + (x.id === tab ? ' on' : ''), 'data-id': x.id, onclick: () => { tab = x.id; render(); if (x.sec) try { frame.contentWindow.postMessage({ type: 'bs-goto', id: x.sec }, location.origin); } catch { } } }, h('span', { text: x.ico }), x.label, x.id === 'messages' ? h('span', { class: 'bd', hidden: true }) : null)));
    const def = TABS.find((x) => x.id === tab);
    const box = h('div', {});
    ed.replaceChildren(h('h2', { text: def.label }), h('div', { class: 'sub', text: def.sub || '' }), box);
    if (def.custom === 'sections') sectionsTab(box);
    else if (def.custom === 'messages') await messagesTab(box);
    else if (def.custom === 'media') await mediaTab(box);
    else if (def.custom === 'security') securityTab(box);
    else { const root = (content[def.root] ??= {}); def.fields.forEach((f) => box.append(field(f, root, def.root))); }
    ed.scrollTop = keepScroll ? y : 0;
    if (!def.custom || def.custom === 'sections') { /* nothing */ }
  }

  /* ---------- login / boot ---------- */
  function showLogin() { $('#shell').hidden = true; $('#login').hidden = false; $('#pw').focus(); }
  async function enter(info) {
    content = await (await fetch('/api/content')).json(); savedStr = JSON.stringify(content);
    $('#login').hidden = true; $('#shell').hidden = false; frame.src = '/?_=' + Date.now(); render(); refreshStatus();
    api('/api/messages').then(updateBadge).catch(() => { });
    if (info && info.custom === false) setTimeout(() => toast('⚠ غيّر كلمة المرور الافتراضية من تبويب "الأمان"', true), 800);
  }
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); $('#loginErr').textContent = '';
    try { const r = await api('/api/login', { method: 'POST', body: JSON.stringify({ password: $('#pw').value }) }); $('#pw').value = ''; enter(r); } catch (err) { $('#loginErr').textContent = err.message; }
  });
  $('#logout').addEventListener('click', async () => { await fetch('/api/logout', { method: 'POST' }); showLogin(); });
  $('#save').addEventListener('click', async () => {
    const b = $('#save'); b.disabled = true; b.textContent = 'جاري الحفظ…';
    try { await api('/api/content', { method: 'PUT', body: JSON.stringify(content) }); savedStr = JSON.stringify(content); toast('تم الحفظ — التغييرات ظهرت على الموقع'); } catch (e) { toast(e.message, true); }
    b.textContent = 'حفظ التغييرات'; refreshStatus();
  });
  addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (dirty()) $('#save').click(); } });
  addEventListener('beforeunload', (e) => { if (content && dirty()) { e.preventDefault(); e.returnValue = ''; } });
  $('#togglePrev').addEventListener('click', () => $('.layout').classList.toggle('showprev'));
  $('#devices').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; $$('#devices button').forEach((x) => x.classList.toggle('on', x === b)); $('.frame-wrap').style.width = b.dataset.w; });

  api('/api/me').then(enter).catch(showLogin);
})();

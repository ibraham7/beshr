/* Beshr Kashkoush — portfolio front-end.
   Renders every section from the content JSON (edited in /admin) and wires the motion layer. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const IS_PREVIEW = window.parent !== window;
  // Motion is part of the brand: Windows users who switch off 'Animation effects' get prefers-reduced-motion,
  // which would freeze the whole site, so motion only turns off when explicitly requested with ?motion=0.
  const REDUCED = /[?&]motion=0/.test(location.search);
  const FINE = matchMedia('(pointer: fine)').matches;

  let C = window.__CONTENT__ || {};
  let lang = (() => { try { return localStorage.getItem('bs-lang'); } catch { return null; } })() || (C.settings && C.settings.defaultLang) || 'ar';
  let lenis = null, gctx = null, ac = null, booted = false, cleanups = [];
  const hasGSAP = () => typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  /* ---------- helpers ---------- */
  const t = (v) => (v && typeof v === 'object' ? (v[lang] || v.ar || v.en || '') : (v == null ? '' : String(v)));
  const src = (u) => (!u ? '' : /^(https?:|data:|\/)/.test(u) ? u : '/' + u);
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
    return el;
  }
  const svg = (inner, cls = '') => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.7'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); if (cls) s.setAttribute('class', cls); s.innerHTML = inner; return s; };
  const ICONS = {
    brand: '<path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    pen: '<path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.6 7.6"/><circle cx="11" cy="11" r="2"/>',
    type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>',
    social: '<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M12 18h.01"/>',
    print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
    palette: '<circle cx="13.5" cy="6.5" r=".6"/><circle cx="17.5" cy="10.5" r=".6"/><circle cx="8.5" cy="7.5" r=".6"/><circle cx="6.5" cy="12.5" r=".6"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1a1.6 1.6 0 0 1 1.7-1.7H16c3 0 5.5-2.5 5.5-5.5C21.5 6 17.5 2 12 2z"/>',
    video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m22 8-6 4 6 4z"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17v4M17 19h4"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>',
    arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>', close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', up: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  };
  const icon = (n, cls) => svg(ICONS[n] || ICONS.spark, cls);
  const lines = (txt) => String(txt || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const splitEl = (tag, cls, txt, words) => h(tag, { class: cls, 'data-split': '' }, lines(txt).map((l) => h('span', { class: 'split-line' }, words ? h('span', {}, l.split(/\s+/).map((w, i, a) => [h('span', { class: 'w', text: w }), i < a.length - 1 ? ' ' : null])) : h('span', { text: l }))));
  const num = (i) => String(i + 1).padStart(2, '0');

  /* ---------- theme ---------- */
  function applyTheme() {
    const c = (C.settings && C.settings.colors) || {};
    const ok = (v) => /^#[0-9a-f]{3,8}$/i.test(v || '');
    $('#theme').textContent = ':root{' + Object.entries(c).filter(([k, v]) => /^[a-z0-9]+$/i.test(k) && ok(v)).map(([k, v]) => `--c-${k}:${v}`).join(';') + '}';
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    const s = C.settings || {}; document.title = t(s.siteTitle) || document.title;
    const fav = $('link[rel=icon]'); if (fav && (s.favicon || s.logoMark)) fav.href = src(s.favicon || s.logoMark);
  }

  /* ---------- sections ---------- */
  const secHead = (key, no, extra) => {
    const d = C[key] || {};
    return h('div', { class: 'sec-head' }, h('div', {},
      h('div', { class: 'eyebrow rv' }, h('span', { class: 'no', text: no }), t(d.eyebrow)),
      splitEl('h2', 'h2', t(d.title))), extra);
  };

  function sHero() {
    const d = C.hero || {}, s = C.settings || {};
    const L = (d, cls, ...k) => h('div', { class: 'ha-layer ' + cls, 'data-d': d }, ...k);
    const orbitSvg = (side) => { const e = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); e.setAttribute('class', 'orbits ' + side); e.setAttribute('viewBox', '0 0 100 100'); e.setAttribute('aria-hidden', 'true'); e.innerHTML = (side === 'back' ? '<defs><radialGradient id="sqGlow"><stop offset="0" stop-opacity=".55"/><stop offset="1" stop-opacity="0"/></radialGradient></defs>' : '') + '<g class="bodies"></g>'; return e; };
    const tags = ((C.marquee && C.marquee.items) || []).filter((it) => t(it.text)).slice(0, 3);
    const art = h('div', { class: 'hero-art' },
      L(6, 'glow-l', h('div', { class: 'halo' })),
      L(12, 'orb-back', orbitSvg('back')),
      L(9, 'core', h('div', { class: 'hero-orb' }, h('i', { class: 'glare' }))),
      L(12, 'orb-front', orbitSvg('front')),
      d.image ? L(18, 'core', h('img', { class: 'hero-photo', src: src(d.image), alt: t(s.brandName) }))
        : L(18, 'core', h('img', { class: 'hero-mark', src: src(s.logoMark), alt: t(s.brandName) }), h('i', { class: 'mark-shine', style: 'mask-image:url(' + src(s.logoMark) + ');-webkit-mask-image:url(' + src(s.logoMark) + ')' })),
      L(24, 'chips', tags.map((it) => h('span', { class: 'chip3d' }, h('span', { class: 'chip-in' }, h('i'), t(it.text))))));
    const btn = (b, solid) => b && t(b.label) ? h('a', { class: 'btn mag' + (solid ? ' solid' : ''), href: b.link || '#' }, t(b.label), icon('arrow', 'arr')) : null;
    return h('section', { class: 'hero', id: 'hero' },
      h('div', { class: 'hero-grid' }), h('div', { class: 'hero-glow' }), h('canvas', { class: 'hero-fx', 'aria-hidden': 'true' }),
      h('div', { class: 'container hero-in' },
        h('div', { class: 'hero-text' },
          h('div', { class: 'eyebrow rv' }, t(d.eyebrow)),
          splitEl('h1', '', t(d.title), true),
          h('p', { class: 'lead rv', text: t(d.subtitle) }),
          h('div', { class: 'hero-cta rv' }, btn(d.cta1, true), btn(d.cta2, false))), art),
      t(d.scroll) ? h('div', { class: 'scroll-hint' }, h('i'), t(d.scroll)) : null);
  }

  function sMarquee() {
    const items = ((C.marquee && C.marquee.items) || []).filter((i) => t(i.text));
    if (!items.length) return null;
    const group = () => h('div', { class: 'mq-group' }, items.map((i) => h('div', { class: 'mq-item' }, t(i.text), h('i'))));
    return h('section', { class: 'marquee', id: 'marquee', 'aria-hidden': 'true' }, h('div', { class: 'mq-track' }, group(), group(), group(), group()));
  }

  function sAbout(no) {
    const d = C.about || {}, s = C.settings || {};
    const photo = h('div', { class: 'photo' },
      d.photo ? h('img', { class: 'fill', src: src(d.photo), alt: t(s.brandName), loading: 'lazy' }) : h('img', { class: 'mark', src: src(s.logoMark), alt: '' }),
      h('i', { class: 'fl a' }), h('i', { class: 'fl b' }));
    return h('section', { class: 'sec', id: 'about' }, h('div', { class: 'container about-grid' },
      h('div', { class: 'about-media' }, photo, t(s.brandName) ? h('div', { class: 'badge' }, t(s.brandName)) : null),
      h('div', {},
        h('div', { class: 'eyebrow rv' }, h('span', { class: 'no', text: no }), t(d.eyebrow)),
        splitEl('h2', 'h2', t(d.title)),
        h('div', { class: 'about-body' }, h('p', { class: 'lead rv', text: t(d.lead) }), h('p', { class: 'rv', text: t(d.body) })),
        h('div', { class: 'stats' }, (d.stats || []).map((x) => h('div', { class: 'stat rv' }, h('b', { 'data-count': x.value, text: x.value }), h('span', { text: t(x.label) })))),
        h('div', { class: 'skills' }, (d.skills || []).map((x) => h('div', { class: 'skill rv' },
          h('div', { class: 'skill-head' }, h('span', { text: t(x.name) }), h('em', { text: (x.level || 0) + '%' })),
          h('div', { class: 'bar' }, h('i', { 'data-level': x.level || 0 }))))),
        d.tools ? h('div', { class: 'tools rv', text: d.tools }) : null,
        d.cv && d.cv.file ? h('a', { class: 'btn mag rv', href: src(d.cv.file), target: '_blank', rel: 'noopener' }, t(d.cv.label), icon('arrow', 'arr')) : null)));
  }

  function sServices(no) {
    const d = C.services || {};
    return h('section', { class: 'sec', id: 'services' }, h('div', { class: 'container' }, secHead('services', no),
      h('div', { class: 'cards' }, (d.items || []).map((x, i) => h('article', { class: 'card rv' },
        h('span', { class: 'no', text: num(i) }), h('div', { class: 'ico' }, icon(x.icon)), h('h3', { text: t(x.title) }), h('p', { text: t(x.desc) }))))));
  }

  let activeCat = 'all';
  function sWorks(no) {
    const d = C.works || {};
    const cats = d.categories || [];
    const filters = h('div', { class: 'filters rv' }, h('button', { class: 'chip on', 'data-cat': 'all', text: t(d.allLabel) || 'All' }), cats.map((c) => h('button', { class: 'chip', 'data-cat': c.id, text: t(c.name) })));
    const items = (d.items || []).map((w, i) => h('button', { class: 'work', 'data-cat': w.category, 'data-i': i, 'aria-label': t(w.title) },
      h('div', { class: 'work-media ' + (w.ratio || 'portrait') }, /\.(mp4|webm)$/i.test(w.image || '') ? h('video', { src: src(w.image), muted: true, loop: true, autoplay: true, playsinline: true }) : h('img', { src: src(w.image), alt: t(w.title), loading: 'lazy' })),
      h('div', { class: 'work-shade' }), h('span', { class: 'work-go', 'aria-hidden': 'true' }, icon('arrow')),
      h('div', { class: 'work-info' }, h('div', {}, h('h3', { text: t(w.title) }), h('span', { text: t((cats.find((c) => c.id === w.category) || {}).name) })), w.year ? h('span', { class: 'yr', text: w.year }) : null)));
    return h('section', { class: 'sec', id: 'works' }, h('div', { class: 'container' }, secHead('works', no), filters, h('div', { class: 'masonry' }, items)));
  }

  function sProcess(no) {
    const d = C.process || {}, steps = d.steps || [];
    return h('section', { class: 'sec process', id: 'process' }, h('div', { class: 'container' }, secHead('process', no),
      h('div', { class: 'pr', style: '--n:' + Math.max(1, steps.length) },
        h('div', { class: 'pr-track', 'aria-hidden': 'true' }, h('i', { class: 'pr-fill' }), h('i', { class: 'pr-runner' })),
        steps.map((x, i) => h('article', { class: 'pr-step rv' },
          h('span', { class: 'pr-node', 'aria-hidden': 'true' }, h('i')),
          h('span', { class: 'pr-no', text: num(i) }),
          h('h3', { text: t(x.title) }), h('p', { text: t(x.desc) }))))));
  }

  function sContact(no) {
    const d = C.contact || {}, f = d.form || {};
    const links = [];
    if (d.email) links.push(['Email', d.email, 'mailto:' + d.email]);
    if (d.phone) links.push(['Phone', d.phone, 'tel:' + d.phone.replace(/\s/g, '')]);
    if (d.whatsapp) links.push(['WhatsApp', d.whatsapp, 'https://wa.me/' + d.whatsapp.replace(/\D/g, '')]);
    const socials = (d.socials || []).filter((s) => s.url);
    const services = ((C.services && C.services.items) || []).map((x) => t(x.title)).filter(Boolean);
    const msg = h('div', { class: 'form-msg', role: 'status' });
    const fld = (tag, name, label, extra = {}) => h('div', { class: 'fld' }, h(tag, { name, placeholder: ' ', ...extra }), h('label', { text: label }));
    const send = h('button', { class: 'btn solid mag ct-send', type: 'submit' }, h('span', { class: 'ct-send-t', text: t(f.send) }), icon('arrow', 'arr'));
    const form = h('form', { class: 'ct-form rv', id: 'ct-form', novalidate: true },
      h('div', { class: 'ct-row' }, fld('input', 'name', t(f.name), { required: true, autocomplete: 'name' }), fld('input', 'contact', t(f.contact), { autocomplete: 'email' })),
      services.length ? h('fieldset', { class: 'ct-opts' }, h('legend', { text: t(f.service) }),
        services.map((s) => h('label', { class: 'ct-opt' }, h('input', { type: 'radio', name: 'service', value: s }), h('span', { text: s })))) : null,
      fld('textarea', 'message', t(f.message), { required: true, rows: 4 }),
      h('input', { class: 'hp', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' }),
      send, msg);
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); const data = Object.fromEntries(new FormData(form)); data.service = data.service || '';
      if (!String(data.name || '').trim() || !String(data.message || '').trim()) { msg.className = 'form-msg bad'; msg.textContent = t(f.fail); form.classList.add('shake'); setTimeout(() => form.classList.remove('shake'), 600); return; }
      send.classList.add('busy');
      try {
        if (!IS_PREVIEW) { const r = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (!r.ok) throw 0; }
        msg.className = 'form-msg ok'; msg.textContent = t(f.ok); form.reset(); send.classList.add('sent'); setTimeout(() => send.classList.remove('sent'), 3200);
      } catch { msg.className = 'form-msg bad'; msg.textContent = t(f.fail); }
      send.classList.remove('busy');
    });
    const ticker = t(d.ticker) || t(d.cta);
    const tk = () => h('div', { class: 'ct-tk-g' }, [0, 1, 2].map(() => h('span', {}, ticker, h('i'))));
    return h('section', { class: 'sec contact', id: 'contact' },
      h('div', { class: 'ct-bg', 'aria-hidden': 'true' }, h('i'), h('i')),
      h('div', { class: 'container' },
        h('div', { class: 'ct-head' },
          h('div', {}, h('div', { class: 'eyebrow rv' }, h('span', { class: 'no', text: no }), t(d.eyebrow)), splitEl('h2', 'contact-big', t(d.title)))),
        h('div', { class: 'ct-grid' },
          h('div', { class: 'ct-side' },
            h('p', { class: 'lead rv', text: t(d.subtitle) }),
            t(d.status) ? h('div', { class: 'ct-status rv' }, h('span', { class: 'pulse', 'aria-hidden': 'true' }), h('div', {}, h('b', { text: t(d.status) }), t(d.response) ? h('small', { text: t(d.response) }) : null)) : null,
            links.map(([k, v, href]) => h('a', { class: 'clink rv', href, target: href.startsWith('http') ? '_blank' : null, rel: 'noopener' }, h('span', { text: k }), h('b', { text: v }))),
            t(d.location) ? h('div', { class: 'clink rv', style: 'direction:inherit' }, h('span', { text: '◆' }), h('b', { text: t(d.location) })) : null,
            socials.length ? h('div', { class: 'socials rv' }, socials.map((s) => h('a', { class: 'chip', href: s.url, target: '_blank', rel: 'noopener', text: s.name }))) : null,
          t(d.cta) ? h('a', { class: 'ct-orb mag rv', href: '#ct-form' }, h('span', { class: 'ct-orb-ring', 'aria-hidden': 'true' }), h('span', { class: 'ct-orb-in' }, icon('arrow', 'arr'), h('b', { text: t(d.cta) }))) : null),
          form)),
      ticker ? h('div', { class: 'ct-ticker', 'aria-hidden': 'true' }, h('div', { class: 'ct-tk' }, tk(), tk())) : null);
  }

  function sFooter() {
    const d = C.footer || {}, s = C.settings || {};
    return h('footer', { class: 'footer' }, h('div', { class: 'container' },
      h('div', { class: 'foot-logo rv' }, h('img', { src: src(s.logoFull), alt: t(s.brandName) })),
      h('div', { class: 'foot-row' }, h('span', { text: `© ${new Date().getFullYear()} ${t(s.brandName)} — ${t(d.text)}` }), h('span', { text: t(d.tagline) }),
        h('button', { class: 'to-top', 'data-top': '' }, t(d.top), h('span', { class: 'round' }, icon('up'))))));
  }

  const BUILD = { hero: sHero, marquee: sMarquee, about: sAbout, services: sServices, works: sWorks, process: sProcess, contact: sContact };

  /* ---------- header / menu ---------- */
  function buildHeader() {
    const s = C.settings || {};
    const secs = (C.sections || []).filter((x) => x.visible && t(x.nav));
    const link = (x) => h('a', { href: '#' + x.id, 'data-nav': x.id, text: t(x.nav) });
    $('#header').replaceChildren(h('div', { class: 'container hd' },
      h('a', { class: 'brand', href: '#hero', 'aria-label': t(s.brandName) }, h('img', { src: src(s.logoMark), alt: '' }), h('span', { text: t(s.brandName) })),
      h('nav', { class: 'nav' }, h('i', { class: 'nav-pill' }), secs.map(link)),
      h('div', { class: 'hd-actions' }, ((C.hero || {}).cta2 || {}).label && t(C.hero.cta2.label) ? h('a', { class: 'hd-cta mag', href: C.hero.cta2.link || '#contact' }, t(C.hero.cta2.label), icon('arrow')) : null, s.showLangSwitch !== false ? h('button', { class: 'lang', 'aria-label': 'Language', text: lang === 'ar' ? 'EN' : 'عربي', style: lang === 'ar' ? '' : 'font-family:var(--f-ar)' }) : null,
        h('button', { class: 'burger', 'aria-label': 'Menu' }, h('i'), h('i')))));
    navPill();
    $('#menu').replaceChildren(...secs.map((x, i) => { const a = link(x); a.style.transitionDelay = (i * 60 + 200) + 'ms'; return a; }));
  }

  function navPill() {
    const nav = $('.nav'); if (!nav) return; const pill = $('.nav-pill', nav);
    const move = () => { const a = $('a.active', nav); if (!a) { pill.style.opacity = 0; return; } const n = nav.getBoundingClientRect(), r = a.getBoundingClientRect(); const x = lang === 'ar' ? r.right - n.right : r.left - n.left; pill.style.opacity = 1; pill.style.width = r.width + 'px'; pill.style.transform = 'translateX(' + x + 'px)'; };
    nav._move = move; setTimeout(move, 100); addEventListener('resize', move, { signal: ac.signal });
  }

  /* ---------- mount ---------- */
  function mount() {
    if (gctx) { gctx.revert(); gctx = null; }
    cleanups.forEach((f) => f()); cleanups = [];
    if (ac) ac.abort(); ac = new AbortController();
    if (hasGSAP()) window.ScrollTrigger.getAll().forEach((s) => s.kill());
    applyTheme(); buildHeader();
    const app = $('#app'); app.replaceChildren();
    let n = 0;
    for (const sec of C.sections || []) {
      if (!sec.visible || !BUILD[sec.id]) continue;
      const needsNo = !['hero', 'marquee'].includes(sec.id);
      const el = BUILD[sec.id](needsNo ? num(n++) : undefined);
      if (el) app.append(el);
    }
    app.append(sFooter());
    wire();
    orbitSys = orbitSystem();
    if (hasGSAP()) animate();
  }

  /* ---------- hero particle field: drifting diamonds, mouse constellation, click burst ---------- */
  function heroFX(hero, sig) {
    const cv = $('.hero-fx', hero); if (!cv) return;
    const ctx = cv.getContext('2d'), cs = getComputedStyle(document.documentElement);
    const col = [cs.getPropertyValue('--c-accent').trim() || '#c4e3c2', cs.getPropertyValue('--c-sage').trim() || '#8da58f', cs.getPropertyValue('--c-text').trim() || '#eef6ee'];
    let W = 0, H = 0, dpr = 1, parts = [], rings = [], mx = -999, my = -999, inside = false, visible = true;
    const rand = (a, b) => a + Math.random() * (b - a);
    const make = (x, y, burst) => {
      const z = rand(.35, 1), ang = rand(0, 6.283), sp = burst ? rand(2.2, 6) : rand(.12, .38);
      return { x, y, bx: burst ? 0 : Math.cos(ang) * sp * z, by: burst ? 0 : Math.sin(ang) * sp * z - .05, vx: Math.cos(ang) * sp * (burst ? 1 : z), vy: Math.sin(ang) * sp * (burst ? 1 : z), s: rand(3, 9) * z, r: rand(0, 6.283), vr: rand(-.012, .012), z, c: col[Math.random() < .62 ? 0 : Math.random() < .6 ? 1 : 2], life: burst ? 1 : -1 };
    };
    const size = () => {
      const r = hero.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2); W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(70, Math.max(W < 700 ? 12 : 24, (W * H) / 22000)));
      parts = parts.filter((p) => p.life >= 0); while (parts.filter((p) => p.life < 0).length < n) parts.push(make(rand(0, W), rand(0, H)));
    };
    size();
    const ro = new ResizeObserver(size); ro.observe(hero); cleanups.push(() => ro.disconnect());
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(hero); cleanups.push(() => io.disconnect());
    const pos = (e) => { const r = hero.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    hero.addEventListener('pointermove', (e) => { [mx, my] = pos(e); inside = true; }, sig);
    hero.addEventListener('pointerleave', () => { inside = false; }, sig);
    hero.addEventListener('pointerdown', (e) => {
      if (e.target.closest('a, button')) return; const [x, y] = pos(e);
      rings.push({ x, y, r: 6, a: .55 }, { x, y, r: 0, a: .35, d: 1.6 });
      for (let i = 0; i < 16; i++) parts.push(make(x, y, true));
    }, sig);
    const tick = () => {
      if (!visible) return; ctx.clearRect(0, 0, W, H);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        if (inside) { const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy); if (d < 150 && d > 0) { const f = (1 - d / 150) * .9 * p.z; p.vx += (dx / d) * f; p.vy += (dy / d) * f; } }
        if (p.life >= 0) { p.vx *= .965; p.vy *= .965; p.life -= .014; if (p.life <= 0) { parts.splice(i, 1); continue; } }
        else { p.vx += (p.bx - p.vx) * .03; p.vy += (p.by - p.vy) * .03; }
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        if (p.life < 0) { if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20; if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20; }
      }
      if (inside) { // constellation lines from the pointer to nearby diamonds
        ctx.lineWidth = 1;
        for (const p of parts) { const d = Math.hypot(p.x - mx, p.y - my); if (d < 170) { ctx.globalAlpha = (1 - d / 170) * .35; ctx.strokeStyle = col[0]; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(p.x, p.y); ctx.stroke(); } }
      }
      for (const p of parts) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(.7854 + p.r); ctx.globalAlpha = (p.life >= 0 ? p.life : 1) * (.25 + p.z * .6); ctx.fillStyle = p.c;
        const s = p.s; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-s / 2, -s / 2, s, s, s * .22) : ctx.rect(-s / 2, -s / 2, s, s); ctx.fill(); ctx.restore();
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const g = rings[i]; g.r += 4.2 * (g.d || 1); g.a *= .955; if (g.a < .01) { rings.splice(i, 1); continue; }
        ctx.globalAlpha = g.a; ctx.strokeStyle = col[0]; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, 6.283); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    gsap.ticker.add(tick); cleanups.push(() => gsap.ticker.remove(tick));
  }

  /* ---------- hero orbit system ----------
     Squares ride the real SVG ellipses (back half sits behind the orb, front half in front),
     the keyword chips circle the logo on their own ellipse and stay upright, and every layer
     drifts with the pointer at its own depth. Independent of GSAP so it survives a CDN failure. */
  const ORBITS = [
    { rx: 58, ry: 16, rot: -14, cls: '', w: .34, bodies: [{ p: 0, s: 3.4, trail: true }, { p: 3.3, s: 2.3, c: 'sage' }] },
    { rx: 66, ry: 29, rot: 24, cls: 'dash', w: -.2, bodies: [{ p: 1.1, s: 2.8 }, { p: 4.4, s: 1.9, c: 'text', mobile: false }] },
    { rx: 47, ry: 45, rot: 0, cls: 'faint', w: .46, bodies: [{ p: 2.3, s: 1.6, c: 'text', trail: true }] },
  ];
  let orbitSys = null;
  function orbitSystem() {
    const art = $('.hero-art'), hero = $('.hero'); if (!art || !hero) return null;
    const NS = 'http://www.w3.org/2000/svg', mk = (tag, at) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); return e; };
    const back = $('.orbits.back', art), front = $('.orbits.front', art), gB = $('.bodies', back), gF = $('.bodies', front);
    const small = matchMedia('(max-width: 700px)').matches;
    const bodies = [];
    ORBITS.forEach((o) => {
      const r = o.rot * Math.PI / 180, cr = Math.cos(r), sr = Math.sin(r);
      back.insertBefore(mk('ellipse', { class: 'path ' + o.cls, cx: 50, cy: 50, rx: o.rx, ry: o.ry, transform: 'rotate(' + o.rot + ' 50 50)' }), gB);
      front.insertBefore(mk('path', { class: 'path ' + o.cls, d: 'M' + (50 + o.rx) + ' 50A' + o.rx + ' ' + o.ry + ' 0 0 1 ' + (50 - o.rx) + ' 50', transform: 'rotate(' + o.rot + ' 50 50)' }), gF);
      // point on the rotated ellipse; z = sin(theta) > 0 is the half nearest the viewer
      const at = (th) => { const lx = o.rx * Math.cos(th), ly = o.ry * Math.sin(th); return [50 + lx * cr - ly * sr, 50 + lx * sr + ly * cr, Math.sin(th)]; };
      o.bodies.forEach((b) => {
        if (small && b.mobile === false) return;
        const g = mk('g', { class: 'sq ' + (b.c || '') });
        g.append(mk('circle', { class: 'glow', r: b.s * 1.9 }), mk('rect', { x: -b.s / 2, y: -b.s / 2, width: b.s, height: b.s, rx: b.s * .24, transform: 'rotate(45)' }));
        const ghosts = b.trail && !small ? Array.from({ length: 7 }, (_, k) => mk('circle', { class: 'ghost ' + (b.c || ''), r: (b.s * .3 * (1 - k / 8)).toFixed(2), opacity: (.4 * (1 - k / 7)).toFixed(2) })) : [];
        bodies.push({ o, b, g, ghosts, at });
      });
    });
    const put = (el, z) => { const want = z > 0 ? gF : gB; if (el.parentNode !== want) want.append(el); };

    const chips = $$('.chip3d', art), layers = $$('.ha-layer', art).map((el) => ({ el, d: +el.dataset.d || 0 }));
    const orb = $('.hero-orb', art), glow = $('.hero-glow', hero);
    let crx = 0, cry = 0;
    const measure = () => { // chip ellipse: outside the orb, inside the viewport, clear of the hero text
      const W = art.offsetWidth, ar = art.getBoundingClientRect(), cx = ar.left + ar.width / 2, cy = ar.top + ar.height / 2;
      const cw = Math.max(0, ...chips.map((c) => c.offsetWidth)) / 2, ch = Math.max(0, ...chips.map((c) => c.offsetHeight)) / 2;
      crx = W * .5; cry = W * .57;
      crx = Math.min(crx, cx - cw - 10, innerWidth - cx - cw - 10);
      const tx = $('.hero-text', hero); if (tx) {
        const tr = tx.getBoundingClientRect();
        if (tr.top > cy) cry = Math.min(cry, tr.top - cy - ch - 10); // stacked (mobile): keep above the text
        else if (tr.left > cx) crx = Math.min(crx, tr.left - cx - cw - 14);
        else if (tr.right < cx) crx = Math.min(crx, cx - tr.right - cw - 14);
      }
      crx = Math.max(crx, W * .3); cry = Math.max(cry, W * .42);
    };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(hero);

    let mx = 0, my = 0, px = 0, py = 0, hoverT = 1, hoverF = 1, phase = 0, cphase = 0, t = 0, visible = true, raf = 0, last = 0;
    const api = { speed: hasGSAP() && !REDUCED && !booted ? 0 : 1, destroy() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); evt.abort(); } };
    const evt = new AbortController(), on = { signal: evt.signal };
    if (FINE) {
      hero.addEventListener('pointermove', (e) => {
        const r = art.getBoundingClientRect();
        mx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (innerWidth / 2)));
        my = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (innerHeight / 2)));
        glow && (glow.style.setProperty('--mx', e.clientX + 'px'), glow.style.setProperty('--my', e.clientY - hero.getBoundingClientRect().top + 'px'));
      }, on);
      hero.addEventListener('pointerleave', () => { mx = 0; my = 0; }, on);
    }
    chips.forEach((c) => { c.addEventListener('pointerenter', () => { hoverT = 0; }, on); c.addEventListener('pointerleave', () => { hoverT = 1; }, on); });
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf && !REDUCED) raf = requestAnimationFrame(loop); }); io.observe(hero);

    const draw = (dt) => {
      phase += dt * api.speed; hoverF += (hoverT - hoverF) * Math.min(1, dt * 5); cphase += dt * .085 * api.speed * hoverF; t += dt;
      for (const B of bodies) {
        const th = B.b.p + B.o.w * phase, [x, y, z] = B.at(th);
        B.g.setAttribute('transform', 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ') scale(' + (.78 + .22 * z).toFixed(3) + ')'); put(B.g, z);
        B.ghosts.forEach((gh, i) => { const [gx, gy, gz] = B.at(th - Math.sign(B.o.w) * (i + 1) * .05); gh.setAttribute('cx', gx.toFixed(2)); gh.setAttribute('cy', gy.toFixed(2)); put(gh, gz); });
      }
      chips.forEach((c, i) => {
        const a = -2.3 + i * (Math.PI * 2 / chips.length) + cphase, bob = Math.sin(t * 1.2 + i * 2.1) * 5;
        c.style.transform = 'translate(-50%, -50%) translate3d(' + (Math.cos(a) * crx).toFixed(1) + 'px,' + (Math.sin(a) * cry + bob).toFixed(1) + 'px,0)';
      });
      px += (mx - px) * Math.min(1, dt * 3.2); py += (my - py) * Math.min(1, dt * 3.2);
      const fy = REDUCED ? 0 : Math.sin(t * .7) * 6; // gentle float of the whole system
      layers.forEach((l) => { l.el.style.transform = 'translate3d(' + (px * l.d).toFixed(2) + 'px,' + (py * l.d + fy * (l.d / 12)).toFixed(2) + 'px,0)'; });
      if (orb) { orb.style.setProperty('--gx', (32 + px * 30).toFixed(1) + '%'); orb.style.setProperty('--gy', (24 + py * 30).toFixed(1) + '%'); }
    };
    function loop(now) {
      if (!visible) { raf = 0; last = 0; return; }
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now;
      draw(dt); raf = requestAnimationFrame(loop);
    }
    draw(0);
    if (!REDUCED) raf = requestAnimationFrame(loop);
    cleanups.push(() => api.destroy());
    return api;
  }

  /* ---------- behaviours ---------- */
  function wire() {
    const sig = { signal: ac.signal };
    const go = (id) => { const el = id === 'top' ? document.body : $('#' + id); if (!el) return; closeMenu(); lenis ? lenis.scrollTo(id === 'top' ? 0 : el, { offset: -10, duration: 1.4 }) : (id === 'top' ? scrollTo({ top: 0, behavior: 'smooth' }) : el.scrollIntoView({ behavior: 'smooth' })); };
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]'); if (a && a.getAttribute('href').length > 1) { e.preventDefault(); go(a.getAttribute('href').slice(1)); }
      if (e.target.closest('[data-top]')) go('top');
    }, sig);
    $('.lang') && $('.lang').addEventListener('click', () => { lang = lang === 'ar' ? 'en' : 'ar'; try { localStorage.setItem('bs-lang', lang); } catch { } mount(); });
    const burger = $('.burger'), menu = $('#menu');
    burger && burger.addEventListener('click', () => { const open = !menu.classList.contains('open'); menu.classList.toggle('open', open); burger.classList.toggle('open', open); open ? lenis && lenis.stop() : lenis && lenis.start(); });
    // filters
    $$('.chip[data-cat]').forEach((b) => b.addEventListener('click', () => filterWorks(b.dataset.cat)));
    $('.ct-orb') && $('.ct-orb').addEventListener('click', () => setTimeout(() => { const n = $('#ct-form input[name=name]'); n && n.focus({ preventScroll: true }); }, 1200), sig);
    $$('.work').forEach((w) => w.addEventListener('click', () => openBox(+w.dataset.i)));
    activeCat = 'all';
    // spotlight that follows the pointer inside service cards
    if (FINE) $$('.card, .ct-form').forEach((c) => c.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); }, sig));
    // header state
    let last = 0;
    addEventListener('scroll', () => {
      const y = scrollY, hd = $('#header'); hd.classList.toggle('scrolled', y > 40); hd.classList.toggle('hide', y > last && y > 400 && !$('#menu.open')); last = y;
      const p = y / Math.max(1, document.documentElement.scrollHeight - innerHeight); $('#progress').style.transform = `scaleX(${p})`;
    }, { passive: true, ...sig });
    // cursor hover states
    if (FINE) {
      document.addEventListener('mouseover', (e) => {
        const cur = $('.cursor'); const w = e.target.closest('.work');
        cur.classList.toggle('view', !!w); if (w) $('.c-ring span').textContent = t((C.works || {}).viewLabel) || 'View';
        cur.classList.toggle('hover', !w && !!e.target.closest('a, button, .chip, .chip3d, .card, input, textarea, select'));
      }, sig);
    }
  }

  function closeMenu() { $('#menu').classList.remove('open'); $('.burger') && $('.burger').classList.remove('open'); lenis && lenis.start(); }

  function filterWorks(cat) {
    activeCat = cat; $$('.chip[data-cat]').forEach((b) => b.classList.toggle('on', b.dataset.cat === cat));
    const all = $$('.work'); const show = all.filter((w) => cat === 'all' || w.dataset.cat === cat);
    if (!hasGSAP()) { all.forEach((w) => w.classList.toggle('out', !show.includes(w))); return; }
    gsap.to(all, { opacity: 0, scale: .94, duration: .25, ease: 'power2.in', onComplete: () => {
      all.forEach((w) => w.classList.toggle('out', !show.includes(w)));
      gsap.fromTo(show, { opacity: 0, y: 40, scale: .96 }, { opacity: 1, y: 0, scale: 1, duration: .8, stagger: .07, ease: 'power3.out', clearProps: 'transform,translate,rotate,scale', onComplete: () => window.ScrollTrigger && ScrollTrigger.refresh() });
    } });
  }

  /* ---------- lightbox ---------- */
  let boxList = [], boxPos = 0;
  function openBox(i) {
    boxList = $$('.work').filter((w) => !w.classList.contains('out')).map((w) => +w.dataset.i); boxPos = Math.max(0, boxList.indexOf(i)); renderBox(true);
  }
  function renderBox(first) {
    const lb = $('#lightbox'), w = (C.works.items || [])[boxList[boxPos]]; if (!w) return;
    const cat = ((C.works.categories || []).find((c) => c.id === w.category) || {}).name;
    const media = [w.image, ...(w.gallery || [])].filter(Boolean).map((u) => /\.(mp4|webm)$/i.test(u) ? h('video', { src: src(u), controls: true, playsinline: true }) : h('img', { src: src(u), alt: t(w.title) }));
    const dl = h('dl', {}, w.client ? h('div', {}, h('dt', { text: 'Client' }), h('dd', { text: w.client })) : null, w.year ? h('div', {}, h('dt', { text: 'Year' }), h('dd', { text: w.year })) : null);
    const wrap = h('div', { class: 'lb-wrap' }, h('div', { class: 'lb-meta' }, h('p', { text: t(w.desc) }), dl), media);
    const body = h('div', { class: 'lb-body' }, wrap);
    const btn = (cls, ic, label, fn, flip) => { const b = h('button', { class: 'round', 'aria-label': label, onclick: fn }, icon(ic, flip ? 'flip' : '')); return b; };
    const prev = btn('', 'arrow', 'Previous', () => stepBox(-1), true), next = btn('', 'arrow', 'Next', () => stepBox(1));
    prev.firstChild.style.transform = lang === 'ar' ? '' : 'scaleX(-1)'; next.firstChild.style.transform = lang === 'ar' ? 'scaleX(-1)' : '';
    lb.replaceChildren(h('div', { class: 'lb-bar' }, h('div', { class: 'lb-title' }, t(w.title), h('small', { text: t(cat) })), h('div', { class: 'lb-btns' }, prev, next, btn('', 'close', 'Close', closeBox))), body);
    lb.classList.add('open'); lb.setAttribute('aria-hidden', 'false'); lenis && lenis.stop(); document.body.style.overflow = 'hidden';
    if (hasGSAP()) gsap.to($$('.lb-wrap > *', lb), { opacity: 1, y: 0, duration: .9, stagger: .12, ease: 'power3.out', delay: first ? .15 : 0 }); else $$('.lb-wrap > *', lb).forEach((n) => { n.style.opacity = 1; n.style.transform = 'none'; });
  }
  const stepBox = (d) => { boxPos = (boxPos + d + boxList.length) % boxList.length; renderBox(false); };
  function closeBox() { const lb = $('#lightbox'); lb.classList.remove('open'); lb.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; lenis && lenis.start(); }
  addEventListener('keydown', (e) => {
    if (!$('#lightbox.open')) return;
    if (e.key === 'Escape') closeBox();
    if (e.key === 'ArrowRight') stepBox(lang === 'ar' ? -1 : 1); if (e.key === 'ArrowLeft') stepBox(lang === 'ar' ? 1 : -1);
  });

  /* ---------- motion ---------- */
  function animate() {
    const { gsap, ScrollTrigger } = window; gsap.registerPlugin(ScrollTrigger);
    gctx = gsap.context((self) => {
      if (REDUCED) { return; }
      const sig = { signal: ac.signal };
      // split headings (hero handled by intro timeline)
      $$('[data-split]').forEach((el) => {
        if (el.closest('.hero')) return;
        gsap.from($$('.split-line > span', el), { yPercent: 118, rotate: 3, duration: 1.15, stagger: .13, ease: 'power4.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
      });
      // section reveals: fade + rise, staggered for elements entering together (card rows, stats...)
      const rvs = $$('.rv, .work').filter((el) => !el.closest('.hero'));
      gsap.set(rvs, { y: 44, opacity: 0 });
      ScrollTrigger.batch(rvs, { start: 'top 90%', once: true, onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: .09, overwrite: true, clearProps: 'transform,translate,rotate,scale,opacity' }) });
      // counters
      $$('[data-count]').forEach((el) => {
        const m = /^(\D*)(\d+(?:\.\d+)?)(.*)$/.exec(el.dataset.count); if (!m) return;
        const o = { v: 0 }, end = parseFloat(m[2]), dec = (m[2].split('.')[1] || '').length;
        ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: end, duration: 2.2, ease: 'power3.out', onUpdate: () => { el.textContent = m[1] + o.v.toFixed(dec) + m[3]; } }) });
      });
      // skill bars
      $$('.bar i').forEach((el) => gsap.to(el, { scaleX: (+el.dataset.level || 0) / 100, duration: 1.6, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%', once: true } }));
      // about photo
      const ph = $('.photo'); if (ph) {
        gsap.from(ph, { clipPath: 'inset(100% 0 0 0 round 28px)', duration: 1.6, ease: 'power4.inOut', scrollTrigger: { trigger: ph, start: 'top 85%', once: true } });
        const im = $('img.fill', ph); im && gsap.to(im, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: ph, start: 'top bottom', end: 'bottom top', scrub: true } });
        gsap.from($('.badge'), { scale: 0, rotate: -12, duration: 1, ease: 'back.out(1.8)', scrollTrigger: { trigger: ph, start: 'top 60%', once: true } });
      }
      // process: one scrubbed progress value drives the track fill, the runner and the lit steps
      const pr = $('.pr'); if (pr) {
        const steps = $$('.pr-step', pr), n = steps.length, o = { p: 0 };
        const apply = () => { pr.style.setProperty('--p', o.p.toFixed(4)); steps.forEach((s, i) => s.classList.toggle('on', o.p >= (n > 1 ? i / (n - 1) : 0) - .02)); };
        gsap.to(o, { p: 1, ease: 'none', onUpdate: apply, scrollTrigger: { trigger: pr, start: 'top 72%', end: 'bottom 55%', scrub: .7 } });
      }
      // contact: soft parallax on the background glows
      $$('.ct-bg i').forEach((b, i) => gsap.to(b, { yPercent: i ? -30 : 30, ease: 'none', scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'bottom top', scrub: true } }));
      // hero parallax on scroll
      if ($('.hero-art')) gsap.to('.hero-art', { yPercent: 14, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      if ($('.hero-text')) gsap.to('.hero-text', { yPercent: -8, opacity: .2, ease: 'none', scrollTrigger: { trigger: '.hero', start: '55% top', end: 'bottom top', scrub: true } });
      // work cards: image parallax
      $$('.work-media img').forEach((im) => gsap.fromTo(im, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: im.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));
      $$('.work-media img').forEach((im) => { im.style.height = '112%'; im.style.top = '-6%'; });
      heroFX($('.hero'), { signal: ac.signal });
      // active nav
      (C.sections || []).filter((s) => s.visible && BUILD[s.id]).forEach((s) => { const el = $('#' + s.id); el && ScrollTrigger.create({ trigger: el, start: 'top 55%', end: 'bottom 55%', onToggle: (self) => { const a = $(`[data-nav="${s.id}"]`); a && $$('.nav a').forEach((x) => x.classList.toggle('active', self.isActive ? x === a : x.classList.contains('active') && x !== a)); const nv = $('.nav'); nv && nv._move && nv._move(); } }); });
      // marquee driven by scroll velocity
      const track = $('.mq-track'); if (track) {
        const w = () => track.firstChild.getBoundingClientRect().width; let x = 0, vel = 0, dir = -1;
        ScrollTrigger.create({ onUpdate: (self) => { vel = self.getVelocity(); } });
        const tick = (time, dt) => { const gw = w(); if (!gw) return; const boost = Math.min(Math.abs(vel) / 160, 14); x += dir * (1.1 + boost) * (dt / 16.6); if (x <= -gw) x += gw; if (x > 0) x -= gw; track.style.transform = `translate3d(${x}px,0,0)`; vel *= .9; };
        gsap.ticker.add(tick); cleanups.push(() => gsap.ticker.remove(tick));
      }
      // magnetic pull on the primary buttons only
      if (FINE) {
        $$('.mag').forEach((b) => {
          const mx = gsap.quickTo(b, 'x', { duration: .6, ease: 'power3' }), my = gsap.quickTo(b, 'y', { duration: .6, ease: 'power3' }), sc = gsap.quickTo(b, 'scale', { duration: .5, ease: 'power3' });
          b.addEventListener('pointerenter', () => sc(1.03), sig);
          b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); mx((e.clientX - (r.left + r.width / 2)) * .18); my((e.clientY - (r.top + r.height / 2)) * .26); }, sig);
          b.addEventListener('pointerleave', () => { mx(0); my(0); sc(1); }, sig);
        });
      }
    });
  }

  /* hero entrance (runs after the preloader) */
  function heroIn() {
    if (!hasGSAP() || REDUCED) return;
    const { gsap } = window;
    gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.hero-grid, .hero-glow, .hero-fx', { opacity: 0, duration: 1.4, ease: 'power1.out' }, 0)
        .from('#header .hd > *', { y: -24, opacity: 0, duration: .9, stagger: .08 }, .15)
        .from('.hero .eyebrow', { y: 18, opacity: 0, duration: .8 }, .2)
        .from('.hero .split-line > span', { yPercent: 115, duration: 1.2, stagger: .12, ease: 'power4.out' }, .3)
        .from('.hero .lead', { y: 22, opacity: 0, duration: 1 }, .75)
        .from('.hero-cta > *', { y: 22, opacity: 0, duration: .9, stagger: .12 }, .95)
        .from('.hero-art .halo', { opacity: 0, duration: 1.6 }, .45)
        .from('.hero-art .hero-orb, .hero-art .hero-mark, .hero-art .hero-photo', { scale: .84, opacity: 0, duration: 1.5, stagger: .15, ease: 'expo.out' }, .55)
        .from('.hero-art .orbits', { opacity: 0, duration: 1.4, ease: 'power2.out' }, 1.05)
        .add(() => { if (orbitSys) gsap.to(orbitSys, { speed: 1, duration: 2.6, ease: 'power2.inOut' }); }, 1.05)
        .from('.hero-art .chip-in', { opacity: 0, y: 14, scale: .85, duration: .9, stagger: .18, ease: 'back.out(1.6)' }, 1.5)
        .from('.scroll-hint', { opacity: 0, y: 16, duration: 1 }, 1.7);
    });
  }

  /* ---------- preloader ---------- */
  function preload() {
    const pl = $('#preloader'), s = C.settings || {}, body = document.body;
    const done = () => { pl.remove(); body.classList.remove('loading'); lenis && lenis.start(); };
    if (!hasGSAP() || REDUCED || IS_PREVIEW || sessionStorage.getItem('bs-seen')) { done(); heroIn(); return; }
    sessionStorage.setItem('bs-seen', '1');
    $('#plLogo').src = $('#plLogoFill').src = src(s.logoMark);
    const o = { v: 0 }, { gsap } = window;
    lenis && lenis.stop();
    gsap.timeline({ onComplete: done })
      .to(o, { v: 100, duration: 1.9, ease: 'power2.inOut', onUpdate: () => { $('#plNum').textContent = Math.round(o.v); $('#plLogoFill').style.clipPath = `inset(${100 - o.v}% 0 0 0)`; } })
      .to('.pl-inner', { y: -40, opacity: 0, duration: .5, ease: 'power2.in' })
      .to('.pl-curtain', { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, '-=.2')
      .add(heroIn, '-=.55');
  }

  /* ---------- boot ---------- */
  async function boot() {
    document.body.classList.add('loading');
    if (!C.sections) { try { C = await (await fetch('/api/content')).json(); } catch { } }
    if (FINE) {
      document.body.classList.add('has-cursor');
      if (hasGSAP()) {
        const dot = $('.c-dot'), ring = $('.c-ring');
        const dx = gsap.quickTo(dot, 'x', { duration: .12 }), dy = gsap.quickTo(dot, 'y', { duration: .12 }), rx = gsap.quickTo(ring, 'x', { duration: .5, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: .5, ease: 'power3' });
        addEventListener('mousemove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); }, { passive: true });
      }
    }
    if (typeof window.Lenis !== 'undefined' && !REDUCED && !IS_PREVIEW) {
      lenis = new window.Lenis({ duration: 1.2, smoothWheel: true });
      if (hasGSAP()) { lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add((time) => lenis.raf(time * 1000)); gsap.ticker.lagSmoothing(0); }
      else { const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf); }
    }
    mount(); booted = true; preload();
  }

  /* live preview from the admin panel */
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.type === 'bs-preview') { C = e.data.content; const y = scrollY; mount(); scrollTo(0, y); }
    if (e.data.type === 'bs-goto') { const el = $('#' + e.data.id); el && el.scrollIntoView({ behavior: 'smooth' }); }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => addEventListener('load', boot)); else if (document.readyState === 'complete') boot(); else addEventListener('load', boot);
})();

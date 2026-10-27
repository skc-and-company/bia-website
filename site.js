/* Bihar Industries Association — public site renderer.
   Everything visible comes from content.json (or the admin's draft on this device), so the admin can change any part. */
(function () {
  const { idb, fetchPublished, preloadUploads, asset, t: tr, esc, md } = window.BIA;
  const PREVIEW = new URLSearchParams(location.search).get('preview') === '1';
  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ls = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };
  let C = null, usingDraft = false, lang = 'en', explicitMode = null, slideTimer = null;
  const T = (v) => tr(v, lang);
  const U = (k) => (C.ui[k] ? T(C.ui[k]) : k);

  /* ---------------------------------------------------------------- icons */
  const P = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    pin: '<path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
    chev: '<path d="m6 9 6 6 6-6"/>', left: '<path d="m15 6-6 6 6 6"/>', right: '<path d="m9 6 6 6-6 6"/>', check: '<path d="m5 12 5 5 9-10"/>',
    skill: '<path d="M3 4h18v12H3zM8 20h8M12 16v4"/>', outreach: '<path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z"/><path d="M9 4v13M15 7v13"/>',
    startup: '<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M14 4c3-1 6-1 6-1s0 3-1 6l-6 6-5-5z"/><circle cx="15" cy="9" r="1.5"/>',
    expo: '<path d="M3 20h18M4 20V11l8-6 8 6v9M9 20v-5h6v5"/>', award: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/>',
    lecture: '<path d="M9 3h6v11H9zM5 11a7 7 0 0 0 14 0M12 18v3"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    Facebook: '<path fill="currentColor" stroke="none" d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8.5c0-.3.2-.5.5-.5z"/>',
    X: '<path fill="currentColor" stroke="none" d="M4 4h4.5l4 5.6L17 4h3l-6.1 7.3L20.5 20H16l-4.4-6.1L6.5 20h-3l6.7-8z"/>',
    YouTube: '<path fill="currentColor" stroke="none" d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3z"/>',
    Instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>',
    LinkedIn: '<path fill="currentColor" stroke="none" d="M4 9h4v11H4zM6 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM10 9h3.8v1.6C14.5 9.6 15.7 9 17.3 9 20 9 21 10.8 21 13.8V20h-4v-5.4c0-1.4-.4-2.4-1.7-2.4-1.4 0-2.3 1-2.3 2.6V20h-4z"/>',
    WhatsApp: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path fill="currentColor" stroke="none" d="M9 9.5c.3 2.5 2.5 4.7 5 5l1.2-1.2 1.8.8-.4 1.6c-3.5.5-8-4-7.5-7.5l1.6-.4.8 1.8z"/>',
  };
  const ic = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
  const arrow = ic('arrow', 'arrow');
  const eyebrow = (v) => (T(v) ? `<p class="eyebrow">${esc(T(v))}</p>` : '');
  const tick = `<span class="tk">${ic('check')}</span>`;

  /* ---------------------------------------------------------------- helpers */
  const isExt = (u) => /^(https?:|mailto:|tel:)/.test(u || '');
  const href = (u) => asset(u) || '#';
  const newTab = (u) => (isExt(u) || /\.(pdf|docx?|jpe?g|png)$/i.test(u || '') || (u || '').startsWith('upload:') ? ' target="_blank" rel="noopener"' : '');
  const fmtDate = (d, opts = { day: 'numeric', month: 'long', year: 'numeric' }) => {
    if (!d) return '';
    const dt = new Date(d.length === 7 ? d + '-01' : d);
    if (isNaN(dt)) return d;
    try { return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', opts).format(dt); } catch { return d; }
  };
  const rupee = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
  const img = (src, alt = '', cls = '', eager = false) => {
    const u = asset(src);
    return `<div class="ph ${cls}">${u ? `<img src="${esc(u)}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" onload="this.classList.add('ok')" onerror="this.remove()">` : ''}</div>`;
  };
  const initials = (name) => name.replace(/^(Shri|Smt\.|CA|CS|Dr\.|Ms\.|Late|Prof\.|श्री|श्रीमती|स्व\.)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const byDate = (a, b) => String(b.date || '').localeCompare(String(a.date || ''));
  const sectionById = (id) => C.policies.sections.find((s) => s.id === id);
  const isNew = (d) => d.date && (Date.now() - new Date(d.date).getTime()) / 864e5 <= (C.pages.policies.newDays || 60);
  const logoSrc = () => asset(C.site.logoImage) || 'bia-logo.png';

  // A fine line drawing of Patna: factory, Golghar, Mahabodhi temple, Gandhi Setu, the city and the Ganga.
  function lineArt(cls = 'lineart', w = 1240, h = 150) {
    let bridge = '';
    for (let x = 630; x <= 930; x += 30) bridge += `M${x} 112v28M${x + 3} 118q12 12 24 0`;
    let city = '', cx = 1060;
    [[34, 52], [28, 80], [36, 60], [22, 118], [40, 70], [30, 92], [34, 56], [26, 74]].forEach(([bw, bh]) => { city += `M${cx} 140V${140 - bh}h${bw}V140`; cx += bw + 6; });
    let waves = 'M0 147'; for (let i = 0; i < 31; i++) waves += 'q20 -3 40 0';
    return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><path d="M0 140h1240"/><path d="M30 140V96l34-20v20l34-20v20l34-20v20l34-20v64M148 76V30h12v46"/><path d="M240 140c2-50 34-82 70-84 36 2 68 34 70 84M297 56h26v-7h-26zM262 140c10-30 28-58 46-82M358 140c-10-30-28-58-46-82"/><path d="M470 140l26-120h16l26 120zM504 20v-14M478 120h56M482 100h48M487 80h38M491 60h30M495 40h22M444 140l12-44h8l12 44zM538 140l12-44h8l12 44z"/><path d="M620 112h320M620 106h320"/><path d="${bridge}"/><path d="${city}M1147 22v-14"/><circle cx="1000" cy="98" r="34"/><path d="${waves}"/></svg>`;
  }
  function pageHead(title, intro, crumbs = []) {
    return `<section class="phead on-dark">${lineArt('lineart')}<div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="#/">${esc(U('home'))}</a>${crumbs.map((c) => `<span aria-hidden="true">/</span>${c.href ? `<a href="${c.href}">${esc(c.label)}</a>` : `<span>${esc(c.label)}</span>`}`).join('')}</nav>
      <h1>${esc(title)}</h1>${intro ? `<p>${esc(intro)}</p>` : ''}</div><div class="kband"></div></section>`;
  }

  /* ---------------------------------------------------------------- theme */
  const FONTS = window.BIA_FONTS || {};
  function applyTheme() {
    const th = C.theme;
    const vars = (o) => Object.entries(o || {}).map(([k, v]) => `--${k}:${v};`).join('');
    const disp = th.fontDisplay || 'Poppins', body = th.fontBody || 'Mukta';
    let st = $('#theme-vars');
    if (!st) { st = document.createElement('style'); st.id = 'theme-vars'; document.head.appendChild(st); }
    st.textContent = `:root{${vars(th.light)}--radius:${+th.radius || 12}px;--font-display:"${disp}","Mukta",system-ui,sans-serif;--font-body:"${body}","Noto Sans Devanagari",system-ui,sans-serif}:root[data-mode="dark"]{${vars(th.dark)}}`;
    const fam = (f) => 'family=' + encodeURIComponent(f).replace(/%20/g, '+') + (FONTS[f] ? ':' + FONTS[f] : '');
    const url = `https://fonts.googleapis.com/css2?${fam(disp)}&${disp === body ? '' : fam(body) + '&'}display=swap`;
    const fl = $('#fontlink');
    if (fl && fl.getAttribute('href') !== url) fl.setAttribute('href', url);
    root.classList.toggle('motion', th.motion !== false);
    applyMode();
  }
  const sysDark = matchMedia('(prefers-color-scheme: dark)');
  function currentMode() { const m = explicitMode || (C && C.theme.defaultMode) || 'system'; return m === 'system' ? (sysDark.matches ? 'dark' : 'light') : m; }
  function applyMode() {
    const m = currentMode();
    root.dataset.mode = m;
    const meta = $('meta[name="theme-color"]');
    if (meta && C) meta.content = m === 'dark' ? C.theme.dark.navy || '#07081B' : C.theme.light.navy || '#14164A';
    const b = $('#modeBtn');
    if (b) { b.innerHTML = ic(m === 'dark' ? 'sun' : 'moon'); b.setAttribute('aria-label', U(m === 'dark' ? 'themeLight' : 'themeDark')); b.title = b.getAttribute('aria-label'); }
  }
  sysDark.addEventListener('change', () => { if (!explicitMode) applyMode(); });

  /* ---------------------------------------------------------------- shell */
  function brand(withSub = true) {
    const s = C.site;
    const sub = lang === 'en' ? [s.name.hi, T(s.estLine)].filter(Boolean).join(' · ') : T(s.estLine);
    return `<a class="brand" href="#/" aria-label="${esc(T(s.name))}"><img src="${esc(logoSrc())}" alt="${esc(s.short || 'BIA')}" width="69" height="52"><span class="brand-txt"><b>${esc(T(s.name))}</b>${withSub ? `<small>${esc(sub)}</small>` : ''}</span></a>`;
  }
  const curBase = () => '#/' + (location.hash.replace(/^#\/?/, '').split('/')[0] || '');
  const isCur = (r) => r && ('#/' + r.replace(/^#\/?/, '').split('/')[0]) === curBase();
  function navHTML() {
    return C.nav.filter((n) => n.visible !== false).map((n) => {
      const kids = (n.children || []).filter((k) => T(k.label));
      const active = isCur(n.route) || kids.some((k) => isCur(k.route));
      if (!kids.length) return `<li><a class="top" href="${esc(n.route)}"${newTab(n.route)}${active ? ' aria-current="page"' : ''}>${esc(T(n.label))}</a></li>`;
      return `<li><button class="top" type="button" aria-haspopup="true"${active ? ' aria-current="page"' : ''}>${esc(T(n.label))}${ic('chev')}</button><ul class="sub">${kids.map((k) => `<li><a href="${esc(k.route)}"${newTab(k.route)}${(location.hash || '#/').startsWith(k.route) && isCur(k.route) ? ' aria-current="page"' : ''}>${esc(T(k.label))}</a></li>`).join('')}</ul></li>`;
    }).join('');
  }
  function drawerNav() {
    const cur = location.hash || '#/';
    return C.nav.filter((n) => n.visible !== false).map((n) => {
      const kids = (n.children || []).filter((k) => T(k.label));
      if (!kids.length) return `<a href="${esc(n.route)}"${cur.startsWith(n.route) ? ' aria-current="page"' : ''}>${esc(T(n.label))}</a>`;
      return `<a href="${esc(kids[0].route)}">${esc(T(n.label))}</a>` + kids.map((k) => `<a class="child" href="${esc(k.route)}"${cur.startsWith(k.route) ? ' aria-current="page"' : ''}>${esc(T(k.label))}</a>`).join('');
    }).join('');
  }
  function renderShell() {
    const s = C.site;
    root.lang = lang;
    $('#proto').innerHTML = `${esc(U('prototype'))} <a href="https://www.biabihar.com/" target="_blank" rel="noopener">${esc(U('officialSite'))}: biabihar.com</a>`;
    $('#skip').textContent = U('skip');
    $('#draftbar').hidden = !(usingDraft && !PREVIEW);
    $('#draftbar').innerHTML = `<span>${esc(U('draftBanner'))}</span><button type="button" id="hideDraft">${esc(U('draftExit'))}</button>`;
    $('#util').innerHTML = `<div class="wrap"><div class="info">
        ${s.phone ? `<a href="tel:${esc(s.phone.replace(/\s/g, ''))}">${ic('phone')}${esc(s.phone)}</a>` : ''}
        ${s.email ? `<a class="hide-sm" href="mailto:${esc(s.email)}">${ic('mail')}${esc(s.email)}</a>` : ''}
        ${T(s.addressShort) ? `<span class="hide-sm">${ic('pin')}${esc(T(s.addressShort))}</span>` : ''}</div>
      <div class="tg"><button type="button" id="langBtn" lang="${lang === 'en' ? 'hi' : 'en'}" title="${esc(U('langSwitchLabel'))}" aria-label="${esc(U('langSwitchLabel'))}">${esc(U('langSwitch'))}</button><button type="button" id="modeBtn"></button></div></div>`;
    $('#hdr').innerHTML = `<div class="wrap hdr-in">${brand()}
      <nav class="nav" aria-label="Main"><ul>${navHTML()}</ul></nav>
      <div class="tools"><a class="btn btn-brand cta" href="#/membership">${esc(U('becomeMember'))}</a>
        <button class="icon-btn burger" id="burger" type="button" aria-label="${esc(U('menu'))}" aria-expanded="false" aria-controls="drawer">${ic('menu')}</button></div></div>`;
    $('#drawer').innerHTML = `<div class="scrim" data-close></div><div class="panel" role="dialog" aria-modal="true" aria-label="${esc(U('menu'))}">
      <div class="drawer-hd"><a href="#/"><img src="${esc(logoSrc())}" alt="${esc(s.short || 'BIA')}"></a><button class="icon-btn" type="button" data-close aria-label="${esc(U('close'))}">${ic('x')}</button></div>
      <nav>${drawerNav()}</nav><a class="btn btn-brand" href="#/membership">${esc(U('becomeMember'))}</a></div>`;
    renderFooter();
    applyMode();
  }
  function renderFooter() {
    const s = C.site, f = C.footer;
    $('#ftr').innerHTML = `<div class="kband"></div><div class="wrap ftr-in">
      <div><img class="ftr-logo" src="${esc(logoSrc())}" alt="${esc(s.short || 'BIA')}" loading="lazy">
        <p style="margin:18px 0 8px">${esc(T(f.about))}</p><p style="margin:0">${esc(T(s.address))}<br>${s.phone ? `<a href="tel:${esc(s.phone.replace(/\s/g, ''))}">${esc(s.phone)}</a>` : ''}${s.email ? ` · <a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : ''}</p>
        <div class="social">${(s.social || []).filter((x) => x.url).map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener" aria-label="${esc(x.name)}">${ic(x.name)}</a>`).join('')}</div></div>
      ${(f.columns || []).map((c) => `<div><h4>${esc(T(c.title))}</h4><ul>${(c.links || []).map((l) => `<li><a href="${esc(href(l.url))}"${newTab(l.url)}>${esc(T(l.label))}</a></li>`).join('')}</ul></div>`).join('')}
    </div><div class="wrap">${lineArt('lineart')}</div><div class="ftr-bot"><div class="wrap"><span>${esc(T(f.copyright))}</span><span>${esc(U('prototype'))}</span></div></div>`;
  }

  /* ---------------------------------------------------------------- home sections */
  const H = {
    hero(s) {
      const slides = (s.slides || []).filter((x) => x.image);
      return `<section class="hero on-dark" aria-roledescription="carousel"><div class="slides">${slides.map((x, i) => `<div class="slide${i === 0 ? ' on' : ''}" aria-hidden="${i !== 0}"><img src="${esc(asset(x.image))}" alt="${esc(T(x.caption))}"${i === 0 ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"></div>`).join('')}</div>
        <div class="wrap hero-in">${eyebrow(s.eyebrow)}<h1>${esc(T(s.title))}</h1><p class="lede">${esc(T(s.lede))}</p>
        <div class="hero-cta">${T(s.cta1.label) ? `<a class="btn btn-accent" href="${esc(s.cta1.link)}">${esc(T(s.cta1.label))}${arrow}</a>` : ''}${T(s.cta2.label) ? `<a class="btn btn-ghost" href="${esc(s.cta2.link)}">${esc(T(s.cta2.label))}</a>` : ''}</div></div>
        ${slides.length ? `<div class="hero-foot"><div class="wrap"><div class="dots">${slides.length > 1 ? slides.map((x, i) => `<button type="button" data-slide="${i}" aria-label="${i + 1} / ${slides.length}"${i === 0 ? ' aria-current="true"' : ''}></button>`).join('') : ''}</div><span class="caption" id="caption">${esc(T(slides[0].caption))}</span></div></div>` : ''}
      </section><div class="kband"></div>`;
    },
    stats(s) {
      const items = (s.items || []).filter((i) => i.value);
      if (!items.length) return '';
      return `<section class="stats"><div class="wrap stats-in">${items.map((i) => `<div class="stat"><b>${esc(i.value)}</b><span>${esc(T(i.label))}</span></div>`).join('')}</div></section>`;
    },
    updates(s) {
      const docs = [...C.policies.items].sort(byDate).slice(0, +s.count || 5);
      return `<section class="section tint"><div class="wrap updates">
        <div>${eyebrow(s.eyebrow)}<h2>${esc(T(s.title))}</h2><p class="intro">${esc(T(s.intro))}</p>${newPolicyCard()}</div>
        <div><div class="doc-rows">${docs.map(docRow).join('')}</div><p style="margin-top:20px"><a class="link-arrow" href="#/policies">${esc(U('viewAll'))} ${arrow}</a></p></div></div></section>`;
    },
    president(s) {
      return `<section class="section"><div class="wrap pres">
        <div class="pres-photo">${img(s.photo, T(s.name))}</div>
        <div>${eyebrow(s.eyebrow)}<blockquote class="quote">“${esc(T(s.message))}”</blockquote>
          <p class="sig"><b>${esc(T(s.name))}</b><span class="muted">${esc(T(s.role))}</span></p>
          ${s.link ? `<a class="link-arrow" style="margin-top:16px" href="${esc(s.link)}">${esc(U('officeBearers'))} ${arrow}</a>` : ''}</div></div></section>`;
    },
    news(s) {
      const items = [...C.news].sort(byDate).slice(0, (+s.count || 5));
      if (!items.length) return '';
      return `<section class="section tint"><div class="wrap"><div class="sec-head"><div>${eyebrow(s.eyebrow)}<h2>${esc(T(s.title))}</h2></div><a class="btn btn-line sm" href="#/news">${esc(U('viewAll'))}</a></div>
        <div class="news-home">${newsCard(items[0], true)}${items.slice(1).map(newsRow).join('')}</div></div></section>`;
    },
    membership(s) {
      return `<section class="section"><div class="wrap"><div class="band on-dark">
        <div>${eyebrow(s.eyebrow)}<h2>${esc(T(s.title))}</h2><p>${esc(T(s.text))}</p><a class="btn btn-accent" href="#/membership">${esc(T(s.cta))}${arrow}</a></div>
        <div class="mini-calc"><label for="miniCat">${esc(U('feeCalc'))}</label>${feeSelect('miniCat')}<div class="vals"><div class="first"><small>${esc(U('firstYear'))}</small><b id="miniFirst"></b></div><div><small>${esc(U('renewal'))}</small><b id="miniRenew"></b></div></div><p class="note" id="miniNote"></p></div>
      </div></div></section>`;
    },
    events(s) {
      const up = upcoming();
      return `<section class="section tint"><div class="wrap"><div class="sec-head"><div>${eyebrow(s.eyebrow)}<h2>${esc(T(s.title))}</h2></div><a class="btn btn-line sm" href="#/events">${esc(U('viewAll'))}</a></div>
        ${up.length ? `<div class="grid g3" style="margin-bottom:24px">${up.slice(0, 3).map(eventCard).join('')}</div>` : ''}
        <div class="annual">${(C.pages.events.annual || []).map(annualCard).join('')}</div></div></section>`;
    },
    bulletin(s) {
      const b = [...C.bulletins].sort((a, b2) => b2.month.localeCompare(a.month));
      if (!b.length) return '';
      return `<section class="section"><div class="wrap bul-feature">${cover(b[0])}
        <div>${eyebrow(s.eyebrow)}<h2>${esc(T(s.title))}</h2><p class="muted" style="margin:16px 0 24px;font-size:1.1rem;max-width:36em">${esc(T(s.text))}</p>
        <div class="bul-list" style="margin-bottom:22px">${b.slice(1, 5).map(bulItem).join('')}</div><a class="link-arrow" href="#/bulletin">${esc(U('archive'))} ${arrow}</a></div></div></section>`;
    },
    initiatives(s) {
      return `<section class="section tint"><div class="wrap"><div class="sec-head"><div>${eyebrow(s.eyebrow)}<h2>${esc(T(s.title))}</h2></div><a class="btn btn-line sm" href="#/initiatives">${esc(U('viewAll'))}</a></div>
        <div class="ini">${(C.pages.initiatives.items || []).slice(0, 6).map(iniCard).join('')}</div></div></section>`;
    },
    partners(s) {
      if (!(s.items || []).length) return '';
      return `<section class="section" style="padding-block:clamp(44px,5vw,64px)"><div class="wrap"><h3 style="margin-bottom:20px">${esc(T(s.title))}</h3>
        <div class="partners">${s.items.map((p) => `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(T(p.name))}${ic('ext')}</a>`).join('')}</div></div></section>`;
    },
  };
  function startSlides() {
    clearInterval(slideTimer);
    const slides = $$('.hero .slide');
    if (slides.length < 2) return;
    let i = 0;
    const caps = (C.home.hero.slides || []).filter((x) => x.image);
    const show = (k) => {
      i = (k + slides.length) % slides.length;
      slides.forEach((s, j) => { s.classList.toggle('on', j === i); s.setAttribute('aria-hidden', String(j !== i)); const im = s.querySelector('img'); if (j === (i + 1) % slides.length && im) im.loading = 'eager'; });
      $$('[data-slide]').forEach((d, j) => (j === i ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
      const c = $('#caption'); if (c && caps[i]) c.textContent = T(caps[i].caption);
    };
    $$('[data-slide]').forEach((d) => d.addEventListener('click', () => { show(+d.dataset.slide); restart(); }));
    const restart = () => { clearInterval(slideTimer); if (!matchMedia('(prefers-reduced-motion: reduce)').matches) slideTimer = setInterval(() => { if (!document.hidden) show(i + 1); }, 6500); };
    restart();
  }

  /* ---------------------------------------------------------------- shared pieces */
  function docRow(d) {
    const sec = sectionById(d.section);
    return `<a class="doc-row" href="#/policies/${esc(d.section)}"><span class="t"><h3>${esc(T(d.title))}</h3><span class="status s-${esc(d.status)}">${esc(U('st_' + d.status))}</span></span>
      <span class="meta">${isNew(d) ? `<span class="new-badge">${esc(U('newBadge'))}</span>` : ''}<span class="chip brand">${esc(T(sec && sec.title))}</span><span>${esc(d.effective ? U('effective') + ' ' + fmtDate(d.effective) : fmtDate(d.date))}</span></span></a>`;
  }
  function npSteps() {
    const np = C.policies.newPolicy, order = ['awaited', 'draft', 'notified'], idx = order.indexOf(np.status);
    return `<ol class="np-steps">${order.map((s, i) => `<li class="${i < idx ? 'done' : i === idx ? 'on' : ''}">${esc(U('np_' + s))}</li>`).join('')}</ol>`;
  }
  function npActions(np) {
    return np.fileEn || np.fileHi || np.source ? `<div class="doc-actions" style="margin-top:14px">${np.fileEn ? `<a class="btn btn-brand sm" href="${esc(href(np.fileEn))}" target="_blank" rel="noopener">${ic('doc')}${esc(U('openDoc'))}</a>` : ''}${np.fileHi ? `<a class="btn btn-quiet sm" href="${esc(href(np.fileHi))}" target="_blank" rel="noopener">${esc(U('hindiPdf'))}</a>` : ''}${np.source ? `<a class="btn btn-quiet sm" href="${esc(np.source)}" target="_blank" rel="noopener">${esc(U('officialSource'))}${ic('ext')}</a>` : ''}</div>` : '';
  }
  function newPolicyCard() {
    const np = C.policies.newPolicy;
    if (!np || !np.show) return '';
    return `<div class="np-card"><span class="status s-${esc(np.status)}">${esc(U('np_' + np.status))}</span><h3>${esc(T(np.title))}</h3>${npSteps()}<p class="muted" style="margin:0">${esc(T(np.text))}</p>${npActions(np)}</div>`;
  }
  function newPolicyWide() {
    const np = C.policies.newPolicy;
    if (!np || !np.show) return '';
    return `<div class="np-card np-wide" style="margin-top:28px"><div><span class="status s-${esc(np.status)}">${esc(U('np_' + np.status))}</span><h3 style="font-size:1.6rem">${esc(T(np.title))}</h3><p class="muted" style="margin:0">${esc(T(np.text))}</p>${npActions(np)}</div>${npSteps()}</div>`;
  }
  const catLabel = (n) => T(C.pages.news.categories[n.category]) || n.category;
  function newsCard(n, big) {
    return `<a class="news-card${big ? ' news-big' : ''}" href="#/news/${esc(n.id)}">${img(n.image, T(n.title))}<span class="body"><span class="meta"><span class="cat">${esc(catLabel(n))}</span><span>· ${esc(fmtDate(n.date))}</span></span><h3>${esc(T(n.title))}</h3>${big ? `<p>${esc(T(n.summary))}</p>` : ''}</span></a>`;
  }
  const newsRow = (n) => `<a class="news-row" href="#/news/${esc(n.id)}">${img(n.image, T(n.title))}<span class="body"><span class="meta"><span class="cat">${esc(catLabel(n))}</span><span>· ${esc(fmtDate(n.date, { day: 'numeric', month: 'short', year: 'numeric' }))}</span></span><h3>${esc(T(n.title))}</h3></span></a>`;
  const upcoming = () => { const today = new Date().toISOString().slice(0, 10); return (C.pages.events.upcoming || []).filter((e) => e.date && (e.endDate || e.date) >= today).sort((a, b) => a.date.localeCompare(b.date)); };
  function eventCard(e) {
    return `<article class="card"><span class="month">${esc(fmtDate(e.date, { day: 'numeric', month: 'short' }))}</span><h3 style="margin:12px 0 6px">${esc(T(e.title))}</h3>
      <p class="meta">${esc(T(e.venue))}</p><p class="muted">${esc(T(e.text))}</p>${e.registerLink ? `<a class="btn btn-accent sm" href="${esc(e.registerLink)}" target="_blank" rel="noopener">${esc(U('register'))}</a>` : ''}</article>`;
  }
  const annualCard = (a) => `<a class="card lift" href="${esc(a.link || '#/events')}"><span class="month">${esc(T(a.when))}</span><h3>${esc(T(a.name))}</h3><p>${esc(T(a.text))}</p></a>`;
  function cover(b) {
    return `<a class="cover" href="${esc(href(b.url))}" target="_blank" rel="noopener" aria-label="${esc(U('latestIssue'))}: ${esc(T(b.title))}"><img src="${esc(logoSrc())}" alt=""><span class="cv"><b>${lang === 'hi' ? 'बुलेटिन' : 'Bulletin'}</b><span>${esc(T(b.title))}</span></span></a>`;
  }
  const bulItem = (b) => `<a class="bul-item" href="${esc(href(b.url))}" target="_blank" rel="noopener"><span>${esc(T(b.title))}</span>${ic('doc')}</a>`;
  const iniCard = (i) => `<article class="card lift"><span class="ico">${ic(i.icon || 'award')}</span><h3>${esc(T(i.title))}</h3><p>${esc(T(i.text))}</p>${i.link ? `<a class="link-arrow" href="${esc(href(i.link))}"${newTab(i.link)}>${esc(T(i.linkLabel) || U('readMore'))} ${arrow}</a>` : ''}</article>`;

  /* fee calculator */
  const feeRows = () => C.pages.membership.fees || [];
  const feeCalc = (f) => { const g = (+C.pages.membership.gstRate || 0) / 100; return { yearly: f.yearly, admission: f.admission, gst: (f.yearly + f.admission) * g, first: (f.yearly + f.admission) * (1 + g), renewal: f.yearly * (1 + g) }; };
  function feeSelect(id) {
    return `<select class="select" id="${id}">${['industry', 'service', 'other'].map((g) => {
      const rows = feeRows().map((f, i) => [f, i]).filter(([f]) => f.group === g);
      return rows.length ? `<optgroup label="${esc(U('g_' + g))}">${rows.map(([f, i]) => `<option value="${i}">${esc(T(f.label))}</option>`).join('')}</optgroup>` : '';
    }).join('')}</select>`;
  }
  function bindMiniCalc() {
    const sel = $('#miniCat'); if (!sel) return;
    const upd = () => { const f = feeRows()[+sel.value]; if (!f) return; const r = feeCalc(f);
      $('#miniFirst').textContent = rupee(r.first); $('#miniRenew').textContent = rupee(r.renewal);
      $('#miniNote').textContent = `${rupee(f.yearly)} ${U('yearly')} + ${rupee(f.admission)} ${U('admission')} + ${U('gst')} ${C.pages.membership.gstRate}%`; };
    sel.value = String(Math.max(0, feeRows().findIndex((f) => f.group === 'industry' && f.yearly === 10000)));
    sel.addEventListener('change', upd); upd();
  }

  /* ---------------------------------------------------------------- pages */
  const pages = {
    home() {
      const html = (C.home.sections || []).filter((s) => s.visible !== false && H[s.id]).map((s) => H[s.id](C.home[s.id] || {})).join('');
      return { title: '', html, after() { bindMiniCalc(); startSlides(); } };
    },

    about() {
      const a = C.pages.about;
      return { title: T(a.title), html: pageHead(T(a.title), T(a.intro), [{ label: T(a.title) }]) + `
        <section class="section"><div class="wrap narrow prose">${md(T(a.story))}</div></section>
        <section class="section tint"><div class="wrap"><div class="vm">
          <div class="card">${eyebrow(C.ui.vision)}<p>${esc(T(a.vision))}</p></div>
          <div class="card">${eyebrow(C.ui.mission)}<p>${esc(T(a.mission))}</p></div></div>
          <h2 style="margin:56px 0 24px">${esc(U('objectives'))}</h2><ul class="ticks">${(a.objectives || []).map((o) => `<li>${tick}<span>${esc(T(o))}</span></li>`).join('')}</ul></div></section>
        <section class="section"><div class="wrap narrow"><h2 style="margin-bottom:30px">${esc(U('journey'))}</h2><ol class="timeline">${(a.timeline || []).map((t) => `<li><span class="yr">${esc(t.year)}</span>${esc(T(t.text))}</li>`).join('')}</ol>
          <p><a class="btn btn-line" href="#/leadership">${esc(U('officeBearers'))}${arrow}</a></p></div></section>` };
    },

    leadership() {
      const L = C.leadership, pg = C.pages.leadership, succ = L.succession || [];
      const roleLabel = (r) => U('r_' + r);
      return { title: T(pg.title), html: pageHead(T(pg.title), T(pg.intro), [{ label: T(pg.title) }]) + `
        <section class="section"><div class="wrap"><div class="sec-head"><div>${eyebrow({ en: L.year, hi: L.year })}<h2>${esc(U('officeBearers'))}</h2></div></div>
          <div class="people">${(L.officeBearers || []).map((p) => `<div class="card person"><div class="avatar">${asset(p.photo) ? `<img src="${esc(asset(p.photo))}" alt="" loading="lazy">` : esc(initials(T(p.name)))}</div><b>${esc(T(p.name))}</b><span>${esc(roleLabel(p.role))}</span></div>`).join('')}</div></div></section>
        <section class="section tint"><div class="wrap"><div class="sec-head"><div>${eyebrow({ en: L.councilYear, hi: L.councilYear })}<h2>${esc(U('council'))}</h2></div></div>
          <div class="council">${(L.council || []).map((p) => `<div><b>${esc(T(p.name))}</b><span>${esc(T(p.org))}</span></div>`).join('')}</div></div></section>
        <section class="section"><div class="wrap"><h2 style="margin-bottom:30px">${esc(U('committees'))}</h2><div class="cmte">${(L.committees || []).map((c) => `<div class="card"><h3>${esc(T(c.name))}</h3><dl>${(c.members || []).map((m) => `<dt>${esc(roleLabel(m.role))}</dt><dd>${esc(T(m.name))}</dd>`).join('')}</dl></div>`).join('')}</div></div></section>
        <section class="section tint"><div class="wrap"><h2 style="margin-bottom:22px">${esc(U('succession'))}</h2>
          <div class="tabs" role="tablist">${succ.map((s, i) => `<button class="tab" role="tab" type="button" data-succ="${i}" aria-selected="${i === 0}">${esc(T(s.title))}<span class="n">${s.people.length}</span></button>`).join('')}</div>
          <div class="tbl-wrap" style="margin-top:18px"><table><thead><tr><th>#</th><th>${esc(U('name'))}</th><th>${esc(U('tenure'))}</th></tr></thead><tbody id="succBody"></tbody></table></div></div></section>`,
        after() {
          const show = (i) => { $$('[data-succ]').forEach((b) => b.setAttribute('aria-selected', String(+b.dataset.succ === i)));
            $('#succBody').innerHTML = (succ[i] ? succ[i].people : []).map((p, k) => `<tr><td class="num">${k + 1}</td><td>${esc(T(p.name))}</td><td class="num">${esc(p.tenure)}</td></tr>`).join(''); };
          $$('[data-succ]').forEach((b) => b.addEventListener('click', () => show(+b.dataset.succ))); show(0);
        } };
    },

    policies(section) {
      const pg = C.pages.policies, secs = C.policies.sections;
      const cur = secs.some((s) => s.id === section) ? section : 'all';
      const count = (id) => C.policies.items.filter((d) => id === 'all' || d.section === id).length;
      const years = [...new Set(C.policies.items.map((d) => (d.date || '').slice(0, 4)).filter(Boolean))].sort().reverse();
      const statuses = [...new Set(C.policies.items.map((d) => d.status))];
      const secObj = sectionById(cur);
      return { title: T(pg.title), html: pageHead(T(pg.title), T(pg.intro), [{ label: T(pg.title) }]) + `
        <section class="section" style="padding-top:clamp(32px,4vw,44px)"><div class="wrap">
          <nav class="tabs" aria-label="${esc(T(pg.title))}"><a class="tab" href="#/policies"${cur === 'all' ? ' aria-current="page"' : ''}>${esc(U('all'))}<span class="n">${count('all')}</span></a>${secs.map((s) => `<a class="tab" href="#/policies/${esc(s.id)}"${cur === s.id ? ' aria-current="page"' : ''}>${esc(T(s.title))}<span class="n">${count(s.id)}</span></a>`).join('')}</nav>
          ${secObj ? `<p class="muted" style="margin:18px 0 0;max-width:70ch">${esc(T(secObj.intro))}</p>` : ''}
          ${(cur === 'all' || cur === (C.policies.newPolicy || {}).section) ? newPolicyWide() : ''}
          <div class="toolbar"><label class="search"><span class="sr">${esc(U('libSearch'))}</span>${ic('search')}<input class="input" id="libQ" type="search" placeholder="${esc(U('libSearch'))}"></label>
            <select class="select" id="libYear" aria-label="${esc(U('allYears'))}"><option value="">${esc(U('allYears'))}</option>${years.map((y) => `<option>${y}</option>`).join('')}</select>
            <select class="select" id="libStatus" aria-label="${esc(U('allStatus'))}"><option value="">${esc(U('allStatus'))}</option>${statuses.map((s) => `<option value="${esc(s)}">${esc(U('st_' + s))}</option>`).join('')}</select></div>
          <div class="docs" id="docs"></div><p class="lib-note">${esc(T(pg.disclaimer))}</p></div></section>`,
        after() {
          const q = $('#libQ'), y = $('#libYear'), st = $('#libStatus');
          const run = () => {
            const k = q.value.trim().toLowerCase();
            const list = C.policies.items.filter((d) => (cur === 'all' || d.section === cur) && (!y.value || (d.date || '').startsWith(y.value)) && (!st.value || d.status === st.value)
              && (!k || JSON.stringify([d.title, d.issuer, d.summary, d.ref]).toLowerCase().includes(k))).sort(byDate);
            $('#docs').innerHTML = list.length ? list.map(docCard).join('') : `<div class="empty">${esc(U('noResults'))}</div>`;
          };
          let tmr; q.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(run, 120); }); y.addEventListener('change', run); st.addEventListener('change', run); run();
        } };
    },

    membership() {
      const m = C.pages.membership;
      const groups = ['industry', 'service', 'other'].filter((g) => feeRows().some((f) => f.group === g));
      const table = (g) => `<h3 style="margin:30px 0 12px">${esc(U('g_' + g))}</h3><div class="tbl-wrap"><table><thead><tr><th>${esc(U('chooseCategory'))}</th><th class="n">${esc(U('yearly'))}</th><th class="n">${esc(U('admission'))}</th><th class="n">${esc(U('gst'))} ${esc(m.gstRate)}%</th><th class="n">${esc(U('firstYear'))}</th></tr></thead><tbody>${feeRows().filter((f) => f.group === g).map((f) => { const r = feeCalc(f); return `<tr><td>${esc(T(f.label))}</td><td class="n">${rupee(f.yearly)}</td><td class="n">${rupee(f.admission)}</td><td class="n">${rupee(r.gst)}</td><td class="n"><b>${rupee(r.first)}</b></td></tr>`; }).join('')}</tbody></table></div>`;
      return { title: T(m.title), html: pageHead(T(m.title), T(m.intro), [{ label: T(m.title) }]) + `
        <section class="section"><div class="wrap"><h2 style="margin-bottom:26px">${esc(U('benefits'))}</h2><ul class="ticks">${(m.benefits || []).map((b) => `<li>${tick}<span>${esc(T(b))}</span></li>`).join('')}</ul></div></section>
        <section class="section tint" id="fees"><div class="wrap"><div class="sec-head"><div>${eyebrow(C.ui.fees)}<h2>${esc(U('feeCalc'))}</h2><p>${esc(U('tariffFrom'))} ${esc(fmtDate(m.tariffDate))}. ${esc(T(m.capitalNote))}</p></div></div>
          <div class="calc"><div class="calc-pick"><div class="seg" role="group" aria-label="${esc(U('chooseCategory'))}">${groups.map((g, i) => `<button type="button" data-grp="${g}" aria-pressed="${i === 0}">${esc(U('g_' + g))}</button>`).join('')}</div><div class="slabs" id="slabs"></div></div>
            <div class="calc-out on-dark" aria-live="polite" id="calcOut"></div></div>
          ${groups.map(table).join('')}<p class="muted" style="margin-top:16px">${esc(T(m.sickNote))}</p></div></section>
        <section class="section"><div class="wrap"><div class="grid g2" style="align-items:start;gap:clamp(28px,4vw,56px)">
          <div><h2 style="margin-bottom:20px">${esc(U('categories'))}</h2>${(m.categories || []).map((c, i) => `<details class="acc"${i === 0 ? ' open' : ''}><summary>${esc(T(c.name))}${ic('chev')}</summary><div class="acc-body">${esc(T(c.text))}</div></details>`).join('')}
            <h3 style="margin:30px 0 8px">${esc(U('representatives'))}</h3><p class="muted">${esc(T(m.representatives))}</p>
            ${(m.downloads || []).length ? `<h3 style="margin:24px 0 10px">${esc(U('downloads'))}</h3><div class="doc-actions">${m.downloads.map((d) => `<a class="btn btn-quiet sm" href="${esc(href(d.url))}" target="_blank" rel="noopener">${ic('doc')}${esc(T(d.label))}</a>`).join('')}</div>` : ''}</div>
          <div class="card" id="apply" style="box-shadow:var(--shadow)"><h2 style="font-size:1.8rem">${esc(T(m.applyTitle))}</h2><p class="muted" style="margin:10px 0 22px">${esc(T(m.applyText))}</p>${applyForm()}</div>
        </div></div></section>`,
        after() {
          let grp = groups[0];
          const out = $('#calcOut');
          const result = () => {
            const sel = $('#slabs input:checked'); if (!sel) return; const f = feeRows()[+sel.value], r = feeCalc(f);
            out.innerHTML = `<small>${esc(T(f.label))}</small><div class="calc-total">${rupee(r.first)}</div><small>${esc(U('firstYear'))}</small>
              <div class="calc-lines"><div class="calc-line"><span>${esc(U('yearly'))}</span><span>${rupee(r.yearly)}</span></div><div class="calc-line"><span>${esc(U('admission'))}</span><span>${rupee(r.admission)}</span></div><div class="calc-line"><span>${esc(U('gst'))} ${esc(m.gstRate)}%</span><span>${rupee(r.gst)}</span></div><div class="calc-line"><span>${esc(U('renewal'))}</span><b>${rupee(r.renewal)}</b></div></div>
              <a class="btn btn-accent" href="#/membership" data-goto="apply">${esc(T(m.applyTitle))}${arrow}</a>`;
            const cat = $('#ap_cat'); if (cat) cat.value = `${U('g_' + f.group)} · ${T(f.label)}`;
          };
          const draw = () => {
            const rows = feeRows().map((f, i) => [f, i]).filter(([f]) => f.group === grp);
            const def = Math.max(0, rows.findIndex(([f]) => f.yearly === 10000));
            $('#slabs').innerHTML = rows.map(([f, i], k) => `<label class="slab"><span class="l"><input type="radio" name="slab" value="${i}"${k === def ? ' checked' : ''}>${esc(T(f.label))}</span><span class="r">${rupee(feeCalc(f).first)}</span></label>`).join('');
            $$('#slabs input').forEach((r) => r.addEventListener('change', result)); result();
          };
          $$('[data-grp]').forEach((b) => b.addEventListener('click', () => { grp = b.dataset.grp; $$('[data-grp]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw(); }));
          draw(); bindForm('applyForm', 'apply');
        } };
    },

    events() {
      const e = C.pages.events, up = upcoming(), recent = [...C.news].sort(byDate).slice(0, 6);
      return { title: T(e.title), html: pageHead(T(e.title), T(e.intro), [{ label: T(e.title) }]) + `
        <section class="section"><div class="wrap"><h2 style="margin-bottom:22px">${esc(U('upcoming'))}</h2>${up.length ? `<div class="grid g3">${up.map(eventCard).join('')}</div>` : `<div class="empty">${esc(U('noUpcoming'))}</div>`}</div></section>
        <section class="section tint"><div class="wrap"><h2 style="margin-bottom:24px">${esc(U('annual'))}</h2><div class="annual">${(e.annual || []).map(annualCard).join('')}</div></div></section>
        <section class="section"><div class="wrap"><div class="sec-head"><h2>${esc(U('recent'))}</h2><a class="btn btn-line sm" href="#/news">${esc(U('viewAll'))}</a></div><div class="news-grid">${recent.map((n) => newsCard(n)).join('')}</div></div></section>` };
    },

    news(id) {
      if (id) return newsDetail(id);
      const pg = C.pages.news, cats = Object.keys(pg.categories || {}).filter((k) => C.news.some((n) => n.category === k));
      return { title: T(pg.title), html: pageHead(T(pg.title), T(pg.intro), [{ label: T(pg.title) }]) + `
        <section class="section" style="padding-top:clamp(32px,4vw,44px)"><div class="wrap">
          <div class="tabs" role="tablist"><button class="tab" type="button" data-cat="" aria-selected="true">${esc(U('all'))}</button>${cats.map((c) => `<button class="tab" type="button" data-cat="${esc(c)}" aria-selected="false">${esc(T(pg.categories[c]))}</button>`).join('')}</div>
          <div class="toolbar"><label class="search"><span class="sr">${esc(U('newsSearch'))}</span>${ic('search')}<input class="input" id="newsQ" type="search" placeholder="${esc(U('newsSearch'))}"></label></div>
          <div class="news-grid" id="newsList" style="margin-top:18px"></div></div></section>`,
        after() {
          let cat = '';
          const run = () => { const k = $('#newsQ').value.trim().toLowerCase();
            const list = [...C.news].sort(byDate).filter((n) => (!cat || n.category === cat) && (!k || JSON.stringify([n.title, n.summary]).toLowerCase().includes(k)));
            $('#newsList').innerHTML = list.length ? list.map((n) => newsCard(n)).join('') : `<div class="empty" style="grid-column:1/-1">${esc(U('noResults'))}</div>`; };
          $$('[data-cat]').forEach((b) => b.addEventListener('click', () => { cat = b.dataset.cat; $$('[data-cat]').forEach((x) => x.setAttribute('aria-selected', String(x === b))); run(); }));
          let tmr; $('#newsQ').addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(run, 120); }); run();
        } };
    },

    bulletin() {
      const pg = C.pages.bulletin, b = [...C.bulletins].sort((x, y) => y.month.localeCompare(x.month));
      const years = [...new Set(b.map((x) => x.month.slice(0, 4)))];
      return { title: T(pg.title), html: pageHead(T(pg.title), T(pg.intro), [{ label: T(pg.title) }]) + `
        <section class="section"><div class="wrap">${b.length ? `<div class="bul-feature">${cover(b[0])}<div>${eyebrow(C.ui.latestIssue)}<h2>${esc(T(b[0].title))}</h2>${T(b[0].highlights) ? `<div class="muted" style="margin-top:12px">${md(T(b[0].highlights))}</div>` : ''}<p style="margin-top:22px"><a class="btn btn-brand" href="${esc(href(b[0].url))}" target="_blank" rel="noopener">${ic('doc')}${esc(U('readIssue'))}</a></p></div></div>` : ''}
          ${years.map((y) => `<h3 class="year-h">${y}</h3><div class="bul-list">${b.filter((x) => x.month.startsWith(y)).map(bulItem).join('')}</div>`).join('')}
          ${pg.olderLink ? `<p style="margin-top:32px" class="muted">${esc(T(pg.olderNote))} <a href="${esc(pg.olderLink)}" target="_blank" rel="noopener">${esc(U('olderIssues'))} ↗</a></p>` : ''}</div></section>` };
    },

    gallery() {
      const pg = C.pages.gallery, al = [...C.gallery].filter((a) => (a.photos || []).length).sort(byDate);
      return { title: T(pg.title), html: pageHead(T(pg.title), T(pg.intro), [{ label: T(pg.title) }]) + `
        <section class="section"><div class="wrap albums">${al.map((a, i) => `<button class="album" type="button" data-album="${i}">${img(a.photos[0], T(a.title))}<span class="body"><b>${esc(T(a.title))}</b><span class="meta">${esc(fmtDate(a.date))} · ${a.photos.length} ${esc(U('photos'))}</span></span></button>`).join('')}</div></section>`,
        after() { $$('[data-album]').forEach((b) => b.addEventListener('click', () => { const a = al[+b.dataset.album]; lightbox.open(a.photos, 0, T(a.title)); })); } };
    },

    initiatives() {
      const pg = C.pages.initiatives;
      return { title: T(pg.title), html: pageHead(T(pg.title), T(pg.intro), [{ label: T(pg.title) }]) + `<section class="section"><div class="wrap ini">${(pg.items || []).map(iniCard).join('')}</div></section>` };
    },

    contact() {
      const pg = C.pages.contact, s = C.site;
      return { title: T(pg.title), html: pageHead(T(pg.title), T(pg.intro), [{ label: T(pg.title) }]) + `
        <section class="section"><div class="wrap"><div class="contact-cards">
          <div class="card"><span class="ico">${ic('phone')}</span><div><b>${esc(U('callUs'))}</b><a href="tel:${esc((s.phone || '').replace(/\s/g, ''))}">${esc(s.phone)}</a></div></div>
          <div class="card"><span class="ico">${ic('mail')}</span><div><b>${esc(U('emailUs'))}</b><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></div></div>
          <div class="card"><span class="ico">${ic('pin')}</span><div><b>${esc(U('visitUs'))}</b><span>${esc(T(s.address))}</span>${s.mapLink ? `<br><a class="link-arrow" style="font-size:.95rem;color:var(--link)" href="${esc(s.mapLink)}" target="_blank" rel="noopener">${esc(U('directions'))} ${ic('ext')}</a>` : ''}</div></div>
        </div>
        ${T(s.hours) ? `<p style="margin-top:18px" class="meta">${ic('clock')} <b>${esc(U('hours'))}:</b> ${esc(T(s.hours))}</p>` : ''}
        <div class="grid g2" style="margin-top:clamp(32px,5vw,56px);align-items:start;gap:clamp(28px,4vw,56px)">
          <div class="card" style="box-shadow:var(--shadow)"><h2 style="font-size:1.8rem;margin-bottom:18px">${esc(T(pg.formTitle))}</h2>${contactForm()}</div>
          <div>${s.whatsapp ? `<a class="btn btn-brand" href="https://wa.me/${esc(s.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener">${ic('WhatsApp')} WhatsApp</a>` : ''}
            <h3 style="margin:${s.whatsapp ? '28px' : '0'} 0 14px">${esc(U('followUs'))}</h3><div class="partners">${(s.social || []).filter((x) => x.url).map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${ic(x.name)}${esc(x.name)}</a>`).join('')}</div></div>
        </div></div></section>`,
        after() { bindForm('contactForm', 'contact'); } };
    },
  };

  function docCard(d) {
    const sec = sectionById(d.section), src = d.source || '', internal = src.startsWith('#/');
    return `<article class="doc"><div class="doc-top">${isNew(d) ? `<span class="new-badge">${esc(U('newBadge'))}</span>` : ''}<span class="chip brand">${esc(T(sec && sec.title))}</span><span class="chip">${esc(U('ty_' + d.type))}</span><span class="status s-${esc(d.status)}">${esc(U('st_' + d.status))}</span></div>
      <h3>${esc(T(d.title))}</h3><p class="meta" style="margin:0">${esc(T(d.issuer))}${d.ref ? ' · ' + esc(d.ref) : ''}${d.date ? ` · ${esc(U('issued'))} ${esc(fmtDate(d.date))}` : ''}${d.effective ? ` · ${esc(U('effective'))} ${esc(fmtDate(d.effective))}` : ''}</p>
      ${(d.summary || []).filter((s) => T(s)).length ? `<ul>${d.summary.filter((s) => T(s)).map((s) => `<li>${esc(T(s))}</li>`).join('')}</ul>` : ''}
      <div class="doc-actions">${d.fileEn ? `<a class="btn btn-brand sm" href="${esc(href(d.fileEn))}" target="_blank" rel="noopener">${ic('doc')}${esc(U('openDoc'))}</a>` : ''}${d.fileHi ? `<a class="btn btn-quiet sm" href="${esc(href(d.fileHi))}" target="_blank" rel="noopener">${ic('doc')}${esc(U('hindiPdf'))}</a>` : ''}${src ? `<a class="btn btn-quiet sm" href="${esc(src)}"${internal ? '' : ' target="_blank" rel="noopener"'}>${esc(U(internal ? 'readReport' : 'officialSource'))}${internal ? arrow : ic('ext')}</a>` : ''}</div></article>`;
  }
  function newsDetail(id) {
    const n = C.news.find((x) => x.id === id);
    if (!n) return notFound();
    const more = [...C.news].sort(byDate).filter((x) => x.id !== id).slice(0, 3), photos = (n.photos || []).filter(Boolean);
    return { title: T(n.title), html: `<section class="phead on-dark">${lineArt('lineart')}<div class="wrap" style="padding-bottom:clamp(84px,9vw,110px)">
        <nav class="crumbs"><a href="#/">${esc(U('home'))}</a><span>/</span><a href="#/news">${esc(T(C.pages.news.title))}</a></nav>
        <p class="meta" style="color:#D8DAF0;margin:0 0 14px"><span style="color:var(--accent);font-weight:600">${esc(catLabel(n))}</span><span>· ${esc(fmtDate(n.date))}</span></p>
        <h1 style="max-width:22em;font-size:clamp(1.9rem,3.6vw,2.8rem)">${esc(T(n.title))}</h1></div></section>
      <section class="section" style="padding-top:0"><div class="wrap"><article class="article">${n.image ? img(n.image, T(n.title), 'hero-img', true) : '<div style="height:40px"></div>'}
        <p class="lead">${esc(T(n.summary))}</p><div class="body">${md(T(n.body))}</div>
        ${photos.length ? `<div class="thumbs" style="margin-top:28px">${photos.map((p, i) => `<button type="button" data-ph="${i}" aria-label="${esc(U('photos'))} ${i + 1}">${img(p, '')}</button>`).join('')}</div>` : ''}
        ${n.source ? `<p class="muted" style="margin-top:28px;font-size:.92rem"><a href="${esc(n.source)}" target="_blank" rel="noopener">${esc(U('source'))} ↗</a></p>` : ''}
        <p style="margin-top:24px"><a class="link-arrow" href="#/news">${ic('left')} ${esc(U('back'))}</a></p></article></div></section>
      ${more.length ? `<section class="section tint"><div class="wrap"><h2 style="margin-bottom:26px">${esc(U('recent'))}</h2><div class="news-grid">${more.map((m) => newsCard(m)).join('')}</div></div></section>` : ''}`,
      after() { $$('[data-ph]').forEach((b) => b.addEventListener('click', () => lightbox.open(photos, +b.dataset.ph, T(n.title)))); } };
  }
  function notFound() { return { title: '404', html: pageHead(U('notFound'), '', []) + `<section class="section"><div class="wrap"><a class="btn btn-brand" href="#/">${esc(U('goHome'))}${arrow}</a></div></section>` }; }

  /* ---------------------------------------------------------------- forms (open the visitor's email app) */
  const fld = (id, label, type = 'text', req = false, extra = '') => `<div class="field${type === 'textarea' ? ' full' : ''}"><label for="${id}">${esc(label)}${req ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>${type === 'textarea' ? `<textarea class="textarea" id="${id}" name="${id}"${req ? ' required' : ''}></textarea>` : `<input class="input" id="${id}" name="${id}" type="${type}"${req ? ' required' : ''} ${extra}>`}</div>`;
  function applyForm() {
    return `<form id="applyForm" novalidate><div class="form-grid">${fld('ap_org', U('f_org'), 'text', true, 'autocomplete="organization"')}${fld('ap_name', U('f_person'), 'text', true, 'autocomplete="name"')}${fld('ap_desig', U('f_designation'))}${fld('ap_cat', U('f_category'), 'text', true)}
      ${fld('ap_email', U('f_email'), 'email', true, 'autocomplete="email"')}${fld('ap_phone', U('f_phone'), 'tel', true, 'autocomplete="tel"')}${fld('ap_city', U('f_city'))}${fld('ap_act', U('f_activity'))}</div>
      <div class="form-msg" hidden></div><button class="btn btn-accent" type="submit" style="margin-top:20px">${esc(U('f_submitApply'))}${arrow}</button></form>`;
  }
  function contactForm() {
    return `<form id="contactForm" novalidate><div class="form-grid">${fld('ct_name', U('f_person'), 'text', true, 'autocomplete="name"')}${fld('ct_email', U('f_email'), 'email', true, 'autocomplete="email"')}${fld('ct_phone', U('f_phone'), 'tel', false, 'autocomplete="tel"')}
      <div class="field"><label for="ct_topic">${esc(U('f_topic'))}</label><select class="select" id="ct_topic">${(C.pages.contact.topics || []).map((t) => `<option>${esc(T(t))}</option>`).join('')}</select></div>${fld('ct_msg', U('f_message'), 'textarea', true)}</div>
      <div class="form-msg" hidden></div><button class="btn btn-accent" type="submit" style="margin-top:20px">${esc(U('f_submitContact'))}${arrow}</button></form>`;
  }
  function bindForm(id, kind) {
    const f = document.getElementById(id); if (!f) return;
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const msg = f.querySelector('.form-msg'); let ok = true;
      $$('[required]', f).forEach((i) => { const bad = !i.value.trim() || (i.type === 'email' && !/^\S+@\S+\.\S+$/.test(i.value)); i.closest('.field').classList.toggle('bad', bad); if (bad) ok = false; });
      if (!ok) { msg.hidden = false; msg.className = 'form-msg err'; msg.textContent = U('f_invalid'); return; }
      const lines = $$('input,select,textarea', f).map((i) => `${f.querySelector(`label[for="${i.id}"]`)?.textContent.replace('*', '').trim()}: ${i.value}`).join('\n');
      const subject = (kind === 'apply' ? T(C.pages.membership.applyTitle) : T(C.pages.contact.formTitle)) + ' – ' + (f.querySelector('#ap_org,#ct_name')?.value || '');
      location.href = `mailto:${C.site.formEmail || C.site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines)}`;
      msg.hidden = false; msg.className = 'form-msg ok'; msg.textContent = U('f_done');
    });
  }

  /* ---------------------------------------------------------------- lightbox */
  const lightbox = (() => {
    let list = [], i = 0, el;
    function build() {
      el = document.createElement('div'); el.className = 'lightbox'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
      el.innerHTML = `<div class="lb-top"><span id="lbTitle"></span><button class="icon-btn" type="button" data-lb="x">${ic('x')}</button></div><div class="lb-stage"><img alt=""></div><div class="lb-nav"><button class="icon-btn" type="button" data-lb="p">${ic('left')}</button><span id="lbCount" class="num"></span><button class="icon-btn" type="button" data-lb="n">${ic('right')}</button></div>`;
      document.body.appendChild(el);
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-lb]'); if (b) ({ x: close, p: () => go(-1), n: () => go(1) })[b.dataset.lb](); else if (e.target.classList.contains('lb-stage')) close(); });
      let sx = null; const st = $('.lb-stage', el);
      st.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
      st.addEventListener('touchend', (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); sx = null; });
      document.addEventListener('keydown', (e) => { if (!el.classList.contains('open')) return; if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); });
    }
    function show() {
      const im = $('.lb-stage img', el); im.classList.add('out');
      const src = asset(list[i]); const pre = new Image(); pre.src = src;
      pre.onload = pre.onerror = () => { im.src = src; im.classList.remove('out'); };
      $('#lbCount').textContent = `${i + 1} / ${list.length}`;
      if (list[i + 1]) { const n = new Image(); n.src = asset(list[i + 1]); }
    }
    function go(d) { i = (i + d + list.length) % list.length; show(); }
    function open(l, k, title) { if (!el) build(); list = l; i = k; $('#lbTitle').textContent = title || ''; el.querySelector('[data-lb="x"]').setAttribute('aria-label', U('close')); el.querySelector('[data-lb="p"]').setAttribute('aria-label', U('prev')); el.querySelector('[data-lb="n"]').setAttribute('aria-label', U('next')); el.classList.add('open'); document.body.style.overflow = 'hidden'; show(); el.querySelector('[data-lb="x"]').focus(); }
    function close() { el.classList.remove('open'); document.body.style.overflow = ''; }
    return { open };
  })();

  /* ---------------------------------------------------------------- router */
  let lastRoute = null;
  function parse() { const p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean); return { name: p[0] || 'home', arg: p[1] }; }
  function render(opts = {}) {
    if (!C) return;
    const { name, arg } = parse();
    const key = name + '/' + (arg || ''), same = key === lastRoute;
    const view = (pages[name] || notFound)(arg);
    const go = () => {
      clearInterval(slideTimer);
      $('#main').innerHTML = view.html;
      if (view.after) view.after();
      document.title = (view.title ? view.title + ' · ' : '') + T(C.site.name);
      const nu = $('#hdr .nav ul'); if (nu) nu.innerHTML = navHTML();
      const dn = $('#drawer nav'); if (dn) dn.innerHTML = drawerNav();
      if (!same && !opts.keepScroll) window.scrollTo({ top: 0, behavior: 'instant' });
      if (window.Chanakya) window.Chanakya.refresh();
    };
    const vt = document.startViewTransition && !same && lastRoute !== null && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    lastRoute = key;
    if (vt) document.startViewTransition(go); else go();
    if (PREVIEW) parent.postMessage({ type: 'bia:route', route: location.hash || '#/' }, location.origin);
  }
  function rerender() { const y = scrollY; lastRoute = null; renderShell(); render({ keepScroll: true }); window.scrollTo(0, y); }

  /* ---------------------------------------------------------------- events */
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('#langBtn')) { lang = lang === 'en' ? 'hi' : 'en'; if (!PREVIEW) ls.set('bia.lang', lang); rerender(); return; }
    if (t.closest('#modeBtn')) { explicitMode = currentMode() === 'dark' ? 'light' : 'dark'; if (!PREVIEW) ls.set('bia.mode', explicitMode); applyMode(); return; }
    if (t.closest('#burger')) { $('#drawer').classList.add('open'); $('#burger').setAttribute('aria-expanded', 'true'); setTimeout(() => $('#drawer .panel a')?.focus(), 50); return; }
    if (t.closest('[data-close]') || t.closest('#drawer a')) { $('#drawer').classList.remove('open'); $('#burger')?.setAttribute('aria-expanded', 'false'); }
    if (t.closest('#hideDraft')) { try { sessionStorage.setItem('bia.published', '1'); } catch {} location.reload(); }
    const g = t.closest('[data-goto]'); if (g) { e.preventDefault(); document.getElementById(g.dataset.goto)?.scrollIntoView({ behavior: 'smooth' }); }
    if (t.closest('#toTop')) window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#drawer')?.classList.remove('open'); });
  window.addEventListener('hashchange', () => render());
  let tt; window.addEventListener('scroll', () => { if (tt) return; tt = requestAnimationFrame(() => { $('#hdr').classList.toggle('scrolled', scrollY > 40); $('#toTop').classList.toggle('show', scrollY > 900); tt = 0; }); }, { passive: true });

  /* ---------------------------------------------------------------- live updates from the admin */
  if (PREVIEW) {
    window.addEventListener('message', async (e) => {
      if (e.origin !== location.origin) return;
      const m = e.data || {};
      if (m.type === 'bia:content') { C = m.content; await preloadUploads(C); applyTheme(); rerender(); }
      if (m.type === 'bia:prefs') { if (m.lang) lang = m.lang; if (m.mode) explicitMode = m.mode; if (C) { rerender(); applyMode(); } }
      if (m.type === 'bia:go' && m.route !== location.hash) location.hash = m.route;
    });
  } else if ('BroadcastChannel' in window) {
    new BroadcastChannel('bia-draft').onmessage = async () => {
      let hide = false; try { hide = sessionStorage.getItem('bia.published') === '1'; } catch {}
      if (hide) return;
      const d = await idb.get('draft');
      if (d && d.dirty && d.content) { C = d.content; usingDraft = true; await preloadUploads(C); applyTheme(); rerender(); }
    };
  }

  /* ---------------------------------------------------------------- boot */
  async function boot() {
    const [pub, draft] = await Promise.all([fetchPublished().catch((e) => { console.error(e); return null; }), idb.get('draft').catch(() => null)]);
    let hide = false; try { hide = sessionStorage.getItem('bia.published') === '1'; } catch {}
    if (draft && draft.content && (PREVIEW || (draft.dirty && !hide))) { C = draft.content; usingDraft = true; } else C = pub;
    if (!C) { $('#main').innerHTML = '<div class="boot"><p>The site content could not be loaded. / साइट की सामग्री लोड नहीं हो सकी।</p></div>'; return; }
    await preloadUploads(C);
    if (!PREVIEW) { lang = ls.get('bia.lang') || C.theme.defaultLang || 'en'; explicitMode = ls.get('bia.mode'); }
    else if (!lang) lang = C.theme.defaultLang || 'en';
    applyTheme(); renderShell(); render();
    if (window.Chanakya) window.Chanakya.mount({ get content() { return C; }, get lang() { return lang; }, ui: U, asset, go: (r) => { location.hash = r; } });
    if (PREVIEW) parent.postMessage({ type: 'bia:ready' }, location.origin);
  }
  boot();
})();

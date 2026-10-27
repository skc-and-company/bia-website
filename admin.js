/* BIA website admin.
   - Edits the same content.json the public site renders. Every change is saved on this device at once and shows
     in the live preview (and on the public site in this browser).
   - Publish commits content.json (and any uploaded photos/PDFs) to the GitHub repository; GitHub Pages then
     serves the new version to everyone within about a minute. Publishing needs a GitHub key saved in this browser. */
(function () {
  const { idb, fetchPublished } = window.BIA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const S = { pub: null, c: null, base: 0, dirty: false, group: 'site', hist: [], fut: [], committed: '' };
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('bia-draft') : null;

  /* ---------------------------------------------------------------- small DOM helper */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : String(k));
    return el;
  }
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); };

  /* ---------------------------------------------------------------- path access */
  const get = (path) => path.reduce((o, k) => (o == null ? undefined : o[k]), S.c);
  function set(path, val) {
    let o = S.c;
    for (let i = 0; i < path.length - 1; i++) { if (o[path[i]] == null) o[path[i]] = typeof path[i + 1] === 'number' ? [] : {}; o = o[path[i]]; }
    o[path[path.length - 1]] = val;
  }
  const P = (base, k) => base.concat(String(k).split('.').map((x) => (/^\d+$/.test(x) ? +x : x)));

  /* ---------------------------------------------------------------- schema */
  const I = (k, l, o = {}) => ({ k, t: 'i18n', l, ...o });
  const IL = (k, l, o = {}) => ({ k, t: 'i18n', l, long: true, ...o });
  const TX = (k, l, o = {}) => ({ k, t: 'text', l, ...o });
  const NUM = (k, l, o = {}) => ({ k, t: 'num', l, ...o });
  const BOOL = (k, l, o = {}) => ({ k, t: 'bool', l, ...o });
  const SEL = (k, l, opts, o = {}) => ({ k, t: 'sel', l, opts, ...o });
  const DATE = (k, l, o = {}) => ({ k, t: 'date', l, ...o });
  const IMG = (k, l, o = {}) => ({ k, t: 'img', l, ...o });
  const FILE = (k, l, o = {}) => ({ k, t: 'file', l, ...o });
  const COLOR = (k, l) => ({ k, t: 'color', l });
  const OBJ = (k, l, fields, o = {}) => ({ k, t: 'obj', l, fields, ...o });
  const LIST = (k, l, fields, o = {}) => ({ k, t: 'list', l, fields, ...o });
  const STRS = (k, l, of, o = {}) => ({ k, t: 'strs', l, of, ...o });
  const MAP = (k, l, o = {}) => ({ k, t: 'map', l, ...o });
  const L2 = (en = '', hi = '') => ({ en, hi });
  const today = () => new Date().toISOString().slice(0, 10);
  const uid = () => Math.random().toString(36).slice(2, 8);

  const ROUTES = ['#/', '#/about', '#/leadership', '#/policies', '#/policies/national', '#/policies/bihar', '#/policies/gst', '#/policies/incometax', '#/membership', '#/events', '#/news', '#/bulletin', '#/gallery', '#/initiatives', '#/contact'];
  const FONT_OPTS = () => Object.keys(window.BIA_FONTS || {});
  const SOCIAL = ['Facebook', 'X', 'YouTube', 'Instagram', 'LinkedIn', 'WhatsApp'];
  const ICONS = [['skill', 'Computer / skills'], ['outreach', 'Map / outreach'], ['startup', 'Rocket / startups'], ['expo', 'Building / exhibition'], ['award', 'Award'], ['lecture', 'Microphone / lecture'], ['users', 'People']];
  const SECTIONS = () => (S.c.policies.sections || []).map((s) => [s.id, s.title.en || s.id]);
  const DOC_TYPES = [['policy', 'Policy'], ['act', 'Act'], ['rules', 'Rules'], ['notification', 'Notification'], ['circular', 'Circular'], ['scheme', 'Scheme'], ['gazette', 'Gazette'], ['explainer', 'BIA explainer']];
  const STATUSES = [['current', 'In force'], ['amended', 'Amended'], ['superseded', 'Superseded'], ['draft', 'Draft']];
  const NEWS_CATS = () => Object.entries(S.c.pages.news.categories || {}).map(([k, v]) => [k, v.en || k]);
  const ROLES_OB = [['president', 'President'], ['vp', 'Vice President'], ['sg', 'Secretary General'], ['treasurer', 'Treasurer']];
  const ROLES_C = [['mentor', 'Mentor'], ['chairman', 'Chair'], ['cochair', 'Co-chair'], ['convener', 'Convener'], ['coconvener', 'Co-convener'], ['member', 'Member']];
  const BOT_ACTIONS = [['', 'Plain answer'], ['fees', 'Fee calculator'], ['latest:all', 'Latest documents (all)'], ['latest:national', 'Latest national policy items'], ['latest:bihar', 'Latest Bihar policy items'], ['latest:gst', 'Latest GST items'], ['latest:incometax', 'Latest income-tax items'], ['newpolicy', 'New National Policy status'], ['events', 'Events calendar'], ['contact', 'Office contacts']];
  const HOME_SECTIONS = { hero: 'Hero photo slideshow', stats: 'Key numbers', updates: 'Policy updates', president: 'President’s message', news: 'Recent news', membership: 'Membership band', events: 'Events calendar', bulletin: 'Bulletin', initiatives: 'Initiatives', partners: 'Affiliations' };
  const colors = (k, l) => OBJ(k, l, [COLOR('brand', 'Brand blue (logo, buttons)'), COLOR('accent', 'Accent (marigold)'), COLOR('navy', 'Navy bands (top bar, page headers, footer)'), COLOR('bg', 'Page background'), COLOR('surface', 'Cards'), COLOR('text', 'Text')]);
  const cta = (k, l) => OBJ(k, l, [I('label', 'Button text'), TX('link', 'Opens', { routes: true })]);

  const GROUPS = [
    { id: 'site', label: 'Site & contact', route: '#/contact', lead: 'Name, logo, address and contact details used across the site.', fields: [
      OBJ('site', 'Organisation', [I('name', 'Organisation name'), TX('short', 'Short name'), I('estLine', 'Line under the name'), IMG('logoImage', 'Logo', { h: 'PNG with a transparent background works best.' }),
        I('address', 'Full address'), I('addressShort', 'Short address (top bar)'), TX('phone', 'Phone'), TX('email', 'Email'),
        TX('whatsapp', 'WhatsApp number', { h: 'With country code, digits only, e.g. 919876543210. Leave empty to hide the WhatsApp button.' }),
        I('hours', 'Office hours', { h: 'Leave empty to hide.' }), TX('mapLink', 'Map link'), TX('formEmail', 'Email that receives form messages'),
        LIST('social', 'Social media', [SEL('name', 'Network', SOCIAL), TX('url', 'Link')], { title: (x) => x.name, make: () => ({ name: 'Facebook', url: '' }) })]),
      OBJ('pages.contact', 'Contact page', [I('title', 'Title'), IL('intro', 'Introduction'), I('formTitle', 'Form title'), STRS('topics', 'Message topics', 'i18n')]),
    ] },
    { id: 'theme', label: 'Look & theme', route: '#/', lead: 'Colours, fonts and defaults. Dark mode has its own colours.', fields: [
      OBJ('theme', 'Defaults', [SEL('defaultMode', 'Default appearance', [['system', 'Follow the visitor’s device'], ['light', 'Light'], ['dark', 'Dark']]), SEL('defaultLang', 'Default language', [['en', 'English'], ['hi', 'हिन्दी']]),
        SEL('fontDisplay', 'Heading font', FONT_OPTS), SEL('fontBody', 'Text font', FONT_OPTS), NUM('radius', 'Corner roundness (px)', { min: 0, max: 24, range: true }), BOOL('motion', 'Gentle animations (photo slideshow, fades)')]),
      colors('theme.light', 'Light mode colours'), colors('theme.dark', 'Dark mode colours'),
    ] },
    { id: 'nav', label: 'Menu', route: '#/', lead: 'The main menu. Items with sub-items open a dropdown.', fields: [
      LIST('nav', 'Menu items', [I('label', 'Label'), TX('route', 'Opens', { routes: true }), BOOL('visible', 'Show in menu'), LIST('children', 'Dropdown items', [I('label', 'Label'), TX('route', 'Opens', { routes: true })], { make: () => ({ label: L2('New item', 'नया'), route: '#/' }) })],
        { make: () => ({ label: L2('New item', 'नया'), route: '#/', visible: true, children: [] }) }),
    ] },
    { id: 'home', label: 'Home page', route: '#/', lead: 'Turn sections on or off, change their order and edit their text.', fields: [
      { k: 'home.sections', t: 'sections', l: 'Sections and order' },
      OBJ('home.hero', 'Hero', [I('eyebrow', 'Small line above the title'), I('title', 'Title'), IL('lede', 'Introduction'), cta('cta1', 'Main button'), cta('cta2', 'Second button'),
        LIST('slides', 'Slideshow photos', [IMG('image', 'Photo', { h: 'Wide photos (at least 1600 px) look best.' }), I('caption', 'Caption')], { make: () => ({ image: '', caption: L2() }) })]),
      OBJ('home.stats', 'Key numbers', [LIST('items', 'Numbers', [TX('value', 'Number'), I('label', 'Label')], { title: (x) => x.value, make: () => ({ value: '', label: L2() }) })]),
      OBJ('home.updates', 'Policy updates', [I('eyebrow', 'Small heading'), I('title', 'Title'), IL('intro', 'Introduction'), NUM('count', 'How many documents to show', { min: 1, max: 10 })]),
      OBJ('home.president', 'President’s message', [I('eyebrow', 'Small heading'), I('name', 'Name'), I('role', 'Role'), IMG('photo', 'Photo'), IL('message', 'Message'), TX('link', 'Link', { routes: true })]),
      OBJ('home.news', 'Recent news', [I('eyebrow', 'Small heading'), I('title', 'Title'), NUM('count', 'How many stories', { min: 2, max: 9 })]),
      OBJ('home.membership', 'Membership band', [I('eyebrow', 'Small heading'), I('title', 'Title'), IL('text', 'Text'), I('cta', 'Button text')]),
      OBJ('home.events', 'Events', [I('eyebrow', 'Small heading'), I('title', 'Title')]),
      OBJ('home.bulletin', 'Bulletin', [I('eyebrow', 'Small heading'), I('title', 'Title'), IL('text', 'Text')]),
      OBJ('home.initiatives', 'Initiatives', [I('eyebrow', 'Small heading'), I('title', 'Title')]),
      OBJ('home.partners', 'Affiliations', [I('title', 'Title'), LIST('items', 'Links', [I('name', 'Name'), TX('url', 'Link')], { make: () => ({ name: L2(), url: '' }) })]),
    ] },
    { id: 'about', label: 'About page', route: '#/about', lead: 'BIA’s story, vision, mission and history.', fields: [
      OBJ('pages.about', 'About BIA', [I('title', 'Title'), IL('intro', 'Introduction'), IL('story', 'Story', { h: 'Leave a blank line between paragraphs. **bold** and [link text](https://…) work.', rows: 10 }), IL('vision', 'Vision'), IL('mission', 'Mission'),
        STRS('objectives', 'What we do', 'i18n'), LIST('timeline', 'Our journey', [TX('year', 'Year'), IL('text', 'What happened')], { title: (x) => x.year, make: () => ({ year: '', text: L2() }) })]),
    ] },
    { id: 'leadership', label: 'Leadership & committees', route: '#/leadership', lead: 'Office bearers, Executive Council, committees and the succession list. Change the year when a new team is elected.', fields: [
      OBJ('pages.leadership', 'Page text', [I('title', 'Title'), IL('intro', 'Introduction')]),
      OBJ('leadership', 'People', [TX('year', 'Office bearers’ year'), LIST('officeBearers', 'Office bearers', [I('name', 'Name'), SEL('role', 'Role', ROLES_OB), IMG('photo', 'Photo')], { make: () => ({ name: L2(), role: 'vp', photo: '' }) }),
        TX('councilYear', 'Executive Council year'), LIST('council', 'Executive Council', [I('name', 'Name'), I('org', 'Organisation')], { search: true, make: () => ({ name: L2(), org: L2() }) }),
        LIST('committees', 'Committees and cells', [I('name', 'Committee'), LIST('members', 'Members', [I('name', 'Name'), SEL('role', 'Role', ROLES_C)], { make: () => ({ name: L2(), role: 'member' }) })], { search: true, make: () => ({ name: L2('New committee', 'नई समिति'), members: [] }) }),
        LIST('succession', 'Past office bearers', [I('title', 'List'), LIST('people', 'People', [I('name', 'Name'), TX('tenure', 'Tenure')], { search: true, title: (x) => `${x.name.en} · ${x.tenure}`, make: () => ({ name: L2(), tenure: '' }) })])]),
    ] },
    { id: 'policies', label: 'Policies & Updates', route: '#/policies', lead: 'Upload new policies, GST and income-tax updates. Each document shows its date, status and a short summary.', fields: [
      OBJ('policies.newPolicy', 'New National Industrial Policy (upload slot)', [BOOL('show', 'Show this card'), SEL('status', 'Status', [['awaited', 'Awaited'], ['draft', 'Draft released'], ['notified', 'Notified']]),
        DATE('date', 'Date'), I('title', 'Title'), IL('text', 'Text'), FILE('fileEn', 'Policy PDF · English'), FILE('fileHi', 'Policy PDF · Hindi'), TX('source', 'Official source link'), SEL('section', 'Shown in section', SECTIONS)]),
      LIST('policies.items', 'Documents', [SEL('section', 'Section', SECTIONS), SEL('type', 'Type', DOC_TYPES), I('title', 'Title'), I('issuer', 'Issued by'), TX('ref', 'Reference number'),
        DATE('date', 'Issue date'), DATE('effective', 'In effect from'), SEL('status', 'Status', STATUSES), STRS('summary', 'BIA summary (one point per row)', 'i18n', { long: true }),
        FILE('fileEn', 'Document · English'), FILE('fileHi', 'Document · Hindi'), TX('source', 'Official source or BIA report link', { routes: true })],
        { search: true, sort: 'date', title: (x) => x.title.en, sub: (x) => `${x.section} · ${x.date || ''}`, make: () => ({ id: 'doc-' + uid(), section: 'gst', type: 'notification', title: L2('New document', 'नया दस्तावेज़'), issuer: L2(), ref: '', date: today(), effective: '', status: 'current', summary: [L2()], fileEn: '', fileHi: '', source: '' }) }),
      LIST('policies.sections', 'Sections', [TX('id', 'Short id (no spaces)'), I('title', 'Title'), IL('intro', 'Introduction')], { title: (x) => x.title.en, make: () => ({ id: 'section-' + uid(), title: L2('New section', 'नया अनुभाग'), intro: L2() }) }),
      OBJ('pages.policies', 'Page text', [I('title', 'Title'), IL('intro', 'Introduction'), NUM('newDays', 'Show the “New” badge for (days)', { min: 0, max: 365 }), IL('disclaimer', 'Note at the bottom')]),
    ] },
    { id: 'membership', label: 'Membership & fees', route: '#/membership', lead: 'Benefits, categories, the fee table that drives the calculator, and the application form text.', fields: [
      OBJ('pages.membership', 'Membership page', [I('title', 'Title'), IL('intro', 'Introduction'), STRS('benefits', 'Why join', 'i18n'),
        LIST('categories', 'Member categories', [I('name', 'Category'), IL('text', 'Who it is for')], { make: () => ({ name: L2(), text: L2() }) }), IL('representatives', 'Representatives'),
        DATE('tariffDate', 'Tariff in effect from'), NUM('gstRate', 'GST (%)', { min: 0, max: 28 }),
        LIST('fees', 'Fee table', [SEL('group', 'Group', [['industry', 'Industry, by capital outlay'], ['service', 'Service sector'], ['other', 'Other categories']]), I('label', 'Category'), NUM('yearly', 'Yearly subscription (₹)', { min: 0 }), NUM('admission', 'Admission fee (₹)', { min: 0 })],
          { title: (x) => `${x.label.en} · ₹${x.yearly} + ₹${x.admission}`, make: () => ({ group: 'industry', label: L2(), yearly: 0, admission: 0 }) }),
        IL('sickNote', 'Sick unit note'), IL('capitalNote', 'Capital outlay note'), I('applyTitle', 'Form title'), IL('applyText', 'Form introduction'),
        LIST('downloads', 'Downloads', [I('label', 'Label'), FILE('url', 'File')], { make: () => ({ label: L2(), url: '' }) })]),
    ] },
    { id: 'events', label: 'Events', route: '#/events', lead: 'Add upcoming events; they appear on the home page and the Events page until their date passes.', fields: [
      OBJ('pages.events', 'Events page', [I('title', 'Title'), IL('intro', 'Introduction'),
        LIST('upcoming', 'Upcoming events', [I('title', 'Event'), DATE('date', 'Date'), DATE('endDate', 'End date (optional)'), I('venue', 'Venue'), IL('text', 'Details'), TX('registerLink', 'Registration link (optional)')],
          { sort: 'date', make: () => ({ title: L2('New event', 'नया कार्यक्रम'), date: today(), endDate: '', venue: L2('BIA Auditorium, Patna', 'बीआईए सभागार, पटना'), text: L2(), registerLink: '' }) }),
        LIST('annual', 'Every year', [I('name', 'Event'), I('when', 'Usually in'), IL('text', 'Details'), TX('link', 'Link', { routes: true })], { make: () => ({ name: L2(), when: L2(), text: L2(), link: '' }) })]),
    ] },
    { id: 'news', label: 'News', route: '#/news', lead: 'News stories with photos. The newest appear first everywhere.', fields: [
      LIST('news', 'Stories', [TX('id', 'Web address (letters, numbers and dashes)'), DATE('date', 'Date'), SEL('category', 'Category', NEWS_CATS), I('title', 'Headline'), IL('summary', 'Summary'), IL('body', 'Full story', { rows: 8, h: 'Leave a blank line between paragraphs.' }),
        IMG('image', 'Main photo'), STRS('photos', 'More photos', 'img'), TX('source', 'Original post link')],
        { search: true, sort: 'date', title: (x) => x.title.en, sub: (x) => x.date, make: () => ({ id: 'news-' + uid(), date: today(), category: 'session', title: L2('New story', 'नया समाचार'), summary: L2(), body: L2(), image: '', photos: [], source: '' }) }),
      OBJ('pages.news', 'News page', [I('title', 'Title'), IL('intro', 'Introduction'), MAP('categories', 'Category names')]),
    ] },
    { id: 'bulletin', label: 'Bulletin', route: '#/bulletin', lead: 'Upload each month’s BIA Bulletin. The newest becomes the featured issue.', fields: [
      LIST('bulletins', 'Issues', [TX('month', 'Month (YYYY-MM)', { ph: '2026-10' }), I('title', 'Title'), FILE('url', 'Bulletin PDF'), IL('highlights', 'Highlights (optional)')],
        { search: true, title: (x) => x.title.en, sub: (x) => x.month, sortKey: 'month', make: () => { const d = new Date(); return { month: d.toISOString().slice(0, 7), title: L2(d.toLocaleString('en-IN', { month: 'long', year: 'numeric' }), ''), url: '', highlights: L2() }; } }),
      OBJ('pages.bulletin', 'Bulletin page', [I('title', 'Title'), IL('intro', 'Introduction'), IL('olderNote', 'Note about older issues'), TX('olderLink', 'Link to older issues')]),
    ] },
    { id: 'gallery', label: 'Gallery', route: '#/gallery', lead: 'Photo albums. The first photo is the album cover.', fields: [
      LIST('gallery', 'Albums', [I('title', 'Album'), DATE('date', 'Date'), STRS('photos', 'Photos', 'img')], { sort: 'date', make: () => ({ id: 'album-' + uid(), title: L2('New album', 'नया एल्बम'), date: today(), photos: [] }) }),
      OBJ('pages.gallery', 'Gallery page', [I('title', 'Title'), IL('intro', 'Introduction')]),
    ] },
    { id: 'initiatives', label: 'Initiatives', route: '#/initiatives', lead: 'Programmes shown on the Initiatives page and the home page.', fields: [
      OBJ('pages.initiatives', 'Initiatives', [I('title', 'Title'), IL('intro', 'Introduction'), LIST('items', 'Programmes', [SEL('icon', 'Icon', ICONS), I('title', 'Title'), IL('text', 'Text'), TX('link', 'Link', { routes: true }), I('linkLabel', 'Link text')], { make: () => ({ icon: 'award', title: L2(), text: L2(), link: '', linkLabel: L2() }) })]),
    ] },
    { id: 'footer', label: 'Footer', route: '#/', lead: 'Text and link columns at the bottom of every page.', fields: [
      OBJ('footer', 'Footer', [IL('about', 'About text'), LIST('columns', 'Link columns', [I('title', 'Column title'), LIST('links', 'Links', [I('label', 'Label'), TX('url', 'Opens', { routes: true })], { make: () => ({ label: L2(), url: '#/' }) })], { make: () => ({ title: L2(), links: [] }) }), I('copyright', 'Copyright line')]),
    ] },
    { id: 'bot', label: 'Chanakya bot', route: '#/', lead: 'Chanakya answers from this list only. It runs in the visitor’s browser with no outside service.', fields: [
      { k: '', t: 'bottest', l: 'Try a question' },
      OBJ('bot', 'Chanakya', [BOOL('enabled', 'Show Chanakya on the site'), I('name', 'Name'), I('tagline', 'Tagline'), IL('greeting', 'Greeting'),
        LIST('quick', 'Quick buttons', [I('label', 'Button text'), TX('ask', 'Question it asks')], { make: () => ({ label: L2(), ask: '' }) }),
        IL('fallback', 'When it is not sure'), I('disclaimer', 'Small note'), NUM('threshold', 'How sure it must be (0.1 to 0.9)', { min: 0.1, max: 0.9, step: 0.01, h: 'Lower answers more often; higher is stricter.' }),
        LIST('faqs', 'Questions and answers', [I('q', 'Question'), TX('keywords', 'Other words people use', { h: 'Separate with spaces. English, Hindi and Hinglish all help.' }), SEL('action', 'Extra', BOT_ACTIONS), IL('a', 'Answer'), TX('link', 'Page to open', { routes: true })],
          { search: true, title: (x) => x.q.en, make: () => ({ q: L2('New question', 'नया प्रश्न'), keywords: '', action: '', a: L2(), link: '' }) }),
        STRS('synonyms', 'Words that mean the same', 'text', { h: 'One group per row, separated by spaces. The first word is the main one.' })]),
    ] },
    { id: 'ui', label: 'Interface text', route: '#/', lead: 'Every button, label and message on the site, in English and Hindi.', fields: [MAP('ui', 'Interface text', { search: true })] },
    { id: 'publish', label: 'Publish & backup', route: '#/', special: 'publish' },
  ];

  /* ---------------------------------------------------------------- controls */
  function field(f, base) {
    const path = f.k ? P(base, f.k) : base;
    const lbl = (extra) => [h('span', { class: 'lbl', text: f.l }), f.h ? h('span', { class: 'hint', text: f.h }) : null, extra];
    switch (f.t) {
      case 'i18n': return h('div', { class: 'f' }, lbl(i18nCtl(path, f)));
      case 'text': return h('label', { class: 'f' }, lbl(textCtl(path, f)));
      case 'num': {
        const v = get(path);
        const inp = h('input', { class: f.range ? '' : 'inp', type: f.range ? 'range' : 'number', min: f.min, max: f.max, step: f.step || 1, value: v ?? '', style: f.range ? 'width:220px' : 'max-width:180px' });
        const out = f.range ? h('span', { class: 'muted', text: v }) : null;
        inp.addEventListener('input', () => { const n = inp.value === '' ? 0 : +inp.value; set(path, n); if (out) out.textContent = n; changed(); });
        return h('label', { class: 'f' }, lbl(h('span', { class: 'row' }, inp, out)));
      }
      case 'bool': {
        const inp = h('input', { type: 'checkbox' }); inp.checked = get(path) !== false && get(path) != null ? !!get(path) : false;
        inp.addEventListener('change', () => { set(path, inp.checked); changed(); });
        return h('div', { class: 'f' }, h('label', { class: 'switch' }, inp, f.l));
      }
      case 'sel': {
        const opts = (typeof f.opts === 'function' ? f.opts() : f.opts).map((o) => (Array.isArray(o) ? o : [o, o]));
        const cur = get(path) ?? '';
        if (!opts.some(([v]) => v === cur)) opts.push([cur, cur || '—']);
        const s = h('select', { class: 'sel' }, opts.map(([v, t]) => h('option', { value: v, text: t })));
        s.value = cur; s.addEventListener('change', () => { set(path, s.value); changed(); });
        return h('label', { class: 'f' }, lbl(s));
      }
      case 'date': {
        const inp = h('input', { class: 'inp', type: 'date', value: get(path) || '', style: 'max-width:200px' });
        inp.addEventListener('input', () => { set(path, inp.value); changed(); });
        return h('label', { class: 'f' }, lbl(inp));
      }
      case 'color': {
        const v = get(path) || '#000000';
        const sw = h('input', { type: 'color', class: 'swatch', value: /^#[0-9a-f]{6}$/i.test(v) ? v : '#000000' });
        const tx = h('input', { class: 'inp', value: v, style: 'max-width:130px', 'aria-label': f.l + ' hex' });
        sw.addEventListener('input', () => { tx.value = sw.value; set(path, sw.value); changed(); });
        tx.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(tx.value)) { sw.value = tx.value; set(path, tx.value); changed(); } });
        return h('div', { class: 'f' }, lbl(h('div', { class: 'row' }, sw, tx)));
      }
      case 'img': return h('div', { class: 'f' }, lbl(fileCtl(path, f, true)));
      case 'file': return h('div', { class: 'f' }, lbl(fileCtl(path, f, false)));
      case 'obj': {
        const inner = h('div', { class: 'fields' }, f.fields.map((x) => field(x, path)));
        return base.length === 0 ? h('section', { class: 'card' }, h('h2', { text: f.l }), inner) : h('fieldset', { class: 'grp' }, h('legend', { text: f.l }), inner);
      }
      case 'list': return listCtl(path, f);
      case 'strs': return strsCtl(path, f);
      case 'map': return mapCtl(path, f);
      case 'sections': return sectionsCtl(path, f);
      case 'bottest': return botTest();
    }
    return h('div', { text: '?' + f.t });
  }
  function autosize(t) { t.style.height = 'auto'; t.style.height = Math.min(600, t.scrollHeight + 4) + 'px'; }
  function i18nCtl(path, f) {
    if (get(path) == null || typeof get(path) !== 'object') set(path, L2(typeof get(path) === 'string' ? get(path) : ''));
    const mk = (lang, name) => {
      const v = (get(path) || {})[lang] || '';
      const el = f.long ? h('textarea', { class: 'ta', rows: f.rows || 3, lang }) : h('input', { class: 'inp', lang });
      el.value = v;
      el.addEventListener('input', () => { set(path.concat(lang), el.value); if (f.long) autosize(el); changed(); });
      if (f.long) requestAnimationFrame(() => autosize(el));
      return h('label', {}, h('small', { text: name }), el);
    };
    return h('div', { class: 'pair' }, mk('en', 'English'), mk('hi', 'हिन्दी'));
  }
  function textCtl(path, f) {
    const inp = h('input', { class: 'inp', value: get(path) ?? '', placeholder: f.ph || (f.routes ? '#/page or https://…' : '') });
    if (f.routes) { inp.setAttribute('list', 'routes'); }
    inp.addEventListener('input', () => { set(path, inp.value); changed(); });
    return inp;
  }
  function fileCtl(path, f, isImg) {
    const v = get(path) || '';
    const inp = h('input', { class: 'inp', value: v.startsWith('upload:') ? '' : v, placeholder: v.startsWith('upload:') ? 'Uploaded: ' + v.split('|')[1] + ' (sent on Publish)' : isImg ? 'img/photo.jpg or https://…' : 'https://… or uploads/file.pdf' });
    const thumb = isImg ? h('img', { class: 'thumb', alt: '' }) : null;
    const open = !isImg ? h('a', { class: 'btn sm', target: '_blank', rel: 'noopener', text: 'Open' }) : null;
    const refresh = async () => {
      const val = get(path) || '';
      let url = val;
      if (val.startsWith('upload:')) { await window.BIA.preloadUploads({ x: val }); url = window.BIA.asset(val); }
      if (thumb) { thumb.src = url || 'data:,'; thumb.style.visibility = url ? 'visible' : 'hidden'; }
      if (open) { open.href = url || '#'; open.hidden = !url; }
    };
    inp.addEventListener('input', () => { set(path, inp.value.trim()); refresh(); changed(); });
    const picker = h('input', { type: 'file', accept: isImg ? 'image/*' : '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*', hidden: true });
    picker.addEventListener('change', async () => {
      const file = picker.files[0]; if (!file) return;
      if (file.size > 25e6) { toast('That file is over 25 MB. Please compress it first.'); return; }
      const blob = isImg ? await compressImage(file) : file;
      const id = Date.now().toString(36) + uid();
      const name = safeName(isImg && blob !== file ? file.name.replace(/\.\w+$/, '') + '.jpg' : file.name);
      await idb.set('upload:' + id, { name, type: blob.type || file.type, blob });
      set(path, `upload:${id}|${name}`);
      inp.value = ''; inp.placeholder = `Uploaded: ${name} (sent on Publish)`;
      refresh(); changed(); toast(`${name} added. It goes live when you publish.`);
      picker.value = '';
    });
    const up = h('button', { class: 'btn', type: 'button', text: isImg ? 'Upload photo' : 'Upload file', onclick: () => picker.click() });
    const clr = h('button', { class: 'btn sm warn', type: 'button', text: 'Remove', onclick: () => { set(path, ''); inp.value = ''; inp.placeholder = ''; refresh(); changed(); } });
    refresh();
    return h('div', { class: 'row' }, thumb, inp, up, open, clr, picker);
  }
  const safeName = (n) => n.toLowerCase().replace(/[^a-z0-9.\-]+/g, '-').replace(/-+/g, '-').slice(-80);
  async function compressImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 450e3) return file;
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
      const out = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.82));
      return out && out.size < file.size ? out : file;
    } catch { return file; }
  }

  function itemTitle(f, x, i) {
    try { if (f.title) return f.title(x) || `Item ${i + 1}`; } catch {}
    if (x && typeof x === 'object') { for (const v of Object.values(x)) { if (v && typeof v === 'object' && v.en) return v.en; if (typeof v === 'string' && v && !v.startsWith('upload:') && v.length < 80) return v; } }
    return `Item ${i + 1}`;
  }
  function listCtl(path, f) {
    const wrap = h('div', { class: isTop(path) ? 'card' : 'f' });
    const draw = (openIdx) => {
      wrap.innerHTML = '';
      let arr = get(path); if (!Array.isArray(arr)) { arr = []; set(path, arr); }
      const q = h('input', { class: 'inp search-in', type: 'search', placeholder: 'Search ' + f.l.toLowerCase() + '…' });
      const add = h('button', { class: 'btn pri', type: 'button', text: '+ Add', onclick: () => {
        const item = f.make ? f.make() : {};
        const list = get(path);
        if (f.sort || f.sortKey) { list.unshift(item); draw(0); } else { list.push(item); draw(list.length - 1); }
        changed(true);
      } });
      wrap.append(h('div', { class: 'list-hd' }, h('span', { class: 'lbl' }, f.l, ' ', h('span', { class: 'n', text: `(${arr.length})` })), h('div', { class: 'row' }, (f.search || arr.length > 10) ? q : null, add)));
      if (f.h) wrap.append(h('div', { class: 'hint muted', text: f.h }));
      const items = h('div', { class: 'items' });
      const order = arr.map((x, i) => i);
      const key = f.sort || f.sortKey;
      if (key) order.sort((a, b) => String(arr[b][key] || '').localeCompare(String(arr[a][key] || '')));
      order.forEach((i) => {
        const x = arr[i];
        const t = h('span', { class: 't' }, itemTitle(f, x, i), f.sub ? h('small', { text: f.sub(x) }) : null);
        const btn = (label, title, fn) => h('button', { class: 'ico', type: 'button', title, 'aria-label': title, text: label, onclick: (e) => { e.preventDefault(); e.stopPropagation(); fn(e); } });
        const del = h('button', { class: 'btn sm warn', type: 'button', text: 'Delete', onclick: (e) => {
          e.preventDefault(); e.stopPropagation();
          if (!del.classList.contains('armed')) { del.classList.add('armed'); del.textContent = 'Confirm delete'; setTimeout(() => { del.classList.remove('armed'); del.textContent = 'Delete'; }, 3000); return; }
          get(path).splice(i, 1); draw(); changed(true);
        } });
        const moves = key ? [] : [btn('↑', 'Move up', () => { if (i > 0) { const l = get(path); [l[i - 1], l[i]] = [l[i], l[i - 1]]; draw(i - 1); changed(true); } }), btn('↓', 'Move down', () => { const l = get(path); if (i < l.length - 1) { [l[i + 1], l[i]] = [l[i], l[i + 1]]; draw(i + 1); changed(true); } })];
        const dup = btn('⧉', 'Duplicate', () => { const l = get(path); const c = clone(l[i]); if (c.id) c.id = c.id + '-' + uid(); l.splice(i + 1, 0, c); draw(i + 1); changed(true); });
        const d = h('details', { class: 'it' }, h('summary', {}, h('span', { class: 'chev', text: '›' }), t, ...moves, dup, del));
        d.dataset.search = JSON.stringify(x).toLowerCase();
        let built = false;
        const build = () => { if (built) return; built = true; d.append(h('div', { class: 'body' }, f.fields.map((ff) => field(ff, path.concat(i))))); };
        d.addEventListener('toggle', () => { if (d.open) build(); });
        d.addEventListener('input', () => { t.firstChild.textContent = itemTitle(f, get(path)[i], i); });
        if (i === openIdx) { d.open = true; build(); }
        items.append(d);
      });
      q.addEventListener('input', () => { const k = q.value.trim().toLowerCase(); $$('details.it', items).forEach((d) => { d.hidden = k && !d.dataset.search.includes(k); }); });
      wrap.append(items);
    };
    draw();
    return wrap;
  }
  // A list that is a group's own field gets a card; nested lists sit inside their parent.
  let topPaths = new Set();
  const isTop = (path) => topPaths.has(path.join('.'));

  function strsCtl(path, f) {
    const wrap = h('div', { class: 'f' });
    const draw = () => {
      wrap.innerHTML = '';
      let arr = get(path); if (!Array.isArray(arr)) { arr = []; set(path, arr); }
      wrap.append(h('div', { class: 'list-hd' }, h('span', { class: 'lbl' }, f.l, ' ', h('span', { class: 'n', text: `(${arr.length})` })),
        h('button', { class: 'btn', type: 'button', text: '+ Add', onclick: () => { get(path).push(f.of === 'i18n' ? L2() : ''); draw(); changed(true); } })));
      if (f.h) wrap.append(h('span', { class: 'hint', text: f.h }));
      arr.forEach((x, i) => {
        const p = path.concat(i);
        const ctl = f.of === 'i18n' ? i18nCtl(p, { long: f.long, rows: 2 }) : f.of === 'img' ? fileCtl(p, {}, true) : textCtl(p, {});
        const rm = h('button', { class: 'ico', type: 'button', title: 'Remove', 'aria-label': 'Remove', text: '✕', onclick: () => { get(path).splice(i, 1); draw(); changed(true); } });
        const upb = h('button', { class: 'ico', type: 'button', title: 'Move up', 'aria-label': 'Move up', text: '↑', onclick: () => { if (i > 0) { const l = get(path); [l[i - 1], l[i]] = [l[i], l[i - 1]]; draw(); changed(true); } } });
        wrap.append(h('div', { class: 'srow' }, ctl, upb, rm));
      });
    };
    draw();
    return wrap;
  }
  function mapCtl(path, f) {
    const obj = get(path) || {};
    const q = h('input', { class: 'inp search-in', type: 'search', placeholder: 'Search text…' });
    const rows = Object.keys(obj).map((k) => {
      const p = path.concat(k);
      const r = h('div', { class: 'map-row' }, h('code', { text: k }), ...['en', 'hi'].map((lang) => {
        const inp = h('input', { class: 'inp', lang, value: (get(p) || {})[lang] || '', 'aria-label': `${k} ${lang}` });
        inp.addEventListener('input', () => { if (typeof get(p) !== 'object') set(p, L2()); set(p.concat(lang), inp.value); changed(); });
        return inp;
      }));
      r.dataset.search = (k + ' ' + JSON.stringify(obj[k])).toLowerCase();
      return r;
    });
    q.addEventListener('input', () => { const k = q.value.trim().toLowerCase(); rows.forEach((r) => { r.hidden = k && !r.dataset.search.includes(k); }); });
    return h('section', { class: 'card' }, h('div', { class: 'list-hd' }, h('h2', { text: f.l, style: 'margin:0;font:600 16px var(--display)' }), q), h('div', { style: 'margin-top:10px' }, rows));
  }
  function sectionsCtl(path, f) {
    const wrap = h('section', { class: 'card' });
    const draw = () => {
      wrap.innerHTML = '';
      wrap.append(h('h2', { text: f.l }), h('p', { class: 'h', text: 'Untick to hide a section. Use the arrows to change the order.' }));
      const arr = get(path);
      const list = h('div', { class: 'items' });
      arr.forEach((s, i) => {
        const cb = h('input', { type: 'checkbox' }); cb.checked = s.visible !== false;
        cb.addEventListener('change', () => { arr[i].visible = cb.checked; changed(true); });
        const mv = (d) => h('button', { class: 'ico', type: 'button', 'aria-label': d < 0 ? 'Move up' : 'Move down', text: d < 0 ? '↑' : '↓', onclick: () => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; draw(); changed(true); } });
        list.append(h('div', { class: 'order-row' }, h('label', { class: 'switch' }, cb, h('span', { class: 'name', text: HOME_SECTIONS[s.id] || s.id })), h('span', { style: 'flex:1' }), mv(-1), mv(1)));
      });
      wrap.append(list);
    };
    draw();
    return wrap;
  }
  function botTest() {
    const inp = h('input', { class: 'inp', placeholder: 'e.g. membership fee kitni hai?' });
    const out = h('div', { class: 'bot-test' });
    const run = () => {
      const q = inp.value.trim(); if (!q) { out.innerHTML = ''; return; }
      const res = window.Chanakya ? window.Chanakya.test(S.c.bot, q) : [];
      const th = +S.c.bot.threshold || 0.34;
      out.innerHTML = '';
      if (!res.length || res[0].s < th) out.append(h('p', { class: 'muted', text: `Chanakya would not be sure (best match ${res[0] ? res[0].s : 0} is below ${th}) and would show the closest questions and the office contacts.` }));
      out.append(h('ol', {}, res.map((r, i) => h('li', { class: i === 0 && r.s >= th ? 'best' : '' }, `${r.q} `, h('span', { class: 'muted', text: `(${r.s})` })))));
    };
    inp.addEventListener('input', run);
    return h('section', { class: 'card' }, h('h2', { text: 'Try a question' }), h('p', { class: 'h', text: 'Type what a visitor might ask, in English, Hindi or Hinglish, and see which answer Chanakya picks.' }), inp, out);
  }

  /* ---------------------------------------------------------------- render a group */
  function renderSide() {
    const side = $('#side'); side.innerHTML = '';
    GROUPS.forEach((g) => {
      if (g.id === 'publish' || g.id === 'bot') side.append(h('div', { class: 'sep' }));
      side.append(h('button', { type: 'button', text: g.label, 'aria-current': g.id === S.group ? 'page' : null, onclick: () => openGroup(g.id) }));
    });
  }
  function openGroup(id) {
    S.group = id; renderSide();
    const g = GROUPS.find((x) => x.id === id);
    const ed = $('#editor'); ed.innerHTML = '';
    ed.append(h('h1', { text: g.label }));
    if (g.lead) ed.append(h('p', { class: 'lead', text: g.lead }));
    topPaths = new Set((g.fields || []).map((f) => f.k));
    if (g.special === 'publish') ed.append(...publishPanel());
    else (g.fields || []).forEach((f) => ed.append(field(f, [])));
    ed.scrollTop = 0;
    pv('bia:go', { route: g.route });
    try { sessionStorage.setItem('bia.admin.group', id); } catch {}
  }

  /* ---------------------------------------------------------------- saving, undo, preview */
  let saveT, pvT, histT;
  function changed(structural) {
    S.dirty = true; status();
    clearTimeout(saveT); saveT = setTimeout(saveDraft, 350);
    clearTimeout(pvT); pvT = setTimeout(sendPreview, structural ? 0 : 220);
    clearTimeout(histT); histT = setTimeout(commitHistory, 700);
  }
  function commitHistory() {
    const now = JSON.stringify(S.c);
    if (now === S.committed) return;
    S.hist.push(S.committed); if (S.hist.length > 60) S.hist.shift();
    S.committed = now; S.fut = []; undoState();
  }
  function undoState() { $('#undoBtn').disabled = !S.hist.length; $('#redoBtn').disabled = !S.fut.length; }
  function restore(json) { S.c = JSON.parse(json); S.committed = json; S.dirty = true; openGroup(S.group); saveDraft(); sendPreview(); status(); undoState(); }
  $('#undoBtn').addEventListener('click', () => { commitHistory(); if (!S.hist.length) return; S.fut.push(S.committed); restore(S.hist.pop()); toast('Undone'); });
  $('#redoBtn').addEventListener('click', () => { if (!S.fut.length) return; S.hist.push(S.committed); restore(S.fut.pop()); toast('Redone'); });
  async function saveDraft() {
    if (S.pub) S.dirty = JSON.stringify(S.c) !== S.pubJSON;
    try { await idb.set('draft', { content: S.c, baseVersion: S.base, dirty: S.dirty, savedAt: new Date().toISOString() }); } catch (e) { toast('Could not save on this device: ' + e.message); }
    if (bc) bc.postMessage('updated');
    status();
  }
  function status(text, cls) {
    const st = $('#status');
    st.className = 'pill' + (cls ? ' ' + cls : S.dirty ? ' dirty' : ' ok');
    st.textContent = text || (S.dirty ? '● Unpublished changes · saved on this device' : '✓ Everything is published');
  }
  const frame = () => $('#pv').contentWindow;
  function pv(type, extra) { try { frame().postMessage({ type, ...extra }, location.origin); } catch {} }
  function sendPreview() { pv('bia:content', { content: S.c }); }
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    if (e.data && e.data.type === 'bia:ready') { sendPreview(); pv('bia:prefs', prefs); const g = GROUPS.find((x) => x.id === S.group); if (g) pv('bia:go', { route: g.route }); }
  });
  const prefs = { lang: 'en', mode: 'light' };
  const seg = (id, key, attr) => $$(`#${id} button`).forEach((b) => b.addEventListener('click', () => {
    $$(`#${id} button`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    if (key === 'dev') $('#pvFrame').classList.toggle('phone', b.dataset.dev === 'phone');
    else { prefs[key] = b.dataset[attr]; pv('bia:prefs', prefs); }
  }));
  seg('pvDevice', 'dev'); seg('pvLang', 'lang', 'lang'); seg('pvMode', 'mode', 'mode');
  $('#previewToggle').addEventListener('click', () => $('#preview').classList.toggle('show'));

  /* ---------------------------------------------------------------- publish to GitHub */
  const GH_KEY = 'bia.gh';
  const ghCfg = () => { try { return { owner: 'skc-and-company', repo: 'bia-website', branch: 'main', token: '', ...JSON.parse(localStorage.getItem(GH_KEY) || '{}') }; } catch { return { owner: 'skc-and-company', repo: 'bia-website', branch: 'main', token: '' }; } };
  const saveGh = (c) => { try { localStorage.setItem(GH_KEY, JSON.stringify(c)); } catch {} };
  let logEl;
  const log = (msg, cls) => { if (!logEl) return; logEl.hidden = false; logEl.append(h('div', { class: cls || '', text: msg })); logEl.scrollTop = logEl.scrollHeight; };

  function publishPanel() {
    const c = ghCfg();
    const fld = (k, l, type = 'text', hint) => { const i = h('input', { class: 'inp', type, value: c[k] || '', autocomplete: 'off' }); i.addEventListener('change', () => { const n = ghCfg(); n[k] = i.value.trim(); saveGh(n); }); return h('label', { class: 'f' }, h('span', { class: 'lbl', text: l }), hint ? h('span', { class: 'hint', text: hint }) : null, i); };
    logEl = h('div', { class: 'log', hidden: true });
    const pages = `https://${c.owner}.github.io/${c.repo}/`;
    const imp = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    imp.addEventListener('change', async () => {
      try { const j = JSON.parse(await imp.files[0].text()); if (!j.site || !j.ui) throw new Error('This does not look like a BIA content file.'); S.c = j; changed(true); openGroup('publish'); toast('Content file imported. Review it, then publish.'); }
      catch (e) { toast(e.message); }
    });
    const disc = h('button', { class: 'btn warn', type: 'button', text: 'Discard unpublished changes', onclick: async () => {
      if (!disc.classList.contains('armed')) { disc.classList.add('armed'); disc.textContent = 'Click again to discard'; setTimeout(() => { disc.classList.remove('armed'); disc.textContent = 'Discard unpublished changes'; }, 3500); return; }
      await idb.del('draft'); S.c = clone(S.pub); S.base = S.pub.meta.version; S.dirty = false; S.committed = JSON.stringify(S.c); S.hist = []; S.fut = []; undoState();
      await saveDraft(); sendPreview(); openGroup('publish'); toast('Back to the published version.');
    } });
    return [
      h('section', { class: 'card' }, h('h2', { text: 'Publish your changes' }),
        h('p', { class: 'h', text: 'Your edits are saved on this device as you type and already show in the preview and on the public site in this browser. Publishing sends them to GitHub, and everyone sees them in about a minute.' }),
        h('div', { class: 'row' }, h('button', { class: 'btn pri', type: 'button', text: 'Publish now', onclick: () => publish() }), h('a', { class: 'btn', href: pages, target: '_blank', rel: 'noopener', text: 'Open live site ↗' })), logEl),
      h('section', { class: 'card' }, h('h2', { text: 'GitHub connection' }),
        h('p', { class: 'h', text: 'Publishing writes to the website’s GitHub repository, so this browser needs a GitHub publish key once. The key stays in this browser only; it is never put on the website.' }),
        h('div', { class: 'fields' }, fld('owner', 'GitHub account'), fld('repo', 'Repository'), fld('branch', 'Branch'), fld('token', 'GitHub publish key', 'password', 'A fine-grained personal access token with Contents: Read and write, for this repository only.')),
        h('div', { class: 'note blue', style: 'margin-top:12px' }, h('b', { text: 'How to create the key (one time):' }),
          h('ol', { class: 'steps' }, h('li', {}, 'Open ', h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener', text: 'github.com → Settings → Fine-grained tokens → Generate new token' }), '.'),
            h('li', { text: `Repository access: Only select repositories → ${c.repo}.` }), h('li', { text: 'Permissions → Repository permissions → Contents: Read and write.' }), h('li', { text: 'Generate, copy the key and paste it in the box above.' })))),
      h('section', { class: 'card' }, h('h2', { text: 'Backup' }), h('p', { class: 'h', text: 'Download the whole site content as one file, or load a file you saved earlier.' }),
        h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', text: 'Download content file', onclick: download }), h('button', { class: 'btn', type: 'button', text: 'Load a content file', onclick: () => imp.click() }), imp, disc),
        h('p', { class: 'hint muted', style: 'margin-top:10px', text: 'Without a publish key you can also publish by hand: download the content file and upload it as content.json on the repository’s GitHub page.' })),
    ];
  }
  async function blobToB64(blob) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); }); }
  function utf8b64(str) { const bytes = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); }
  function b64utf8(b64) { const bin = atob(b64.replace(/\s/g, '')); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); }
  function uploadsIn(o, set = new Map()) { JSON.stringify(o, (k, v) => { if (typeof v === 'string' && v.startsWith('upload:')) { const [id, name] = v.slice(7).split('|'); set.set(v, { id, name: name || id }); } return v; }); return set; }
  function replaceDeep(o, map) { if (Array.isArray(o)) return o.map((x) => replaceDeep(x, map)); if (o && typeof o === 'object') { const r = {}; for (const k in o) r[k] = replaceDeep(o[k], map); return r; } return typeof o === 'string' && map.has(o) ? map.get(o) : o; }
  async function download() {
    const ups = uploadsIn(S.c), map = new Map();
    for (const [ref, u] of ups) { const rec = await idb.get('upload:' + u.id); if (rec) map.set(ref, `data:${rec.type};base64,` + await blobToB64(rec.blob)); }
    const blob = new Blob([JSON.stringify(replaceDeep(S.c, map), null, 1)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'content.json' }); document.body.append(a); a.click(); a.remove();
  }
  let publishing = false;
  async function publish(force) {
    if (publishing) return;
    const c = ghCfg();
    if (!c.token) { openGroup('publish'); toast('Add the GitHub publish key first (one time).'); return; }
    if (S.group !== 'publish') openGroup('publish');
    publishing = true; $('#publishBtn').disabled = true; logEl.innerHTML = ''; status('Publishing…', 'dirty');
    const api = async (path, opts = {}) => {
      const r = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}${path}`, { ...opts, headers: { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) } });
      if (!r.ok) { let m = r.status + ' ' + r.statusText; try { m += ': ' + (await r.json()).message; } catch {} throw new Error(m); }
      return r.json();
    };
    try {
      log('Connecting to GitHub…');
      const ref = await api(`/git/ref/heads/${c.branch}`);
      const head = await api(`/git/commits/${ref.object.sha}`);
      let remoteV = 0;
      try { const f = await api(`/contents/content.json?ref=${encodeURIComponent(c.branch)}`); remoteV = (JSON.parse(b64utf8(f.content)).meta || {}).version || 0; } catch {}
      if (remoteV > S.base && !force) {
        log(`Someone published a newer version (${remoteV}) after you started editing (${S.base}). Publishing now will replace it.`, 'err');
        logEl.append(h('button', { class: 'btn warn', type: 'button', text: 'Publish anyway', onclick: () => { publishing = false; publish(true); } }));
        throw Object.assign(new Error('stopped'), { quiet: true });
      }
      const ups = uploadsIn(S.c), map = new Map(), tree = [], done = [];
      for (const [refStr, u] of ups) {
        const rec = await idb.get('upload:' + u.id);
        if (!rec) { log(`Missing upload ${u.name}; skipped.`, 'err'); continue; }
        log(`Uploading ${u.name} (${Math.round(rec.blob.size / 1024)} KB)…`);
        const b = await api('/git/blobs', { method: 'POST', body: JSON.stringify({ content: await blobToB64(rec.blob), encoding: 'base64' }) });
        const path = `uploads/${u.id}-${u.name}`;
        tree.push({ path, mode: '100644', type: 'blob', sha: b.sha }); map.set(refStr, path); done.push(u.id);
      }
      const version = Math.max(remoteV, S.base) + 1;
      const out = replaceDeep(S.c, map);
      out.meta = { ...(out.meta || {}), version, updatedAt: new Date().toISOString() };
      log('Saving content…');
      const cb = await api('/git/blobs', { method: 'POST', body: JSON.stringify({ content: utf8b64(JSON.stringify(out, null, 1)), encoding: 'base64' }) });
      tree.push({ path: 'content.json', mode: '100644', type: 'blob', sha: cb.sha });
      const t = await api('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: head.tree.sha, tree }) });
      const cm = await api('/git/commits', { method: 'POST', body: JSON.stringify({ message: `Update site content (version ${version}) from the admin panel`, tree: t.sha, parents: [ref.object.sha] }) });
      await api(`/git/refs/heads/${c.branch}`, { method: 'PATCH', body: JSON.stringify({ sha: cm.sha }) });
      log(`Published version ${version}. GitHub Pages is updating the live site…`, 'ok');
      S.c = out; S.pub = clone(out); S.pubJSON = JSON.stringify(out); S.base = version; S.dirty = false; S.committed = JSON.stringify(S.c);
      await saveDraft(); for (const id of done) await idb.del('upload:' + id);
      sendPreview(); status('✓ Published · going live…', 'ok');
      waitLive(c, version);
    } catch (e) {
      if (!e.quiet) { log('Publishing failed: ' + e.message, 'err'); if (/401|403|Bad credentials/i.test(e.message)) log('Check the GitHub publish key and that it has Contents: Read and write for this repository.', 'err'); }
      status();
    } finally { publishing = false; $('#publishBtn').disabled = false; }
  }
  async function waitLive(c, version) {
    const url = location.hostname.endsWith('github.io') ? 'content.json' : `https://${c.owner}.github.io/${c.repo}/content.json`;
    for (let i = 0; i < 48; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try { const j = await (await fetch(url + '?ts=' + Date.now(), { cache: 'no-store' })).json(); if (j.meta && j.meta.version >= version) { log('Live on the public site ✓', 'ok'); status(); toast('Your changes are live.'); return; } } catch {}
    }
    log('GitHub is taking longer than usual. The changes will appear shortly.');
  }
  $('#publishBtn').addEventListener('click', () => publish());

  /* ---------------------------------------------------------------- boot */
  async function boot() {
    try { S.pub = await fetchPublished(); S.pubJSON = JSON.stringify(S.pub); } catch (e) { $('#editor').innerHTML = '<p>Could not load content.json. Check your connection and reload.</p>'; return; }
    const d = await idb.get('draft').catch(() => null);
    if (d && d.dirty && d.content) { S.c = d.content; S.base = d.baseVersion || 0; S.dirty = true; }
    else { S.c = clone(S.pub); S.base = (S.pub.meta || {}).version || 0; S.dirty = false; }
    S.committed = JSON.stringify(S.c);
    document.body.append(h('datalist', { id: 'routes' }, ROUTES.map((r) => h('option', { value: r }))));
    let g = 'site'; try { g = sessionStorage.getItem('bia.admin.group') || 'site'; } catch {}
    openGroup(GROUPS.some((x) => x.id === g) ? g : 'site');
    status(); undoState(); sendPreview();
  }
  boot();
})();

/* Shared by the public site (index.html) and the admin panel (admin.html).
   - content.json is the published content.
   - The admin keeps an unpublished draft and uploaded files in this browser's IndexedDB.
     The public site shows that draft only on the same device, with a banner, so admin edits appear at once. */
(function () {
  const DB = 'bia-admin', STORE = 'kv';
  let dbp;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      if (!('indexedDB' in window)) return rej(new Error('no idb'));
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(STORE, mode), s = t.objectStore(STORE), r = fn(s);
      t.oncomplete = () => res(r && r.result);
      t.onerror = () => rej(t.error);
    });
  }
  const idb = {
    get: (k) => tx('readonly', (s) => s.get(k)).catch(() => undefined),
    set: (k, v) => tx('readwrite', (s) => s.put(v, k)),
    del: (k) => tx('readwrite', (s) => s.delete(k)),
    keys: () => tx('readonly', (s) => s.getAllKeys()).catch(() => []),
  };

  async function fetchPublished() {
    const r = await fetch('content.json?ts=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('content.json ' + r.status);
    return r.json();
  }

  // Files uploaded in the admin are referenced as "upload:<id>" until they are published.
  const urlCache = new Map();
  async function preloadUploads(content) {
    const ids = new Set();
    JSON.stringify(content, (k, v) => { if (typeof v === 'string' && v.startsWith('upload:')) ids.add(v.slice(7).split('|')[0]); return v; });
    await Promise.all([...ids].map(async (id) => {
      if (urlCache.has(id)) return;
      const rec = await idb.get('upload:' + id);
      if (rec && rec.blob) urlCache.set(id, URL.createObjectURL(rec.blob));
    }));
  }
  function asset(u) {
    if (!u) return '';
    if (u.startsWith('upload:')) return urlCache.get(u.slice(7).split('|')[0]) || '';
    return u;
  }

  function t(v, lang) {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    return v[lang] || v.en || v.hi || '';
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Plain text with blank-line paragraphs, **bold** and [label](url).
  function md(s) {
    return String(s || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) =>
      '<p>' + esc(p).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, a, b) => `<a href="${b}"${/^https?:/.test(b) ? ' target="_blank" rel="noopener"' : ''}>${a}</a>`)
        .replace(/\n/g, '<br>') + '</p>').join('');
  }

  window.BIA = { idb, fetchPublished, preloadUploads, asset, t, esc, md };
  // Google Fonts that cover both Devanagari and Latin, with the weights each one offers.
  window.BIA_FONTS = {
    'Eczar': 'wght@400..800', 'Tiro Devanagari Hindi': '', 'Rozha One': '', 'Yatra One': '', 'Noto Serif Devanagari': 'wght@400..800', 'Martel': 'wght@300;400;600;700;800',
    'Mukta': 'wght@300;400;500;600;700', 'Hind': 'wght@300;400;500;600;700', 'Noto Sans Devanagari': 'wght@300..800', 'Poppins': 'wght@300;400;500;600;700',
    'Baloo 2': 'wght@400..800', 'Anek Devanagari': 'wght@300..800', 'Kalam': 'wght@300;400;700',
  };
})();

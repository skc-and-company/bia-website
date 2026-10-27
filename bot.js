/* Chanakya (चाणक्य) — BIA's question-and-answer guide.
   Runs entirely in the visitor's browser. No API, no outside service: it matches the question against the
   FAQ list in content.json (English, Hindi and Hinglish, with spelling tolerance) and can work out fees and
   list the latest documents straight from the site's own data. */
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tr = (v, l) => (v == null ? '' : typeof v === 'string' ? v : v[l] || v.en || v.hi || '');

  /* ---------------------------------------------------------------- matching engine */
  const STOP = new Set(('a an the is are am was were of to for in on at me my i we you your do does did how what which who when where why can could should will would ' +
    'please tell about with and or it its this that be there any get know want need ' +
    'kya kyaa hai h hain ho hota hoti ka ki ke ko se me mein mai main mujhe hum aap apna apni kaise kaisa kab kahan kahaan kaun bataye batao bata btao kripya sir ji jankari jaankari chahiye karna karte karen kar raha rahi ' +
    'क्या है हैं हो होता होती का की के को से में मैं मुझे हम आप अपना अपनी कैसे कैसा कब कहाँ कहां कौन बताएं बताइए बताओ कृपया जी जानकारी चाहिए करना करें कर रहा रही').split(' '));
  const norm = (s) => String(s || '').toLowerCase().normalize('NFC')
    .replace(/income[\s-]*tax|आय\s*कर/g, 'incometax')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const grams = (w) => { const s = ` ${w} `, g = new Set(); for (let i = 0; i < s.length - 2; i++) g.add(s.slice(i, i + 3)); return g; };
  const sim = (a, b) => { const A = grams(a), B = grams(b); let n = 0; A.forEach((x) => B.has(x) && n++); return n / (A.size + B.size - n); };

  // Edit distance with swaps counted as one step ("memebrship" → "membership", "fess" → "fees").
  function dist(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }
  function build(bot) {
    const syn = new Map();
    (bot.synonyms || []).forEach((line) => { const w = norm(line).split(' ').filter(Boolean); w.forEach((x) => syn.set(x, w[0])); });
    const vocab = new Set(syn.keys());
    (bot.faqs || []).forEach((f) => norm([tr(f.q, 'en'), tr(f.q, 'hi'), f.keywords].join(' ')).split(' ').forEach((w) => { if (w.length > 2 && !STOP.has(w)) vocab.add(w); }));
    const fixed = new Map();
    const spell = (w) => {
      if (vocab.has(w) || w.length < 4 || /\d/.test(w)) return w;
      if (fixed.has(w)) return fixed.get(w);
      let best = w, bd = w.length >= 7 ? 3 : 2;
      vocab.forEach((v) => { if (Math.abs(v.length - w.length) <= 2) { const k = dist(w, v); if (k < bd) { bd = k; best = v; } } });
      fixed.set(w, best); return best;
    };
    const canon = (w) => syn.get(w) || (w.length > 4 && /^[a-z]+s$/.test(w) && syn.get(w.slice(0, -1))) || w;
    const toks = (s, fuzzy) => [...new Set(norm(s).split(' ').filter((w) => w && !STOP.has(w)).map((w) => canon(fuzzy ? spell(w) : w)))];
    const index = (bot.faqs || []).map((f) => ({ f, toks: new Set([...toks(tr(f.q, 'en')), ...toks(tr(f.q, 'hi')), ...toks(f.keywords || '')]) }));
    function match(q) {
      const qt = toks(q, true);
      if (!qt.length) return [];
      return index.map((e) => {
        let hit = 0;
        qt.forEach((w) => {
          if (e.toks.has(w)) { hit += 1; return; }
          if (w.length < 4) return;
          let best = 0; e.toks.forEach((x) => { if (x.length >= 4) best = Math.max(best, sim(w, x)); });
          if (best >= 0.5) hit += 0.75;
        });
        const s = 0.75 * (hit / qt.length) + 0.25 * (hit / Math.max(3, e.toks.size));
        return { f: e.f, s: Math.round(s * 1000) / 1000 };
      }).filter((r) => r.s > 0).sort((a, b) => b.s - a.s);
    }
    return { match, toks };
  }

  /* ---------------------------------------------------------------- styles */
  const css = `
  .bot-launch{position:fixed;right:max(18px,env(safe-area-inset-right,0px));bottom:calc(env(safe-area-inset-bottom,0px) + 18px);z-index:70;display:flex;align-items:center;gap:10px;padding:6px 18px 6px 6px;border-radius:999px;border:1px solid var(--line);cursor:pointer;background:var(--surface);color:var(--text);box-shadow:var(--shadow-lg);font:600 .95rem var(--font-display);transition:transform .3s var(--ease),opacity .25s,box-shadow .3s}
  .bot-launch:hover{transform:translateY(-3px)}
  .bot-launch.hide{opacity:0;transform:scale(.9);pointer-events:none}
  .bot-av{position:relative;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;flex:none;background:var(--brand);color:var(--accent);font:700 1.4rem/1 "Mukta",sans-serif;padding-bottom:2px}
  .bot-av::after{content:"";position:absolute;inset:-5px;border-radius:50%;border:2px dotted var(--accent)}
  @media (prefers-reduced-motion:no-preference){.bot-launch:not(.seen) .bot-av::after{animation:botspin 14s linear infinite}}
  @keyframes botspin{to{transform:rotate(360deg)}}
  @media (max-width:560px){.bot-launch{padding:6px}.bot-launch .bot-lbl{display:none}}
  .bot-panel{position:fixed;right:max(18px,env(safe-area-inset-right,0px));bottom:calc(env(safe-area-inset-bottom,0px) + 18px);z-index:75;width:min(410px,calc(100vw - 24px));height:min(640px,calc(100dvh - 40px));display:flex;flex-direction:column;background:var(--surface);color:var(--text);border-radius:22px;box-shadow:var(--shadow-lg);border:1px solid var(--line);overflow:hidden;transform-origin:bottom right;opacity:0;transform:translateY(12px) scale(.97);pointer-events:none;transition:opacity .25s,transform .35s var(--ease)}
  .bot-panel.open{opacity:1;transform:none;pointer-events:auto}
  @media (max-width:560px){.bot-panel{inset:0;width:auto;height:auto;border-radius:0;border:0;padding-top:env(safe-area-inset-top,0px)}}
  .bot-hd{position:relative;display:flex;align-items:center;gap:12px;padding:14px 14px 24px 16px;background:var(--navy);color:#fff}
  .bot-hd .bot-av{width:42px;height:42px;font-size:1.3rem}
  .bot-hd b{display:block;font:600 1.1rem/1.3 var(--font-display)}
  .bot-hd small{color:#C9CBE3}
  .bot-hd .kband{position:absolute;left:0;right:0;bottom:0;height:10px;--kband-bg:transparent}
  .bot-hd .kband::after{-webkit-mask-size:26px 10px;mask-size:26px 10px}
  .bot-x{margin-left:auto;background:rgb(255 255 255 / .12);border:0;color:#fff;width:38px;height:38px;border-radius:12px;cursor:pointer;display:grid;place-items:center}
  .bot-x:hover{background:rgb(255 255 255 / .22)}
  .bot-log{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:16px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}
  .bm,.um{max-width:88%;padding:10px 14px;border-radius:16px;line-height:1.55;font-size:.97rem;animation:rise .3s var(--ease) both;overflow-wrap:anywhere}
  .bm{background:var(--soft);border-bottom-left-radius:4px;align-self:flex-start}
  .um{background:var(--brand);color:#fff;border-bottom-right-radius:4px;align-self:flex-end}
  :root[data-mode="dark"] .um{background:var(--accent);color:#14164A}
  .bm p{margin:0 0 .5em}.bm p:last-child{margin:0}
  .bm ul{margin:.4em 0;padding-left:1.1em}.bm li{margin:.25em 0}
  .bm .acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  .bm .acts a,.bm .acts button,.bot-chips button{font:inherit;font-size:.85rem;font-weight:600;padding:6px 12px;border-radius:999px;border:1.5px solid color-mix(in oklab,var(--link) 40%,var(--line));background:var(--surface);color:var(--link);cursor:pointer;text-decoration:none;white-space:nowrap;transition:background .2s,border-color .2s}
  .bm .acts a:hover,.bm .acts button:hover,.bot-chips button:hover{border-color:var(--link);background:color-mix(in oklab,var(--link) 8%,var(--surface))}
  .bm .fee{font:700 1.6rem/1.1 var(--font-display);color:var(--link);margin:4px 0}
  .bm small{color:var(--muted)}
  .typing{display:inline-flex;gap:4px;padding:14px 16px}
  .typing i{width:7px;height:7px;border-radius:50%;background:var(--muted);animation:blink 1s infinite}
  .typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}
  @keyframes blink{50%{opacity:.25;transform:translateY(-2px)}}
  .bot-chips{display:flex;gap:6px;overflow-x:auto;padding:8px 16px 4px;scrollbar-width:none}
  .bot-chips::-webkit-scrollbar{display:none}
  .bot-form{display:flex;gap:8px;padding:10px 12px calc(env(safe-area-inset-bottom,0px) + 10px);border-top:1px solid var(--line)}
  .bot-form input{flex:1;min-width:0;border:1.5px solid var(--line);border-radius:999px;padding:11px 16px;background:var(--bg);color:var(--text)}
  .bot-form input:focus{outline:none;border-color:var(--link)}
  .bot-form button{width:46px;height:46px;flex:none;border-radius:50%;border:0;background:var(--accent);color:var(--on-accent);cursor:pointer;display:grid;place-items:center;transition:transform .15s}
  .bot-form button:active{transform:scale(.92)}
  .bot-note{font-size:.74rem;color:var(--muted);text-align:center;padding:0 16px 8px}`;

  /* ---------------------------------------------------------------- UI */
  let ctx, engine, engineFor, launch, panel, log, chipsEl, input, history = [];
  const C = () => ctx.content, L = () => ctx.lang, U = (k) => ctx.ui(k);
  const send = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const close = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const rupee = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
  const fmt = (d, l) => { try { return new Intl.DateTimeFormat(l === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)); } catch { return d; } };
  const getEngine = () => { if (engineFor !== C().bot) { engine = build(C().bot); engineFor = C().bot; } return engine; };
  const save = () => { try { sessionStorage.setItem('bia.chat', JSON.stringify(history.slice(-40))); } catch {} };

  function mount(c) {
    ctx = c;
    if (!document.getElementById('bot-css')) { const st = document.createElement('style'); st.id = 'bot-css'; st.textContent = css; document.head.appendChild(st); }
    launch = document.createElement('button'); launch.type = 'button'; launch.className = 'bot-launch';
    panel = document.createElement('section'); panel.className = 'bot-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false');
    document.body.append(launch, panel);
    try { history = JSON.parse(sessionStorage.getItem('bia.chat') || '[]'); } catch { history = []; }
    launch.addEventListener('click', open);
    refresh();
  }
  function frame() {
    const b = C().bot, l = L();
    launch.hidden = b.enabled === false;
    launch.innerHTML = `<span class="bot-av" aria-hidden="true">${l === 'hi' ? 'च' : 'च'}</span><span class="bot-lbl">${esc(U('botOpen'))}</span>`;
    launch.setAttribute('aria-label', U('botOpen'));
    panel.setAttribute('aria-label', tr(b.name, l));
    panel.innerHTML = `<div class="bot-hd"><span class="bot-av" aria-hidden="true">च</span><div><b>${esc(tr(b.name, l))}</b><small>${esc(tr(b.tagline, l))}</small></div><button class="bot-x" type="button" aria-label="${esc(U('close'))}">${close}</button><div class="kband"></div></div>
      <div class="bot-log" aria-live="polite"></div><div class="bot-chips"></div>
      <form class="bot-form"><input type="text" enterkeyhint="send" autocomplete="off" placeholder="${esc(U('botPlaceholder'))}" aria-label="${esc(U('botPlaceholder'))}"><button type="submit" aria-label="${esc(U('botSend'))}">${send}</button></form>
      <div class="bot-note">${esc(tr(b.disclaimer, l))} ${esc(U('botNote'))}</div>`;
    log = panel.querySelector('.bot-log'); chipsEl = panel.querySelector('.bot-chips'); input = panel.querySelector('input');
    chipsEl.innerHTML = (b.quick || []).map((q) => `<button type="button" data-ask="${esc(q.ask)}" data-label="${esc(tr(q.label, l))}">${esc(tr(q.label, l))}</button>`).join('');
    log.innerHTML = history.map((m) => `<div class="${m.who}">${m.html}</div>`).join('');
    panel.querySelector('.bot-x').addEventListener('click', hide);
    panel.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); const v = input.value.trim(); if (v) { input.value = ''; ask(v, v); } });
    panel.addEventListener('click', onClick);
  }
  function refresh() { if (!ctx) return; const wasOpen = panel.classList.contains('open'); frame(); if (wasOpen) panel.classList.add('open'); }
  function open() {
    panel.classList.add('open'); launch.classList.add('hide', 'seen');
    if (!history.length) push('bm', `<p>${esc(tr(C().bot.greeting, L()))}</p>`);
    log.scrollTop = log.scrollHeight;
    setTimeout(() => input.focus({ preventScroll: true }), 200);
  }
  function hide() { panel.classList.remove('open'); launch.classList.remove('hide'); launch.focus({ preventScroll: true }); }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel && panel.classList.contains('open')) hide(); });
  function push(who, html) {
    history.push({ who, html }); save();
    const d = document.createElement('div'); d.className = who; d.innerHTML = html; log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }
  function typing(then) {
    const d = document.createElement('div'); d.className = 'bm typing'; d.innerHTML = '<i></i><i></i><i></i>'; log.appendChild(d); log.scrollTop = log.scrollHeight;
    setTimeout(() => { d.remove(); then(); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 380);
  }
  function onClick(e) {
    const a = e.target.closest('[data-ask]'); if (a) { ask(a.dataset.ask, a.dataset.label || a.dataset.ask); return; }
    const f = e.target.closest('[data-fee]'); if (f) { feeStep(f.dataset.fee, f.textContent); return; }
    const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); ctx.go(g.dataset.go); if (innerWidth < 560) hide(); }
  }
  const pageBtn = (link, l) => !link ? '' : link.startsWith('#/') ? `<button type="button" data-go="${esc(link)}">${esc(U('botOpenPage'))} →</button>` : `<a href="${esc(ctx.asset(link) || link)}" target="_blank" rel="noopener">${esc(U('botOpenPage'))} ↗</a>`;

  function ask(q, shown) {
    push('um', esc(shown));
    const l = /[ऀ-ॿ]/.test(q) ? 'hi' : L();
    typing(() => answer(q, l));
  }
  function answer(q, l) {
    const res = getEngine().match(q);
    const th = +C().bot.threshold || 0.34;
    const best = res[0];
    if (!best || best.s < th) {
      const sug = res.filter((r) => r.s >= 0.12).slice(0, 3);
      push('bm', `<p>${esc(tr(C().bot.fallback, l))}</p>${sug.length ? `<p><small>${esc(U('botMaybe'))}</small></p><div class="acts">${sug.map((r) => `<button type="button" data-ask="${esc(tr(r.f.q, l))}">${esc(tr(r.f.q, l))}</button>`).join('')}</div>` : ''}${contactHTML(l)}`);
      return;
    }
    const f = best.f;
    let extra = '';
    const act = f.action || '';
    if (act === 'fees') extra = feeGroups(l);
    else if (act.startsWith('latest')) extra = latest(act.split(':')[1] || 'all', l);
    else if (act === 'newpolicy') extra = newPolicy(l);
    else if (act === 'events') extra = events(l);
    else if (act === 'contact') extra = contactHTML(l);
    push('bm', `<p>${esc(tr(f.a, l))}</p>${extra}${act === 'fees' ? '' : `<div class="acts">${pageBtn(f.link, l)}</div>`}`);
  }

  /* ---------------------------------------------------------------- answers built from the site's own data */
  function feeGroups(l) {
    const groups = ['industry', 'service', 'other'].filter((g) => (C().pages.membership.fees || []).some((f) => f.group === g));
    return `<p><small>${esc(U('botFeeAsk'))}</small></p><div class="acts">${groups.map((g) => `<button type="button" data-fee="g:${g}">${esc(U('g_' + g))}</button>`).join('')}</div>`;
  }
  function feeStep(code, label) {
    const l = L(), fees = C().pages.membership.fees || [];
    push('um', esc(label));
    typing(() => {
      if (code.startsWith('g:')) {
        const g = code.slice(2);
        push('bm', `<div class="acts">${fees.map((f, i) => [f, i]).filter(([f]) => f.group === g).map(([f, i]) => `<button type="button" data-fee="s:${i}">${esc(tr(f.label, l))}</button>`).join('')}</div>`);
      } else {
        const f = fees[+code.slice(2)], gst = (+C().pages.membership.gstRate || 0) / 100;
        const first = (f.yearly + f.admission) * (1 + gst), renew = f.yearly * (1 + gst);
        push('bm', `<p>${esc(U('firstYear'))}</p><div class="fee">${rupee(first)}</div><p><small>${rupee(f.yearly)} ${esc(U('yearly'))} + ${rupee(f.admission)} ${esc(U('admission'))} + ${esc(U('gst'))} ${C().pages.membership.gstRate}%</small></p><p>${esc(U('renewal'))}: <b>${rupee(renew)}</b></p><div class="acts"><button type="button" data-go="#/membership">${esc(tr(C().pages.membership.applyTitle, l))} →</button></div>`);
      }
    });
  }
  function latest(sec, l) {
    const items = C().policies.items.filter((d) => sec === 'all' || d.section === sec).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 3);
    if (!items.length) return '';
    return `<ul>${items.map((d) => `<li><b>${esc(tr(d.title, l))}</b><br><small>${esc(fmt(d.date, l))} · ${esc(U('st_' + d.status))}</small></li>`).join('')}</ul>`;
  }
  function newPolicy(l) {
    const np = C().policies.newPolicy || {};
    const file = np.fileEn || np.fileHi;
    return `<p><b>${esc(tr(np.title, l))}</b>: ${esc(U('np_' + np.status))}${np.date ? ' · ' + esc(fmt(np.date, l)) : ''}</p><p><small>${esc(tr(np.text, l))}</small></p>${file ? `<div class="acts"><a href="${esc(ctx.asset(file) || file)}" target="_blank" rel="noopener">${esc(U('openDoc'))} ↗</a></div>` : ''}`;
  }
  function events(l) {
    const today = new Date().toISOString().slice(0, 10);
    const up = (C().pages.events.upcoming || []).filter((e) => (e.endDate || e.date) >= today);
    if (up.length) return `<ul>${up.slice(0, 3).map((e) => `<li><b>${esc(tr(e.title, l))}</b><br><small>${esc(fmt(e.date, l))} · ${esc(tr(e.venue, l))}</small></li>`).join('')}</ul>`;
    return `<p><small>${esc(U('noUpcoming'))}</small></p><ul>${(C().pages.events.annual || []).map((a) => `<li><b>${esc(tr(a.name, l))}</b> · <small>${esc(tr(a.when, l))}</small></li>`).join('')}</ul>`;
  }
  function contactHTML(l) {
    const s = C().site;
    return `<p style="margin-top:8px">${esc(tr(s.address, l))}<br>${s.phone ? `<a href="tel:${esc(s.phone.replace(/\s/g, ''))}">${esc(s.phone)}</a>` : ''}${s.email ? `<br><a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : ''}</p><div class="acts">${s.mapLink ? `<a href="${esc(s.mapLink)}" target="_blank" rel="noopener">${esc(U('directions'))} ↗</a>` : ''}<button type="button" data-go="#/contact">${esc(U('contactUs'))} →</button></div>`;
  }

  window.Chanakya = {
    mount, refresh,
    // used by the admin's "Try a question" box
    test(bot, q) { return build(bot).match(q).slice(0, 5).map((r) => ({ q: tr(r.f.q, 'en'), s: r.s })); },
  };
})();

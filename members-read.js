/* Reads a member list into a table (column names + rows) in the admin's browser, for the Member directory.
   - PDF: pdf.js gives every piece of text with its position. The reader finds the header row, the columns (from the
     table's ruled lines or the empty gaps between columns) and which lines belong to the same member (ruled rows,
     the serial number, or the spacing between rows).
   - Excel (.xlsx), Word (.docx) and CSV are read exactly.
   Nothing is sent anywhere: the file is read on this device. */
(function () {
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/';
  let pdfjsP = null;
  const loadPdfjs = () => pdfjsP || (pdfjsP = import(PDFJS + 'pdf.min.mjs').then((m) => { m.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.mjs'; return m; }).catch((e) => { pdfjsP = null; throw new Error('The PDF reader could not load. Check the internet connection and try again. (' + e.message + ')'); }));

  const clean = (s) => String(s ?? '').replace(/[   ]/g, ' ').replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim();
  const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  const isSerial = (s) => /^\d{1,5}[.)]?$/.test(clean(s));

  /* ---------------------------------------------------------------- header words */
  const HEAD_WORDS = new Set(('sl sr s no serial name names firm company member members organisation organization unit concern address office factory works regd registered city town district place pin pincode state phone phones telephone tel mobile mob cell contact email e-mail mail website web url fax sector category categories classification class product products manufacture manufacturing manufacturer line business activity trade nature profession service services representative representatives proprietor partner director designation person gst gstin membership type remarks whatsapp since').split(' '));
  const HEAD_HI = /नाम|पता|फर्म|फ़र्म|कंपनी|संस्था|शहर|जिला|ज़िला|फोन|फ़ोन|मोबाइल|ईमेल|क्रम|उत्पाद|सदस्य|प्रतिनिधि|श्रेणी|वर्ग|व्यवसाय/;
  function headScore(text) {
    const toks = new Set(String(text).toLowerCase().split(/[^a-zऀ-ॿ-]+/).filter(Boolean));
    let n = 0;
    for (const t of toks) if (HEAD_WORDS.has(t)) n++;
    if (HEAD_HI.test(text)) n += 2;
    if (/\d{5,}/.test(text) || /@/.test(text)) n -= 3; // phone numbers, pins or emails mean a member's row
    return n;
  }
  const tokens = (s) => new Set(String(s).toLowerCase().split(/[^a-zऀ-ॿ0-9]+/).filter((t) => t.length > 1));
  const similar = (a, b) => { const A = tokens(a), B = tokens(b); if (!A.size || !B.size) return 0; let n = 0; for (const t of A) if (B.has(t)) n++; return n / (A.size + B.size - n); };
  const JUNK = [/^(page|pg\.?|पृष्ठ)?\s*\d{1,4}\s*((of|\/|से)\s*\d{1,4})?$/i, /^page\s+\d+/i, /^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}/, /^(https?|file):\/\//i, /^about:blank/i];

  /* Join the lines of one cell. A word too long for the cell is broken at its edge (long emails, web addresses,
     numbers, narrow columns); those pieces are joined without a space.
     parts: [{ t, x1, fs, w1 }] in reading order; x1 = where the line ends, w1 = width of its first word;
     colMax = the furthest any text reaches in this column. */
  function joinCell(parts, colMax) {
    let out = '', prev = null;
    for (const p of parts) {
      const t = clean(p.t); if (!t) continue;
      if (!out) { out = t; prev = p; continue; }
      const a = out.split(' ').pop(), b = t.split(' ')[0];
      const fs = prev.fs || 8, room = colMax != null && prev.x1 != null ? colMax - prev.x1 : Infinity;
      const edge = room <= fs * 0.9, fits = p.w1 != null && room >= p.w1 + fs * 0.25; // fits: the word would have fitted above, so this was no wrap at a space
      const prevSingle = !clean(prev.t).includes(' ');
      let glue = false;
      if (/[,;:]$/.test(a)) glue = false;
      else if (/[A-Za-z0-9]-$/.test(a) && /^[A-Za-z0-9]/.test(b)) glue = true;
      else if (/@|www\.|https?:\/\//i.test(a + b) && !(/@/.test(a) && /@/.test(b)) && !/^(www\.|https?:)/i.test(b)) glue = true;
      else if (/^\d+$/.test(a) && /^\d+$/.test(b) && (a + b).length <= 11 && (edge || fits)) glue = true;
      else if (prevSingle && /[A-Za-z0-9]$/.test(a) && /^[a-z0-9]/.test(b) && (edge || fits)) glue = true;
      out += (glue ? '' : ' ') + t; prev = p;
    }
    return out;
  }
  const partOf = (its) => {
    if (!its.length) return null;
    let t = ''; its.forEach((it, i) => { t += (i && it.x0 - its[i - 1].x1 > it.fs * 0.12 ? ' ' : '') + it.s; });
    const f = its[0], tok = f.s.split(' ')[0];
    return { t, x1: Math.max(...its.map((i) => i.x1)), fs: f.fs, w1: (f.x1 - f.x0) * tok.length / Math.max(1, f.s.length) };
  };

  /* ---------------------------------------------------------------- PDF */
  async function readPdf(buf, progress) {
    const lib = await loadPdfjs();
    let doc;
    try { doc = await lib.getDocument({ data: buf, isEvalSupported: false }).promise; }
    catch (e) { throw new Error(/password/i.test(e.message) ? 'This PDF is password-protected. Save a copy without a password and upload that.' : 'This file could not be opened as a PDF (' + e.message + ').'); }
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      progress && progress(`Reading page ${n} of ${doc.numPages}…`);
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();
      const items = [];
      for (const it of tc.items) {
        if (!it.str || !it.str.trim()) continue;
        const [a, b, c, d, e, f] = it.transform;
        const fs = Math.hypot(c, d) || Math.hypot(a, b) || 8;
        const len = Math.hypot(a, b) || 1;
        let width = it.width || 0;
        if (width < 0.5) width = fs * 0.5 * it.str.length;
        const p0 = vp.convertToViewportPoint(e, f), p1 = vp.convertToViewportPoint(e + (a / len) * width, f + (b / len) * width);
        if (Math.abs(p1[1] - p0[1]) > Math.abs(p1[0] - p0[0]) * 0.3 && Math.abs(p1[1] - p0[1]) > 2) continue; // turned text
        const x0 = Math.min(p0[0], p1[0]), x1 = Math.max(p0[0], p1[0]);
        const str = it.str.replace(/\t/g, '    ');
        if (/\S {2,}\S/.test(str)) { // text lined up with runs of spaces: split into pieces
          const cw = (x1 - x0) / str.length, re = /\S+(?: \S+)*/g; let m;
          while ((m = re.exec(str))) items.push({ x0: x0 + m.index * cw, x1: x0 + (m.index + m[0].length) * cw, y: p0[1], fs, s: m[0] });
        } else {
          const lead = str.length - str.trimStart().length, trail = str.length - str.trimEnd().length, cw = (x1 - x0) / str.length;
          items.push({ x0: x0 + lead * cw, x1: Math.max(x0 + lead * cw + 0.5, x1 - trail * cw), y: p0[1], fs, s: str.trim() });
        }
      }
      let rules = { h: [], v: [] };
      if (items.length) { try { rules = await findRules(page, items); } catch (e) { console.warn('rules', e); } }
      pages.push({ n, w: vp.width, h: vp.height, items, rules });
      page.cleanup();
    }
    doc.destroy();
    if (!pages.some((p) => p.items.length)) throw new Error('This PDF has no text in it. It looks like a scan or a photo, so the names cannot be read. Upload the Excel or Word file instead, or a PDF saved from it.');
    progress && progress('Finding the columns and rows…');
    return tableFromPdf(pages);
  }

  /* Ruled lines and shaded bands, found by drawing the page and looking for long runs of ink. */
  async function findRules(page, items) {
    const S = 1.5, vp = page.getViewport({ scale: S });
    const W = Math.ceil(vp.width), H = Math.ceil(vp.height);
    if (W * H > 12e6) return { h: [], v: [] };
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    await page.render({ canvasContext: ctx, viewport: vp, intent: 'print' }).promise; // 'print' does not wait for screen refreshes, so a background tab stays fast
    const px = ctx.getImageData(0, 0, W, H).data;
    const L = new Uint8Array(W * H), hist = new Uint32Array(256);
    for (let i = 0, j = 0; i < L.length; i++, j += 4) { const v = (px[j] * 77 + px[j + 1] * 150 + px[j + 2] * 29) >> 8; L[i] = v; hist[v]++; }
    cv.width = cv.height = 0;
    let bg = 255; for (let v = 0; v < 256; v++) if (hist[v] > hist[bg]) bg = v;
    const xs0 = items.map((i) => i.x0).sort((a, b) => a - b), xs1 = items.map((i) => i.x1).sort((a, b) => a - b);
    const q = (a, p) => a[Math.min(a.length - 1, Math.max(0, Math.floor(a.length * p)))];
    const X0 = Math.max(0, Math.floor(q(xs0, 0.02) * S)), X1 = Math.min(W - 1, Math.ceil(q(xs1, 0.98) * S)), span = X1 - X0 + 1;
    if (span < 30) return { h: [], v: [] };
    const runs = (n, frac) => {
      const out = []; let s = -1;
      for (let i = 0; i <= n; i++) {
        const on = i < n && frac(i) >= 0.8;
        if (on && s < 0) s = i;
        if (!on && s >= 0) { if (i - s <= 5) out.push((s + i - 1) / 2 / S); else out.push(s / S, (i - 1) / S); s = -1; }
      }
      return out;
    };
    const h = runs(H, (y) => { let c = 0; const o = y * W; for (let x = X0; x <= X1; x++) if (Math.abs(L[o + x] - bg) > 14) c++; return c / span; });
    let v = [];
    if (h.length >= 2) {
      const T = Math.floor(h[0] * S), B = Math.ceil(h[h.length - 1] * S), hh = B - T + 1;
      if (hh > 30) v = runs(W, (x) => { let c = 0; for (let y = T; y <= B; y++) if (Math.abs(L[y * W + x] - bg) > 14) c++; return c / hh; });
    }
    return { h, v };
  }

  function tableFromPdf(pages) {
    const fsAll = pages.flatMap((p) => p.items.map((i) => i.fs)), FS = median(fsAll) || 8;
    /* 1. lines of text */
    for (const p of pages) {
      const its = [...p.items].sort((a, b) => a.y - b.y || a.x0 - b.x0), lines = [];
      for (const it of its) {
        const ln = lines[lines.length - 1];
        if (ln && Math.abs(it.y - ln.y) <= Math.max(1, 0.35 * Math.min(it.fs, ln.fs))) ln.items.push(it);
        else lines.push({ y: it.y, fs: it.fs, items: [it], page: p.n });
      }
      lines.forEach((ln) => { ln.items.sort((a, b) => a.x0 - b.x0); ln.text = clean(ln.items.map((i) => i.s).join(' ')); ln.mid = ln.y - ln.fs * 0.3; });
      p.lines = lines;
      // merge separators closer than half a line
      const hs = [];
      for (const y of p.rules.h) { if (hs.length && y - hs[hs.length - 1] < FS * 0.6) hs[hs.length - 1] = (hs[hs.length - 1] + y) / 2; else hs.push(y); }
      p.seps = hs;
    }
    /* 2. page numbers, printed dates, and text repeated at the top or bottom of most pages */
    const keyOf = (t) => t.toLowerCase().replace(/\d+/g, '#');
    const edgeCount = new Map();
    pages.forEach((p) => { const L = p.lines; [L[0], L[L.length - 1]].forEach((ln) => { if (ln) edgeCount.set(keyOf(ln.text), (edgeCount.get(keyOf(ln.text)) || 0) + 1); }); });
    pages.forEach((p) => p.lines.forEach((ln, i) => {
      // a page number sits at the very top or bottom of the page, apart from the table
      const L = p.lines, apart = (i === L.length - 1 && ln.y - L[i - 1]?.y > 1.8 * ln.fs) || (i === 0 && L[1]?.y - ln.y > 1.8 * ln.fs) || L.length === 1;
      if (JUNK.slice(2).some((r) => r.test(ln.text)) || (apart && JUNK.slice(0, 2).some((r) => r.test(ln.text)))) ln.junk = true;
      if (pages.length >= 3 && (i === 0 || i === p.lines.length - 1) && edgeCount.get(keyOf(ln.text)) >= Math.max(3, pages.length * 0.6) && headScore(ln.text) < 2) ln.junk = true;
    }));
    /* 3. the header row */
    let head = null;
    for (const p of pages) {
      for (const ln of p.lines.filter((l) => !l.junk).slice(0, 30)) { const s = headScore(ln.text); if (s >= 2 && (!head || s > head.s)) head = { ln, s, page: p.n }; }
      if (head) break;
    }
    const bandOf = (p, y) => { const s = p.seps; for (let i = 0; i < s.length - 1; i++) if (y >= s[i] && y < s[i + 1]) return i; return -1; };
    const headLines = [];
    if (head) {
      const hp = pages.find((p) => p.n === head.page), L = hp.lines, k = L.indexOf(head.ln);
      const band = bandOf(hp, head.ln.mid);
      const isHeadish = (ln) => headScore(ln.text) >= 0 && !/\d{5,}|@/.test(ln.text) && !isSerial(ln.items[0].s);
      const blk = [head.ln];
      for (let i = k + 1; i < L.length; i++) { // header cells that wrap onto more lines
        const ln = L[i], prev = L[i - 1];
        const same = band >= 0 ? bandOf(hp, ln.mid) === band : ln.y - prev.y <= 1.6 * Math.max(ln.fs, prev.fs) && isHeadish(ln);
        if (!same) break; blk.push(ln);
      }
      for (let i = k - 1; i >= 0; i--) { // a group heading just above (inside the same ruled band only)
        const ln = L[i]; if (band >= 0 && bandOf(hp, ln.mid) === band) blk.unshift(ln); else break;
      }
      blk.forEach((ln) => { ln.role = 'head'; headLines.push(ln); });
      for (const p of pages) {
        if (p.n < head.page) { p.lines.forEach((ln) => { ln.role = ln.role || 'title'; }); continue; }
        if (p.n === head.page) { L.slice(0, L.indexOf(blk[0])).forEach((ln) => { ln.role = 'title'; }); continue; }
        // a repeated header near the top of later pages
        const top = p.lines.filter((l) => !l.junk).slice(0, 8);
        const hText = headLines.map((l) => l.text).join(' ');
        const r = top.findIndex((ln) => headScore(ln.text) >= Math.max(2, head.s - 2) || similar(ln.text, hText) >= 0.5);
        if (r >= 0) {
          const first = top[r], idx = p.lines.indexOf(first), pb = bandOf(p, first.mid);
          p.lines.slice(0, idx).forEach((ln) => { ln.role = 'title'; });
          first.role = 'head';
          for (let i = idx + 1; i < p.lines.length; i++) {
            const ln = p.lines[i], prev = p.lines[i - 1];
            const same = pb >= 0 ? bandOf(p, ln.mid) === pb : ln.y - prev.y <= 1.6 * Math.max(ln.fs, prev.fs) && isHeadish(ln) && headScore(ln.text) >= 1;
            if (!same) break; ln.role = 'head';
          }
        }
      }
    }
    const body = pages.flatMap((p) => p.lines.filter((ln) => !ln.junk && !ln.role));
    if (!body.length) throw new Error('No member rows were found under the header in this PDF.');
    body.forEach((ln) => { ln.role = 'body'; });

    /* 4. columns: from ruled lines when the table has them, otherwise from the gaps no line crosses */
    const gapCols = columnsFromGaps(body);
    const ruleCols = columnsFromRules(pages, body);
    const cols = ruleCols && ruleCols.length >= Math.max(2, gapCols.length * 0.7) ? ruleCols : gapCols;
    const colOf = (it) => { const c = (it.x0 + it.x1) / 2; let best = 0, bd = Infinity; cols.forEach(([a, b], i) => { const dd = c < a ? a - c : c > b ? c - b : 0; if (dd < bd) { bd = dd; best = i; } }); return best; };
    const maxX1 = cols.map(() => 0);
    for (const ln of body) { ln.cells = cols.map(() => []); for (const it of ln.items) { const ci = colOf(it); ln.cells[ci].push(it); maxX1[ci] = Math.max(maxX1[ci], it.x1); } }
    body.forEach((ln) => { ln.anchor = isSerial((ln.cells[0][0] || {}).s || '') && ln.cells[0].length === 1; });

    /* 5. rows: ruled rows, else the serial number, else the spacing */
    let groups = null, method = '';
    const pagesBands = pages.filter((p) => p.seps.length >= 3);
    if (pagesBands.length) {
      const inBand = body.filter((ln) => bandOf(pages[ln.page - 1], ln.mid) >= 0);
      const per = new Map(); inBand.forEach((ln) => { const k = ln.page + ':' + bandOf(pages[ln.page - 1], ln.mid); per.set(k, (per.get(k) || 0) + 1); });
      if (per.size >= 3 && inBand.length >= body.length * 0.7 && median([...per.values()]) <= 8) {
        // lines above the first or below the last line on a page form a row too (striped tables have no edge there)
        const keyOf2 = (ln) => { const p = pages[ln.page - 1], b = bandOf(p, ln.mid); return ln.page + ':' + (b >= 0 ? b : p.seps.length && ln.mid < p.seps[0] ? 'before' : 'after'); };
        const m = new Map(); body.forEach((ln) => { const k = keyOf2(ln); if (!m.has(k)) m.set(k, []); m.get(k).push(ln); });
        groups = [...m.values()]; method = 'ruled rows';
      }
    }
    if (!groups) {
      const firsts = body.filter((ln) => ln.cells[0].length);
      const anchors = body.filter((ln) => ln.anchor);
      if (anchors.length >= 3 && anchors.length >= firsts.length * 0.85 && anchors.length >= body.length * 0.12) { groups = rowsBySerial(body); method = 'serial numbers'; }
      else { groups = rowsByGaps(body); method = 'line spacing'; }
    }
    /* 6. cells */
    const columns = cols.map((c, ci) => {
      const parts = headLines.map((ln) => partOf(ln.items.filter((it) => colOf(it) === ci))).filter(Boolean);
      return joinCell(parts, Math.max(maxX1[ci], ...parts.map((p) => p.x1)));
    });
    const rows = groups.map((g) => cols.map((c, ci) => joinCell(g.map((ln) => partOf(ln.cells[ci])).filter(Boolean), maxX1[ci])));
    const notes = [];
    if (!head) notes.push('No header row was found, so the columns are numbered. Rename them below, or use a row as the column names.');
    return { columns, rows, method: `PDF · ${pages.length} page${pages.length > 1 ? 's' : ''} · ${cols.length} columns from ${cols === ruleCols ? 'ruled lines' : 'column gaps'} · rows by ${method}`, notes };
  }

  function columnsFromGaps(lines) {
    let minX = Infinity, maxX = -Infinity;
    for (const ln of lines) for (const it of ln.items) { minX = Math.min(minX, it.x0); maxX = Math.max(maxX, it.x1); }
    const R = 2, n = Math.ceil((maxX - minX) * R) + 2, cov = new Uint32Array(n), mark = new Uint8Array(n);
    for (const ln of lines) {
      mark.fill(0);
      for (const it of ln.items) { const a = Math.max(0, Math.floor((it.x0 - minX) * R)), b = Math.min(n, Math.ceil((it.x1 - minX) * R)); for (let k = a; k < b; k++) mark[k] = 1; }
      for (let k = 0; k < n; k++) cov[k] += mark[k];
    }
    const tol = Math.max(1, Math.floor(lines.length * 0.004)), cols = [];
    let s = -1;
    for (let k = 0; k <= n; k++) {
      const on = k < n && cov[k] > tol;
      if (on && s < 0) s = k;
      if (!on && s >= 0) { cols.push([minX + s / R, minX + k / R]); s = -1; }
    }
    return cols.length ? cols : [[minX, maxX]];
  }
  function columnsFromRules(pages, body) {
    const withV = pages.filter((p) => p.rules.v.length >= 3);
    if (!withV.length) return null;
    const xs = withV.flatMap((p) => p.rules.v.map((x) => ({ x, p: p.n }))).sort((a, b) => a.x - b.x);
    const cl = [];
    for (const r of xs) { const c = cl[cl.length - 1]; if (c && r.x - c.x[c.x.length - 1] <= 2) { c.x.push(r.x); c.p.add(r.p); } else cl.push({ x: [r.x], p: new Set([r.p]) }); }
    const bounds = cl.filter((c) => c.p.size >= Math.max(1, withV.length * 0.5)).map((c) => median(c.x));
    if (bounds.length < 3) return null;
    const cols = [];
    for (let i = 0; i < bounds.length - 1; i++) {
      const a = bounds[i], b = bounds[i + 1];
      if (body.some((ln) => ln.items.some((it) => (it.x0 + it.x1) / 2 > a && (it.x0 + it.x1) / 2 < b))) cols.push([a, b]);
    }
    return cols.length >= 2 ? cols : null;
  }
  // Lines between two serial numbers belong to the member above or below, split at the widest gap
  // (this follows tables whose cells sit at the top, middle or bottom).
  function rowsBySerial(lines) {
    const A = lines.map((l, i) => (l.anchor ? i : -1)).filter((i) => i >= 0);
    const owner = lines.map(() => -1); A.forEach((i) => { owner[i] = i; });
    let up = 0, down = 0;
    for (let k = 0; k < A.length - 1; k++) {
      const a = A[k], b = A[k + 1];
      if (b - a <= 1 || lines[a].page !== lines[b].page) continue;
      const gaps = []; for (let i = a + 1; i <= b; i++) gaps.push(lines[i].y - lines[i - 1].y);
      let m = gaps.length - 1, mx = -1; gaps.forEach((g, j) => { if (g > mx + 0.3) { mx = g; m = j; } });
      if (mx < Math.min(...gaps) * 1.2) m = gaps.length - 1;
      for (let i = a + 1; i < b; i++) owner[i] = i <= a + m ? a : b;
      if (m === gaps.length - 1) up++; else if (m === 0) down++;
    }
    const topAligned = up >= down;
    for (let k = 0; k < A.length; k++) {
      const a = A[k], b = A[k + 1] ?? lines.length;
      if (b - a <= 1 || (b < lines.length && lines[a].page === lines[b].page)) continue;
      for (let i = a + 1; i < b; i++) owner[i] = lines[i].page === lines[a].page || topAligned || b >= lines.length ? a : b;
    }
    for (let i = 0; i < (A[0] ?? 0); i++) owner[i] = A[0];
    const m = new Map(); lines.forEach((ln, i) => { const o = owner[i]; if (o < 0) return; if (!m.has(o)) m.set(o, []); m.get(o).push(ln); });
    return [...m.keys()].sort((x, y) => x - y).map((k) => m.get(k));
  }
  function rowsByGaps(lines) {
    const gaps = []; for (let i = 1; i < lines.length; i++) if (lines[i].page === lines[i - 1].page) gaps.push(lines[i].y - lines[i - 1].y);
    const s = [...gaps].sort((a, b) => a - b);
    let thr = Infinity;
    if (s.length >= 4) {
      let best = 1, bi = -1;
      for (let i = Math.floor(s.length * 0.1); i < s.length - 1; i++) { const r = s[i + 1] / Math.max(s[i], 0.1); if (r > best) { best = r; bi = i; } }
      if (best >= 1.25 && bi >= 0) thr = (s[bi] + s[bi + 1]) / 2;
    }
    const groups = [];
    lines.forEach((ln, i) => {
      const prev = lines[i - 1];
      let start = !prev;
      if (prev) {
        if (ln.page !== prev.page) start = ln.cells[0].length > 0;
        else if (thr < Infinity) start = ln.y - prev.y >= thr;
        else start = ln.cells[0].length > 0;
      }
      if (start || !groups.length) groups.push([ln]); else groups[groups.length - 1].push(ln);
    });
    return groups;
  }

  /* ---------------------------------------------------------------- Excel, Word, CSV */
  async function unzip(buf) {
    const dv = new DataView(buf);
    let e = buf.byteLength - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('This file is damaged or is not a real Excel/Word file.');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
    const files = {};
    for (let i = 0; i < n; i++) {
      const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      files[new TextDecoder().decode(new Uint8Array(buf, p + 46, nl))] = { method, size, off };
      p += 46 + nl + xl + cl;
    }
    return async (name) => {
      const f = files[name]; if (!f) return null;
      const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
      const data = new Uint8Array(buf, start, f.size);
      if (f.method === 0) return new TextDecoder().decode(data);
      return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    };
  }
  const xml = (s) => new DOMParser().parseFromString(s, 'application/xml');
  const byTag = (el, tag) => [...el.getElementsByTagName('*')].filter((x) => x.localName === tag);
  async function readXlsx(buf) {
    const read = await unzip(buf);
    const wb = await read('xl/workbook.xml'); if (!wb) throw new Error('This does not look like an Excel (.xlsx) file.');
    const rels = xml((await read('xl/_rels/workbook.xml.rels')) || '<r/>');
    const sheets = byTag(xml(wb), 'sheet');
    let target = 'worksheets/sheet1.xml';
    if (sheets.length) {
      const rid = sheets[0].getAttribute('r:id') || [...sheets[0].attributes].find((a) => a.localName === 'id')?.value;
      const rel = byTag(rels, 'Relationship').find((r) => r.getAttribute('Id') === rid);
      if (rel) target = rel.getAttribute('Target').replace(/^\/?xl\//, '').replace(/^\//, '');
    }
    const sst = (await read('xl/sharedStrings.xml')) ? byTag(xml(await read('xl/sharedStrings.xml')), 'si').map((si) => byTag(si, 't').map((t) => t.textContent).join('')) : [];
    const sheet = await read('xl/' + target); if (!sheet) throw new Error('The first sheet of this Excel file could not be read.');
    const colIdx = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
    const grid = [];
    for (const row of byTag(xml(sheet), 'row')) {
      const r = (+row.getAttribute('r') || grid.length + 1) - 1, out = [];
      for (const c of byTag(row, 'c')) {
        const t = c.getAttribute('t'), v = byTag(c, 'v')[0]?.textContent ?? '';
        let val = t === 's' ? sst[+v] ?? '' : t === 'inlineStr' ? byTag(c, 't').map((x) => x.textContent).join('') : t === 'b' ? (v === '1' ? 'Yes' : 'No') : v;
        if (!t && /^-?\d+\.\d{6,}$/.test(val)) val = String(+(+val).toFixed(6));
        out[colIdx(c.getAttribute('r') || '')] = val;
      }
      grid[r] = Array.from(out, (x) => x ?? '');
    }
    return fromGrid(Array.from(grid, (r) => r || []), `Excel · first sheet${sheets[0] ? ' “' + sheets[0].getAttribute('name') + '”' : ''}`);
  }
  async function readDocx(buf) {
    const read = await unzip(buf);
    const doc = await read('word/document.xml'); if (!doc) throw new Error('This does not look like a Word (.docx) file.');
    const tables = byTag(xml(doc), 'tbl').filter((t) => !byTag(t.parentNode, 'tbl').includes(t) || t.parentNode.localName === 'body');
    if (!tables.length) throw new Error('This Word file has no table in it. Put the member list in a table, or upload a PDF or Excel file.');
    const rowsOf = (t) => [...t.children].filter((x) => x.localName === 'tr').map((tr) => [...tr.children].filter((x) => x.localName === 'tc').map((tc) =>
      byTag(tc, 'p').map((p) => [...p.getElementsByTagName('*')].map((x) => (x.localName === 't' ? x.textContent : x.localName === 'tab' || x.localName === 'br' ? ' ' : '')).join('')).join(' ')));
    const all = tables.map(rowsOf).sort((a, b) => b.length - a.length);
    // tables that continue the biggest one with the same number of columns are joined to it
    const big = all[0], w = Math.max(...big.map((r) => r.length));
    const grid = tables.map(rowsOf).filter((t) => Math.max(...t.map((r) => r.length)) === w).flat();
    return fromGrid(grid, `Word · ${tables.length} table${tables.length > 1 ? 's' : ''}`);
  }
  function readCsv(text) {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/)[0] || '';
    const delim = [',', ';', '\t', '|'].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const grid = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); grid.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); grid.push(row); }
    return fromGrid(grid, 'CSV');
  }
  function fromGrid(grid, method) {
    grid = grid.map((r) => (r || []).map(clean));
    let hi = -1, hs = 0;
    grid.slice(0, 12).forEach((r, i) => { const s = headScore(r.join(' ')); if (s >= 1 && s > hs && r.filter(Boolean).length >= 2) { hs = s; hi = i; } });
    const width = Math.max(0, ...grid.map((r) => r.length));
    let columns, rows;
    if (hi >= 0) { columns = Array.from({ length: width }, (_, i) => grid[hi][i] || ''); rows = grid.slice(hi + 1); }
    else { columns = Array.from({ length: width }, () => ''); rows = grid; }
    rows = rows.map((r) => Array.from({ length: width }, (_, i) => r[i] || ''));
    const notes = hi < 0 ? ['No header row was found, so the columns are numbered. Rename them below, or use a row as the column names.'] : [];
    return { columns, rows, method: `${method} · ${width} columns`, notes };
  }

  /* ---------------------------------------------------------------- tidy up any table */
  function tidy(t) {
    let { columns, rows } = t;
    const hText = columns.join(' ');
    rows = rows.map((r) => r.map(clean)).filter((r) => r.some(Boolean))
      .filter((r) => !(headScore(r.join(' ')) >= 2 && similar(r.join(' '), hText) >= 0.6)); // repeated header rows
    // drop columns that are empty everywhere
    let keep = columns.map((c, i) => clean(c) || rows.some((r) => r[i]));
    columns = columns.filter((c, i) => keep[i]); rows = rows.map((r) => r.filter((c, i) => keep[i]));
    // neighbouring columns with the same name are parts of one field (e.g. three “Office Address” columns)
    const outC = [], groups = [];
    columns.forEach((c, i) => { const k = clean(c).toLowerCase(); if (k && outC.length && clean(outC[outC.length - 1]).toLowerCase() === k) groups[groups.length - 1].push(i); else { outC.push(clean(c)); groups.push([i]); } });
    rows = rows.map((r) => groups.map((g) => g.map((i) => r[i]).filter(Boolean).join(', ')));
    columns = outC.map((c, i) => c || `Column ${i + 1}`);
    return { ...t, columns, rows };
  }

  /* ---------------------------------------------------------------- column suggestions */
  const HI_PHRASES = [[/^(sl|sr|s)\.?\s*(no|number)\.?$|^serial( no\.?| number)?$|^#$/i, 'क्रम सं.'], [/^name of (the )?(member|firm|company|unit|organi[sz]ation|concern)$|^(member|firm|company)('s)? name$/i, 'सदस्य का नाम'],
    [/^(line|nature) of (business|manufacture|activity)/i, 'व्यवसाय'], [/^membership\s*(no|number)\.?$/i, 'सदस्यता सं.'], [/^contact person$/i, 'संपर्क व्यक्ति']];
  const HI_WORDS = { name: 'नाम', member: 'सदस्य', members: 'सदस्य', firm: 'फ़र्म', company: 'कंपनी', unit: 'इकाई', office: 'कार्यालय', factory: 'कारखाना', works: 'कारखाना', address: 'पता', city: 'शहर', town: 'नगर', district: 'ज़िला', pin: 'पिन', pincode: 'पिन कोड', state: 'राज्य',
    telephone: 'टेलीफ़ोन', phone: 'फ़ोन', tel: 'फ़ोन', mobile: 'मोबाइल', email: 'ईमेल', 'e-mail': 'ईमेल', mail: 'ईमेल', website: 'वेबसाइट', web: 'वेबसाइट', fax: 'फ़ैक्स', classification: 'वर्गीकरण', category: 'श्रेणी', sector: 'क्षेत्र', products: 'उत्पाद', product: 'उत्पाद',
    business: 'व्यवसाय', activity: 'गतिविधि', representative: 'प्रतिनिधि', residence: 'निवास', workshop: 'वर्कशॉप', whatsapp: 'व्हाट्सऐप', designation: 'पद', proprietor: 'स्वामी', director: 'निदेशक', partner: 'साझेदार', gst: 'जीएसटी', gstin: 'जीएसटीआईएन', id: 'आईडी', no: 'सं.', number: 'संख्या', year: 'वर्ष', type: 'प्रकार', remarks: 'टिप्पणी', service: 'सेवा', contact: 'संपर्क', registered: 'पंजीकृत', profession: 'पेशा' };
  function hindi(label) {
    const l = clean(label).replace(/e-mail/gi, 'email');
    for (const [re, hi] of HI_PHRASES) if (re.test(l)) return hi;
    let unknown = 0;
    const out = l.replace(/[A-Za-z]+/g, (w) => { const k = w.toLowerCase(); if (HI_WORDS[k]) return HI_WORDS[k]; if (/^(of|the|and|or|in|for)$/i.test(w)) return ''; unknown++; return w; }).replace(/\s+/g, ' ').replace(/\(\s*\)/g, '').trim();
    return unknown ? '' : out;
  }
  const PRIVATE = /resid|whats\s*app|aadha|\bpan\b|date of birth|\bdob\b|password|bank|account no/i;
  function describe(columns, rows) {
    const vals = (i) => rows.map((r) => r[i]).filter(Boolean);
    const isSerialCol = (i) => { const v = vals(i); return v.length > 2 && v.filter(isSerial).length >= v.length * 0.9 && (/^(sl|sr|s)\.?\s*(no|number)|serial|^#$|क्रम/i.test(columns[i]) || /^column/i.test(columns[i])); };
    const meta = columns.map((c, i) => ({ label: { en: c, hi: hindi(c) }, show: !isSerialCol(i) && !PRIVATE.test(c), use: '' }));
    let title = columns.findIndex((c, i) => /name|firm|company|member|organi[sz]ation|concern|\bunit\b/i.test(c) && !/represent|person|proprietor|director|partner|contact|no\.?$|number/i.test(c) && meta[i].show);
    if (title < 0) title = meta.findIndex((m) => m.show);
    if (title >= 0) meta[title].use = 'title';
    let filters = 0;
    columns.forEach((c, i) => {
      if (filters >= 2 || !meta[i].show || meta[i].use) return;
      const distinct = new Set(vals(i).map((v) => v.toLowerCase())).size;
      if (/classif|categor|sector|industry|district|city|town/i.test(c) && distinct >= 2 && distinct <= 60) { meta[i].use = 'filter'; filters++; }
    });
    return meta;
  }

  /* ---------------------------------------------------------------- entry point */
  async function read(file, progress) {
    const name = (file.name || '').toLowerCase(), buf = await file.arrayBuffer();
    const head4 = new Uint8Array(buf.slice(0, 4));
    const isPdf = name.endsWith('.pdf') || (head4[0] === 0x25 && head4[1] === 0x50 && head4[2] === 0x44 && head4[3] === 0x46);
    let t;
    if (isPdf) t = await readPdf(buf, progress);
    else if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) t = await readXlsx(buf);
    else if (name.endsWith('.docx')) t = await readDocx(buf);
    else if (name.endsWith('.csv') || name.endsWith('.txt')) t = readCsv(new TextDecoder().decode(buf));
    else if (name.endsWith('.xls') || name.endsWith('.doc')) throw new Error('This is an older Office file. Open it and use “Save as” to make a .xlsx (Excel) or .docx (Word) file, or save it as a PDF, then upload that.');
    else throw new Error('Please upload a PDF, an Excel (.xlsx), a Word (.docx) or a CSV file.');
    t = tidy(t);
    if (!t.rows.length) throw new Error('No member rows were found in this file.');
    return { ...t, meta: describe(t.columns, t.rows) };
  }
  window.MemberList = { read, describe, hindi, _test: { headScore, joinCell, tidy, fromGrid } };
})();

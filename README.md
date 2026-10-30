# Bihar Industries Association — website prototype

Prototype of a new website for Bihar Industries Association (BIA), prepared for review. **Not the official BIA website** (that is biabihar.com).

- **Public site:** `index.html` — bilingual (English / हिन्दी), light and dark mode, Policies & Updates library, fee calculator, and **Chanakya (चाणक्य)**, a question-and-answer guide that runs in the visitor's browser with no outside service or API.
- **Admin panel:** `admin.html` — edits every part of the site with a live preview. Changes show at once on the device where they are made; **Publish** commits them to this repository and GitHub Pages serves them to everyone in about a minute.

## How content works

Everything on the site comes from `content.json`. The admin panel edits it; photos and PDFs uploaded in the admin are committed to `uploads/`.

## Member directory

**Admin → Member directory** takes the member list as a PDF, Excel (.xlsx), Word (.docx) or CSV file. The file is read in the admin's own browser (PDF tables with or without ruled lines, wrapped cells and repeated headers on each page). The admin chooses which columns the public sees, checks the rows, and publishes. Only the shown columns are published, as `uploads/…-member-directory.json`; hidden columns never leave that computer. The original file is published only if “Let visitors download the original file” is switched on. A scanned PDF has no text to read, so it needs the Excel or Word file instead.

Publishing from the admin needs a GitHub fine-grained personal access token (Contents: Read and write, this repository only), pasted once in **Admin → Publish & backup**. The token is stored only in that browser.

## Files

| File | What it does |
|---|---|
| `index.html`, `site.css`, `site.js` | Public site |
| `bot.js` | Chanakya, the FAQ guide (matching runs in the browser) |
| `admin.html`, `admin.css`, `admin.js` | Admin panel and GitHub publishing |
| `members-read.js` | Admin only: reads a member list (PDF via pdf.js, Excel, Word, CSV) into a table |
| `common.js` | Shared: loading content, drafts saved on the device, uploads |
| `content.json` | All site content, in English and Hindi |
| `img/` | Photos of BIA events (from BIA's own website) |

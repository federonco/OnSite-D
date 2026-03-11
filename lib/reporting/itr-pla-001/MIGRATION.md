# ITR-PLA-001: React-PDF → Puppeteer Migration

## What was wrong before

- **React-PDF limitations**: Weak/inconsistent table borders, layout drift, compressed spacing
- **Poor grouped header structure**: Category row and column headers rendered with unstable proportions
- **Border rendering**: React-PDF produced weak or missing grid lines despite explicit styles
- **Notes pagination**: Third note often pushed to page 2
- **Low visual fidelity**: Output looked like a low-quality export vs. the target Google Sheets template

## Why Puppeteer is better here

- **HTML/CSS → PDF**: Uses real browser rendering; borders, tables, and print CSS behave as expected
- **`border-collapse: collapse`**: Produces clean single-line grid; no double borders or broken lines
- **Fixed layout control**: Explicit column widths, `table-layout: fixed`, deterministic spacing
- **Print-first**: CSS tuned for A4 landscape, no responsive layout assumptions
- **Grouped headers**: Native `<thead>`, `<colgroup>`, colspan for categories

## What was changed

1. **New pipeline**: `lib/reporting/itr-pla-001/`
   - `config.ts` – Layout constants, column widths, colors, headers
   - `mapper.ts` – Raw record → display value mapping
   - `template.ts` – HTML template with inline print CSS
   - `generate.ts` – Puppeteer PDF generation
   - `types.ts` – SectionInfo, RecordRow types

2. **Removed**: `lib/reporting/itr-pla-001-pdf.tsx` (React-PDF implementation)

3. **API routes** now import `generateITRPla001Pdf` from `@/lib/reporting/itr-pla-001`

## Layout specs (from target)

- A4 landscape (842×595 pt)
- 50pt margins
- Header: 4 rows (Doc No, Effective Date, Revision No, Page No) + title + logo
- PROJECT INFORMATION: white bg, black text, 2×2 grid
- PIPE RECORDS: white bg, black text
- Category row: blue #1155CC, white text
- Column headers: blue #1155CC, white text, 14 columns
- Asterisk row: grey #D9D9D9
- Data rows: 24.7pt height, white bg
- Notes: 38pt gap above, 7.9pt font

## Single-page fit refinements

Vertical spacing reductions applied to fit full report (9 rows + notes) on one A4 landscape page:

- Header: row min-height 10→7pt, padding 2→1pt, font 7.9→7.5pt, logo 26→22pt
- Section margins: 6→4pt throughout
- Project info: padding 4→2pt, min-height 10→8pt
- Table: cell padding 4→2pt, category/asterisk row padding 1pt
- Column headers: font 5→4.5pt
- Data cells: font 7.1→7pt, line-height 1.15
- Notes: margin-top 38→14pt, font 7.9→6.8pt, line-height 1.15, p margins 0 0 2pt
- Page margins: 50→48pt
- Puppeteer: scale 0.98 as final tweak

## Page numbering

Page No shows **"1 of 1"** for completed ITRs and **"In Progress"** for open ITRs. Each generated PDF is a single physical page; the label reflects actual PDF page count, not ITR batch index.

## Single-page threshold

| Rows | Result |
|------|--------|
| 1–9  | Fits on one page; notes on same page |
| 10+  | Overflow; table extends to page 2. Headers repeat via `thead { display: table-header-group }`. Notes may move to page 2 |

**Max rows for single-page mode:** 9 (ITR_PAGE_SIZE).

**What causes overflow first:** Extra data rows. Each row adds ~22pt; 10 rows add ~22pt beyond available space.

**10+ rows:** The API slices to 9 rows per ITR, so the generator never receives >9 rows. If given 10+ rows directly, content will overflow; `thead` repeats on page 2.

## Layout stability

- **NAME / SIGNATURE columns:** `overflow: hidden`, `text-overflow: ellipsis` on all data cells. Long names clip with ellipsis.
- **Notes:** `page-break-before: avoid` keeps them attached; with 9 rows they stay on page 1.
- **Table breaks:** `page-break-inside: avoid` on `.table-wrap` discourages mid-table breaks; `thead` repeats if break occurs.

## Serverless PDF generation (puppeteer-core + @sparticuz/chromium)

**Why standard Puppeteer fails in production:** Full `puppeteer` bundles and expects a local Chrome installation. In Vercel/serverless, there is no filesystem Chrome; the API fails with "Could not find Chrome (ver. X)".

**Why puppeteer-core + @sparticuz/chromium is required:**
- `puppeteer-core` does not download Chromium; you supply `executablePath`
- `@sparticuz/chromium` provides a Chromium binary optimized for serverless (Vercel, AWS Lambda)
- In production, `chromium.executablePath()` returns the path to the bundled binary
- In local dev, set `CHROME_EXECUTABLE_PATH` in `.env.local` to use system Chrome, or let `@sparticuz/chromium` download on first run

**Environment notes:**
- **Vercel:** Works out of the box with `puppeteer-core` + `@sparticuz/chromium`
- **Local dev:** Optional `CHROME_EXECUTABLE_PATH` (e.g. `C:\Program Files\Google\Chrome\Application\chrome.exe`) for faster startup

## Known limitations
- **Fonts**: Uses system Arial; for exact target match, add `@font-face` with Arimo/Arial.
- **Multi-page**: API enforces 9 rows per PDF; multi-page output is not generated.

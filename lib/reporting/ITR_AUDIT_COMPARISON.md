# ITR vs Audit Report Flow Comparison

## Root cause

**Audit report** uses **React-PDF** (`renderToBuffer`) — no browser, pure Node.js. Works in Vercel serverless.

**ITR report** used **Puppeteer + @sparticuz/chromium** — launches headless browser. Fails in Vercel (binary not found, memory limits, cold start).

## Differences

| Aspect | Audit (works) | ITR (was failing) |
|--------|---------------|-------------------|
| PDF engine | @react-pdf/renderer | puppeteer-core + @sparticuz/chromium |
| Browser | None | Headless Chromium |
| Serverless | ✅ Yes | ❌ No (Chrome binary, ~1500MB RAM) |
| Route payload | sectionId, recipientEmail | sectionId, itrIndex, recipientEmail |
| Data | section + records (all) | section + pageRecords (sliced by ITR) |
| Attachment | buffer + fileName | buffer + fileName |
| Email infra | Same (createEmailTransporter, etc.) | Same |

## Fix applied

Switched ITR PDF generation from Puppeteer to **React-PDF** (same as audit). Added `generateITRPla001PdfReact` in `lib/reporting/itr-pla-001-react-pdf.tsx`. Both email route and direct PDF route now use it.

## Logs added

- **Email route**: start, parsed payload, before/after PDF (with buffer size, fileName), before/after sendMail, full error stack
- **React-PDF generator**: start (data received), after renderToBuffer (buffer size)

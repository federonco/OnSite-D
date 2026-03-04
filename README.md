# OnSite-D (Drainer Lodge)

Pipe laying inspection and ITR reporting for drainage works.

## Setup

1. Copy `.env.local.example` to `.env.local`
2. Configure:
   - `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY` — For server-side operations
   - `NEXT_PUBLIC_SITE_URL` — Site URL for auth redirects (e.g. `https://on-site-d.vercel.app` or `http://localhost:3000`)
   - `ADMIN_EMAIL_ALLOWLIST` — Comma-separated admin emails
   - `GEMINI_API_KEY` — For AI insight (optional)
3. Run `npm install` then `npm run dev`

## Features

- **Lodge** — Record pipe installations (section, chainage, pipe ID, joint type, deflection, etc.)
- **AI Insight** — Optional Gemini evaluation for deflection
- **Admin** — Section management, record view, ITR-PLA-001 report generation
- **Audit Report** — Raw records PDF per section

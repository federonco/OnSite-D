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
   - `ALERT_EMAIL` — Recipient for checkpoint proximity alerts
   - `RESEND_API_KEY` — For sending emails (Resend SMTP)
   - `RESEND_FROM` — Sender address (default: `OnSite-D <info@readx.com.au>`). Domain must be verified in [Resend](https://resend.com/domains).
   - `GEMINI_API_KEY` — For AI insight (optional)
3. Run the checkpoints migration in Supabase SQL editor: `supabase/migrations/20250305000000_create_checkpoints.sql`
4. Run `npm install` then `npm run dev`

## Features

- **Lodge** — Record pipe installations (section, chainage, pipe ID, joint type, deflection, etc.)
- **AI Insight** — Optional Gemini evaluation for deflection
- **Admin** — Section management, record view, ITR-PLA-001 report generation
- **Checkpoints** — Preload points of interest; receive email alerts when installation approaches (≤24 m)
- **Notifications** — View missed checkpoint alerts (checkpoints passed without notification)
- **Audit Report** — Raw records PDF per section

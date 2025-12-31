Legacy MPLS Astro Site
======================

This is a modern Astro rebuild of the legacy `mp.ls` site, preserving the original look while adding a working guestbook, admin tools, and restored legacy pages.

What's inside
-------------
- Astro 4 project with legacy pages preserved.
- Static assets in `public/`.
- Guestbook with reCAPTCHA v2 and moderation, plus an admin UI.
- Supabase setup docs/scripts included for optional backend workflows.

Requirements
------------
- Node.js 18+ (recommended).

Setup
-----
1) Install dependencies:
   - `npm install`

2) Create `.env`:
   - `PUBLIC_RECAPTCHA_SITE_KEY=...`
   - `RECAPTCHA_SECRET_KEY=...`
   - `ADMIN_PASSWORD=...`
   - `ADMIN_SESSION_SECRET=...` (random, keep private)
   - Optional: `OPENAI_API_KEY=...` (for moderation; without it, posts go to pending)

3) Run the dev server:
   - `npm run dev`

Build and preview
-----------------
- `npm run build`
- `npm run preview`

Astro output mode
-----------------
This project uses `output: "hybrid"` in `astro.config.mjs` so API routes work. If you change output mode, the admin and guestbook APIs will break.

Guestbook
---------
Public page:
- `/guestbook/`

Data storage:
- `data/guestbook/seed.json` (original records, committed)
- `data/guestbook/approved.json` (runtime, ignored by git)
- `data/guestbook/pending.json` (runtime, ignored by git)

Moderation:
- reCAPTCHA v2 required.
- OpenAI moderation is optional; if missing, submissions go to pending.
- Filter config in `data/guestbook/config.json` (runtime).
- Example config: `data/guestbook/config.example.json`.

Admin
-----
Login page:
- `/admin`

Guestbook admin:
- `/admin/guestbook/`

Admin controls:
- Approve/reject pending entries.
- Edit/delete approved entries.
- Update filter settings (banned terms, max lengths, link limits).

Supabase setup
-------------
If you're using Supabase, the setup docs and scripts are included:
- `SUPABASE_SETUP.md`
- `supabase-schema.sql`
- `run-migration.js`

Follow `SUPABASE_SETUP.md` to apply the schema and run migrations. If you are not using Supabase, these files can be ignored.

Deployment notes
----------------
- Ensure environment variables are configured in your host (reCAPTCHA + admin secrets).
- `data/guestbook/approved.json` and `data/guestbook/pending.json` must be writable at runtime.

Security
--------
- Do not commit `.env`.
- Set a strong `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET`.

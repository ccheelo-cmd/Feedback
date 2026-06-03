# Feedback Form Collector

A styled feedback form for the **Analysts of Arcadius (C4)** program review, deployed on
[Vercel](https://vercel.com) with submissions stored in [Supabase](https://supabase.com).

## How it works

- `index.html` — the feedback form, served as a static page at `/`.
- `api/submit.js` — serverless function handling `POST /api/submit`; saves each review to Supabase.
- `api/responses.js` — serverless function backing `/responses` (HTML) and `/responses.json` (raw data).
- `lib/reviews.js` — shared Supabase logic used by both functions.
- `vercel.json` — rewrites `/responses` and `/responses.json` to the responses function.

## Routes

| Route             | Purpose                                  |
| ----------------- | ---------------------------------------- |
| `/`               | The feedback form                        |
| `/responses`      | Human-readable list of all submissions   |
| `/responses.json` | Raw JSON of all submissions              |

> Note: `/responses` and `/responses.json` are **public** — anyone with the link can view
> submitted names, emails, and scores.

## Supabase setup

The `reviews` table is already created (see `supabase.sql`):

```sql
create table if not exists public.reviews (
  id bigint generated always as identity primary key,
  review jsonb not null,
  created_at timestamptz not null default now()
);
```

## Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (for Production,
Preview, and Development):

- `SUPABASE_URL` — `https://oixbfqyfiyiyzeigngqr.supabase.co`
- `SUPABASE_KEY` — your Supabase **service-role** key (server-side only — never expose to the browser)

For local testing with `vercel dev`, copy `.env.example` to `.env` and fill in the same values.

## Deploy

1. Push to GitHub (already configured: `ccheelo-cmd/Feedback`).
2. In Vercel, **Import Project** from this repo.
3. Add the environment variables above.
4. Deploy. The form is live at your Vercel URL; submissions appear at `/responses`.

## Local development (optional)

```bash
npm install
npm i -g vercel        # if not already installed
vercel dev             # serves index.html + the /api functions locally
```

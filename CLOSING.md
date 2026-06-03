# Project Closeout — Feedback Form

Status as of **2026-06-03**: complete and live on Vercel. This note captures everything
needed to pick the project back up later.

## What it is

An end-of-cohort program review form for **Analysts of Arcadius (C4)**. Respondents fill in
a styled form; submissions are stored in Supabase; a public page aggregates the results.

## Architecture (Vercel serverless + static)

```
index.html          Feedback form (static, served at /)
api/submit.js        POST /api/submit  — save or update a review
api/lookup.js        GET  /api/lookup?name=  — fetch a prior review to pre-fill the form
api/responses.js     GET — backs /responses (HTML) and /responses.json (raw)
lib/reviews.js        Shared Supabase logic: save/load, name matching, results rendering
vercel.json           Rewrites /responses and /responses.json to api/responses
supabase.sql          Table schema (already applied)
package.json          ESM, Node >=18, only dependency is @supabase/supabase-js
```

There is intentionally **no local server** — Vercel serves the static file and the functions.
For local work, use `vercel dev` (loads `.env` and runs the functions with production routing).

## Routes

| Route             | Purpose                                            |
| ----------------- | -------------------------------------------------- |
| `/`               | The feedback form                                  |
| `/responses`      | Aggregated results — one section per question      |
| `/responses.json` | Raw JSON of every submission                       |

Both `/responses` routes are **public by deliberate choice** (no auth gate).

## Data model

- Supabase table `public.reviews`: `id` (identity PK), `review` (jsonb), `created_at` (timestamptz).
- The whole review object lives in the `review` jsonb column. See the payload shape built in
  `index.html` (the `review = { ... }` object in the submit handler) — `lib/reviews.js` mirrors it.
- `submittedAt` is stamped **server-side on every save**, so it represents *last updated*.

## Key behaviors / decisions

- **Edit / upsert by name.** Submissions are keyed by name. Resubmitting updates the existing row
  instead of creating a duplicate.
- **Name matching is token-based.** Entering *any* part of a previously used name matches the same
  person (first names are unique in the cohort). The fuller stored name is preserved if only part
  is re-entered; single-letter initials are ignored.
- **Prefill.** Entering a name auto-loads that person's previous answers and shows a banner; the
  thank-you screen has an "Edit my response" button.
- **Results page** shows total responses, per-question sections, scale-question averages with a
  click-to-expand breakdown (who gave what grade), choice/multi distributions, and all free-text
  answers.

## Environment variables (set in Vercel → Settings → Environment Variables)

- `SUPABASE_URL` — `https://oixbfqyfiyiyzeigngqr.supabase.co`
- `SUPABASE_KEY` — Supabase **service-role** key (server-side only; never exposed to the browser)

Locally these live in `.env` (gitignored). `.env.example` is the template.

## How to deploy / redeploy

Pushing to `master` on GitHub (`ccheelo-cmd/Feedback`) triggers a Vercel deploy automatically.

## If picking back up — possible next steps

- **Protect `/responses`** with a password/secret if it should stop being public.
- **Enable RLS** on the `reviews` table (currently relies on the service-role key bypassing it).
- **Key on email instead of name** if name collisions ever become a concern, or add a unique
  constraint / `updated_at` column in Postgres for a stricter data model.
- **Export to CSV** for the results page if leads want spreadsheets.

## Testing notes

There's no test runner wired up; changes to `lib/reviews.js` were validated with throwaway
`node --check` + small smoke scripts (matching logic, average computation, HTML rendering).
Browser-side form behavior (prefill, edit) was confirmed manually on the live site.

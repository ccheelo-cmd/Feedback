# Feedback Form Collector

This folder now contains a styled feedback form and a lightweight Node backend that saves all submitted reviews to `responses.json`.

## How to run

1. Open a terminal in `c:\Users\ccheelo\Downloads\Feedback form`
2. Run `npm install`
3. Create a `.env` file in the same folder with:
   - `SUPABASE_URL=https://oixbfqyfiyiyzeigngqr.supabase.co`
   - `SUPABASE_KEY=<your-service-role-key>`
4. Run `node server.js`
5. Share this link for the form:
   - `http://localhost:3000`
6. View collected answers as a link:
   - `http://localhost:3000/responses`
   - Raw JSON data is also available at `http://localhost:3000/responses.json`

You can copy `.env.example` and replace the placeholder values.

## Supabase setup

Create a table in Supabase named `reviews` with these columns:
- `id` — `bigint`, primary key, auto-increment
- `review` — `jsonb`
- `created_at` — `timestamp with time zone`, default `now()`

Then configure your environment:

```powershell
$env:SUPABASE_URL = 'https://your-project.supabase.co'
$env:SUPABASE_KEY = 'your-anon-or-service-key'
```

If you do not provide Supabase credentials, the app will fall back to local storage in `responses.json`.

## Notes

- `arcadius-c4-program-review.html` is served by `server.js`
- `/submit` saves reviews to Supabase when configured
- `/responses` reads live data from Supabase or from `responses.json` as a fallback
- `/responses.json` returns the same list in JSON format

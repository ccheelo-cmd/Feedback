-- Create the reviews table for the feedback form
create table if not exists public.reviews (
  id bigint generated always as identity primary key,
  review jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_reviews_created_at
  on public.reviews (created_at desc);

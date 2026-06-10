create table if not exists valuation_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  auth_user_id text,
  auth_email text,
  valuation_year integer not null default extract(year from now())::integer,
  input jsonb not null,
  auth_user jsonb not null default '{}'::jsonb,
  valuation jsonb not null,
  status text not null default 'new',
  notes text not null default '',
  owner_adjustment jsonb not null default '{}'::jsonb
);

alter table valuation_leads
add column if not exists auth_user jsonb not null default '{}'::jsonb;

alter table valuation_leads
add column if not exists owner_adjustment jsonb not null default '{}'::jsonb;

alter table valuation_leads
add column if not exists auth_user_id text;

alter table valuation_leads
add column if not exists auth_email text;

alter table valuation_leads
add column if not exists valuation_year integer not null default extract(year from now())::integer;

create index if not exists valuation_leads_created_at_idx
on valuation_leads (created_at desc);

create index if not exists valuation_leads_status_idx
on valuation_leads (status);

create index if not exists valuation_leads_user_year_idx
on valuation_leads (auth_user_id, valuation_year);

create table if not exists valuation_user_limits (
  user_id text not null,
  email text not null default '',
  valuation_year integer not null,
  annual_limit integer not null default 3,
  updated_at timestamptz not null default now(),
  primary key (user_id, valuation_year)
);

create index if not exists valuation_user_limits_email_idx
on valuation_user_limits (email);

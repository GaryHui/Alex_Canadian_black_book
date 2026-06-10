create table if not exists valuation_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  input jsonb not null,
  auth_user jsonb not null default '{}'::jsonb,
  valuation jsonb not null,
  status text not null default 'new',
  notes text not null default ''
);

create index if not exists valuation_leads_created_at_idx
on valuation_leads (created_at desc);

create index if not exists valuation_leads_status_idx
on valuation_leads (status);

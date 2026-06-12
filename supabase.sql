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

alter table valuation_leads
add column if not exists assigned_to text not null default '';

alter table valuation_leads
add column if not exists priority text not null default 'normal';

alter table valuation_leads
add column if not exists next_follow_up_at timestamptz;

alter table valuation_leads
add column if not exists last_activity_at timestamptz;

create index if not exists valuation_leads_created_at_idx
on valuation_leads (created_at desc);

create index if not exists valuation_leads_status_idx
on valuation_leads (status);

create index if not exists valuation_leads_assigned_to_idx
on valuation_leads (assigned_to);

create index if not exists valuation_leads_next_follow_up_idx
on valuation_leads (next_follow_up_at);

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

create table if not exists dealer_staff (
  email text primary key,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table dealer_staff
add column if not exists active boolean not null default true;

alter table dealer_staff
add column if not exists created_by text;

alter table dealer_staff
add column if not exists created_at timestamptz not null default now();

alter table dealer_staff
add column if not exists updated_at timestamptz not null default now();

create index if not exists dealer_staff_active_idx
on dealer_staff (active);

create table if not exists lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references valuation_leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  author_email text not null default '',
  note_type text not null default 'internal',
  note text not null
);

create index if not exists lead_notes_lead_created_idx
on lead_notes (lead_id, created_at desc);

create table if not exists lead_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references valuation_leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  assigned_to text not null default '',
  title text not null,
  due_at timestamptz,
  completed_at timestamptz
);

create index if not exists lead_tasks_lead_due_idx
on lead_tasks (lead_id, due_at);

create index if not exists lead_tasks_assigned_due_idx
on lead_tasks (assigned_to, due_at);

create table if not exists lead_emails (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references valuation_leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  sent_by text not null default '',
  sent_to text not null default '',
  subject text not null default '',
  body text not null default '',
  provider_message_id text not null default '',
  status text not null default 'sent'
);

create index if not exists lead_emails_lead_created_idx
on lead_emails (lead_id, created_at desc);

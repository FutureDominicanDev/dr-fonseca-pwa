-- Dr. Fonseca PWA
-- Phase 5 Step 1: patient "Necesito ayuda" alerts.
-- Run in Supabase SQL Editor before testing patient alerts.

create extension if not exists "uuid-ossp";

create table if not exists public.patient_alerts (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  chat_id uuid not null references public.rooms(id) on delete cascade,
  status text not null default 'pending',
  escalation_level integer not null default 1,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

alter table public.patient_alerts
  add column if not exists patient_id uuid not null references public.patients(id) on delete cascade;

alter table public.patient_alerts
  add column if not exists chat_id uuid not null references public.rooms(id) on delete cascade;

alter table public.patient_alerts
  add column if not exists status text not null default 'pending';

alter table public.patient_alerts
  add column if not exists escalation_level integer not null default 1;

alter table public.patient_alerts
  add column if not exists created_at timestamptz not null default now();

alter table public.patient_alerts
  add column if not exists acknowledged_at timestamptz;

alter table public.patient_alerts
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'patient_alerts_escalation_level_check'
  ) then
    alter table public.patient_alerts
      add constraint patient_alerts_escalation_level_check
      check (escalation_level between 1 and 3)
      not valid;
  end if;
end $$;

create index if not exists patient_alerts_chat_id_idx
  on public.patient_alerts(chat_id);

create index if not exists patient_alerts_patient_id_idx
  on public.patient_alerts(patient_id);

create index if not exists patient_alerts_pending_escalation_idx
  on public.patient_alerts(status, acknowledged_at, created_at, escalation_level)
  where status = 'pending' and acknowledged_at is null;

alter table public.media_notifications
  add column if not exists chat_id uuid references public.rooms(id) on delete cascade;

alter table public.media_notifications
  add column if not exists type text;

create index if not exists media_notifications_chat_id_idx
  on public.media_notifications(chat_id);

create or replace function public.escalate_pending_alerts()
returns table (
  id uuid,
  chat_id uuid,
  patient_id uuid,
  previous_escalation_level integer,
  escalation_level integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select
      pa.id,
      pa.chat_id,
      pa.patient_id,
      greatest(1, least(coalesce(pa.escalation_level, 1), 3))::integer as previous_escalation_level
    from public.patient_alerts pa
    where pa.status = 'pending'
      and pa.acknowledged_at is null
      and pa.created_at < now() - interval '2 minutes'
      and greatest(1, least(coalesce(pa.escalation_level, 1), 3)) < 3
    for update skip locked
  ),
  updated as (
    update public.patient_alerts pa
    set
      escalation_level = least(c.previous_escalation_level + 1, 3),
      updated_at = now()
    from candidates c
    where pa.id = c.id
      and pa.status = 'pending'
      and pa.acknowledged_at is null
    returning
      pa.id,
      pa.chat_id,
      pa.patient_id,
      c.previous_escalation_level,
      pa.escalation_level
  )
  select
    updated.id,
    updated.chat_id,
    updated.patient_id,
    updated.previous_escalation_level,
    updated.escalation_level
  from updated
  where updated.escalation_level > updated.previous_escalation_level;
end;
$$;

-- Manual test:
-- 1. Replace the UUIDs below with a real patient id and room id.
-- insert into public.patient_alerts (patient_id, chat_id, status, escalation_level, created_at)
-- values ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'pending', 1, now() - interval '3 minutes');
--
-- 2. Run:
-- select * from public.escalate_pending_alerts();
--
-- 3. Verify escalation_level increased by one and never exceeds 3:
-- select id, status, escalation_level, acknowledged_at, created_at, updated_at
-- from public.patient_alerts
-- order by created_at desc
-- limit 5;

do $$
begin
  alter publication supabase_realtime add table public.patient_alerts;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';

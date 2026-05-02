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

create index if not exists patient_alerts_chat_id_idx
  on public.patient_alerts(chat_id);

create index if not exists patient_alerts_patient_id_idx
  on public.patient_alerts(patient_id);

alter table public.media_notifications
  add column if not exists chat_id uuid references public.rooms(id) on delete cascade;

alter table public.media_notifications
  add column if not exists type text;

create index if not exists media_notifications_chat_id_idx
  on public.media_notifications(chat_id);

do $$
begin
  alter publication supabase_realtime add table public.patient_alerts;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';

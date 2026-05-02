-- Dr. Fonseca PWA
-- Live schema reconciliation for current production app.
-- Run this once in Supabase SQL Editor if schema checks show missing live columns/tables.

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = lower(u.email)
from auth.users u
where p.id = u.id
  and p.email is null
  and u.email is not null;

alter table public.rooms
  add column if not exists patient_access_token text;

create unique index if not exists rooms_patient_access_token_key
  on public.rooms(patient_access_token)
  where patient_access_token is not null;

create index if not exists rooms_patient_access_token_idx
  on public.rooms(patient_access_token);

create table if not exists public.media_uploads (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  staff_name text,
  type text,
  url text not null,
  created_at timestamptz not null default now()
);

alter table public.media_uploads
  add column if not exists patient_id uuid references public.patients(id) on delete cascade;

alter table public.media_uploads
  add column if not exists room_id uuid references public.rooms(id) on delete cascade;

alter table public.media_uploads
  add column if not exists message_id uuid references public.messages(id) on delete set null;

alter table public.media_uploads
  add column if not exists uploaded_by uuid references public.profiles(id) on delete set null;

alter table public.media_uploads
  add column if not exists staff_name text;

alter table public.media_uploads
  add column if not exists type text;

alter table public.media_uploads
  add column if not exists url text;

alter table public.media_uploads
  add column if not exists created_at timestamptz not null default now();

create index if not exists media_uploads_patient_id_idx
  on public.media_uploads(patient_id);

create index if not exists media_uploads_room_id_idx
  on public.media_uploads(room_id);

create index if not exists media_uploads_message_id_idx
  on public.media_uploads(message_id);

create index if not exists media_uploads_uploaded_by_idx
  on public.media_uploads(uploaded_by);

alter table public.media_notifications
  add column if not exists patient_id uuid references public.patients(id) on delete cascade;

alter table public.media_notifications
  add column if not exists staff_id uuid references public.profiles(id) on delete cascade;

alter table public.media_notifications
  add column if not exists message text;

alter table public.media_notifications
  add column if not exists seen boolean not null default false;

create index if not exists media_notifications_staff_id_seen_idx
  on public.media_notifications(staff_id, seen);

create index if not exists media_notifications_patient_id_idx
  on public.media_notifications(patient_id);

notify pgrst, 'reload schema';

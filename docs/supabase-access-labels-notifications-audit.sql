-- Dr. Fonseca PWA
-- Future access requests, labels, media notifications, and audit logs.
-- Ejecuta este archivo en Supabase SQL Editor cuando se apruebe activar estas funciones.

create table if not exists public.staff_access_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  target_staff_id uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending',
  reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.staff_access_requests
  add column if not exists patient_id uuid references public.patients(id) on delete cascade;

alter table public.staff_access_requests
  add column if not exists target_staff_id uuid references public.profiles(id) on delete cascade;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'staff_access_requests'
      and column_name = 'requested_staff_id'
  ) then
    alter table public.staff_access_requests
      alter column requested_staff_id drop not null;
  end if;
end $$;

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text,
  description text,
  scope text not null default 'patient',
  patient_id uuid references public.patients(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_notifications (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  media_type text not null,
  recipient_id uuid references public.profiles(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  status text not null default 'unread',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_id text,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  actor_email text,
  patient_id uuid references public.patients(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  alter table public.staff_access_requests
    drop constraint if exists staff_access_requests_status_check;

  alter table public.staff_access_requests
    add constraint staff_access_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'cancelled'));
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'labels_scope_check'
  ) then
    alter table public.labels
      add constraint labels_scope_check
      check (scope in ('patient', 'room', 'media'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'media_notifications_status_check'
  ) then
    alter table public.media_notifications
      add constraint media_notifications_status_check
      check (status in ('unread', 'read', 'dismissed'));
  end if;
end $$;

drop index if exists public.staff_access_requests_pending_unique_idx;

create unique index staff_access_requests_pending_unique_idx
  on public.staff_access_requests(room_id, target_staff_id)
  where status = 'pending';

create index if not exists staff_access_requests_room_id_idx
  on public.staff_access_requests(room_id);

create index if not exists staff_access_requests_patient_id_idx
  on public.staff_access_requests(patient_id);

create index if not exists staff_access_requests_target_staff_id_idx
  on public.staff_access_requests(target_staff_id);

create index if not exists labels_patient_id_idx
  on public.labels(patient_id);

create index if not exists labels_room_id_idx
  on public.labels(room_id);

create index if not exists media_notifications_recipient_id_idx
  on public.media_notifications(recipient_id);

create index if not exists media_notifications_room_id_idx
  on public.media_notifications(room_id);

create index if not exists media_notifications_message_id_idx
  on public.media_notifications(message_id);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs(created_at desc);

create index if not exists audit_logs_actor_id_idx
  on public.audit_logs(actor_id);

create index if not exists audit_logs_patient_id_idx
  on public.audit_logs(patient_id);

create index if not exists audit_logs_room_id_idx
  on public.audit_logs(room_id);

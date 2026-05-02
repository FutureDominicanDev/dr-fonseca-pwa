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
  add column if not exists room_id uuid references public.rooms(id) on delete cascade;

alter table public.staff_access_requests
  add column if not exists patient_id uuid references public.patients(id) on delete cascade;

alter table public.staff_access_requests
  add column if not exists target_staff_id uuid references public.profiles(id) on delete cascade;

alter table public.staff_access_requests
  add column if not exists requested_by uuid references public.profiles(id) on delete set null;

alter table public.staff_access_requests
  add column if not exists status text not null default 'pending';

alter table public.staff_access_requests
  add column if not exists reason text;

alter table public.staff_access_requests
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

alter table public.staff_access_requests
  add column if not exists reviewed_at timestamptz;

alter table public.staff_access_requests
  add column if not exists created_at timestamptz not null default now();

alter table public.staff_access_requests
  add column if not exists updated_at timestamptz not null default now();

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
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  name_es text,
  name_en text,
  color text,
  description text,
  scope text not null default 'patient',
  patient_id uuid references public.patients(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.patients
  add column if not exists labels jsonb default '{}'::jsonb;

update public.patients
set labels = '{}'::jsonb
where labels is null;

alter table public.patients
  alter column labels set default '{}'::jsonb;

alter table public.patients
  alter column labels set not null;

alter table public.labels
  add column if not exists user_id uuid references public.profiles(id) on delete cascade;

alter table public.labels
  add column if not exists name text;

alter table public.labels
  add column if not exists name_es text;

alter table public.labels
  add column if not exists name_en text;

alter table public.labels
  add column if not exists color text;

alter table public.labels
  add column if not exists description text;

alter table public.labels
  add column if not exists scope text not null default 'patient';

alter table public.labels
  add column if not exists patient_id uuid references public.patients(id) on delete cascade;

alter table public.labels
  add column if not exists room_id uuid references public.rooms(id) on delete cascade;

alter table public.labels
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.labels
  add column if not exists created_at timestamptz not null default now();

alter table public.labels
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.media_notifications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  media_type text not null,
  staff_id uuid references public.profiles(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  message text,
  seen boolean not null default false,
  status text not null default 'unread',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.media_notifications
  add column if not exists patient_id uuid references public.patients(id) on delete cascade;

alter table public.media_notifications
  add column if not exists room_id uuid references public.rooms(id) on delete cascade;

alter table public.media_notifications
  add column if not exists message_id uuid references public.messages(id) on delete cascade;

alter table public.media_notifications
  add column if not exists media_type text;

alter table public.media_notifications
  add column if not exists staff_id uuid references public.profiles(id) on delete cascade;

alter table public.media_notifications
  add column if not exists recipient_id uuid references public.profiles(id) on delete cascade;

alter table public.media_notifications
  add column if not exists sender_id uuid references public.profiles(id) on delete set null;

alter table public.media_notifications
  add column if not exists message text;

alter table public.media_notifications
  add column if not exists seen boolean not null default false;

alter table public.media_notifications
  add column if not exists status text not null default 'unread';

alter table public.media_notifications
  add column if not exists read_at timestamptz;

alter table public.media_notifications
  add column if not exists created_at timestamptz not null default now();

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

alter table public.audit_logs
  add column if not exists action text;

alter table public.audit_logs
  add column if not exists entity_type text;

alter table public.audit_logs
  add column if not exists entity_id text;

alter table public.audit_logs
  add column if not exists actor_id uuid references public.profiles(id) on delete set null;

alter table public.audit_logs
  add column if not exists actor_name text;

alter table public.audit_logs
  add column if not exists actor_email text;

alter table public.audit_logs
  add column if not exists patient_id uuid references public.patients(id) on delete set null;

alter table public.audit_logs
  add column if not exists room_id uuid references public.rooms(id) on delete set null;

alter table public.audit_logs
  add column if not exists metadata jsonb;

alter table public.audit_logs
  add column if not exists created_at timestamptz not null default now();

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

create index if not exists labels_user_id_idx
  on public.labels(user_id);

create index if not exists labels_room_id_idx
  on public.labels(room_id);

create index if not exists patients_labels_idx
  on public.patients using gin(labels);

create index if not exists media_notifications_recipient_id_idx
  on public.media_notifications(recipient_id);

create index if not exists media_notifications_staff_id_seen_idx
  on public.media_notifications(staff_id, seen);

create index if not exists media_notifications_patient_id_idx
  on public.media_notifications(patient_id);

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

-- Dr. Fonseca PWA
-- Configuracion inicial para panel admin, sedes del staff y trazabilidad de exportaciones.
-- Ejecuta este archivo en Supabase SQL Editor.

-- 1) Campos nuevos en profiles para permisos y sede del staff
alter table public.profiles
  add column if not exists office_location text;

alter table public.profiles
  add column if not exists admin_level text not null default 'none';

-- 2) Campos nuevos en patients para controlar el ciclo de vida del expediente
alter table public.patients
  add column if not exists record_status text not null default 'active';

alter table public.patients
  add column if not exists record_status_changed_at timestamptz;

alter table public.patients
  add column if not exists record_status_changed_by uuid references public.profiles(id);

-- 3) Campo nuevo en messages para congelar la sede del remitente al momento de enviar
alter table public.messages
  add column if not exists sender_office text;

-- 4) Tabla de auditoria para cambios administrativos
create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_id text,
  entity_name text,
  patient_id uuid references public.patients(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  actor_email text,
  notes text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- 5) Constraints suaves para mantener consistencia
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_office_location_check'
  ) then
    alter table public.profiles
      add constraint profiles_office_location_check
      check (office_location in ('Guadalajara', 'Tijuana') or office_location is null);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'patients_record_status_check'
  ) then
    alter table public.patients
      add constraint patients_record_status_check
      check (record_status in ('active', 'archived', 'trash'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_admin_level_check'
  ) then
    alter table public.profiles
      add constraint profiles_admin_level_check
      check (admin_level in ('owner', 'super_admin', 'admin', 'none'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_sender_office_check'
  ) then
    alter table public.messages
      add constraint messages_sender_office_check
      check (sender_office in ('Guadalajara', 'Tijuana') or sender_office is null);
  end if;
end $$;

-- 6) Indices utiles para panel y exportaciones
create index if not exists profiles_admin_level_idx on public.profiles(admin_level);
create index if not exists profiles_office_location_idx on public.profiles(office_location);
create index if not exists patients_record_status_idx on public.patients(record_status);
create index if not exists messages_sender_office_idx on public.messages(sender_office);
create index if not exists procedures_patient_id_idx on public.procedures(patient_id);
create index if not exists rooms_procedure_id_idx on public.rooms(procedure_id);
create index if not exists messages_room_id_idx on public.messages(room_id);
create index if not exists admin_audit_events_created_at_idx on public.admin_audit_events(created_at desc);
create index if not exists admin_audit_events_patient_id_idx on public.admin_audit_events(patient_id);
create index if not exists admin_audit_events_entity_type_idx on public.admin_audit_events(entity_type);

-- 7) Bootstrap owner actual del proyecto
update public.profiles
set admin_level = 'owner'
where id in (
  select id
  from auth.users
  where lower(email) = 'mrdiazsr@icloud.com'
);

-- 8) Normalizar valores vacios si ya existen usuarios y expedientes
update public.profiles
set admin_level = 'none'
where admin_level is null or trim(admin_level) = '';

update public.patients
set record_status = 'active'
where record_status is null or trim(record_status) = '';

-- 9) RLS minima para la auditoria (ajustala si luego endureces politicas)
alter table public.admin_audit_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_audit_events'
      and policyname = 'authenticated users can read audit events'
  ) then
    create policy "authenticated users can read audit events"
      on public.admin_audit_events
      for select
      to authenticated
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_audit_events'
      and policyname = 'authenticated users can insert audit events'
  ) then
    create policy "authenticated users can insert audit events"
      on public.admin_audit_events
      for insert
      to authenticated
      with check (true);
  end if;
end $$;

-- 10) Nota importante
-- Este archivo NO cambia tus politicas RLS todavia.
-- Recomendacion:
--   Primero valida el nuevo panel admin y el registro con sedes.
--   Despues endurecemos RLS con una segunda pasada para no romper flujo actual.

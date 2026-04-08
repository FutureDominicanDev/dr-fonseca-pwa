-- Dr. Fonseca PWA
-- Configuracion inicial para panel admin, sedes del staff y trazabilidad de exportaciones.
-- Ejecuta este archivo en Supabase SQL Editor.

-- 1) Campos nuevos en profiles para permisos y sede del staff
alter table public.profiles
  add column if not exists office_location text;

alter table public.profiles
  add column if not exists admin_level text not null default 'none';

-- 2) Campo nuevo en messages para congelar la sede del remitente al momento de enviar
alter table public.messages
  add column if not exists sender_office text;

-- 3) Constraints suaves para mantener consistencia
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

-- 4) Indices utiles para panel y exportaciones
create index if not exists profiles_admin_level_idx on public.profiles(admin_level);
create index if not exists profiles_office_location_idx on public.profiles(office_location);
create index if not exists messages_sender_office_idx on public.messages(sender_office);
create index if not exists procedures_patient_id_idx on public.procedures(patient_id);
create index if not exists rooms_procedure_id_idx on public.rooms(procedure_id);
create index if not exists messages_room_id_idx on public.messages(room_id);

-- 5) Bootstrap owner actual del proyecto
update public.profiles
set admin_level = 'owner'
where id in (
  select id
  from auth.users
  where lower(email) = 'mrdiazsr@icloud.com'
);

-- 6) Normalizar valores vacios si ya existen usuarios
update public.profiles
set admin_level = 'none'
where admin_level is null or trim(admin_level) = '';

-- 7) Nota importante
-- Este archivo NO cambia tus politicas RLS todavia.
-- Recomendacion:
--   Primero valida el nuevo panel admin y el registro con sedes.
--   Despues endurecemos RLS con una segunda pasada para no romper flujo actual.

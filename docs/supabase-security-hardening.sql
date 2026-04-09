-- Dr. Fonseca PWA
-- Security hardening phase 2
-- Run this AFTER supabase-admin-setup.sql
--
-- This pass safely hardens admin-sensitive data first:
--   - profiles
--   - admin_audit_events
--
-- It intentionally does NOT harden public patient chat access yet.
-- The patient chat still uses a guest link flow, so rooms/messages need a token-based redesign
-- before we can safely lock those tables down without breaking patients.

-- 1) Helper functions
create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.current_admin_level()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.admin_level from public.profiles p where p.id = auth.uid()), 'none')
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.role from public.profiles p where p.id = auth.uid()), '')
$$;

create or replace function public.current_user_office()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.office_location from public.profiles p where p.id = auth.uid()), '')
$$;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_email() = 'mrdiazsr@icloud.com'
    or public.current_admin_level() in ('owner', 'super_admin', 'admin')
$$;

-- 2) Helpful indexes
create index if not exists room_members_user_id_idx on public.room_members(user_id);
create index if not exists room_members_room_id_idx on public.room_members(room_id);

-- 3) Profiles RLS
alter table public.profiles enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', policy_record.policyname);
  end loop;
end $$;

create policy "profiles read own or admin"
  on public.profiles
  for select
  to authenticated
  using (
    auth.uid() = id
    or public.is_admin_user()
  );

create policy "profiles insert own row"
  on public.profiles
  for insert
  to authenticated
  with check (
    auth.uid() = id
    and (
      coalesce(admin_level, 'none') = 'none'
      or (
        public.current_user_email() = 'mrdiazsr@icloud.com'
        and admin_level = 'owner'
      )
    )
  );

create policy "profiles update own safe fields or admin"
  on public.profiles
  for update
  to authenticated
  using (
    auth.uid() = id
    or public.is_admin_user()
  )
  with check (
    public.is_admin_user()
    or (
      auth.uid() = id
      and coalesce(admin_level, 'none') = public.current_admin_level()
      and coalesce(role, '') = public.current_user_role()
      and coalesce(office_location, '') = public.current_user_office()
    )
  );

create policy "profiles delete admin only"
  on public.profiles
  for delete
  to authenticated
  using (public.is_admin_user());

-- 4) Audit table RLS
alter table public.admin_audit_events enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_audit_events'
  loop
    execute format('drop policy if exists %I on public.admin_audit_events', policy_record.policyname);
  end loop;
end $$;

create policy "audit read admin only"
  on public.admin_audit_events
  for select
  to authenticated
  using (public.is_admin_user());

create policy "audit insert admin only"
  on public.admin_audit_events
  for insert
  to authenticated
  with check (public.is_admin_user());

-- 5) Optional backfill for older rooms that were missing membership rows
insert into public.room_members (room_id, user_id, role)
select r.id, r.created_by, coalesce(p.role, 'staff')
from public.rooms r
left join public.profiles p on p.id = r.created_by
where r.created_by is not null
  and not exists (
    select 1
    from public.room_members rm
    where rm.room_id = r.id
      and rm.user_id = r.created_by
  );

-- 6) Notes
-- After this script:
--   - users can read/update only their own profile
--   - admins can manage all profiles
--   - audit data becomes admin-only
--
-- Next security phase should add tokenized guest access for /patient/[roomId]
-- and then tighten rooms/messages/patients/procedures with membership-based RLS.

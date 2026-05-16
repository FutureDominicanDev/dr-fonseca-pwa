-- Dr. Fonseca PWA
-- Full RLS and private media storage hardening
-- Prepared May 11, 2026.
--
-- Goal:
--   - no anonymous table reads for patient/staff/private data
--   - pending_staff cannot read patient data
--   - regular staff can only read assigned rooms/patients
--   - owner/super_admin/doctor retain full patient access
--   - chat-files becomes private so copied public URLs stop working
--
-- Run after deploying the app version that serves patient-room APIs and signed media URLs.
--
-- Owner safety:
--   Dr. Miguel Fonseca / Siluety Plastic Surgery is the engraved owner identity.
--   Ray (mrdiazsr@icloud.com) is developer/support access only and must not be
--   included in SQL owner bootstrap or owner allowlists.

begin;

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
  select coalesce((select lower(p.admin_level) from public.profiles p where p.id = auth.uid()), 'none')
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select lower(p.role) from public.profiles p where p.id = auth.uid()), '')
$$;

create or replace function public.is_owner_email()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_email() in (
    'siluetybodyart@gmail.com',
    'miguelafr31@gmail.com'
  )
$$;

create or replace function public.is_approved_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(lower(p.role), '') <> 'pending_staff'
    )
$$;

create or replace function public.has_full_patient_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_approved_staff()
    and (
      public.is_owner_email()
      or public.current_admin_level() in ('owner', 'super_admin')
      or public.current_user_role() = 'doctor'
    )
$$;

create or replace function public.can_access_room(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_approved_staff()
    and (
      public.has_full_patient_access()
      or exists (
        select 1
        from public.room_members rm
        where rm.room_id = target_room_id
          and rm.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.rooms r
        where r.id = target_room_id
          and r.created_by = auth.uid()
      )
    )
$$;

create or replace function public.can_access_patient(target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_approved_staff()
    and (
      public.has_full_patient_access()
      or exists (
        select 1
        from public.procedures pr
        join public.rooms r on r.procedure_id = pr.id
        join public.room_members rm on rm.room_id = r.id
        where pr.patient_id = target_patient_id
          and rm.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.procedures pr
        join public.rooms r on r.procedure_id = pr.id
        where pr.patient_id = target_patient_id
          and r.created_by = auth.uid()
      )
    )
$$;

create or replace function public.can_access_storage_patient_segment(segment text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when segment is null or segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then false
    else public.can_access_room(segment::uuid) or public.can_access_patient(segment::uuid)
  end
$$;

create or replace function public.drop_all_policies(target_schema text, target_table text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = target_schema
      and tablename = target_table
  loop
    execute format('drop policy if exists %I on %I.%I', policy_record.policyname, target_schema, target_table);
  end loop;
end $$;

create index if not exists room_members_user_id_idx on public.room_members(user_id);
create index if not exists room_members_room_id_idx on public.room_members(room_id);
create index if not exists procedures_patient_id_idx on public.procedures(patient_id);
create index if not exists rooms_procedure_id_idx on public.rooms(procedure_id);
create index if not exists messages_room_id_created_at_idx on public.messages(room_id, created_at);
create index if not exists media_notifications_staff_id_seen_idx on public.media_notifications(staff_id, seen);
create index if not exists media_notifications_recipient_id_seen_idx on public.media_notifications(recipient_id, seen);
create index if not exists staff_private_messages_sender_id_idx on public.staff_private_messages(sender_id);
create index if not exists staff_private_messages_recipient_id_idx on public.staff_private_messages(recipient_id);

alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.patients enable row level security;
alter table public.procedures enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.messages enable row level security;
alter table public.labels enable row level security;
alter table public.media_uploads enable row level security;
alter table public.media_notifications enable row level security;
alter table public.staff_access_requests enable row level security;
alter table public.staff_private_messages enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.admin_audit_events enable row level security;

select public.drop_all_policies('public', 'profiles');
select public.drop_all_policies('public', 'app_settings');
select public.drop_all_policies('public', 'patients');
select public.drop_all_policies('public', 'procedures');
select public.drop_all_policies('public', 'rooms');
select public.drop_all_policies('public', 'room_members');
select public.drop_all_policies('public', 'messages');
select public.drop_all_policies('public', 'labels');
select public.drop_all_policies('public', 'media_uploads');
select public.drop_all_policies('public', 'media_notifications');
select public.drop_all_policies('public', 'staff_access_requests');
select public.drop_all_policies('public', 'staff_private_messages');
select public.drop_all_policies('public', 'push_subscriptions');
select public.drop_all_policies('public', 'audit_logs');
select public.drop_all_policies('public', 'admin_audit_events');
select public.drop_all_policies('storage', 'objects');

create policy "profiles read approved directory"
  on public.profiles
  for select
  to authenticated
  using (
    auth.uid() = id
    or public.has_full_patient_access()
    or (public.is_approved_staff() and coalesce(lower(role), '') <> 'pending_staff')
  );

create policy "profiles insert own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles update own or full access"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id or public.has_full_patient_access())
  with check (
    public.has_full_patient_access()
    or (
      auth.uid() = id
      and coalesce(lower(admin_level), 'none') = 'none'
      and coalesce(lower(role), '') in ('staff', 'enfermeria', 'coordinacion', 'post_quirofano')
    )
  );

create policy "profiles delete full access"
  on public.profiles
  for delete
  to authenticated
  using (public.has_full_patient_access());

create policy "app settings read approved safe keys"
  on public.app_settings
  for select
  to authenticated
  using (
    public.has_full_patient_access()
    or (
      public.is_approved_staff()
      and key in ('staff_permissions', 'office_phone_guadalajara', 'office_phone_tijuana')
    )
  );

create policy "app settings write full access"
  on public.app_settings
  for all
  to authenticated
  using (public.has_full_patient_access())
  with check (public.has_full_patient_access());

create policy "patients read assigned"
  on public.patients
  for select
  to authenticated
  using (public.can_access_patient(id));

create policy "patients insert approved staff"
  on public.patients
  for insert
  to authenticated
  with check (public.is_approved_staff());

create policy "patients update assigned"
  on public.patients
  for update
  to authenticated
  using (public.can_access_patient(id))
  with check (public.can_access_patient(id));

create policy "patients delete full access"
  on public.patients
  for delete
  to authenticated
  using (public.has_full_patient_access());

create policy "procedures read assigned"
  on public.procedures
  for select
  to authenticated
  using (public.can_access_patient(patient_id));

create policy "procedures insert approved staff"
  on public.procedures
  for insert
  to authenticated
  with check (public.is_approved_staff());

create policy "procedures update assigned"
  on public.procedures
  for update
  to authenticated
  using (public.can_access_patient(patient_id))
  with check (public.can_access_patient(patient_id));

create policy "procedures delete full access"
  on public.procedures
  for delete
  to authenticated
  using (public.has_full_patient_access());

create policy "rooms read assigned"
  on public.rooms
  for select
  to authenticated
  using (public.can_access_room(id));

create policy "rooms insert approved staff"
  on public.rooms
  for insert
  to authenticated
  with check (public.is_approved_staff());

create policy "rooms update assigned"
  on public.rooms
  for update
  to authenticated
  using (public.can_access_room(id))
  with check (public.can_access_room(id));

create policy "rooms delete full access"
  on public.rooms
  for delete
  to authenticated
  using (public.has_full_patient_access());

create policy "room members read assigned"
  on public.room_members
  for select
  to authenticated
  using (
    public.has_full_patient_access()
    or user_id = auth.uid()
    or public.can_access_room(room_id)
  );

create policy "room members insert controlled"
  on public.room_members
  for insert
  to authenticated
  with check (
    public.has_full_patient_access()
    or exists (
      select 1
      from public.rooms r
      where r.id = room_id
        and r.created_by = auth.uid()
    )
  );

create policy "room members delete controlled"
  on public.room_members
  for delete
  to authenticated
  using (
    public.has_full_patient_access()
    or exists (
      select 1
      from public.rooms r
      where r.id = room_id
        and r.created_by = auth.uid()
    )
  );

create policy "messages read assigned"
  on public.messages
  for select
  to authenticated
  using (public.can_access_room(room_id));

create policy "messages insert assigned staff"
  on public.messages
  for insert
  to authenticated
  with check (public.can_access_room(room_id));

create policy "messages update assigned staff"
  on public.messages
  for update
  to authenticated
  using (
    public.can_access_room(room_id)
    and (public.has_full_patient_access() or sender_id = auth.uid())
  )
  with check (public.can_access_room(room_id));

create policy "messages delete full access"
  on public.messages
  for delete
  to authenticated
  using (public.has_full_patient_access());

create policy "labels read own or assigned"
  on public.labels
  for select
  to authenticated
  using (
    public.has_full_patient_access()
    or created_by = auth.uid()
    or patient_id is null
    or public.can_access_patient(patient_id)
    or public.can_access_room(room_id)
  );

create policy "labels insert approved"
  on public.labels
  for insert
  to authenticated
  with check (
    public.is_approved_staff()
    and coalesce(created_by, auth.uid()) = auth.uid()
    and (patient_id is null or public.can_access_patient(patient_id))
    and (room_id is null or public.can_access_room(room_id))
  );

create policy "labels update own or full"
  on public.labels
  for update
  to authenticated
  using (public.has_full_patient_access() or created_by = auth.uid())
  with check (
    public.has_full_patient_access()
    or (
      created_by = auth.uid()
      and (patient_id is null or public.can_access_patient(patient_id))
      and (room_id is null or public.can_access_room(room_id))
    )
  );

create policy "labels delete own or full"
  on public.labels
  for delete
  to authenticated
  using (public.has_full_patient_access() or created_by = auth.uid());

create policy "media uploads read assigned"
  on public.media_uploads
  for select
  to authenticated
  using (
    public.has_full_patient_access()
    or public.can_access_patient(patient_id)
    or public.can_access_room(room_id)
  );

create policy "media uploads insert assigned"
  on public.media_uploads
  for insert
  to authenticated
  with check (
    public.is_approved_staff()
    and (room_id is null or public.can_access_room(room_id))
    and (patient_id is null or public.can_access_patient(patient_id))
  );

create policy "media notifications read own"
  on public.media_notifications
  for select
  to authenticated
  using (
    public.has_full_patient_access()
    or staff_id = auth.uid()
    or recipient_id = auth.uid()
  );

create policy "media notifications insert assigned"
  on public.media_notifications
  for insert
  to authenticated
  with check (
    public.is_approved_staff()
    and (room_id is null or public.can_access_room(room_id))
  );

create policy "media notifications update own"
  on public.media_notifications
  for update
  to authenticated
  using (public.has_full_patient_access() or staff_id = auth.uid() or recipient_id = auth.uid())
  with check (public.has_full_patient_access() or staff_id = auth.uid() or recipient_id = auth.uid());

create policy "staff access requests read controlled"
  on public.staff_access_requests
  for select
  to authenticated
  using (
    public.has_full_patient_access()
    or requested_by = auth.uid()
    or target_staff_id = auth.uid()
  );

create policy "staff access requests insert approved"
  on public.staff_access_requests
  for insert
  to authenticated
  with check (
    public.is_approved_staff()
    and (requested_by is null or requested_by = auth.uid())
    and (room_id is null or public.can_access_room(room_id))
  );

create policy "staff access requests update full access"
  on public.staff_access_requests
  for update
  to authenticated
  using (public.has_full_patient_access())
  with check (public.has_full_patient_access());

create policy "staff private messages read participants"
  on public.staff_private_messages
  for select
  to authenticated
  using (
    public.has_full_patient_access()
    or sender_id = auth.uid()
    or recipient_id = auth.uid()
  );

create policy "staff private messages insert sender"
  on public.staff_private_messages
  for insert
  to authenticated
  with check (
    public.is_approved_staff()
    and sender_id = auth.uid()
  );

create policy "staff private messages update participants"
  on public.staff_private_messages
  for update
  to authenticated
  using (public.has_full_patient_access() or sender_id = auth.uid() or recipient_id = auth.uid())
  with check (public.has_full_patient_access() or sender_id = auth.uid() or recipient_id = auth.uid());

create policy "audit logs read full access"
  on public.audit_logs
  for select
  to authenticated
  using (public.has_full_patient_access());

create policy "audit logs insert approved"
  on public.audit_logs
  for insert
  to authenticated
  with check (public.is_approved_staff());

create policy "admin audit read full access"
  on public.admin_audit_events
  for select
  to authenticated
  using (public.has_full_patient_access());

create policy "admin audit insert full access"
  on public.admin_audit_events
  for insert
  to authenticated
  with check (public.has_full_patient_access());

-- push_subscriptions intentionally has no browser policy. All reads/writes go through /api/push.

update storage.buckets
set public = false
where id = 'chat-files';

create policy "chat files read approved assigned"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'chat-files'
    and public.is_approved_staff()
    and (
      (storage.foldername(name))[1] = 'profile-photos'
      or (
        (storage.foldername(name))[1] = 'patients'
        and public.can_access_storage_patient_segment((storage.foldername(name))[2])
      )
    )
  );

create policy "chat files insert approved"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'chat-files'
    and public.is_approved_staff()
    and (
      ((storage.foldername(name))[1] = 'profile-photos' and (storage.foldername(name))[2] = auth.uid()::text)
      or (storage.foldername(name))[1] = 'patients'
    )
  );

create policy "chat files update approved assigned"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'chat-files'
    and public.is_approved_staff()
    and (
      ((storage.foldername(name))[1] = 'profile-photos' and (storage.foldername(name))[2] = auth.uid()::text)
      or (
        (storage.foldername(name))[1] = 'patients'
        and public.can_access_storage_patient_segment((storage.foldername(name))[2])
      )
    )
  )
  with check (
    bucket_id = 'chat-files'
    and public.is_approved_staff()
  );

create policy "chat files delete full access"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'chat-files'
    and public.has_full_patient_access()
  );

notify pgrst, 'reload schema';

commit;

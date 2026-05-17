-- Dr. Fonseca PWA
-- Launch reset / granular permissions proposal.
-- Do NOT run this file until the doctor explicitly approves the reset plan.
--
-- Owner safety:
--   Dr. Miguel Fonseca / Siluety Plastic Surgery is the engraved owner identity.
--   Ray (mrdiazsr@icloud.com) is developer/support access only and must not be
--   promoted by launch reset SQL.

-- 1) Granular permissions column for staff profiles.
-- Code is backward compatible before this exists. After this is added, the doctor's
-- owner identities still receive permanent full access in application code.
alter table public.profiles
  add column if not exists permissions jsonb not null default '[]'::jsonb;

comment on column public.profiles.permissions is
  'Explicit feature permissions for staff/admin users. Doctor owner identities keep permanent full access in app code.';

create index if not exists profiles_permissions_idx
  on public.profiles using gin(permissions);

-- 2) Optional owner backfill. Keep owner profiles full at the role layer.
update public.profiles
set admin_level = 'owner'
where lower(coalesce(email, '')) in (
  'siluetybodyart@gmail.com',
  'miguelafr31@gmail.com'
);

-- 3) Read-only inventory queries to run before any launch reset.
-- Save/export the result from Supabase before changing statuses.
-- Approval-gated final cleanup reminder:
--   When final QA is complete, the doctor may also want to clear/reset legacy
--   admin_audit_events and audit_logs from the build/testing period. Do NOT
--   run audit-history cleanup until the user explicitly approves that
--   destructive reset.
select 'patients' as table_name, count(*) from public.patients
union all select 'procedures', count(*) from public.procedures
union all select 'rooms', count(*) from public.rooms
union all select 'messages', count(*) from public.messages
union all select 'media_uploads', count(*) from public.media_uploads
union all select 'media_notifications', count(*) from public.media_notifications
union all select 'room_members', count(*) from public.room_members
union all select 'admin_audit_events', count(*) from public.admin_audit_events
union all select 'audit_logs', count(*) from public.audit_logs
union all select 'push_subscriptions', count(*) from public.push_subscriptions;

-- 4) Recommended recoverable launch reset after exports are saved.
-- This archives patient records and cancels procedures/rooms from the active workflow.
-- It preserves patients, rooms, messages, forms, prescriptions, files, internal notes,
-- media notifications, labels, audit history, and storage objects.
--
-- begin;
--
-- update public.procedures
-- set status = 'cancelled'
-- where patient_id in (select id from public.patients);
--
-- update public.patients
-- set
--   record_status = 'archived',
--   record_status_changed_at = now(),
--   record_status_changed_by = null
-- where coalesce(record_status, 'active') = 'active';
--
-- insert into public.admin_audit_events (
--   action,
--   entity_type,
--   entity_name,
--   notes,
--   metadata
-- )
-- values (
--   'launch_reset_archived',
--   'patient_population',
--   'Launch reset',
--   'Recoverable launch reset: existing patient records archived and procedures cancelled before fresh doctor handoff.',
--   jsonb_build_object('approved_by_doctor', true, 'reset_date', now())
-- );
--
-- commit;

-- 5) Restore path for a mistaken reset/cancellation.
-- Prefer the app Papelera restore button for individual patients. For a bulk reversal:
--
-- begin;
-- update public.patients
-- set record_status = 'active', record_status_changed_at = now(), record_status_changed_by = null
-- where record_status = 'archived';
--
-- update public.procedures
-- set status = 'scheduled'
-- where status = 'cancelled';
-- commit;

notify pgrst, 'reload schema';

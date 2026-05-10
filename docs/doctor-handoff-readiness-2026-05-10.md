# Dr. Fonseca handoff readiness notes

## Live data inventory

Read-only Supabase inventory on 2026-05-10:

- `patients`: 4
- `procedures`: 4
- `rooms`: 4
- `messages`: 120
- `media_uploads`: 0
- `media_notifications`: 12
- `labels`: 0
- `staff_access_requests`: 0
- `room_members`: 11
- `admin_audit_events`: 53
- `audit_logs`: 0
- `profiles`: 6
- `push_subscriptions`: 6
- `staff_private_messages`: 14
- `app_settings`: 5
- Storage bucket: `chat-files`

## Safest patient reset approach

Do not hard-delete patient data for launch handoff.

Recommended path:

1. Export patient data from `patients`, `procedures`, `rooms`, `messages`, `media_notifications`, `room_members`, `admin_audit_events`, `audit_logs`, and storage bucket `chat-files`.
2. Archive existing patient records with `patients.record_status = archived`.
3. Mark existing procedures as `procedures.status = cancelled`.
4. Keep staff profiles, owner access, app settings, legal pages, labels configuration, and PWA assets intact.

This gives the doctor a fresh active patient list while keeping recovery possible.

## Permissions model

The app now has named feature permissions in code. Owner emails keep permanent full access. Existing roles still provide safe fallback permissions until the new `profiles.permissions` JSONB column is applied.

Feature keys:

- `view_patients`
- `create_patients`
- `edit_patient_info`
- `archive_rooms`
- `restore_rooms`
- `view_clinical_history`
- `view_upload_files`
- `view_internal_notes`
- `manage_internal_notes`
- `manage_labels`
- `manage_staff`
- `manage_permissions`
- `access_audit_logs`
- `access_settings_security`

SQL proposal: `docs/supabase-launch-reset-and-permissions-2026-05-10.sql`

## Room cancellation

Room cancellation is recoverable:

- Cancelling a room archives the patient record and sets the procedure status to `cancelled`.
- The room is hidden from the normal staff inbox active list.
- Patient links remain valid but become read-only with a cancelled-room notice.
- Messages, forms, files, prescriptions, internal notes/photos, memberships, and audit history are preserved.
- Restoring from Papelera sets the patient back to active and cancelled procedures back to scheduled.

## Store readiness notes

Current readiness items already in place:

- PWA manifest and app icons are present.
- Privacy, support, and account deletion pages are public and linked from login/register/reset.
- Public support email is `support@elbanova.tech`.
- Legal copy identifies ElbaNova as developer and the clinic/doctor as responsible for medical data handling.

Remaining before App Store / Google Play submission:

- Final screenshots on real iOS/Android dimensions.
- Developer account enrollment and app identifiers.
- Decide whether stores will ship as PWA wrapper or native shell.
- Confirm push notification wording and platform limitations for iOS PWA/wrapper.
- Final privacy nutrition labels / Data Safety form answers with clinic data-controller responsibility.

# Dr Fonseca PWA Finalization Runbook (Apr 27, 2026)

This runbook is the fastest path to close the project cleanly.

## 1) Code Status Already Applied

- Video call surface disabled in staff + patient chat.
- Video session API returns disabled response (prevents accidental paid sessions).
- Translation endpoint no longer sends chat text to public Google Translate endpoint.
- Push API now validates payloads and fails gracefully when env config is missing.

## 2) Vercel Environment Variables (Production + Preview)

In project `dr-fonseca-pwa`, verify these exist:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_EMAIL`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `OPENAI_API_KEY` (only if you want translation enabled)
- `OPENAI_TRANSLATE_MODEL` (optional; default is `gpt-4o-mini`)

Notes:
- `DAILY_API_KEY` is not required while video is disabled.
- After any env change, redeploy Production.

## 3) Supabase SQL To Run (In Order)

Open Supabase SQL editor and run:

1. `docs/supabase-admin-setup.sql`
2. `docs/supabase-security-hardening.sql`

These scripts harden:
- `profiles`
- `admin_audit_events`
- helper functions + indexes

Important:
- Patient guest-link chat (`/patient/[roomId]`) still uses open-link flow.
- Full RLS lockdown for `rooms/messages/patients/procedures` requires tokenized guest-access redesign first.
- Do not force-lock those chat tables yet unless we deploy that redesign in code.

## 4) Manual QA (15-Minute Final Pass)

Test on desktop + iPhone:

1. Staff login works.
2. Patient room opens from direct link.
3. Staff -> patient text delivers and unread badge updates.
4. Patient -> staff text delivers and unread badge updates.
5. Notifications:
   - staff receives patient-message alert
   - patient receives staff-message alert
6. Translation toggle:
   - works when `OPENAI_API_KEY` is set
   - safely no-ops when key is absent
7. Media upload:
   - image
   - audio
   - file
8. Video:
   - no active call actions available
   - no paid session starts

## 5) App Store / Play Store Readiness Gate

Before submission:

- Privacy Policy URL and Terms URL exist and are linked in app settings.
- Final screenshots captured (staff + patient flows).
- Internal test cycle complete (2-3 days).
- No critical Supabase advisor warnings left unresolved except the known guest-link chat model risk.


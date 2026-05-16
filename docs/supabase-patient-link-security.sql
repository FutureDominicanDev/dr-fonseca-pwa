-- Dr. Fonseca PWA
-- Patient link security upgrade
-- Run this in Supabase SQL Editor to activate tokenized patient links.
--
-- Owner safety:
--   Dr. Miguel Fonseca / Siluety Plastic Surgery is the engraved owner identity.
--   Ray (mrdiazsr@icloud.com) is developer/support access only. Do not edit this
--   or any related SQL to promote Ray as owner or add Ray to owner bootstrap lists.

alter table public.rooms
  add column if not exists patient_access_token text;

create unique index if not exists rooms_patient_access_token_key
  on public.rooms(patient_access_token)
  where patient_access_token is not null;

create index if not exists rooms_patient_access_token_idx
  on public.rooms(patient_access_token);

comment on column public.rooms.patient_access_token is
  'Secure random token included in new patient links. Existing legacy links with null tokens remain compatible.';

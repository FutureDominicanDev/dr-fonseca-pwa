-- Dr. Fonseca PWA
-- Patient workflow upgrade:
-- preferred language, time zone, allergies, medications
-- This is safe to run after the previous admin/security scripts.

alter table public.patients
  add column if not exists preferred_language text not null default 'es';

alter table public.patients
  add column if not exists timezone text;

alter table public.patients
  add column if not exists allergies text;

alter table public.patients
  add column if not exists current_medications text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'patients_preferred_language_check'
  ) then
    alter table public.patients
      add constraint patients_preferred_language_check
      check (preferred_language in ('es', 'en'));
  end if;
end $$;

create index if not exists patients_preferred_language_idx on public.patients(preferred_language);
create index if not exists patients_timezone_idx on public.patients(timezone);

comment on column public.patients.preferred_language is 'Patient preferred UI/onboarding language.';
comment on column public.patients.timezone is 'Patient local time zone, such as America/New_York.';
comment on column public.patients.allergies is 'Known allergies relevant to care coordination.';
comment on column public.patients.current_medications is 'Current medications reported by the patient or clinic.';

-- =============================================================
-- 0005_nullable_sub_specialty.sql
-- Civic Access (Team Liquid)
--
-- Makes sub_specialty optional (some specialties, e.g. General Practice,
-- have no meaningful sub-specialty).
--
-- Why this can't be a simple "drop not null":
--   doctors(specialty, sub_specialty) has a composite FK to
--   specialty_taxonomy(specialty, sub_specialty). Postgres composite FKs
--   default to MATCH SIMPLE, which SKIPS validation entirely when any
--   referencing column is NULL -- so a nullable sub_specialty would let a
--   doctor row through with a bogus/misspelled `specialty` that isn't in
--   the taxonomy at all, as long as sub_specialty was left NULL. MATCH FULL
--   doesn't help either: it requires all-null-or-all-non-null, which would
--   reject every row that legitimately has a null sub_specialty (specialty
--   is NOT NULL).
--
--   So the composite FK is replaced with a BEFORE INSERT/UPDATE trigger
--   that validates the (specialty, sub_specialty) pair against the
--   taxonomy in both the null and non-null case.
-- =============================================================

-- =========================================================
-- 1. specialty_taxonomy: allow a "no sub-specialty" row per specialty
-- =========================================================
alter table public.specialty_taxonomy
  alter column sub_specialty drop not null;

-- The existing `unique (specialty, sub_specialty)` constraint does NOT
-- prevent duplicate (specialty, NULL) rows -- standard SQL unique
-- constraints treat NULLs as distinct from each other. Add a partial
-- unique index to cap it at one "no sub-specialty" taxonomy row per
-- specialty.
create unique index if not exists specialty_taxonomy_specialty_null_sub_key
  on public.specialty_taxonomy (specialty)
  where sub_specialty is null;

-- =========================================================
-- 2. doctors: drop the composite FK, make sub_specialty nullable,
--    replace with a trigger-enforced taxonomy check
-- =========================================================
do $$
declare
  v_constraint_name text;
begin
  select con.conname into v_constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'doctors'
    and con.contype = 'f'
    and con.confrelid = 'public.specialty_taxonomy'::regclass;

  if v_constraint_name is not null then
    execute format('alter table public.doctors drop constraint %I', v_constraint_name);
  end if;
end;
$$;

alter table public.doctors
  alter column sub_specialty drop not null;

create or replace function public.check_doctor_specialty_taxonomy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sub_specialty is null then
    if not exists (
      select 1 from public.specialty_taxonomy t
      where t.specialty = new.specialty and t.sub_specialty is null
    ) then
      raise exception
        'specialty % has no taxonomy entry without a sub_specialty', new.specialty;
    end if;
  else
    if not exists (
      select 1 from public.specialty_taxonomy t
      where t.specialty = new.specialty and t.sub_specialty = new.sub_specialty
    ) then
      raise exception
        'specialty/sub_specialty pair (%, %) is not in specialty_taxonomy',
        new.specialty, new.sub_specialty;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_doctor_specialty_taxonomy on public.doctors;
create trigger trg_check_doctor_specialty_taxonomy
before insert or update of specialty, sub_specialty on public.doctors
for each row execute function public.check_doctor_specialty_taxonomy();

-- =============================================================
-- 0002_slot_appointment_triggers.sql
-- Civic Access (Team Liquid)
--
-- Adds two triggers requested as follow-ups to 0001_initial_schema.sql:
--   1. sync_slot_status        -- keeps schedule_slots.is_booked in sync
--                                  with appointments.status
--   2. check_slot_clinic_doctor_match -- rejects a schedule_slots row whose
--                                  clinic_id belongs to a different doctor
--                                  than the slot's own doctor_id
-- =============================================================

-- =========================================================
-- 1. Keep schedule_slots.is_booked in sync with appointment status
--
--    * INSERT with status in ('pending','confirmed') -> slot becomes 'booked'
--    * UPDATE into ('pending','confirmed','completed') from something else
--      -> slot becomes 'booked'
--    * UPDATE into ('declined','cancelled') from an active status
--      -> slot becomes 'available' (unless a doctor has since marked it
--         'doctor_on_leave' -- that takes precedence and is left alone)
--    * DELETE of an appointment row (e.g. cascaded from a deleted patient
--      or doctor) -> slot becomes 'available', same doctor_on_leave guard
--
--    Runs as SECURITY DEFINER so it can update schedule_slots regardless
--    of which RLS-restricted role (patient or doctor) triggered the
--    appointment change.
-- =========================================================
create or replace function public.sync_slot_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status in ('pending', 'confirmed') then
      update public.schedule_slots
      set is_booked = 'booked'
      where id = new.slot_id;
    end if;
    return new;

  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      if new.status in ('pending', 'confirmed', 'completed') then
        update public.schedule_slots
        set is_booked = 'booked'
        where id = new.slot_id;

      elsif new.status in ('declined', 'cancelled') then
        update public.schedule_slots
        set is_booked = 'available'
        where id = new.slot_id
          and is_booked <> 'doctor_on_leave';
      end if;
    end if;
    return new;

  elsif tg_op = 'DELETE' then
    update public.schedule_slots
    set is_booked = 'available'
    where id = old.slot_id
      and is_booked <> 'doctor_on_leave';
    return old;
  end if;

  return null;
end;
$$;

create trigger trg_sync_slot_status
after insert or update or delete on public.appointments
for each row execute function public.sync_slot_status();

-- =========================================================
-- 2. Enforce that a schedule_slots row's clinic_id belongs to the same
--    doctor_id as the slot itself. A composite FK can't express this
--    cleanly (would require doctor_id to be part of clinics' key), so
--    it's enforced here instead.
-- =========================================================
create or replace function public.check_slot_clinic_doctor_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_doctor_id uuid;
begin
  select doctor_id into v_clinic_doctor_id
  from public.clinics
  where id = new.clinic_id;

  if v_clinic_doctor_id is null then
    raise exception 'schedule_slots.clinic_id % does not reference an existing clinic', new.clinic_id;
  end if;

  if v_clinic_doctor_id <> new.doctor_id then
    raise exception
      'schedule_slots.doctor_id (%) does not match the owning doctor (%) of clinic_id %',
      new.doctor_id, v_clinic_doctor_id, new.clinic_id;
  end if;

  return new;
end;
$$;

create trigger trg_check_slot_clinic_doctor_match
before insert or update of doctor_id, clinic_id on public.schedule_slots
for each row execute function public.check_slot_clinic_doctor_match();
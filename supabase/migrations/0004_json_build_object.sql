create or replace function get_doctor_booking_availability(p_doctor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'doctor', jsonb_build_object(
      'id', d.id,
      'name', d.name,
      'specialty', d.specialty,
      'sub_specialty', d.sub_specialty
    ),
    'practice_locations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'clinic', jsonb_build_object(
            'id', c.id,
            'name', c.name,
            'room_details', c.room_details,
            'consultation_fee', c.consultation_fee
          ),
          'availability', coalesce((
            -- Group slots by date for this specific clinic
            select jsonb_agg(
              jsonb_build_object(
                'date', daily_slots.slot_date,
                'slots', daily_slots.slots_array
              )
            )
            from (
              select 
                s.date as slot_date,
                jsonb_agg(
                  jsonb_build_object(
                    'slot_id', s.id,
                    'start_time', s.start_time,
                    'end_time', s.end_time,
                    'status', s.is_booked
                  ) order by s.start_time -- Ensure time slots are chronological
                ) as slots_array
              from public.schedule_slots s
              where s.clinic_id = c.id
                and s.doctor_id = d.id
                and s.date >= current_date -- Only show future availability
              group by s.date
              order by s.date -- Ensure dates are chronological
            ) daily_slots
          ), '[]'::jsonb)
        )
      )
      from public.clinics c
      where c.doctor_id = d.id
    ), '[]'::jsonb)
  ) into result
  from public.doctors d
  where d.id = p_doctor_id;

  return result;
end;
$$;
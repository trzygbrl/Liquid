-- =============================================================
-- 0006_enable_realtime.sql
-- Civic Access (Team Liquid) — Task 4.4: Realtime Sync
--
-- Enables Supabase Realtime publication for appointments and schedule_slots
-- tables so that postgres_changes events are broadcast to client listeners.
-- Sets REPLICA IDENTITY FULL so that realtime row-level filters (e.g. doctor_id=eq...)
-- work reliably on UPDATE and DELETE events.
-- =============================================================

-- 1. Add tables to supabase_realtime publication
alter publication supabase_realtime add table public.appointments;
alter publication supabase_realtime add table public.schedule_slots;

-- 2. Set replica identity to full so update/delete events contain all columns for filtering
alter table public.appointments replica identity full;
alter table public.schedule_slots replica identity full;

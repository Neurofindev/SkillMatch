-- Phase 07 timeline events. A separate migration commits enum values before
-- the following migration creates functions that use them.

alter type public.mission_event_type add value if not exists 'progress_updated'
  before 'mission_completed';

alter type public.mission_event_type add value if not exists 'delivery_submitted'
  before 'mission_completed';

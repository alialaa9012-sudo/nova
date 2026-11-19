-- Supabase's security advisor flags functions whose search_path can be changed by the caller.
-- Pin it for the two helpers that did not set one (the others already use search_path = public).
alter function public.app_now() set search_path = public;
alter function public.touch_updated_at() set search_path = public;

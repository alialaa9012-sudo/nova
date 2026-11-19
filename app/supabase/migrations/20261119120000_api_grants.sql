-- New Supabase projects no longer grant table privileges to the API roles (anon, authenticated) by
-- default, so a visitor could not even read the menu. Grant exactly what the app uses. Row level
-- security (in the first migration) still decides which rows each role sees or changes.

grant usage on schema public to anon, authenticated;

-- The public catalog: everyone may read it.
grant select on public.branches, public.branch_hours, public.menu_categories, public.menu_items,
  public.menu_item_sizes, public.delivery_zones, public.app_settings to anon, authenticated;

-- Catalog changes: signed-in users only, and the admin policies allow admins alone.
grant insert, update, delete on public.branches, public.branch_hours, public.menu_categories,
  public.menu_items, public.menu_item_sizes, public.delivery_zones, public.app_settings to authenticated;
grant usage on sequence public.menu_categories_id_seq, public.menu_items_id_seq,
  public.menu_item_sizes_id_seq, public.delivery_zones_id_seq to authenticated;

-- Staff: their own profile (admins manage all), and the orders their branch may see.
grant select, insert, update, delete on public.staff_profiles to authenticated;
grant select on public.orders, public.order_items, public.order_status_history, public.notification_log to authenticated;

-- Orders are written only through place_order, set_order_status and set_pos_invoice (security
-- definer), and order_counters is never exposed, so no write grant is given on them.

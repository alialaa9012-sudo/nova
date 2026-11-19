-- Tracking with one field (owner, 20 Nov 2026): the customer types the order number or the phone.
--   * phone (with or without the number): their latest order of the last 3 days;
--   * number alone: today's order with that number (numbers restart every day, so only today's
--     is unambiguous). The result never contains the name, phone or address.
create or replace function public.track_order(p_order_number text, p_phone text) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'order_number', o.order_number, 'order_date', o.order_date, 'branch_id', o.branch_id,
    'order_type', o.order_type, 'status', o.status, 'created_at', o.created_at,
    'ready_from', o.ready_from, 'ready_by', o.ready_by,
    'subtotal', o.subtotal, 'delivery_fee', o.delivery_fee, 'tax_amount', o.tax_amount, 'total', o.total,
    'items', (select jsonb_agg(jsonb_build_object('name', name_snapshot, 'size', size_label_snapshot,
                'qty', qty, 'line_total', line_total, 'note', note) order by id)
              from order_items where order_id = o.id),
    'history', (select jsonb_agg(jsonb_build_object('status', to_status, 'at', changed_at) order by changed_at, id)
                from order_status_history where order_id = o.id))
  from orders o
  where o.created_at > app_now() - interval '3 days'
    and (nullif(btrim(p_phone), '') is not null or nullif(btrim(p_order_number), '') is not null)
    and (nullif(btrim(p_phone), '') is null or o.phone = btrim(p_phone))
    and (nullif(btrim(p_order_number), '') is null
         or o.order_number = upper(btrim(replace(p_order_number, '#', ''))))
    and (nullif(btrim(p_phone), '') is not null or o.order_date = (app_now() at time zone 'Africa/Cairo')::date)
  order by o.created_at desc
  limit 1
$$;

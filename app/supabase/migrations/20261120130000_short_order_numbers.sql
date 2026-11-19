-- Simpler order numbers (owner, 20 Nov 2026): each branch counts its own orders from 01 every day,
-- shown as #01, #02, #03 … (100 and up just get longer). The number alone is stored, without the
-- «#», so it reads the same in a link. Orders placed before this keep their old numbers (A-0001).
-- Two branches can now both have 01 on the same day, so a number is unique per branch and day.

alter table public.orders drop constraint orders_order_date_order_number_key;
alter table public.orders add constraint orders_branch_date_number_key unique (branch_id, order_date, order_number);

create or replace function public.place_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  b branches%rowtype;
  z delivery_zones%rowtype;
  v_now timestamptz := app_now();
  v_type order_type;
  v_name text := btrim(coalesce(p ->> 'customer_name', ''));
  v_phone text := btrim(coalesce(p ->> 'phone', ''));
  v_fee numeric(10, 2) := 0;
  v_sub numeric(10, 2) := 0;
  v_service numeric(10, 2);
  v_tax numeric(10, 2);
  v_total numeric(10, 2);
  v_date date;
  v_seq int;
  v_number text;
  v_order_id uuid;
  v_line jsonb;
  v_qty int;
  v_recent int;
  v_ref uuid;
  o orders%rowtype;
  s record;
begin
  if coalesce(p ->> 'client_ref', '') <> '' then
    if p ->> 'client_ref' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'INVALID_CLIENT_REF';
    end if;
    v_ref := (p ->> 'client_ref')::uuid;
    -- Two requests with the same ref wait for each other; the second then finds the first's order.
    perform pg_advisory_xact_lock(hashtextextended(v_ref::text, 0));
    select * into o from orders where client_ref = v_ref;
    if found then
      if o.phone <> v_phone then raise exception 'INVALID_CLIENT_REF'; end if;
      return jsonb_build_object(
        'order_id', o.id, 'order_number', o.order_number, 'order_date', o.order_date, 'branch_id', o.branch_id,
        'subtotal', o.subtotal, 'delivery_fee', o.delivery_fee, 'service_amount', o.service_amount,
        'tax_amount', o.tax_amount, 'total', o.total);
    end if;
  end if;

  select * into b from branches where id = p ->> 'branch_id' and is_active;
  if not found then raise exception 'BRANCH_NOT_FOUND'; end if;
  if not b.accepting_orders then raise exception 'BRANCH_PAUSED'; end if;
  if not branch_is_open(b.id, v_now) then raise exception 'BRANCH_CLOSED'; end if;

  if p ->> 'order_type' not in ('delivery', 'pickup') or p ->> 'order_type' is null then
    raise exception 'INVALID_ORDER_TYPE';
  end if;
  v_type := (p ->> 'order_type')::order_type;
  if char_length(v_name) not between 2 and 80 then raise exception 'INVALID_NAME'; end if;
  if v_phone !~ '^01[0125][0-9]{8}$' then raise exception 'INVALID_PHONE'; end if;

  select count(*) into v_recent from orders
  where phone = v_phone and created_at > v_now - interval '10 minutes';
  if v_recent >= 3 then raise exception 'TOO_MANY_ORDERS'; end if;

  if v_type = 'delivery' then
    if coalesce(p ->> 'zone_id', '') !~ '^[0-9]+$' then raise exception 'INVALID_ZONE'; end if;
    select * into z from delivery_zones
    where id = (p ->> 'zone_id')::bigint and branch_id = b.id and is_active;
    if not found then raise exception 'INVALID_ZONE'; end if;
    if coalesce(btrim(p ->> 'street'), '') = '' or coalesce(btrim(p ->> 'building'), '') = '' then
      raise exception 'ADDRESS_REQUIRED';
    end if;
    v_fee := z.fee;
  end if;

  if jsonb_typeof(p -> 'items') is distinct from 'array' or jsonb_array_length(p -> 'items') = 0 then
    raise exception 'EMPTY_CART';
  end if;
  if jsonb_array_length(p -> 'items') > 40 then raise exception 'TOO_MANY_LINES'; end if;

  -- first pass: validate every line and compute the subtotal from database prices
  for v_line in select * from jsonb_array_elements(p -> 'items') loop
    if coalesce(v_line ->> 'qty', '') !~ '^[0-9]+$' or coalesce(v_line ->> 'size_id', '') !~ '^[0-9]+$' then
      raise exception 'INVALID_LINE';
    end if;
    v_qty := (v_line ->> 'qty')::int;
    if v_qty not between 1 and 50 then raise exception 'INVALID_QTY'; end if;
    select sz.price, i.advance_notice_hours into s
    from menu_item_sizes sz
    join menu_items i on i.id = sz.item_id
    join menu_categories c on c.id = i.category_id
    where sz.id = (v_line ->> 'size_id')::bigint
      and i.branch_id = b.id and i.is_active and sz.is_available and c.is_active;
    if not found then raise exception 'ITEM_UNAVAILABLE'; end if;
    if s.advance_notice_hours is not null then raise exception 'ADVANCE_BOOKING_REQUIRED'; end if;
    v_sub := v_sub + s.price * v_qty;
  end loop;

  v_service := round(v_sub * b.service_percent / 100, 2);
  v_tax := round(
    (v_sub + v_service + case when b.tax_base = 'items_and_delivery' then v_fee else 0 end) * b.tax_percent / 100, 2);
  v_total := v_sub + v_fee + v_service + v_tax;

  v_date := (v_now at time zone b.timezone)::date;
  insert into order_counters as oc (branch_id, order_date, last_seq)
  values (b.id, v_date, 1)
  on conflict (branch_id, order_date) do update set last_seq = oc.last_seq + 1
  returning last_seq into v_seq;
  v_number := lpad(v_seq::text, 2, '0');

  insert into orders (
    order_number, order_date, daily_seq, branch_id, order_type, customer_name, phone,
    zone_id, zone_label, street, building, apartment, landmark, notes,
    subtotal, delivery_fee, service_amount, tax_amount, total, client_ref, created_at, updated_at)
  values (
    v_number, v_date, v_seq, b.id, v_type, v_name, v_phone,
    case when v_type = 'delivery' then z.id end,
    case when v_type = 'delivery' then
      case when z.zone_type = 'منطقة' then z.name_ar else z.zone_type || ' ' || z.name_ar end end,
    case when v_type = 'delivery' then left(btrim(p ->> 'street'), 200) end,
    case when v_type = 'delivery' then left(btrim(p ->> 'building'), 50) end,
    case when v_type = 'delivery' then nullif(left(btrim(coalesce(p ->> 'apartment', '')), 50), '') end,
    case when v_type = 'delivery' then nullif(left(btrim(coalesce(p ->> 'landmark', '')), 200), '') end,
    nullif(left(btrim(coalesce(p ->> 'notes', '')), 500), ''),
    v_sub, v_fee, v_service, v_tax, v_total, v_ref, v_now, v_now)
  returning id into v_order_id;

  -- second pass: store the lines with name and price snapshots
  -- (the item note is single-spaced and cut to 120 characters, as in the app)
  insert into order_items (order_id, item_id, size_id, name_snapshot, size_label_snapshot, unit_price, qty, line_total, note)
  select v_order_id, i.id, sz.id, i.name_ar, sz.label, sz.price, (l ->> 'qty')::int, sz.price * (l ->> 'qty')::int,
    nullif(btrim(left(btrim(regexp_replace(coalesce(l ->> 'note', ''), '\s+', ' ', 'g')), 120)), '')
  from jsonb_array_elements(p -> 'items') with ordinality as t(l, ord)
  join menu_item_sizes sz on sz.id = (l ->> 'size_id')::bigint
  join menu_items i on i.id = sz.item_id
  order by t.ord;

  insert into order_status_history (order_id, from_status, to_status, changed_at)
  values (v_order_id, null, 'new', v_now);

  return jsonb_build_object(
    'order_id', v_order_id, 'order_number', v_number, 'order_date', v_date, 'branch_id', b.id,
    'subtotal', v_sub, 'delivery_fee', v_fee, 'service_amount', v_service, 'tax_amount', v_tax, 'total', v_total);
end
$$;

-- Tracking accepts the number with or without «#».
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
  where o.order_number = upper(btrim(replace(p_order_number, '#', '')))
    and o.phone = btrim(p_phone)
    and o.created_at > app_now() - interval '3 days'
  order by o.created_at desc
  limit 1
$$;

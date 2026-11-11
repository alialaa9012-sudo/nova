-- خليها مشاوي: ordering schema for Supabase (PostgreSQL 15+).
-- Security model: every table has row level security. Customers (anon) only read the
-- public catalog and act through three functions: place_order, track_order and
-- branch_is_open. Staff read orders and change status through set_order_status.
-- Prices are always recomputed here; the browser never decides a price.

create type public.order_status as enum ('new', 'preparing', 'out_for_delivery', 'cancelled');
create type public.order_type as enum ('delivery', 'pickup');

create table public.branches (
  id text primary key,
  code text not null unique check (code ~ '^[A-Z]$'),
  name_ar text not null,
  address_ar text not null,
  phones text[] not null default '{}',
  maps_url text,
  lat double precision,
  lng double precision,
  timezone text not null default 'Africa/Cairo',
  is_active boolean not null default true,
  accepting_orders boolean not null default true,
  pause_reason text,
  service_percent numeric(5, 2) not null default 0 check (service_percent between 0 and 100),
  tax_percent numeric(5, 2) not null default 0 check (tax_percent between 0 and 100),
  tax_base text check (tax_base in ('items_only', 'items_and_delivery')),
  sort_order int not null default 0
);

-- weekday follows extract(dow): 0 = Sunday ... 6 = Saturday.
create table public.branch_hours (
  branch_id text not null references public.branches (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  crosses_midnight boolean not null default false,
  primary key (branch_id, weekday)
);

create table public.menu_categories (
  id bigint generated always as identity primary key,
  branch_id text not null references public.branches (id) on delete cascade,
  name_ar text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  unique (branch_id, name_ar)
);

create table public.menu_items (
  id bigint generated always as identity primary key,
  branch_id text not null references public.branches (id) on delete cascade,
  category_id bigint not null references public.menu_categories (id) on delete cascade,
  name_ar text not null,
  description_ar text not null default '',
  advance_notice_hours int check (advance_notice_hours > 0),
  needs_review boolean not null default false,
  pos_code text,
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  unique (category_id, name_ar)
);

create table public.menu_item_sizes (
  id bigint generated always as identity primary key,
  item_id bigint not null references public.menu_items (id) on delete cascade,
  label text not null default '',
  price numeric(10, 2) not null check (price > 0),
  sort_order int not null default 0,
  is_available boolean not null default true,
  unique (item_id, label)
);

create table public.delivery_zones (
  id bigint generated always as identity primary key,
  branch_id text not null references public.branches (id) on delete cascade,
  zone_type text not null default 'منطقة',
  name_ar text not null,
  fee numeric(10, 2) not null check (fee >= 0),
  fee_max numeric(10, 2) not null,
  review_status text not null default 'ok' check (review_status in ('ok', 'review', 'pending')),
  note text not null default '',
  is_active boolean not null default true,
  sort_order int not null default 0,
  unique (branch_id, zone_type, name_ar),
  check (fee_max >= fee),
  check (review_status <> 'pending' or not is_active), -- a pending zone can never be offered
  check (not is_active or fee = fee_max)                -- an offered zone has one fee
);

create table public.app_settings (
  key text primary key,
  value jsonb not null
);

create table public.staff_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'agent')),
  branch_id text references public.branches (id), -- null = all branches (central call center)
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.order_counters (
  branch_id text not null references public.branches (id),
  order_date date not null,
  last_seq int not null,
  primary key (branch_id, order_date)
);

-- order_number (e.g. A-0012) restarts every day per branch, so it is unique per date.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null,
  order_date date not null,
  daily_seq int not null,
  branch_id text not null references public.branches (id),
  order_type public.order_type not null,
  status public.order_status not null default 'new',
  customer_name text not null check (char_length(btrim(customer_name)) between 2 and 80),
  phone text not null check (phone ~ '^01[0125][0-9]{8}$'),
  zone_id bigint references public.delivery_zones (id),
  zone_label text,
  street text,
  building text,
  apartment text,
  landmark text,
  notes text,
  subtotal numeric(10, 2) not null,
  delivery_fee numeric(10, 2) not null default 0,
  service_amount numeric(10, 2) not null default 0,
  tax_amount numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  payment_method text not null default 'cash' check (payment_method = 'cash'),
  cancel_reason text,
  pos_invoice_no text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_date, order_number),
  unique (branch_id, order_date, daily_seq),
  check (order_type = 'pickup' or (zone_id is not null and street is not null and building is not null)),
  check (status <> 'cancelled' or cancel_reason is not null)
);
create index orders_branch_created_idx on public.orders (branch_id, created_at desc);
create index orders_status_idx on public.orders (status);
create index orders_phone_idx on public.orders (phone);

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  item_id bigint references public.menu_items (id) on delete set null,
  size_id bigint references public.menu_item_sizes (id) on delete set null,
  name_snapshot text not null,
  size_label_snapshot text not null default '',
  unit_price numeric(10, 2) not null,
  qty int not null check (qty between 1 and 50),
  line_total numeric(10, 2) not null
);
create index order_items_order_idx on public.order_items (order_id);

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  changed_by uuid,
  note text,
  changed_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, changed_at);

create table public.notification_log (
  id bigint generated always as identity primary key,
  order_id uuid references public.orders (id) on delete cascade,
  channel text not null default 'telegram',
  status text not null check (status in ('sent', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- helpers

-- Current time. Tests may pin it with: set app.test_now = '2027-01-04 12:00+02'.
create function public.app_now() returns timestamptz
language sql stable
as $$ select coalesce(nullif(current_setting('app.test_now', true), '')::timestamptz, now()) $$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from staff_profiles where user_id = auth.uid() and is_active) $$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from staff_profiles where user_id = auth.uid() and is_active and role = 'admin') $$;

create function public.staff_can_access(p_branch_id text) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from staff_profiles
    where user_id = auth.uid() and is_active and (branch_id is null or branch_id = p_branch_id)
  )
$$;

create function public.branch_is_open(p_branch_id text, p_at timestamptz default null) returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_tz text;
  v_local timestamp;
  v_dow int;
  v_min int;
  h branch_hours%rowtype;
begin
  select timezone into v_tz from branches where id = p_branch_id and is_active;
  if v_tz is null then
    return false;
  end if;
  v_local := coalesce(p_at, app_now()) at time zone v_tz;
  v_dow := extract(dow from v_local)::int;
  v_min := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;

  -- yesterday's window may run past midnight
  select * into h from branch_hours where branch_id = p_branch_id and weekday = (v_dow + 6) % 7;
  if found and h.crosses_midnight
     and v_min < extract(hour from h.closes_at)::int * 60 + extract(minute from h.closes_at)::int then
    return true;
  end if;

  select * into h from branch_hours where branch_id = p_branch_id and weekday = v_dow;
  if not found then
    return false;
  end if;
  if h.crosses_midnight then
    return v_min >= extract(hour from h.opens_at)::int * 60 + extract(minute from h.opens_at)::int;
  end if;
  return v_min >= extract(hour from h.opens_at)::int * 60 + extract(minute from h.opens_at)::int
     and v_min < extract(hour from h.closes_at)::int * 60 + extract(minute from h.closes_at)::int;
end
$$;

create function public.touch_updated_at() returns trigger
language plpgsql
as $$ begin new.updated_at := now(); return new; end $$;

create trigger orders_touch_updated_at before update on public.orders
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- customer functions

-- p: {branch_id, order_type, customer_name, phone, zone_id?, street?, building?,
--     apartment?, landmark?, notes?, items: [{size_id, qty}]}
-- Errors are raised with a stable code in the message, e.g. BRANCH_CLOSED.
create function public.place_order(p jsonb) returns jsonb
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
  s record;
begin
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
  v_number := b.code || '-' || lpad(v_seq::text, 4, '0');

  insert into orders (
    order_number, order_date, daily_seq, branch_id, order_type, customer_name, phone,
    zone_id, zone_label, street, building, apartment, landmark, notes,
    subtotal, delivery_fee, service_amount, tax_amount, total, created_at, updated_at)
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
    v_sub, v_fee, v_service, v_tax, v_total, v_now, v_now)
  returning id into v_order_id;

  -- second pass: store the lines with name and price snapshots
  insert into order_items (order_id, item_id, size_id, name_snapshot, size_label_snapshot, unit_price, qty, line_total)
  select v_order_id, i.id, sz.id, i.name_ar, sz.label, sz.price, (l ->> 'qty')::int, sz.price * (l ->> 'qty')::int
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

-- Customers track an order with its number and the phone used to place it (last 3 days).
create function public.track_order(p_order_number text, p_phone text) returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'order_number', o.order_number, 'order_date', o.order_date, 'branch_id', o.branch_id,
    'order_type', o.order_type, 'status', o.status, 'created_at', o.created_at,
    'subtotal', o.subtotal, 'delivery_fee', o.delivery_fee, 'tax_amount', o.tax_amount, 'total', o.total,
    'items', (select jsonb_agg(jsonb_build_object('name', name_snapshot, 'size', size_label_snapshot,
                'qty', qty, 'line_total', line_total) order by id)
              from order_items where order_id = o.id),
    'history', (select jsonb_agg(jsonb_build_object('status', to_status, 'at', changed_at) order by changed_at, id)
                from order_status_history where order_id = o.id))
  from orders o
  where o.order_number = upper(btrim(p_order_number))
    and o.phone = btrim(p_phone)
    and o.created_at > app_now() - interval '3 days'
  order by o.created_at desc
  limit 1
$$;

-- ---------------------------------------------------------------- staff functions

create function public.set_order_status(p_order_id uuid, p_status public.order_status, p_note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  o orders%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into o from orders where id = p_order_id for update;
  if not found or not staff_can_access(o.branch_id) then raise exception 'NOT_ALLOWED'; end if;
  if o.status = 'cancelled' then raise exception 'INVALID_TRANSITION'; end if;
  if p_status = 'cancelled' then
    if v_note is null then raise exception 'CANCEL_REASON_REQUIRED'; end if;
  elsif not ((o.status = 'new' and p_status = 'preparing')
          or (o.status = 'preparing' and p_status = 'out_for_delivery')) then
    raise exception 'INVALID_TRANSITION';
  end if;

  update orders
  set status = p_status,
      cancel_reason = case when p_status = 'cancelled' then v_note else cancel_reason end
  where id = o.id;

  insert into order_status_history (order_id, from_status, to_status, changed_by, note, changed_at)
  values (o.id, o.status, p_status, auth.uid(), v_note, app_now());
end
$$;

create function public.set_pos_invoice(p_order_id uuid, p_invoice text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_branch text;
begin
  select branch_id into v_branch from orders where id = p_order_id;
  if v_branch is null or not staff_can_access(v_branch) then raise exception 'NOT_ALLOWED'; end if;
  update orders set pos_invoice_no = nullif(left(btrim(coalesce(p_invoice, '')), 40), '') where id = p_order_id;
end
$$;

-- ---------------------------------------------------------------- row level security

alter table public.branches enable row level security;
alter table public.branch_hours enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_item_sizes enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.app_settings enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.order_counters enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.notification_log enable row level security;

-- public catalog
create policy branches_read on public.branches for select to anon, authenticated using (is_active or public.is_staff());
create policy branch_hours_read on public.branch_hours for select to anon, authenticated using (true);
create policy menu_categories_read on public.menu_categories for select to anon, authenticated using (is_active or public.is_staff());
create policy menu_items_read on public.menu_items for select to anon, authenticated using (is_active or public.is_staff());
create policy menu_item_sizes_read on public.menu_item_sizes for select to anon, authenticated using (is_available or public.is_staff());
create policy delivery_zones_read on public.delivery_zones for select to anon, authenticated using (is_active or public.is_staff());
create policy app_settings_read on public.app_settings for select to anon, authenticated using (true);

-- admins manage catalog, branches and settings
create policy branches_admin on public.branches for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy branch_hours_admin on public.branch_hours for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy menu_categories_admin on public.menu_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy menu_items_admin on public.menu_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy menu_item_sizes_admin on public.menu_item_sizes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy delivery_zones_admin on public.delivery_zones for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy app_settings_admin on public.app_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- staff
create policy staff_profiles_read on public.staff_profiles for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy staff_profiles_admin on public.staff_profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy orders_staff_read on public.orders for select to authenticated using (public.staff_can_access(branch_id));
create policy order_items_staff_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and public.staff_can_access(o.branch_id)));
create policy order_status_history_staff_read on public.order_status_history for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and public.staff_can_access(o.branch_id)));
create policy notification_log_admin_read on public.notification_log for select to authenticated using (public.is_admin());
-- order_counters: no policy, so no client access at all.

-- function privileges: Supabase grants EXECUTE to anon by default, so narrow it explicitly.
revoke execute on function public.set_order_status(uuid, public.order_status, text) from public, anon;
revoke execute on function public.set_pos_invoice(uuid, text) from public, anon;
grant execute on function public.set_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.set_pos_invoice(uuid, text) to authenticated;
grant execute on function public.place_order(jsonb) to anon, authenticated;
grant execute on function public.track_order(text, text) to anon, authenticated;
grant execute on function public.branch_is_open(text, timestamptz) to anon, authenticated;

-- live order board for the call center
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders;
  end if;
end
$$;

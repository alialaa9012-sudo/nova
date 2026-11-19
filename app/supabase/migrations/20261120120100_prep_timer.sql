-- Preparation timer (agreed with the owner, 20 Nov 2026):
--   * accepting an order (new -> preparing) starts the clock;
--   * pickup: ready in 30 to 45 minutes; delivery: leaves the branch after 45 minutes;
--   * when the time is up the order moves by itself to out_for_delivery ("ready for pickup" /
--     "out for delivery"), every minute through pg_cron; staff may also move it earlier;
--   * staff close it with delivered once the customer has it.

alter table public.orders
  add column ready_from timestamptz, -- earliest time to tell the customer
  add column ready_by timestamptz;   -- the order moves on by itself at this time

-- Minutes after acceptance: {earliest, latest}. One place to change the agreed times.
create function public.prep_window(p_type public.order_type) returns int[]
language sql immutable set search_path = public
as $$ select case p_type when 'pickup' then array[30, 45] else array[45, 45] end $$;

create or replace function public.set_order_status(p_order_id uuid, p_status public.order_status, p_note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  o orders%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_now timestamptz := app_now();
  w int[];
begin
  select * into o from orders where id = p_order_id for update;
  if not found or not staff_can_access(o.branch_id) then raise exception 'NOT_ALLOWED'; end if;
  if o.status in ('cancelled', 'delivered') then raise exception 'INVALID_TRANSITION'; end if;
  if p_status = 'cancelled' then
    if v_note is null then raise exception 'CANCEL_REASON_REQUIRED'; end if;
  elsif not ((o.status = 'new' and p_status = 'preparing')
          or (o.status = 'preparing' and p_status = 'out_for_delivery')
          or (o.status = 'out_for_delivery' and p_status = 'delivered')) then
    raise exception 'INVALID_TRANSITION';
  end if;

  w := prep_window(o.order_type);
  update orders
  set status = p_status,
      cancel_reason = case when p_status = 'cancelled' then v_note else cancel_reason end,
      ready_from = case when p_status = 'preparing' then v_now + make_interval(mins => w[1]) else ready_from end,
      ready_by = case when p_status = 'preparing' then v_now + make_interval(mins => w[2]) else ready_by end
  where id = o.id;

  insert into order_status_history (order_id, from_status, to_status, changed_by, note, changed_at)
  values (o.id, o.status, p_status, auth.uid(), v_note, v_now);
end
$$;

-- Moves every order whose preparation time is up. Run each minute by pg_cron; the board also calls
-- it when a countdown reaches zero, so the change shows without waiting for the next minute.
create function public.advance_due_orders() returns int
language plpgsql security definer set search_path = public
as $$
declare
  n int;
  v_now timestamptz := app_now();
begin
  with due as (
    update orders set status = 'out_for_delivery'
    where status = 'preparing' and ready_by is not null and ready_by <= v_now
    returning id
  )
  insert into order_status_history (order_id, from_status, to_status, note, changed_at)
  select id, 'preparing', 'out_for_delivery', 'تلقائياً بعد انتهاء وقت التجهيز', v_now from due;
  get diagnostics n = row_count;
  return n;
end
$$;

revoke execute on function public.advance_due_orders() from public, anon;
grant execute on function public.advance_due_orders() to authenticated;

-- Customers see the expected time on their order page.
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
  where o.order_number = upper(btrim(p_order_number))
    and o.phone = btrim(p_phone)
    and o.created_at > app_now() - interval '3 days'
  order by o.created_at desc
  limit 1
$$;

-- The every-minute job. pg_cron exists on Supabase, not in the local test database.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('advance-due-orders', '* * * * *', 'select public.advance_due_orders()');
  end if;
end
$$;

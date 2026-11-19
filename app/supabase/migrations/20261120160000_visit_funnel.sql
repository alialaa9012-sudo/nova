-- Visitors who did not order (owner, 20 Nov 2026): how many came each day and where they stopped.
-- Each browser gets a random visit id per day; no name, phone or address is ever recorded.
-- Steps: home (opened the site) -> menu (opened a branch menu) -> cart (added an item)
--        -> checkout (opened the checkout) -> ordered (placed the order).

create table public.visit_events (
  visit_id uuid not null,
  step text not null check (step in ('home', 'menu', 'cart', 'checkout', 'ordered')),
  branch_id text references public.branches (id),
  visit_date date not null,
  created_at timestamptz not null default now()
);
create unique index visit_events_once on public.visit_events (visit_date, visit_id, step, coalesce(branch_id, ''));
alter table public.visit_events enable row level security;
revoke all on public.visit_events from public, anon, authenticated; -- written and read through the functions below

-- Anyone may record a step of their own visit; repeats are ignored, and a visit is capped so a
-- script cannot flood the table.
create function public.log_visit(p_visit uuid, p_step text, p_branch text default null) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_date date := (app_now() at time zone 'Africa/Cairo')::date;
begin
  if p_visit is null or p_step not in ('home', 'menu', 'cart', 'checkout', 'ordered') then return; end if;
  if p_branch is not null and not exists (select 1 from branches where id = p_branch) then return; end if;
  if (select count(*) from visit_events where visit_date = v_date and visit_id = p_visit) >= 20 then return; end if;
  insert into visit_events (visit_id, step, branch_id, visit_date, created_at)
  values (p_visit, p_step, p_branch, v_date, app_now())
  on conflict do nothing;
end
$$;

-- Staff: one day's visitors and the furthest step each one reached. With a branch, only visitors
-- who opened that branch's menu.
create function public.visit_funnel(p_date date, p_branch text default null) returns jsonb
language sql stable security definer set search_path = public
as $$
  with v as (
    select visit_id,
           max(case step when 'home' then 1 when 'menu' then 2 when 'cart' then 3 when 'checkout' then 4 else 5 end) as top
    from visit_events
    where visit_date = p_date
      and (p_branch is null or visit_id in (select visit_id from visit_events where visit_date = p_date and branch_id = p_branch))
    group by visit_id
  )
  select case when is_staff() then jsonb_build_object(
    'visitors', count(*),
    'home', count(*) filter (where top = 1),
    'menu', count(*) filter (where top = 2),
    'cart', count(*) filter (where top = 3),
    'checkout', count(*) filter (where top = 4),
    'ordered', count(*) filter (where top = 5)) end
  from v
$$;

revoke execute on function public.log_visit(uuid, text, text) from public;
grant execute on function public.log_visit(uuid, text, text) to anon, authenticated;
revoke execute on function public.visit_funnel(date, text) from public, anon;
grant execute on function public.visit_funnel(date, text) to authenticated;

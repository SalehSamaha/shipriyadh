-- ShipRiyadh schema
-- Run in the SQL Editor of the NEW ShipRiyadh Supabase project (NOT ICONMUN).

-- ============ TABLES ============

create table public.shops (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  shop_name text not null default '',
  whatsapp_phone text not null default '',          -- digits only, intl format, e.g. 9665XXXXXXXX
  subscription_active boolean not null default false,
  paid_until timestamptz                            -- null = no expiry (manual/free pilot)
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default auth.uid() references public.shops(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,                     -- digits only, intl format (used for wa.me link)
  customer_address text not null,
  tracking_number text,
  status text not null default 'pending' check (status in ('pending', 'shipped')),
  created_at timestamptz not null default now(),
  constraint shipped_requires_tracking
    check (status = 'pending' or tracking_number is not null)
);

create index shipments_shop_id_created_at_idx
  on public.shipments (shop_id, created_at desc);

-- ============ AUTO-CREATE SHOP ROW ON SIGNUP ============
-- Frontend passes shop_name + whatsapp_phone via signUp({ options: { data: {...} } })

create or replace function public.handle_new_shop()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.shops (id, email, shop_name, whatsapp_phone)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'shop_name', ''),
    coalesce(new.raw_user_meta_data ->> 'whatsapp_phone', '')
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_shop() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_shop();

-- ============ COLUMN-LEVEL PRIVILEGES ============
-- RLS limits rows; these limit columns. Without this, a shop could set
-- subscription_active = true or status = 'shipped' on itself.

revoke all on public.shops from anon, authenticated;
grant select on public.shops to authenticated;
grant update (shop_name, whatsapp_phone) on public.shops to authenticated;

revoke all on public.shipments from anon, authenticated;
grant select, delete on public.shipments to authenticated;
grant insert (shop_id, customer_name, customer_phone, customer_address)
  on public.shipments to authenticated;
grant update (customer_name, customer_phone, customer_address)
  on public.shipments to authenticated;

-- ============ RLS ============

alter table public.shops enable row level security;
alter table public.shipments enable row level security;

-- shops: read/update own row only (and only the granted columns)
create policy shops_select_own on public.shops
  for select to authenticated
  using (id = (select auth.uid()));

create policy shops_update_own on public.shops
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- shipments: own rows only
create policy shipments_select_own on public.shipments
  for select to authenticated
  using (shop_id = (select auth.uid()));

-- insert requires an active subscription (you flip it manually for pilot shops)
create policy shipments_insert_own on public.shipments
  for insert to authenticated
  with check (
    shop_id = (select auth.uid())
    and exists (
      select 1 from public.shops s
      where s.id = (select auth.uid())
        and s.subscription_active
        and (s.paid_until is null or s.paid_until > now())
    )
  );

-- shops can only edit/delete while still pending
create policy shipments_update_own_pending on public.shipments
  for update to authenticated
  using (shop_id = (select auth.uid()) and status = 'pending')
  with check (shop_id = (select auth.uid()) and status = 'pending');

create policy shipments_delete_own_pending on public.shipments
  for delete to authenticated
  using (shop_id = (select auth.uid()) and status = 'pending');

-- ============ ADMIN (YOU) ============
-- Day 1: use the Supabase Table Editor / SQL Editor (runs as postgres, bypasses RLS + grants):
--   update public.shops set subscription_active = true where email = '...';
--   update public.shipments set tracking_number = '...', status = 'shipped' where id = '...';

-- Migration: Add Stationery and Book Store Management Tables

-- 1. INVENTORY TABLE
create table if not exists public.inventory (
  id bigint generated always as identity primary key,
  retailer_id uuid references public.profiles(id) on delete cascade not null,
  item_name text not null,
  category text not null check (category in ('books', 'pens', 'notebooks', 'art_supplies', 'other')),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  selling_price numeric(12,2) not null default 0 check (selling_price >= 0),
  low_stock_threshold integer not null default 5,
  created_at timestamptz default now()
);

-- Enable RLS for inventory
alter table public.inventory enable row level security;

create policy "Retailers can manage their own inventory"
  on public.inventory for all
  using (auth.uid() = retailer_id);


-- 2. STATIONERY SALES TABLE (For instant counter sales)
create table if not exists public.stationery_sales (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid references public.profiles(id) on delete cascade not null,
  item_id bigint references public.inventory(id) on delete cascade not null,
  quantity_sold integer not null check (quantity_sold > 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  created_at timestamptz default now()
);

-- Enable RLS for stationery_sales
alter table public.stationery_sales enable row level security;

create policy "Retailers can manage their own stationery sales"
  on public.stationery_sales for all
  using (auth.uid() = retailer_id);


-- 3. TRIGGER FOR AUTO-DECREMENTING STOCK ON SALE
create or replace function public.decrement_inventory_stock()
returns trigger as $$
begin
  update public.inventory
  set stock_quantity = stock_quantity - NEW.quantity_sold
  where id = NEW.item_id;
  return NEW;
end;
$$ language plpgsql;

create or replace trigger trg_decrement_stock
after insert on public.stationery_sales
for each row execute function public.decrement_inventory_stock();

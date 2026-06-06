-- Apply this in the Supabase SQL editor before using profile isolation.
-- Existing shared rows cannot be safely assigned automatically; set user_id manually
-- for any old data you want to keep, then make the columns NOT NULL if desired.

alter table if exists products add column if not exists user_id text references users(id) on delete cascade;
alter table if exists sales add column if not exists user_id text references users(id) on delete cascade;
alter table if exists customers add column if not exists user_id text references users(id) on delete cascade;
alter table if exists categories add column if not exists user_id text references users(id) on delete cascade;
alter table if exists brands add column if not exists user_id text references users(id) on delete cascade;
alter table if exists settings add column if not exists user_id text references users(id) on delete cascade;

create index if not exists products_user_id_idx on products(user_id);
create index if not exists sales_user_id_idx on sales(user_id);
create index if not exists customers_user_id_idx on customers(user_id);
create index if not exists categories_user_id_idx on categories(user_id);
create index if not exists brands_user_id_idx on brands(user_id);
create index if not exists settings_user_id_idx on settings(user_id);

create unique index if not exists settings_user_id_unique_idx on settings(user_id);

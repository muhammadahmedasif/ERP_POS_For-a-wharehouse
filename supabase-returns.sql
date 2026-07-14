-- Run this in the Supabase SQL Editor to add return tracking columns to the sales table.
-- Safe to run multiple times (uses IF NOT EXISTS).

alter table if exists sales add column if not exists returned_items jsonb default '[]'::jsonb;
alter table if exists sales add column if not exists return_amount numeric default 0;
alter table if exists sales add column if not exists return_date text;

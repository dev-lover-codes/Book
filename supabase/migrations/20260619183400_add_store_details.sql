-- Migration: Add store and user profile columns
alter table public.profiles
  add column if not exists business_address text,
  add column if not exists business_category text,
  add column if not exists business_gstin text,
  add column if not exists business_upi text,
  add column if not exists business_phone text,
  add column if not exists address text,
  add column if not exists email text,
  add column if not exists notes text;

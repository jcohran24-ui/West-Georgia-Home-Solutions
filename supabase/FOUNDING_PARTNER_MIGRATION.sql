-- Run once in Supabase SQL Editor before deploying this update.
alter table public.contractors add column if not exists service_area text;
alter table public.contractors add column if not exists license_number text;
alter table public.contractors add column if not exists insured boolean;
alter table public.contractors add column if not exists max_leads_per_week integer default 3;
alter table public.contractors add column if not exists notes text;
alter table public.contractors add column if not exists founding_partner boolean default false;
alter table public.contractors add column if not exists free_leads_remaining integer default 3;

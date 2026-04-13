-- Migration 006: Enable Row Level Security (RLS) to secure public tables

-- 1. Enable RLS on all tables mentioned in the Supabase Security Advisor
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 2. (Optional but recommended) Explicitly drop any open permissive policies if they accidentally existed
DROP POLICY IF EXISTS "Allow public read access" ON public.users;
DROP POLICY IF EXISTS "Allow public read access" ON public.portfolios;
DROP POLICY IF EXISTS "Allow public read access" ON public.kyc_data;
DROP POLICY IF EXISTS "Allow public read access" ON public.user_tokens;
DROP POLICY IF EXISTS "Allow public read access" ON public.beta_whitelist;
DROP POLICY IF EXISTS "Allow public read access" ON public.orders;

-- 3. Force RLS to apply even to table owners (adds an extra layer of strictness for the PostgREST API)
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios FORCE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_data FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE public.beta_whitelist FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;
-- Step 1: safe hardening. Removes only access the Luna app does not use.
-- Safe to run at any time; the app keeps working exactly as before.
-- Run in Supabase Dashboard > SQL Editor (Personal project).

-- Public key can no longer write investment or property history
-- (sync workflows use the service role key, which ignores these policies).
drop policy if exists "anon insert stocks_crypto" on public.stocks_crypto_history;
drop policy if exists "anon update stocks_crypto" on public.stocks_crypto_history;
drop policy if exists "anon insert real_estate" on public.real_estate_history;
drop policy if exists "anon update real_estate" on public.real_estate_history;

-- app_config holds the old training editor PIN hash; the app never reads it.
drop policy if exists "anon read app_config" on public.app_config;

-- Admin functions the app never calls.
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
revoke execute on function public.refresh_dashboard_summary() from anon, authenticated, public;
revoke execute on function public.refresh_monthly_summary() from anon, authenticated, public;

-- Pin function search paths (Supabase advisor warning).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_dashboard_stats','keep_manual_category','apply_category_mapping',
                        'get_net_remaining','auto_categorize_transaction','get_cycles_by_date',
                        'update_updated_at_column')
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
  end loop;
end $$;

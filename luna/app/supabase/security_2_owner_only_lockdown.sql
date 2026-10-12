-- Step 2: owner only lockdown.
-- Run ONLY after the email login version of Luna is live and you have
-- signed in successfully once. After this, the public key alone can read
-- and write nothing; only Fernando's signed in account can.
-- Sync workflows keep working because they use the service role key.
-- Run in Supabase Dashboard > SQL Editor (Personal project).

begin;

-- 1. Remove every policy that grants access to anon, public or authenticated.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (roles && array['anon','public','authenticated']::name[])
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 2. One policy per table: only the owner's signed in account.
do $$
declare t record;
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', t.relname);
    execute format(
      'create policy owner_only on public.%I for all to authenticated
         using ((select auth.jwt() ->> ''email'') = ''fernandopv2655@gmail.com'')
         with check ((select auth.jwt() ->> ''email'') = ''fernandopv2655@gmail.com'')',
      t.relname);
  end loop;
end $$;

-- 3. The public key gets no table access at all.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- 4. Views respect row rules of the person asking, not the view owner.
do $$
declare v record;
begin
  for v in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
  loop
    execute format('alter view public.%I set (security_invoker = on)', v.relname);
  end loop;
end $$;

-- 5. Functions the app calls: signed in only.
revoke execute on function public.dismiss_finance_alert(bigint, boolean) from anon, public;
revoke execute on function public.recategorize_transaction(bigint, text, text) from anon, public;
grant execute on function public.dismiss_finance_alert(bigint, boolean) to authenticated;
grant execute on function public.recategorize_transaction(bigint, text, text) to authenticated;
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_dashboard_stats'
  loop
    execute format('revoke execute on function %s from anon, public', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

commit;

-- To undo in an emergency (reopens public read, the old behavior):
--   grant select on all tables in schema public to anon;
--   and recreate an anon select policy on the tables you need.

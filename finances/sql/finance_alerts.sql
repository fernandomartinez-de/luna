-- Finance alerts: written by finances/scripts/finance_alerts.py after each
-- Plaid sync, read by Luna's Alerts card.

create table if not exists public.finance_alerts (
  id              bigserial primary key,
  alert_key       text not null unique,          -- dedupe: one alert per finding
  alert_type      text not null,                 -- duplicate | subscription_new | subscription_change | fee | fixed_increase | returned_payment
  severity        text not null default 'medium' check (severity in ('high', 'medium', 'low')),
  title           text not null,
  detail          text,
  merchant        text,
  amount          numeric,
  txn_date        date,
  transaction_ids bigint[] not null default '{}',
  status          text not null default 'open' check (status in ('open', 'dismissed')),
  created_at      timestamptz not null default now(),
  notified_at     timestamptz,
  dismissed_at    timestamptz
);

create index if not exists finance_alerts_open_idx on public.finance_alerts (status, txn_date desc);

-- "Don't alert me about this again" for a merchant and alert type.
create table if not exists public.finance_alert_mutes (
  id          bigserial primary key,
  alert_type  text not null,
  merchant    text not null,
  created_at  timestamptz not null default now(),
  unique (alert_type, merchant)
);

alter table public.finance_alerts enable row level security;
alter table public.finance_alert_mutes enable row level security;

drop policy if exists "Allow anon read access" on public.finance_alerts;
create policy "Allow anon read access" on public.finance_alerts for select to anon, authenticated using (true);
drop policy if exists "Allow service role full access" on public.finance_alerts;
create policy "Allow service role full access" on public.finance_alerts for all to service_role using (true) with check (true);
drop policy if exists "Allow service role full access" on public.finance_alert_mutes;
create policy "Allow service role full access" on public.finance_alert_mutes for all to service_role using (true) with check (true);

-- The only write path from the app: dismiss an alert, optionally muting
-- future alerts of the same type for the same merchant.
create or replace function public.dismiss_finance_alert(p_id bigint, p_mute boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a finance_alerts%rowtype;
begin
  update finance_alerts
     set status = 'dismissed', dismissed_at = now()
   where id = p_id
   returning * into a;
  if not found then
    raise exception 'Alert % not found', p_id;
  end if;

  if p_mute and a.merchant is not null then
    insert into finance_alert_mutes (alert_type, merchant)
    values (a.alert_type, a.merchant)
    on conflict do nothing;
    update finance_alerts
       set status = 'dismissed', dismissed_at = now()
     where status = 'open' and alert_type = a.alert_type and merchant = a.merchant;
  end if;

  return jsonb_build_object('id', p_id, 'muted', p_mute and a.merchant is not null);
end;
$$;

revoke all on function public.dismiss_finance_alert(bigint, boolean) from public;
grant execute on function public.dismiss_finance_alert(bigint, boolean) to anon, authenticated;

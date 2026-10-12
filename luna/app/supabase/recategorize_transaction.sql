-- Manual recategorization from Luna's transactions modal.
--
-- 1. category_manual marks a category the user picked by hand.
-- 2. A trigger keeps that category when the Plaid sync re-upserts a
--    modified transaction (e.g. pending -> posted), since the sync
--    recomputes category from category_mapping on every upsert.
-- 3. recategorize_transaction() is the only write path the app uses. It
--    can change category and nothing else, and can optionally save a
--    category_mapping rule and apply it to matching uncategorized rows.

alter table public.expense_transactions
  add column if not exists category_manual boolean not null default false;

create or replace function public.keep_manual_category()
returns trigger
language plpgsql
as $$
begin
  if old.category_manual
     and new.category is distinct from old.category
     and coalesce(current_setting('luna.manual_category', true), '') <> 'on' then
    new.category := old.category;
    new.category_manual := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_keep_manual_category on public.expense_transactions;
create trigger trg_keep_manual_category
  before update on public.expense_transactions
  for each row execute function public.keep_manual_category();

create or replace function public.recategorize_transaction(
  p_id bigint,
  p_category text,
  p_remember_pattern text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category text := nullif(btrim(p_category), '');
  v_pattern  text := nullif(upper(btrim(coalesce(p_remember_pattern, ''))), '');
  v_applied  int := 0;
begin
  if v_category is not null and length(v_category) > 60 then
    raise exception 'Category name too long';
  end if;
  if v_pattern is not null and length(v_pattern) < 3 then
    raise exception 'Rule text must be at least 3 characters';
  end if;

  perform set_config('luna.manual_category', 'on', true);

  update expense_transactions
     set category = v_category,
         category_manual = (v_category is not null)
   where id = p_id;
  if not found then
    raise exception 'Transaction % not found', p_id;
  end if;

  if v_pattern is not null and v_category is not null then
    insert into category_mapping (category, pattern, pattern_type, priority, notes)
    values (v_category, v_pattern, 'contains', 50, 'Added from Luna');

    update expense_transactions
       set category = v_category
     where category is null
       and upper(description) like '%' || v_pattern || '%';
    get diagnostics v_applied = row_count;
  end if;

  return jsonb_build_object('id', p_id, 'category', v_category, 'also_applied', v_applied);
end;
$$;

revoke all on function public.recategorize_transaction(bigint, text, text) from public;
grant execute on function public.recategorize_transaction(bigint, text, text) to anon, authenticated;

-- =============================================================================
-- Luna database schema (Supabase / Postgres)
-- =============================================================================
-- Recreates every table, view, function, trigger and security rule Luna and the
-- sync workflows use. Generated from the live project in Oct 2026.
--
-- How to use (new Supabase project):
--   1. Find and replace  you@example.com  with the email you will sign in with.
--   2. Supabase dashboard -> SQL Editor -> New query -> paste this file -> Run.
--   3. Follow docs/setup.md for the Auth settings.
--
-- Safe to run more than once: everything uses "if not exists" or "or replace".
-- No data is included.
-- =============================================================================

create extension if not exists pgcrypto;


-- -----------------------------------------------------------------------------
-- Sequences (for tables that use serial ids)
-- -----------------------------------------------------------------------------
create sequence if not exists public.category_mapping_id_seq;
create sequence if not exists public.completed_workout_exercises_id_seq;
create sequence if not exists public.exercises_id_seq;
create sequence if not exists public.expense_transactions_id_seq;
create sequence if not exists public.finance_alert_mutes_id_seq;
create sequence if not exists public.finance_alerts_id_seq;
create sequence if not exists public.inbody_results_id_seq;
create sequence if not exists public.lab_results_id_seq;
create sequence if not exists public.real_estate_history_id_seq;
create sequence if not exists public.stocks_crypto_history_id_seq;
create sequence if not exists public.whoop_body_id_seq;
create sequence if not exists public.workout_exercises_id_seq;
create sequence if not exists public.workouts_id_seq;


-- =============================================================================
-- Finance
-- =============================================================================

-- Bank and credit card transactions (Chase via Plaid, daily).
create table if not exists public.expense_transactions (
    id bigint default nextval('expense_transactions_id_seq'::regclass) not null,
    transaction_date date not null,
    post_date date,
    description text not null,
    amount numeric(10,2) not null,
    category text,
    source text not null,
    month text not null,
    created_at timestamp with time zone default now(),
    plaid_transaction_id text,
    category_manual boolean default false not null,
    constraint expense_transactions_pkey primary key (id),
    constraint expense_transactions_plaid_transaction_id_key unique (plaid_transaction_id)
);

-- Rules that assign a category from the transaction description.
create table if not exists public.category_mapping (
    id integer default nextval('category_mapping_id_seq'::regclass) not null,
    category text not null,
    pattern text not null,
    pattern_type text not null,
    priority integer default 100,
    notes text,
    created_at timestamp without time zone default now(),
    updated_at timestamp without time zone default now(),
    constraint category_mapping_pkey primary key (id),
    constraint category_mapping_pattern_pattern_type_key unique (pattern, pattern_type),
    constraint category_mapping_pattern_type_check check (pattern_type = any (array['exact','contains','starts_with','regex']))
);

-- Plaid account ids and their masked labels.
create table if not exists public.plaid_accounts (
    account_id text not null,
    item_id text,
    name text,
    official_name text,
    mask text,
    type text,
    subtype text,
    source_code text,
    updated_at timestamp with time zone default now(),
    constraint plaid_accounts_pkey primary key (account_id)
);

-- Where the Plaid transaction sync left off.
create table if not exists public.plaid_sync_state (
    item_id text not null,
    cursor text,
    institution_name text,
    last_synced_at timestamp with time zone,
    created_at timestamp with time zone default now(),
    constraint plaid_sync_state_pkey primary key (item_id)
);

-- Daily holdings snapshots (stocks, crypto, retirement, brokerage).
create table if not exists public.stocks_crypto_history (
    id integer default nextval('stocks_crypto_history_id_seq'::regclass) not null,
    snapshot_date date not null,
    asset_type character varying(20) not null,
    asset_name character varying(50) not null,
    quantity numeric(18,8) not null,
    price_per_unit numeric(12,2) not null,
    total_value numeric(12,2) not null,
    cost_basis numeric(12,2) not null,
    unrealized_gain_loss numeric(12,2),
    created_at timestamp without time zone default now(),
    constraint stocks_crypto_history_pkey primary key (id),
    constraint stocks_crypto_history_snapshot_date_asset_name_key unique (snapshot_date, asset_name),
    constraint stocks_crypto_history_asset_type_check check ((asset_type)::text = any (array['Stock','Crypto','Retirement','Brokerage']))
);

-- Home value and mortgage snapshots (Zillow and Redfin).
create table if not exists public.real_estate_history (
    id integer default nextval('real_estate_history_id_seq'::regclass) not null,
    snapshot_date date not null,
    asset_name character varying(100) not null,
    asset_type character varying(50) default 'Real Estate' not null,
    home_value numeric(12,2) not null,
    mortgage_balance numeric(12,2) default 0,
    net_equity numeric(12,2) not null,
    cost_basis numeric(12,2) not null,
    unrealized_gain_loss numeric(12,2),
    location character varying(200),
    notes text,
    created_at timestamp with time zone default now(),
    data_source character varying(20) default 'Redfin',
    constraint real_estate_history_pkey primary key (id),
    constraint real_estate_history_unique_snapshot unique (snapshot_date, asset_name, data_source)
);

-- Money alerts (double charges, new subscriptions, fees...) shown in Luna.
create table if not exists public.finance_alerts (
    id bigint default nextval('finance_alerts_id_seq'::regclass) not null,
    alert_key text not null,
    alert_type text not null,
    severity text default 'medium' not null,
    title text not null,
    detail text,
    merchant text,
    amount numeric,
    txn_date date,
    transaction_ids bigint[] default '{}'::bigint[] not null,
    status text default 'open' not null,
    created_at timestamp with time zone default now() not null,
    notified_at timestamp with time zone,
    dismissed_at timestamp with time zone,
    constraint finance_alerts_pkey primary key (id),
    constraint finance_alerts_alert_key_key unique (alert_key),
    constraint finance_alerts_severity_check check (severity = any (array['high','medium','low'])),
    constraint finance_alerts_status_check check (status = any (array['open','dismissed']))
);

-- Alert types muted per merchant.
create table if not exists public.finance_alert_mutes (
    id bigint default nextval('finance_alert_mutes_id_seq'::regclass) not null,
    alert_type text not null,
    merchant text not null,
    created_at timestamp with time zone default now() not null,
    constraint finance_alert_mutes_pkey primary key (id),
    constraint finance_alert_mutes_alert_type_merchant_key unique (alert_type, merchant)
);


-- =============================================================================
-- Health: WHOOP and body composition
-- =============================================================================

create table if not exists public.whoop_recovery (
    cycle_id text not null,
    recovery_score numeric,
    resting_heart_rate numeric,
    hrv_rmssd_milli numeric,
    spo2_percentage numeric,
    skin_temp_celsius numeric,
    inserted_at timestamp with time zone default now(),
    recovery_date date,
    constraint whoop_recovery_pkey primary key (cycle_id)
);

create table if not exists public.whoop_cycles (
    cycle_id text not null,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    strain numeric,
    average_heart_rate integer,
    max_heart_rate integer,
    kilojoules numeric,
    calories_kcal numeric,
    inserted_at timestamp with time zone default now(),
    constraint whoop_cycles_pkey primary key (cycle_id)
);

create table if not exists public.whoop_sleep (
    sleep_id text not null,
    cycle_id text,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    duration_minutes numeric,
    performance_percentage numeric,
    sleep_efficiency_percentage numeric,
    light_sleep_minutes numeric,
    slow_wave_sleep_minutes numeric,
    rem_sleep_minutes numeric,
    awake_minutes numeric,
    inserted_at timestamp with time zone default now(),
    constraint whoop_sleep_pkey primary key (sleep_id)
);

create table if not exists public.whoop_workouts (
    workout_id text not null,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    sport_name text,
    strain numeric,
    average_heart_rate integer,
    max_heart_rate integer,
    kilojoules numeric,
    calories_kcal numeric,
    inserted_at timestamp with time zone default now(),
    constraint whoop_workouts_pkey primary key (workout_id)
);

create table if not exists public.whoop_body (
    id integer default nextval('whoop_body_id_seq'::regclass) not null,
    recorded_at timestamp with time zone default now(),
    height_meter numeric,
    weight_kilogram numeric,
    max_heart_rate integer,
    vo2_max numeric,
    constraint whoop_body_pkey primary key (id)
);

-- Smart scale readings (Renpho, daily).
create table if not exists public.body_composition (
    id bigint generated always as identity not null,
    measured_at timestamp with time zone not null,
    weight_kg numeric(6,2),
    bmi numeric(5,2),
    body_fat_pct numeric(5,2),
    muscle_mass_kg numeric(6,2),
    skeletal_muscle_pct numeric(5,2),
    water_pct numeric(5,2),
    protein_pct numeric(5,2),
    visceral_fat numeric(5,1),
    bone_mass_kg numeric(5,2),
    bmr_kcal integer,
    metabolic_age integer,
    source text default 'renpho' not null,
    raw jsonb,
    created_at timestamp with time zone default now() not null,
    muscle_pct numeric(5,2),
    constraint body_composition_pkey primary key (id),
    constraint body_composition_measured_at_key unique (measured_at)
);


-- =============================================================================
-- Medical (column names are in Spanish, matching the source lab reports)
-- =============================================================================

-- One row per lab marker per report.
create table if not exists public.lab_results (
    id bigint default nextval('lab_results_id_seq'::regclass) not null,
    fecha date,
    "año" integer,
    archivo text,
    proveedor text,
    panel text,
    marcador text,
    valor numeric(12,4),
    unidad text,
    ref_min numeric(12,4),
    ref_max numeric(12,4),
    flag text,
    estimulada boolean,
    conversion_aplicada text,
    revision_requerida boolean,
    created_at timestamp with time zone default now(),
    constraint lab_results_pkey primary key (id)
);

-- InBody body scan snapshots.
create table if not exists public.inbody_results (
    id integer default nextval('inbody_results_id_seq'::regclass) not null,
    fecha date not null,
    archivo character varying(255),
    peso numeric,
    mme numeric,
    masa_grasa numeric,
    pgc numeric,
    mlg numeric,
    agua numeric,
    tmb integer,
    score integer,
    angulo_fase numeric,
    grasa_visceral integer,
    rel_cintura_cadera numeric,
    imc numeric,
    peso_ideal numeric,
    control_peso numeric,
    control_grasa numeric,
    control_musculo numeric,
    dispositivo character varying(100),
    proveedor character varying(255),
    created_at timestamp with time zone default now(),
    constraint inbody_results_pkey primary key (id),
    constraint inbody_results_fecha_key unique (fecha)
);


-- =============================================================================
-- Nutrition
-- =============================================================================

create table if not exists public.nutrition_log (
    id bigint generated always as identity not null,
    logged_date date not null,
    meal text,
    item text not null,
    quantity text,
    calories_kcal numeric(7,1) not null,
    protein_g numeric(6,1),
    carbs_g numeric(6,1),
    fat_g numeric(6,1),
    fiber_g numeric(6,1),
    source text default 'chat' not null,
    note text,
    created_at timestamp with time zone default now() not null,
    constraint nutrition_log_pkey primary key (id)
);

create table if not exists public.meal_templates (
    id bigint generated always as identity not null,
    meal text not null,
    name text not null,
    items text not null,
    calories numeric(7,1) not null,
    protein_g numeric(6,1) default 0,
    carbs_g numeric(6,1) default 0,
    fat_g numeric(6,1) default 0,
    tags text[] default '{}'::text[],
    active boolean default true,
    created_at timestamp with time zone default now(),
    constraint meal_templates_pkey primary key (id)
);

create table if not exists public.meal_plan (
    id bigint generated always as identity not null,
    plan_date date not null,
    meal text not null,
    item text not null,
    note text,
    created_at timestamp with time zone default now(),
    constraint meal_plan_pkey primary key (id)
);


-- =============================================================================
-- Training
-- =============================================================================

-- Exercise library (about 870 rows, imported once).
create table if not exists public.exercises (
    id integer default nextval('exercises_id_seq'::regclass) not null,
    name character varying(255) not null,
    slug character varying(255) not null,
    muscle_group character varying(50) not null,
    secondary_muscles text[],
    equipment character varying(100),
    category character varying(50),
    force character varying(50),
    level character varying(50),
    mechanic character varying(50),
    instructions text[],
    images text[],
    source_id character varying(255),
    created_at timestamp with time zone default now(),
    constraint exercises_pkey primary key (id),
    constraint exercises_slug_key unique (slug)
);

-- Saved workout templates and their exercises.
create table if not exists public.workouts (
    id integer default nextval('workouts_id_seq'::regclass) not null,
    name character varying(255) not null,
    description text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    constraint workouts_pkey primary key (id)
);

create table if not exists public.workout_exercises (
    id integer default nextval('workout_exercises_id_seq'::regclass) not null,
    workout_id integer not null,
    exercise_id integer not null,
    order_index integer default 0 not null,
    sets integer default 3,
    reps integer default 10,
    notes text,
    created_at timestamp with time zone default now(),
    weight numeric,
    set_details jsonb,
    constraint workout_exercises_pkey primary key (id),
    constraint workout_exercises_workout_id_exercise_id_key unique (workout_id, exercise_id)
);

-- Workouts actually performed (optionally linked to a WHOOP workout).
create table if not exists public.completed_workouts (
    id bigint generated always as identity not null,
    workout_id integer,
    workout_name text,
    whoop_workout_id text,
    sport_name text,
    performed_at timestamp with time zone not null,
    strain numeric,
    calories_kcal numeric,
    notes text,
    created_at timestamp with time zone default now() not null,
    constraint completed_workouts_pkey primary key (id),
    constraint completed_workouts_whoop_workout_id_key unique (whoop_workout_id)
);

create table if not exists public.completed_workout_exercises (
    id integer default nextval('completed_workout_exercises_id_seq'::regclass) not null,
    completed_workout_id integer,
    exercise_id integer,
    order_index integer,
    set_details jsonb,
    constraint completed_workout_exercises_pkey primary key (id)
);

-- Weekly plan and run log.
create table if not exists public.training_plan (
    dow text not null,
    training_type text,
    load text,
    notes text,
    updated_at timestamp with time zone default now(),
    constraint training_plan_pkey primary key (dow)
);

create table if not exists public.running_log (
    run_date date not null,
    distance_km numeric,
    updated_at timestamp with time zone default now() not null,
    constraint running_log_pkey primary key (run_date)
);

-- Legacy strength log (kept for history; nothing writes to it today).
create table if not exists public.strength_exercises (
    exercise_id bigint generated always as identity not null,
    name text not null,
    equipment text,
    primary_muscle text,
    default_category text,
    created_at timestamp with time zone default now() not null,
    constraint strength_exercises_pkey primary key (exercise_id),
    constraint strength_exercises_name_key unique (name)
);

create table if not exists public.strength_sessions (
    session_id bigint generated always as identity not null,
    session_date date not null,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    category text,
    whoop_workout_id text,
    source text default 'whoop' not null,
    notes text,
    created_at timestamp with time zone default now() not null,
    constraint strength_sessions_pkey primary key (session_id),
    constraint strength_sessions_whoop_workout_id_key unique (whoop_workout_id)
);

create table if not exists public.strength_sets (
    set_id bigint generated always as identity not null,
    session_id bigint not null,
    exercise_id bigint not null,
    order_index integer not null,
    set_number integer not null,
    reps integer not null,
    weight_kg numeric(6,2) not null,
    is_warmup boolean default false not null,
    volume_kg numeric(10,2) generated always as ((reps)::numeric * weight_kg) stored,
    created_at timestamp with time zone default now() not null,
    constraint strength_sets_pkey primary key (set_id),
    constraint strength_sets_session_id_exercise_id_set_number_key unique (session_id, exercise_id, set_number)
);

create table if not exists public.strength_ingest_log (
    file_id text not null,
    session_id bigint,
    status text not null,
    note text,
    processed_at timestamp with time zone default now() not null,
    constraint strength_ingest_log_pkey primary key (file_id)
);


-- =============================================================================
-- Config
-- =============================================================================

create table if not exists public.app_config (
    key text not null,
    value text not null,
    updated_at timestamp with time zone default now() not null,
    constraint app_config_pkey primary key (key)
);


-- =============================================================================
-- Foreign keys
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'completed_workout_exercises_completed_workout_id_fkey') then
    alter table public.completed_workout_exercises add constraint completed_workout_exercises_completed_workout_id_fkey foreign key (completed_workout_id) references completed_workouts(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'completed_workout_exercises_exercise_id_fkey') then
    alter table public.completed_workout_exercises add constraint completed_workout_exercises_exercise_id_fkey foreign key (exercise_id) references exercises(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'completed_workouts_workout_id_fkey') then
    alter table public.completed_workouts add constraint completed_workouts_workout_id_fkey foreign key (workout_id) references workouts(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'strength_ingest_log_session_id_fkey') then
    alter table public.strength_ingest_log add constraint strength_ingest_log_session_id_fkey foreign key (session_id) references strength_sessions(session_id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'strength_sessions_whoop_workout_id_fkey') then
    alter table public.strength_sessions add constraint strength_sessions_whoop_workout_id_fkey foreign key (whoop_workout_id) references whoop_workouts(workout_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'strength_sets_exercise_id_fkey') then
    alter table public.strength_sets add constraint strength_sets_exercise_id_fkey foreign key (exercise_id) references strength_exercises(exercise_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'strength_sets_session_id_fkey') then
    alter table public.strength_sets add constraint strength_sets_session_id_fkey foreign key (session_id) references strength_sessions(session_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workout_exercises_exercise_id_fkey') then
    alter table public.workout_exercises add constraint workout_exercises_exercise_id_fkey foreign key (exercise_id) references exercises(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workout_exercises_workout_id_fkey') then
    alter table public.workout_exercises add constraint workout_exercises_workout_id_fkey foreign key (workout_id) references workouts(id) on delete cascade;
  end if;
end $$;


-- =============================================================================
-- Indexes
-- =============================================================================

create index if not exists idx_body_comp_measured on public.body_composition using btree (measured_at);
create index if not exists completed_workouts_performed_at_idx on public.completed_workouts using btree (performed_at desc);
create index if not exists idx_exercises_muscle_group on public.exercises using btree (muscle_group);
create index if not exists idx_exercises_category on public.exercises using btree (category);
create index if not exists idx_exercises_equipment on public.exercises using btree (equipment);
create index if not exists idx_expense_date on public.expense_transactions using btree (transaction_date desc);
create index if not exists idx_expense_month on public.expense_transactions using btree (month);
create index if not exists idx_expense_category on public.expense_transactions using btree (category);
create index if not exists finance_alerts_open_idx on public.finance_alerts using btree (status, txn_date desc);
create index if not exists idx_lab_results_panel on public.lab_results using btree (panel);
create unique index if not exists lab_results_dedup on public.lab_results using btree (archivo, marcador, fecha, valor) where (fecha is not null);
create index if not exists idx_lab_results_marcador on public.lab_results using btree (marcador);
create index if not exists idx_lab_results_fecha on public.lab_results using btree (fecha);
create index if not exists idx_nutrition_log_date on public.nutrition_log using btree (logged_date);
create index if not exists idx_real_estate_asset_name on public.real_estate_history using btree (asset_name);
create index if not exists idx_real_estate_snapshot_date on public.real_estate_history using btree (snapshot_date desc);
create index if not exists idx_stocks_crypto_type on public.stocks_crypto_history using btree (asset_type);
create index if not exists idx_stocks_crypto_asset on public.stocks_crypto_history using btree (asset_name);
create index if not exists idx_stocks_crypto_date on public.stocks_crypto_history using btree (snapshot_date);
create index if not exists idx_strength_sessions_date on public.strength_sessions using btree (session_date);
create index if not exists idx_strength_sets_session on public.strength_sets using btree (session_id);
create index if not exists idx_strength_sets_exercise on public.strength_sets using btree (exercise_id);
create index if not exists idx_workout_exercises_exercise_id on public.workout_exercises using btree (exercise_id);
create index if not exists idx_workout_exercises_workout_id on public.workout_exercises using btree (workout_id);
create index if not exists idx_workout_exercises_order on public.workout_exercises using btree (workout_id, order_index);


-- =============================================================================
-- Functions and triggers
-- =============================================================================

-- Returns the category for a transaction description, using category_mapping.
create or replace function public.apply_category_mapping(transaction_desc text)
 returns text language plpgsql immutable
 set search_path to 'public', 'pg_temp'
as $function$
declare
    matched_category text;
    rule record;
begin
    for rule in
        select pattern, category, pattern_type
        from category_mapping
        order by priority asc, id asc
    loop
        case rule.pattern_type
            when 'exact' then
                if upper(transaction_desc) = upper(rule.pattern) then
                    matched_category := rule.category; exit;
                end if;
            when 'contains' then
                if upper(transaction_desc) like '%' || upper(rule.pattern) || '%' then
                    matched_category := rule.category; exit;
                end if;
            when 'starts_with' then
                if upper(transaction_desc) like upper(rule.pattern) || '%' then
                    matched_category := rule.category; exit;
                end if;
            else null;
        end case;
    end loop;
    return matched_category;
end;
$function$;

-- Categorizes new transactions automatically.
create or replace function public.auto_categorize_transaction()
 returns trigger language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
    if new.category is null or new.category = 'Uncategorized' then
        new.category := apply_category_mapping(new.description);
    end if;
    return new;
end;
$function$;

-- Keeps a category you set by hand from being overwritten by a later sync.
create or replace function public.keep_manual_category()
 returns trigger language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if old.category_manual
     and new.category is distinct from old.category
     and coalesce(current_setting('luna.manual_category', true), '') <> 'on' then
    new.category := old.category;
    new.category_manual := true;
  end if;
  return new;
end;
$function$;

create or replace function public.update_updated_at_column()
 returns trigger language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists trigger_auto_categorize on public.expense_transactions;
create trigger trigger_auto_categorize before insert or update on public.expense_transactions
  for each row execute function auto_categorize_transaction();

drop trigger if exists trg_keep_manual_category on public.expense_transactions;
create trigger trg_keep_manual_category before update on public.expense_transactions
  for each row execute function keep_manual_category();

drop trigger if exists update_workouts_updated_at on public.workouts;
create trigger update_workouts_updated_at before update on public.workouts
  for each row execute function update_updated_at_column();

-- Called from Luna when you change a transaction's category (optionally saving a rule).
create or replace function public.recategorize_transaction(p_id bigint, p_category text, p_remember_pattern text default null)
 returns jsonb language plpgsql security definer
 set search_path to 'public'
as $function$
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
$function$;

-- Called from Luna when you dismiss (and optionally mute) a money alert.
create or replace function public.dismiss_finance_alert(p_id bigint, p_mute boolean default false)
 returns jsonb language plpgsql security definer
 set search_path to 'public'
as $function$
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
$function$;

create or replace function public.get_cycles_by_date(start_d date, end_d date)
 returns table(d date, strain numeric, kilojoules numeric, average_heart_rate integer, max_heart_rate integer)
 language sql stable
 set search_path to 'public', 'pg_temp'
as $function$
    select (start_time at time zone 'UTC')::date as d, strain, kilojoules, average_heart_rate, max_heart_rate
    from public.whoop_cycles
    where (start_time at time zone 'UTC')::date between start_d and end_d
    order by start_time;
$function$;


-- =============================================================================
-- Views (spending summaries for the Expenses tab)
-- =============================================================================
-- The category names below are my own categories. Edit them to match yours.

create or replace view public.vw_category_groups with (security_invoker = on) as
 select category,
        case
            when category = any (array['Mortgage Payment','HOA','Electricity','Internet / Cell Phone Provider','Insurance']) then 'Fixed Costs'
            when category = any (array['ATM','Zelle','Venmo','Credit Card Payment','Payment','Checks','Fees & Adjustments','Payroll','Spectrum']) then 'Excluded'
            else 'Discretionary'
        end as category_group
   from expense_transactions
  group by category;

create or replace view public.vw_category_mapping with (security_invoker = on) as
 select category,
    string_agg(pattern, ', ' order by priority, pattern) as aliases,
    count(*) as pattern_count,
    min(priority) as min_priority
   from category_mapping
  group by category
  order by (min(priority)), category;

create or replace view public.vw_dashboard_summary with (security_invoker = on) as
 select t.month, t.category,
    sum(abs(t.amount)) as total,
    count(*) as transaction_count,
    max(t.created_at) as last_updated
   from expense_transactions t
     left join vw_category_groups g on t.category = g.category
  where g.category_group = any (array['Fixed Costs','Discretionary'])
    and not (t.category = 'Miscellaneous' and abs(t.amount) > 100000)
  group by t.month, t.category;

create or replace view public.vw_discretionary_summary with (security_invoker = on) as
 select t.month, t.category,
    sum(abs(t.amount)) as total,
    count(*) as transaction_count
   from expense_transactions t
     left join vw_category_groups g on t.category = g.category
  where g.category_group = 'Discretionary'
    and not (t.category = 'Miscellaneous' and abs(t.amount) > 100000)
  group by t.month, t.category;

create or replace view public.vw_fixed_costs_summary with (security_invoker = on) as
 with latest_per_category as (
     select distinct on (category) category,
        abs(amount) as latest_amount,
        transaction_date
       from expense_transactions
      where category = any (array['Mortgage Payment','HOA','Electricity','Internet / Cell Phone Provider','Insurance'])
        and description not like '%OVERDRAFT%'
      order by category, transaction_date desc
 )
 select category,
    latest_amount as avg_per_month,
    latest_amount as total_all_months,
    1 as months_with_data
   from latest_per_category;

-- These two depend on the views above.
create or replace function public.get_net_remaining()
 returns table(avg_payroll numeric, avg_fixed_costs numeric, avg_net_remaining numeric, months_tracked integer)
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
    return query
    with last_two_payrolls as (
        select abs(amount) as amount from expense_transactions
        where category = 'Payroll' order by transaction_date desc limit 2
    ),
    payroll_sum as (select sum(amount) as monthly_income, 2 as months from last_two_payrolls),
    electricity_12mo_avg as (
        select coalesce(avg(abs(amount)), 0) as elec_avg from expense_transactions
        where category = 'Electricity' and transaction_date >= (now() - interval '1 year')::date
    ),
    fixed_avg as (
        select sum(case when category = 'Electricity' then (select elec_avg from electricity_12mo_avg)
                        else avg_per_month end) as avg_fixed
        from vw_fixed_costs_summary
    ),
    last_complete_month as (select to_char((now() - interval '1 month')::date, 'YYYY-MM') as month),
    mta_amount as (
        select coalesce(sum(abs(amount)), 0) as mta_total from expense_transactions, last_complete_month
        where category = 'MTA' and expense_transactions.month = last_complete_month.month
    ),
    subscriptions_amount as (
        select coalesce(sum(abs(amount)), 0) as subs_total from expense_transactions, last_complete_month
        where category = 'Subscriptions' and expense_transactions.month = last_complete_month.month
    ),
    total_expenses as (
        select f.avg_fixed + m.mta_total + s.subs_total as total_exp
        from fixed_avg f, mta_amount m, subscriptions_amount s
    )
    select p.monthly_income::decimal(10,2), e.total_exp::decimal(10,2),
           (p.monthly_income - e.total_exp)::decimal(10,2) as net, p.months::int
    from payroll_sum p, total_expenses e;
end;
$function$;

create or replace function public.get_dashboard_stats()
 returns table(net_remaining numeric, discretionary_avg numeric, months_tracked integer)
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
    return query
    with net_calc as (select * from get_net_remaining()),
    disc_avg as (select sum(total) / count(distinct month) as avg_disc from vw_discretionary_summary),
    total_months as (select count(distinct month) as months from expense_transactions)
    select n.avg_net_remaining, d.avg_disc::decimal(10,2), m.months::int
    from net_calc n, disc_avg d, total_months m;
end;
$function$;


-- =============================================================================
-- Security: only the owner's signed in account can read or write anything
-- =============================================================================
-- Luna signs in with Supabase Auth (email code). The public "anon" key that is
-- built into the app gets no access at all. Backend workflows use the service
-- role key, which bypasses these rules.

do $$
declare t record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', t.relname);
    execute format('drop policy if exists owner_only on public.%I', t.relname);
    execute format(
      'create policy owner_only on public.%I for all to authenticated
         using ((select auth.jwt() ->> ''email'') = ''you@example.com'')
         with check ((select auth.jwt() ->> ''email'') = ''you@example.com'')',
      t.relname);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

revoke execute on function public.dismiss_finance_alert(bigint, boolean) from anon, public;
revoke execute on function public.recategorize_transaction(bigint, text, text) from anon, public;
revoke execute on function public.get_dashboard_stats() from anon, public;
grant execute on function public.dismiss_finance_alert(bigint, boolean) to authenticated;
grant execute on function public.recategorize_transaction(bigint, text, text) to authenticated;
grant execute on function public.get_dashboard_stats() to authenticated;

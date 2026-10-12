# finances

Scripts that pull money data into the database. They feed the **Finances** tabs in Luna.

## What runs

| Script | What it does | When | Writes to |
|--------|--------------|------|-----------|
| `scripts/plaid_chase_sync.py` | Pulls new Chase transactions through Plaid. Picks up where the last run stopped. | Daily, Pull Finances workflow | `expense_transactions`, `plaid_accounts`, `plaid_sync_state` |
| `scripts/finance_alerts.py` | Looks for double charges, new or changed subscriptions, fees, interest, price increases and returned payments. Sends new ones by push and email. | Daily, right after the Chase sync | `finance_alerts` |
| `scripts/plaid_investments_sync.py` | Pulls Fidelity retirement and brokerage holdings through Plaid. Leaves stock and crypto rows alone. | Weekdays, Pull Investments workflow | `stocks_crypto_history` |
| `scripts/fetch_zillow_property_value.py` | Gets the Zillow estimate for the condo and works out mortgage balance and equity. | By hand, monthly | `real_estate_history` |

All of them are safe to rerun; they update existing rows instead of adding duplicates.

## Home value

The Investments tab shows a live Zillow value but doesn't save it. To keep a monthly history, save a snapshot once a month.

**Zillow** (from your computer, in the repo folder):

```
pip install -r finances/requirements.txt
set SUPABASE_URL=https://uuvsvtpfcexhqojlrsxy.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=<service role key>
set ZILLOW_API_KEY=<RapidAPI key>
python finances/scripts/fetch_zillow_property_value.py
```

(In PowerShell use `$env:SUPABASE_URL="..."` instead of `set`.)

**Redfin** has no API, so copy the estimate from Redfin and run this in the Supabase SQL editor, filling in the three numbers:

```sql
insert into real_estate_history
  (snapshot_date, asset_name, home_value, mortgage_balance, net_equity, cost_basis, data_source)
select current_date, 'Condo', v.value, v.mortgage, v.value - v.mortgage, v.purchase, 'Redfin'
from (values (<redfin estimate>, <current mortgage balance>, <purchase price>)) as v(value, mortgage, purchase);
```

The Investments tab averages the latest Zillow and Redfin values.

## Running locally

Copy `.env.example` to `.env` and fill it in, then run any script from the repo root:

```
pip install -r finances/requirements.txt
python finances/scripts/plaid_chase_sync.py
```

Scripts must use `SUPABASE_SERVICE_ROLE_KEY`; the public key can't write to the database.

## Naming

`plaid_chase_*` uses Plaid's **Transactions** product and `plaid_investments_*` uses Plaid's **Investments** product. The names match Plaid's docs, which helps when looking things up.

## Reconnecting a bank

Plaid connections occasionally expire. The original link scripts can be restored from history; see [docs/setup.md](../docs/setup.md#part-2-connect-data-sources).

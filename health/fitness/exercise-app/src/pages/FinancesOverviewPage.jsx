import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const RETIREMENT_FALLBACK = 2480.30

function usd(n, opts = {}) {
  if (n == null || isNaN(n)) return '—'
  const abs = Math.abs(n)
  const digits = opts.compact && abs >= 10000 ? 0 : (opts.digits != null ? opts.digits : 0)
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function lastCompleteMonthKey() {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(key) {
  if (!key) return ''
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function FinancesOverviewPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [netWorth, setNetWorth] = useState(null)
  const [netWorthBreakdown, setNetWorthBreakdown] = useState({ stocks: 0, crypto: 0, retirement: 0, realEstate: 0 })
  const [cashLeft, setCashLeft] = useState(null)
  const [monthlyFixed, setMonthlyFixed] = useState(null)
  const [monthSpend, setMonthSpend] = useState(null)
  const [monthSpendKey, setMonthSpendKey] = useState(null)
  const [topCategory, setTopCategory] = useState(null)
  const [asOfDate, setAsOfDate] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([loadNetWorth(), loadCashLeft(), loadFixedCosts(), loadMonthSpend()])
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  async function loadNetWorth() {
    const { data: scData, error: scErr } = await supabase
      .from('stocks_crypto_history')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(200)
    if (scErr) throw scErr

    const { data: reData, error: reErr } = await supabase
      .from('real_estate_history')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(20)
    if (reErr) throw reErr

    let stocks = 0, crypto = 0, retirement = 0
    let scDate = null
    if (scData && scData.length > 0) {
      scDate = scData[0].snapshot_date
      scData.filter((r) => r.snapshot_date === scDate).forEach((r) => {
        const v = Number(r.total_value) || 0
        if (r.asset_type === 'Stock') stocks += v
        else if (r.asset_type === 'Crypto') crypto += v
      })
      const retRows = scData.filter((r) => r.asset_type === 'Retirement' || r.asset_type === 'Brokerage')
      if (retRows.length > 0) {
        const retDate = retRows[0].snapshot_date
        retRows.filter((r) => r.snapshot_date === retDate).forEach((r) => { retirement += Number(r.total_value) || 0 })
      }
    }
    if (retirement === 0) retirement = RETIREMENT_FALLBACK

    let realEstate = 0, reDate = null
    if (reData && reData.length > 0) {
      reDate = reData[0].snapshot_date
      const zillowCondo = reData.find((r) => r.asset_name === 'Condo' && r.data_source === 'Zillow' && r.snapshot_date === reDate)
      const redfinCondo = reData.find((r) => r.asset_name === 'Condo' && r.data_source === 'Redfin' && r.snapshot_date === reDate)
      const storageRows = reData.filter((r) => r.asset_name === 'Storage Unit')
      const storage = storageRows.length > 0 ? storageRows[0] : null
      if (zillowCondo && redfinCondo) realEstate += (Number(zillowCondo.home_value) + Number(redfinCondo.home_value)) / 2
      else if (zillowCondo) realEstate += Number(zillowCondo.home_value)
      else if (redfinCondo) realEstate += Number(redfinCondo.home_value)
      if (storage) realEstate += Number(storage.home_value)
    }

    setNetWorthBreakdown({ stocks, crypto, retirement, realEstate })
    setNetWorth(stocks + crypto + retirement + realEstate)
    setAsOfDate(scDate || reDate)
  }

  async function loadCashLeft() {
    const lastMonth = lastCompleteMonthKey()

    const { data: payroll } = await supabase
      .from('expense_transactions')
      .select('amount')
      .eq('category', 'Payroll')
      .order('transaction_date', { ascending: false })
      .limit(2)
    const income = payroll && payroll.length > 0
      ? payroll.reduce((s, p) => s + Math.abs(Number(p.amount) || 0), 0) / payroll.length
      : 0

    const { data: fixedRows } = await supabase.from('vw_fixed_costs_summary').select('category, avg_per_month')
    let fixed = 0
    ;(fixedRows || []).forEach((r) => { fixed += Number(r.avg_per_month) || 0 })

    const { data: mta } = await supabase.from('expense_transactions').select('amount').eq('category', 'MTA').eq('month', lastMonth)
    const mtaAmount = (mta || []).reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0)

    const { data: subs } = await supabase.from('expense_transactions').select('amount').eq('category', 'Subscriptions').eq('month', lastMonth)
    const subsAmount = (subs || []).reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0)

    setCashLeft(income - (fixed + mtaAmount + subsAmount))
  }

  async function loadFixedCosts() {
    const { data: fixedRows } = await supabase.from('vw_fixed_costs_summary').select('category, avg_per_month')

    const { data: electricityHistory } = await supabase
      .from('expense_transactions')
      .select('amount, transaction_date')
      .eq('category', 'Electricity')
      .gte('transaction_date', new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString())
      .order('transaction_date', { ascending: false })

    const electricityAvg = electricityHistory && electricityHistory.length > 0
      ? electricityHistory.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0) / electricityHistory.length
      : 0

    let total = 0
    ;(fixedRows || []).forEach((r) => {
      if (r.category === 'Electricity') total += electricityAvg
      else total += Number(r.avg_per_month) || 0
    })
    setMonthlyFixed(total)
  }

  async function loadMonthSpend() {
    const { data: disc } = await supabase
      .from('vw_discretionary_summary')
      .select('month, category, total')
      .order('month', { ascending: false })

    if (!disc || disc.length === 0) {
      setMonthSpend(0)
      setTopCategory(null)
      return
    }
    const target = disc[0].month
    setMonthSpendKey(target)
    const monthRows = disc.filter((r) => r.month === target)
    let sum = 0
    let top = null
    monthRows.forEach((r) => {
      const v = Number(r.total) || 0
      sum += v
      if (!top || v > top.total) top = { category: r.category, total: v }
    })
    setMonthSpend(sum)
    setTopCategory(top)
  }

  const card = { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px' }
  const label = { fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-muted)', margin: '0 0 10px 0' }
  const heroValue = { fontSize: '2rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }
  const smallValue = { fontSize: '1.15rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0, fontVariantNumeric: 'tabular-nums' }
  const legendDot = (color) => ({ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, flexShrink: 0 })

  if (loading) return <div className="status-block">Loading finances...</div>
  if (error) return <div className="status-block error">Failed to load: {error}</div>

  const now = new Date()
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()]
  const monthDay = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  const nwParts = [
    { label: 'Stocks', value: netWorthBreakdown.stocks, color: '#60a5fa' },
    { label: 'Crypto', value: netWorthBreakdown.crypto, color: '#fbbf24' },
    { label: 'Retirement', value: netWorthBreakdown.retirement, color: '#fb923c' },
    { label: 'Real Estate', value: netWorthBreakdown.realEstate, color: '#a78bfa' }
  ]
  const nwTotal = nwParts.reduce((s, p) => s + p.value, 0) || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <p style={{ fontSize: '11px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, margin: 0 }}>
          {dayName}, {monthDay}
        </p>
        <h1 style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--tx-primary)', margin: '2px 0 0 0' }}>Finances</h1>
      </div>

      <div style={card}>
        <p style={label}>Net Worth {asOfDate ? `· as of ${new Date(asOfDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}</p>
        <p style={heroValue}>{usd(netWorth)}</p>
        <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', marginTop: '14px', background: 'var(--surface-muted)' }}>
          {nwParts.map((p) => (
            <div key={p.label} style={{ background: p.color, width: `${(p.value / nwTotal) * 100}%`, transition: 'width 0.3s ease' }} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '14px' }}>
          {nwParts.map((p) => (
            <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <span style={legendDot(p.color)} />
              <span style={{ flex: 1, color: 'var(--tx-secondary)' }}>{p.label}</span>
              <span style={{ color: 'var(--tx-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{usd(p.value)}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        <div style={card}>
          <p style={label}>Cash Left</p>
          <p style={smallValue}>{usd(cashLeft)}</p>
          <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '6px 0 0 0' }}>income − fixed − recurring</p>
        </div>
        <div style={card}>
          <p style={label}>Monthly Fixed</p>
          <p style={smallValue}>{usd(monthlyFixed)}</p>
          <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '6px 0 0 0' }}>avg/month</p>
        </div>
        <div style={card}>
          <p style={label}>{monthSpendKey ? monthLabel(monthSpendKey) + ' Spend' : 'This Month'}</p>
          <p style={smallValue}>{usd(monthSpend)}</p>
          <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '6px 0 0 0' }}>discretionary</p>
        </div>
        <div style={card}>
          <p style={label}>Top Category</p>
          <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {topCategory ? topCategory.category : '—'}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '6px 0 0 0', fontVariantNumeric: 'tabular-nums' }}>
            {topCategory ? usd(topCategory.total) : ''}
          </p>
        </div>
      </div>

      <Link
        to="/finances/dashboard"
        style={{
          ...card,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          textDecoration: 'none',
          backgroundColor: 'var(--brand-500)',
          borderColor: 'var(--brand-500)',
          color: '#fff'
        }}
      >
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Open full dashboard</div>
          <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '2px' }}>Expenses, trends, investments</div>
        </div>
        <span style={{ fontSize: '1.4rem', fontWeight: 700 }}>→</span>
      </Link>
    </div>
  )
}

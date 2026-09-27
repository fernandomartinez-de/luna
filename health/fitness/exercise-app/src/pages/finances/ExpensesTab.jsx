import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

const CAT_COLORS = ['#dc2626', '#ea580c', '#f59e0b', '#84cc16', '#0ea5e9', '#8b5cf6', '#ec4899', '#22c55e', '#eab308', '#06b6d4', '#a855f7', '#f43f5e']

function usd(n) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function lastCompleteMonthKey() {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`
}
function monthShort(key) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

export default function ExpensesTab() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [fixed, setFixed] = useState([])
  const [electricityAvg, setElectricityAvg] = useState(0)
  const [mtaAmount, setMtaAmount] = useState(0)
  const [subsAmount, setSubsAmount] = useState(0)
  const [income, setIncome] = useState(0)
  const [discretionary, setDiscretionary] = useState([])
  const [allCategories, setAllCategories] = useState([])
  const [payrollByMonth, setPayrollByMonth] = useState({})
  const [netRemainingTrend, setNetRemainingTrend] = useState([])
  const [monthFilter, setMonthFilter] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const lastMonth = lastCompleteMonthKey()

      const [statsRes, fixedRes, discRes, allRes, payrollRes, mtaRes, subsRes, elecRes, incomeRes] = await Promise.all([
        supabase.rpc('get_dashboard_stats'),
        supabase.from('vw_fixed_costs_summary').select('*').order('avg_per_month', { ascending: false }),
        supabase.from('vw_discretionary_summary').select('*').order('month', { ascending: true }),
        supabase.from('vw_dashboard_summary').select('*').order('month', { ascending: true }),
        supabase.from('expense_transactions').select('month, amount').eq('category', 'Payroll').order('month', { ascending: true }),
        supabase.from('expense_transactions').select('amount').eq('category', 'MTA').eq('month', lastMonth),
        supabase.from('expense_transactions').select('amount').eq('category', 'Subscriptions').eq('month', lastMonth),
        supabase.from('expense_transactions').select('amount, transaction_date').eq('category', 'Electricity').gte('transaction_date', new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString()),
        supabase.from('expense_transactions').select('amount').eq('category', 'Payroll').order('transaction_date', { ascending: false }).limit(2)
      ])
      if (statsRes.error) throw statsRes.error
      if (fixedRes.error) throw fixedRes.error
      if (discRes.error) throw discRes.error
      if (allRes.error) throw allRes.error
      if (payrollRes.error) throw payrollRes.error

      const s = statsRes.data && statsRes.data.length > 0 ? statsRes.data[0] : {}
      setStats(s)
      setFixed(fixedRes.data || [])
      setDiscretionary(discRes.data || [])
      setAllCategories(allRes.data || [])

      const elecAvg = elecRes.data && elecRes.data.length > 0
        ? elecRes.data.reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0) / elecRes.data.length
        : 0
      setElectricityAvg(elecAvg)

      setMtaAmount((mtaRes.data || []).reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0))
      setSubsAmount((subsRes.data || []).reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0))

      const pm = {}
      ;(payrollRes.data || []).forEach((r) => { pm[r.month] = (pm[r.month] || 0) + Math.abs(Number(r.amount) || 0) })
      setPayrollByMonth(pm)

      const inc = incomeRes.data && incomeRes.data.length > 0
        ? incomeRes.data.reduce((a, p) => a + Math.abs(Number(p.amount) || 0), 0) / incomeRes.data.length
        : 0
      setIncome(inc)

      const trend = buildNetRemainingTrend(pm, allRes.data || [], elecAvg)
      setNetRemainingTrend(trend)

      const months = [...new Set((discRes.data || []).map((r) => r.month))].sort()
      if (months.length > 0) setMonthFilter(months[months.length - 1])
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  function buildNetRemainingTrend(payMonth, allCats, elecAvg) {
    const totalsByMonth = {}
    allCats.forEach((r) => {
      const cost = r.category === 'Electricity' ? elecAvg : Number(r.total) || 0
      totalsByMonth[r.month] = (totalsByMonth[r.month] || 0) + cost
    })
    const months = Object.keys(totalsByMonth).sort()
    return months.map((m) => {
      const inc = payMonth[m] || 0
      return { month: m, netRemaining: inc - totalsByMonth[m], income: inc, expenses: totalsByMonth[m] }
    })
  }

  const card = { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px' }
  const label = { fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-muted)', margin: '0 0 10px 0' }

  if (loading) return <div className="status-block">Loading expenses...</div>
  if (error) return <div className="status-block error">Failed to load: {error}</div>

  const fixedForDisplay = fixed
    .map((r) => ({ category: r.category, amount: r.category === 'Electricity' ? electricityAvg : Number(r.avg_per_month) || 0 }))
    .concat([{ category: 'MTA', amount: mtaAmount }, { category: 'Subscriptions', amount: subsAmount }])
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount)
  const fixedTotal = fixedForDisplay.reduce((s, r) => s + r.amount, 0)

  const monthDiscRows = discretionary.filter((r) => r.month === monthFilter)
  const monthDiscTotal = monthDiscRows.reduce((s, r) => s + (Number(r.total) || 0), 0)
  const topCatsInMonth = [...monthDiscRows]
    .map((r) => ({ category: r.category, total: Number(r.total) || 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  const monthlyDiscTotals = {}
  discretionary.forEach((r) => {
    monthlyDiscTotals[r.month] = (monthlyDiscTotals[r.month] || 0) + (Number(r.total) || 0)
  })
  const trendMonths = Object.keys(monthlyDiscTotals).sort()
  const trendMax = Math.max(1, ...trendMonths.map((m) => monthlyDiscTotals[m]))

  const availableMonths = [...new Set(discretionary.map((r) => r.month))].sort()

  const nrMax = Math.max(1, ...netRemainingTrend.map((r) => Math.abs(r.netRemaining)))

  const catBreakdown = {}
  allCategories.forEach((r) => {
    if (!catBreakdown[r.category]) catBreakdown[r.category] = 0
    catBreakdown[r.category] += Number(r.total) || 0
  })
  const catBreakdownRows = Object.entries(catBreakdown)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        <div style={card}>
          <p style={label}>Net Remaining</p>
          <p style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{usd(stats?.net_remaining)}</p>
          <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '6px 0 0 0' }}>after fixed costs</p>
        </div>
        <div style={card}>
          <p style={label}>Discretionary Avg</p>
          <p style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{usd(stats?.discretionary_avg)}</p>
          <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '6px 0 0 0' }}>per month</p>
        </div>
        <div style={card}>
          <p style={label}>Income</p>
          <p style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{usd(income)}</p>
          <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '6px 0 0 0' }}>last 2 payrolls avg</p>
        </div>
        <div style={card}>
          <p style={label}>Months Tracked</p>
          <p style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{stats?.months_tracked ?? '—'}</p>
        </div>
      </div>

      <div style={card}>
        <p style={label}>Fixed Costs</p>
        <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', marginBottom: '12px', background: 'var(--surface-muted)' }}>
          {fixedForDisplay.map((r, i) => (
            <div key={r.category} style={{ background: CAT_COLORS[i % CAT_COLORS.length], width: `${(r.amount / fixedTotal) * 100}%` }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {fixedForDisplay.map((r, i) => (
            <div key={r.category} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: CAT_COLORS[i % CAT_COLORS.length], flexShrink: 0 }} />
              <span style={{ flex: 1, color: 'var(--tx-secondary)' }}>{r.category}</span>
              <span style={{ color: 'var(--tx-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{usd(r.amount)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', paddingTop: '8px', borderTop: '1px solid var(--surface-border)', fontSize: '12px', fontWeight: 700 }}>
            <span style={{ flex: 1, color: 'var(--tx-primary)' }}>Total</span>
            <span style={{ color: 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums' }}>{usd(fixedTotal)}</span>
          </div>
        </div>
      </div>

      <div style={card}>
        <p style={label}>Net Remaining Trend</p>
        {netRemainingTrend.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--tx-muted)' }}>No trend data</div>
        ) : (
          <div style={{ width: '100%', height: '120px' }}>
            <svg width="100%" height="120" viewBox="0 0 1000 120" preserveAspectRatio="none">
              <line x1="0" y1="60" x2="1000" y2="60" stroke="var(--surface-border)" strokeDasharray="4 4" />
              <path
                d={netRemainingTrend.map((r, i) => {
                  const x = (i / Math.max(1, netRemainingTrend.length - 1)) * 1000
                  const y = 60 - (r.netRemaining / nrMax) * 50
                  return `${i === 0 ? 'M' : 'L'}${x},${y}`
                }).join(' ')}
                stroke="#10b981"
                strokeWidth="2"
                fill="none"
              />
              {netRemainingTrend.map((r, i) => {
                const x = (i / Math.max(1, netRemainingTrend.length - 1)) * 1000
                const y = 60 - (r.netRemaining / nrMax) * 50
                return <circle key={i} cx={x} cy={y} r="3" fill={r.netRemaining >= 0 ? '#10b981' : '#ef4444'} />
              })}
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: 'var(--tx-muted)' }}>
              <span>{monthShort(netRemainingTrend[0].month)}</span>
              <span>{monthShort(netRemainingTrend[netRemainingTrend.length - 1].month)}</span>
            </div>
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <p style={{ ...label, margin: 0 }}>Discretionary Spending</p>
          <select
            value={monthFilter || ''}
            onChange={(e) => setMonthFilter(e.target.value)}
            style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'var(--surface-base)', color: 'var(--tx-primary)' }}
          >
            {availableMonths.map((m) => (<option key={m} value={m}>{monthShort(m)}</option>))}
          </select>
        </div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums' }}>{usd(monthDiscTotal)}</div>
        <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '4px 0 12px 0' }}>{monthFilter ? monthShort(monthFilter) : ''} spend</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {topCatsInMonth.map((r, i) => {
            const pct = monthDiscTotal > 0 ? (r.total / monthDiscTotal) * 100 : 0
            return (
              <div key={r.category}>
                <div style={{ display: 'flex', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ flex: 1, color: 'var(--tx-secondary)' }}>{r.category}</span>
                  <span style={{ color: 'var(--tx-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{usd(r.total)}</span>
                </div>
                <div style={{ height: '6px', background: 'var(--surface-muted)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: CAT_COLORS[i % CAT_COLORS.length] }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={card}>
        <p style={label}>Monthly Discretionary Trend</p>
        {trendMonths.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--tx-muted)' }}>No trend data</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '90px' }}>
              {trendMonths.map((m) => {
                const v = monthlyDiscTotals[m]
                const pct = Math.max(2, (v / trendMax) * 100)
                return (
                  <div key={m} title={`${monthShort(m)} · ${usd(v)}`} style={{ flex: 1, height: `${pct}%`, background: '#60a5fa', borderRadius: '3px 3px 0 0' }} />
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: 'var(--tx-muted)' }}>
              <span>{monthShort(trendMonths[0])}</span>
              <span>{monthShort(trendMonths[trendMonths.length - 1])}</span>
            </div>
          </>
        )}
      </div>

      <div style={card}>
        <p style={label}>Category Breakdown (all months)</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
          {catBreakdownRows.map((r, i) => (
            <div key={r.category} style={{ display: 'flex', fontSize: '12px', padding: '6px 0', borderBottom: i < catBreakdownRows.length - 1 ? '1px solid var(--surface-border)' : 'none' }}>
              <span style={{ flex: 1, color: 'var(--tx-secondary)' }}>{r.category}</span>
              <span style={{ color: 'var(--tx-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{usd(r.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

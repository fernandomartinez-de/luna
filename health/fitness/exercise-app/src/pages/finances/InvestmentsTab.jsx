import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

const RETIREMENT_FALLBACK = 2480.30

function usd(n, opts = {}) {
  if (n == null || isNaN(n)) return '—'
  const digits = opts.digits != null ? opts.digits : 0
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits })
}
function pct(n) {
  if (n == null || isNaN(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}
function monthShort(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function InvestmentsTab() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [portfolio, setPortfolio] = useState(null)
  const [portfolioHistory, setPortfolioHistory] = useState([])
  const [reHistory, setReHistory] = useState([])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [scAll, reAll] = await Promise.all([
        supabase.from('stocks_crypto_history').select('*').order('snapshot_date', { ascending: true }),
        supabase.from('real_estate_history').select('*').order('snapshot_date', { ascending: true })
      ])
      if (scAll.error) throw scAll.error
      if (reAll.error) throw reAll.error

      const scData = scAll.data || []
      const reData = reAll.data || []

      const latestSc = scData.length > 0 ? scData[scData.length - 1].snapshot_date : null
      const latestRe = reData.length > 0 ? reData[reData.length - 1].snapshot_date : null

      const stocks = []
      let stocksTotal = 0, stocksCost = 0
      const crypto = []
      let cryptoTotal = 0, cryptoCost = 0
      const retirement = []
      let retirementTotal = 0, retirementCost = 0

      if (latestSc) {
        scData.filter((r) => r.snapshot_date === latestSc).forEach((r) => {
          const v = Number(r.total_value) || 0
          const cb = Number(r.cost_basis) || 0
          const row = { name: r.asset_name, qty: Number(r.quantity) || 0, price: Number(r.price_per_unit) || 0, value: v, costBasis: cb, gain: v - cb, gainPct: cb > 0 ? ((v - cb) / cb) * 100 : 0 }
          if (r.asset_type === 'Stock') { stocks.push(row); stocksTotal += v; stocksCost += cb }
          else if (r.asset_type === 'Crypto') { crypto.push(row); cryptoTotal += v; cryptoCost += cb }
          else if (r.asset_type === 'Retirement' || r.asset_type === 'Brokerage') { retirement.push(row); retirementTotal += v; retirementCost += cb }
        })
      }
      if (retirementTotal === 0) retirementTotal = RETIREMENT_FALLBACK

      const realEstate = []
      let reTotal = 0, reCost = 0
      if (latestRe) {
        const latestRows = reData.filter((r) => r.snapshot_date === latestRe)
        const zillowCondo = latestRows.find((r) => r.asset_name === 'Condo' && r.data_source === 'Zillow')
        const redfinCondo = latestRows.find((r) => r.asset_name === 'Condo' && r.data_source === 'Redfin')
        const storage = latestRows.find((r) => r.asset_name === 'Storage Unit')
        if (zillowCondo && redfinCondo) {
          const value = (Number(zillowCondo.home_value) + Number(redfinCondo.home_value)) / 2
          const mortgage = (Number(zillowCondo.mortgage_balance || 0) + Number(redfinCondo.mortgage_balance || 0)) / 2
          const cb = Number(zillowCondo.cost_basis) || 0
          realEstate.push({ name: 'Condo', value, mortgage, equity: value - mortgage, costBasis: cb, gain: value - cb, gainPct: cb > 0 ? ((value - cb) / cb) * 100 : 0 })
          reTotal += value; reCost += cb
        } else if (zillowCondo || redfinCondo) {
          const row = zillowCondo || redfinCondo
          const value = Number(row.home_value) || 0
          const mortgage = Number(row.mortgage_balance || 0)
          const cb = Number(row.cost_basis) || 0
          realEstate.push({ name: 'Condo', value, mortgage, equity: value - mortgage, costBasis: cb, gain: value - cb, gainPct: cb > 0 ? ((value - cb) / cb) * 100 : 0 })
          reTotal += value; reCost += cb
        }
        if (storage) {
          const value = Number(storage.home_value) || 0
          const cb = Number(storage.cost_basis) || 0
          realEstate.push({ name: 'Storage Unit', value, mortgage: 0, equity: value, costBasis: cb, gain: value - cb, gainPct: cb > 0 ? ((value - cb) / cb) * 100 : 0 })
          reTotal += value; reCost += cb
        }
      }

      const total = stocksTotal + cryptoTotal + retirementTotal + reTotal
      const cost = stocksCost + cryptoCost + retirementCost + reCost

      setPortfolio({
        total, cost, gain: total - cost, gainPct: cost > 0 ? ((total - cost) / cost) * 100 : 0,
        asOf: latestSc || latestRe,
        stocks: { rows: stocks, total: stocksTotal, cost: stocksCost, gain: stocksTotal - stocksCost, gainPct: stocksCost > 0 ? ((stocksTotal - stocksCost) / stocksCost) * 100 : 0 },
        crypto: { rows: crypto, total: cryptoTotal, cost: cryptoCost, gain: cryptoTotal - cryptoCost, gainPct: cryptoCost > 0 ? ((cryptoTotal - cryptoCost) / cryptoCost) * 100 : 0 },
        retirement: { rows: retirement, total: retirementTotal, cost: retirementCost, gain: retirementTotal - retirementCost, gainPct: retirementCost > 0 ? ((retirementTotal - retirementCost) / retirementCost) * 100 : 0 },
        realEstate: { rows: realEstate, total: reTotal, cost: reCost, gain: reTotal - reCost, gainPct: reCost > 0 ? ((reTotal - reCost) / reCost) * 100 : 0 }
      })

      const byDate = {}
      scData.forEach((r) => {
        if (!byDate[r.snapshot_date]) byDate[r.snapshot_date] = 0
        byDate[r.snapshot_date] += Number(r.total_value) || 0
      })
      const reByDate = {}
      reData.forEach((r) => {
        if (r.data_source && r.data_source !== 'Zillow' && r.data_source !== 'Redfin') {
          reByDate[r.snapshot_date] = (reByDate[r.snapshot_date] || 0) + Number(r.home_value || 0)
        } else {
          if (!reByDate[r.snapshot_date]) reByDate[r.snapshot_date] = { zillow: 0, redfin: 0, other: 0 }
          if (typeof reByDate[r.snapshot_date] === 'number') return
          if (r.data_source === 'Zillow') reByDate[r.snapshot_date].zillow += Number(r.home_value || 0)
          else if (r.data_source === 'Redfin') reByDate[r.snapshot_date].redfin += Number(r.home_value || 0)
          else reByDate[r.snapshot_date].other += Number(r.home_value || 0)
        }
      })
      const reFlat = {}
      Object.entries(reByDate).forEach(([date, v]) => {
        if (typeof v === 'number') reFlat[date] = v
        else {
          const zil = v.zillow, red = v.redfin
          const avg = zil > 0 && red > 0 ? (zil + red) / 2 : (zil || red || 0)
          reFlat[date] = avg + v.other
        }
      })

      const allDates = [...new Set([...Object.keys(byDate), ...Object.keys(reFlat)])].sort()
      const history = allDates.map((d) => ({ date: d, total: (byDate[d] || 0) + (reFlat[d] || 0) }))
      setPortfolioHistory(history.slice(-12))

      const condoHistory = reData.filter((r) => r.asset_name === 'Condo' && r.data_source === 'Zillow').slice(-13)
      setReHistory(condoHistory.map((r) => ({ date: r.snapshot_date, homeValue: Number(r.home_value) || 0, mortgage: Number(r.mortgage_balance) || 0, equity: Number(r.net_equity) || 0 })))
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  const card = { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px' }
  const label = { fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-muted)', margin: '0 0 10px 0' }

  if (loading) return <div className="status-block">Loading investments...</div>
  if (error) return <div className="status-block error">Failed to load: {error}</div>
  if (!portfolio) return <div className="status-block">No portfolio data.</div>

  const gainColor = (v) => (v >= 0 ? '#10b981' : '#ef4444')

  const historyMax = Math.max(1, ...portfolioHistory.map((r) => r.total))
  const historyMin = Math.min(...portfolioHistory.map((r) => r.total), historyMax)
  const range = Math.max(1, historyMax - historyMin)

  const classes = [
    { key: 'stocks', label: 'Stocks', data: portfolio.stocks, color: '#60a5fa' },
    { key: 'crypto', label: 'Crypto', data: portfolio.crypto, color: '#fbbf24' },
    { key: 'retirement', label: 'Retirement', data: portfolio.retirement, color: '#fb923c' },
    { key: 'realEstate', label: 'Real Estate', data: portfolio.realEstate, color: '#a78bfa' }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={card}>
        <p style={label}>Total Net Worth {portfolio.asOf ? `· ${new Date(portfolio.asOf + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}</p>
        <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{usd(portfolio.total)}</p>
        <p style={{ fontSize: '12px', color: gainColor(portfolio.gain), margin: '6px 0 0 0', fontWeight: 600 }}>
          {portfolio.gain >= 0 ? '+' : ''}{usd(portfolio.gain)} ({pct(portfolio.gainPct)}) vs cost basis
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        {classes.map((c) => (
          <div key={c.key} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color, flexShrink: 0 }} />
              <span style={{ ...label, margin: 0 }}>{c.label}</span>
            </div>
            <p style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{usd(c.data.total)}</p>
            <p style={{ fontSize: '11px', color: gainColor(c.data.gain), margin: '4px 0 0 0', fontWeight: 600 }}>{c.data.gain >= 0 ? '+' : ''}{usd(c.data.gain)} ({pct(c.data.gainPct)})</p>
          </div>
        ))}
      </div>

      <div style={card}>
        <p style={label}>12-Month Net Worth Trend</p>
        {portfolioHistory.length < 2 ? (
          <div style={{ fontSize: '13px', color: 'var(--tx-muted)' }}>Need at least 2 snapshots</div>
        ) : (
          <>
            <div style={{ width: '100%', height: '120px' }}>
              <svg width="100%" height="120" viewBox="0 0 1000 120" preserveAspectRatio="none">
                <path
                  d={portfolioHistory.map((r, i) => {
                    const x = (i / (portfolioHistory.length - 1)) * 1000
                    const y = 110 - ((r.total - historyMin) / range) * 90 - 10
                    return `${i === 0 ? 'M' : 'L'}${x},${y}`
                  }).join(' ')}
                  stroke="var(--brand-500)"
                  strokeWidth="2"
                  fill="none"
                />
                {portfolioHistory.map((r, i) => {
                  const x = (i / (portfolioHistory.length - 1)) * 1000
                  const y = 110 - ((r.total - historyMin) / range) * 90 - 10
                  return <circle key={i} cx={x} cy={y} r="3" fill="var(--brand-500)" />
                })}
              </svg>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: 'var(--tx-muted)' }}>
              <span>{monthShort(portfolioHistory[0].date)} · {usd(portfolioHistory[0].total)}</span>
              <span>{monthShort(portfolioHistory[portfolioHistory.length - 1].date)} · {usd(portfolioHistory[portfolioHistory.length - 1].total)}</span>
            </div>
          </>
        )}
      </div>

      <div style={card}>
        <p style={label}>Real Estate</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {portfolio.realEstate.rows.map((r) => (
            <div key={r.name} style={{ padding: '10px 12px', borderRadius: '10px', background: 'var(--surface-base)', border: '1px solid var(--surface-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--tx-primary)' }}>{r.name}</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums' }}>{usd(r.value)}</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--tx-muted)', marginTop: '4px' }}>
                {r.mortgage > 0 && <span>Mortgage {usd(r.mortgage)}</span>}
                <span>Equity {usd(r.equity)}</span>
                <span style={{ color: gainColor(r.gain), fontWeight: 600 }}>{pct(r.gainPct)}</span>
              </div>
            </div>
          ))}
        </div>
        {reHistory.length >= 2 && (() => {
          const max = Math.max(...reHistory.map((r) => r.homeValue))
          const min = Math.min(...reHistory.map((r) => r.equity))
          const rangeR = Math.max(1, max - min)
          return (
            <div style={{ marginTop: '14px' }}>
              <p style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>Condo · 13-month equity trend</p>
              <div style={{ width: '100%', height: '80px' }}>
                <svg width="100%" height="80" viewBox="0 0 1000 80" preserveAspectRatio="none">
                  {['homeValue', 'equity', 'mortgage'].map((key, ki) => {
                    const color = key === 'homeValue' ? '#a78bfa' : key === 'equity' ? '#10b981' : '#ef4444'
                    return (
                      <path
                        key={key}
                        d={reHistory.map((r, i) => {
                          const x = (i / (reHistory.length - 1)) * 1000
                          const y = 72 - ((r[key] - min) / rangeR) * 64 - 4
                          return `${i === 0 ? 'M' : 'L'}${x},${y}`
                        }).join(' ')}
                        stroke={color}
                        strokeWidth="1.8"
                        fill="none"
                      />
                    )
                  })}
                </svg>
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '10px', marginTop: '6px' }}>
                <span style={{ color: '#a78bfa' }}>● Value</span>
                <span style={{ color: '#10b981' }}>● Equity</span>
                <span style={{ color: '#ef4444' }}>● Mortgage</span>
              </div>
            </div>
          )
        })()}
      </div>

      <div style={card}>
        <p style={label}>Stocks &amp; Crypto</p>
        {[...portfolio.stocks.rows, ...portfolio.crypto.rows].length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--tx-muted)' }}>No holdings</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[...portfolio.stocks.rows, ...portfolio.crypto.rows].map((r) => (
              <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--surface-border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--tx-primary)' }}>{r.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--tx-muted)' }}>{r.qty.toLocaleString('en-US', { maximumFractionDigits: 6 })} @ {usd(r.price, { digits: 2 })}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums' }}>{usd(r.value)}</div>
                  <div style={{ fontSize: '11px', color: gainColor(r.gain), fontWeight: 600 }}>{pct(r.gainPct)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={card}>
        <p style={label}>Retirement</p>
        {portfolio.retirement.rows.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--tx-muted)' }}>Using fallback: {usd(portfolio.retirement.total)}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {portfolio.retirement.rows.map((r) => (
              <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--surface-border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--tx-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--tx-muted)' }}>{r.qty.toLocaleString('en-US', { maximumFractionDigits: 4 })} shares</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums' }}>{usd(r.value)}</div>
                  <div style={{ fontSize: '11px', color: gainColor(r.gain), fontWeight: 600 }}>{pct(r.gainPct)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

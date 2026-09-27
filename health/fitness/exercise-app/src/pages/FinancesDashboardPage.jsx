import { useState } from 'react'
import { Link } from 'react-router-dom'
import ExpensesTab from './finances/ExpensesTab.jsx'
import InvestmentsTab from './finances/InvestmentsTab.jsx'

export default function FinancesDashboardPage() {
  const [tab, setTab] = useState('expenses')

  const tabBtn = (active) => ({
    flex: 1,
    padding: '8px 12px',
    borderRadius: '8px',
    border: active ? '1px solid var(--surface-border)' : '1px solid transparent',
    background: active ? 'var(--surface-raised)' : 'transparent',
    color: active ? 'var(--tx-primary)' : 'var(--tx-muted)',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer'
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <Link to="/finances" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--tx-secondary)', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500, marginBottom: '8px' }}>
          ← Finances
        </Link>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--tx-primary)' }}>Dashboard</h1>
      </div>

      <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'var(--surface-overlay)', borderRadius: '10px' }}>
        <button onClick={() => setTab('expenses')} style={tabBtn(tab === 'expenses')}>Expenses</button>
        <button onClick={() => setTab('investments')} style={tabBtn(tab === 'investments')}>Investments</button>
      </div>

      {tab === 'expenses' ? <ExpensesTab /> : <InvestmentsTab />}
    </div>
  )
}

import { Link } from 'react-router-dom'

export default function HubPage() {
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()]
  const monthDay = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  const card = {
    display: 'block',
    padding: '28px 24px',
    borderRadius: '12px',
    background: 'var(--surface-raised)',
    border: '1px solid var(--surface-border)',
    color: 'var(--tx-primary)',
    textDecoration: 'none',
    transition: 'border-color 0.15s ease, background-color 0.15s ease'
  }

  const iconWrap = {
    width: '52px',
    height: '52px',
    borderRadius: '12px',
    background: 'var(--surface-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.6rem',
    marginBottom: '16px'
  }

  const titleStyle = { fontSize: '1.15rem', fontWeight: 700, margin: '0 0 4px 0' }
  const subStyle = { fontSize: '0.85rem', color: 'var(--tx-muted)', margin: 0, lineHeight: 1.4 }
  const arrow = { color: 'var(--brand-400)', fontSize: '0.85rem', fontWeight: 600, marginTop: '14px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <p style={{ fontSize: '11px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, margin: 0 }}>
          {dayName}, {monthDay}
        </p>
        <h1 style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--tx-primary)', margin: '2px 0 0 0' }}>
          {greeting}
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--tx-secondary)', margin: '6px 0 0 0' }}>
          Choose an area to dive into.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Link to="/fitness" style={card}>
          <div style={iconWrap}>💪</div>
          <h2 style={titleStyle}>Fitness &amp; Nutrition</h2>
          <p style={subStyle}>Workouts, exercises, weight, food and daily strain.</p>
          <div style={arrow}>Open →</div>
        </Link>

        <Link to="/finances" style={card}>
          <div style={iconWrap}>💰</div>
          <h2 style={titleStyle}>Finances</h2>
          <p style={subStyle}>Net worth, monthly spend, fixed costs and investments.</p>
          <div style={arrow}>Open →</div>
        </Link>
      </div>
    </div>
  )
}

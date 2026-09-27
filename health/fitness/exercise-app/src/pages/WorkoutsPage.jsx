import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'

const WHOOP_SPORTS = ['Weightlifting', 'Golf', 'Running', 'Soccer']

const SPORT_EMOJI = {
  Weightlifting: '🏋️',
  Golf: '⛳',
  Running: '🏃',
  Soccer: '⚽'
}

function localDayStr(d) {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export default function WorkoutsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadAll() {
      setLoading(true)
      setError(null)
      try {
        const [cwRes, whoopRes] = await Promise.all([
          supabase
            .from('completed_workouts')
            .select('id, workout_id, created_at, sport_name, strain, calories_kcal, notes, whoop_workout_id, workouts(name)')
            .order('created_at', { ascending: false }),
          supabase
            .from('whoop_workouts')
            .select('workout_id, start_time, end_time, sport_name, strain, calories_kcal, average_heart_rate, max_heart_rate')
            .in('sport_name', WHOOP_SPORTS)
            .order('start_time', { ascending: false })
            .limit(200)
        ])
        if (cwRes.error) throw cwRes.error
        if (whoopRes.error) throw whoopRes.error

        const completed = cwRes.data || []
        const whoops = whoopRes.data || []

        const claimedWhoopIds = new Set(
          completed.map((r) => r.whoop_workout_id).filter(Boolean)
        )
        const completedDaySport = new Set(
          completed
            .filter((r) => r.workouts && r.workouts.name)
            .map((r) => `${localDayStr(r.created_at)}::Weightlifting`)
        )

        const merged = []

        completed.forEach((r) => {
          merged.push({
            kind: 'manual',
            key: `m-${r.id}`,
            timestamp: r.created_at,
            title: (r.workouts && r.workouts.name) || r.sport_name || 'Workout',
            sport: 'Weightlifting',
            emoji: SPORT_EMOJI.Weightlifting,
            strain: r.strain != null ? Number(r.strain) : null,
            kcal: r.calories_kcal != null ? Math.round(Number(r.calories_kcal)) : null,
            notes: r.notes,
            link: r.workout_id != null ? `/workout/${r.workout_id}` : null
          })
        })

        whoops.forEach((w) => {
          if (claimedWhoopIds.has(w.workout_id)) return
          if (w.sport_name === 'Weightlifting' && completedDaySport.has(`${localDayStr(w.start_time)}::Weightlifting`)) return
          merged.push({
            kind: 'whoop',
            key: `w-${w.workout_id}`,
            timestamp: w.start_time,
            title: w.sport_name,
            sport: w.sport_name,
            emoji: SPORT_EMOJI[w.sport_name] || '💪',
            strain: w.strain != null ? Number(w.strain) : null,
            kcal: w.calories_kcal != null ? Math.round(Number(w.calories_kcal)) : null,
            notes: null,
            link: null,
            hr_avg: w.average_heart_rate,
            hr_max: w.max_heart_rate
          })
        })

        merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        if (!cancelled) setRows(merged)
      } catch (err) {
        if (!cancelled) setError(err.message || String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadAll()
    return () => { cancelled = true }
  }, [])

  if (loading) return <div className="status-block">Loading activities...</div>
  if (error) return <div className="status-block error">Failed to load: {error}</div>

  const card = { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '14px', padding: '16px' }
  const tag = (bg, fg) => ({ fontSize: '11px', color: fg, background: bg, borderRadius: '6px', padding: '2px 8px', fontWeight: 600, whiteSpace: 'nowrap' })
  const sourceTag = { fontSize: '9px', color: 'var(--tx-muted)', background: 'var(--surface-base)', border: '1px solid var(--surface-border)', borderRadius: '4px', padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }

  if (rows.length === 0) {
    return (
      <>
        <div className="workouts-header"><h1>Workouts</h1></div>
        <div style={{ ...card, textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.3 }}>🏋️</div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', color: 'var(--tx-primary)' }}>No activities yet</h2>
          <p style={{ margin: '0 0 20px 0', fontSize: '0.9rem', color: 'var(--tx-muted)' }}>
            Log a session with ✓ Log on a saved workout, or complete a WHOOP-tracked activity (Weightlifting, Golf, Running, Soccer).
          </p>
          <Link to="/exercises" style={{ display: 'inline-block', padding: '10px 18px', backgroundColor: 'var(--brand-500)', color: 'white', borderRadius: '10px', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}>
            Browse saved workouts →
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="workouts-header">
        <h1>Workouts</h1>
        <span style={{ fontSize: '0.85rem', color: 'var(--tx-muted)' }}>{rows.length} activities</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {rows.map((r) => {
          const when = new Date(r.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

          const Body = (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', flexShrink: 0, backgroundColor: 'var(--surface-muted)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                  {r.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--tx-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                    <span style={sourceTag}>{r.kind === 'manual' ? 'Logged' : 'WHOOP'}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--tx-muted)', marginTop: '2px' }}>{when}</div>
                </div>
                {r.link && <span style={{ color: 'var(--tx-muted)', flexShrink: 0, fontSize: '18px' }}>›</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                {r.sport && r.sport !== r.title && <span style={tag('rgba(52, 211, 153, 0.15)', '#34d399')}>{r.sport}</span>}
                {r.strain != null && <span style={tag('rgba(14, 165, 233, 0.15)', 'var(--brand-400)')}>Strain {r.strain.toFixed(1)}</span>}
                {r.kcal != null && <span style={tag('rgba(245, 158, 11, 0.15)', '#f59e0b')}>{r.kcal.toLocaleString()} kcal</span>}
                {r.hr_avg != null && <span style={tag('rgba(239, 68, 68, 0.15)', '#f87171')}>♥ {r.hr_avg} avg</span>}
              </div>
              {r.notes && (
                <p style={{ fontSize: '0.85rem', color: 'var(--tx-secondary)', margin: '10px 0 0 0', lineHeight: 1.4 }}>{r.notes}</p>
              )}
            </>
          )

          return r.link ? (
            <Link key={r.key} to={r.link} style={{ ...card, textDecoration: 'none', color: 'inherit', display: 'block' }}>{Body}</Link>
          ) : (
            <div key={r.key} style={card}>{Body}</div>
          )
        })}
      </div>
    </>
  )
}

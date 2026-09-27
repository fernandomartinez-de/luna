import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const MEALS = [
  { key: 'breakfast', label: 'Breakfast', icon: '☕' },
  { key: 'lunch', label: 'Lunch', icon: '☀️' },
  { key: 'dinner', label: 'Dinner', icon: '🌙' },
  { key: 'snack', label: 'Snacks', icon: '🍎' }
]

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function FoodPage() {
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  const [logged, setLogged] = useState([])
  const [templates, setTemplates] = useState([])
  const [picker, setPicker] = useState(null)
  const [busy, setBusy] = useState(false)

  async function loadData() {
    const [logRes, tplRes] = await Promise.all([
      supabase.from('nutrition_log').select('*').eq('logged_date', todayStr()).order('created_at', { ascending: true }),
      supabase.from('meal_templates').select('*').eq('active', true).order('name', { ascending: true })
    ])
    const rows = logRes.data || []
    setLogged(rows)
    setTemplates(tplRes.data || [])
    setTotals(rows.reduce((a, r) => ({
      calories: a.calories + Number(r.calories_kcal || 0),
      protein: a.protein + Number(r.protein_g || 0),
      carbs: a.carbs + Number(r.carbs_g || 0),
      fat: a.fat + Number(r.fat_g || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 }))
  }

  useEffect(() => {
    loadData()
  }, [])

  async function logMeal(mealKey, tpl) {
    setBusy(true)
    await supabase.from('nutrition_log').insert({
      logged_date: todayStr(),
      meal: mealKey,
      item: tpl.name,
      calories_kcal: tpl.calories,
      protein_g: tpl.protein_g,
      carbs_g: tpl.carbs_g,
      fat_g: tpl.fat_g,
      source: 'template'
    })
    setBusy(false)
    setPicker(null)
    loadData()
  }

  async function removeLog(id) {
    await supabase.from('nutrition_log').delete().eq('id', id)
    loadData()
  }

  const card = { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px' }
  const addBtn = { border: '1px solid var(--surface-border)', background: 'var(--surface-base)', color: 'var(--brand-400)', borderRadius: '8px', padding: '5px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }
  const xBtn = { border: 'none', background: 'transparent', color: 'var(--tx-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, flexShrink: 0 }
  const tplBtn = { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', border: '1px solid var(--surface-border)', background: 'var(--surface-base)', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer' }

  const ring = (value, goal, color, label) => {
    const pct = Math.min((value / goal) * 100, 100)
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 12px' }}>
          <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="40" cy="40" r="34" fill="none" stroke="var(--surface-muted)" strokeWidth="6"></circle>
            <circle cx="40" cy="40" r="34" fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${pct * 2.14} 214`} strokeLinecap="round"></circle>
          </svg>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.1rem', fontWeight: 700, color }}>
            {Math.round(pct)}%
          </div>
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--tx-primary)', marginBottom: '2px' }}>{Math.round(value)}g</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--tx-muted)' }}>{label} / {goal}g</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0 }}>Macros &amp; meals</h1>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--tx-muted)', backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '10px', padding: '6px 14px' }}>Today</span>
      </div>

      <div style={{ ...card, padding: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tx-muted)', fontWeight: 500 }}>Calories</span>
          <div style={{ padding: '4px 12px', backgroundColor: 'rgba(0, 184, 217, 0.15)', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38d8fb' }}>{Math.max(0, 2000 - Math.round(totals.calories))} left</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '16px' }}>
          <span style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--tx-primary)', lineHeight: 1 }}>{Math.round(totals.calories)}</span>
          <span style={{ fontSize: '1rem', color: 'var(--tx-muted)' }}>/ 2000</span>
        </div>
        <div style={{ height: '6px', backgroundColor: 'var(--surface-muted)', borderRadius: '3px', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ height: '100%', width: `${Math.min((totals.calories / 2000) * 100, 100)}%`, backgroundColor: '#00b8d9', transition: 'width 0.3s ease' }}></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {ring(totals.protein, 150, '#3b82f6', 'Protein')}
          {ring(totals.carbs, 250, '#f59e0b', 'Carbs')}
          {ring(totals.fat, 65, '#8b5cf6', 'Fat')}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {MEALS.map((mealDef) => {
          const items = logged.filter((r) => r.meal === mealDef.key)
          const opts = templates.filter((t) => t.meal === mealDef.key)
          const isOpen = picker === mealDef.key
          return (
            <div key={mealDef.key} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>{mealDef.icon}</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--tx-primary)' }}>{mealDef.label}</span>
                </div>
                <button onClick={() => setPicker(isOpen ? null : mealDef.key)} style={addBtn}>{isOpen ? 'Close' : '+ Add'}</button>
              </div>

              {items.length === 0 && !isOpen && (
                <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--tx-muted)', fontSize: '0.85rem' }}>No items logged</div>
              )}

              {items.map((r) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', marginTop: '8px', borderTop: '1px solid var(--surface-border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', color: 'var(--tx-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.item}</div>
                    <div style={{ fontSize: '11px', color: 'var(--tx-muted)' }}>{Math.round(r.calories_kcal || 0)} kcal · {Math.round(r.protein_g || 0)}P {Math.round(r.carbs_g || 0)}C {Math.round(r.fat_g || 0)}F</div>
                  </div>
                  <button onClick={() => removeLog(r.id)} title="Remove" style={xBtn}>×</button>
                </div>
              ))}

              {isOpen && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {opts.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--tx-muted)' }}>No {mealDef.label.toLowerCase()} templates yet.</div>
                  ) : (
                    opts.map((t) => (
                      <button key={t.id} disabled={busy} onClick={() => logMeal(mealDef.key, t)} style={tplBtn}>
                        <span style={{ flex: 1, minWidth: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--tx-primary)', fontSize: '13px' }}>{t.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--tx-muted)', flexShrink: 0 }}>{Math.round(t.calories)} kcal · {Math.round(t.protein_g)}P</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

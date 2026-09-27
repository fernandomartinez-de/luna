import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function FoodPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('30d')
  const [nutritionToday, setNutritionToday] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  const [mealsByType, setMealsByType] = useState({ breakfast: [], lunch: [], dinner: [], snacks: [] })

  useEffect(() => {
    loadNutritionData()
  }, [])

  async function loadNutritionData() {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    const { data } = await supabase
      .from('meal_plan')
      .select('*')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .order('created_at', { ascending: true })

    if (data) {
      // Calculate totals - adjust field names to match your meal_plan schema
      const totals = data.reduce((acc, item) => ({
        calories: acc.calories + (item.calories || 0),
        protein: acc.protein + (item.protein || item.protein_g || 0),
        carbs: acc.carbs + (item.carbs || item.carbs_g || 0),
        fat: acc.fat + (item.fat || item.fat_g || 0)
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 })
      setNutritionToday(totals)

      // Group by meal type
      const grouped = {
        breakfast: data.filter(m => m.meal?.toLowerCase() === 'breakfast'),
        lunch: data.filter(m => m.meal?.toLowerCase() === 'lunch'),
        dinner: data.filter(m => m.meal?.toLowerCase() === 'dinner'),
        snacks: data.filter(m => m.meal?.toLowerCase() === 'snack' || m.meal?.toLowerCase() === 'snacks')
      }
      setMealsByType(grouped)
    }
  }

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0 }}>
          Macros & meals
        </h1>
      </div>

      {/* Date Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button style={{ padding: '8px', backgroundColor: 'transparent', border: 'none', color: 'var(--tx-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>
          ←
        </button>
        <div style={{ flex: 1, textAlign: 'center', backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '12px' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--tx-primary)' }}>Today</span>
        </div>
        <button style={{ padding: '8px', backgroundColor: 'transparent', border: 'none', color: 'var(--tx-muted)', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.3 }}>
          →
        </button>
      </div>

      {/* Calories Card */}
      <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tx-muted)', fontWeight: 500 }}>CALORIES</span>
            <div style={{ padding: '4px 12px', backgroundColor: 'rgba(0, 184, 217, 0.15)', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38d8fb' }}>{Math.max(0, 2000 - Math.round(nutritionToday.calories))} left</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--tx-primary)', lineHeight: 1 }}>{Math.round(nutritionToday.calories)}</span>
            <span style={{ fontSize: '1rem', color: 'var(--tx-muted)' }}>/ 2000</span>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: '6px', backgroundColor: 'var(--surface-muted)', borderRadius: '3px', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ height: '100%', width: `${Math.min((nutritionToday.calories / 2000) * 100, 100)}%`, backgroundColor: '#00b8d9', transition: 'width 0.3s ease' }}></div>
        </div>

        {/* Macro circles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {/* Protein */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 12px' }}>
              <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--surface-muted)" strokeWidth="6"></circle>
                <circle cx="40" cy="40" r="34" fill="none" stroke="#3b82f6" strokeWidth="6" strokeDasharray={`${Math.min((nutritionToday.protein / 150) * 100, 100) * 2.14} 214`} strokeLinecap="round"></circle>
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.1rem', fontWeight: 700, color: '#3b82f6' }}>
                {Math.round((nutritionToday.protein / 150) * 100)}%
              </div>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--tx-primary)', marginBottom: '2px' }}>{Math.round(nutritionToday.protein)}g</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--tx-muted)' }}>Protein / 150g</div>
          </div>

          {/* Carbs */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 12px' }}>
              <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--surface-muted)" strokeWidth="6"></circle>
                <circle cx="40" cy="40" r="34" fill="none" stroke="#f59e0b" strokeWidth="6" strokeDasharray={`${Math.min((nutritionToday.carbs / 250) * 100, 100) * 2.14} 214`} strokeLinecap="round"></circle>
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.1rem', fontWeight: 700, color: '#f59e0b' }}>
                {Math.round((nutritionToday.carbs / 250) * 100)}%
              </div>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--tx-primary)', marginBottom: '2px' }}>{Math.round(nutritionToday.carbs)}g</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--tx-muted)' }}>Carbs / 250g</div>
          </div>

          {/* Fat */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 12px' }}>
              <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--surface-muted)" strokeWidth="6"></circle>
                <circle cx="40" cy="40" r="34" fill="none" stroke="#8b5cf6" strokeWidth="6" strokeDasharray={`${Math.min((nutritionToday.fat / 65) * 100, 100) * 2.14} 214`} strokeLinecap="round"></circle>
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.1rem', fontWeight: 700, color: '#8b5cf6' }}>
                {Math.round((nutritionToday.fat / 65) * 100)}%
              </div>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--tx-primary)', marginBottom: '2px' }}>{Math.round(nutritionToday.fat)}g</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--tx-muted)' }}>Fat / 65g</div>
          </div>
        </div>
      </div>

      {/* Meals */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {/* Breakfast */}
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ fontSize: '1.2rem' }}>☕</div>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--tx-primary)' }}>Breakfast</span>
          </div>
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--tx-muted)', fontSize: '0.85rem' }}>
            No items logged
          </div>
        </div>

        {/* Lunch */}
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ fontSize: '1.2rem' }}>☀️</div>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--tx-primary)' }}>Lunch</span>
          </div>
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--tx-muted)', fontSize: '0.85rem' }}>
            No items logged
          </div>
        </div>

        {/* Dinner */}
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ fontSize: '1.2rem' }}>🌙</div>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--tx-primary)' }}>Dinner</span>
          </div>
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--tx-muted)', fontSize: '0.85rem' }}>
            No items logged
          </div>
        </div>

        {/* Snacks */}
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ fontSize: '1.2rem' }}>🍎</div>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--tx-primary)' }}>Snacks</span>
          </div>
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--tx-muted)', fontSize: '0.85rem' }}>
            No items logged
          </div>
        </div>
      </div>

      {/* Macro History */}
      <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--tx-primary)', margin: 0 }}>
            Macro History
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setSelectedPeriod('7d')}
              style={{
                padding: '6px 12px',
                backgroundColor: selectedPeriod === '7d' ? 'var(--surface-overlay)' : 'transparent',
                border: selectedPeriod === '7d' ? '1px solid var(--surface-border)' : '1px solid transparent',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: selectedPeriod === '7d' ? 'var(--tx-primary)' : 'var(--tx-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              7d
            </button>
            <button
              onClick={() => setSelectedPeriod('30d')}
              style={{
                padding: '6px 12px',
                backgroundColor: selectedPeriod === '30d' ? 'var(--surface-overlay)' : 'transparent',
                border: selectedPeriod === '30d' ? '1px solid var(--surface-border)' : '1px solid transparent',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: selectedPeriod === '30d' ? 'var(--tx-primary)' : 'var(--tx-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              30d
            </button>
            <button
              onClick={() => setSelectedPeriod('90d')}
              style={{
                padding: '6px 12px',
                backgroundColor: selectedPeriod === '90d' ? 'var(--surface-overlay)' : 'transparent',
                border: selectedPeriod === '90d' ? '1px solid var(--surface-border)' : '1px solid transparent',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: selectedPeriod === '90d' ? 'var(--tx-primary)' : 'var(--tx-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              90d
            </button>
          </div>
        </div>

        {/* Empty state */}
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.3 }}>📊</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--tx-muted)', margin: 0 }}>
            No data yet — start logging meals
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '2px' }}></div>
            <span style={{ fontSize: '0.75rem', color: 'var(--tx-muted)' }}>Protein</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#f59e0b', borderRadius: '2px' }}></div>
            <span style={{ fontSize: '0.75rem', color: 'var(--tx-muted)' }}>Carbs</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#8b5cf6', borderRadius: '2px' }}></div>
            <span style={{ fontSize: '0.75rem', color: 'var(--tx-muted)' }}>Fat</span>
          </div>
        </div>
      </div>
    </div>
  )
}

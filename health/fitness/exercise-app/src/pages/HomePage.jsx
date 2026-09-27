import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function HomePage() {
  const now = new Date()
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()]
  const monthDay = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  // State
  const [weightHover, setWeightHover] = useState(null)
  const [weekSessions, setWeekSessions] = useState(0)
  const [weightData, setWeightData] = useState([])
  const [lastWorkout, setLastWorkout] = useState(null)
  const [nutritionToday, setNutritionToday] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  const [workoutDays, setWorkoutDays] = useState([])

  // Load data
  useEffect(() => {
    loadWorkoutStats()
    loadWeightData()
    loadLastWorkout()
    loadNutritionToday()
    loadConsistencyData()
  }, [])

  async function loadWorkoutStats() {
    const startOfWeek = new Date()
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('whoop_workouts')
      .select('start_time')
      .gte('start_time', startOfWeek.toISOString())

    if (error) {
      console.error('Workout stats error:', error)
      return
    }

    console.log('Workout stats:', data)

    if (data) {
      const uniqueDays = new Set(data.map(w => new Date(w.start_time).toDateString()))
      setWeekSessions(uniqueDays.size)
    }
  }

  async function loadWeightData() {
    const { data, error } = await supabase
      .from('body_composition')
      .select('measured_at, weight_kg')
      .order('measured_at', { ascending: false })
      .limit(8)

    if (error) {
      console.error('Weight data error:', error)
      return
    }

    console.log('Weight data:', data)

    if (data && data.length > 0) {
      const formatted = data.reverse().map(d => ({
        date: new Date(d.measured_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        weight: (d.weight_kg * 2.20462).toFixed(1) // Convert kg to lb
      }))
      setWeightData(formatted)
    }
  }

  async function loadLastWorkout() {
    const { data, error } = await supabase
      .from('whoop_workouts')
      .select('*')
      .order('start_time', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Last workout error:', error)
      return
    }

    console.log('Last workout:', data)

    if (data && data.length > 0) {
      setLastWorkout(data[0])
    }
  }

  async function loadNutritionToday() {
    // Note: Using meal_plan table - adjust if your nutrition data is elsewhere
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    const { data } = await supabase
      .from('meal_plan')
      .select('*')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())

    if (data && data.length > 0) {
      // Adjust field names based on your actual meal_plan schema
      const totals = data.reduce((acc, item) => ({
        calories: acc.calories + (item.calories || 0),
        protein: acc.protein + (item.protein || item.protein_g || 0),
        carbs: acc.carbs + (item.carbs || item.carbs_g || 0),
        fat: acc.fat + (item.fat || item.fat_g || 0)
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 })
      setNutritionToday(totals)
    }
  }

  async function loadConsistencyData() {
    // Load last 84 days (12 weeks) of workouts
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 84)

    const { data, error } = await supabase
      .from('whoop_workouts')
      .select('start_time')
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())

    if (error) {
      console.error('Consistency data error:', error)
      return
    }

    console.log('Consistency data:', data)

    if (data) {
      // Extract unique workout dates (YYYY-MM-DD format)
      const dates = data.map(w => new Date(w.start_time).toISOString().split('T')[0])
      console.log('Workout dates for heatmap:', dates.slice(0, 10)) // Show first 10
      console.log('Total workout days:', dates.length)
      setWorkoutDays(dates)
    }
  }

  const minWeight = weightData.length > 0 ? Math.min(...weightData.map(d => parseFloat(d.weight))) - 0.5 : 173
  const maxWeight = weightData.length > 0 ? Math.max(...weightData.map(d => parseFloat(d.weight))) + 0.5 : 174
  const weightRange = maxWeight - minWeight

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '11px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, margin: 0 }}>
            {dayName}, {monthDay}
          </p>
          <h1 style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--tx-primary)', marginTop: '2px', marginBottom: 0 }}>
            {greeting}
          </h1>
        </div>
      </div>

      {/* Up Next Card */}
      <Link to="/exercises" style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '12px', transition: 'background-color 0.15s', textDecoration: 'none' }}>
        <div style={{ width: '40px', height: '40px', flexShrink: 0, backgroundColor: 'var(--surface-muted)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
          💪
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Up next · Workout
          </p>
          <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--tx-primary)', margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Start your first workout
          </p>
          <p style={{ fontSize: '12px', color: 'var(--tx-muted)', margin: '2px 0 0 0' }}>
            Browse exercises to begin
          </p>
        </div>
      </Link>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 500 }}>Week</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--tx-muted)', opacity: 0.7 }}>
              <path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"></path>
              <path d="m2.5 21.5 1.4-1.4"></path>
              <path d="m20.1 3.9 1.4-1.4"></path>
              <path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"></path>
              <path d="m9.6 14.4 4.8-4.8"></path>
            </svg>
          </div>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--tx-primary)', lineHeight: 1, margin: 0 }}>{weekSessions}</p>
          <p style={{ fontSize: '10px', color: 'var(--tx-muted)', margin: 0 }}>sessions</p>
        </div>
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 500 }}>Cals</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--tx-muted)', opacity: 0.7 }}>
              <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"></path>
            </svg>
          </div>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--tx-primary)', lineHeight: 1, margin: 0 }}>{Math.round(nutritionToday.calories)}</p>
          <div style={{ height: '4px', backgroundColor: 'var(--surface-muted)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min((nutritionToday.calories / 2000) * 100, 100)}%`, background: '#00b8d9', transition: 'width 0.3s ease' }}></div>
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 500 }}>Protein</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--tx-muted)', opacity: 0.7 }}>
              <path d="M16.4 13.7A6.5 6.5 0 1 0 6.28 6.6c-1.1 3.13-.78 3.9-3.18 6.08A3 3 0 0 0 5 18c4 0 8.4-1.8 11.4-4.3"></path>
              <path d="m18.5 6 2.19 4.5a6.48 6.48 0 0 1-2.29 7.2C15.4 20.2 11 22 7 22a3 3 0 0 1-2.68-1.66L2.4 16.5"></path>
              <circle cx="12.5" cy="8.5" r="2.5"></circle>
            </svg>
          </div>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--tx-primary)', lineHeight: 1, margin: 0 }}>
            {Math.round(nutritionToday.protein)}<span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--tx-muted)', marginLeft: '2px' }}>g</span>
          </p>
          <div style={{ height: '4px', backgroundColor: 'var(--surface-muted)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min((nutritionToday.protein / 150) * 100, 100)}%`, background: '#f59e0b', transition: 'width 0.3s ease' }}></div>
          </div>
        </div>
      </div>

      {/* Volume Trend */}
      <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-500)', flexShrink: 0 }}>
              <path d="M16 7h6v6"></path>
              <path d="m22 7-8.5 8.5-5-5L2 17"></path>
            </svg>
            <h2 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-secondary)' }}>Volume Trend</h2>
          </div>
          <div style={{ flexShrink: 0, display: 'flex', gap: '4px', backgroundColor: 'var(--surface-overlay)', borderRadius: '8px', padding: '4px' }}>
            <button style={{ padding: '6px 12px', border: '1px solid var(--surface-border)', backgroundColor: 'var(--surface-raised)', borderRadius: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--tx-primary)', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>7</button>
            <button style={{ padding: '6px 12px', border: 'none', backgroundColor: 'transparent', borderRadius: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--tx-muted)', cursor: 'pointer' }}>14</button>
            <button style={{ padding: '6px 12px', border: 'none', backgroundColor: 'transparent', borderRadius: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--tx-muted)', cursor: 'pointer' }}>30</button>
          </div>
        </div>
        <div style={{ height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--surface-base)', borderRadius: '8px', color: 'var(--tx-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
          No workout data yet
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: i === 5 ? 'var(--brand-400)' : 'var(--tx-muted)' }}>{day}</span>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: i === 5 ? 'transparent' : 'rgba(28, 47, 80, 0.6)', border: i === 5 ? '2px solid var(--brand-500)' : '2px solid transparent', transition: 'all 0.2s ease' }}></div>
            </div>
          ))}
        </div>
      </div>

      {/* Consistency Heatmap */}
      <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-500)' }}>
              <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"></path>
            </svg>
            <h2 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-secondary)' }}>Consistency</h2>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--tx-muted)' }}>12 weeks</span>
        </div>
        <div style={{ display: 'flex', gap: '18px', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--tx-muted)' }}>
            <span style={{ height: '24px', lineHeight: '24px' }}>M</span>
            <span style={{ height: '24px', lineHeight: '24px' }}>T</span>
            <span style={{ height: '24px', lineHeight: '24px' }}>W</span>
            <span style={{ height: '24px', lineHeight: '24px' }}>T</span>
            <span style={{ height: '24px', lineHeight: '24px' }}>F</span>
            <span style={{ height: '24px', lineHeight: '24px' }}>S</span>
            <span style={{ height: '24px', lineHeight: '24px' }}>S</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {Array.from({ length: 12 }).map((_, weekIndex) => (
              <div key={weekIndex} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {Array.from({ length: 7 }).map((_, dayIndex) => {
                  const now = new Date()
                  now.setHours(0, 0, 0, 0)
                  const dayOfWeek = now.getDay()
                  const daysFromMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1
                  const monday = new Date(now)
                  monday.setDate(now.getDate() - daysFromMon)
                  const firstMonday = new Date(monday)
                  firstMonday.setDate(monday.getDate() - (11 * 7))
                  const currentDay = new Date(firstMonday)
                  currentDay.setDate(firstMonday.getDate() + (weekIndex * 7) + dayIndex)
                  const dayString = currentDay.toISOString().split('T')[0]
                  const isWorkoutDay = workoutDays.includes(dayString)
                  const isFutureDay = currentDay > now

                  return (
                    <div
                      key={dayIndex}
                      title={`${dayString}${isWorkoutDay ? ' - Workout' : ''}`}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '4px',
                        background: isFutureDay ? 'rgba(22, 34, 64, 0.3)' : isWorkoutDay ? '#00b8d9' : 'rgba(22, 34, 64, 0.5)',
                        cursor: 'pointer'
                      }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Workout + Nutrition */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-secondary)' }}>Recent Workout</h3>
            <Link to="/workouts" style={{ fontSize: '12px', color: 'var(--brand-400)', textDecoration: 'none', transition: 'color 0.15s ease' }}>All →</Link>
          </div>
          {lastWorkout ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--tx-primary)', margin: 0 }}>
                  {lastWorkout.sport_name || 'Workout'}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--tx-muted)', margin: '4px 0 0 0' }}>
                  {new Date(lastWorkout.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div>
                  <p style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Strain</p>
                  <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0 }}>
                    {lastWorkout.strain ? lastWorkout.strain.toFixed(1) : '—'}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Calories</p>
                  <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--tx-primary)', margin: 0 }}>
                    {lastWorkout.calories_kcal ? Math.round(lastWorkout.calories_kcal) : '—'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 16px 0', color: 'var(--tx-muted)', fontSize: '0.9rem' }}>No workouts logged yet</p>
              <Link to="/exercises" style={{ display: 'inline-block', padding: '8px 16px', backgroundColor: 'var(--brand-500)', color: 'white', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', transition: 'background-color 0.15s ease' }}>Start Your First Workout</Link>
            </div>
          )}
        </div>
        <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-secondary)' }}>Today's Nutrition</h3>
            <Link to="/food" style={{ fontSize: '12px', color: 'var(--brand-400)', textDecoration: 'none', transition: 'color 0.15s ease' }}>Log →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--tx-primary)', lineHeight: 1 }}>{Math.round(nutritionToday.calories)}</span>
                <span style={{ fontSize: '12px', color: 'var(--tx-muted)' }}>/ 2000 kcal</span>
              </div>
              <div style={{ height: '4px', backgroundColor: 'var(--surface-muted)', borderRadius: '2px', overflow: 'hidden', marginTop: '12px' }}>
                <div style={{ height: '100%', width: `${Math.min((nutritionToday.calories / 2000) * 100, 100)}%`, background: '#00b8d9', transition: 'width 0.3s ease' }}></div>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--tx-muted)' }}>Protein</span>
                <span style={{ color: 'var(--tx-primary)', fontWeight: 600 }}>{Math.round(nutritionToday.protein)}g <span style={{ opacity: 0.6 }}>/ 150g</span></span>
              </div>
              <div style={{ height: '4px', backgroundColor: 'var(--surface-muted)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min((nutritionToday.protein / 150) * 100, 100)}%`, background: '#3b82f6', transition: 'width 0.3s ease' }}></div>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--tx-muted)' }}>Carbs</span>
                <span style={{ color: 'var(--tx-primary)', fontWeight: 600 }}>{Math.round(nutritionToday.carbs)}g <span style={{ opacity: 0.6 }}>/ 250g</span></span>
              </div>
              <div style={{ height: '4px', backgroundColor: 'var(--surface-muted)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min((nutritionToday.carbs / 250) * 100, 100)}%`, background: '#f59e0b', transition: 'width 0.3s ease' }}></div>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--tx-muted)' }}>Fat</span>
                <span style={{ color: 'var(--tx-primary)', fontWeight: 600 }}>{Math.round(nutritionToday.fat)}g <span style={{ opacity: 0.6 }}>/ 65g</span></span>
              </div>
              <div style={{ height: '4px', backgroundColor: 'var(--surface-muted)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min((nutritionToday.fat / 65) * 100, 100)}%`, background: '#8b5cf6', transition: 'width 0.3s ease' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Muscle Balance */}
      <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-500)', flexShrink: 0 }}>
              <path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"></path>
              <path d="m2.5 21.5 1.4-1.4"></path>
              <path d="m20.1 3.9 1.4-1.4"></path>
              <path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"></path>
              <path d="m9.6 14.4 4.8-4.8"></path>
            </svg>
            <h2 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-secondary)' }}>Muscle Balance</h2>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--tx-muted)' }}>49 workouts</span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--tx-muted)', marginTop: '0', marginBottom: '12px', fontStyle: 'italic' }}>Can't fit through doorways. Good.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { name: 'Shoulders', sets: 150, pct: 21, color: '#818cf8', top: true },
            { name: 'Hamstrings', sets: 120, pct: 16, color: '#6ee7b7' },
            { name: 'Chest', sets: 119, pct: 16, color: '#f87171' },
            { name: 'Quadriceps', sets: 88, pct: 12, color: '#34d399' },
            { name: 'Calves', sets: 88, pct: 12, color: '#4ade80' },
            { name: 'Middle-Back', sets: 64, pct: 9, color: '#6366f1' },
            { name: 'Triceps', sets: 51, pct: 7, color: '#a78bfa' },
            { name: 'Lats', sets: 48, pct: 7, color: '#38bdf8' }
          ].map((muscle, i) => (
            <div key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, backgroundColor: muscle.color }}></div>
                <span style={{ fontSize: '12px', textTransform: 'capitalize', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: muscle.top ? 600 : 400, color: muscle.top ? 'var(--tx-primary)' : 'var(--tx-secondary)' }}>
                  {muscle.name}
                  {muscle.top && <span style={{ marginLeft: '4px', fontSize: '9px', fontWeight: 400, color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>top</span>}
                </span>
                <svg width="56" height="24" style={{ flexShrink: 0, overflow: 'visible' }}>
                  <path d="M0,12 L8,6 L16,18 L24,8 L32,14 L40,4 L48,16 L56,10" fill="none" stroke={muscle.color} strokeWidth={muscle.top ? "2" : "1.5"} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={muscle.top ? "1" : "0.6"}></path>
                  <circle cx="56" cy="10" r={muscle.top ? "2.5" : "1.5"} fill={muscle.color} fillOpacity={muscle.top ? "1" : "0.7"}></circle>
                </svg>
                <span style={{ fontSize: '12px', color: 'var(--tx-muted)', fontVariantNumeric: 'tabular-nums', width: '64px', textAlign: 'right', flexShrink: 0 }}>{muscle.sets} · {muscle.pct}%</span>
              </div>
              <div style={{ height: '4px', backgroundColor: 'var(--surface-muted)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${muscle.pct}%`, backgroundColor: muscle.color, opacity: muscle.top ? 1 : 0.6, transition: 'width 0.3s ease' }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weight */}
      <div style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-500)', flexShrink: 0 }}>
              <path d="M12 3v18"></path>
              <path d="m3 7 3 8a5 5 0 0 0 6 0l3-8"></path>
              <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"></path>
              <path d="m19 7 3 8a5 5 0 0 1-6 0l-3-8"></path>
              <path d="M7 21h10"></path>
            </svg>
            <h2 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-secondary)' }}>Weight</h2>
          </div>
          <Link to="/weight" style={{ fontSize: '12px', color: 'var(--brand-400)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', transition: 'color 0.15s ease' }}>
            View
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"></path>
              <path d="m12 5 7 7-7 7"></path>
            </svg>
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--tx-primary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {weightData.length > 0 ? parseFloat(weightData[weightData.length - 1].weight).toFixed(1) : '—'}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--tx-muted)' }}>lb</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--tx-muted)' }}>
            {weightData.length >= 2 ? (
              <>
                7d · {(() => {
                  const latest = parseFloat(weightData[weightData.length - 1].weight)
                  const oldest = parseFloat(weightData[0].weight)
                  const change = latest - oldest
                  return change === 0 ? 'no change' : `${change > 0 ? '+' : ''}${change.toFixed(1)} lb`
                })()}
              </>
            ) : '7d · no data'}
          </span>
        </div>
        <div style={{ width: '100%', height: '48px', position: 'relative' }}>
          <svg
            width="100%"
            height="48"
            viewBox="0 0 1000 48"
            style={{ width: '100%', height: '100%' }}
            onMouseLeave={() => setWeightHover(null)}
          >
            <defs>
              <clipPath id="weight-clip">
                <rect x="0" y="0" width="1000" height="48"></rect>
              </clipPath>
            </defs>
            <path
              d={weightData.map((d, i) => {
                const x = (i / (weightData.length - 1)) * 1000
                const y = 48 - ((d.weight - minWeight) / weightRange) * 38 - 5
                return `${i === 0 ? 'M' : 'L'}${x},${y}`
              }).join(' ')}
              stroke="#6366f1"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {weightData.map((d, i) => {
              const x = (i / (weightData.length - 1)) * 1000
              const y = 48 - ((d.weight - minWeight) / weightRange) * 38 - 5
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={weightHover === i ? "4" : "0"}
                  fill="#6366f1"
                  onMouseEnter={() => setWeightHover(i)}
                />
              )
            })}
            {weightData.map((d, i) => {
              const x = (i / (weightData.length - 1)) * 1000
              const y = 48 - ((d.weight - minWeight) / weightRange) * 38 - 5
              return (
                <rect
                  key={`hover-${i}`}
                  x={x - 30}
                  y="0"
                  width="60"
                  height="48"
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setWeightHover(i)}
                />
              )
            })}
          </svg>
          {weightHover !== null && (
            <div style={{
              position: 'absolute',
              left: `${(weightHover / (weightData.length - 1)) * 100}%`,
              top: `${48 - ((weightData[weightHover].weight - minWeight) / weightRange) * 38 - 5}px`,
              transform: 'translate(-50%, -100%)',
              backgroundColor: 'var(--surface-raised)',
              border: '1px solid var(--surface-border)',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '11px',
              color: 'var(--tx-primary)',
              whiteSpace: 'nowrap',
              marginTop: '-8px',
              pointerEvents: 'none',
              zIndex: 10
            }}>
              <div style={{ fontWeight: 600 }}>{weightData[weightHover].date}</div>
              <div style={{ color: '#6366f1', fontWeight: 700 }}>Weight: {weightData[weightHover].weight} lb</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

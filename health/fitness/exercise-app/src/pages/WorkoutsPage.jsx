import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'

export default function WorkoutsPage() {
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadWorkouts() {
      setLoading(true)
      setError(null)

      try {
        const { data, error: err } = await supabase
          .from('workouts')
          .select(`
            *,
            workout_exercises(count)
          `)
          .order('created_at', { ascending: false })

        if (err) throw err
        if (!cancelled) setWorkouts(data || [])
      } catch (err) {
        if (!cancelled) setError(err.message || String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadWorkouts()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <div className="status-block">Loading workouts...</div>
  }

  if (error) {
    return (
      <div className="status-block error">
        Failed to load workouts: {error}
      </div>
    )
  }

  if (workouts.length === 0) {
    return (
      <div className="workouts-empty">
        <h2>No Workouts Yet</h2>
        <p>Build your first workout from the exercises page!</p>
        <Link to="/" className="workouts-empty-button">
          Browse Exercises
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="workouts-header">
        <h1>My Workouts</h1>
        <Link to="/" className="workouts-header-button">
          + Build New Workout
        </Link>
      </div>

      <div className="workouts-grid">
        {workouts.map((workout) => {
          const exerciseCount = workout.workout_exercises?.[0]?.count || 0
          const createdDate = new Date(workout.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })

          return (
            <Link
              key={workout.id}
              to={`/workout/${workout.id}`}
              className="workout-card"
            >
              <div className="workout-card-body">
                <h3 className="workout-card-title">{workout.name}</h3>
                {workout.description && (
                  <p className="workout-card-description">{workout.description}</p>
                )}
                <div className="workout-card-meta">
                  <span className="workout-card-stat">
                    {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
                  </span>
                  <span className="workout-card-date">{createdDate}</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}

import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'

export default function WorkoutDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [workout, setWorkout] = useState(null)
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadWorkout() {
      setLoading(true)
      setError(null)

      try {
        // Load workout
        const { data: workoutData, error: workoutError } = await supabase
          .from('workouts')
          .select('*')
          .eq('id', id)
          .single()

        if (workoutError) throw workoutError

        // Load workout exercises with full exercise details
        const { data: exercisesData, error: exercisesError } = await supabase
          .from('workout_exercises')
          .select(`
            *,
            exercises (*)
          `)
          .eq('workout_id', id)
          .order('order_index', { ascending: true })

        if (exercisesError) throw exercisesError

        if (!cancelled) {
          setWorkout(workoutData)
          setExercises(exercisesData || [])
        }
      } catch (err) {
        if (!cancelled) setError(err.message || String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadWorkout()
    return () => {
      cancelled = true
    }
  }, [id])

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this workout?')) return

    setDeleting(true)
    try {
      const { error: deleteError } = await supabase
        .from('workouts')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      navigate('/workouts')
    } catch (err) {
      alert('Failed to delete workout: ' + (err.message || String(err)))
      setDeleting(false)
    }
  }

  if (loading) {
    return <div className="status-block">Loading workout...</div>
  }

  if (error) {
    return (
      <div className="status-block error">
        Failed to load workout: {error}
      </div>
    )
  }

  if (!workout) {
    return <div className="status-block">Workout not found.</div>
  }

  const createdDate = new Date(workout.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  return (
    <>
      <Link to="/workouts" className="detail-back">
        ← Back to workouts
      </Link>

      <div className="workout-detail-header">
        <div>
          <h1>{workout.name}</h1>
          {workout.description && (
            <p className="workout-detail-description">{workout.description}</p>
          )}
          <div className="workout-detail-meta">
            <span>{exercises.length} exercises</span>
            <span>•</span>
            <span>Created {createdDate}</span>
          </div>
        </div>
        <button
          className="workout-delete-button"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? 'Deleting...' : 'Delete Workout'}
        </button>
      </div>

      <div className="workout-exercises-list">
        {exercises.map((we, index) => {
          const exercise = we.exercises
          const firstImage = exercise?.images?.[0]
          const level = exercise?.level ? String(exercise.level).toLowerCase() : ''

          return (
            <div key={we.id} className="workout-exercise-item">
              <div className="workout-exercise-order">{index + 1}</div>
              <Link
                to={`/exercise/${exercise.id}`}
                className="workout-exercise-content"
              >
                <div className="workout-exercise-image">
                  {firstImage ? (
                    <img
                      src={firstImage}
                      alt={exercise.name}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <span className="workout-exercise-placeholder">◐</span>
                  )}
                </div>
                <div className="workout-exercise-info">
                  <div className="workout-exercise-name">{exercise.name}</div>
                  <div className="workout-exercise-meta">
                    {exercise.muscle_group && (
                      <span className="pill muscle">{exercise.muscle_group}</span>
                    )}
                    {exercise.level && (
                      <span className={`pill level-${level}`}>{exercise.level}</span>
                    )}
                    {exercise.equipment && (
                      <span className="pill">{exercise.equipment}</span>
                    )}
                  </div>
                </div>
              </Link>
            </div>
          )
        })}
      </div>
    </>
  )
}

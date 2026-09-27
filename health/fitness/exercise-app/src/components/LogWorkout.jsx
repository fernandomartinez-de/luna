import { useState } from 'react'
import { supabase } from '../supabaseClient.js'

export default function LogWorkout({ exerciseId, onLogAdded }) {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [sets, setSets] = useState('1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const { error: insertError } = await supabase
        .from('workout_logs')
        .insert({
          exercise_id: exerciseId,
          weight: parseFloat(weight),
          reps: parseInt(reps),
          sets: parseInt(sets)
        })

      if (insertError) throw insertError

      // Clear form
      setWeight('')
      setReps('')
      setSets('1')
      setSuccess(true)

      // Notify parent to refresh data
      if (onLogAdded) onLogAdded()

      // Clear success message after 2 seconds
      setTimeout(() => setSuccess(false), 2000)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="log-workout-card">
      <h2>Log Workout</h2>
      <form onSubmit={handleSubmit} className="log-workout-form">
        <div className="log-workout-row">
          <div className="log-workout-field">
            <label>Weight (lb)</label>
            <input
              type="number"
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              required
              placeholder="0"
            />
          </div>
          <div className="log-workout-field">
            <label>Reps</label>
            <input
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              required
              placeholder="0"
            />
          </div>
          <div className="log-workout-field">
            <label>Sets</label>
            <input
              type="number"
              value={sets}
              onChange={(e) => setSets(e.target.value)}
              required
              placeholder="1"
            />
          </div>
        </div>

        {error && (
          <div className="log-workout-error">{error}</div>
        )}

        {success && (
          <div className="log-workout-success">✓ Logged successfully!</div>
        )}

        <button
          type="submit"
          className="log-workout-submit"
          disabled={loading}
        >
          {loading ? 'Logging...' : 'Log Workout'}
        </button>
      </form>
    </div>
  )
}

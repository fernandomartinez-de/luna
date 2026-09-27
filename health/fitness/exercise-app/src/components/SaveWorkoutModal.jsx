import { useState } from 'react'
import { supabase } from '../supabaseClient.js'

export default function SaveWorkoutModal({ selectedExercises, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      // Create workout
      const { data: workout, error: workoutError } = await supabase
        .from('workouts')
        .insert({ name, description })
        .select()
        .single()

      if (workoutError) throw workoutError

      // Create workout_exercises entries
      const workoutExercises = selectedExercises.map((exerciseId, index) => ({
        workout_id: workout.id,
        exercise_id: exerciseId,
        order_index: index
      }))

      const { error: exercisesError } = await supabase
        .from('workout_exercises')
        .insert(workoutExercises)

      if (exercisesError) throw exercisesError

      onSaved(workout)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Save Workout</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSave} className="modal-form">
          <div className="modal-field">
            <label>Workout Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Push Day, Leg Day, Full Body"
              required
              autoFocus
            />
          </div>

          <div className="modal-field">
            <label>Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes about this workout..."
              rows={3}
            />
          </div>

          <div className="modal-info">
            {selectedExercises.length} exercise{selectedExercises.length !== 1 ? 's' : ''} selected
          </div>

          {error && (
            <div className="modal-error">{error}</div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="modal-button secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-button primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Workout'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import MuscleFilter from '../components/MuscleFilter.jsx'
import LevelFilter from '../components/LevelFilter.jsx'
import ExerciseCard from '../components/ExerciseCard.jsx'
import SaveWorkoutModal from '../components/SaveWorkoutModal.jsx'

const PAGE_SIZE = 60

export default function ExerciseListPage() {
  const navigate = useNavigate()
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState('all')
  const [selectedLevel, setSelectedLevel] = useState('all')
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [buildMode, setBuildMode] = useState(false)
  const [selectedExercises, setSelectedExercises] = useState([])
  const [showSaveModal, setShowSaveModal] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadAll() {
      setLoading(true)
      setError(null)

      const batchSize = 1000
      let from = 0
      const collected = []

      try {
        while (true) {
          const { data, error: err } = await supabase
            .from('exercises')
            .select(
              'id, name, slug, muscle_group, secondary_muscles, equipment, category, level, images'
            )
            .order('name', { ascending: true })
            .range(from, from + batchSize - 1)

          if (err) throw err
          if (!data || data.length === 0) break
          collected.push(...data)
          if (data.length < batchSize) break
          from += batchSize
        }

        if (!cancelled) {
          setExercises(collected)
        }
      } catch (err) {
        if (!cancelled) setError(err.message || String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadAll()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return exercises.filter((e) => {
      // Muscle group filter
      if (selected !== 'all') {
        const mg = String(e.muscle_group || '').toLowerCase()
        if (mg !== selected) return false
      }
      // Level filter
      if (selectedLevel !== 'all') {
        const level = String(e.level || '').toLowerCase()
        if (level !== selectedLevel) return false
      }
      // Search query
      if (q) {
        const name = String(e.name || '').toLowerCase()
        if (!name.includes(q)) return false
      }
      return true
    })
  }, [exercises, selected, selectedLevel, query])

  useEffect(() => {
    setVisible(PAGE_SIZE)
  }, [selected, selectedLevel, query])

  const shown = filtered.slice(0, visible)
  const hasMore = filtered.length > visible

  const toggleExercise = (exerciseId) => {
    setSelectedExercises((prev) =>
      prev.includes(exerciseId)
        ? prev.filter((id) => id !== exerciseId)
        : [...prev, exerciseId]
    )
  }

  const handleBuildWorkout = () => {
    if (buildMode && selectedExercises.length > 0) {
      setShowSaveModal(true)
    } else {
      setBuildMode(true)
    }
  }

  const cancelBuildMode = () => {
    setBuildMode(false)
    setSelectedExercises([])
  }

  const handleWorkoutSaved = (workout) => {
    setShowSaveModal(false)
    setBuildMode(false)
    setSelectedExercises([])
    // Navigate to the workout detail page
    navigate(`/workout/${workout.id}`)
  }

  return (
    <>
      {/* Build Workout Bar */}
      {buildMode && (
        <div className="build-workout-bar">
          <div className="build-workout-info">
            <span className="build-workout-count">
              {selectedExercises.length} exercise{selectedExercises.length !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="build-workout-actions">
            <button
              className="build-workout-button secondary"
              onClick={cancelBuildMode}
            >
              Cancel
            </button>
            <button
              className="build-workout-button primary"
              onClick={handleBuildWorkout}
              disabled={selectedExercises.length === 0}
            >
              Save Workout
            </button>
          </div>
        </div>
      )}

      <div className="list-toolbar">
        <div className="list-search">
          <span aria-hidden>🔍</span>
          <input
            type="search"
            placeholder="Search exercises by name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="list-count">
            {loading ? 'Loading...' : `${filtered.length} of ${exercises.length}`}
          </span>
        </div>
        <MuscleFilter selected={selected} onChange={setSelected} />
        <LevelFilter selected={selectedLevel} onChange={setSelectedLevel} />

        {!buildMode && (
          <button
            className="build-workout-trigger"
            onClick={handleBuildWorkout}
          >
            Build Workout
          </button>
        )}
      </div>

      {error && (
        <div className="status-block error">
          Failed to load exercises: {error}
        </div>
      )}

      {loading && !error && (
        <div className="status-block">Loading exercises from Supabase...</div>
      )}

      {!loading && !error && shown.length === 0 && (
        <div className="status-block">No exercises match this filter.</div>
      )}

      {!loading && !error && shown.length > 0 && (
        <>
          <div className="exercise-grid">
            {shown.map((ex) => (
              buildMode ? (
                <div
                  key={ex.id}
                  className={`exercise-card-selectable ${
                    selectedExercises.includes(ex.id) ? 'selected' : ''
                  }`}
                  onClick={() => toggleExercise(ex.id)}
                >
                  <input
                    type="checkbox"
                    className="exercise-checkbox"
                    checked={selectedExercises.includes(ex.id)}
                    onChange={() => toggleExercise(ex.id)}
                  />
                  <ExerciseCard exercise={ex} />
                </div>
              ) : (
                <ExerciseCard key={ex.id} exercise={ex} />
              )
            ))}
          </div>
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button
                type="button"
                className="filter-chip"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
              >
                Load more ({filtered.length - visible} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {showSaveModal && (
        <SaveWorkoutModal
          selectedExercises={selectedExercises}
          onClose={() => setShowSaveModal(false)}
          onSaved={handleWorkoutSaved}
        />
      )}
    </>
  )
}

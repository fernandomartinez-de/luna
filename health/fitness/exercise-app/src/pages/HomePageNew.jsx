import { Link } from 'react-router-dom'
import './HomePage.css'

export default function HomePage() {
  const now = new Date()
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()]
  const monthDay = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="lyftr-home">
      {/* Header */}
      <div className="lyftr-header">
        <div>
          <p className="lyftr-date">{dayName}, {monthDay}</p>
          <h1 className="lyftr-greeting">{greeting}</h1>
        </div>
        <Link to="/exercises" className="lyftr-btn-start">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"></path>
          </svg>
          Start
        </Link>
      </div>

      {/* Up Next Card */}
      <div className="lyftr-card lyftr-up-next">
        <Link to="/workouts" className="lyftr-up-next-link">
          <div className="lyftr-up-next-icon">💪</div>
          <div>
            <p className="lyftr-up-next-label">Up next · Workout</p>
            <p className="lyftr-up-next-title">Start your first workout</p>
            <p className="lyftr-up-next-meta">Browse exercises to begin</p>
          </div>
        </Link>
        <Link to="/exercises" className="lyftr-up-next-play">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"></path>
          </svg>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="lyftr-stats-grid">
        <div className="lyftr-card lyftr-stat-card">
          <div className="lyftr-stat-header">
            <span>Week</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"></path>
            </svg>
          </div>
          <p className="lyftr-stat-value">0</p>
          <p className="lyftr-stat-label">sessions</p>
        </div>
        <div className="lyftr-card lyftr-stat-card">
          <div className="lyftr-stat-header">
            <span>Cals</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"></path>
            </svg>
          </div>
          <p className="lyftr-stat-value">0</p>
          <div className="lyftr-progress"><div className="lyftr-progress-bar" style={{width:'0%',background:'#00b8d9'}}></div></div>
        </div>
        <div className="lyftr-card lyftr-stat-card">
          <div className="lyftr-stat-header">
            <span>Protein</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12.5" cy="8.5" r="2.5"></circle>
            </svg>
          </div>
          <p className="lyftr-stat-value">0<span className="lyftr-stat-unit">g</span></p>
          <div className="lyftr-progress"><div className="lyftr-progress-bar" style={{width:'0%',background:'#f59e0b'}}></div></div>
        </div>
      </div>

      {/* Volume Trend */}
      <div className="lyftr-card">
        <div className="lyftr-card-header">
          <div className="lyftr-card-title-row">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 7h6v6"></path><path d="m22 7-8.5 8.5-5-5L2 17"></path>
            </svg>
            <h2>Volume Trend</h2>
          </div>
          <div className="lyftr-period-btns">
            <button className="active">7</button>
            <button>14</button>
            <button>30</button>
          </div>
        </div>
        <div className="lyftr-chart-empty">No workout data yet</div>
        <div className="lyftr-weekly-dots">
          {['M','T','W','T','F','S','S'].map((d,i) => (
            <div key={i} className="lyftr-dot-col">
              <span>{d}</span>
              <div className={`lyftr-dot ${i === 5 ? 'active' : ''}`}></div>
            </div>
          ))}
        </div>
      </div>

      {/* Consistency */}
      <div className="lyftr-card">
        <div className="lyftr-card-header">
          <div className="lyftr-card-title-row">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"></path>
            </svg>
            <h2>Consistency</h2>
          </div>
          <span className="lyftr-card-subtitle">12 weeks</span>
        </div>
        <div className="lyftr-heatmap-grid">
          <div className="lyftr-heatmap-labels">
            <span>M</span><span></span><span>W</span><span></span><span>F</span><span></span><span></span>
          </div>
          <div className="lyftr-heatmap">
            {Array.from({length: 12}).map((_, week) => (
              <div key={week} className="lyftr-heatmap-col">
                {Array.from({length: 7}).map((_, day) => (
                  <div key={day} className="lyftr-heatmap-cell"></div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Workout + Nutrition */}
      <div className="lyftr-two-col">
        <div className="lyftr-card">
          <div className="lyftr-card-header">
            <h3>Recent Workout</h3>
            <Link to="/workouts" className="lyftr-link-small">All →</Link>
          </div>
          <div className="lyftr-empty-card">
            <p>No workouts logged yet</p>
            <Link to="/exercises" className="lyftr-btn-sm">Start Your First Workout</Link>
          </div>
        </div>
        <div className="lyftr-card">
          <div className="lyftr-card-header">
            <h3>Today's Nutrition</h3>
            <Link to="/food" className="lyftr-link-small">Log →</Link>
          </div>
          <div className="lyftr-nutrition">
            <div className="lyftr-nutrition-main">
              <span className="lyftr-nutrition-big">0</span>
              <span className="lyftr-nutrition-small">/ 2000 kcal</span>
            </div>
            <div className="lyftr-progress"><div className="lyftr-progress-bar" style={{width:'0%',background:'#00b8d9'}}></div></div>
            <div className="lyftr-macro">
              <div className="lyftr-macro-row">
                <span>Protein</span>
                <span>0g <span style={{opacity:0.6}}>/ 150g</span></span>
              </div>
              <div className="lyftr-progress"><div className="lyftr-progress-bar" style={{width:'0%',background:'#3b82f6'}}></div></div>
            </div>
            <div className="lyftr-macro">
              <div className="lyftr-macro-row">
                <span>Carbs</span>
                <span>0g <span style={{opacity:0.6}}>/ 250g</span></span>
              </div>
              <div className="lyftr-progress"><div className="lyftr-progress-bar" style={{width:'0%',background:'#f59e0b'}}></div></div>
            </div>
            <div className="lyftr-macro">
              <div className="lyftr-macro-row">
                <span>Fat</span>
                <span>0g <span style={{opacity:0.6}}>/ 65g</span></span>
              </div>
              <div className="lyftr-progress"><div className="lyftr-progress-bar" style={{width:'0%',background:'#8b5cf6'}}></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

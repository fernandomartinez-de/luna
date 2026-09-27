import React from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import HubPage from './pages/HubPage.jsx'
import HomePage from './pages/HomePage.jsx'
import ExerciseListPage from './pages/ExerciseListPage.jsx'
import ExerciseDetailPage from './pages/ExerciseDetailPage.jsx'
import WorkoutsPage from './pages/WorkoutsPage.jsx'
import WorkoutDetailPage from './pages/WorkoutDetailPage.jsx'
import ProgramsPage from './pages/ProgramsPage.jsx'
import FoodPage from './pages/FoodPage.jsx'
import WeightPage from './pages/WeightPage.jsx'
import FinancesOverviewPage from './pages/FinancesOverviewPage.jsx'
import FinancesDashboardPage from './pages/FinancesDashboardPage.jsx'
import './App.css'

export default function App() {
  const location = useLocation()
  const path = location.pathname

  const isHub = path === '/'
  const isFinances = path === '/finances' || path.startsWith('/finances/')

  const isActive = (target, opts = {}) => {
    if (opts.exact) return path === target
    return path === target || path.startsWith(target + '/')
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-title">
          <span className="app-title-mark">🧭</span>
          <span>hub</span>
        </Link>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<HubPage />} />
          <Route path="/fitness" element={<HomePage />} />
          <Route path="/exercises" element={<ExerciseListPage />} />
          <Route path="/exercise/:id" element={<ExerciseDetailPage />} />
          <Route path="/workouts" element={<WorkoutsPage />} />
          <Route path="/workout/:id" element={<WorkoutDetailPage />} />
          <Route path="/programs" element={<ProgramsPage />} />
          <Route path="/food" element={<FoodPage />} />
          <Route path="/weight" element={<WeightPage />} />
          <Route path="/finances" element={<FinancesOverviewPage />} />
          <Route path="/finances/dashboard" element={<FinancesDashboardPage />} />
        </Routes>
      </main>

      {isHub ? null : isFinances ? (
        <nav className="bottom-nav">
          <Link to="/finances" className={`bottom-nav-item ${isActive('/finances', { exact: true }) ? 'active' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            <span>Overview</span>
          </Link>
          <Link to="/finances/dashboard" className={`bottom-nav-item ${isActive('/finances/dashboard') ? 'active' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            <span>Dashboard</span>
          </Link>
          <Link to="/" className="bottom-nav-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
            <span>Menu</span>
          </Link>
        </nav>
      ) : (
        <nav className="bottom-nav">
          <Link to="/fitness" className={`bottom-nav-item ${isActive('/fitness', { exact: true }) ? 'active' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span>Home</span>
          </Link>
          <Link to="/exercises" className={`bottom-nav-item ${isActive('/exercises') || isActive('/exercise') ? 'active' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"></path>
              <path d="m2.5 21.5 1.4-1.4"></path>
              <path d="m20.1 3.9 1.4-1.4"></path>
              <path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"></path>
              <path d="m9.6 14.4 4.8-4.8"></path>
            </svg>
            <span>Exercises</span>
          </Link>
          <Link to="/workouts" className={`bottom-nav-item ${isActive('/workouts') || isActive('/workout') ? 'active' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect>
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <path d="M12 11h4"></path>
              <path d="M12 16h4"></path>
              <path d="M8 11h.01"></path>
              <path d="M8 16h.01"></path>
            </svg>
            <span>Workouts</span>
          </Link>
          <Link to="/programs" className={`bottom-nav-item ${isActive('/programs') ? 'active' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
            </svg>
            <span>Programs</span>
          </Link>
          <Link to="/food" className={`bottom-nav-item ${isActive('/food') ? 'active' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20m-5-17A5 5 0 0 1 12 2a5 5 0 0 1 5 3v15a5 5 0 0 1-5 5 5 5 0 0 1-5-5z"></path>
            </svg>
            <span>Food</span>
          </Link>
          <Link to="/weight" className={`bottom-nav-item ${isActive('/weight') ? 'active' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18"></path>
              <path d="m3 7 3 8a5 5 0 0 0 6 0l3-8"></path>
              <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"></path>
              <path d="m19 7 3 8a5 5 0 0 1-6 0l-3-8"></path>
              <path d="M7 21h10"></path>
            </svg>
            <span>Weight</span>
          </Link>
        </nav>
      )}
    </div>
  )
}

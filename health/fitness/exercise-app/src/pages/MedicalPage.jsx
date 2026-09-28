import OncologistView from './medical/OncologistView.jsx'
import NutritionistView from './medical/NutritionistView.jsx'

const CONFIG = {
  oncologist: {
    title: 'Oncologist',
    emoji: '🩺',
    subtitle: 'Lab results, thyroid markers, and diagnostic trends'
  },
  nutritionist: {
    title: 'Nutritionist',
    emoji: '🥑',
    subtitle: 'Daily intake, macros, and body composition'
  }
}

export default function MedicalPage({ dashboard = 'oncologist' }) {
  const cfg = CONFIG[dashboard] || CONFIG.oncologist
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--tx-primary)' }}>{cfg.emoji} {cfg.title}</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--tx-muted)' }}>{cfg.subtitle}</p>
      </div>
      {dashboard === 'nutritionist' ? <NutritionistView /> : <OncologistView />}
    </div>
  )
}

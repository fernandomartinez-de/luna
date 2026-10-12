import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import RubberSegment from '../../components/RubberSegment/RubberSegment.jsx'

const MEAL_META = {
  breakfast: { label: 'Breakfast', color: '#fbbf24' },
  lunch: { label: 'Lunch', color: '#60a5fa' },
  dinner: { label: 'Dinner', color: '#a78bfa' },
  snack: { label: 'Snacks', color: '#f472b6' }
}

const NUTRITION_LABS = [
  { display: 'Vitamin D', group: 'Vitamins', match: (m) => m.includes('vitamin') && m.includes('d') && !m.includes('b') && !m.includes('a ') || m.includes('25(oh)') || m.includes('25-oh') || m.includes('calcidiol') },
  { display: 'Vitamin B12', group: 'Vitamins', match: (m) => m.includes('b12') || m.includes('cobalamin') },
  { display: 'Folate', group: 'Vitamins', match: (m) => m.includes('folat') || m.includes('folic') || m.includes('folico') },
  { display: 'Ferritin', group: 'Minerals', match: (m) => m.includes('ferritin') },
  { display: 'Iron', group: 'Minerals', match: (m) => (m.includes('hierro') || m === 'fe' || m.startsWith('iron')) && !m.includes('bindin') && !m.includes('saturac') },
  { display: 'Magnesium', group: 'Minerals', match: (m) => m.includes('magnesio') || m.includes('magnesium') },
  { display: 'Zinc', group: 'Minerals', match: (m) => m.includes('zinc') },
  { display: 'Calcium', group: 'Minerals', match: (m) => (m.includes('calcio') || m.includes('calcium')) && !m.includes('urinari') && !m.includes('ioniz') },
  { display: 'Glucose', group: 'Metabolic', match: (m) => (m.includes('glucos') || m.includes('glicem')) && !m.includes('post') && !m.includes('2h') },
  { display: 'HbA1c', group: 'Metabolic', match: (m) => m.includes('hba1c') || m.includes('glicosilada') || m.includes('a1c') },
  { display: 'LDL', group: 'Lipids', match: (m) => m.includes('ldl') },
  { display: 'HDL', group: 'Lipids', match: (m) => m.includes('hdl') },
  { display: 'Triglycerides', group: 'Lipids', match: (m) => m.includes('triglic') || m.includes('triglyc') },
  { display: 'Total Cholesterol', group: 'Lipids', match: (m) => (m.includes('colesterol') || m.includes('cholesterol')) && (m.includes('total') || (!m.includes('ldl') && !m.includes('hdl') && !m.includes('vldl'))) },
  { display: 'Albumin', group: 'Protein', match: (m) => (m.includes('albumin') || m.includes('albumina')) && !m.includes('globulin') },
  { display: 'Total Protein', group: 'Protein', match: (m) => (m.includes('proteina') || m.includes('protein')) && m.includes('total') }
]

function toStr(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtShort(iso) {
  if (!iso) return ''
  return new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function shiftIso(iso, days) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toStr(d)
}
function rollingAvg(series, key, window = 7) {
  return series.map((_, i) => {
    const start = Math.max(0, i - window + 1)
    const slice = series.slice(start, i + 1)
    return slice.reduce((s, r) => s + (Number(r[key]) || 0), 0) / slice.length
  })
}
function fmtNum(v) {
  if (v == null || isNaN(v)) return '—'
  const n = Number(v)
  if (Math.abs(n) >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (Math.abs(n) >= 10) return n.toFixed(1)
  return n.toFixed(2)
}

const card = { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '14px', padding: '16px' }
const label = { fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-muted)', margin: '0 0 12px 0' }

export default function NutritionistView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [period] = useState('180d')
  const [macroMode, setMacroMode] = useState('protein')
  const [inbody, setInbody] = useState([])
  const [body, setBody] = useState([])
  const [nutrition, setNutrition] = useState([])
  const [labs, setLabs] = useState([])
  const [inbodyBaseline, setInbodyBaseline] = useState(null)
  const [inbodyCurrent, setInbodyCurrent] = useState(null)
  const [inbodyLatestDate, setInbodyLatestDate] = useState(null)
  const [scaleSelectedDate, setScaleSelectedDate] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const days = period === '30d' ? 30 : period === '180d' ? 180 : 90
      const startIso = shiftIso(toStr(new Date()), -(days - 1))
      const [inbodyRes, bodyRes, nutRes, labRes] = await Promise.all([
        supabase.from('inbody_results').select('*').order('fecha', { ascending: true }),
        supabase.from('body_composition').select('*').order('measured_at', { ascending: true }).limit(400),
        supabase.from('nutrition_log').select('logged_date, meal, calories_kcal, protein_g, carbs_g, fat_g').gte('logged_date', startIso).order('logged_date', { ascending: true }),
        supabase.from('lab_results').select('fecha, marcador, valor, unidad, ref_min, ref_max, flag').order('fecha', { ascending: false })
      ])
      if (cancelled) return
      if (nutRes.error && nutRes.error.code !== '42P01') setError(nutRes.error.message)
      const inbodyArr = inbodyRes.data || []
      setInbody(inbodyArr)
      if (inbodyArr.length >= 2) {
        if (!inbodyBaseline) setInbodyBaseline(inbodyArr[0].fecha)
        if (!inbodyCurrent) setInbodyCurrent(inbodyArr[inbodyArr.length - 1].fecha)
      } else if (inbodyArr.length === 1) {
        setInbodyBaseline(inbodyArr[0].fecha)
        setInbodyCurrent(inbodyArr[0].fecha)
      }
      if (inbodyArr.length > 0 && !inbodyLatestDate) {
        setInbodyLatestDate(inbodyArr[inbodyArr.length - 1].fecha)
      }
      const bodyArr = bodyRes.data || []
      setBody(bodyArr)
      if (bodyArr.length > 0 && !scaleSelectedDate) {
        setScaleSelectedDate(bodyArr[bodyArr.length - 1].measured_at)
      }
      setNutrition(nutRes.data || [])
      setLabs(labRes.data || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [period])

  if (loading) return <div style={{ ...card, textAlign: 'center', color: 'var(--tx-muted)' }}>Loading trends…</div>
  if (error) return <div style={{ ...card, color: '#ef4444' }}>Error: {error}</div>

  // Aggregate nutrition by day
  const byDay = {}
  nutrition.forEach((r) => {
    const k = r.logged_date
    if (!byDay[k]) byDay[k] = { date: k, calories: 0, protein: 0, carbs: 0, fat: 0, byMeal: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 } }
    byDay[k].calories += Number(r.calories_kcal) || 0
    byDay[k].protein += Number(r.protein_g) || 0
    byDay[k].carbs += Number(r.carbs_g) || 0
    byDay[k].fat += Number(r.fat_g) || 0
    const m = r.meal || 'snack'
    if (byDay[k].byMeal[m] != null) byDay[k].byMeal[m] += Number(r.calories_kcal) || 0
  })
  const dailySeries = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date))

  // Weight+BF trend from body_composition
  const bodyPoints = body.filter((b) => b.weight_kg != null)
  const wMax = bodyPoints.length ? Math.max(...bodyPoints.map((b) => Number(b.weight_kg))) : 0
  const wMin = bodyPoints.length ? Math.min(...bodyPoints.map((b) => Number(b.weight_kg))) : 0
  const wRange = Math.max(0.5, wMax - wMin)
  const bfPoints = bodyPoints.filter((b) => b.body_fat_pct != null)
  const bfMax = bfPoints.length ? Math.max(...bfPoints.map((b) => Number(b.body_fat_pct))) : 0
  const bfMin = bfPoints.length ? Math.min(...bfPoints.map((b) => Number(b.body_fat_pct))) : 0
  const bfRange = Math.max(0.5, bfMax - bfMin)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {(bodyPoints.length >= 2 || inbody.length > 0) && (() => {
        const first = bodyPoints[0] || {}
        const selectedIdx = scaleSelectedDate
          ? bodyPoints.findIndex((b) => b.measured_at === scaleSelectedDate)
          : bodyPoints.length - 1
        const safeIdx = selectedIdx >= 0 ? selectedIdx : bodyPoints.length - 1
        const last = bodyPoints[safeIdx] || bodyPoints[bodyPoints.length - 1] || {}
        const isMostRecentScale = safeIdx === bodyPoints.length - 1
        const wDelta = bodyPoints.length >= 2 ? Number(last.weight_kg) - Number(first.weight_kg) : null
        const bfDelta = bodyPoints.length >= 2 && last.body_fat_pct != null && first.body_fat_pct != null ? Number(last.body_fat_pct) - Number(first.body_fat_pct) : null
        const cw = 1000, ch = 180
        const pad = { top: 12, right: 12, bottom: 20, left: 40 }
        const innerW = cw - pad.left - pad.right
        const innerH = ch - pad.top - pad.bottom
        const xFor = (i) => pad.left + (i / Math.max(1, bodyPoints.length - 1)) * innerW
        const yForW = (v) => pad.top + innerH - ((v - wMin) / wRange) * innerH
        const yForBF = (v) => pad.top + innerH - ((v - bfMin) / bfRange) * innerH

        // Renpho composition — only from body_composition columns
        const pickNum = (obj, keys) => {
          for (const k of keys) if (obj && obj[k] != null && !isNaN(Number(obj[k]))) return Number(obj[k])
          return null
        }
        const renphoWeight = pickNum(last, ['weight_kg']) || 0
        const renphoBF = pickNum(last, ['body_fat_pct'])
        const renphoMuscle = pickNum(last, ['muscle_mass_kg', 'skeletal_muscle_kg', 'muscle_kg'])
        const renphoWaterKg = pickNum(last, ['water_kg', 'body_water_kg'])
        const renphoWaterPct = pickNum(last, ['water_pct', 'body_water_pct'])
        const renphoWater = renphoWaterKg != null ? renphoWaterKg : (renphoWaterPct != null && renphoWeight ? renphoWeight * renphoWaterPct / 100 : null)
        const renphoBone = pickNum(last, ['bone_mass_kg', 'bone_kg'])
        const renphoProtein = pickNum(last, ['protein_kg', 'protein_mass_kg'])
        const renphoFat = renphoBF != null && renphoWeight ? renphoWeight * renphoBF / 100 : null

        let segments = []
        if (renphoMuscle != null) segments.push({ label: 'Muscle', kg: renphoMuscle, color: '#22c55e' })
        if (renphoWater != null) segments.push({ label: 'Water', kg: renphoWater, color: '#38bdf8' })
        if (renphoFat != null) segments.push({ label: 'Fat', kg: renphoFat, color: '#f59e0b' })
        if (renphoBone != null) segments.push({ label: 'Bone', kg: renphoBone, color: '#e5e7eb' })
        if (renphoProtein != null) segments.push({ label: 'Protein', kg: renphoProtein, color: '#a78bfa' })

        const known = segments.reduce((s, x) => s + x.kg, 0)
        if (renphoWeight > 0 && known < renphoWeight && segments.length > 0) {
          segments.push({ label: 'Other', kg: Math.max(0, renphoWeight - known), color: '#94a3b8' })
        }
        // If we only have weight + BF%, show a simple Fat vs Lean split
        if (segments.length === 0 && renphoFat != null && renphoWeight > 0) {
          const leanKg = Math.max(0, renphoWeight - renphoFat)
          segments = [
            { label: 'Lean Mass', kg: leanKg, color: '#22c55e' },
            { label: 'Fat', kg: renphoFat, color: '#f59e0b' }
          ]
        }
        const totalForRing = segments.reduce((s, x) => s + x.kg, 0) || 1
        const weightKg = renphoWeight
        const R = 60, C = 2 * Math.PI * R
        let acc = 0

        return (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', gap: '10px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ ...label, margin: 0 }}>⚖️ Renpho Scale · {isMostRecentScale ? 'Latest reading' : 'Snapshot'}</p>
                <p style={{ fontSize: '10px', color: 'var(--tx-muted)', margin: '4px 0 0 0' }}>All values from <b style={{ color: 'var(--tx-secondary)' }}>Renpho smart scale</b>{last.measured_at ? ` · ${fmtDate(last.measured_at)}` : ''}</p>
              </div>
              {bodyPoints.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Reading date</span>
                  <select
                    value={scaleSelectedDate || ''}
                    onChange={(e) => setScaleSelectedDate(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'var(--surface-base)', color: 'var(--tx-primary)', fontSize: '12px' }}
                  >
                    {[...bodyPoints].reverse().map((b, i) => (
                      <option key={b.measured_at} value={b.measured_at}>{fmtDate(b.measured_at)}{i === 0 ? ' · latest' : ''}</option>
                    ))}
                  </select>
                  {!isMostRecentScale && (
                    <button
                      onClick={() => setScaleSelectedDate(bodyPoints[bodyPoints.length - 1].measured_at)}
                      style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--brand-400)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                    >Latest</button>
                  )}
                </div>
              )}
            </div>
            <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '0 0 14px 0' }}>Trend line shows every scale reading. Stat tiles and the composition ring update to the date you pick.</p>

            {bodyPoints.length >= 2 && (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                <div style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--surface-base)', border: '1px solid var(--surface-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} /> Weight
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--tx-primary)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>{Number(last.weight_kg).toFixed(1)}<span style={{ fontSize: '10px', color: 'var(--tx-muted)', marginLeft: '3px', fontWeight: 400 }}>kg</span></div>
                  <div style={{ fontSize: '11px', color: wDelta >= 0 ? '#22c55e' : '#ef4444', marginTop: '2px', fontWeight: 600 }}>{wDelta >= 0 ? '+' : ''}{wDelta.toFixed(1)} kg since {fmtShort(first.measured_at)}</div>
                </div>
                {bfDelta != null && (
                  <div style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--surface-base)', border: '1px solid var(--surface-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} /> Body Fat
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--tx-primary)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>{Number(last.body_fat_pct).toFixed(1)}<span style={{ fontSize: '10px', color: 'var(--tx-muted)', marginLeft: '3px', fontWeight: 400 }}>%</span></div>
                    <div style={{ fontSize: '11px', color: bfDelta >= 0 ? '#ef4444' : '#22c55e', marginTop: '2px', fontWeight: 600 }}>{bfDelta >= 0 ? '+' : ''}{bfDelta.toFixed(1)}% since {fmtShort(first.measured_at)}</div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'stretch' }}>
              {bodyPoints.length >= 2 && (
                <div style={{ flex: '2 1 480px', minWidth: '300px' }}>
                  <svg width="100%" viewBox={`0 0 ${cw} ${ch}`} preserveAspectRatio="none" style={{ display: 'block', height: '180px' }}>
                    <path d={bodyPoints.map((b, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yForW(Number(b.weight_kg))}`).join(' ')} stroke="#22c55e" strokeWidth="2" fill="none" />
                    {bfPoints.length >= 2 && (
                      <path d={bfPoints.map((b, i) => {
                        const idx = bodyPoints.indexOf(b)
                        return `${i === 0 ? 'M' : 'L'}${xFor(idx)},${yForBF(Number(b.body_fat_pct))}`
                      }).join(' ')} stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 4" fill="none" />
                    )}
                  </svg>
                  <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', marginTop: '2px', fontSize: '10px', color: 'var(--tx-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '14px', height: '2px', background: '#22c55e' }} /> Weight (kg)</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '14px', height: '0', borderTop: '2px dashed #f59e0b' }} /> Body Fat %</span>
                  </div>
                </div>
              )}
              {segments.length > 0 && (
                <div style={{ flex: '1 1 260px', minWidth: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <div style={{ position: 'relative', width: '150px', height: '150px' }}>
                    <svg width="150" height="150" viewBox="0 0 150 150" style={{ transform: 'rotate(-90deg)' }}>
                      {segments.map((s) => {
                        const len = (s.kg / totalForRing) * C
                        const el = (
                          <circle key={s.label} cx="75" cy="75" r={R} fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />
                        )
                        acc += len
                        return el
                      })}
                    </svg>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{weightKg.toFixed(1)}</div>
                      <div style={{ fontSize: '9px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>kg Renpho</div>
                    </div>
                  </div>
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {segments.map((s) => {
                      const pct = (s.kg / totalForRing) * 100
                      return (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: s.color }} />
                          <span style={{ flex: 1, color: 'var(--tx-secondary)' }}>{s.label}</span>
                          <span style={{ color: 'var(--tx-primary)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.kg.toFixed(1)} kg</span>
                          <span style={{ color: 'var(--tx-muted)', fontSize: '10px', fontVariantNumeric: 'tabular-nums', minWidth: '34px', textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {inbody.length >= 2 && inbodyBaseline && inbodyCurrent && (() => {
        const baseScan = inbody.find((s) => s.fecha === inbodyBaseline) || inbody[0]
        const currScan = inbody.find((s) => s.fecha === inbodyCurrent) || inbody[inbody.length - 1]
        const scanOptions = inbody.map((s) => ({ value: s.fecha, label: fmtShort(s.fecha) }))
        const metrics = [
          { key: 'peso', label: 'Weight', unit: 'kg', better: 'stable', color: '#22c55e' },
          { key: 'mme', label: 'Skeletal Muscle', unit: 'kg', better: 'up', color: '#22c55e' },
          { key: 'masa_grasa', label: 'Fat Mass', unit: 'kg', better: 'down', color: '#f59e0b' },
          { key: 'pgc', label: 'Body Fat %', unit: '%', better: 'down', color: '#f59e0b' },
          { key: 'agua', label: 'Total Water', unit: 'L', better: 'up', color: '#38bdf8' },
          { key: 'tmb', label: 'BMR', unit: 'kcal', better: 'up', color: '#a78bfa' },
          { key: 'score', label: 'InBody Score', unit: '/100', better: 'up', color: '#f472b6' },
          { key: 'angulo_fase', label: 'Phase Angle', unit: '°', better: 'up', color: '#00b8d9' },
          { key: 'grasa_visceral', label: 'Visceral Fat', unit: '', better: 'down', color: '#ef4444' }
        ].filter((m) => baseScan[m.key] != null || currScan[m.key] != null)

        const deltaColor = (delta, better) => {
          if (delta == null || delta === 0) return 'var(--tx-muted)'
          if (better === 'up') return delta > 0 ? '#22c55e' : '#ef4444'
          if (better === 'down') return delta < 0 ? '#22c55e' : '#ef4444'
          return 'var(--tx-secondary)'
        }

        return (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px', gap: '8px', flexWrap: 'wrap' }}>
              <p style={{ ...label, margin: 0 }}>🧬 InBody Scan Comparison</p>
              <span style={{ fontSize: '10px', color: 'var(--tx-muted)' }}>{inbody.length} scans on file · pick any two to compare</span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '0 0 12px 0' }}>Choose a baseline scan and a scan to compare against. Colored deltas show whether each metric moved in the desirable direction.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Baseline</div>
                <RubberSegment
                  items={scanOptions}
                  value={inbodyBaseline}
                  onChange={setInbodyBaseline}
                  size="sm"
                  squash={2.5}
                  inset={4}
                  radius={16}
                  glide={85}
                  trackColor="rgba(20, 24, 40, 0.55)"
                  thumbColor="rgba(148, 163, 184, 0.95)"
                  textColor="rgba(255, 255, 255, 0.7)"
                  activeTextColor="#0a0f1f"
                  aria-label="Baseline scan"
                />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Compare to</div>
                <RubberSegment
                  items={scanOptions}
                  value={inbodyCurrent}
                  onChange={setInbodyCurrent}
                  size="sm"
                  squash={2.5}
                  inset={4}
                  radius={16}
                  glide={85}
                  trackColor="rgba(20, 24, 40, 0.55)"
                  thumbColor="rgba(34, 197, 94, 0.95)"
                  textColor="rgba(255, 255, 255, 0.7)"
                  activeTextColor="#0a0f1f"
                  aria-label="Compare scan"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
              {metrics.map((m) => {
                const b = baseScan[m.key] != null ? Number(baseScan[m.key]) : null
                const c = currScan[m.key] != null ? Number(currScan[m.key]) : null
                const delta = (b != null && c != null) ? c - b : null
                const pct = (b != null && c != null && b !== 0) ? (delta / Math.abs(b)) * 100 : null
                const dColor = deltaColor(delta, m.better)
                // series across all scans for sparkline
                const series = inbody.map((s) => s[m.key] != null ? Number(s[m.key]) : null).filter((v) => v != null)
                const sMax = series.length ? Math.max(...series) : 0
                const sMin = series.length ? Math.min(...series) : 0
                const sRange = Math.max(0.5, sMax - sMin)
                const baseIdx = inbody.findIndex((s) => s.fecha === inbodyBaseline)
                const currIdx = inbody.findIndex((s) => s.fecha === inbodyCurrent)
                return (
                  <div key={m.key} style={{ padding: '12px', borderRadius: '10px', background: 'var(--surface-base)', border: '1px solid var(--surface-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--tx-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '9px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Baseline</div>
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--tx-secondary)', fontVariantNumeric: 'tabular-nums' }}>{b != null ? b.toFixed(b < 10 ? 2 : 1) : '—'}<span style={{ fontSize: '9px', color: 'var(--tx-muted)', marginLeft: '2px', fontWeight: 400 }}>{m.unit}</span></div>
                      </div>
                      <div style={{ color: 'var(--tx-muted)', fontSize: '14px' }}>→</div>
                      <div style={{ flex: 1, textAlign: 'right' }}>
                        <div style={{ fontSize: '9px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Current</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums' }}>{c != null ? c.toFixed(c < 10 ? 2 : 1) : '—'}<span style={{ fontSize: '9px', color: 'var(--tx-muted)', marginLeft: '2px', fontWeight: 400 }}>{m.unit}</span></div>
                      </div>
                    </div>
                    {delta != null && (
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '8px', background: `${dColor}18`, border: `1px solid ${dColor}44` }}>
                        <span style={{ fontSize: '11px', color: dColor, fontWeight: 700 }}>{delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} {delta > 0 ? '+' : ''}{delta.toFixed(delta < 10 && delta > -10 ? 2 : 1)} {m.unit}</span>
                        {pct != null && <span style={{ fontSize: '10px', color: dColor, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</span>}
                      </div>
                    )}
                    {series.length >= 2 && (
                      <div style={{ marginTop: '10px' }}>
                        <svg width="100%" viewBox="0 0 200 32" preserveAspectRatio="none" style={{ display: 'block', height: '28px' }}>
                          <path d={inbody.map((s, i) => {
                            const v = s[m.key] != null ? Number(s[m.key]) : null
                            if (v == null) return ''
                            const x = (i / Math.max(1, inbody.length - 1)) * 200
                            const y = 28 - ((v - sMin) / sRange) * 24 - 2
                            return `${i === 0 ? 'M' : 'L'}${x},${y}`
                          }).filter(Boolean).join(' ')} stroke={m.color} strokeWidth="1.5" fill="none" opacity="0.6" />
                          {inbody.map((s, i) => {
                            const v = s[m.key] != null ? Number(s[m.key]) : null
                            if (v == null) return null
                            const x = (i / Math.max(1, inbody.length - 1)) * 200
                            const y = 28 - ((v - sMin) / sRange) * 24 - 2
                            const active = i === baseIdx || i === currIdx
                            return <circle key={i} cx={x} cy={y} r={active ? 3 : 1.5} fill={i === currIdx ? m.color : i === baseIdx ? 'rgba(148,163,184,0.9)' : `${m.color}88`} />
                          })}
                        </svg>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', fontSize: '9px', color: 'var(--tx-muted)' }}>
                          <span>{fmtShort(inbody[0].fecha)}</span>
                          <span>{inbody.length} scans</span>
                          <span>{fmtShort(inbody[inbody.length - 1].fecha)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {dailySeries.length >= 2 && (() => {
        const kcalMax = Math.max(1, ...dailySeries.map((d) => d.calories))
        const roll = rollingAvg(dailySeries, 'calories', 7)
        const target = 2000
        const w = 1000, h = 180
        const pad = { top: 12, right: 12, bottom: 24, left: 40 }
        const innerW = w - pad.left - pad.right
        const innerH = h - pad.top - pad.bottom
        const yMax = Math.max(kcalMax, target * 1.15)
        const yFor = (v) => pad.top + innerH - (v / yMax) * innerH
        const xFor = (i) => pad.left + (i / Math.max(1, dailySeries.length - 1)) * innerW
        const avg = dailySeries.reduce((s, d) => s + d.calories, 0) / dailySeries.length
        return (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <p style={{ ...label, margin: 0 }}>🔥 Calorie Intake Trend</p>
              <span style={{ fontSize: '10px', color: 'var(--tx-muted)' }}>Daily bars · 7-day rolling avg overlay · target {target}</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <div style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', background: 'var(--surface-base)', border: '1px solid var(--surface-border)' }}>
                <div style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase' }}>Avg daily</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(avg)} <span style={{ fontSize: '10px', color: 'var(--tx-muted)', fontWeight: 400 }}>kcal</span></div>
              </div>
              <div style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', background: 'var(--surface-base)', border: '1px solid var(--surface-border)' }}>
                <div style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase' }}>Days logged</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums' }}>{dailySeries.length}</div>
              </div>
              <div style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', background: 'var(--surface-base)', border: '1px solid var(--surface-border)' }}>
                <div style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase' }}>Vs target</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: avg <= target * 1.1 ? '#22c55e' : '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>{avg >= target ? '+' : ''}{Math.round(avg - target)}<span style={{ fontSize: '10px', color: 'var(--tx-muted)', fontWeight: 400, marginLeft: '2px' }}>kcal</span></div>
              </div>
            </div>
            <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', height: '180px' }}>
              <line x1={pad.left} x2={w - pad.right} y1={yFor(target)} y2={yFor(target)} stroke="rgba(34,197,94,0.55)" strokeDasharray="4 4" />
              <text x={pad.left - 4} y={yFor(target) + 3} fontSize="9" fill="#22c55e" textAnchor="end">{target}</text>
              {dailySeries.map((d, i) => {
                const barW = innerW / dailySeries.length * 0.72
                return <rect key={i} x={xFor(i) - barW / 2} y={yFor(d.calories)} width={barW} height={Math.max(1, yFor(0) - yFor(d.calories))} fill="rgba(96,165,250,0.55)" rx="1.5" />
              })}
              <path d={dailySeries.map((_, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(roll[i])}`).join(' ')} stroke="#f472b6" strokeWidth="2" fill="none" />
            </svg>
            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', fontSize: '10px', color: 'var(--tx-secondary)', marginTop: '4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '6px', background: 'rgba(96,165,250,0.55)', borderRadius: '2px' }} /> Daily</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '14px', height: '2px', background: '#f472b6' }} /> 7-day avg</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '14px', height: '0', borderTop: '2px dashed rgba(34,197,94,0.55)' }} /> Target</span>
            </div>
          </div>
        )
      })()}

      {dailySeries.length >= 2 && (() => {
        const macros = ['protein', 'carbs', 'fat']
        const macroColor = { protein: '#3b82f6', carbs: '#f59e0b', fat: '#8b5cf6' }
        const macroTarget = { protein: 150, carbs: 250, fat: 65 }
        const rollP = rollingAvg(dailySeries, 'protein', 7)
        const rollC = rollingAvg(dailySeries, 'carbs', 7)
        const rollF = rollingAvg(dailySeries, 'fat', 7)
        const activeRoll = macroMode === 'protein' ? rollP : macroMode === 'carbs' ? rollC : rollF
        const mx = Math.max(macroTarget[macroMode] * 1.4, ...activeRoll, ...dailySeries.map((d) => d[macroMode]))
        const w = 1000, h = 160
        const pad = { top: 12, right: 12, bottom: 24, left: 36 }
        const innerW = w - pad.left - pad.right
        const innerH = h - pad.top - pad.bottom
        const xFor = (i) => pad.left + (i / Math.max(1, dailySeries.length - 1)) * innerW
        const yFor = (v) => pad.top + innerH - (v / mx) * innerH
        const avgP = dailySeries.reduce((s, d) => s + d.protein, 0) / dailySeries.length
        const avgC = dailySeries.reduce((s, d) => s + d.carbs, 0) / dailySeries.length
        const avgF = dailySeries.reduce((s, d) => s + d.fat, 0) / dailySeries.length
        return (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', gap: '8px', flexWrap: 'wrap' }}>
              <p style={{ ...label, margin: 0 }}>🥩 Macro Balance Trend</p>
              <div style={{ maxWidth: '260px' }}>
                <RubberSegment
                  items={[{ value: 'protein', label: 'Protein' }, { value: 'carbs', label: 'Carbs' }, { value: 'fat', label: 'Fat' }]}
                  value={macroMode}
                  onChange={setMacroMode}
                  size="sm"
                  squash={2.5}
                  inset={4}
                  radius={16}
                  glide={85}
                  trackColor="rgba(20, 24, 40, 0.55)"
                  thumbColor="rgba(255, 255, 255, 0.95)"
                  textColor="rgba(255, 255, 255, 0.7)"
                  activeTextColor="#0a0f1f"
                  aria-label="Macro selector"
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
              {macros.map((m) => {
                const avg = m === 'protein' ? avgP : m === 'carbs' ? avgC : avgF
                const pct = Math.min(100, (avg / macroTarget[m]) * 100)
                return (
                  <button key={m} onClick={() => setMacroMode(m)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: '10px', background: 'var(--surface-base)', border: `1px solid ${macroMode === m ? macroColor[m] : 'var(--surface-border)'}`, cursor: 'pointer', color: 'inherit' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: macroColor[m] }} />{m}</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>{Math.round(avg)}<span style={{ fontSize: '10px', color: 'var(--tx-muted)', fontWeight: 400 }}>g avg</span></div>
                    <div style={{ height: '4px', background: 'var(--surface-muted)', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: macroColor[m] }} />
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--tx-muted)', marginTop: '3px' }}>target {macroTarget[m]}g</div>
                  </button>
                )
              })}
            </div>
            <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', height: '160px' }}>
              <line x1={pad.left} x2={w - pad.right} y1={yFor(macroTarget[macroMode])} y2={yFor(macroTarget[macroMode])} stroke={`${macroColor[macroMode]}88`} strokeDasharray="4 4" />
              <text x={pad.left - 4} y={yFor(macroTarget[macroMode]) + 3} fontSize="9" fill={macroColor[macroMode]} textAnchor="end">{macroTarget[macroMode]}g</text>
              {dailySeries.map((d, i) => {
                const barW = innerW / dailySeries.length * 0.65
                return <rect key={i} x={xFor(i) - barW / 2} y={yFor(d[macroMode])} width={barW} height={Math.max(1, yFor(0) - yFor(d[macroMode]))} fill={`${macroColor[macroMode]}44`} rx="1.5" />
              })}
              <path d={dailySeries.map((_, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(activeRoll[i])}`).join(' ')} stroke={macroColor[macroMode]} strokeWidth="2" fill="none" />
            </svg>
            <div style={{ fontSize: '10px', color: 'var(--tx-muted)', textAlign: 'center', marginTop: '4px' }}>Daily {macroMode} intake with 7-day rolling average · {fmtShort(dailySeries[0].date)} → {fmtShort(dailySeries[dailySeries.length - 1].date)}</div>
          </div>
        )
      })()}

      {dailySeries.length >= 2 && (() => {
        const mealAvg = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 }
        dailySeries.forEach((d) => {
          Object.entries(d.byMeal).forEach(([k, v]) => { mealAvg[k] += v })
        })
        Object.keys(mealAvg).forEach((k) => { mealAvg[k] = mealAvg[k] / dailySeries.length })
        const total = Object.values(mealAvg).reduce((s, v) => s + v, 0) || 1
        const R = 60, C = 2 * Math.PI * R
        let acc = 0
        return (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <p style={{ ...label, margin: 0 }}>🍽️ Meal Distribution</p>
              <span style={{ fontSize: '10px', color: 'var(--tx-muted)' }}>Average daily kcal by meal · {dailySeries.length} days</span>
            </div>
            <div style={{ display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: '160px', height: '160px', flexShrink: 0 }}>
                <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
                  {Object.entries(mealAvg).map(([k, v]) => {
                    const meta = MEAL_META[k]
                    const len = (v / total) * C
                    const el = (
                      <circle key={k} cx="80" cy="80" r={R} fill="none" stroke={meta.color} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />
                    )
                    acc += len
                    return el
                  })}
                </svg>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{Math.round(total)}</div>
                  <div style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>kcal / day</div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(mealAvg).map(([k, v]) => {
                  const meta = MEAL_META[k]
                  const pct = (v / total) * 100
                  return (
                    <div key={k}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginBottom: '3px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: meta.color }} />
                        <span style={{ flex: 1, color: 'var(--tx-primary)', fontWeight: 500 }}>{meta.label}</span>
                        <span style={{ color: 'var(--tx-primary)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{Math.round(v)} kcal</span>
                        <span style={{ color: 'var(--tx-muted)', fontSize: '10px', fontVariantNumeric: 'tabular-nums', minWidth: '38px', textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                      </div>
                      <div style={{ height: '4px', background: 'var(--surface-muted)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: meta.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {inbody.length >= 2 && (() => {
        const series = [
          { key: 'mme', label: 'Muscle', color: '#22c55e', unit: 'kg' },
          { key: 'masa_grasa', label: 'Fat mass', color: '#f59e0b', unit: 'kg' },
          { key: 'agua', label: 'Water', color: '#38bdf8', unit: 'L' },
          { key: 'tmb', label: 'BMR', color: '#a78bfa', unit: 'kcal' }
        ].filter((s) => inbody.some((r) => r[s.key] != null))
        return (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <p style={{ ...label, margin: 0 }}>📈 Composition Over Time</p>
              <span style={{ fontSize: '10px', color: 'var(--tx-muted)' }}>{inbody.length} InBody scans · {fmtShort(inbody[0].fecha)} → {fmtShort(inbody[inbody.length - 1].fecha)}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {series.map((s) => {
                const pts = inbody.filter((r) => r[s.key] != null).map((r) => ({ date: r.fecha, val: Number(r[s.key]) }))
                if (pts.length < 2) return null
                const vs = pts.map((p) => p.val)
                const mx = Math.max(...vs), mn = Math.min(...vs)
                const rng = Math.max(0.5, mx - mn)
                const delta = pts[pts.length - 1].val - pts[0].val
                const w = 400, h = 90
                return (
                  <div key={s.key} style={{ padding: '12px', borderRadius: '10px', background: 'var(--surface-base)', border: '1px solid var(--surface-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--tx-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</span>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums' }}>{pts[pts.length - 1].val.toFixed(1)}<span style={{ fontSize: '9px', color: 'var(--tx-muted)', marginLeft: '2px', fontWeight: 400 }}>{s.unit}</span></div>
                    </div>
                    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', height: '80px' }}>
                      <defs>
                        <linearGradient id={`grad-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor={s.color} stopOpacity="0.4" />
                          <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d={`M 0 ${h - 4} ${pts.map((p, i) => `L ${(i / (pts.length - 1)) * w},${h - 8 - ((p.val - mn) / rng) * (h - 20)}`).join(' ')} L ${w} ${h - 4} Z`} fill={`url(#grad-${s.key})`} />
                      <path d={pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i / (pts.length - 1)) * w},${h - 8 - ((p.val - mn) / rng) * (h - 20)}`).join(' ')} stroke={s.color} strokeWidth="2" fill="none" />
                    </svg>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '10px', color: 'var(--tx-muted)' }}>
                      <span>{fmtShort(pts[0].date)}</span>
                      <span style={{ color: delta >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)} {s.unit}</span>
                      <span>{fmtShort(pts[pts.length - 1].date)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {inbody.length > 0 && (() => {
        const latest = inbody.find((s) => s.fecha === inbodyLatestDate) || inbody[inbody.length - 1]
        const isMostRecent = latest === inbody[inbody.length - 1]
        const weightKg = Number(latest.peso) || 0
        const muscleKg = Number(latest.mme) || 0
        const fatKg = Number(latest.masa_grasa) || 0
        const waterKg = Number(latest.agua) || 0
        const otherKg = Math.max(0, weightKg - muscleKg - fatKg - waterKg)
        const totalForRing = muscleKg + fatKg + waterKg + otherKg || 1
        const segs = [
          { label: 'Muscle', kg: muscleKg, color: '#22c55e' },
          { label: 'Water', kg: waterKg, color: '#38bdf8' },
          { label: 'Fat', kg: fatKg, color: '#f59e0b' },
          { label: 'Other', kg: otherKg, color: '#94a3b8' }
        ]
        const R = 68, C = 2 * Math.PI * R
        let acc = 0
        const extras = [
          { key: 'score', label: 'InBody Score', unit: '/100' },
          { key: 'tmb', label: 'BMR', unit: 'kcal' },
          { key: 'angulo_fase', label: 'Phase Angle', unit: '°' },
          { key: 'grasa_visceral', label: 'Visceral Fat', unit: '' },
          { key: 'rel_cintura_cadera', label: 'Waist/Hip', unit: '' },
          { key: 'imc', label: 'BMI', unit: '' },
          { key: 'pgc', label: 'Body Fat %', unit: '%' },
          { key: 'mlg', label: 'Lean Mass', unit: 'kg' }
        ].filter((x) => latest[x.key] != null)
        return (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', gap: '10px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ ...label, margin: 0 }}>🧬 InBody Composition · {isMostRecent ? 'Latest scan' : 'Snapshot'}</p>
                <p style={{ fontSize: '10px', color: 'var(--tx-muted)', margin: '4px 0 0 0' }}>Full body composition from your <b style={{ color: 'var(--tx-secondary)' }}>InBody</b> scan on {fmtDate(latest.fecha)}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Scan date</span>
                <select
                  value={inbodyLatestDate || ''}
                  onChange={(e) => setInbodyLatestDate(e.target.value)}
                  disabled={inbody.length < 2}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'var(--surface-base)', color: 'var(--tx-primary)', fontSize: '12px', opacity: inbody.length < 2 ? 0.65 : 1 }}
                >
                  {[...inbody].reverse().map((s, i) => (
                    <option key={s.fecha} value={s.fecha}>{fmtDate(s.fecha)}{i === 0 ? ' · latest' : ''}</option>
                  ))}
                </select>
                {inbody.length > 1 && !isMostRecent && (
                  <button
                    onClick={() => setInbodyLatestDate(inbody[inbody.length - 1].fecha)}
                    style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--brand-400)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                  >Latest</button>
                )}
              </div>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '0 0 14px 0' }}>InBody uses bioimpedance to break down muscle, water, fat and lean mass in kilograms — richer than what a home scale can estimate.</p>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: '180px', height: '180px', flexShrink: 0 }}>
                <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: 'rotate(-90deg)' }}>
                  {segs.map((s) => {
                    const len = (s.kg / totalForRing) * C
                    const el = (
                      <circle key={s.label} cx="90" cy="90" r={R} fill="none" stroke={s.color} strokeWidth="20" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />
                    )
                    acc += len
                    return el
                  })}
                </svg>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{weightKg.toFixed(1)}</div>
                  <div style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>kg total</div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {segs.map((s) => {
                  const pct = (s.kg / totalForRing) * 100
                  return (
                    <div key={s.label}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: s.color }} />
                        <span style={{ flex: 1, color: 'var(--tx-primary)', fontWeight: 500 }}>{s.label}</span>
                        <span style={{ color: 'var(--tx-primary)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.kg.toFixed(1)} kg</span>
                        <span style={{ color: 'var(--tx-muted)', fontSize: '10px', fontVariantNumeric: 'tabular-nums', minWidth: '38px', textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: '5px', background: 'var(--surface-muted)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: s.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            {extras.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', marginTop: '16px' }}>
                {extras.map((x) => (
                  <div key={x.key} style={{ padding: '10px 12px', borderRadius: '10px', background: 'var(--surface-base)', border: '1px solid var(--surface-border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{x.label}</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--tx-primary)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>{Number(latest[x.key]).toFixed(latest[x.key] < 10 ? 2 : 1)}<span style={{ fontSize: '10px', color: 'var(--tx-muted)', marginLeft: '3px', fontWeight: 400 }}>{x.unit}</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {labs.length > 0 && (() => {
        const meters = NUTRITION_LABS.map((k) => {
          const match = labs.find((r) => r.marcador && k.match(r.marcador.toLowerCase()) && r.ref_min != null && r.ref_max != null && r.valor != null)
          return match ? { ...k, ...match } : null
        }).filter(Boolean)
        if (meters.length === 0) return null
        return (
          <div style={card}>
            <p style={label}>🥦 Nutrition Labs · Latest available value per marker</p>
            <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '-6px 0 14px 0' }}>Vitamins, minerals, lipids and metabolic markers. Center green band = healthy range.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
              {meters.map((r, i) => {
                const val = Number(r.valor)
                const rMin = Number(r.ref_min), rMax = Number(r.ref_max)
                const range = rMax - rMin
                const extendedMin = rMin - range * 0.5
                const extendedMax = rMax + range * 0.5
                const extendedRange = extendedMax - extendedMin
                const clampedVal = Math.max(extendedMin, Math.min(extendedMax, val))
                const valPos = ((clampedVal - extendedMin) / extendedRange) * 100
                const bandStart = ((rMin - extendedMin) / extendedRange) * 100
                const bandEnd = ((rMax - extendedMin) / extendedRange) * 100
                const outOfRange = val < rMin || val > rMax
                const dotColor = outOfRange ? '#ef4444' : '#22c55e'
                return (
                  <div key={`${r.display}-${i}`} style={{ padding: '12px', borderRadius: '10px', background: 'var(--surface-base)', border: `1px solid ${outOfRange ? 'rgba(239,68,68,0.35)' : 'var(--surface-border)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '6px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--tx-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${r.display} · ${r.marcador}`}>{r.display}</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: dotColor, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmtNum(val)}<span style={{ fontSize: '9px', color: 'var(--tx-muted)', marginLeft: '2px', fontWeight: 400 }}>{r.unidad || ''}</span></span>
                    </div>
                    <div style={{ position: 'relative', height: '10px', borderRadius: '999px', background: 'rgba(239,68,68,0.1)', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${bandStart}%`, width: `${bandEnd - bandStart}%`, background: 'rgba(34,197,94,0.25)' }} />
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${bandStart}%`, width: '1px', background: 'rgba(34,197,94,0.6)' }} />
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${bandEnd}%`, width: '1px', background: 'rgba(34,197,94,0.6)' }} />
                      <div style={{ position: 'absolute', top: '-3px', left: `${valPos}%`, width: '16px', height: '16px', transform: 'translateX(-50%)', borderRadius: '50%', background: dotColor, border: '2px solid var(--surface-raised)', boxShadow: `0 0 8px ${dotColor}` }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '9px', color: 'var(--tx-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      <span>{fmtNum(extendedMin)}</span>
                      <span style={{ color: '#22c55e' }}>{fmtNum(rMin)} – {fmtNum(rMax)}</span>
                      <span>{fmtNum(extendedMax)}</span>
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--tx-muted)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{fmtDate(r.fecha)} · {r.group}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

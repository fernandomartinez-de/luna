import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import RubberSegment from '../../components/RubberSegment/RubberSegment.jsx'
import SquishSwitch from '../../components/SquishSwitch/SquishSwitch.jsx'

const KEY_THYROID = [
  { display: 'TSH', match: (m) => m.includes('tsh') },
  { display: 'T4 Libre', match: (m) => (m.includes('t4') || m.includes('tiroxina')) && (m.includes('libre') || m.includes('free')) },
  { display: 'T3 Libre', match: (m) => m.includes('t3') && (m.includes('libre') || m.includes('free')) },
  { display: 'Tiroglobulina', match: (m) => (m.includes('tiroglobulin') || m.includes('thyroglobulin')) && !m.includes('anti') && !m.includes('atg') && !m.includes('tgab') },
  { display: 'Anti-Tiroglobulina', match: (m) => (m.includes('tiroglobulin') || m.includes('thyroglobulin') || m.includes('atg') || m.includes('tgab')) && (m.includes('anti') || m.includes('atg') || m.includes('tgab')) },
  { display: 'Anti-TPO', match: (m) => m.includes('tpo') || m.includes('peroxidasa') }
]

// Clean panel categorization — routes every marker to one semantic group
// regardless of what raw `panel` value the lab reported. This eliminates the
// redundant categories (Hemograma vs Fórmula Blanca vs Biometría Hemática, etc.)
// and produces a consistent, easy-to-scan set of panels.
const PANEL_CATEGORIES = [
  { key: 'Thyroid', emoji: '🦋', match: (m, p) => p.includes('tiroide') || p.includes('thyroid') || m.includes('tsh') || (m.includes('t3') && !m.includes('bt3')) || (m.includes('t4') && !m.includes('vit')) || m.includes('tiroxina') || m.includes('thyroxine') || m.includes('triyodo') || m.includes('triiodo') || m.includes('tiroglobulin') || m.includes('thyroglobulin') || m.includes('atg') || m.includes('tgab') || m.includes('tpo') || m.includes('peroxidasa') || m.includes('calcitonin') },
  { key: 'Complete Blood Count', emoji: '🩸', match: (m, p) => p.includes('hemograma') || p.includes('biometria') || p.includes('hematica') || p.includes('formula blanca') || p.includes('formula tromboc') || p.includes('cbc') || m.includes('eritrocit') || m.includes('hemoglobin') || m.includes('hematocrit') || m.includes('leucocit') || m.includes('plaqueta') || m === 'vcm' || m === 'hcm' || m === 'chcm' || m === 'rdw' || m === 'mcv' || m === 'mch' || m === 'mchc' || m === 'mpv' || m.includes('neutrofil') || m.includes('linfocit') || m.includes('monocit') || m.includes('eosinofil') || m.includes('basofil') || m.includes('reticulocit') },
  { key: 'Lipids', emoji: '🫀', match: (m, p) => p.includes('lipid') || m.includes('colesterol') || m.includes('cholesterol') || m.includes('ldl') || m.includes('hdl') || m.includes('vldl') || m.includes('triglic') || m.includes('triglyc') || m.includes('non-hdl') },
  { key: 'Glucose & Metabolic', emoji: '🍬', match: (m, p) => p.includes('glucemi') || p.includes('metabol') || m.includes('glucos') || m.includes('glicem') || m.includes('hba1c') || m.includes('glicosilada') || m.includes('a1c') || m.includes('insulin') || m.includes('peptido c') },
  { key: 'Liver', emoji: '🟤', match: (m, p) => p.includes('hepatic') || p.includes('liver') || m === 'alt' || m === 'ast' || m === 'ggt' || m === 'alp' || m.includes('bilirrub') || m.includes('bilirubin') || m.includes('albumin') || (m.includes('proteina') && m.includes('total')) || m.includes('total protein') || m.includes('transaminas') },
  { key: 'Kidney', emoji: '🫘', match: (m, p) => p.includes('renal') || p.includes('kidney') || m.includes('creatinin') || m.includes('urea') || m === 'bun' || m.includes('acido urico') || m.includes('uric acid') || m.includes('egfr') || m.includes('cistatina') },
  { key: 'Electrolytes', emoji: '⚡', match: (m, p) => p.includes('electrolit') || m === 'sodio' || m === 'sodium' || m === 'potasio' || m === 'potassium' || m === 'cloruro' || m === 'chloride' || m === 'calcio' || m === 'calcium' || m === 'fosforo' || m === 'phosphorus' || m === 'magnesio' || m === 'magnesium' || m === 'co2' || m === 'bicarbonato' },
  { key: 'Vitamins & Iron', emoji: '💊', match: (m, p) => p.includes('vitamin') || m.includes('vitamin') || m.includes('25-oh') || m.includes('25(oh)') || m.includes('calcidiol') || m.includes('folat') || m.includes('folic') || m.includes('folico') || m.includes('b12') || m.includes('cobalamin') || m.includes('hierro') || m === 'iron' || m === 'fe' || m.includes('ferritin') || m.includes('transferrin') || m.includes('tibc') || m.includes('yodo') || m.includes('iodine') || m.includes('zinc') || m.includes('selenio') || m.includes('selenium') },
  { key: 'Enzymes & Muscle', emoji: '💪', match: (m, p) => m === 'cpk' || m === 'ck' || m === 'ldh' || m.includes('amilas') || m.includes('amylas') || m.includes('lipas') || m.includes('mioglobin') },
  { key: 'Inflammation', emoji: '🔥', match: (m, p) => m.includes('pcr') || m.includes('crp') || m.includes('vsg') || m.includes('esr') || m.includes('sedimentacion') || m.includes('procalcitonin') },
  { key: 'Other', emoji: '🧪', match: () => true }
]

function categorizePanel(marker, rawPanel) {
  const m = (marker || '').toLowerCase().trim()
  const p = (rawPanel || '').toLowerCase().trim()
  for (const cat of PANEL_CATEGORIES) {
    if (cat.match(m, p)) return cat
  }
  return PANEL_CATEGORIES[PANEL_CATEGORIES.length - 1]
}

// Broader thyroid-relevant marker filter for the Reference Range Meters.
// Includes core thyroid hormones, antibodies, binding proteins, calcitonin, iodine, selenium.
const isThyroidRelated = (marker, panel) => {
  const m = (marker || '').toLowerCase()
  const p = (panel || '').toLowerCase()
  if (p.includes('tiroide') || p.includes('thyroid')) return true
  return (
    m.includes('tsh') ||
    m.includes('t3') ||
    m.includes('t4') ||
    m.includes('tiroxina') || m.includes('thyroxine') ||
    m.includes('triyodotironina') || m.includes('triiodothyronine') ||
    m.includes('tiroglobulin') || m.includes('thyroglobulin') ||
    m.includes('atg') || m.includes('tgab') ||
    m.includes('tpo') || m.includes('peroxidasa') ||
    m.includes('calcitonin') ||
    m.includes('tiroide') || m.includes('thyroid') ||
    m.includes('tbg') ||
    m.includes('reverse t3') || m === 'rt3' ||
    m.includes('yodo') || m.includes('iodine') ||
    m.includes('selenio') || m.includes('selenium')
  )
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtNum(v) {
  if (v == null || isNaN(v)) return '—'
  const n = Number(v)
  if (Math.abs(n) >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (Math.abs(n) >= 10) return n.toFixed(1)
  return n.toFixed(2)
}
function flagColor(flag) {
  if (!flag) return 'var(--tx-muted)'
  const f = flag.toLowerCase()
  if (f === 'normal') return '#22c55e'
  if (f.includes('alt') || f.includes('high')) return '#ef4444'
  if (f.includes('baj') || f.includes('low')) return '#f59e0b'
  return 'var(--tx-muted)'
}

const card = { backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '14px', padding: '16px' }
const label = { fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-muted)', margin: '0 0 12px 0' }

export default function OncologistView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rows, setRows] = useState([])
  const [chartMarker, setChartMarker] = useState('TSH')
  const [chartHover, setChartHover] = useState(null)
  const [abnormalOnly, setAbnormalOnly] = useState(false)
  const [recovery, setRecovery] = useState([])
  const [bodyHistory, setBodyHistory] = useState([])
  const [weightHover, setWeightHover] = useState(null)
  const [recoveryHover, setRecoveryHover] = useState(null)
  const [openPanel, setOpenPanel] = useState(null)
  const [labDateFilter, setLabDateFilter] = useState('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
      const [labRes, recRes, bodyRes] = await Promise.all([
        supabase.from('lab_results').select('fecha, marcador, valor, unidad, ref_min, ref_max, flag, panel, proveedor').order('fecha', { ascending: false }),
        supabase.from('whoop_recovery').select('recovery_date, recovery_score').gte('recovery_date', sixtyDaysAgo).order('recovery_date', { ascending: true }),
        supabase.from('body_composition').select('measured_at, weight_kg, body_fat_pct').order('measured_at', { ascending: true }).limit(60)
      ])
      if (cancelled) return
      if (labRes.error) setError(labRes.error.message)
      else setRows(labRes.data || [])
      setRecovery((recRes.data || []).filter((r) => r.recovery_score != null))
      setBodyHistory(bodyRes.data || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) return <div style={{ ...card, textAlign: 'center', color: 'var(--tx-muted)' }}>Loading labs…</div>
  if (error) return <div style={{ ...card, color: '#ef4444' }}>Error: {error}</div>
  if (rows.length === 0) return <div style={card}>No lab results yet.</div>

  // Latest snapshot: highest fecha
  const latestDate = rows[0].fecha

  // All unique lab dates (desc) for the date-filter dropdown
  const labDates = [...new Set(rows.map((r) => r.fecha).filter(Boolean))].sort().reverse()

  // MASTER TABLE (unfiltered): latest value per unique marker across all history.
  // Since `rows` is ordered by fecha desc, the first occurrence of each marker
  // is its most recent value.
  const latestPerMarker = (() => {
    const seen = new Set()
    const out = []
    for (const r of rows) {
      if (!r.marcador) continue
      const key = r.marcador.toLowerCase().trim()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(r)
    }
    return out
  })()

  // Active row set for the labs visuals (Thyroid tiles, Reference Range Meters,
  // Panel Health, Lab Master table). When `labDateFilter` is 'all' we show the
  // latest-per-marker master; when a specific date is picked we show only that
  // visit's rows. This does NOT affect Marker Trend, Recovery & Resilience, or
  // Body Composition — those read from their own untouched data.
  const activeMasterRows = labDateFilter === 'all'
    ? latestPerMarker
    : rows.filter((r) => r.fecha === labDateFilter)

  // Thyroid focus: use the smart matcher on each key marker against the active set
  const thyroidLatest = KEY_THYROID.map((k) => {
    const match = activeMasterRows.find((r) => r.marcador && k.match(r.marcador.toLowerCase()))
    return match ? { name: k.display, ...match } : { name: k.display, marcador: k.display, valor: null }
  })

  // Group the active rows by CLEAN semantic category
  const panels = {}
  activeMasterRows.forEach((r) => {
    const cat = categorizePanel(r.marcador, r.panel)
    if (!panels[cat.key]) panels[cat.key] = []
    panels[cat.key].push(r)
  })
  // Sort categories in the order defined in PANEL_CATEGORIES
  const orderedPanelKeys = PANEL_CATEGORIES.map((c) => c.key).filter((k) => panels[k])

  // History for the selected chart marker
  const markerHistory = rows
    .filter((r) => r.marcador === chartMarker)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  // All unique markers with >= 2 data points (segment options for chart selector)
  const markerCounts = {}
  rows.forEach((r) => { if (r.marcador) markerCounts[r.marcador] = (markerCounts[r.marcador] || 0) + 1 })
  const chartOptions = KEY_THYROID
    .map((k) => {
      const actual = rows.find((r) => r.marcador && k.match(r.marcador.toLowerCase()))?.marcador
      return actual ? { value: actual, label: k.display.length > 12 ? k.display.slice(0, 10) + '…' : k.display } : null
    })
    .filter(Boolean)

  // Recent history table (last 40 rows, optional abnormal-only)
  const tableRows = abnormalOnly ? activeMasterRows.filter((r) => r.flag && r.flag.toLowerCase() !== 'normal') : activeMasterRows

  const chartMax = markerHistory.length > 0 ? Math.max(...markerHistory.map((r) => Number(r.valor) || 0)) : 1
  const chartMin = markerHistory.length > 0 ? Math.min(...markerHistory.map((r) => Number(r.valor) || 0)) : 0
  const chartRange = Math.max(1, chartMax - chartMin)
  const chartLatest = markerHistory[markerHistory.length - 1]
  const chartRef = markerHistory.length > 0 ? { min: markerHistory[0].ref_min, max: markerHistory[0].ref_max } : null

  const activeLabel = labDateFilter === 'all' ? 'Latest available per marker' : `Snapshot from ${fmtDate(labDateFilter)}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 14px', borderRadius: '12px', background: 'var(--surface-raised)', border: '1px solid var(--surface-border)', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '11px', color: 'var(--tx-muted)' }}>
          <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tx-secondary)' }}>Lab date filter</span>
          <span style={{ marginLeft: '10px' }}>{activeLabel}</span>
          <span style={{ marginLeft: '8px', color: 'var(--tx-muted)' }}>· affects thyroid tiles, reference meters, panel health, and lab master only</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={labDateFilter}
            onChange={(e) => setLabDateFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'var(--surface-base)', color: 'var(--tx-primary)', fontSize: '12px' }}
          >
            <option value="all">All · latest per marker</option>
            {labDates.map((d) => (
              <option key={d} value={d}>{fmtDate(d)}</option>
            ))}
          </select>
          {labDateFilter !== 'all' && (
            <button
              onClick={() => setLabDateFilter('all')}
              style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'transparent', color: 'var(--brand-400)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
            >Reset</button>
          )}
        </div>
      </div>

      <div style={card}>
        <p style={label}>🩺 Thyroid Panel · {activeLabel}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
          {thyroidLatest.map((r) => {
            const val = r.valor != null ? Number(r.valor) : null
            const outOfRange = val != null && ((r.ref_min != null && val < Number(r.ref_min)) || (r.ref_max != null && val > Number(r.ref_max)))
            return (
              <div key={r.name} style={{ padding: '12px', borderRadius: '10px', background: 'var(--surface-base)', border: `1px solid ${outOfRange ? 'rgba(239,68,68,0.35)' : 'var(--surface-border)'}` }}>
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tx-muted)' }}>{r.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
                  <span style={{ fontSize: '1.15rem', fontWeight: 700, color: outOfRange ? '#ef4444' : 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(val)}</span>
                  <span style={{ fontSize: '10px', color: 'var(--tx-muted)' }}>{r.unidad || ''}</span>
                </div>
                {r.ref_min != null && r.ref_max != null && (
                  <div style={{ fontSize: '10px', color: 'var(--tx-muted)', marginTop: '4px' }}>ref {fmtNum(r.ref_min)}–{fmtNum(r.ref_max)}</div>
                )}
                {r.flag && (
                  <div style={{ fontSize: '10px', fontWeight: 700, color: flagColor(r.flag), marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{r.flag}</div>
                )}
                {r.fecha && (
                  <div style={{ fontSize: '9px', color: 'var(--tx-muted)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{fmtDate(r.fecha)}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div style={card}>
        <p style={label}>🎯 Reference Range Meters · Thyroid-relevant markers</p>
        <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '-6px 0 14px 0' }}>{labDateFilter === 'all' ? 'Latest value for every thyroid-related marker in your history' : `Thyroid markers from ${fmtDate(labDateFilter)}`} (TSH, T4/T3, thyroglobulin, antibodies, calcitonin, iodine, selenium…). Center green band = healthy zone.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
          {activeMasterRows
            .filter((r) => isThyroidRelated(r.marcador, r.panel) && r.ref_min != null && r.ref_max != null && r.valor != null)
            .map((r, i) => {
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
                <div key={`${r.marcador}-${i}`} style={{ padding: '12px', borderRadius: '10px', background: 'var(--surface-base)', border: `1px solid ${outOfRange ? 'rgba(239,68,68,0.35)' : 'var(--surface-border)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '6px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--tx-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.marcador}>{r.marcador}</span>
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
                  {r.fecha && (
                    <div style={{ fontSize: '9px', color: 'var(--tx-muted)', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>{fmtDate(r.fecha)}</div>
                  )}
                </div>
              )
            })}
        </div>
      </div>

      {chartOptions.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <p style={{ ...label, margin: 0 }}>📈 Marker Trend</p>
            <div style={{ maxWidth: '380px' }}>
              <RubberSegment
                items={chartOptions}
                value={chartMarker}
                onChange={setChartMarker}
                size="sm"
                squash={2.5}
                inset={4}
                radius={18}
                glide={85}
                trackColor="rgba(20, 24, 40, 0.55)"
                thumbColor="rgba(255, 255, 255, 0.95)"
                textColor="rgba(255, 255, 255, 0.7)"
                activeTextColor="#0a0f1f"
                aria-label="Marker selector"
              />
            </div>
          </div>
          {markerHistory.length < 2 ? (
            <div style={{ fontSize: '13px', color: 'var(--tx-muted)' }}>Need at least 2 data points for a trend.</div>
          ) : (() => {
            const w = 1000, h = 220
            const pad = { top: 12, right: 12, bottom: 24, left: 44 }
            const innerW = w - pad.left - pad.right
            const innerH = h - pad.top - pad.bottom
            const xFor = (i) => pad.left + (i / Math.max(1, markerHistory.length - 1)) * innerW
            const yFor = (v) => pad.top + innerH - ((v - chartMin) / chartRange) * innerH
            const refMinY = chartRef && chartRef.min != null ? yFor(Number(chartRef.min)) : null
            const refMaxY = chartRef && chartRef.max != null ? yFor(Number(chartRef.max)) : null
            return (
              <div style={{ position: 'relative' }}>
                <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', height: '220px' }} onMouseLeave={() => setChartHover(null)}>
                  {refMinY != null && refMaxY != null && (
                    <rect x={pad.left} y={Math.min(refMinY, refMaxY)} width={innerW} height={Math.abs(refMaxY - refMinY)} fill="rgba(34,197,94,0.08)" />
                  )}
                  {refMinY != null && <line x1={pad.left} x2={w - pad.right} y1={refMinY} y2={refMinY} stroke="rgba(34,197,94,0.35)" strokeDasharray="3 4" />}
                  {refMaxY != null && <line x1={pad.left} x2={w - pad.right} y1={refMaxY} y2={refMaxY} stroke="rgba(34,197,94,0.35)" strokeDasharray="3 4" />}
                  <path d={markerHistory.map((r, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(Number(r.valor) || 0)}`).join(' ')} stroke="#a78bfa" strokeWidth="2" fill="none" />
                  {markerHistory.map((r, i) => {
                    const v = Number(r.valor) || 0
                    const outOfRange = (chartRef?.min != null && v < Number(chartRef.min)) || (chartRef?.max != null && v > Number(chartRef.max))
                    return <circle key={i} cx={xFor(i)} cy={yFor(v)} r={chartHover === i ? 5 : 3} fill={outOfRange ? '#ef4444' : '#a78bfa'} stroke={chartHover === i ? '#fff' : 'none'} strokeWidth="1.5" />
                  })}
                  {markerHistory.map((r, i) => (
                    <rect key={`hit-${i}`} x={xFor(i) - innerW / (markerHistory.length * 2)} y={pad.top} width={innerW / markerHistory.length} height={innerH} fill="transparent" onMouseEnter={() => setChartHover(i)} onTouchStart={() => setChartHover(i)} style={{ cursor: 'pointer' }} />
                  ))}
                </svg>
                {chartHover != null && markerHistory[chartHover] && (
                  <div style={{ position: 'absolute', top: '4px', right: '10px', background: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '8px 10px', fontSize: '11px', color: 'var(--tx-primary)', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', pointerEvents: 'none' }}>
                    <div style={{ fontWeight: 700 }}>{fmtDate(markerHistory[chartHover].fecha)}</div>
                    <div style={{ color: '#a78bfa', fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>{fmtNum(markerHistory[chartHover].valor)} {markerHistory[chartHover].unidad}</div>
                    {markerHistory[chartHover].flag && <div style={{ color: flagColor(markerHistory[chartHover].flag), textTransform: 'uppercase', fontSize: '10px', marginTop: '2px' }}>{markerHistory[chartHover].flag}</div>}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: 'var(--tx-muted)' }}>
                  <span>{fmtDate(markerHistory[0].fecha)}</span>
                  <span>Latest {chartLatest ? fmtNum(chartLatest.valor) : '—'} {chartLatest ? chartLatest.unidad : ''}</span>
                  <span>{fmtDate(markerHistory[markerHistory.length - 1].fecha)}</span>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {recovery.length >= 2 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ ...label, margin: 0 }}>💚 Recovery & Resilience</p>
            <span style={{ fontSize: '10px', color: 'var(--tx-muted)' }}>Last {recovery.length} days · WHOOP</span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '-4px 0 12px 0' }}>Daily recovery reflects autonomic balance and treatment tolerance. Green ≥67, amber 34–66, red &lt;34.</p>
          {(() => {
            const w = 1000, h = 140
            const pad = { top: 8, right: 8, bottom: 20, left: 34 }
            const innerW = w - pad.left - pad.right
            const innerH = h - pad.top - pad.bottom
            const xFor = (i) => pad.left + (i / Math.max(1, recovery.length - 1)) * innerW
            const yFor = (v) => pad.top + innerH - (v / 100) * innerH
            const green = yFor(67), amber = yFor(34)
            const avg = recovery.reduce((s, r) => s + Number(r.recovery_score), 0) / recovery.length
            const zones = { green: 0, amber: 0, red: 0 }
            recovery.forEach((r) => {
              const v = Number(r.recovery_score)
              if (v >= 67) zones.green++
              else if (v >= 34) zones.amber++
              else zones.red++
            })
            return (
              <>
                <div style={{ position: 'relative', width: '100%', height: '140px' }}>
                  <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', height: '140px' }} onMouseLeave={() => setRecoveryHover(null)}>
                    <rect x={pad.left} y={pad.top} width={innerW} height={green - pad.top} fill="rgba(34,197,94,0.12)" />
                    <rect x={pad.left} y={green} width={innerW} height={amber - green} fill="rgba(245,158,11,0.10)" />
                    <rect x={pad.left} y={amber} width={innerW} height={(pad.top + innerH) - amber} fill="rgba(239,68,68,0.10)" />
                    {[0, 34, 67, 100].map((v) => (
                      <g key={v}>
                        <line x1={pad.left} x2={w - pad.right} y1={yFor(v)} y2={yFor(v)} stroke="var(--surface-border)" strokeDasharray="3 4" />
                        <text x={pad.left - 4} y={yFor(v) + 3} fontSize="9" fill="var(--tx-muted)" textAnchor="end">{v}</text>
                      </g>
                    ))}
                    <path
                      d={recovery.map((r, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(Number(r.recovery_score))}`).join(' ')}
                      stroke="#22c55e"
                      strokeWidth="2"
                      fill="none"
                    />
                    {recovery.map((r, i) => {
                      const v = Number(r.recovery_score)
                      const color = v >= 67 ? '#22c55e' : v >= 34 ? '#f59e0b' : '#ef4444'
                      const active = recoveryHover === i
                      return <circle key={i} cx={xFor(i)} cy={yFor(v)} r={active ? 5 : 2.5} fill={color} stroke={active ? '#fff' : 'none'} strokeWidth="1.5" />
                    })}
                    {recovery.map((r, i) => (
                      <rect key={`hit-${i}`} x={xFor(i) - innerW / (recovery.length * 2)} y={pad.top} width={innerW / recovery.length} height={innerH} fill="transparent" onMouseEnter={() => setRecoveryHover(i)} onTouchStart={() => setRecoveryHover(i)} style={{ cursor: 'pointer' }} />
                    ))}
                  </svg>
                  {recoveryHover != null && recovery[recoveryHover] && (() => {
                    const r = recovery[recoveryHover]
                    const v = Number(r.recovery_score)
                    const color = v >= 67 ? '#22c55e' : v >= 34 ? '#f59e0b' : '#ef4444'
                    const zone = v >= 67 ? 'Green' : v >= 34 ? 'Amber' : 'Red'
                    const leftPct = (recoveryHover / Math.max(1, recovery.length - 1)) * 100
                    const flipLeft = leftPct > 70
                    return (
                      <div style={{
                        position: 'absolute',
                        left: `${leftPct}%`,
                        top: '6px',
                        transform: flipLeft ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)',
                        background: 'var(--surface-raised)',
                        border: '1px solid var(--surface-border)',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        fontSize: '11px',
                        color: 'var(--tx-primary)',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                        zIndex: 5
                      }}>
                        <div style={{ fontWeight: 700 }}>{fmtDate(r.recovery_date)}</div>
                        <div style={{ color, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>{v.toFixed(0)}% <span style={{ fontSize: '10px', fontWeight: 400 }}>· {zone}</span></div>
                      </div>
                    )
                  })()}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '10px', gap: '8px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--tx-primary)', fontVariantNumeric: 'tabular-nums' }}>{avg.toFixed(0)}%</div>
                    <div style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase' }}>Average</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#22c55e', fontVariantNumeric: 'tabular-nums' }}>{zones.green}</div>
                    <div style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase' }}>Green</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>{zones.amber}</div>
                    <div style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase' }}>Amber</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>{zones.red}</div>
                    <div style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase' }}>Red</div>
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      )}

      {bodyHistory.length >= 2 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ ...label, margin: 0 }}>⚖️ Body Composition</p>
            <span style={{ fontSize: '10px', color: 'var(--tx-muted)' }}>Last {bodyHistory.length} measurements</span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '-4px 0 12px 0' }}>Weight stability and lean-mass preservation are key oncology-follow-up markers.</p>
          {(() => {
            const wPts = bodyHistory.map((b) => Number(b.weight_kg)).filter((v) => !isNaN(v))
            const wMax = Math.max(...wPts), wMin = Math.min(...wPts)
            const wRange = Math.max(0.5, wMax - wMin)
            const latest = bodyHistory[bodyHistory.length - 1]
            const first = bodyHistory[0]
            const wDelta = Number(latest.weight_kg) - Number(first.weight_kg)
            const bfLatest = latest.body_fat_pct != null ? Number(latest.body_fat_pct) : null
            const w = 1000, h = 120
            const xFor = (i) => (i / Math.max(1, bodyHistory.length - 1)) * w
            const yFor = (v) => h - 12 - ((v - wMin) / wRange) * (h - 24)
            return (
              <>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--surface-base)', border: '1px solid var(--surface-border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Latest Weight</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--tx-primary)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>{Number(latest.weight_kg).toFixed(1)} <span style={{ fontSize: '11px', color: 'var(--tx-muted)', fontWeight: 400 }}>kg</span></div>
                    <div style={{ fontSize: '11px', color: wDelta >= 0 ? '#22c55e' : '#ef4444', marginTop: '2px', fontWeight: 600 }}>{wDelta >= 0 ? '+' : ''}{wDelta.toFixed(1)} kg since {fmtDate(first.measured_at)}</div>
                  </div>
                  {bfLatest != null && (
                    <div style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--surface-base)', border: '1px solid var(--surface-border)', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Body Fat</div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--tx-primary)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>{bfLatest.toFixed(1)}<span style={{ fontSize: '11px', color: 'var(--tx-muted)', fontWeight: 400 }}>%</span></div>
                      <div style={{ fontSize: '11px', color: 'var(--tx-muted)', marginTop: '2px' }}>{fmtDate(latest.measured_at)}</div>
                    </div>
                  )}
                </div>
                <div style={{ position: 'relative', width: '100%', height: '120px' }}>
                  <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', height: '120px' }} onMouseLeave={() => setWeightHover(null)}>
                    <path d={bodyHistory.map((b, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(Number(b.weight_kg))}`).join(' ')} stroke="#a78bfa" strokeWidth="2" fill="none" />
                    {bodyHistory.map((b, i) => (
                      <circle key={i} cx={xFor(i)} cy={yFor(Number(b.weight_kg))} r={weightHover === i ? 5 : 3} fill="#a78bfa" stroke={weightHover === i ? '#fff' : 'none'} strokeWidth="1.5" />
                    ))}
                    {bodyHistory.map((b, i) => (
                      <rect key={`hit-${i}`} x={xFor(i) - w / (bodyHistory.length * 2)} y={0} width={w / bodyHistory.length} height={h} fill="transparent" onMouseEnter={() => setWeightHover(i)} onTouchStart={() => setWeightHover(i)} style={{ cursor: 'pointer' }} />
                    ))}
                  </svg>
                  {weightHover != null && bodyHistory[weightHover] && (
                    <div style={{ position: 'absolute', top: '4px', right: '10px', background: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', color: 'var(--tx-primary)', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', pointerEvents: 'none' }}>
                      <div style={{ fontWeight: 700 }}>{fmtDate(bodyHistory[weightHover].measured_at)}</div>
                      <div style={{ color: '#a78bfa', fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>{Number(bodyHistory[weightHover].weight_kg).toFixed(1)} kg</div>
                    </div>
                  )}
                </div>
              </>
            )
          })()}
        </div>
      )}

      <div style={card}>
        <p style={label}>🔬 Panel Health · {orderedPanelKeys.length} groups</p>
        <p style={{ fontSize: '11px', color: 'var(--tx-muted)', margin: '-6px 0 14px 0' }}>Markers grouped into clean semantic categories. Ring shows the share within reference range per group.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
          {orderedPanelKeys.map((panelName) => {
            const panelRows = panels[panelName]
            const catMeta = PANEL_CATEGORIES.find((c) => c.key === panelName)
            const scored = panelRows.filter((r) => r.ref_min != null && r.ref_max != null && r.valor != null)
            const inRange = scored.filter((r) => {
              const v = Number(r.valor)
              return v >= Number(r.ref_min) && v <= Number(r.ref_max)
            }).length
            const total = scored.length
            const pct = total > 0 ? (inRange / total) * 100 : 100
            const R = 32, C = 2 * Math.PI * R
            const dash = (pct / 100) * C
            const color = pct >= 90 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444'
            return (
              <button
                key={panelName}
                type="button"
                onClick={() => setOpenPanel(panelName)}
                style={{ padding: '12px', borderRadius: '10px', background: 'var(--surface-base)', border: '1px solid var(--surface-border)', textAlign: 'center', cursor: 'pointer', color: 'inherit', font: 'inherit', transition: 'border-color 0.15s, transform 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--surface-border)'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 8px' }}>
                  <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                    <circle cx="40" cy="40" r={R} fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${dash} ${C - dash}`} strokeLinecap="round" />
                  </svg>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1rem', fontWeight: 700, color }}>{Math.round(pct)}%</div>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--tx-primary)', lineHeight: 1.2 }} title={panelName}>{catMeta ? `${catMeta.emoji} ` : ''}{panelName}</div>
                <div style={{ fontSize: '10px', color: 'var(--tx-muted)', marginTop: '3px' }}>{inRange}/{total} in range · {panelRows.length} markers</div>
              </button>
            )
          })}
        </div>
      </div>

      {openPanel && (() => {
        const panelRows = panels[openPanel] || []
        const scored = panelRows.filter((r) => r.ref_min != null && r.ref_max != null && r.valor != null)
        const inRange = scored.filter((r) => {
          const v = Number(r.valor)
          return v >= Number(r.ref_min) && v <= Number(r.ref_max)
        }).length
        const total = scored.length
        const pct = total > 0 ? (inRange / total) * 100 : 100
        const color = pct >= 90 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444'
        return (
          <div
            onClick={() => setOpenPanel(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', paddingBottom: '14px', borderBottom: '1px solid var(--surface-border)', marginBottom: '14px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--tx-primary)' }}>{(PANEL_CATEGORIES.find((c) => c.key === openPanel)?.emoji) || '🔬'} {openPanel}</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--tx-muted)' }}>{panelRows.length} markers · {inRange}/{total} in reference range</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{Math.round(pct)}%</div>
                  <button
                    onClick={() => setOpenPanel(null)}
                    aria-label="Close"
                    style={{ border: 'none', background: 'transparent', color: 'var(--tx-muted)', cursor: 'pointer', fontSize: '22px', lineHeight: 1, padding: '0 4px' }}
                  >×</button>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '480px' }}>
                  <thead>
                    <tr style={{ color: 'var(--tx-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Marker</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Value</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Ref</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panelRows.map((r, i) => {
                      const val = Number(r.valor)
                      const rMin = r.ref_min != null ? Number(r.ref_min) : null
                      const rMax = r.ref_max != null ? Number(r.ref_max) : null
                      const hasRange = rMin != null && rMax != null
                      const outOfRange = hasRange && (val < rMin || val > rMax)
                      const valColor = !hasRange ? 'var(--tx-primary)' : outOfRange ? '#ef4444' : flagColor(r.flag)
                      return (
                        <tr key={`${r.marcador}-${i}`} style={{ borderTop: '1px solid var(--surface-border)' }}>
                          <td style={{ padding: '8px', color: 'var(--tx-secondary)', whiteSpace: 'nowrap' }}>{fmtDate(r.fecha)}</td>
                          <td style={{ padding: '8px', color: 'var(--tx-primary)', fontWeight: 500 }}>{r.marcador}</td>
                          <td style={{ padding: '8px', textAlign: 'right', color: valColor, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(val)} <span style={{ color: 'var(--tx-muted)', fontWeight: 400, fontSize: '10px' }}>{r.unidad || ''}</span></td>
                          <td style={{ padding: '8px', color: 'var(--tx-muted)', fontSize: '11px', whiteSpace: 'nowrap' }}>{hasRange ? `${fmtNum(rMin)}–${fmtNum(rMax)}` : '—'}</td>
                          <td style={{ padding: '8px', color: flagColor(r.flag), fontWeight: 700, fontSize: '10px', textTransform: 'uppercase' }}>{r.flag || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })()}

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <p style={{ ...label, margin: 0 }}>📋 Lab Master · {tableRows.length} markers</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--tx-secondary)' }}>
            <span style={{ color: abnormalOnly ? 'var(--tx-muted)' : 'var(--tx-primary)' }}>All</span>
            <SquishSwitch
              checked={abnormalOnly}
              onChange={setAbnormalOnly}
              ariaLabel="Filter abnormal only"
              width={40}
              height={22}
              trackColor="rgba(255,255,255,0.08)"
              trackOnColor="#ef4444"
            />
            <span style={{ color: abnormalOnly ? '#ef4444' : 'var(--tx-muted)' }}>Abnormal</span>
          </div>
        </div>
        <div style={{ overflow: 'auto', maxHeight: '520px', border: '1px solid var(--surface-border)', borderRadius: '10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '520px' }}>
            <thead>
              <tr style={{ color: 'var(--tx-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Marker</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Value</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Ref</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Panel</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Flag</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--surface-border)' }}>
                  <td style={{ padding: '8px', color: 'var(--tx-secondary)', whiteSpace: 'nowrap' }}>{fmtDate(r.fecha)}</td>
                  <td style={{ padding: '8px', color: 'var(--tx-primary)', fontWeight: 500 }}>{r.marcador}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: flagColor(r.flag), fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(r.valor)} <span style={{ color: 'var(--tx-muted)', fontWeight: 400, fontSize: '10px' }}>{r.unidad || ''}</span></td>
                  <td style={{ padding: '8px', color: 'var(--tx-muted)', fontSize: '11px', whiteSpace: 'nowrap' }}>{r.ref_min != null && r.ref_max != null ? `${fmtNum(r.ref_min)}–${fmtNum(r.ref_max)}` : '—'}</td>
                  <td style={{ padding: '8px', color: 'var(--tx-muted)', fontSize: '10px', textTransform: 'uppercase' }}>{r.panel || '—'}</td>
                  <td style={{ padding: '8px', color: flagColor(r.flag), fontWeight: 700, fontSize: '10px', textTransform: 'uppercase' }}>{r.flag || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

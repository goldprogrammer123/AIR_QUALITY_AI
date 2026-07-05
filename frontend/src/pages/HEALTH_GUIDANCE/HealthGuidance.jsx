import { useState, useEffect } from 'react'
import { fetchAll, fetchRecommendation } from '../../services/api'
import { getAQIColor, getAQICategory, AQI_SCALE, SENSOR_NODES } from '../../utils/aqi'
import './HealthGuidance.css'

const GROUPS = [
  {
    label: 'Children',
    good:     'Outdoor play and school activities are safe. No air purifiers or restrictions are needed at current levels.',
    moderate: 'Sensitive children should limit prolonged outdoor activity.',
    sensitive:'Keep children indoors; avoid strenuous outdoor exercise.',
    unhealthy:'All children should stay indoors. Keep windows closed.',
    veryBad:  'Children must stay inside with air purifiers running.',
  },
  {
    label: 'Elderly',
    good:     'Normal daily routines, including walks and errands, are safe. Windows can remain open for ventilation.',
    moderate: 'Sensitive elderly may wish to reduce outdoor exposure.',
    sensitive:'Limit outdoor activities. Consider wearing a mask outside.',
    unhealthy:'Remain indoors as much as possible.',
    veryBad:  'Stay indoors, keep windows closed, use air purifier.',
  },
  {
    label: 'Heart & lung patients',
    good:     'Conditions are currently safe, but keep prescribed medication nearby and seek medical advice if symptoms appear.',
    moderate: 'Be alert to symptoms such as coughing or shortness of breath.',
    sensitive:'Reduce physical exertion. Avoid high-traffic areas.',
    unhealthy:'Avoid all outdoor exertion. Have medication on hand.',
    veryBad:  'Stay indoors. Seek medical advice if symptoms worsen.',
  },
  {
    label: 'Athletes',
    good:     'Training, running, and outdoor sport are safe. Stay hydrated during extended sessions in the afternoon heat.',
    moderate: 'Outdoor exercise is fine. Warm up gradually.',
    sensitive:'Move intense workouts indoors.',
    unhealthy:'Exercise only indoors.',
    veryBad:  'No outdoor activity at all.',
  },
  {
    label: 'General public',
    good:     'All outdoor activities can continue without masks or precautions. Air quality is well within safe limits.',
    moderate: 'Unusually sensitive people may want to reduce outdoor time.',
    sensitive:'Reduce prolonged outdoor exertion when possible.',
    unhealthy:'Limit outdoor activity, especially strenuous exercise.',
    veryBad:  'Avoid outdoor activities. Wear N95 mask if you must go out.',
  },
]

function getGroupAdvice(group, aqi) {
  if (aqi <= 50)  return group.good
  if (aqi <= 100) return group.moderate
  if (aqi <= 150) return group.sensitive
  if (aqi <= 200) return group.unhealthy
  return group.veryBad
}

function getRiskBadge(label, aqi) {
  if (label === 'Heart & lung patients') {
    if (aqi <= 50)  return { text: 'MONITOR',   color: '#d97706', bg: '#fef3c7' }
    if (aqi <= 100) return { text: 'CAUTION',   color: '#d97706', bg: '#fef3c7' }
    if (aqi <= 150) return { text: 'HIGH RISK', color: '#dc2626', bg: '#fee2e2' }
    return { text: 'DANGER', color: '#dc2626', bg: '#fee2e2' }
  }
  if (aqi <= 50)  return { text: 'LOW RISK',  color: '#16a34a', bg: '#dcfce7' }
  if (aqi <= 100) return { text: 'CAUTION',   color: '#d97706', bg: '#fef3c7' }
  if (aqi <= 150) return { text: 'HIGH RISK', color: '#dc2626', bg: '#fee2e2' }
  return { text: 'DANGER', color: '#dc2626', bg: '#fee2e2' }
}

function getBorderColor(badge) {
  if (badge.text === 'LOW RISK') return '#2563eb'
  if (badge.text === 'MONITOR' || badge.text === 'CAUTION') return '#d97706'
  return '#dc2626'
}

const AI_SECTIONS = [
  'Current health effects',
  'Who is most at risk',
  'Protective actions',
  'What to avoid',
  '6-hour forecast',
]

export default function HealthGuidance() {
  const [sensors, setSensors]             = useState(null)
  const [fullAdvice, setFullAdvice]       = useState('')
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [activeSensor, setActiveSensor]   = useState(SENSOR_NODES[0].sensorKey)

  useEffect(() => {
    fetchAll()
      .then((r) => setSensors(r.data.sensors))
      .catch(() => setError('Cannot reach the backend API.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!sensors) return
    setAdviceLoading(true)
    fetchRecommendation()
      .then((r) => setFullAdvice(r.data.advice.replace(/\*\*/g, '')))
      .catch(() => setFullAdvice(''))
      .finally(() => setAdviceLoading(false))
  }, [sensors])

  if (loading) return (
    <div className="loading-screen"><div className="spinner" /><p>Loading health data…</p></div>
  )
  if (error) return (
    <div className="error-screen">
      <div className="glass-card error-card">
        <span className="error-icon">⚠️</span><h3>Connection Error</h3><p>{error}</p>
      </div>
    </div>
  )

  const data = sensors?.[activeSensor] ?? {}
  const { current_aqi = 0, pollutants = {} } = data
  const aqiColor    = getAQIColor(current_aqi)
  const aqiCategory = getAQICategory(current_aqi)
  const activeNode  = SENSOR_NODES.find(n => n.sensorKey === activeSensor)

  const paragraphs = fullAdvice.split('\n\n').filter(Boolean)
  const aiSections = AI_SECTIONS.map((label, i) => ({ label, content: paragraphs[i] || '' }))

  return (
    <div className="hg-page">

      {/* ══ SECTION 1: Dark header ══ */}
      <section className="hg-dark-section">
        <div className="hg-inner">
          <h1 className="hg-title">Health guidance</h1>
          <p className="hg-sub">
            Personalized recommendations generated from live sensor readings at Ardhi University
            — updated every 60 seconds.
          </p>

          <div className="hg-sensor-tabs">
            {SENSOR_NODES.map((n) => (
              <button
                key={n.sensorKey}
                className={`hg-tab ${activeSensor === n.sensorKey ? 'active' : ''}`}
                onClick={() => setActiveSensor(n.sensorKey)}
              >
                {n.name}
              </button>
            ))}
          </div>

          {/* Status bar */}
          <div className="hg-status-bar">
            <div className="hg-aqi-circle" style={{ borderColor: aqiColor, color: aqiColor }}>
              <span className="hg-aqi-num">{Math.round(current_aqi)}</span>
            </div>
            <div className="hg-status-col">
              <span className="hg-stat-label">CURRENT AQI</span>
              <span className="hg-stat-val" style={{ color: aqiColor }}>{aqiCategory}</span>
            </div>
            <div className="hg-stat-divider" />
            <div className="hg-status-col">
              <span className="hg-stat-label">STATION</span>
              <span className="hg-stat-val dark">{activeNode?.name} · Dar es Salaam</span>
            </div>
            {pollutants.pm25 != null && <>
              <div className="hg-stat-divider" />
              <div className="hg-status-col">
                <span className="hg-stat-label blue">PM2.5</span>
                <span className="hg-stat-val">{pollutants.pm25} µg/m³</span>
              </div>
            </>}
            {pollutants.pm10 != null && <>
              <div className="hg-stat-divider" />
              <div className="hg-status-col">
                <span className="hg-stat-label blue">PM10</span>
                <span className="hg-stat-val">{pollutants.pm10} µg/m³</span>
              </div>
            </>}
            {pollutants.no2 != null && <>
              <div className="hg-stat-divider" />
              <div className="hg-status-col">
                <span className="hg-stat-label blue">NO₂</span>
                <span className="hg-stat-val">{pollutants.no2} µg/m³</span>
              </div>
            </>}
            <div className="hg-stat-divider" />
            <div className="hg-status-col">
              <span className="hg-stat-label">UPDATED</span>
              <span className="hg-stat-val">Live</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══ SECTION 2: White — Group recommendations ══ */}
      <section className="hg-white-section">
        <div className="hg-inner hg-full">
          <p className="hg-eyebrow blue">RECOMMENDATIONS BY GROUP</p>
          <h2 className="hg-section-heading">Guidance for every group</h2>
          <p className="hg-section-sub">
            Advice is tailored to sensitivity level. At the current AQI, most groups can carry on as normal.
          </p>

          <div className="hg-groups-grid">
            {GROUPS.map((g) => {
              const badge = getRiskBadge(g.label, current_aqi)
              return (
                <div key={g.label} className="hg-group-card" style={{ borderLeftColor: getBorderColor(badge) }}>
                  <div className="hg-group-top">
                    <span className="hg-group-label">{g.label}</span>
                    <span className="hg-risk-badge" style={{ color: badge.color, background: badge.bg }}>
                      {badge.text}
                    </span>
                  </div>
                  <p className="hg-group-advice">{getGroupAdvice(g, current_aqi)}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══ SECTION 3: White — AI full analysis ══ */}
      <section className="hg-white-section hg-border-top">
        <div className="hg-inner hg-full">
          <h2 className="hg-section-heading hg-blue-heading">AI HEALTH ANALYSIS</h2>
          <p className="hg-section-sub">
            A detailed reading of today's air, generated by the recommendation engine from live pollutant data.
          </p>

          {adviceLoading ? (
            <div className="hg-advice-loading">
              <div className="pulse-dot" style={{ background: '#2563eb', width: 8, height: 8, borderRadius: '50%', animation: 'pulse 1.4s ease-in-out infinite' }} />
              <span>AI is generating analysis…</span>
            </div>
          ) : (
            <div className="hg-ai-grid">
              {aiSections.map((sec, i) => (
                sec.content ? (
                  <div key={sec.label} className="hg-ai-card">
                    <div className="hg-ai-sec-header">
                      <span className="hg-diamond">◆</span>
                      <h3 className="hg-ai-sec-title">{sec.label}</h3>
                    </div>
                    <p className="hg-ai-sec-body">{sec.content}</p>
                  </div>
                ) : null
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ══ SECTION 4: Dark — AQI Scale ══ */}
      <section className="hg-dark-section">
        <div className="hg-inner">
          <p className="hg-eyebrow blue">AQI SCALE REFERENCE</p>
          <h2 className="hg-section-heading light">How to read the index</h2>

          <div className="hg-scale-wrap">
            <table className="hg-scale-table">
              <thead>
                <tr>
                  <th>RANGE</th>
                  <th>CATEGORY</th>
                  <th>WHAT IT MEANS</th>
                </tr>
              </thead>
              <tbody>
                {AQI_SCALE.map((s) => {
                  const [lo, hi] = s.range.split('–').map(p => parseInt(p.trim()))
                  const isCurrent = current_aqi >= lo && current_aqi <= hi
                  return (
                    <tr key={s.label} className={isCurrent ? 'hg-scale-current' : ''}>
                      <td>
                        <span className="hg-scale-dot" style={{ background: s.color }} />
                        <span className="hg-scale-range">{s.range}</span>
                        {isCurrent && <span className="hg-current-tag">CURRENT</span>}
                      </td>
                      <td>
                        <span className="hg-scale-badge" style={{ color: s.color, background: s.bg }}>
                          {s.label}
                        </span>
                      </td>
                      <td className="hg-scale-desc">{s.description}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

    </div>
  )
}

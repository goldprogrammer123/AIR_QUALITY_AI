import { useState, useEffect } from 'react'
import { fetchAll, fetchRecommendation } from '../../services/api'
import { getAQIColor, getAQICategory, AQI_SCALE, SENSOR_NODES } from '../../utils/aqi'
import './HealthGuidance.css'

/* Group icons and short descriptions */
const GROUPS = [
  {
    icon: '👶',
    label: 'Children',
    good:     'Safe for outdoor play and sports.',
    moderate: 'Sensitive children should limit prolonged outdoor activity.',
    sensitive:'Keep children indoors; avoid strenuous outdoor exercise.',
    unhealthy:'All children should stay indoors. Keep windows closed.',
    veryBad:  'Children must stay inside with air purifiers running.',
  },
  {
    icon: '👴',
    label: 'Elderly',
    good:     'No restrictions. Enjoy outdoor activities.',
    moderate: 'Sensitive elderly may wish to reduce outdoor exposure.',
    sensitive:'Limit outdoor activities. Consider wearing a mask outside.',
    unhealthy:'Remain indoors as much as possible.',
    veryBad:  'Stay indoors, keep windows closed, use air purifier.',
  },
  {
    icon: '🫀',
    label: 'Heart & Lung Patients',
    good:     'Normal activities. Monitor symptoms as usual.',
    moderate: 'Be alert to symptoms such as coughing or shortness of breath.',
    sensitive:'Reduce physical exertion. Avoid high-traffic areas.',
    unhealthy:'Avoid all outdoor exertion. Have medication on hand.',
    veryBad:  'Stay indoors. Seek medical advice if symptoms worsen.',
  },
  {
    icon: '🏃',
    label: 'Athletes',
    good:     'Great conditions for vigorous outdoor exercise.',
    moderate: 'Outdoor exercise is fine. Warm up gradually.',
    sensitive:'Move intense workouts indoors.',
    unhealthy:'Exercise only indoors.',
    veryBad:  'No outdoor activity at all.',
  },
  {
    icon: '👥',
    label: 'General Public',
    good:     'Enjoy your day outdoors without concern.',
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

export default function HealthGuidance() {
  const [predictions, setPredictions]     = useState(null)
  const [fullAdvice, setFullAdvice]       = useState('')
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [selectedNodeId, setSelectedNodeId] = useState(SENSOR_NODES[0].id)

  useEffect(() => {
    fetchAll()
      .then((r) => setPredictions(r.data))
      .catch(() => setError('Cannot reach the backend API.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!predictions) return
    setAdviceLoading(true)
    fetchRecommendation()
      .then((r) => setFullAdvice(r.data.advice.replace(/\*\*/g, '')))
      .catch(() => setFullAdvice(''))
      .finally(() => setAdviceLoading(false))
  }, [predictions])

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <p>Loading health data…</p>
    </div>
  )

  if (error) return (
    <div className="error-screen">
      <div className="glass-card error-card">
        <span className="error-icon">⚠️</span>
        <h3>Connection Error</h3>
        <p>{error}</p>
      </div>
    </div>
  )

  const { current_aqi } = predictions
  const aqiColor    = getAQIColor(current_aqi)
  const aqiCategory = getAQICategory(current_aqi)

  return (
    <div className="hg-page">
      {/* ── PAGE HEADER ── */}
      <div className="hg-header">
        <h1 className="hg-title">Health Guidance</h1>
        <p className="hg-sub">
          Personalised air quality advice based on live sensor readings.
          Select a location to see its current readings.
        </p>

        {/* Location selector */}
        <div className="location-tabs">
          {SENSOR_NODES.map((n) => (
            <button
              key={n.id}
              className={`loc-tab ${selectedNodeId === n.id ? 'active' : ''}`}
              onClick={() => setSelectedNodeId(n.id)}
            >
              📡 {n.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── CURRENT AQI BANNER ── */}
      <div className="glass-card aqi-banner" style={{ borderLeft: `5px solid ${aqiColor}` }}>
        <div className="banner-left">
          <div className="banner-location">
            {SENSOR_NODES.find((n) => n.id === selectedNodeId)?.name}
          </div>
          <div className="banner-aqi" style={{ color: aqiColor }}>
            {Math.round(current_aqi)}
            <span className="banner-unit">AQI</span>
          </div>
          <div
            className="banner-cat"
            style={{ background: `${aqiColor}18`, color: aqiColor }}
          >
            {aqiCategory}
          </div>
        </div>
        <div className="banner-right">
          <p className="banner-msg">
            {AQI_SCALE.find((s) =>
              s.label.toLowerCase().includes(aqiCategory.toLowerCase().split(' ')[0])
            )?.description || AQI_SCALE[0].description}
          </p>
        </div>
      </div>

      {/* ── GROUP RECOMMENDATIONS ── */}
      <h2 className="section-heading">Recommendations by Group</h2>
      <div className="groups-grid">
        {GROUPS.map((g) => (
          <div key={g.label} className="glass-card group-card">
            <div className="group-icon">{g.icon}</div>
            <h3 className="group-label">{g.label}</h3>
            <p className="group-advice">{getGroupAdvice(g, current_aqi)}</p>
          </div>
        ))}
      </div>

      {/* ── AI FULL RECOMMENDATION ── */}
      <h2 className="section-heading">AI Health Analysis</h2>
      <div className="glass-card ai-advice-card">
        {adviceLoading ? (
          <div className="advice-loading">
            <div className="pulse-dot" />
            <span>AI is generating detailed health advice…</span>
          </div>
        ) : fullAdvice ? (
          <div className="ai-sections">
            {fullAdvice.split('\n\n').filter(Boolean).map((para, i) => (
              <p key={i} className="ai-para">{para}</p>
            ))}
          </div>
        ) : (
          <p style={{ color: '#6a8faf' }}>AI advice unavailable.</p>
        )}
      </div>

      {/* ── AQI SCALE REFERENCE ── */}
      <h2 className="section-heading">AQI Scale Reference</h2>
      <div className="glass-card scale-card">
        <table className="scale-table">
          <thead>
            <tr>
              <th>Range</th>
              <th>Category</th>
              <th>What it means</th>
            </tr>
          </thead>
          <tbody>
            {AQI_SCALE.map((s) => (
              <tr key={s.label}>
                <td>
                  <span className="scale-dot" style={{ background: s.color }} />
                  <span style={{ color: s.color, fontWeight: 700 }}>{s.range}</span>
                </td>
                <td>
                  <span
                    className="scale-badge"
                    style={{ background: s.bg, color: s.color }}
                  >
                    {s.label}
                  </span>
                </td>
                <td className="scale-desc">{s.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

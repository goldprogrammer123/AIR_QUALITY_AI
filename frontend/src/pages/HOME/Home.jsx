import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { fetchAll, fetchRecommendation } from '../../services/api'
import { getAQIColor, getAQICategory, SENSOR_NODES } from '../../utils/aqi'
import './Home.css'

const SPECTRUM_BANDS = [
  { label: 'Good',                    range: '0–50',   color: '#27ae60', desc: 'Air quality is satisfactory. Little or no risk.' },
  { label: 'Moderate',                range: '51–100',  color: '#f1c40f', desc: 'Acceptable; may affect very sensitive people.' },
  { label: 'Unhealthy for sensitive', range: '101–150', color: '#e67e22', desc: 'Sensitive groups may feel health effects.' },
  { label: 'Unhealthy',               range: '151–200', color: '#e74c3c', desc: 'Everyone may begin to feel health effects.' },
  { label: 'Very unhealthy',          range: '201–300', color: '#8e44ad', desc: 'Health alert: more serious effects for all.' },
  { label: 'Hazardous',               range: '301–500', color: '#7b241c', desc: 'Emergency conditions. Everyone affected.' },
]

function spectrumPct(aqi) {
  const segs = [[0,50],[51,100],[101,150],[151,200],[201,300],[301,500]]
  for (let i = 0; i < segs.length; i++) {
    const [lo, hi] = segs[i]
    if (aqi <= hi) return ((i + (aqi - lo) / (hi - lo)) / segs.length) * 100
  }
  return 100
}

function DotLabel({ cx, cy, value, stroke }) {
  if (cx == null || cy == null) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill={stroke} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
      <text x={cx} y={cy - 10} textAnchor="middle" fill="#cbd5e1" fontSize={11} fontWeight={600}>
        {typeof value === 'number' ? +value.toFixed(1) : value}
      </text>
    </g>
  )
}

export default function Home() {
  const [sensors, setSensors]             = useState(null)
  const [activeSensor, setActiveSensor]   = useState('lands')
  const [advice, setAdvice]               = useState('')
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [search, setSearch]               = useState('')
  const [suggestions, setSuggestions]     = useState([])
  const insightsRef = useRef(null)
  const scaleRef    = useRef(null)

  useEffect(() => {
    fetchAll()
      .then((r) => {
        setSensors(r.data.sensors)
        const keys = Object.keys(r.data.sensors)
        if (keys.length > 0) setActiveSensor(keys[0])
      })
      .catch(() => setError('Cannot reach the backend API.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!sensors) return
    setAdviceLoading(true)
    fetchRecommendation()
      .then((r) => {
        const full = r.data.advice.replace(/\*\*/g, '')
        const para = full.split('\n\n')[0]
        setAdvice(para.length > 280 ? para.slice(0, 280) + '…' : para)
      })
      .catch(() => setAdvice('Visit the Health Guidance page for detailed recommendations based on the current air quality.'))
      .finally(() => setAdviceLoading(false))
  }, [sensors])

  const handleSearch = (e) => {
    const val = e.target.value
    setSearch(val)
    setSuggestions(val.length > 0 ? SENSOR_NODES.filter(n => n.name.toLowerCase().includes(val.toLowerCase())) : [])
  }
  const selectNode = (node) => { setActiveSensor(node.sensorKey); setSearch(node.name); setSuggestions([]) }

  if (loading) return (
    <div className="loading-screen"><div className="spinner" /><p>Loading air quality data…</p></div>
  )
  if (error) return (
    <div className="error-screen">
      <div className="glass-card error-card">
        <span className="error-icon">⚠️</span><h3>Connection Error</h3><p>{error}</p>
      </div>
    </div>
  )

  const data = sensors?.[activeSensor] ?? {}
  const {
    current_aqi = 0, trend_direction = 'stable', trend_confidence = 0,
    forecast_6h, pm25_forecast_6h, pollutants = {},
  } = data
  const aqiColor    = getAQIColor(current_aqi)
  const aqiCategory = getAQICategory(current_aqi)
  const sensorCount = Object.keys(sensors ?? {}).length
  const sensorName  = SENSOR_NODES.find(n => n.sensorKey === activeSensor)?.name ?? activeSensor

  const forecastData = (forecast_6h     || []).map((v, i) => ({ hour: `+${i + 1}h`, aqi:  +v.toFixed(1) }))
  const pm25Data     = (pm25_forecast_6h|| []).map((v, i) => ({ hour: `+${i + 1}h`, pm25: +v.toFixed(1) }))

  const peakAqi = forecastData.length ? Math.max(...forecastData.map(d => d.aqi)).toFixed(0) : Math.round(current_aqi)
  const lowAqi  = forecastData.length ? Math.min(...forecastData.map(d => d.aqi)).toFixed(0) : Math.round(current_aqi)
  const peakPm  = pm25Data.length ? Math.max(...pm25Data.map(d => d.pm25)) : 0
  const lowPm   = pm25Data.length ? Math.min(...pm25Data.map(d => d.pm25)) : 0

  const adviceSentences = advice.split(/(?<=[.!?])\s+/)
  const blockquote = adviceSentences.length > 1
    ? adviceSentences.slice(-2).join(' ')
    : advice.slice(0, 120) + (advice.length > 120 ? '…' : '')

  return (
    <div className="home-page">

      {/* ══════════ SECTION 1 — Dark hero ══════════ */}
      <section className="home-section dark-section">
        <div className="hero-inner">

          {/* Left column */}
          <div className="hero-left">
            <div className="location-badge">
              <span className="location-dot" />
              Dar es Salaam, Tanzania · {sensorCount} sensor{sensorCount !== 1 ? 's' : ''} online
            </div>

            <h1 className="hero-title">
              Breathe smarter.<br />
              <span className="hero-accent">Live safer.</span>
            </h1>

            <p className="hero-sub">
              Real-time air quality across the Ardhi University campus, powered by IoT sensors
              and machine learning — know your environment before you step outside.
            </p>

            {/* Search */}
            <div className="search-wrap">
              <div className="search-bar">
                <span className="search-icon">📍</span>
                <input
                  className="search-input"
                  placeholder="Search a sensor location (e.g. Land Building…)"
                  value={search}
                  onChange={handleSearch}
                />
                {search && (
                  <button className="search-clear" onClick={() => { setSearch(''); setSuggestions([]) }}>✕</button>
                )}
                <button className="search-btn">🔍 Search</button>
              </div>
              {suggestions.length > 0 && (
                <ul className="search-dropdown">
                  {suggestions.map((n) => (
                    <li key={n.id} onClick={() => selectNode(n)}>
                      <span>📡</span>
                      <div><strong>{n.name}</strong><small>{n.description}</small></div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Sensor tabs */}
            <div className="sensor-tabs">
              {SENSOR_NODES.map((node) => {
                const s = sensors?.[node.sensorKey]
                const color = s ? getAQIColor(s.current_aqi) : '#27ae60'
                return (
                  <button
                    key={node.sensorKey}
                    className={`sensor-tab ${activeSensor === node.sensorKey ? 'active' : ''}`}
                    onClick={() => setActiveSensor(node.sensorKey)}
                  >
                    📍 {node.name}
                    {s && (
                      <span className="tab-aqi-pill" style={{ background: color }}>
                        {Math.round(s.current_aqi)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Scroll cue */}
            <button className="scroll-cue" onClick={() => insightsRef.current?.scrollIntoView({ behavior: 'smooth' })}>
              Explore insights ↓
            </button>
          </div>

          {/* Right column — white AQI card */}
          <div className="hero-right">
            <div className="aqi-card-hero">
              {/* Card header */}
              <div className="aqic-header">
                <span className="aqic-location">CURRENT AIR QUALITY — {sensorName.toUpperCase()}</span>
                <span className="aqic-live"><span className="live-dot" />LIVE</span>
              </div>

              {/* Concentric rings */}
              <div className="aqi-rings-wrap">
                <div className="ring ring-outer" />
                <div className="ring ring-mid" />
                <div className="ring ring-inner" style={{ borderColor: aqiColor }}>
                  <span className="aqi-big" style={{ color: '#1e293b' }}>{Math.round(current_aqi)}</span>
                  <span className="aqi-sub">AQI</span>
                </div>
              </div>

              {/* Status row */}
              <div className="aqic-status">
                <span className="aqic-badge" style={{ background: `${aqiColor}18`, color: aqiColor, border: `1px solid ${aqiColor}40` }}>
                  {aqiCategory}
                </span>
                <span className="aqic-trend">
                  {trend_direction === 'rising' ? '↑' : '↓'} {trend_direction.charAt(0).toUpperCase() + trend_direction.slice(1)} · {trend_confidence}% confidence
                </span>
              </div>

              {/* Metrics */}
              <div className="metric-row">
                {pollutants.pm25 > 0 && <MetricBox label="PM2.5"    val={pollutants.pm25}        unit="µg/m³" />}
                {pollutants.pm10 > 0 && <MetricBox label="PM10"     val={pollutants.pm10}         unit="µg/m³" />}
                <MetricBox label="HUMIDITY"    val={pollutants.humidity}    unit="%" />
                <MetricBox label="TEMP"        val={pollutants.temperature} unit="°C" />
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ══════════ SECTION 2 — White: AI Insights ══════════ */}
      <section className="home-section white-section" ref={insightsRef}>
        <div className="section-inner">
          <p className="eyebrow">AI HEALTH INSIGHTS</p>
          <h2 className="section-heading">What the air means for you, right now</h2>
          <p className="section-sub">
            Our recommendation engine reads live sensor data and turns it into plain-language health guidance.
          </p>

          <div className="insights-grid">
            <div className="insight-card">
              <div className="insight-icon-wrap"><span>✦</span></div>
              <h3 className="insight-title">AI recommendation</h3>
              {adviceLoading ? (
                <div className="insight-loading"><div className="pulse-dot blue" /><span>Analysing…</span></div>
              ) : (
                <>
                  <p className="insight-body">{advice}</p>
                  {blockquote && <blockquote className="insight-quote">{blockquote}</blockquote>}
                </>
              )}
              <div className="insight-links">
                <Link to="/health-guidance" className="insight-link">View full health guidance →</Link>
                <Link to="/map"             className="insight-link">Explore sensor map →</Link>
              </div>
            </div>

            <div className="insight-card">
              <div className="insight-icon-wrap"><span>📍</span></div>
              <h3 className="insight-title">What is AQI?</h3>
              <p className="insight-body">
                The <strong>Air Quality Index (AQI)</strong> is a number from 0 to 500 that tells you how
                clean or polluted the air is, and what health effects may be a concern. The higher the
                number, the worse the air quality — and the greater the health risk.
              </p>
              <button className="insight-link btn-link" onClick={() => scaleRef.current?.scrollIntoView({ behavior: 'smooth' })}>
                See the full scale below ↓
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ SECTION 3 — White: AQI Scale ══════════ */}
      <section className="home-section white-section border-top-section" ref={scaleRef}>
        <div className="section-inner">
          <p className="eyebrow">THE AQI SCALE</p>
          <h2 className="section-heading">Where today's air sits on the spectrum</h2>

          <div className="spectrum-card">
            <div className="spectrum-wrap">
              <div className="spectrum-indicator-row">
                <div className="spectrum-indicator" style={{ left: `${Math.min(spectrumPct(current_aqi), 99)}%` }}>
                  <div className="you-are-here">You are here · {Math.round(current_aqi)}</div>
                  <div className="indicator-stem" />
                  <div className="indicator-dot" />
                </div>
              </div>
              <div className="spectrum-bar-track">
                {SPECTRUM_BANDS.map((b) => <div key={b.label} className="spectrum-seg" style={{ background: b.color }} />)}
              </div>
              <div className="spectrum-labels">
                {SPECTRUM_BANDS.map((b) => (
                  <div key={b.label} className="spectrum-label-col">
                    <div className="spec-range">{b.range}</div>
                    <div className="spec-name">{b.label}</div>
                    <div className="spec-desc">{b.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ SECTION 4 — Dark: Forecast ══════════ */}
      <section className="home-section dark-section">
        <div className="section-inner">
          <h2 className="section-heading light">The next 6 hours, predicted</h2>
          <p className="section-sub light">
            Hourly forecasts generated by our LSTM model, retrained daily on campus sensor history.
          </p>

          <div className="forecast-pair">
            <div className="dark-chart-card">
              <div className="dcc-header">
                <div className="dcc-accent" />
                <span className="dcc-title">6-HOUR AQI FORECAST</span>
              </div>
              <div className="dcc-stats">
                <span>Peak <strong>{peakAqi}</strong></span>
                <span className="dcc-sep">·</span>
                <span>Low <strong>{lowAqi}</strong></span>
                <span className="dcc-sep">·</span>
                <span>Trend <strong style={{ color: trend_direction === 'rising' ? '#f87171' : '#4ade80' }}>
                  {trend_direction === 'rising' ? '↑' : '↓'} {trend_direction}
                </strong></span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={forecastData} margin={{ top: 24, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="aqi-dark-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <Area type="monotone" dataKey="aqi" stroke="#60a5fa" fill="url(#aqi-dark-grad)"
                    strokeWidth={2.5} dot={<DotLabel stroke="#60a5fa" />} activeDot={{ r: 7 }} />
                  <XAxis dataKey="hour" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: '#1e3060', border: 'none', borderRadius: 8, fontSize: 13, color: '#e2e8f0' }} formatter={(v) => [`AQI ${v}`, '']} />
                </AreaChart>
              </ResponsiveContainer>
              <p className="dcc-footer">⊙ Model confidence {trend_confidence}% · Random Forest + LSTM ensemble</p>
            </div>

            {pm25Data.length > 0 && (
              <div className="dark-chart-card">
                <div className="dcc-header">
                  <div className="dcc-accent" style={{ background: '#a78bfa' }} />
                  <span className="dcc-title">6-HOUR PM2.5 FORECAST (µG/M³)</span>
                </div>
                <div className="dcc-stats">
                  <span>Peak <strong>{peakPm.toFixed(1)}</strong></span>
                  <span className="dcc-sep">·</span>
                  <span>Low <strong>{lowPm.toFixed(1)}</strong></span>
                  <span className="dcc-sep">·</span>
                  <span>WHO limit <strong>15</strong></span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={pm25Data} margin={{ top: 24, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pm25-dark-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <Area type="monotone" dataKey="pm25" stroke="#a78bfa" fill="url(#pm25-dark-grad)"
                      strokeWidth={2.5} dot={<DotLabel stroke="#a78bfa" />} activeDot={{ r: 7 }} />
                    <XAxis dataKey="hour" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ background: '#1e3060', border: 'none', borderRadius: 8, fontSize: 13, color: '#e2e8f0' }} formatter={(v) => [`${v} µg/m³`, 'PM2.5']} />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="dcc-footer">
                  ⊙ {peakPm < 15 ? 'All predicted values remain far below the WHO 24-hour guideline' : 'Values approach the WHO 24-hour guideline of 15 µg/m³'}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

    </div>
  )
}

function MetricBox({ label, val, unit }) {
  return (
    <div className="metric-box">
      <span className="metric-label">{label}</span>
      <span className="metric-val">{val} <small className="metric-unit">{unit}</small></span>
    </div>
  )
}

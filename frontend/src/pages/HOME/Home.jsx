import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { fetchAll, fetchRecommendation } from '../../services/api'
import { getAQIColor, getAQICategory, SENSOR_NODES } from '../../utils/aqi'
import './Home.css'

export default function Home() {
  const [predictions, setPredictions]     = useState(null)
  const [advice, setAdvice]               = useState('')
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [search, setSearch]               = useState('')
  const [suggestions, setSuggestions]     = useState([])
  const [selectedNode, setSelectedNode]   = useState(null)

  /* Load predictions once on mount */
  useEffect(() => {
    fetchAll()
      .then((r) => setPredictions(r.data))
      .catch(() => setError('Cannot reach the backend API. Make sure it is running on port 8000.'))
      .finally(() => setLoading(false))
  }, [])

  /* Load AI advice after predictions arrive */
  useEffect(() => {
    if (!predictions) return
    setAdviceLoading(true)
    fetchRecommendation()
      .then((r) => {
        /* Show only the first paragraph, stripped of markdown stars */
        const full = r.data.advice.replace(/\*\*/g, '')
        const para = full.split('\n\n')[0]
        setAdvice(para.length > 260 ? para.slice(0, 260) + '…' : para)
      })
      .catch(() =>
        setAdvice('Visit the Health Guidance page for detailed recommendations based on the current air quality.')
      )
      .finally(() => setAdviceLoading(false))
  }, [predictions])

  /* Location search */
  const handleSearch = (e) => {
    const val = e.target.value
    setSearch(val)
    setSuggestions(
      val.length > 0
        ? SENSOR_NODES.filter((n) => n.name.toLowerCase().includes(val.toLowerCase()))
        : []
    )
  }

  const selectNode = (node) => {
    setSelectedNode(node)
    setSearch(node.name)
    setSuggestions([])
  }

  /* ── Render states ── */
  if (loading)       return <LoadingScreen />
  if (error)         return <ErrorScreen message={error} />

  const { current_aqi, trend_direction, trend_confidence, forecast_6h, pm25_forecast_6h, pollutants } = predictions
  const aqiColor    = getAQIColor(current_aqi)
  const aqiCategory = getAQICategory(current_aqi)

  /* Build forecast chart data — "Now" + next 6 hours */
  const forecastData = [
    { hour: 'Now', aqi: Math.round(current_aqi) },
    ...forecast_6h.map((v, i) => ({ hour: `+${i + 1}h`, aqi: Math.round(v) })),
  ]

  const pm25ForecastData = pm25_forecast_6h
    ? [
        { hour: 'Now', pm25: pollutants.pm25 },
        ...pm25_forecast_6h.map((v, i) => ({ hour: `+${i + 1}h`, pm25: Math.round(v * 10) / 10 })),
      ]
    : null

  return (
    <div className="home">
      {/* ── HERO ── */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">🌍 Dar es Salaam, Tanzania</div>
          <h1 className="hero-title">
            Breathe Smarter.<br />
            <span className="hero-accent">Live Safer.</span>
          </h1>
          <p className="hero-sub">
            Real-time air quality monitoring powered by AI — know your environment
            before you step outside.
          </p>

          {/* Location search */}
          <div className="search-wrap">
            <div className="search-bar">
              <span className="search-icon">📍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search a sensor location (e.g. Land Building…)"
                value={search}
                onChange={handleSearch}
              />
              {search && (
                <button className="search-clear" onClick={() => { setSearch(''); setSuggestions([]); setSelectedNode(null) }}>
                  ✕
                </button>
              )}
            </div>
            {suggestions.length > 0 && (
              <ul className="search-dropdown">
                {suggestions.map((n) => (
                  <li key={n.id} onClick={() => selectNode(n)}>
                    <span className="sug-icon">📡</span>
                    <div>
                      <strong>{n.name}</strong>
                      <small>{n.description}</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedNode && (
            <p className="selected-node-label">
              Showing data for <strong>{selectedNode.name}</strong> —{' '}
              {selectedNode.description}
            </p>
          )}
        </div>
      </section>

      {/* ── MAIN CARDS GRID ── */}
      <div className="home-grid">
        {/* AQI card */}
        <div className="glass-card aqi-card">
          <div className="card-title">Current Air Quality</div>

          {/* Pulsing AQI circle */}
          <div className="aqi-circle-wrap">
            <div
              className="aqi-circle"
              style={{
                '--aqi-color': aqiColor,
                borderColor: aqiColor,
                boxShadow: `0 0 40px ${aqiColor}40, 0 0 80px ${aqiColor}18`,
              }}
            >
              <span className="aqi-number" style={{ color: aqiColor }}>
                {Math.round(current_aqi)}
              </span>
              <span className="aqi-unit">AQI</span>
            </div>
            <div
              className="aqi-badge"
              style={{ background: `${aqiColor}18`, color: aqiColor, border: `1px solid ${aqiColor}35` }}
            >
              {aqiCategory}
            </div>
          </div>

          {/* Trend */}
          <div className={`trend-pill ${trend_direction}`}>
            {trend_direction === 'rising' ? '↑' : '↓'}&nbsp;
            {trend_direction} · {trend_confidence}% confidence
          </div>

          {/* Pollutant chips */}
          <div className="chip-row">
            {pollutants.pm25 > 0 && <Chip label="PM2.5" val={pollutants.pm25} unit="µg/m³" />}
            {pollutants.pm10 > 0 && <Chip label="PM10"  val={pollutants.pm10} unit="µg/m³" />}
            <Chip label="Humidity"    val={pollutants.humidity}    unit="%" />
            <Chip label="Temperature" val={pollutants.temperature} unit="°C" />
          </div>
        </div>

        {/* AI recommendation card */}
        <div className="glass-card rec-card">
          <div className="card-title">AI Recommendation</div>

          {adviceLoading ? (
            <div className="advice-loading">
              <div className="pulse-dot" />
              <span>AI is analysing air quality data…</span>
            </div>
          ) : (
            <p className="advice-text">{advice}</p>
          )}

          <div className="rec-footer">
            <Link to="/health-guidance" className="rec-link">
              View full health guidance →
            </Link>
            <Link to="/map" className="rec-link">
              Explore sensor map →
            </Link>
          </div>
        </div>
      </div>

      {/* ── FORECAST STRIP ── */}
      <div className="glass-card forecast-card">
        <div className="card-title">6-Hour AQI Forecast</div>
        <ResponsiveContainer width="100%" height={130}>
          <AreaChart data={forecastData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="forecast-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={aqiColor} stopOpacity={0.35} />
                <stop offset="95%" stopColor={aqiColor} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="aqi"
              stroke={aqiColor}
              fill="url(#forecast-grad)"
              strokeWidth={2.5}
              dot={{ r: 5, fill: aqiColor, stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 7 }}
            />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 12, fill: '#4a6fa5', fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(255,255,255,0.85)',
                border: '1px solid rgba(255,255,255,0.5)',
                borderRadius: 12,
                backdropFilter: 'blur(10px)',
                fontSize: 13,
                fontWeight: 600,
              }}
              formatter={(v) => [`AQI ${v}`, '']}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── PM2.5 FORECAST (Phase 2 — shown when model supports it) ── */}
      {pm25ForecastData && (
        <div className="glass-card forecast-card">
          <div className="card-title">6-Hour PM2.5 Forecast <span style={{ fontSize: 12, color: '#66bb6a', fontWeight: 600 }}>NEW</span></div>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={pm25ForecastData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="pm25-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#e74c3c" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#e74c3c" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="pm25"
                stroke="#e74c3c"
                fill="url(#pm25-grad)"
                strokeWidth={2.5}
                dot={{ r: 5, fill: '#e74c3c', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 7 }}
              />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 12, fill: '#4a6fa5', fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(255,255,255,0.85)',
                  border: '1px solid rgba(255,255,255,0.5)',
                  borderRadius: 12,
                  backdropFilter: 'blur(10px)',
                  fontSize: 13,
                  fontWeight: 600,
                }}
                formatter={(v) => [`${v} µg/m³`, 'PM2.5']}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── SENSOR NODES STRIP ── */}
      <div className="nodes-strip">
        {SENSOR_NODES.map((node) => (
          <div key={node.id} className="glass-card node-card">
            <span className="node-icon">📡</span>
            <div>
              <strong>{node.name}</strong>
              <small>{node.description}</small>
            </div>
            <div
              className="node-aqi-badge"
              style={{ background: `${aqiColor}18`, color: aqiColor }}
            >
              AQI {Math.round(current_aqi)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Chip({ label, val, unit }) {
  return (
    <div className="pollutant-chip">
      <span className="chip-label">{label}</span>
      <span className="chip-val">{val} <small>{unit}</small></span>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="spinner" />
      <p>Loading air quality data…</p>
    </div>
  )
}

function ErrorScreen({ message }) {
  return (
    <div className="error-screen">
      <div className="glass-card error-card">
        <span className="error-icon">⚠️</span>
        <h3>Connection Error</h3>
        <p>{message}</p>
      </div>
    </div>
  )
}

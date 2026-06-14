import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { fetchAll, fetchRecommendation, fetchHistory, clearCache } from '../../services/api'
import { getAQIColor, getAQICategory, AQI_SCALE } from '../../utils/aqi'
import { useAuth } from '../../context/AuthContext'
import './Dashboard.css'

/* ── Sidebar navigation items ── */
const NAV_ITEMS = [
  { id: 'overview',    icon: '◈', label: 'Overview' },
  { id: 'analytics',   icon: '◉', label: 'Analytics' },
  { id: 'predictions', icon: '◐', label: 'Predictions' },
  { id: 'ai-advice',   icon: '◎', label: 'AI Advice' },
  { id: 'alerts',      icon: '◑', label: 'Alerts' },
]

/* Demo alert feed */
const DEMO_ALERTS = [
  { id: 1, sev: 'info',    title: 'Daily Report',   body: "Today's air quality is Good. Safe for all outdoor activities.", time: '2 min ago' },
  { id: 2, sev: 'success', title: 'AQI Improved',   body: 'AQI dropped 8 points over the last hour.', time: '1 hr ago' },
  { id: 3, sev: 'warning', title: 'Moderate Spike', body: 'AQI briefly reached Moderate yesterday at 15:00.', time: '1 day ago' },
  { id: 4, sev: 'info',    title: 'Model Retrained', body: 'ML models were successfully retrained with the latest data.', time: '2 days ago' },
]

/* Recharts custom tooltip */
const GlassTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="tt-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { user, logout }     = useAuth()
  const navigate             = useNavigate()
  const [active, setActive]  = useState('overview')
  const [sideOpen, setSideOpen] = useState(false)

  /* Data state */
  const [predictions, setPredictions]     = useState(null)
  const [advice, setAdvice]               = useState('')
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [history, setHistory]             = useState(null)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [predRes, histRes] = await Promise.all([fetchAll(), fetchHistory()])
      setPredictions(predRes.data)
      setHistory(histRes.data)
    } catch {
      setError('Cannot reach the backend API. Make sure it is running on port 8000.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  /* Load AI advice when predictions are ready */
  useEffect(() => {
    if (!predictions) return
    setAdviceLoading(true)
    fetchRecommendation()
      .then((r) => setAdvice(r.data.advice.replace(/\*\*/g, '')))
      .catch(() => setAdvice(''))
      .finally(() => setAdviceLoading(false))
  }, [predictions])

  /* Force a live fetch by clearing sessionStorage cache first */
  const handleRefresh = () => { clearCache(); loadData() }

  const handleLogout = () => { logout(); navigate('/') }
  const goTo = (id) => { setActive(id); setSideOpen(false) }

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <p>Loading dashboard…</p>
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

  const { current_aqi, trend_direction, trend_confidence, forecast_6h, pollutants } = predictions
  const aqiColor    = getAQIColor(current_aqi)
  const aqiCategory = getAQICategory(current_aqi)

  const forecastData = [
    { hour: 'Now', aqi: Math.round(current_aqi) },
    ...forecast_6h.map((v, i) => ({ hour: `+${i + 1}h`, aqi: Math.round(v) })),
  ]

  const pollutantData = [
    { name: 'PM2.5',   value: pollutants.pm25,        fill: '#e74c3c' },
    { name: 'PM10',    value: pollutants.pm10,         fill: '#e67e22' },
    { name: 'CO2',     value: pollutants.co2,          fill: '#f39c12' },
    { name: 'NO2',     value: pollutants.no2,          fill: '#8e44ad' },
    { name: 'VOC',     value: pollutants.voc,          fill: '#1abc9c' },
    { name: 'Humidity',value: pollutants.humidity,     fill: '#4fc3f7' },
    { name: 'Temp(°C)',value: pollutants.temperature,  fill: '#66bb6a' },
  ].filter((d) => d.value > 0)

  /* Model accuracy history for the Analytics chart */
  const buildModelHistory = (key, metric) =>
    (history?.[key] || [])
      .slice(-8)
      .map((entry, i) => ({
        run: `Run ${i + 1}`,
        [key]: typeof entry.metrics[metric] === 'number'
          ? Math.round(entry.metrics[metric] * 100) / 100
          : null,
      }))

  return (
    <div className="dashboard">
      {/* Backdrop overlay — closes sidebar when tapped on mobile */}
      {sideOpen && (
        <div className="sidebar-overlay" onClick={() => setSideOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${sideOpen ? 'open' : ''}`}>
        <div className="sb-top">
          <div className="sb-user">
            <div className="sb-avatar">{user?.username?.[0]?.toUpperCase()}</div>
            <div>
              <p className="sb-username">{user?.username}</p>
              <p className="sb-role">{user?.role}</p>
            </div>
          </div>

          <nav className="sb-nav">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                className={`sb-item ${active === item.id ? 'active' : ''}`}
                onClick={() => goTo(item.id)}
              >
                <span className="sb-icon">{item.icon}</span>
                <span className="sb-label">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="sb-bottom">
          <button className="sb-refresh" onClick={handleRefresh}>
            ↻ Refresh Data
          </button>
          <button className="sb-logout" onClick={handleLogout}>
            ⎋ Logout
          </button>
        </div>
      </aside>

      {/* Mobile sidebar toggle */}
      <button className="mob-toggle" onClick={() => setSideOpen(!sideOpen)}>
        {sideOpen ? '✕' : '☰'}
      </button>

      {/* ── Main content ── */}
      <main className="dash-main">
        <header className="dash-header">
          <div>
            <h1 className="dash-page-title">
              {NAV_ITEMS.find((n) => n.id === active)?.label}
            </h1>
            <p className="dash-date">{new Date().toLocaleString()}</p>
          </div>
        </header>

        {/* ═══════════ OVERVIEW ═══════════ */}
        {active === 'overview' && (
          <section className="overview">
            {/* Summary stat cards */}
            <div className="stat-grid">
              <StatCard label="Current AQI"    value={Math.round(current_aqi)} sub={aqiCategory}    color={aqiColor}   icon="🌡️" />
              <StatCard label="PM2.5"          value={`${pollutants.pm25} µg/m³`}  sub="Fine particles"  color="#e74c3c" icon="💨" />
              <StatCard label="PM10"           value={`${pollutants.pm10} µg/m³`}  sub="Coarse particles" color="#e67e22" icon="🌫️" />
              <StatCard label="Humidity"       value={`${pollutants.humidity}%`}   sub="Relative humidity" color="#4fc3f7" icon="💧" />
              <StatCard label="Temperature"    value={`${pollutants.temperature}°C`} sub="Ambient"       color="#66bb6a" icon="🌡️" />
              <StatCard
                label="Trend"
                value={trend_direction === 'rising' ? '↑ Rising' : '↓ Falling'}
                sub={`${trend_confidence}% confidence`}
                color={trend_direction === 'rising' ? '#e74c3c' : '#27ae60'}
                icon="📈"
              />
            </div>

            {/* Mini forecast */}
            <div className="glass-card overview-forecast">
              <div className="card-title">6-Hour AQI Forecast</div>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={forecastData}>
                  <defs>
                    <linearGradient id="ov-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={aqiColor} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={aqiColor} stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="aqi" stroke={aqiColor} fill="url(#ov-grad)"
                    strokeWidth={2.5} dot={{ r: 4, fill: aqiColor, stroke: '#fff', strokeWidth: 2 }} />
                  <XAxis dataKey="hour" tick={{ fontSize: 12, fill: '#4a6fa5' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<GlassTooltip />} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* ═══════════ ANALYTICS ═══════════ */}
        {active === 'analytics' && (
          <section className="analytics">
            {/* Pollutant levels */}
            <div className="glass-card chart-card">
              <div className="card-title">Current Pollutant Levels</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={pollutantData} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.25)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#4a6fa5' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6a8faf' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<GlassTooltip />} />
                  <Bar dataKey="value" name="Level" radius={[6, 6, 0, 0]}>
                    {pollutantData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Regression model R2 history */}
            {history?.regression?.length > 0 && (
              <div className="glass-card chart-card">
                <div className="card-title">Regression Model R² History</div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={buildModelHistory('regression', 'r2')}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.25)" />
                    <XAxis dataKey="run" tick={{ fontSize: 12, fill: '#4a6fa5' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#6a8faf' }} axisLine={false} tickLine={false} domain={[0, 1]} />
                    <Tooltip content={<GlassTooltip />} />
                    <Line type="monotone" dataKey="regression" stroke="#4fc3f7" strokeWidth={2.5}
                      dot={{ r: 4, fill: '#4fc3f7', stroke: '#fff', strokeWidth: 2 }} name="R²" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Trend model accuracy history */}
            {history?.trend?.length > 0 && (
              <div className="glass-card chart-card">
                <div className="card-title">Trend Model Accuracy History</div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={buildModelHistory('trend', 'accuracy')}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.25)" />
                    <XAxis dataKey="run" tick={{ fontSize: 12, fill: '#4a6fa5' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#6a8faf' }} axisLine={false} tickLine={false} domain={[0, 1]} />
                    <Tooltip content={<GlassTooltip />} />
                    <Line type="monotone" dataKey="trend" stroke="#66bb6a" strokeWidth={2.5}
                      dot={{ r: 4, fill: '#66bb6a', stroke: '#fff', strokeWidth: 2 }} name="Accuracy" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        )}

        {/* ═══════════ PREDICTIONS ═══════════ */}
        {active === 'predictions' && (
          <section className="predictions">
            {/* Trend indicator */}
            <div className="glass-card trend-summary">
              <div className="card-title">Trend Prediction</div>
              <div className="trend-content">
                <div
                  className={`trend-arrow ${trend_direction}`}
                  style={{ color: trend_direction === 'rising' ? '#e74c3c' : '#27ae60' }}
                >
                  {trend_direction === 'rising' ? '↑' : '↓'}
                </div>
                <div>
                  <p className="trend-label" style={{ color: trend_direction === 'rising' ? '#e74c3c' : '#27ae60' }}>
                    AQI is {trend_direction}
                  </p>
                  <p className="trend-conf">
                    Model confidence: <strong>{trend_confidence}%</strong>
                  </p>
                  <p className="trend-tip">
                    {trend_direction === 'rising'
                      ? 'Air quality may worsen. Consider reducing outdoor activity.'
                      : 'Air quality is expected to improve. Good time for outdoor activities.'}
                  </p>
                </div>
              </div>
            </div>

            {/* 6-hour AQI forecast area chart */}
            <div className="glass-card chart-card">
              <div className="card-title">6-Hour AQI Forecast</div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={forecastData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pred-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={aqiColor} stopOpacity={0.40} />
                      <stop offset="95%" stopColor={aqiColor} stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.25)" />
                  <Area type="monotone" dataKey="aqi" stroke={aqiColor} fill="url(#pred-grad)"
                    strokeWidth={2.5} dot={{ r: 6, fill: aqiColor, stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 8 }} />
                  <XAxis dataKey="hour" tick={{ fontSize: 13, fill: '#4a6fa5' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#6a8faf' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<GlassTooltip />} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Forecast hour-by-hour breakdown */}
            <div className="glass-card chart-card">
              <div className="card-title">Hour-by-Hour Breakdown</div>
              <div className="hour-grid">
                {forecastData.map((d) => {
                  const c = getAQIColor(d.aqi)
                  return (
                    <div key={d.hour} className="hour-chip" style={{ borderColor: c }}>
                      <span className="hour-label">{d.hour}</span>
                      <span className="hour-aqi" style={{ color: c }}>{d.aqi}</span>
                      <span className="hour-cat" style={{ color: c }}>{getAQICategory(d.aqi)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* ═══════════ AI ADVICE ═══════════ */}
        {active === 'ai-advice' && (
          <section className="ai-advice-section">
            <div className="glass-card ai-full-card">
              <div className="card-title">AI Health Analysis — Live</div>

              <div className="ai-meta">
                <span className="ai-aqi-badge" style={{ background: `${aqiColor}18`, color: aqiColor }}>
                  AQI {Math.round(current_aqi)} — {aqiCategory}
                </span>
                <span className="ai-timestamp">{new Date().toLocaleString()}</span>
              </div>

              {adviceLoading ? (
                <div className="advice-loading" style={{ padding: '40px 0' }}>
                  <div className="pulse-dot" />
                  <span>Groq AI is generating detailed health analysis…</span>
                </div>
              ) : advice ? (
                <div className="ai-body">
                  {advice.split('\n\n').filter(Boolean).map((para, i) => {
                    /* Detect heading lines (all-caps or ending with ':') */
                    const isHeading = para.trim().endsWith(':') || para.length < 60
                    return isHeading ? (
                      <h3 key={i} className="ai-heading">{para.trim()}</h3>
                    ) : (
                      <p key={i} className="ai-para">{para}</p>
                    )
                  })}
                </div>
              ) : (
                <p style={{ color: '#6a8faf' }}>
                  AI advice is unavailable. Please ensure GROQ_API_KEY is set in the backend .env file.
                </p>
              )}
            </div>

            {/* Pollutant summary alongside */}
            <div className="glass-card pollutant-summary-card">
              <div className="card-title">Live Readings Used by AI</div>
              {[
                { label: 'AQI',         val: Math.round(current_aqi),       color: aqiColor },
                { label: 'PM2.5 µg/m³', val: pollutants.pm25,              color: '#e74c3c' },
                { label: 'PM10 µg/m³',  val: pollutants.pm10,              color: '#e67e22' },
                { label: 'CO2 ppm',     val: pollutants.co2,               color: '#f39c12' },
                { label: 'NOₓ (NO2)',   val: pollutants.no2,               color: '#8e44ad' },
                { label: 'VOC',         val: pollutants.voc,               color: '#1abc9c' },
                { label: 'Humidity %',  val: pollutants.humidity,          color: '#4fc3f7' },
                { label: 'Temp °C',     val: pollutants.temperature,       color: '#66bb6a' },
              ].map((r) => (
                <div key={r.label} className="pollutant-row">
                  <span className="pr-label">{r.label}</span>
                  <span className="pr-val" style={{ color: r.color }}>{r.val}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════ ALERTS ═══════════ */}
        {active === 'alerts' && (
          <section className="alerts-section">
            <div className="alerts-list">
              {DEMO_ALERTS.map((a) => (
                <div key={a.id} className={`glass-card alert-card sev-${a.sev}`}>
                  <span className="alert-icon">{
                    a.sev === 'info'    ? 'ℹ️' :
                    a.sev === 'success' ? '✅' :
                    a.sev === 'warning' ? '⚠️' : '🔴'
                  }</span>
                  <div className="alert-body">
                    <strong className="alert-title">{a.title}</strong>
                    <p className="alert-msg">{a.body}</p>
                  </div>
                  <span className="alert-time">{a.time}</span>
                </div>
              ))}
            </div>

            <div className="glass-card alert-settings-card">
              <div className="card-title">Alert Thresholds</div>
              <p className="alert-hint">
                Future release: configure custom AQI thresholds that trigger SMS or email alerts.
              </p>
              {AQI_SCALE.slice(1).map((s) => (
                <div key={s.label} className="threshold-row">
                  <span className="thr-dot" style={{ background: s.color }} />
                  <span className="thr-label">{s.label}</span>
                  <span className="thr-range">{s.range}</span>
                  <span className="thr-coming">Soon</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div className="glass-card stat-card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  )
}

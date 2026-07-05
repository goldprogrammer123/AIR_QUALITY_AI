import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  fetchAll, fetchRecommendation, fetchSensorHistory, clearCache,
} from '../../services/api'
import { getAQIColor, getAQICategory, AQI_SCALE } from '../../utils/aqi'
import { useAuth } from '../../context/AuthContext'
import './Dashboard.css'

const NAV_ITEMS = [
  { id: 'overview',    icon: '⌂',  label: 'Overview'    },
  { id: 'analytics',   icon: '◉',  label: 'Analytics'   },
  { id: 'predictions', icon: '◐',  label: 'Predictions' },
  { id: 'ai-advice',   icon: '◎',  label: 'AI Advice'   },
  { id: 'alerts',      icon: '◑',  label: 'Alerts'      },
]

const DEMO_ALERTS = [
  { id: 1, sev: 'info',    title: 'Daily Report',    body: "Today's air quality is Good. Safe for all outdoor activities.", time: '2 min ago'  },
  { id: 2, sev: 'success', title: 'AQI Improved',    body: 'AQI dropped 8 points over the last hour.',                    time: '1 hr ago'   },
  { id: 3, sev: 'warning', title: 'Moderate Spike',  body: 'AQI briefly reached Moderate yesterday at 15:00.',            time: '1 day ago'  },
  { id: 4, sev: 'info',    title: 'Model Retrained', body: 'ML models were successfully retrained with the latest data.', time: '2 days ago' },
]

const PERIOD_OPTIONS = [
  { label: 'Last 24 Hours', hours: 24  },
  { label: 'Last 7 Days',   hours: 168 },
  { label: 'Last 14 Days',  hours: 336 },
  { label: 'Last 30 Days',  hours: 720 },
]

function fmtTime(ts, hours) {
  const d = new Date(ts)
  if (hours <= 24)  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (hours <= 168) return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="tt-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  )
}

function aqiDesc(v)      { return v <= 50 ? 'Air quality is satisfactory' : v <= 100 ? 'Air quality is acceptable' : v <= 150 ? 'Unhealthy for sensitive groups' : 'Unhealthy for everyone' }
function pm25Desc(v)     { return v <= 12 ? 'Within safe limits' : v <= 35 ? 'Slightly elevated' : 'Elevated — take precautions' }
function pm10Desc(v)     { return v <= 54 ? 'Moderate levels' : v <= 154 ? 'Elevated — monitor exposure' : 'High — limit outdoor time' }
function humidityDesc(v) { return v < 30 ? 'Low — may feel dry' : v <= 60 ? 'Comfortable' : 'High — feels muggy' }
function tempDesc(v)     { return v < 20 ? 'Cool conditions' : v < 30 ? 'Comfortable conditions' : 'Warm conditions' }

function getSummaryItems(aqi) {
  if (aqi <= 50) return [
    { icon: '🛡️', section: true,  title: 'AIR QUALITY SUMMARY',    desc: 'Overall air quality is satisfactory and poses little or no risk.' },
    { icon: '🌿', section: false, title: 'Enjoy outdoor activities', desc: 'Perfect conditions for outdoor activities.' },
    { icon: '💙', section: true,  title: 'HEALTH RECOMMENDATION',   desc: 'Ideal air quality for everyone.' },
    { icon: '🚶', section: false, title: 'No precautions needed',   desc: 'Enjoy your normal outdoor routine.' },
  ]
  if (aqi <= 100) return [
    { icon: '🛡️', section: true,  title: 'AIR QUALITY SUMMARY',      desc: 'Air quality is acceptable; some pollutants may affect sensitive people.' },
    { icon: '⚠️', section: false, title: 'Sensitive groups take care', desc: 'Reduce prolonged outdoor exertion if unusually sensitive.' },
    { icon: '💙', section: true,  title: 'HEALTH RECOMMENDATION',     desc: 'Most people can carry out normal outdoor activities.' },
    { icon: '😷', section: false, title: 'Light precautions advised',  desc: 'Sensitive individuals may benefit from a light mask.' },
  ]
  if (aqi <= 150) return [
    { icon: '⚠️', section: true,  title: 'AIR QUALITY SUMMARY',   desc: 'Sensitive groups may experience health effects.' },
    { icon: '🏠', section: false, title: 'Limit outdoor exposure',  desc: 'Sensitive people should reduce heavy outdoor activity.' },
    { icon: '💙', section: true,  title: 'HEALTH RECOMMENDATION',  desc: 'Children and elderly should take extra care today.' },
    { icon: '😷', section: false, title: 'Mask recommended',        desc: 'Wear an N95 mask if you go outside.' },
  ]
  return [
    { icon: '🔴', section: true,  title: 'AIR QUALITY SUMMARY',  desc: 'Everyone may experience health effects. Avoid outdoor activity.' },
    { icon: '🏠', section: false, title: 'Stay indoors',          desc: 'Avoid all unnecessary outdoor activity.' },
    { icon: '💙', section: true,  title: 'HEALTH RECOMMENDATION', desc: 'Avoid outdoor exertion. Everyone should take precautions.' },
    { icon: '😷', section: false, title: 'N95 mask required',     desc: 'Wear a proper N95 respirator outdoors.' },
  ]
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [active, setActive]     = useState('overview')
  const [sideOpen, setSideOpen] = useState(false)

  const [allSensors, setAllSensors]       = useState(null)
  const [activeSensor, setActiveSensor]   = useState('lands')
  const [advice, setAdvice]               = useState('')
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)

  const [analyticsView, setAnalyticsView]   = useState('history')
  const [historyPeriod, setHistoryPeriod]   = useState(24)
  const [sensorHistory, setSensorHistory]   = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError]     = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchAll()
      setAllSensors(res.data.sensors)
    } catch {
      setError('Cannot reach the backend API. Make sure it is running on port 8000.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (active !== 'analytics' || analyticsView !== 'history') return
    setHistoryLoading(true)
    setHistoryError(null)
    fetchSensorHistory(historyPeriod)
      .then((r) => setSensorHistory(r.data))
      .catch(() => setHistoryError('Could not load historical data.'))
      .finally(() => setHistoryLoading(false))
  }, [active, analyticsView, historyPeriod])

  useEffect(() => {
    if (!allSensors) return
    setAdviceLoading(true)
    fetchRecommendation()
      .then((r) => setAdvice(r.data.advice.replace(/\*\*/g, '')))
      .catch(() => setAdvice(''))
      .finally(() => setAdviceLoading(false))
  }, [allSensors])

  const handleRefresh = () => { clearCache(); loadData() }
  const handleLogout  = () => { logout(); navigate('/') }
  const goTo = (id)   => { setActive(id); setSideOpen(false) }

  if (loading) return (
    <div className="db-loading"><div className="spinner" /><p>Loading dashboard…</p></div>
  )
  if (error) return (
    <div className="db-error">
      <div className="err-card"><span>⚠️</span><h3>Connection Error</h3><p>{error}</p></div>
    </div>
  )

  const predictions = allSensors?.[activeSensor] ?? {}
  const {
    current_aqi = 0, trend_direction = 'stable', trend_confidence = 0,
    forecast_6h, pm25_forecast_6h, pm10_forecast_6h,
    pollutants = { pm25: 0, pm10: 0, co2: 0, no2: 0, voc: 0, humidity: 0, temperature: 0 },
  } = predictions

  const aqiColor    = getAQIColor(current_aqi)
  const aqiCategory = getAQICategory(current_aqi)
  const trendColor  = trend_direction === 'rising' ? '#e74c3c' : '#27ae60'
  const trendIcon   = trend_direction === 'rising' ? '↑' : '↓'

  const forecastData = [
    { hour: 'Now', aqi: Math.round(current_aqi) },
    ...((forecast_6h || []).map((v, i) => ({ hour: `+${i + 1}h`, aqi: Math.round(v) }))),
  ]
  const avgForecastAqi   = forecast_6h?.length ? Math.round(forecast_6h.reduce((a, b) => a + b, 0) / forecast_6h.length) : current_aqi
  const forecastCategory = getAQICategory(avgForecastAqi)
  const forecastColor    = getAQIColor(avgForecastAqi)

  const pm25ForecastData = (pm25_forecast_6h || []).map((v, i) => ({ hour: `+${i + 1}h`, pm25: Math.round(v) }))
  const pm10ForecastData = (pm10_forecast_6h || []).map((v, i) => ({ hour: `+${i + 1}h`, pm10: Math.round(v) }))

  const historyChartData = sensorHistory?.data?.map((pt) => ({
    time: fmtTime(pt.timestamp, historyPeriod),
    aqi:  pt.aqi  ?? null,
    pm25: pt.pm25 ?? null,
    pm10: pt.pm10 ?? null,
  })) ?? []

  const summaryItems = getSummaryItems(current_aqi)

  return (
    <div className="dashboard">
      {sideOpen && <div className="sidebar-overlay" onClick={() => setSideOpen(false)} />}

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${sideOpen ? 'open' : ''}`}>
        <div className="sb-top">
          <div className="sb-user">
            <div className="sb-avatar">{user?.username?.[0]?.toUpperCase() ?? 'A'}</div>
            <div className="sb-user-info">
              <p className="sb-username">{user?.username ?? 'Admin'}</p>
              <p className="sb-role">{user?.role ?? 'Administrator'}</p>
            </div>
            <span className="sb-caret">▾</span>
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
          <button className="sb-refresh" onClick={handleRefresh}>↻ Refresh Data</button>
          <button className="sb-logout"  onClick={handleLogout}>⎋ Logout</button>
        </div>
      </aside>

      <button className="mob-toggle" onClick={() => setSideOpen(!sideOpen)}>
        {sideOpen ? '✕' : '☰'}
      </button>

      {/* ── Main ── */}
      <main className="dash-main">
        <header className="dash-header">
          <div>
            <h1 className="dash-page-title">
              <span className="title-pulse">⟳</span>
              {NAV_ITEMS.find((n) => n.id === active)?.label}
            </h1>
            <p className="dash-date">Last updated: {new Date().toLocaleString()}</p>
          </div>
          <div className="dash-sensor-tabs">
            {Object.keys(allSensors ?? {}).map((key) => (
              <button
                key={key}
                className={`dash-sensor-tab ${activeSensor === key ? 'active' : ''}`}
                onClick={() => setActiveSensor(key)}
              >
                📡 {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </header>

        <div className="dash-content">

          {/* ═══ OVERVIEW ═══ */}
          {active === 'overview' && (
            <section className="overview">
              <div className="stat-grid-4">
                <StatCard icon="💨" iconBg="#e8f5e9"
                  label="CURRENT AQI" value={Math.round(current_aqi)} valueColor={aqiColor}
                  badge={aqiCategory} badgeBg={`${aqiColor}22`} badgeColor={aqiColor}
                  desc={aqiDesc(current_aqi)} />
                <StatCard icon="💢" iconBg="#fdecea"
                  label="PM2.5" value={`${pollutants.pm25} µg/m³`} valueColor="#e74c3c"
                  badge="Fine particles" badgeBg="#fdecea" badgeColor="#e74c3c"
                  desc={pm25Desc(pollutants.pm25)} />
                <StatCard icon="🌫️" iconBg="#fff3e0"
                  label="PM10" value={`${pollutants.pm10} µg/m³`} valueColor="#e67e22"
                  badge="Coarse particles" badgeBg="#fff3e0" badgeColor="#e67e22"
                  desc={pm10Desc(pollutants.pm10)} />
                <StatCard icon="💧" iconBg="#e3f2fd"
                  label="HUMIDITY" value={`${pollutants.humidity}%`} valueColor="#1976d2"
                  badge="Relative humidity" badgeBg="#e3f2fd" badgeColor="#1976d2"
                  desc={humidityDesc(pollutants.humidity)} />
              </div>

              <div className="stat-grid-2">
                <StatCard icon="🌡️" iconBg="#fff3e0"
                  label="TEMPERATURE" value={`${pollutants.temperature}°C`} valueColor="#f57c00"
                  badge="Ambient" badgeBg="#fff3e0" badgeColor="#f57c00"
                  desc={tempDesc(pollutants.temperature)} />
                <StatCard
                  icon={trend_direction === 'rising' ? '📈' : '📉'}
                  iconBg={trend_direction === 'rising' ? '#fdecea' : '#e8f5e9'}
                  label="TREND"
                  value={`${trendIcon} ${trend_direction.charAt(0).toUpperCase() + trend_direction.slice(1)}`}
                  valueColor={trendColor}
                  badge={`${trend_confidence}% confidence`}
                  badgeBg={`${trendColor}18`} badgeColor={trendColor}
                  desc={trend_direction === 'rising' ? 'AQI worsening' : 'AQI improving'} />
              </div>

              <div className="overview-bottom">
                {/* Forecast chart */}
                <div className="wcard forecast-card">
                  <div className="card-title">📊 6-HOUR AQI FORECAST</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={forecastData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="ov-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={aqiColor} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={aqiColor} stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <Area type="monotone" dataKey="aqi" stroke={aqiColor} fill="url(#ov-grad)"
                        strokeWidth={2.5} dot={{ r: 5, fill: aqiColor, stroke: '#fff', strokeWidth: 2 }}
                        activeDot={{ r: 7 }} name="AQI" />
                      <XAxis dataKey="hour" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="forecast-footer" style={{ background: `${forecastColor}0d`, borderColor: `${forecastColor}40` }}>
                    <span style={{ color: forecastColor, fontWeight: 700 }}>✓</span>
                    <span>
                      Air quality is expected to stay <strong style={{ color: forecastColor }}>{forecastCategory}</strong> over the next 6 hours.
                    </span>
                  </div>
                </div>

                {/* Air Quality Summary */}
                <div className="wcard summary-card">
                  {summaryItems.map((item, i) => (
                    <div key={i} className={`summary-item ${item.section ? 'is-section' : ''}`}>
                      <span className="summary-icon">{item.icon}</span>
                      <div>
                        <p className={item.section ? 'summary-section-title' : 'summary-item-title'}>{item.title}</p>
                        <p className="summary-desc">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ═══ ANALYTICS ═══ */}
          {active === 'analytics' && (
            <section className="analytics">
              <div className="tab-row">
                <button className={`tab-btn ${analyticsView === 'history'  ? 'active' : ''}`} onClick={() => setAnalyticsView('history')}>📊 History</button>
                <button className={`tab-btn ${analyticsView === 'forecast' ? 'active' : ''}`} onClick={() => setAnalyticsView('forecast')}>🔮 Forecast</button>
              </div>

              {analyticsView === 'history' && (
                <>
                  <div className="history-controls">
                    <select className="period-select" value={historyPeriod} onChange={(e) => setHistoryPeriod(Number(e.target.value))}>
                      {PERIOD_OPTIONS.map((o) => <option key={o.hours} value={o.hours}>{o.label}</option>)}
                    </select>
                  </div>
                  {historyLoading && <div className="db-loading" style={{ minHeight: 260 }}><div className="spinner" /><p>Loading history…</p></div>}
                  {historyError && !historyLoading && <div className="wcard" style={{ color: '#e74c3c', padding: 32, textAlign: 'center' }}>⚠️ {historyError}</div>}
                  {!historyLoading && !historyError && historyChartData.length > 0 && (
                    <>
                      <div className="wcard chart-card">
                        <div className="card-title">AQI History</div>
                        <ResponsiveContainer width="100%" height={260}>
                          <LineChart data={historyChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTooltip />} />
                            <Line type="monotone" dataKey="aqi" stroke={aqiColor} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} name="AQI" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="wcard chart-card">
                        <div className="card-title">PM2.5 History (µg/m³)</div>
                        <ResponsiveContainer width="100%" height={220}>
                          <LineChart data={historyChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTooltip />} />
                            <Line type="monotone" dataKey="pm25" stroke="#e74c3c" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} name="PM2.5 µg/m³" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                </>
              )}

              {analyticsView === 'forecast' && (
                <>
                  <div className="wcard chart-card">
                    <div className="card-title">6-Hour AQI Forecast</div>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={forecastData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <defs><linearGradient id="fc-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={aqiColor} stopOpacity={0.4} /><stop offset="95%" stopColor={aqiColor} stopOpacity={0.03} /></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <Area type="monotone" dataKey="aqi" stroke={aqiColor} fill="url(#fc-grad)" strokeWidth={2.5} dot={{ r: 5, fill: aqiColor, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 7 }} name="AQI" />
                        <XAxis dataKey="hour" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  {pm25ForecastData.length > 0 && (
                    <div className="wcard chart-card">
                      <div className="card-title">6-Hour PM2.5 Forecast (µg/m³)</div>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={pm25ForecastData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <defs><linearGradient id="pm25-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#e74c3c" stopOpacity={0.35} /><stop offset="95%" stopColor="#e74c3c" stopOpacity={0.03} /></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <Area type="monotone" dataKey="pm25" stroke="#e74c3c" fill="url(#pm25-grad)" strokeWidth={2.5} dot={{ r: 4, fill: '#e74c3c', stroke: '#fff', strokeWidth: 2 }} name="PM2.5 µg/m³" />
                          <XAxis dataKey="hour" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <Tooltip content={<ChartTooltip />} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {pm10ForecastData.length > 0 && (
                    <div className="wcard chart-card">
                      <div className="card-title">6-Hour PM10 Forecast (µg/m³)</div>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={pm10ForecastData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <defs><linearGradient id="pm10-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#e67e22" stopOpacity={0.35} /><stop offset="95%" stopColor="#e67e22" stopOpacity={0.03} /></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <Area type="monotone" dataKey="pm10" stroke="#e67e22" fill="url(#pm10-grad)" strokeWidth={2.5} dot={{ r: 4, fill: '#e67e22', stroke: '#fff', strokeWidth: 2 }} name="PM10 µg/m³" />
                          <XAxis dataKey="hour" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <Tooltip content={<ChartTooltip />} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {/* ═══ PREDICTIONS ═══ */}
          {active === 'predictions' && (
            <section className="predictions">
              <div className="wcard trend-card">
                <div className="card-title">Trend Prediction</div>
                <div className="trend-content">
                  <div className="trend-arrow" style={{ color: trendColor }}>{trendIcon}</div>
                  <div>
                    <p className="trend-label" style={{ color: trendColor }}>AQI is {trend_direction}</p>
                    <p className="trend-conf">Model confidence: <strong>{trend_confidence}%</strong></p>
                    <p className="trend-tip">
                      {trend_direction === 'rising'
                        ? 'Air quality may worsen. Consider reducing outdoor activity.'
                        : 'Air quality is expected to improve. Good time for outdoor activities.'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="wcard chart-card">
                <div className="card-title">6-Hour AQI Forecast</div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={forecastData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs><linearGradient id="pred-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={aqiColor} stopOpacity={0.4} /><stop offset="95%" stopColor={aqiColor} stopOpacity={0.03} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <Area type="monotone" dataKey="aqi" stroke={aqiColor} fill="url(#pred-grad)" strokeWidth={2.5} dot={{ r: 5, fill: aqiColor, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 7 }} />
                    <XAxis dataKey="hour" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {pm25ForecastData.length > 0 && (
                <div className="wcard chart-card">
                  <div className="card-title">📍 6-Hour PM2.5 Forecast (µg/m³)</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={pm25ForecastData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="pred-pm25-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#e74c3c" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#e74c3c" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <Area type="monotone" dataKey="pm25" stroke="#e74c3c" fill="url(#pred-pm25-grad)"
                        strokeWidth={2.5} dot={{ r: 5, fill: '#e74c3c', stroke: '#fff', strokeWidth: 2 }}
                        activeDot={{ r: 7 }} name="PM2.5 µg/m³" />
                      <XAxis dataKey="hour" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {pm10ForecastData.length > 0 && (
                <div className="wcard chart-card">
                  <div className="card-title">📍 6-Hour PM10 Forecast (µg/m³)</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={pm10ForecastData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="pred-pm10-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#e67e22" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#e67e22" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <Area type="monotone" dataKey="pm10" stroke="#e67e22" fill="url(#pred-pm10-grad)"
                        strokeWidth={2.5} dot={{ r: 5, fill: '#e67e22', stroke: '#fff', strokeWidth: 2 }}
                        activeDot={{ r: 7 }} name="PM10 µg/m³" />
                      <XAxis dataKey="hour" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="wcard chart-card">
                <div className="card-title">Hourly AQI Breakdown</div>
                <div className="hour-grid">
                  {forecastData.map((d) => {
                    const c = getAQIColor(d.aqi)
                    return (
                      <div key={d.hour} className="hour-chip" style={{ borderColor: c }}>
                        <span className="hour-label">{d.hour}</span>
                        <span className="hour-aqi"  style={{ color: c }}>{d.aqi}</span>
                        <span className="hour-cat"  style={{ color: c }}>{getAQICategory(d.aqi)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          )}

          {/* ═══ AI ADVICE ═══ */}
          {active === 'ai-advice' && (
            <section className="ai-section">
              <div className="wcard ai-main-card">
                <div className="card-title">AI Health Analysis — Live</div>
                <div className="ai-meta">
                  <span className="ai-badge" style={{ background: `${aqiColor}18`, color: aqiColor }}>
                    AQI {Math.round(current_aqi)} — {aqiCategory}
                  </span>
                  <span className="ai-ts">{new Date().toLocaleString()}</span>
                </div>
                {adviceLoading ? (
                  <div className="advice-loading"><div className="pulse-dot" /><span>Groq AI is generating health analysis…</span></div>
                ) : advice ? (
                  <div className="ai-body">
                    {advice.split('\n\n').filter(Boolean).map((para, i) => {
                      const isHead = para.trim().endsWith(':') || para.length < 60
                      return isHead
                        ? <h3 key={i} className="ai-heading">{para.trim()}</h3>
                        : <p  key={i} className="ai-para">{para}</p>
                    })}
                  </div>
                ) : (
                  <p style={{ color: '#94a3b8', fontSize: 14 }}>AI advice unavailable. Ensure GROQ_API_KEY is set in the backend .env file.</p>
                )}
              </div>
              <div className="wcard ai-readings-card">
                <div className="card-title">Live Readings Used by AI</div>
                {[
                  { label: 'AQI',         val: Math.round(current_aqi),  color: aqiColor  },
                  { label: 'PM2.5 µg/m³', val: pollutants.pm25,          color: '#e74c3c' },
                  { label: 'PM10 µg/m³',  val: pollutants.pm10,          color: '#e67e22' },
                  { label: 'CO2 ppm',     val: pollutants.co2,           color: '#f39c12' },
                  { label: 'NOₓ (NO2)',   val: pollutants.no2,           color: '#8e44ad' },
                  { label: 'Humidity %',  val: pollutants.humidity,      color: '#1976d2' },
                  { label: 'Temp °C',     val: pollutants.temperature,   color: '#66bb6a' },
                ].map((r) => (
                  <div key={r.label} className="reading-row">
                    <span className="reading-label">{r.label}</span>
                    <span className="reading-val" style={{ color: r.color }}>{r.val}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ═══ ALERTS ═══ */}
          {active === 'alerts' && (
            <section className="alerts-section">
              <div className="alerts-list">
                {DEMO_ALERTS.map((a) => (
                  <div key={a.id} className={`wcard alert-card sev-${a.sev}`}>
                    <span className="alert-icon">{a.sev === 'info' ? 'ℹ️' : a.sev === 'success' ? '✅' : a.sev === 'warning' ? '⚠️' : '🔴'}</span>
                    <div className="alert-body">
                      <strong className="alert-title">{a.title}</strong>
                      <p className="alert-msg">{a.body}</p>
                    </div>
                    <span className="alert-time">{a.time}</span>
                  </div>
                ))}
              </div>
              <div className="wcard alert-settings">
                <div className="card-title">Alert Thresholds</div>
                <p className="alert-hint">Future release: configure custom AQI thresholds that trigger SMS or email alerts.</p>
                {AQI_SCALE.slice(1).map((s) => (
                  <div key={s.label} className="threshold-row">
                    <span className="thr-dot" style={{ background: s.color }} />
                    <span className="thr-label">{s.label}</span>
                    <span className="thr-range">{s.range}</span>
                    <span className="thr-soon">Soon</span>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      </main>
    </div>
  )
}

function StatCard({ icon, iconBg, label, value, valueColor, badge, badgeBg, badgeColor, desc }) {
  return (
    <div className="stat-card">
      <div className="sc-header">
        <div className="sc-icon-wrap" style={{ background: iconBg }}>{icon}</div>
        <span className="sc-label">{label}</span>
      </div>
      <div className="sc-value" style={{ color: valueColor }}>{value}</div>
      <span className="sc-badge" style={{ background: badgeBg, color: badgeColor }}>{badge}</span>
      <p className="sc-desc">{desc}</p>
    </div>
  )
}

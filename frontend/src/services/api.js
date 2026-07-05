import axios from 'axios'

/*
  In development Vite proxies /api/* → http://localhost:8000/*,
  so the browser never makes a cross-origin request.
  In production, set VITE_API_URL to your deployed API base URL.
*/
const BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL   // production: absolute URL
  : '/api'                          // development: Vite proxy

const API = axios.create({
  baseURL: BASE,
  timeout: 35000,
})

/* ─── sessionStorage TTL cache ───────────────────────────────────────────
   Stores API responses in sessionStorage so navigating between pages
   returns instantly. Cache is cleared automatically when the tab closes.
   Keys: "aq_cache_<endpoint>", value: { data, expiry }
*/
function _fromCache(key) {
  try {
    const raw = sessionStorage.getItem(`aq_cache_${key}`)
    if (!raw) return null
    const { data, expiry } = JSON.parse(raw)
    if (Date.now() > expiry) {
      sessionStorage.removeItem(`aq_cache_${key}`)
      return null
    }
    return { data }
  } catch {
    return null
  }
}

function _toCache(key, data, ttlMs) {
  try {
    sessionStorage.setItem(
      `aq_cache_${key}`,
      JSON.stringify({ data, expiry: Date.now() + ttlMs })
    )
  } catch {
    // sessionStorage full or unavailable — just skip caching
  }
}

async function _cached(key, ttlMs, fn) {
  const hit = _fromCache(key)
  if (hit) return hit               // shape matches axios response: { data }
  const res = await fn()
  _toCache(key, res.data, ttlMs)
  return res
}

/* All sensors, all models — returns { sensors: { lands: {...}, planning: {...} } } */
export const fetchAll = () =>
  _cached('predict_all', 5 * 60 * 1000, () => API.get('/predict/all'))

/* Single sensor — 'lands' or 'planning' */
export const fetchSensor = (sensor) =>
  _cached(`predict_${sensor}`, 5 * 60 * 1000, () => API.get(`/predict/sensor/${sensor}`))

/* LLM health advice — hits Groq, cached for 10 minutes */
export const fetchRecommendation = () =>
  _cached('recommend', 10 * 60 * 1000, () => API.get('/recommend/'))

/* Full training history — cached for 5 minutes */
export const fetchHistory = () =>
  _cached('history', 5 * 60 * 1000, () => API.get('/history/metrics'))

/* Sensor history — hours: 24 | 168 | 336 | 720. Cached per period (5 min). */
export const fetchSensorHistory = (hours = 24) =>
  _cached(`sensor_history_${hours}`, 5 * 60 * 1000, () =>
    API.get(`/history/sensor?hours=${hours}`)
  )

/* Force-clear all cached data and re-fetch (used by Dashboard refresh button) */
export const clearCache = () => {
  [
    'predict_all', 'predict_lands', 'predict_planning',
    'recommend', 'history',
    'sensor_history_24', 'sensor_history_168', 'sensor_history_336', 'sensor_history_720',
  ].forEach(k => sessionStorage.removeItem(`aq_cache_${k}`))
}

/* ─── Auth interceptor ───────────────────────────────────────────────────────
   Attach JWT token to every request when present in localStorage.
*/
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('aqi_token')
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

/* ─── Auth endpoints ─────────────────────────────────────────────────────── */
export const registerUser = (data) => API.post('/auth/register', data)
export const loginUser    = (data) => API.post('/auth/login', data)
export const fetchMe      = ()     => API.get('/auth/me')

/* ─── Admin: model history ───────────────────────────────────────────────── */
export const fetchModelHistory = (range = 'week') =>
  API.get(`/history/metrics?range=${range}`)

export const fetchModelHistoryByModel = (model, range = 'week') =>
  API.get(`/history/metrics/${model}?range=${range}`)

export const downloadModelHistory = (range = 'week') =>
  API.get(`/history/metrics/download?range=${range}`, { responseType: 'blob' })

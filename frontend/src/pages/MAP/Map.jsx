import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { fetchAll } from '../../services/api'
import { getAQIColor, getAQICategory, SENSOR_NODES, AQI_SCALE } from '../../utils/aqi'
import './Map.css'

/* Midpoint between Land Building and Planning Building, Ardhi University */
const DAR_CENTER = [-6.7646, 39.2122]

export default function MapPage() {
  const [predictions, setPredictions] = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)

  useEffect(() => {
    fetchAll()
      .then((r) => setPredictions(r.data))
      .catch(() => setError('Could not reach the backend API.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="map-loading">
      <div className="spinner" />
      <p>Loading sensor data…</p>
    </div>
  )

  if (error) return (
    <div className="map-error">
      <div className="glass-card error-card">
        <span className="error-icon">⚠️</span>
        <h3>Connection Error</h3>
        <p>{error}</p>
      </div>
    </div>
  )

  const { current_aqi, pollutants } = predictions
  const aqiColor    = getAQIColor(current_aqi)
  const aqiCategory = getAQICategory(current_aqi)

  return (
    <div className="map-page">
      {/* Page header */}
      <div className="map-header">
        <div className="map-header-inner">
          <h1 className="map-title">Sensor Map</h1>
          <p className="map-sub">
            General air quality index for Dar es Salaam. Sensor nodes show their
            installation locations. Click a node for details.
          </p>
        </div>

        {/* AQI Legend */}
        <div className="glass-card legend-card">
          <div className="card-title">AQI Legend</div>
          {AQI_SCALE.map((s) => (
            <div key={s.label} className="legend-row">
              <span className="legend-dot" style={{ background: s.color }} />
              <span className="legend-range" style={{ color: s.color }}>{s.label}</span>
              <span className="legend-vals">{s.range}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Leaflet map */}
      <div className="map-container-wrap">
        <MapContainer
          center={DAR_CENTER}
          zoom={17}
          className="leaflet-map"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {SENSOR_NODES.map((node) => (
            <CircleMarker
              key={node.id}
              center={[node.lat, node.lng]}
              radius={22}
              pathOptions={{
                color: aqiColor,
                fillColor: aqiColor,
                fillOpacity: 0.75,
                weight: 3,
              }}
            >
              <Popup className="aqi-popup">
                <div className="popup-inner">
                  <h3 className="popup-title">📡 {node.name}</h3>
                  <p className="popup-desc">{node.description}</p>
                  <div className="popup-aqi" style={{ color: aqiColor }}>
                    <span className="popup-aqi-num">{Math.round(current_aqi)}</span>
                    <span className="popup-aqi-label">AQI</span>
                  </div>
                  <div className="popup-badge" style={{ background: `${aqiColor}20`, color: aqiColor }}>
                    {aqiCategory}
                  </div>
                  <div className="popup-stats">
                    {pollutants.pm25 > 0 && (
                      <div className="popup-stat"><span>PM2.5</span><strong>{pollutants.pm25} µg/m³</strong></div>
                    )}
                    {pollutants.pm10 > 0 && (
                      <div className="popup-stat"><span>PM10</span><strong>{pollutants.pm10} µg/m³</strong></div>
                    )}
                    <div className="popup-stat"><span>Humidity</span><strong>{pollutants.humidity}%</strong></div>
                    <div className="popup-stat"><span>Temperature</span><strong>{pollutants.temperature}°C</strong></div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Sensor node cards below the map */}
      <div className="sensor-cards">
        {SENSOR_NODES.map((node, i) => (
          <div key={node.id} className="glass-card sensor-card">
            <div className="sc-header">
              <span className="sc-icon">📡</span>
              <div>
                <h3 className="sc-name">{node.name}</h3>
                <p className="sc-desc">{node.description}</p>
              </div>
              <div className="sc-status">
                <span className="sc-dot" style={{ background: aqiColor }} />
                Live
              </div>
            </div>

            <div className="sc-aqi-row">
              <div className="sc-aqi-circle" style={{ borderColor: aqiColor, color: aqiColor }}>
                <span className="sc-aqi-num">{Math.round(current_aqi)}</span>
                <span className="sc-aqi-label">AQI</span>
              </div>
              <div className="sc-details">
                <Detail label="Category"   val={aqiCategory} color={aqiColor} />
                {pollutants.pm25 > 0 && <Detail label="PM2.5" val={`${pollutants.pm25} µg/m³`} />}
                {pollutants.pm10 > 0 && <Detail label="PM10"  val={`${pollutants.pm10} µg/m³`} />}
                <Detail label="Humidity"    val={`${pollutants.humidity}%`} />
                <Detail label="Temperature" val={`${pollutants.temperature}°C`} />
              </div>
            </div>

            <p className="sc-coords">
              Coordinates: {node.lat.toFixed(4)}, {node.lng.toFixed(4)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function Detail({ label, val, color }) {
  return (
    <div className="sc-detail-row">
      <span className="sc-detail-label">{label}</span>
      <span className="sc-detail-val" style={color ? { color } : {}}>
        {val}
      </span>
    </div>
  )
}

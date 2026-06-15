/* Shared AQI helpers used across all pages */

export const getAQIColor = (aqi) => {
  if (!aqi || aqi <= 50)  return '#27ae60'  // Good
  if (aqi <= 100)         return '#f39c12'  // Moderate
  if (aqi <= 150)         return '#e67e22'  // Unhealthy for Sensitive
  if (aqi <= 200)         return '#e74c3c'  // Unhealthy
  if (aqi <= 300)         return '#8e44ad'  // Very Unhealthy
  return '#641e16'                          // Hazardous
}

export const getAQICategory = (aqi) => {
  if (!aqi || aqi <= 50)  return 'Good'
  if (aqi <= 100)         return 'Moderate'
  if (aqi <= 150)         return 'Unhealthy for Sensitive Groups'
  if (aqi <= 200)         return 'Unhealthy'
  if (aqi <= 300)         return 'Very Unhealthy'
  return 'Hazardous'
}

export const AQI_SCALE = [
  { range: '0 – 50',   label: 'Good',                       color: '#27ae60', bg: '#eafaf1', description: 'Air quality is satisfactory. Little or no risk.' },
  { range: '51 – 100',  label: 'Moderate',                   color: '#f39c12', bg: '#fef9e7', description: 'Acceptable quality. Some pollutants may affect very sensitive people.' },
  { range: '101 – 150', label: 'Unhealthy for Sensitive',    color: '#e67e22', bg: '#fef5e4', description: 'Sensitive groups may experience health effects. General public is unlikely to be affected.' },
  { range: '151 – 200', label: 'Unhealthy',                  color: '#e74c3c', bg: '#fdedec', description: 'Everyone may begin to experience health effects. Sensitive groups risk serious effects.' },
  { range: '201 – 300', label: 'Very Unhealthy',             color: '#8e44ad', bg: '#f5eef8', description: 'Health alert: everyone may experience more serious health effects.' },
  { range: '301 – 500', label: 'Hazardous',                  color: '#641e16', bg: '#f9ebea', description: 'Health warning of emergency conditions. Everyone is more likely to be affected.' },
]

/* Two physical sensor nodes installed at Ardhi University, Dar es Salaam */
export const SENSOR_NODES = [
  {
    id: 'land-building',
    name: 'Land Building',
    description: 'Ardhi University — School of Land Science & Technology',
    lat: -6.7649315,
    lng: 39.2125439,
  },
  {
    id: 'planning-building',
    name: 'Planning Building',
    description: 'Ardhi University — School of Urban & Regional Planning',
    lat: -6.7643202,
    lng: 39.2118556,
  },
]

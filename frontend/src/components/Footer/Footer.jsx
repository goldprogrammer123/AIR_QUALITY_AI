import { Link } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">

        {/* Brand column */}
        <div className="footer-col footer-brand">
          <div className="footer-logo">
            <span className="footer-logo-icon">🌿</span>
            <span>
              <span className="logo-air">Air</span>Quality
              <span className="logo-ai"> AI</span>
            </span>
          </div>
          <p className="footer-tagline">
            Real-time air quality monitoring powered by machine learning and AI — keeping Dar es Salaam breathing safely.
          </p>
          <p className="footer-copy">
            © {new Date().getFullYear()} Air Quality AI · Dar es Salaam, Tanzania
          </p>
        </div>

        {/* Quick links column */}
        <div className="footer-col">
          <h4 className="footer-heading">Quick Links</h4>
          <ul className="footer-links">
            <li><Link to="/">Home</Link></li>
            <li><Link to="/map">Sensor Map</Link></li>
            <li><Link to="/health-guidance">Health Guidance</Link></li>
            <li><Link to="/login">Dashboard Login</Link></li>
          </ul>
        </div>

        {/* Sensor nodes column */}
        <div className="footer-col">
          <h4 className="footer-heading">Sensor Nodes</h4>
          <div className="footer-node">
            <span className="live-dot" />
            <div>
              <strong>Land Building</strong>
              <small>Ministry of Lands, Dar es Salaam</small>
            </div>
          </div>
          <div className="footer-node">
            <span className="live-dot" />
            <div>
              <strong>Planning Building</strong>
              <small>Urban Planning Office</small>
            </div>
          </div>
        </div>

        {/* Tech stack column */}
        <div className="footer-col">
          <h4 className="footer-heading">Powered By</h4>
          <ul className="footer-tech">
            <li>🧠 LSTM · RandomForest</li>
            <li>⚡ FastAPI backend</li>
            <li>🤖 Groq LLM (llama-3.3-70b)</li>
            <li>🗺️ InfluxDB time-series</li>
            <li>⚛️ React + Vite</li>
          </ul>
        </div>

      </div>

      <div className="footer-bottom">
        <p>Built with ❤️ for cleaner air in Tanzania</p>
      </div>
    </footer>
  )
}

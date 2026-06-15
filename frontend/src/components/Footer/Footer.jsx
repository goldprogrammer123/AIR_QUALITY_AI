import { Link } from 'react-router-dom'
import ardhiLogo from '../../assets/ardhi_logo.png'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">

        {/* Brand column */}
        <div className="footer-col footer-brand">
          <div className="footer-logo">
            <img src={ardhiLogo} alt="Ardhi University" className="footer-logo-icon" />
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

        {/* Contact column */}
        <div className="footer-col">
          <h4 className="footer-heading">Contact Us</h4>
          <ul className="footer-tech">
            <li>📞 0767 598 691</li>
            <li>
              <a href="https://csm.aru.ac.tz/" target="_blank" rel="noreferrer" className="footer-link">
                csm.aru.ac.tz
              </a>
            </li>
          </ul>
        </div>

      </div>

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} Ardhi University · Dar es Salaam, Tanzania</p>
      </div>
    </footer>
  )
}

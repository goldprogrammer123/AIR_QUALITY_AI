import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import ardhiLogo from '../../assets/ardhi_logo.png'
import './Navbar.css'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/')
    setMenuOpen(false)
  }

  const close = () => setMenuOpen(false)

  return (
    <nav className="navbar">
      <div className="nav-inner">
        {/* Logo */}
        <NavLink to="/" className="nav-logo" onClick={close}>
          <img src={ardhiLogo} alt="Ardhi University" className="logo-icon" />
          <span className="logo-text">
            <span className="logo-air">Air</span>Quality
            <span className="logo-ai"> AI</span>
          </span>
        </NavLink>

        {/* Desktop links */}
        <ul className="nav-links">
          <li><NavLink to="/"                className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Home</NavLink></li>
          <li><NavLink to="/map"             className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Map</NavLink></li>
          <li><NavLink to="/health-guidance" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Health Guidance</NavLink></li>
          {user ? (
            <>
              <li><NavLink to="/dashboard"   className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Dashboard</NavLink></li>
              <li>
                <button className="nav-btn logout-btn" onClick={handleLogout}>
                  Logout
                </button>
              </li>
            </>
          ) : (
            <li>
              <NavLink to="/login" className="nav-btn login-btn">
                Login
              </NavLink>
            </li>
          )}
        </ul>

        {/* Mobile hamburger */}
        <button
          className={`hamburger ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile dropdown */}
      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
        <NavLink to="/"                onClick={close} className="mob-link">Home</NavLink>
        <NavLink to="/map"             onClick={close} className="mob-link">Map</NavLink>
        <NavLink to="/health-guidance" onClick={close} className="mob-link">Health Guidance</NavLink>
        {user ? (
          <>
            <NavLink to="/dashboard" onClick={close} className="mob-link">Dashboard</NavLink>
            <button onClick={handleLogout} className="mob-link mob-logout">Logout</button>
          </>
        ) : (
          <NavLink to="/login" onClick={close} className="mob-link mob-login">Login</NavLink>
        )}
      </div>
    </nav>
  )
}

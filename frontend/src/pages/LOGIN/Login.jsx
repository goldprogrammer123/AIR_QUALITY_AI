import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import ardhiLogo from '../../assets/ardhi_logo.png'
import './Login.css'

export default function Login() {
  const { login }  = useAuth()
  const navigate   = useNavigate()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Login failed. Check your email and password.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="glass-card login-card">
        <div className="login-logo">
          <img src={ardhiLogo} alt="Ardhi University" className="login-logo-icon" />
          <span className="login-logo-text">AQI Monitor</span>
        </div>

        <h2 className="login-title">Welcome back</h2>
        <p className="login-sub">Sign in to access your dashboard and analytics</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label" htmlFor="email">Email</label>
            <div className="field-input-wrap">
              <span className="field-icon">✉️</span>
              <input
                id="email"
                type="email"
                className="field-input"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="password">Password</label>
            <div className="field-input-wrap">
              <span className="field-icon">🔒</span>
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                className="field-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button type="button" className="show-pass" onClick={() => setShowPass(!showPass)}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && <div className="login-error">⚠️ {error}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? <><span className="btn-spinner" /> Signing in…</> : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          <p className="register-prompt">
            Don't have an account? <Link to="/register" className="register-link">Create one</Link>
          </p>
          <Link to="/" className="back-home">← Back to Home</Link>
        </div>
      </div>
    </div>
  )
}

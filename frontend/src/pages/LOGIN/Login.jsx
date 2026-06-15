import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import ardhiLogo from '../../assets/ardhi_logo.png'
import './Login.css'

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    /* Small delay for UX effect */
    setTimeout(() => {
      const ok = login(username, password)
      if (ok) {
        navigate('/dashboard')
      } else {
        setError('Invalid credentials. Use admin / admin123 for the demo.')
      }
      setLoading(false)
    }, 600)
  }

  return (
    <div className="login-page">
      <div className="glass-card login-card">
        {/* Logo mark */}
        <div className="login-logo">
          <img src={ardhiLogo} alt="Ardhi University" className="login-logo-icon" />
          <span className="login-logo-text">AQI Monitor</span>
        </div>

        <h2 className="login-title">Welcome back</h2>
        <p className="login-sub">Sign in to access your dashboard and analytics</p>

        <form className="login-form" onSubmit={handleSubmit}>
          {/* Username */}
          <div className="field-group">
            <label className="field-label" htmlFor="username">Username</label>
            <div className="field-input-wrap">
              <span className="field-icon">👤</span>
              <input
                id="username"
                type="text"
                className="field-input"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password */}
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
              <button
                type="button"
                className="show-pass"
                onClick={() => setShowPass(!showPass)}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="login-error">
              ⚠️ {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <><span className="btn-spinner" /> Signing in…</>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Demo credentials hint */}
        <div className="demo-hint">
          <span className="demo-label">Demo credentials</span>
          <div className="demo-creds">
            <span>username: <strong>admin</strong></span>
            <span>password: <strong>admin123</strong></span>
          </div>
        </div>

        <div className="login-footer">
          <Link to="/" className="back-home">← Back to Home</Link>
        </div>
      </div>
    </div>
  )
}

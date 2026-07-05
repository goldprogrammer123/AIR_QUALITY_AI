import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { registerUser } from '../../services/api'
import ardhiLogo from '../../assets/ardhi_logo.png'
import './Register.css'

export default function Register() {
  const navigate = useNavigate()

  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    if (form.password.length < 6)       { setError('Password must be at least 6 characters.'); return }

    setLoading(true)
    try {
      await registerUser({ username: form.username, email: form.email, password: form.password })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="reg-page">
      <div className="glass-card reg-card">
        <div className="reg-logo">
          <img src={ardhiLogo} alt="Ardhi University" className="reg-logo-icon" />
          <span className="reg-logo-text">AQI Monitor</span>
        </div>

        <h2 className="reg-title">Create your account</h2>
        <p className="reg-sub">Monitor air quality and get personalised health guidance</p>

        {success ? (
          <div className="reg-success">
            <span className="reg-success-icon">✓</span>
            <p>Account created! Redirecting to login…</p>
          </div>
        ) : (
          <form className="reg-form" onSubmit={handleSubmit}>
            <div className="field-group">
              <label className="field-label" htmlFor="username">Username</label>
              <div className="field-input-wrap">
                <span className="field-icon">👤</span>
                <input
                  id="username" type="text" className="field-input"
                  placeholder="Choose a username"
                  value={form.username} onChange={set('username')}
                  required autoComplete="username"
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="reg-email">Email</label>
              <div className="field-input-wrap">
                <span className="field-icon">✉️</span>
                <input
                  id="reg-email" type="email" className="field-input"
                  placeholder="Enter your email"
                  value={form.email} onChange={set('email')}
                  required autoComplete="email"
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="reg-password">Password</label>
              <div className="field-input-wrap">
                <span className="field-icon">🔒</span>
                <input
                  id="reg-password" type="password" className="field-input"
                  placeholder="At least 6 characters"
                  value={form.password} onChange={set('password')}
                  required autoComplete="new-password"
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="confirm">Confirm password</label>
              <div className="field-input-wrap">
                <span className="field-icon">🔒</span>
                <input
                  id="confirm" type="password" className="field-input"
                  placeholder="Repeat your password"
                  value={form.confirm} onChange={set('confirm')}
                  required autoComplete="new-password"
                />
              </div>
            </div>

            {error && <div className="login-error">⚠️ {error}</div>}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? <><span className="btn-spinner" /> Creating account…</> : 'Create Account'}
            </button>
          </form>
        )}

        <div className="reg-footer">
          <p className="register-prompt">
            Already have an account? <Link to="/login" className="register-link">Sign in</Link>
          </p>
          <Link to="/" className="back-home">← Back to Home</Link>
        </div>
      </div>
    </div>
  )
}

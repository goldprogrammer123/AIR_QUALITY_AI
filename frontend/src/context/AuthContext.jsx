import { createContext, useContext, useState, useEffect } from 'react'
import { loginUser, fetchMe } from '../services/api'

const AuthContext = createContext(null)

function parseToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp && payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('aqi_token')
    if (token) {
      const payload = parseToken(token)
      if (payload) {
        setUser({ username: payload.username, email: payload.sub, role: payload.role })
      } else {
        localStorage.removeItem('aqi_token')
      }
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    const res = await loginUser({ email, password })
    const { access_token, username, role } = res.data
    localStorage.setItem('aqi_token', access_token)
    setUser({ username, email, role })
    return { username, email, role }
  }

  const logout = () => {
    localStorage.removeItem('aqi_token')
    setUser(null)
  }

  const isAdmin = user?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

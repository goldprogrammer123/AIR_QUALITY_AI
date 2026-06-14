/*
  Simple localStorage-based auth context.
  Demo credentials: admin / admin123
  Replace with a real JWT backend when ready.
*/
import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('aqi_user')) }
    catch { return null }
  })

  const login = (username, password) => {
    if (username === 'admin' && password === 'admin123') {
      const u = { username, role: 'admin' }
      localStorage.setItem('aqi_user', JSON.stringify(u))
      setUser(u)
      return true
    }
    return false
  }

  const logout = () => {
    localStorage.removeItem('aqi_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

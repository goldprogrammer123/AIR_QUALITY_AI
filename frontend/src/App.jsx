import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar/Navbar'
import Footer from './components/Footer/Footer'
import Home from './pages/HOME/Home'
import MapPage from './pages/MAP/Map'
import HealthGuidance from './pages/HEALTH_GUIDANCE/HealthGuidance'
import Login from './pages/LOGIN/Login'
import Register from './pages/REGISTER/Register'
import Dashboard from './pages/DASHBOARD/Dashboard'

/* Redirect logged-in users away from /login and /register */
function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/dashboard" replace /> : children
}

/* Redirect unauthenticated users away from /dashboard */
function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* Floating background blobs for the glass atmosphere */}
        <div className="bg-blob blob-1" />
        <div className="bg-blob blob-2" />
        <div className="bg-blob blob-3" />

        <Navbar />

        <main className="main-content">
          <Routes>
            <Route path="/"                element={<Home />} />
            <Route path="/map"             element={<MapPage />} />
            <Route path="/health-guidance" element={<HealthGuidance />} />
            <Route path="/login"           element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register"        element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/dashboard"       element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="*"               element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <Footer />
      </BrowserRouter>
    </AuthProvider>
  )
}

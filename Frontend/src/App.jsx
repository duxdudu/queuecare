import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import NewAppointment from './pages/NewAppointment'
import AppointmentDetail from './pages/AppointmentDetail'
import EditAppointment from './pages/EditAppointment'
import QueueView from './pages/QueueView'
import './App.css'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected routes */}
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/appointments/new" element={<PrivateRoute><NewAppointment /></PrivateRoute>} />
      <Route path="/appointments/:id" element={<PrivateRoute><AppointmentDetail /></PrivateRoute>} />
      <Route path="/appointments/:id/edit" element={<PrivateRoute><EditAppointment /></PrivateRoute>} />
      <Route path="/queue" element={<PrivateRoute><QueueView /></PrivateRoute>} />

      {/* Root → dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App

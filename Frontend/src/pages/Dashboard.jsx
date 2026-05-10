import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import AppointmentCard from '../components/AppointmentCard'
import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

function Dashboard() {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const navigate = useNavigate()
  const isStaff = user?.role === 'staff'

  useEffect(() => { loadAppointments() }, [])

  async function loadAppointments() {
    try {
      const data = await apiFetch('/api/appointments')
      setAppointments(data.appointments)
    } catch (err) {
      if (err.status === 401) navigate('/login')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel(id) {
    if (!window.confirm('Cancel this appointment?')) return
    try {
      await apiFetch(`/api/appointments/${id}`, { method: 'DELETE' })
      setAppointments(prev =>
        prev.map(a => a._id === id ? { ...a, status: 'cancelled' } : a)
      )
    } catch (err) {
      alert(err.message || 'Failed to cancel')
    }
  }

  async function handleServe(id) {
    if (!window.confirm('Mark this patient as served?')) return
    try {
      await apiFetch(`/api/appointments/${id}/serve`, { method: 'PATCH' })
      setAppointments(prev =>
        prev.map(a => a._id === id ? { ...a, status: 'served' } : a)
      )
    } catch (err) {
      alert(err.message || 'Failed to mark as served')
    }
  }

  // Header action: patients get "New Appointment", staff get nothing (it's in sidebar)
  const headerAction = !isStaff
    ? { label: '+ New Appointment', to: '/appointments/new', testId: 'create-appointment-btn', variant: 'btn-success' }
    : null

  return (
    <Layout
      title={isStaff ? 'All Appointments' : 'My Appointments'}
      action={headerAction}
    >
      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading...</p>
      ) : appointments.length === 0 ? (
        <div className="empty-state">
          <p data-testid="empty-state">
            {isStaff ? 'No appointments found.' : 'No appointments yet.'}
          </p>
          {!isStaff && (
            <Link
              to="/appointments/new"
              data-testid="create-appointment-btn"
              className="btn btn-success"
            >
              + Create your first appointment
            </Link>
          )}
        </div>
      ) : (
        <div data-testid="appointments-list">
          {appointments.map(appt => (
            <AppointmentCard
              key={appt._id}
              appointment={appt}
              onCancel={handleCancel}
              onServe={isStaff ? handleServe : null}
            />
          ))}
        </div>
      )}
    </Layout>
  )
}

export default Dashboard

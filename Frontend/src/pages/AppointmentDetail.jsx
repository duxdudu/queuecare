import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

function AppointmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [appointment, setAppointment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { fetchAppointment() }, [id])

  async function fetchAppointment() {
    try {
      const data = await apiFetch(`/api/appointments/${id}`)
      setAppointment(data.appointment)
    } catch (err) {
      if (err.status === 401) navigate('/login')
      else if (err.status === 403) setError('You do not have permission to view this appointment.')
      else if (err.status === 404) setError('Appointment not found.')
      else setError(err.message || 'Failed to load appointment.')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = d => new Date(d).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const statusBg    = { pending: '#fef3c7', served: '#dcfce7', cancelled: '#fee2e2' }
  const statusColor = { pending: '#92400e', served: '#166534', cancelled: '#991b1b' }

  const isPatient = user?.role === 'patient'
  const isPending = appointment?.status === 'pending'

  // Header action: edit button for pending patient appointments
  const headerAction = isPatient && isPending
    ? { label: '✏️ Edit', to: `/appointments/${id}/edit`, variant: 'btn-outline' }
    : null

  if (loading) return <Layout title="Appointment Details"><p>Loading...</p></Layout>

  if (error) return (
    <Layout title="Appointment Details">
      <div className="alert alert-danger">{error}</div>
      <Link to="/dashboard" className="btn btn-secondary">← Back to Dashboard</Link>
    </Layout>
  )

  return (
    <Layout title="Appointment Details" action={headerAction}>
      <div style={{ maxWidth: '640px' }}>
        <Link to="/dashboard" style={{ color: '#6366f1', fontSize: '0.875rem', display: 'inline-block', marginBottom: '1.25rem' }}>
          ← Back to Dashboard
        </Link>

        <div className="card">
          {/* Queue # + status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>
              Queue #{appointment.queueNumber}
            </span>
            <span className="badge" style={{
              background: statusBg[appointment.status],
              color: statusColor[appointment.status],
              fontSize: '0.8rem', padding: '0.3rem 0.85rem'
            }}>
              {appointment.status}
            </span>
          </div>

          {/* Details table */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {[
                ['Date',    formatDate(appointment.date)],
                ['Doctor',  appointment.doctor],
                ['Reason',  appointment.reason],
                ['Created', new Date(appointment.createdAt).toLocaleString()],
              ].map(([label, value]) => (
                <tr key={label} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.75rem 0', color: '#6b7280', width: 110, fontWeight: 600, fontSize: '0.875rem' }}>{label}</td>
                  <td style={{ padding: '0.75rem 0', fontSize: '0.9rem' }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}

export default AppointmentDetail

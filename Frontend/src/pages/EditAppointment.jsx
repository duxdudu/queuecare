import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'

function EditAppointment() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [date, setDate]     = useState('')
  const [reason, setReason] = useState('')
  const [doctor, setDoctor] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { fetchAppointment() }, [id])

  async function fetchAppointment() {
    try {
      const data = await apiFetch(`/api/appointments/${id}`)
      const a = data.appointment
      setDate(a.date.slice(0, 10))
      setReason(a.reason)
      setDoctor(a.doctor)
    } catch (err) {
      if (err.status === 401) navigate('/login')
      else setError(err.message || 'Failed to load appointment.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      await apiFetch(`/api/appointments/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ date, reason, doctor })
      })
      setSuccess('Appointment updated!')
      setTimeout(() => navigate(`/appointments/${id}`), 1500)
    } catch (err) {
      setError(err.message || 'Failed to update appointment')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Layout title="Edit Appointment"><p>Loading...</p></Layout>

  return (
    <Layout title="Edit Appointment">
      <div style={{ maxWidth: '560px' }}>
        <Link to={`/appointments/${id}`} style={{ color: '#6366f1', fontSize: '0.875rem', display: 'inline-block', marginBottom: '1.25rem' }}>
          ← Back to Appointment
        </Link>

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input
                type="date"
                data-testid="edit-appt-date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Reason for visit</label>
              <textarea
                data-testid="edit-appt-reason"
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows="3"
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Doctor</label>
              <input
                type="text"
                data-testid="edit-appt-doctor"
                value={doctor}
                onChange={e => setDoctor(e.target.value)}
                className="form-control"
              />
            </div>

            {success && <div data-testid="edit-appt-success" className="alert alert-success">{success}</div>}
            {error   && <div data-testid="edit-appt-error"   className="alert alert-danger">{error}</div>}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="submit"
                data-testid="edit-appt-submit"
                disabled={saving}
                className="btn btn-primary"
                style={{ flex: 1, padding: '0.7rem' }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <Link
                to={`/appointments/${id}`}
                className="btn btn-secondary"
                style={{ flex: 1, padding: '0.7rem', textAlign: 'center' }}
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  )
}

export default EditAppointment

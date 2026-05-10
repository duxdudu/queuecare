import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'

function NewAppointment() {
  const [date, setDate]     = useState('')
  const [reason, setReason] = useState('')
  const [doctor, setDoctor] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError]   = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setSuccess('')
    setError('')
    try {
      await apiFetch('/api/appointments', {
        method: 'POST',
        body: JSON.stringify({ date, reason, doctor })
      })
      setSuccess('Appointment created successfully!')
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (err) {
      setError(err.message || 'Failed to create appointment')
    }
  }

  return (
    <Layout title="New Appointment">
      <div style={{ maxWidth: '560px' }}>
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input
                type="date"
                data-testid="appt-date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Reason for visit</label>
              <textarea
                data-testid="appt-reason"
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
                data-testid="appt-doctor"
                value={doctor}
                onChange={e => setDoctor(e.target.value)}
                className="form-control"
              />
            </div>

            {success && <div data-testid="appt-success" className="alert alert-success">{success}</div>}
            {error   && <div data-testid="appt-error"   className="alert alert-danger">{error}</div>}

            <button
              type="submit"
              data-testid="appt-submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.7rem', fontSize: '0.95rem' }}
            >
              Create Appointment
            </button>
          </form>
        </div>
      </div>
    </Layout>
  )
}

export default NewAppointment

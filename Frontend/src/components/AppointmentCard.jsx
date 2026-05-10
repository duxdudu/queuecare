import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

function AppointmentCard({ appointment, onCancel, onServe }) {
  const { user } = useAuth()
  const role      = user?.role || 'patient'
  const isStaff   = role === 'staff'
  const isPatient = role === 'patient'

  const { status, queueNumber, date, doctor, reason, _id } = appointment
  const isPending   = status === 'pending'
  const isCancelled = status === 'cancelled'
  const isServed    = status === 'served'

  const formatDate = d => new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  })

  const badgeClass = `badge badge-${status}`

  return (
    <div
      data-testid="appointment-card"
      className="card"
      style={{ opacity: (isCancelled || isServed) ? 0.72 : 1 }}
    >
      {/* ── Header row ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <strong data-testid="queue-number" style={{ fontSize: '0.95rem' }}>
          Queue #{queueNumber}
        </strong>
        <span data-testid="appointment-status" className={badgeClass}>
          {status}
        </span>
      </div>

      {/* ── Details ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 1rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#374151' }}>
        <div><span style={{ color: '#9ca3af', fontWeight: 600 }}>Date</span><br />{formatDate(date)}</div>
        <div><span style={{ color: '#9ca3af', fontWeight: 600 }}>Doctor</span><br />{doctor}</div>
        <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#9ca3af', fontWeight: 600 }}>Reason</span><br />{reason}</div>
      </div>

      {/* ── Actions ── */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Link to={`/appointments/${_id}`} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}>
          View
        </Link>

        {isPatient && isPending && (
          <Link to={`/appointments/${_id}/edit`} data-testid="edit-btn" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}>
            ✏️ Edit
          </Link>
        )}

        {isPatient && (
          <button
            data-testid="cancel-btn"
            onClick={() => onCancel(_id)}
            disabled={!isPending}
            className={`btn ${isPending ? 'btn-danger' : 'btn-secondary'}`}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
          >
            Cancel
          </button>
        )}

        {isStaff && isPending && onServe && (
          <button
            data-testid="serve-btn"
            onClick={() => onServe(_id)}
            className="btn btn-success"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
          >
            ✔ Mark Served
          </button>
        )}
      </div>
    </div>
  )
}

export default AppointmentCard

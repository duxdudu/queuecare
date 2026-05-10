import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { apiFetch } from '../lib/api'

function QueueView() {
  const [queue, setQueue]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [servingId, setServingId] = useState(null)
  const navigate = useNavigate()

  useEffect(() => { fetchQueue() }, [])

  async function fetchQueue() {
    setLoading(true)
    setError('')
    try {
      // Send the client's local date so the server queries the correct UTC day.
      // Without this, a UTC+N timezone would cause the server to query yesterday.
      const localDate = new Date()
      const yyyy = localDate.getFullYear()
      const mm   = String(localDate.getMonth() + 1).padStart(2, '0')
      const dd   = String(localDate.getDate()).padStart(2, '0')
      const todayParam = `${yyyy}-${mm}-${dd}`

      const data = await apiFetch(`/api/queue/today?date=${todayParam}`)
      setQueue(data.queue)
    } catch (err) {
      if (err.status === 401) navigate('/login')
      else setError(err.message || 'Failed to load queue')
    } finally {
      setLoading(false)
    }
  }

  async function handleServe(id) {
    setServingId(id)
    try {
      await apiFetch(`/api/appointments/${id}/serve`, { method: 'PATCH' })
      setQueue(prev => prev.map(a => a._id === id ? { ...a, status: 'served' } : a))
    } catch (err) {
      alert(err.message || 'Failed to mark as served')
    } finally {
      setServingId(null)
    }
  }

  const pending   = queue.filter(a => a.status === 'pending').length
  const served    = queue.filter(a => a.status === 'served').length
  const cancelled = queue.filter(a => a.status === 'cancelled').length

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const statusColors = { pending: '#92400e', served: '#166534', cancelled: '#991b1b' }
  const statusBg     = { pending: '#fef3c7', served: '#dcfce7', cancelled: '#fee2e2' }

  return (
    <Layout
      title="Today's Queue"
      action={{ label: '🔄 Refresh', onClick: fetchQueue, variant: 'btn-secondary' }}
    >
      {/* Date subtitle */}
      <p style={{ color: '#6b7280', marginBottom: '1.25rem', fontSize: '0.9rem' }}>{today}</p>

      {/* Stat cards */}
      <div className="stat-grid">
        {[
          { label: 'Pending',   value: pending,      color: '#f59e0b' },
          { label: 'Served',    value: served,       color: '#22c55e' },
          { label: 'Cancelled', value: cancelled,    color: '#ef4444' },
          { label: 'Total',     value: queue.length, color: '#6366f1' },
        ].map(({ label, value, color }) => (
          <div className="stat-card" key={label}>
            <div className="stat-value" style={{ color }}>{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading queue...</p>
      ) : queue.length === 0 ? (
        <div className="empty-state">
          <p>No appointments scheduled for today.</p>
          <p style={{ fontSize: '0.85rem' }}>Appointments booked for today's date will appear here.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {['Queue #', 'Doctor', 'Reason', 'Status', 'Action'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {queue.map(appt => {
                const isPending     = appt.status === 'pending'
                const isBeingServed = servingId === appt._id
                return (
                  <tr
                    key={appt._id}
                    style={{
                      opacity: isPending ? 1 : 0.65,
                      background: isPending ? 'white'
                        : appt.status === 'served' ? '#f0fdf4' : '#fff5f5'
                    }}
                  >
                    <td style={{ fontWeight: 700, fontSize: '1rem' }}>#{appt.queueNumber}</td>
                    <td>{appt.doctor}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {appt.reason}
                    </td>
                    <td>
                      <span className="badge" style={{
                        background: statusBg[appt.status],
                        color: statusColors[appt.status]
                      }}>
                        {appt.status}
                      </span>
                    </td>
                    <td>
                      {isPending ? (
                        <button
                          data-testid={`serve-btn-${appt._id}`}
                          onClick={() => handleServe(appt._id)}
                          disabled={isBeingServed}
                          className="btn btn-success"
                          style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
                        >
                          {isBeingServed ? 'Saving...' : '✔ Mark Served'}
                        </button>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                          {appt.status === 'served' ? '✔ Done' : '✕ Cancelled'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}

export default QueueView

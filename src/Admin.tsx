import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, type AdminUser, type Invite, type Me } from './api'

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '—')

export default function Admin({ me }: { me: Me }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [u, i] = await Promise.all([api<AdminUser[]>('/admin/users'), api<Invite[]>('/admin/invites')])
      setUsers(u); setInvites(i); setError('')
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }, [])
  useEffect(() => { load() }, [load])

  const invite = async (ev: FormEvent) => {
    ev.preventDefault()
    try { await api('/admin/invites', { method: 'POST', body: JSON.stringify({ email }) }); setEmail(''); load() }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }
  const uninvite = async (addr: string) => { await api(`/admin/invites/${encodeURIComponent(addr)}`, { method: 'DELETE' }); load() }
  const setStatus = async (uid: string, status: 'active' | 'paused') => {
    await api(`/admin/users/${uid}/status`, { method: 'POST', body: JSON.stringify({ status }) }); load()
  }

  return (
    <>
      {error && <p className="card warn">{error}</p>}
      <section className="card">
        <h2>Users ({users.length})</h2>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Mode</th><th>Last seen</th><th></th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.uid}>
                <td>{u.display_name || '—'}</td><td>{u.email}</td><td>{u.role}</td><td>{u.status}</td><td>{u.mode}</td><td>{fmt(u.last_seen_at)}</td>
                <td>{u.uid !== me.uid && (u.status === 'paused'
                  ? <button className="small" onClick={() => setStatus(u.uid, 'active')}>Resume</button>
                  : <button className="small" onClick={() => setStatus(u.uid, 'paused')}>Pause</button>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2>Invites</h2>
        <form onSubmit={invite} className="row">
          <input type="email" required placeholder="friend@gmail.com" value={email} onChange={e => setEmail(e.target.value)} />
          <button type="submit">Invite</button>
        </form>
        <ul className="plain">
          {invites.map(i => (
            <li key={i.email}>{i.email} <span className="muted">· {fmt(i.created_at)}</span> <button className="link" onClick={() => uninvite(i.email)}>remove</button></li>
          ))}
          {invites.length === 0 && <li className="muted">No pending invites.</li>}
        </ul>
      </section>
    </>
  )
}

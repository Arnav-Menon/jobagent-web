import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, type AdminUser, type Invite, type Me } from './api'
import { Avatar, Badge, Icon, Skeleton, fullTime, relTime, useToast } from './ui'

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))

export default function Admin({ me }: { me: Me }) {
  const toast = useToast()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [invites, setInvites] = useState<Invite[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [u, i] = await Promise.all([api<AdminUser[]>('/admin/users'), api<Invite[]>('/admin/invites')])
      setUsers(u); setInvites(i); setLoadError('')
    } catch (e) { setLoadError(msg(e)) }
  }, [])
  useEffect(() => { load() }, [load])

  const run = async (key: string, fn: () => Promise<unknown>, done: string, failed: string) => {
    setBusy(key)
    try { await fn(); toast(done); await load() }
    catch (e) { toast(`${failed}: ${msg(e)}`, 'danger') }
    finally { setBusy(null) }
  }

  const invite = (ev: FormEvent) => {
    ev.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!addr) return
    run('invite', async () => {
      await api('/admin/invites', { method: 'POST', body: JSON.stringify({ email: addr }) })
      setEmail('')
    }, `Invited ${addr}`, `Couldn’t invite ${addr}`)
  }
  const uninvite = (addr: string) =>
    run(`inv:${addr}`, () => api(`/admin/invites/${encodeURIComponent(addr)}`, { method: 'DELETE' }), `Removed invite for ${addr}`, 'Couldn’t remove invite')
  const setStatus = (u: AdminUser, status: 'active' | 'paused') =>
    run(`user:${u.uid}`, () => api(`/admin/users/${u.uid}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
      `${status === 'paused' ? 'Paused' : 'Resumed'} ${u.display_name || u.email}`, `Couldn’t update ${u.email}`)

  const stats = [
    { label: 'Users', value: users?.length },
    { label: 'Active', value: users?.filter(u => u.status === 'active').length },
    { label: 'Paused', value: users?.filter(u => u.status === 'paused').length },
    { label: 'Pending invites', value: invites?.length },
  ]

  return (
    <div className="page admin">
      <div className="page-head">
        <h1>Admin</h1>
        <p className="sub">Who can use Job Agent, and who is applying right now.</p>
      </div>

      {loadError && (
        <div className="notice tone-danger" role="alert">
          <Icon name="alert" />
          <p>Couldn’t load users and invites: {loadError}</p>
          <button className="btn btn-quiet btn-sm" onClick={() => { setLoadError(''); load() }}><Icon name="refresh" size={16} /> Try again</button>
        </div>
      )}

      <dl className="stats">
        {stats.map(s => (
          <div key={s.label} className="stat">
            <dt>{s.label}</dt>
            <dd>{s.value ?? <Skeleton w={36} h={30} />}</dd>
          </div>
        ))}
      </dl>

      <div className="admin-grid">
        <section className="panel" aria-labelledby="users-title">
          <div className="panel-head"><h2 id="users-title">Users</h2></div>
          <div className="table-wrap">
            <table className="users">
              <thead>
                <tr><th scope="col">Person</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Mode</th><th scope="col">Last seen</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {users === null && [0, 1, 2].map(i => (
                  <tr key={i} aria-hidden="true">
                    <td><div className="person"><Skeleton w={32} h={32} /><div className="person-text"><Skeleton w={120} /><Skeleton w={160} h={11} /></div></div></td>
                    <td><Skeleton w={48} /></td><td><Skeleton w={52} /></td><td><Skeleton w={48} /></td><td><Skeleton w={70} /></td><td />
                  </tr>
                ))}
                {users?.map(u => (
                  <tr key={u.uid}>
                    <td>
                      <div className="person">
                        <Avatar name={u.display_name} email={u.email} />
                        <div className="person-text">
                          <span className="person-name">{u.display_name || u.email.split('@')[0]}{u.uid === me.uid && <span className="you"> (you)</span>}</span>
                          <span className="person-email">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label="Role"><Badge value={u.role} /></td>
                    <td data-label="Status"><Badge value={u.status} /></td>
                    <td data-label="Mode"><Badge value={u.mode} /></td>
                    <td data-label="Last seen"><time dateTime={u.last_seen_at} title={fullTime(u.last_seen_at)}>{relTime(u.last_seen_at)}</time></td>
                    <td className="actions">
                      {u.uid !== me.uid && (u.status === 'paused'
                        ? <button className="btn btn-quiet btn-sm" disabled={busy === `user:${u.uid}`} onClick={() => setStatus(u, 'active')}><Icon name="play" size={15} /> Resume</button>
                        : <button className="btn btn-quiet btn-sm" disabled={busy === `user:${u.uid}`} onClick={() => setStatus(u, 'paused')}><Icon name="pause" size={15} /> Pause</button>)}
                    </td>
                  </tr>
                ))}
                {users?.length === 0 && <tr><td colSpan={6} className="empty">Nobody has signed in yet. Invite someone to get started.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel invites" aria-labelledby="invites-title">
          <div className="panel-head"><h2 id="invites-title">Invites</h2></div>
          <form onSubmit={invite} className="invite-form">
            <label htmlFor="invite-email">Google account email</label>
            <div className="field-row">
              <input id="invite-email" type="email" required autoComplete="off" placeholder="name@gmail.com" value={email} onChange={e => setEmail(e.target.value)} />
              <button className="btn btn-primary" type="submit" disabled={busy === 'invite'}>{busy === 'invite' ? 'Inviting…' : 'Invite'}</button>
            </div>
            <p className="hint">They can sign in as soon as you invite them.</p>
          </form>
          <div>
          <h3 className="list-title">Waiting to sign in</h3>
          <ul className="invite-list">
            {invites === null && [0, 1].map(i => <li key={i} aria-hidden="true"><Skeleton w="70%" /></li>)}
            {invites?.map(i => (
              <li key={i.email}>
                <Icon name="mail" size={16} />
                <div className="invite-text">
                  <span>{i.email}</span>
                  <time dateTime={i.created_at} title={fullTime(i.created_at)}>Invited {relTime(i.created_at).toLowerCase()}</time>
                </div>
                <button className="icon-btn" aria-label={`Remove invite for ${i.email}`} title="Remove invite" disabled={busy === `inv:${i.email}`} onClick={() => uninvite(i.email)}>
                  <Icon name="trash" size={16} />
                </button>
              </li>
            ))}
            {invites?.length === 0 && <li className="empty">No pending invites.</li>}
          </ul>
          </div>
        </section>
      </div>
    </div>
  )
}

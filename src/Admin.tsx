import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, type AdminStats, type AdminUser, type Invite, type Me } from './api'
import Decisions from './Decisions'
import { Avatar, Badge, Icon, Skeleton, fullTime, relTime, useToast } from './ui'

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))

export default function Admin({ me }: { me: Me }) {
  const toast = useToast()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [invites, setInvites] = useState<Invite[] | null>(null)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loadError, setLoadError] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [u, i, st] = await Promise.all([api<AdminUser[]>('/admin/users'), api<Invite[]>('/admin/invites'), api<AdminStats>('/admin/stats')])
      setUsers(u); setInvites(i); setStats(st); setLoadError('')
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

  const cancel = (id: string) =>
    run(`run:${id}`, () => api(`/admin/runs/${encodeURIComponent(id)}/cancel`, { method: 'POST' }), 'Run cancelled', 'Couldn’t cancel the run')

  const sum = (f: (u: AdminStats['users'][number]) => number) => stats?.users.reduce((n, u) => n + f(u), 0)
  const tiles = [
    { label: 'Active users', value: users?.filter(u => u.status === 'active').length },
    { label: 'Sent today', value: sum(u => u.applications.submitted_today) },
    { label: 'Sent this week', value: sum(u => u.applications.submitted_7d) },
    { label: 'Waiting on users', value: sum(u => u.drafts.awaiting_approval + u.drafts.held + u.drafts.needs_you) },
    { label: 'Model calls today', value: sum(u => u.model_calls.today) },
    { label: 'Pending invites', value: invites?.length },
  ]
  const beatAge = stats?.worker.heartbeat_at ? (Date.now() - new Date(stats.worker.heartbeat_at).getTime()) / 60000 : null
  const workerOk = beatAge !== null && beatAge < 5
  const nameOf = (uid: string) => { const u = stats?.users.find(x => x.uid === uid); return u ? (u.display_name || u.email) : uid.slice(0, 8) }

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
        {tiles.map(s => (
          <div key={s.label} className="stat">
            <dt>{s.label}</dt>
            <dd>{s.value ?? <Skeleton w={36} h={30} />}</dd>
          </div>
        ))}
      </dl>

      <section className="panel" aria-labelledby="health-title" style={{ marginBottom: 24 }}>
        <div className="panel-head"><h2 id="health-title">System</h2></div>
        {!stats ? <Skeleton w="60%" /> : (
          <div className="health">
            <span><span className={`dot ${workerOk ? 'ok' : 'bad'}`} aria-hidden="true" />
              Worker {workerOk ? 'running' : beatAge === null ? 'has not reported yet' : 'silent'}{stats.worker.heartbeat_at && <span className="muted"> · last seen {relTime(stats.worker.heartbeat_at).toLowerCase()}</span>}</span>
            <span>Queue: <strong>{stats.queue.length}</strong></span>
            <span>Searches and applications this week: <strong>{stats.runs_7d.done}</strong> finished, <strong className={stats.runs_7d.failed ? 'tone-danger' : ''}>{stats.runs_7d.failed}</strong> failed</span>
            <span className="muted">Daily model-call cap per user: {stats.model_calls_cap}</span>
          </div>
        )}
        {stats && stats.top_holds.length > 0 && (<>
          <h3 className="list-title" style={{ marginTop: 16 }}>Most common reasons applications are held</h3>
          <ul className="hold-list">{stats.top_holds.map(([why, n]) => <li key={why}>{why} <span className="muted">({n})</span></li>)}</ul>
        </>)}
        {stats && stats.queue.length > 0 && (<>
          <h3 className="list-title" style={{ marginTop: 16 }}>Queue</h3>
          <ul className="invite-list">
            {stats.queue.map(r => (
              <li key={r.id}>
                <Icon name={r.status === 'running' ? 'play' : 'pause'} size={16} />
                <div className="invite-text">
                  <span>{r.kind === 'apply' ? 'Application' : 'Search'} for {nameOf(r.uid)} · {r.status}</span>
                  <time dateTime={r.created_at} title={fullTime(r.created_at)}>Queued {relTime(r.created_at).toLowerCase()}{r.trigger ? ` · ${r.trigger}` : ''}</time>
                </div>
                {r.status === 'queued' && <button className="icon-btn" aria-label="Cancel this run" title="Cancel" disabled={busy === `run:${r.id}`} onClick={() => cancel(r.id)}><Icon name="x" size={16} /></button>}
              </li>
            ))}
          </ul>
        </>)}
      </section>

      <section className="panel" aria-labelledby="activity-title" style={{ marginBottom: 24 }}>
        <div className="panel-head"><h2 id="activity-title">Activity</h2><p className="hint">Counts only. Answers, resumes and screenshots stay private to each user.</p></div>
        <div className="table-wrap">
          <table className="users activity">
            <thead>
              <tr><th scope="col">Person</th><th scope="col">Last run</th><th scope="col" className="num">Sent today / week / all</th>
                <th scope="col" className="num">Waiting</th><th scope="col" className="num">Not confirmed</th><th scope="col" className="num">Failed runs (7d)</th><th scope="col" className="num">Model calls today</th></tr>
            </thead>
            <tbody>
              {!stats && <tr><td colSpan={7}><Skeleton /></td></tr>}
              {stats?.users.map(u => (
                <tr key={u.uid}>
                  <td><span className="person-name">{u.display_name || u.email.split('@')[0]}</span>{u.top_holds[0] && <div className="muted" style={{ fontSize: 13 }}>Held mostly: {u.top_holds[0][0]}</div>}</td>
                  <td data-label="Last run">{u.last_run ? <><Badge value={u.last_run.status} /> <time className="muted" dateTime={u.last_run.created_at} title={fullTime(u.last_run.created_at)}>{relTime(u.last_run.created_at)}</time></> : <span className="muted">Never</span>}</td>
                  <td data-label="Sent" className="num">{u.applications.submitted_today} / {u.applications.submitted_7d} / {u.applications.submitted_total}</td>
                  <td data-label="Waiting" className="num" title={`${u.drafts.awaiting_approval} to approve, ${u.drafts.held} held, ${u.drafts.needs_you} need them, ${u.drafts.scheduled} scheduled`}>
                    {u.drafts.awaiting_approval + u.drafts.held + u.drafts.needs_you}{u.drafts.scheduled ? <span className="muted"> +{u.drafts.scheduled} sched.</span> : null}</td>
                  <td data-label="Not confirmed" className="num">{u.applications.pending}</td>
                  <td data-label="Failed runs" className="num">{u.runs_7d.failed}</td>
                  <td data-label="Model calls" className="num">{u.model_calls.today} <span className="muted">/ {stats.model_calls_cap}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Decisions />

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

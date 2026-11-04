// Dev-only fixtures for `?demo=…` previews. Made-up people only.
import type { AdminUser, Invite, Me } from './api'

const ago = (mins: number) => new Date(Date.now() - mins * 60000).toISOString()

export const demoMe: Me = {
  uid: 'u1', email: 'alex.rivera@example.com', display_name: 'Alex Rivera', role: 'admin',
  status: 'active', mode: 'review', created_at: ago(60 * 24 * 20),
}

let users: AdminUser[] = [
  { ...demoMe, last_seen_at: ago(2) },
  { uid: 'u2', email: 'sam.lee@example.com', display_name: 'Sam Lee', role: 'user', status: 'active', mode: 'auto', created_at: ago(9000), last_seen_at: ago(60 * 5) },
  { uid: 'u3', email: 'jordan.p@example.com', display_name: 'Jordan Patel', role: 'user', status: 'paused', mode: 'review', created_at: ago(20000), last_seen_at: ago(60 * 24 * 3) },
  { uid: 'u4', email: 'casey@example.com', display_name: '', role: 'user', status: 'active', mode: 'review', created_at: ago(400) },
]
let invites: Invite[] = [
  { email: 'morgan@example.com', created_at: ago(60 * 26) },
  { email: 'taylor.k@example.com', created_at: ago(15) },
]

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function demoApi<T>(path: string, init: RequestInit, mode: string): Promise<T> {
  if (mode === 'admin-loading') return new Promise<T>(() => {})
  await wait(500)
  if (mode === 'admin-error' && path.startsWith('/admin')) throw new Error('Service unavailable')
  const body = init.body ? JSON.parse(init.body as string) : {}
  const method = init.method || 'GET'
  if (path === '/me') return (mode === 'user' ? { ...demoMe, role: 'user' } : demoMe) as T
  if (path === '/admin/users') return users as T
  if (path === '/admin/invites' && method === 'GET') return invites as T
  if (path === '/admin/invites') { invites = [...invites, { email: body.email, created_at: new Date().toISOString() }]; return {} as T }
  if (path.startsWith('/admin/invites/')) { const e = decodeURIComponent(path.split('/').pop()!); invites = invites.filter(i => i.email !== e); return {} as T }
  const m = path.match(/^\/admin\/users\/(.+)\/status$/)
  if (m) { users = users.map(u => (u.uid === m[1] ? { ...u, status: body.status } : u)); return {} as T }
  throw new Error('Not found')
}

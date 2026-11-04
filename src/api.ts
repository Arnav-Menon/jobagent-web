import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { API_URL, firebaseConfig } from './config'

export const auth = getAuth(initializeApp(firebaseConfig))
export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider())
export const logOut = () => signOut(auth)

export type Me = { uid: string; email: string; display_name: string; role: 'admin' | 'user'; status: string; mode: string; created_at: string }
export type AdminUser = Me & { last_seen_at?: string }
export type Invite = { email: string; created_at: string }

export class ApiError extends Error {
  status: number
  detail: string
  constructor(status: number, detail: string) { super(detail); this.status = status; this.detail = detail }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const user = auth.currentUser
  if (!user) throw new ApiError(401, 'not_signed_in')
  const token = await user.getIdToken()
  const res = await fetch(API_URL + path, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, body.detail || res.statusText)
  return body as T
}

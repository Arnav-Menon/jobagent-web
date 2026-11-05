import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { API_URL, firebaseConfig } from './config'

export const auth = getAuth(initializeApp(firebaseConfig))
export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider())
export const logOut = () => signOut(auth)

export type Me = { uid: string; email: string; display_name: string; role: 'admin' | 'user'; status: string; mode: string; created_at: string }
export type AdminUser = Me & { last_seen_at?: string }
export type Invite = { email: string; created_at: string }

/* ---------- Phase 2: onboarding (see jobs/docs/API.md) ---------- */
export type StepKey = 'resume' | 'details' | 'standing' | 'preferences'
export type SetupStatus = { steps: Record<StepKey, boolean>; missing_details: string[]; complete: boolean; mode: 'review' | 'auto' }
export type ResumeMeta = { filename: string; sha256: string; size: number; pages: number; uploaded_at: string }
export type FactValue = string | number | boolean
export type FieldSpec = {
  key: string; label: string; type: 'text' | 'email' | 'tel' | 'url' | 'number' | 'bool' | 'enum'
  required: boolean; options?: string[]; help?: string
}
export type Profile = {
  resume: ResumeMeta | null
  facts: Record<string, { value: FactValue; confirmed_at: string }>
  suggestions: Record<string, FactValue>
  fields: FieldSpec[]
}
export type StandingValue = 'yes' | 'no' | 'hold'
export type StandingSpec = { key: string; label: string; help?: string }
export type Standing = { answers: Record<string, { value: StandingValue; confirmed_at: string }>; keys: StandingSpec[] }
export type WorkMode = 'onsite' | 'hybrid' | 'remote'
export type Seniority = 'junior' | 'mid' | 'senior' | 'staff'
export type Preferences = {
  locations: string[]; work_modes: WorkMode[]; include_keywords: string[]; exclude_keywords: string[]
  seniority: Seniority[]; min_base_salary: number | null; companies_avoid: string[]; companies_prefer: string[]
  min_fit_score: number; max_per_day: number; notes: string
}

/* ---------- Phase 4: runs, drafts, applications ---------- */
export type RunCounts = { scanned?: number; eligible?: number; scored?: number; drafts?: number; held?: number; submitted?: number; pending?: number; scheduled?: number; needs_you?: number }
export type Run = {
  id: string; kind: 'discover' | 'apply'; status: 'queued' | 'running' | 'done' | 'failed'
  created_at: string; started_at?: string; finished_at?: string; trigger: 'manual' | 'daily' | 'approval' | 'scheduled'
  counts?: RunCounts; error?: string
}
export type DraftStatus = 'awaiting_approval' | 'held' | 'scheduled' | 'needs_you' | 'submitted_by_you' | 'dismissed' | 'approved' | 'submitting' | 'submitted' | 'pending_verification' | 'rejected' | 'failed'
export type PlanRow = { label: string; kind: string; value: string | null; source: string }
export type Draft = {
  key: string; status: DraftStatus; company: string; title: string; url: string
  provider: 'ashby' | 'greenhouse' | 'lever' | 'lever-eu'; score: number | null; confidence?: string
  plan: PlanRow[]; holds: string[]; outcome?: string; scheduled_for?: string; created_at: string; updated_at: string
}
export type Decision = { key: string; status: 'approved' | 'scheduled' | 'rejected'; run_id?: string; scheduled_for?: string; reason?: 'daily_limit' | 'weekend' }
export type AppState = 'SUBMITTING' | 'PENDING_VERIFICATION' | 'SUBMITTED' | 'FAILED' | 'NOT_SENT'
export type Application = { key: string; state: AppState; company: string; title: string; url: string; quota_day: string; updated_at: string }
export type Screens = { filled?: string; result?: string; expires_in: number }

export class ApiError extends Error {
  status: number
  detail: string
  constructor(status: number, detail: string) { super(detail); this.status = status; this.detail = detail }
}

// Dev-only fixture mode (`?demo=admin`, `?demo=not_invited`, …) for previewing UI states
// without signing in. `import.meta.env.DEV` is false in production builds, so this is stripped.
export const DEMO = import.meta.env.DEV ? new URLSearchParams(location.search).get('demo') : null

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (import.meta.env.DEV && DEMO) return (await import('./demo')).demoApi<T>(path, init, DEMO)
  const user = auth.currentUser
  if (!user) throw new ApiError(401, 'not_signed_in')
  const token = await user.getIdToken()
  // FormData bodies (resume upload) set their own multipart Content-Type.
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` }
  if (init.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  let res: Response
  try {
    res = await fetch(API_URL + path, { ...init, headers })
  } catch {
    throw new ApiError(0, 'network')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, typeof body.detail === 'string' ? body.detail : res.status === 422 ? 'invalid_request' : res.statusText || 'request_failed')
  return body as T
}

// Dev-only fixtures for `?demo=…` previews. Made-up people only. Mirrors jobs/docs/API.md.
import { ApiError } from './api'
import type { AdminUser, FactValue, FieldSpec, Invite, Me, Preferences, Profile, ResumeMeta, Standing, StandingSpec, StandingValue } from './api'

const ago = (mins: number) => new Date(Date.now() - mins * 60000).toISOString()
const now = () => new Date().toISOString()

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

/* ---------- onboarding fixtures ---------- */

const FIELDS: FieldSpec[] = [
  { key: 'name', label: 'Full legal name', type: 'text', required: true },
  { key: 'email', label: 'Email', type: 'email', required: true },
  { key: 'phone', label: 'Phone', type: 'tel', required: true },
  { key: 'city', label: 'Current city', type: 'text', required: true, help: 'For example, New York, NY' },
  { key: 'linkedin', label: 'LinkedIn URL', type: 'url', required: false },
  { key: 'github', label: 'GitHub or portfolio URL', type: 'url', required: false, help: 'Used for portfolio, website and project-link questions' },
  { key: 'current_company', label: 'Current company', type: 'text', required: false },
  { key: 'current_title', label: 'Current title', type: 'text', required: false },
  { key: 'undergrad_school', label: 'Undergraduate school', type: 'text', required: false, help: 'Four-year undergraduate school' },
  { key: 'recent_school', label: 'Most recent school', type: 'text', required: false },
  { key: 'recent_degree', label: 'Most recent degree', type: 'enum', required: false, options: ['bachelor', 'master', 'phd', 'other'] },
  { key: 'recent_field', label: 'Field of study', type: 'text', required: false },
  { key: 'years_experience', label: 'Years of professional experience', type: 'number', required: true, help: 'Full-time paid jobs only. Don’t count internships or any time in school, including grad school.' },
  { key: 'work_authorized_us', label: 'Authorized to work in the US?', type: 'bool', required: true, help: 'For any US employer, without restriction' },
  { key: 'requires_sponsorship', label: 'Need visa sponsorship?', type: 'bool', required: true, help: 'Now or in the future' },
]
const STANDING_KEYS: StandingSpec[] = [
  { key: 'accept_arbitration_on_submit', label: 'Accept an arbitration agreement when applying', help: 'Some applications require agreeing to arbitration to submit.' },
  { key: 'privacy_notice_ack', label: 'Acknowledge the company’s privacy notice', help: 'A checkbox confirming you read how your data is used.' },
  { key: 'share_with_partners', label: 'Let the company share your application with partners' },
  { key: 'interview_recording_consent', label: 'Consent to interviews being recorded' },
  { key: 'background_check_consent', label: 'Consent to a background check' },
  { key: 'has_us_clearance', label: 'Hold an active US security clearance' },
  { key: 'clearance_eligible', label: 'Eligible for a US security clearance' },
  { key: 'previously_interviewed', label: 'Have you interviewed with this company before?', help: 'Answering yes or no applies to every company.' },
]

const fresh = { resume: null as ResumeMeta | null, facts: {} as Profile['facts'], suggestions: { email: 'alex.rivera@example.com' } as Record<string, FactValue> }
let resume = fresh.resume
let facts = fresh.facts
let suggestions = fresh.suggestions
let standing: Standing['answers'] = {}
let prefs: Preferences | null = null
let prefsAt: string | null = null
let mode: 'review' | 'auto' = 'review'
let seeded = false

function seedDone() {
  resume = { filename: 'Alex_Rivera_Resume.pdf', sha256: 'f'.repeat(64), size: 182_400, pages: 1, uploaded_at: ago(60 * 30) }
  const v: Record<string, FactValue> = { name: 'Alex Rivera', email: 'alex.rivera@example.com', phone: '+1 555 010 0199', city: 'New York, NY', years_experience: 4, work_authorized_us: true, requires_sponsorship: false, current_company: 'Example Corp', current_title: 'Data Analyst' }
  facts = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, { value: x, confirmed_at: ago(60 * 29) }]))
  standing = Object.fromEntries(STANDING_KEYS.map((k, i) => [k.key, { value: (i % 3 === 2 ? 'hold' : i % 2 ? 'no' : 'yes') as StandingValue, confirmed_at: ago(60 * 28) }]))
  prefs = { locations: ['New York, NY'], work_modes: ['onsite', 'hybrid'], include_keywords: ['data analyst', 'analytics engineer'], exclude_keywords: ['sales'], seniority: ['mid'], min_base_salary: 110000, companies_avoid: [], companies_prefer: ['Example Corp'], min_fit_score: 4, max_per_day: 3, notes: 'Skip roles that need more than 3 days in office.' }
  prefsAt = ago(60 * 27)
}

const profile = (): Profile => ({ resume, facts, suggestions, fields: FIELDS })
function setup() {
  const missing = FIELDS.filter(f => f.required && !(f.key in facts)).map(f => f.key)
  const steps = {
    resume: !!resume,
    details: missing.length === 0,
    standing: STANDING_KEYS.every(k => k.key in standing),
    preferences: !!prefs,
  }
  return { steps, missing_details: missing, complete: Object.values(steps).every(Boolean), mode }
}

function validFact(f: FieldSpec, v: unknown) {
  if (f.type === 'bool') return typeof v === 'boolean'
  if (f.type === 'number') return typeof v === 'number' && v >= 0 && v <= 50
  if (typeof v !== 'string') return false
  if (f.type === 'email') return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)
  if (f.type === 'url') return /^https?:\/\/\S+\.\S+/.test(v)
  if (f.type === 'enum') return !!f.options?.includes(v)
  return v.trim().length > 0
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const bad = (code: string) => new ApiError(400, code)

export async function demoApi<T>(path: string, init: RequestInit, demo: string): Promise<T> {
  if (demo === 'admin-loading') return new Promise<T>(() => {})
  if (demo === 'setup-done' && !seeded) { seeded = true; seedDone() }
  await wait(path === '/me/resume' ? 1400 : 450)
  if (demo === 'admin-error' && path.startsWith('/admin')) throw new Error('Service unavailable')
  if (demo === 'setup-error' && path.startsWith('/me/')) throw new ApiError(404, 'Not Found')
  const method = init.method || 'GET'
  const body = typeof init.body === 'string' ? JSON.parse(init.body) : {}
  const r = (x: unknown) => x as T

  if (path === '/me') return r({ ...demoMe, role: demo === 'user' ? 'user' : 'admin', mode })
  if (path === '/admin/users') return r(users)
  if (path === '/admin/invites' && method === 'GET') return r(invites)
  if (path === '/admin/invites') { invites = [...invites, { email: body.email, created_at: now() }]; return r({ email: body.email }) }
  if (path.startsWith('/admin/invites/')) { const e = decodeURIComponent(path.split('/').pop()!); invites = invites.filter(i => i.email !== e); return r({ removed: e }) }
  const m = path.match(/^\/admin\/users\/(.+)\/status$/)
  if (m) { users = users.map(u => (u.uid === m[1] ? { ...u, status: body.status } : u)); return r({ uid: m[1], status: body.status }) }

  if (path === '/me/setup') return r(setup())
  if (path === '/me/resume' && method === 'POST') {
    const file = (init.body as FormData).get('file') as File
    if (!file.name.toLowerCase().endsWith('.pdf')) throw bad('not_a_pdf')
    if (file.size > 10 * 1024 * 1024) throw bad('too_large')
    if (file.name.toLowerCase().includes('broken')) throw bad('unreadable_pdf')
    resume = { filename: file.name, sha256: 'a'.repeat(64), size: file.size, pages: 1, uploaded_at: now() }
    suggestions = { name: 'Alex Rivera', email: 'alex.rivera@example.com', phone: '+1 555 010 0199', city: 'New York, NY', linkedin: 'https://linkedin.com/in/example', current_company: 'Example Corp', current_title: 'Data Analyst', undergrad_school: 'Example State University', recent_degree: 'bachelor', recent_field: 'Statistics', years_experience: 4 }
    return r({ resume, suggestions })
  }
  if (path === '/me/resume/url') { if (!resume) throw new ApiError(404, 'no_resume'); return r({ url: 'about:blank', expires_in: 300 }) }
  if (path === '/me/profile') return r(profile())
  if (path === '/me/profile/facts') {
    const next = { ...facts }
    for (const [k, v] of Object.entries(body.facts as Record<string, unknown>)) {
      const f = FIELDS.find(x => x.key === k)
      if (!f) throw bad(`unknown_field:${k}`)
      if (v === null || v === '') { delete next[k]; continue }
      if (!validFact(f, v)) throw bad(`invalid_value:${k}`)
      next[k] = { value: v as FactValue, confirmed_at: now() }
    }
    facts = next
    return r(profile())
  }
  if (path === '/me/standing' && method === 'GET') return r({ answers: standing, keys: STANDING_KEYS })
  if (path === '/me/standing') {
    for (const [k, v] of Object.entries(body.answers as Record<string, StandingValue>)) standing = { ...standing, [k]: { value: v, confirmed_at: now() } }
    return r({ answers: standing, keys: STANDING_KEYS })
  }
  if (path === '/me/preferences' && method === 'GET') return r({ preferences: prefs, updated_at: prefsAt })
  if (path === '/me/preferences') {
    const p = body as Preferences
    if (!p.locations.length) throw bad('invalid_value:locations')
    prefs = p; prefsAt = now()
    return r({ preferences: prefs, updated_at: prefsAt })
  }
  if (path === '/me/mode') {
    if (body.mode === 'auto' && !setup().complete) throw bad('setup_incomplete')
    mode = body.mode
    return r({ mode })
  }
  throw new ApiError(404, 'Not Found')
}

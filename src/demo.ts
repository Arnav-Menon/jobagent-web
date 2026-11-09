// Dev-only fixtures for `?demo=…` previews. Made-up people only. Mirrors jobs/docs/API.md.
import { ApiError } from './api'
import type { AdminUser, Application, Draft, FactValue, Run, FieldSpec, Invite, Me, Preferences, Profile, ResumeMeta, SavedAnswer, Standing, StandingSpec, StandingValue } from './api'

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
  prefs = { locations: ['New York, NY'], work_modes: ['onsite', 'hybrid'], include_keywords: ['data analyst', 'analytics engineer'], exclude_keywords: ['sales'], seniority: ['mid'], min_base_salary: 110000, companies_avoid: [], companies_prefer: ['Example Corp'], min_fit_score: 4, max_per_day: 3, notes: 'Skip roles that need more than 3 days in office.', scan_time: '10:00', daily_scan: true, email_notifications: true }
  prefsAt = ago(60 * 27)
}

/* ---------- Phase 4 fixtures: runs, drafts, applications ---------- */
let runs: Run[] = []
let drafts: Draft[] = []
let apps: Application[] = []
let saved: SavedAnswer[] = [{ question: "What's your go-to programming language?", answer: 'Python', saved_at: ago(60 * 24) }]
const qkey = (t: string) => t.replace(/\((required|optional)\)\s*$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const today = () => new Date().toISOString().slice(0, 10)

const planFor = (company: string): Draft['plan'] => [
  { label: 'Full name', kind: 'text', value: 'Alex Rivera', source: 'profile' },
  { label: 'Email', kind: 'email', value: 'alex.rivera@example.com', source: 'profile' },
  { label: 'Phone', kind: 'tel', value: '+1 555 010 0199', source: 'profile' },
  { label: 'Resume', kind: 'file', value: 'Alex_Rivera_Resume.pdf', source: 'resume' },
  { label: 'Are you legally authorized to work in the United States?', kind: 'radio', value: 'Yes', source: 'profile' },
  { label: 'Will you now or in the future require sponsorship?', kind: 'radio', value: 'No', source: 'profile' },
  { label: `Why are you interested in ${company}?`, kind: 'textarea', value: 'I have spent four years building analytics pipelines with SQL and dbt, and your team works on the same kind of problems.', source: 'resume draft (quoted)' },
  { label: 'LinkedIn profile', kind: 'url', value: null, source: 'not in profile (optional)' },
  { label: 'How did you hear about us?', kind: 'select', value: null, source: 'how-heard left blank', options: ['LinkedIn', 'A friend', 'Job board', 'Other'] },
  { label: 'Gender', kind: 'select', value: 'Decline to self-identify', source: 'policy: demographics declined' },
]

function seedResults() {
  runs = [
    { id: 'r3', kind: 'discover', status: 'done', trigger: 'daily', created_at: ago(60 * 5), started_at: ago(60 * 5 - 1), finished_at: ago(60 * 5 - 9), counts: { scanned: 214, eligible: 9, scored: 9, drafts: 2, held: 1 } },
    { id: 'r2', kind: 'apply', status: 'done', trigger: 'approval', created_at: ago(60 * 26), started_at: ago(60 * 26 - 1), finished_at: ago(60 * 26 - 3), counts: { submitted: 1, pending: 0 } },
    { id: 'r1', kind: 'discover', status: 'failed', trigger: 'daily', created_at: ago(60 * 24 * 2), started_at: ago(60 * 24 * 2 - 1), finished_at: ago(60 * 24 * 2 - 4), error: 'board_unavailable' },
  ]
  drafts = [
    { key: 'd1', status: 'awaiting_approval', company: 'Northwind Analytics', title: 'Analytics Engineer', url: 'https://example.com/jobs/1', provider: 'greenhouse', score: 4.4, confidence: 'high', plan: planFor('Northwind Analytics'), holds: [], created_at: ago(60 * 5 - 8), updated_at: ago(60 * 5 - 8) },
    { key: 'd2', status: 'awaiting_approval', company: 'Contoso Health', title: 'Senior Data Analyst, Growth', url: 'https://example.com/jobs/2', provider: 'ashby', score: 4.1, confidence: 'medium', plan: planFor('Contoso Health').slice(0, 7), holds: [], created_at: ago(60 * 5 - 7), updated_at: ago(60 * 5 - 7) },
    { key: 'd3', status: 'held', company: 'Fabrikam Labs', title: 'Data Analyst', url: 'https://example.com/jobs/3', provider: 'lever', score: 4.0, plan: planFor('Fabrikam Labs').slice(0, 6), holds: ['needs your standing answer (background_check_consent): Do you consent to a background check?', 'start date needed: When can you start?', "required question has no matching answer/option: Bachelor's Graduation Year [radio] options=['2027 / later', '2026', '2025', '2024 / earlier']"], open_questions: [
      { label: 'When can you start?', kind: 'text', required: true, options: [], reason: 'start date needed: When can you start?' },
      { label: "Bachelor's Graduation Year", kind: 'radio', required: true, options: ['2027 / later', '2026', '2025', '2024 / earlier'], reason: "required question has no matching answer/option: Bachelor's Graduation Year [radio] options=['2027 / later', '2026', '2025', '2024 / earlier']" },
    ], created_at: ago(60 * 5 - 6), updated_at: ago(60 * 5 - 6) },
    { key: 'd4', status: 'needs_you', company: 'Tailspin Toys', title: 'Data Engineer', url: 'https://example.com/jobs/4', provider: 'ashby', score: 4.3, plan: planFor('Tailspin Toys'), holds: [], outcome: 'CAPTCHA_CHALLENGE', created_at: ago(60 * 7), updated_at: ago(60 * 6) },
    { key: 'd0', status: 'submitted', company: 'Example Corp', title: 'Data Analyst II', url: 'https://example.com/jobs/0', provider: 'ashby', score: 4.6, plan: planFor('Example Corp'), holds: [], outcome: 'VISIBLE_SUCCESS', created_at: ago(60 * 30), updated_at: ago(60 * 26 - 3) },
  ]
  apps = [
    { key: 'd0', state: 'SUBMITTED', company: 'Example Corp', title: 'Data Analyst II', url: 'https://example.com/jobs/0', quota_day: ago(60 * 26).slice(0, 10), updated_at: ago(60 * 26 - 3) },
    { key: 'dx', state: 'PENDING_VERIFICATION', company: 'Tailspin Toys', title: 'Business Intelligence Analyst', url: 'https://example.com/jobs/9', quota_day: ago(60 * 24 * 6).slice(0, 10), updated_at: ago(60 * 24 * 6) },
  ]
}

// Advance fake runs with wall-clock time so polling shows queued → running → done.
function tick() {
  const t = Date.now()
  runs = runs.map(r => {
    if (r.status === 'done' || r.status === 'failed') return r
    const age = (t - new Date(r.created_at).getTime()) / 1000
    if (age < 4) return r
    if (age < 14) return { ...r, status: 'running', started_at: r.started_at || new Date(t).toISOString(), counts: r.kind === 'discover' ? { scanned: Math.round(age * 12) } : r.counts }
    if (r.kind === 'replan') {
      const mine = (d: Draft) => ({ ...Object.fromEntries(saved.map(a => [qkey(a.question), a.answer])), ...Object.fromEntries(Object.entries(d.my_answers || {}).map(([q, a]) => [qkey(q), a])) })
      drafts = drafts.map(d => {
        if (!d.updating) return d
        const m = mine(d)
        const plan = d.plan.map(p => (p.value === null && m[qkey(p.label)] ? { ...p, value: m[qkey(p.label)], source: 'your answer' } : p))
        const open = (d.open_questions || []).filter(q => !m[qkey(q.label)])
        const answered = (d.open_questions || []).filter(q => m[qkey(q.label)]).map(q => ({ label: q.label, kind: q.kind, value: m[qkey(q.label)], source: 'your answer', options: q.options }))
        const holds = d.holds.filter(h => !(d.open_questions || []).some(q => q.reason === h && m[qkey(q.label)]))
        return { ...d, plan: [...plan, ...answered], open_questions: open, holds, status: holds.length ? 'held' : 'awaiting_approval', updating: false, updated_at: now() }
      })
      return { ...r, status: 'done', finished_at: now(), counts: { updated: 1, drafts: 1 } }
    }
    if (r.kind === 'apply') {
      const key = r.id.replace('apply-', '')
      drafts = drafts.map(d => (d.key === key ? { ...d, status: 'submitted', outcome: 'VISIBLE_SUCCESS', updated_at: now() } : d))
      const d = drafts.find(x => x.key === key)!
      apps = [{ key, state: 'SUBMITTED', company: d.company, title: d.title, url: d.url, quota_day: today(), updated_at: now() }, ...apps.filter(a => a.key !== key)]
      return { ...r, status: 'done', finished_at: now(), counts: { submitted: 1, pending: 0 } }
    }
    drafts = [{ key: `d${t}`, status: 'awaiting_approval', company: 'Woodgrove Bank', title: 'Data Analyst, Risk', url: 'https://example.com/jobs/7', provider: 'greenhouse', score: 4.2, confidence: 'medium', plan: planFor('Woodgrove Bank'), holds: [], created_at: now(), updated_at: now() }, ...drafts]
    return { ...r, status: 'done', finished_at: now(), counts: { scanned: 168, eligible: 6, scored: 6, drafts: 1, held: 0 } }
  })
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
  if ((demo === 'setup-done' || demo.startsWith('results')) && !seeded) { seeded = true; seedDone(); if (demo === 'results') seedResults() }
  tick()
  await wait(path === '/me/resume' ? 1400 : 450)
  if (demo === 'admin-error' && path.startsWith('/admin')) throw new Error('Service unavailable')
  if (demo === 'setup-error' && path.startsWith('/me/')) throw new ApiError(404, 'Not Found')
  const method = init.method || 'GET'
  const body = typeof init.body === 'string' ? JSON.parse(init.body) : {}
  const r = (x: unknown) => x as T

  if (path === '/me') return r({ ...demoMe, role: demo === 'user' ? 'user' : 'admin', mode })
  if (path === '/admin/users') return r(users)
  if (path === '/admin/stats') return r({
    worker: { heartbeat_at: new Date(Date.now() - 40_000).toISOString(), host: 'worker-vm' }, model_calls_cap: 40,
    runs_7d: { done: 18, failed: 1 }, top_holds: [['needs your standing answer', 3], ['not in profile', 1]],
    queue: [{ id: 'r-q1', uid: users[1]?.uid || 'u2', kind: 'discover', status: 'queued', created_at: now(), trigger: 'daily' }],
    users: users.map((u, i) => ({ uid: u.uid, display_name: u.display_name, email: u.email, status: u.status, mode: u.mode, last_seen_at: u.last_seen_at,
      last_run: { id: 'r' + i, kind: 'discover', status: i === 2 ? 'failed' : 'done', created_at: now() },
      runs_7d: { done: 5 - i, failed: i === 2 ? 1 : 0, queued: 0, running: 0, cancelled: 0 },
      drafts: { awaiting_approval: i, held: i === 1 ? 2 : 0, needs_you: i === 0 ? 1 : 0, scheduled: i === 0 ? 1 : 0 },
      applications: { submitted_today: i === 0 ? 2 : 0, submitted_7d: 4 - i, submitted_total: 9 - i, pending: i === 0 ? 1 : 0, not_sent: 0, failed: 0 },
      model_calls: { today: 12 - i * 3, '7d': 60 - i * 10 }, top_holds: i === 1 ? [['needs your standing answer', 2]] : [] })),
  })
  if (path.startsWith('/admin/runs?')) return r([
    { id: 'run-a', kind: 'discover', status: 'done', trigger: 'manual', created_at: now(), uid: 'u1', user: 'Alex Rivera', counts: { eligible: 90, scored: 10, drafts: 2, held: 1 } },
    { id: 'run-b', kind: 'apply', status: 'done', trigger: 'approval', created_at: now(), uid: 'u1', user: 'Alex Rivera', counts: { submitted: 1 } },
  ])
  if (path.endsWith('/decisions')) return r({ run: { id: 'run-a' }, log: {
    kind: 'discover', created_at: now(), score_budget: 10, model_calls_left_before: 30,
    settings: { include_keywords: ['data analyst'], seniority: ['junior', 'mid'], min_fit_score: 3, mode: 'review' },
    funnel: { scanned: 5209, already_applied_or_drafted: 4, excluded_company: 0, rejected_by_filters: 5115, passed_filters: 90 },
    rejected_reasons: [['title lacks include keywords', 4900], ['location not in preferences', 2400]], only_reason: [['title lacks include keywords', 381]],
    jobs: [
      { company: 'Example Corp', title: 'Data Analyst', url: 'https://example.com/job', outcome: 'scored', score: 4, confidence: 'medium', decision: 'meets_minimum', draft_status: 'awaiting_approval', location: 'New York, NY', salary_max: 140000, seniority: 'mid',
        detail: { rationale: 'Strong SQL and dashboard evidence; stakeholder scope partly shown.', dimensions: { cv_match: 4, north_star: 4, compensation: 3, culture: null, red_flags: 4 }, met: ['SQL', 'Dashboards'], missing: ['3+ years experience'], open_questions: ['Office days per week?'] } },
      { company: 'Acme', title: 'Analytics Engineer', outcome: 'scored', score: 2, confidence: 'low', decision: 'below_minimum', detail: { rationale: 'Requires dbt ownership not shown.', dimensions: {}, met: [], missing: ['dbt'], open_questions: [] } },
      { company: 'Initech', title: 'Data Analyst II', outcome: 'score_failed', reason: 'Model service returned HTTP 429' },
      { company: 'Globex', title: 'Analyst', outcome: 'not_scored_budget' },
    ] } })
  if (path.startsWith('/admin/runs/')) return r({ id: path.split('/')[3], status: 'cancelled' })
  if (path === '/me/export') return r({ exported_at: now(), account: demoMe, preferences: { preferences: prefs } })
  if (path === '/me/delete') return r({ deleted: true })
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
  if (path === '/me/runs' && method === 'GET') return r(runs)
  if (path === '/me/runs') {
    if (!setup().complete) throw bad('setup_incomplete')
    if (runs.some(x => x.status === 'queued' || x.status === 'running')) throw new ApiError(409, 'run_in_progress')
    const run: Run = { id: `r${Date.now()}`, kind: 'discover', status: 'queued', trigger: 'manual', created_at: now() }
    runs = [run, ...runs]
    return r(run)
  }
  if (path.startsWith('/me/drafts?')) { const st = new URLSearchParams(path.split('?')[1]).get('status'); return r(drafts.filter(d => !st || d.status === st)) }
  if (path === '/me/drafts') return r(drafts)
  const done = path.match(/^\/me\/drafts\/([^/]+)\/done$/)
  if (done) {
    const d = drafts.find(x => x.key === done[1])
    if (!d || !['needs_you', 'awaiting_approval', 'held', 'scheduled'].includes(d.status)) throw new ApiError(409, 'not_awaiting_approval')
    const status = body.how === 'submitted' ? 'submitted_by_you' : 'dismissed'
    drafts = drafts.map(x => (x.key === d.key ? { ...x, status, updated_at: now() } : x)); return r({ key: d.key, status })
  }
  if (path === '/me/answers' && method === 'GET') return r({ answers: saved })
  if (path === '/me/answers') {
    saved = (body.answers as SavedAnswer[]).map(a => ({ ...a, saved_at: saved.find(x => x.question === a.question && x.answer === a.answer)?.saved_at || now() }))
    return r({ answers: saved, replan_run: null })
  }
  const da = path.match(/^\/me\/drafts\/([^/]+)\/answers$/)
  if (da) {
    const d = drafts.find(x => x.key === decodeURIComponent(da[1]))
    if (!d) throw new ApiError(404, 'unknown_draft')
    const ans = body.answers as { question: string; answer: string; remember: boolean }[]
    if (ans.some(a => /gender|race|veteran|disabilit/i.test(a.question))) throw bad('demographic_question')
    const mine = { ...(d.my_answers || {}) }
    let remembered = 0
    for (const a of ans) {
      mine[a.question] = a.answer
      if (a.remember) { saved = [...saved.filter(x => qkey(x.question) !== qkey(a.question)), { question: a.question, answer: a.answer, saved_at: now() }]; remembered++ }
    }
    drafts = drafts.map(x => (x.key === d.key ? { ...x, my_answers: mine, updating: true } : x))
    const run: Run = { id: `replan-${Date.now()}`, kind: 'replan', status: 'queued', trigger: 'answers', created_at: now() }
    runs = [run, ...runs]
    return r({ key: d.key, updating: true, run_id: run.id, remembered })
  }
  const dm = path.match(/^\/me\/drafts\/([^/]+)\/(approve|reject|screens)$/)
  if (dm) {
    const d = drafts.find(x => x.key === decodeURIComponent(dm[1]))
    if (!d) throw new ApiError(404, 'not_found')
    if (dm[2] === 'screens') return r(d.status === 'submitted' ? { filled: 'about:blank', result: 'about:blank', expires_in: 300 } : { expires_in: 300 })
    if (d.status !== 'awaiting_approval' && !(dm[2] === 'reject' && d.status === 'scheduled')) throw new ApiError(409, 'not_awaiting_approval')
    if (dm[2] === 'reject') { drafts = drafts.map(x => (x.key === d.key ? { ...x, status: 'rejected', updated_at: now() } : x)); return r({ key: d.key, status: 'rejected' }) }
    drafts = drafts.map(x => (x.key === d.key ? { ...x, status: 'approved', updated_at: now() } : x))
    const run: Run = { id: `apply-${d.key}`, kind: 'apply', status: 'queued', trigger: 'approval', created_at: now() }
    runs = [run, ...runs]
    return r({ key: d.key, status: 'approved', run_id: run.id })
  }
  if (path === '/me/applications') return r(apps)
  throw new ApiError(404, 'Not Found')
}

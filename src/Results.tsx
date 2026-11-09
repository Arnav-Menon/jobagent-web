import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, DEMO, type Application, type Decision, type AppState, type Draft, type Me, type Run, type Screens, type SetupStatus } from './api'
import { errorText } from './errors'
import { Icon, Skeleton, fullTime, relTime, useToast } from './ui'
import { AnswerForm, ApplyMyself, CopyAnswers, canAnswer, formUrl, type AnswerIn } from './answers'

export type SetupTarget = 'resume' | 'details' | 'standing' | 'preferences' | 'mode'
const POLL_MS = import.meta.env.DEV && DEMO ? 3000 : 20000
/** "tomorrow" / "Monday, Nov 9" for a YYYY-MM-DD New York date. */
function dayName(iso?: string) {
  if (!iso) return 'the next weekday'
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const ny = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const days = Math.round((target.getTime() - new Date(ny.getFullYear(), ny.getMonth(), ny.getDate()).getTime()) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  return target.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

/** A run that blocks a new search. An application queued for the sending machine (e.g. a sleeping Mac) doesn't. */
const active = (r: Run) => r.status === 'running' || (r.status === 'queued' && r.kind !== 'apply')

/* ---------- small helpers ---------- */

function duration(a?: string, b?: string) {
  if (!a || !b) return ''
  const s = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000))
  return s < 60 ? `${s}s` : `${Math.round(s / 60)} min`
}

function countsText(r: Run): string {
  const c = r.counts || {}
  const parts: string[] = []
  if (r.kind === 'apply') {
    if (c.submitted) parts.push(`${c.submitted} submitted`)
    if (c.pending) parts.push(`${c.pending} unconfirmed`)
  } else if (r.kind === 'replan') {
    if (c.drafts) parts.push(`${c.drafts} ready for you`)
    if (c.held) parts.push(`${c.held} still held`)
    if (c.update_failed) parts.push(`${c.update_failed} couldn’t be updated`)
  } else {
    if (c.scanned != null) parts.push(`${c.scanned} jobs checked`)
    if (c.eligible != null) parts.push(`${c.eligible} matched your rules`)
    if (c.drafts) parts.push(`${c.drafts} ready for you`)
    if (c.held) parts.push(`${c.held} held`)
    if (c.submitted) parts.push(`${c.submitted} submitted`)
  }
  return parts.join(', ')
}

const RUN_ERRORS: Record<string, string> = {}
const runName = (r: Run) =>
  r.kind === 'replan' ? 'Updating applications with your answers' : r.kind === 'apply' ? (r.trigger === 'scheduled' ? 'Submitting scheduled application' : 'Submitting approved application') : r.trigger === 'manual' ? 'Search you started' : 'Daily search'

const STATE: Record<AppState, { label: string; tone: string; hint: string }> = {
  SUBMITTED: { label: 'Submitted', tone: 'ok', hint: 'The company’s confirmation page was seen.' },
  PENDING_VERIFICATION: { label: 'Unconfirmed', tone: 'held', hint: 'It may have been sent, but no confirmation page was seen. Check your email for a confirmation. It won’t be retried.' },
  SUBMITTING: { label: 'Submitting', tone: 'accent', hint: 'Being submitted now.' },
  FAILED: { label: 'Failed', tone: 'danger', hint: 'Not submitted. It won’t be retried automatically.' },
  NOT_SENT: { label: 'Not sent', tone: 'plain', hint: 'The agent stopped before anything was sent, usually because of a CAPTCHA. It doesn’t count against your limit. Submit it yourself if you still want it.' },
}

const PROVIDER: Record<string, string> = { ashby: 'Ashby', greenhouse: 'Greenhouse', lever: 'Lever', 'lever-eu': 'Lever' }

/** Map a hold reason (worker `Hold(...)` messages) to the setup step that fixes it, if any. */
function holdFix(reason: string): { step: SetupTarget; label: string } | null {
  const r = reason.toLowerCase()
  if (r.includes('your saved answer')) return { step: 'standing', label: 'Review saved answers' }
  if (r.includes('standing answer')) return { step: 'standing', label: 'Review standing answers' }
  if (r.includes('resume digest')) return { step: 'resume', label: 'Check your resume' }
  if (/not in profile|phone confirmed only|no experience option fits/.test(r)) return { step: 'details', label: 'Check your details' }
  if (/preferences exclude|office is in a city|office location/.test(r)) return { step: 'preferences', label: 'Review preferences' }
  return null
}

/* ---------- page ---------- */

type ResultsData = [SetupStatus, Run[], Draft[], Application[]]
const fetchResults = (): Promise<ResultsData> => Promise.all([
  api<SetupStatus>('/me/setup'), api<Run[]>('/me/runs'), api<Draft[]>('/me/drafts'), api<Application[]>('/me/applications'),
])
let prefetched: { at: number; data: Promise<ResultsData> } | null = null
/** Start loading Results data alongside /me so the first paint needs one parallel round trip, not several. */
export function prefetchResults(): Promise<ResultsData> {
  const data = fetchResults()
  data.catch(() => {}) // the consumer reports errors; avoid an unhandled rejection if unused
  prefetched = { at: Date.now(), data }
  return data
}
/** Use the prefetched data once, and only if fresh (e.g. not after sitting on Setup for a while). */
function takePrefetch() {
  const p = prefetched; prefetched = null
  return p && Date.now() - p.at < 15_000 ? p.data : null
}

export default function Results({ me, goSetup }: { me: Me; goSetup: (s: SetupTarget) => void }) {
  const toast = useToast()
  const [setup, setSetup] = useState<SetupStatus | null>(null)
  const [runs, setRuns] = useState<Run[] | null>(null)
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [apps, setApps] = useState<Application[] | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [starting, setStarting] = useState(false)
  const [startErr, setStartErr] = useState<{ text: string; setup?: boolean } | null>(null)
  const wasActive = useRef(false)

  const loadAll = useCallback(async () => {
    try {
      const [s, r, d, a] = await (takePrefetch() || fetchResults())
      setSetup(s); setRuns(r); setDrafts(d.map(x => ({ ...x, plan: x.plan || [], holds: x.holds || [] }))); setApps(a); setLoadErr('')
      wasActive.current = r.some(active)
    } catch (e) { setLoadErr(errorText(e)) }
  }, [])
  useEffect(() => { loadAll() }, [loadAll])

  const running = runs?.find(active)

  // Poll runs while one is queued or running; reload everything when it finishes.
  useEffect(() => {
    if (!running) return
    const t = setInterval(async () => {
      try {
        const r = await api<Run[]>('/me/runs')
        setRuns(r)
        if (wasActive.current && !r.some(active)) {
          wasActive.current = false
          const fin = r[0]
          toast(fin?.status === 'failed' ? (fin?.kind === 'replan' ? 'Updating stopped with an error. Try answering again.' : 'The search stopped with an error.')
            : fin?.kind === 'apply' ? 'Submission finished. See Applications below.' : fin?.kind === 'replan' ? 'Updated with your answers.' : 'Search finished.',
            fin?.status === 'failed' ? 'danger' : 'ok')
          loadAll()
        }
      } catch { /* keep polling; transient errors are fine */ }
    }, POLL_MS)
    return () => clearInterval(t)
  }, [running, loadAll, toast])

  const start = async () => {
    setStarting(true); setStartErr(null)
    try {
      const run = await api<Run>('/me/runs', { method: 'POST' })
      setRuns(r => [run, ...(r || [])]); wasActive.current = true
      toast('Search started. This page updates while it runs.')
    } catch (e) {
      if (e instanceof ApiError && e.detail === 'setup_incomplete') setStartErr({ text: 'Finish setup before searching. Every setup step needs to be done first.', setup: true })
      else if (e instanceof ApiError && e.detail === 'run_in_progress') { setStartErr({ text: errorText(e) }); loadAll() }
      else setStartErr({ text: errorText(e) })
    } finally { setStarting(false) }
  }

  const answer = async (d: Draft, answers: AnswerIn[]): Promise<string | null> => {
    try {
      const res = await api<{ remembered: number }>(`/me/drafts/${encodeURIComponent(d.key)}/answers`, { method: 'POST', body: JSON.stringify({ answers }) })
      toast(`Saved${res.remembered ? ` (${res.remembered} remembered for future forms)` : ''}. Updating ${d.company} with your answers. This takes a minute.`)
      wasActive.current = true
      await loadAll()
      return null
    } catch (e) {
      if (e instanceof ApiError && (e.detail === 'not_awaiting_approval' || e.detail === 'unknown_draft' || e.detail === 'unknown_question')) loadAll()
      return errorText(e)
    }
  }

  const finish = async (d: Draft, how: 'submitted' | 'skipped') => {
    try {
      await api(`/me/drafts/${encodeURIComponent(d.key)}/done`, { method: 'POST', body: JSON.stringify({ how }) })
      toast(how === 'submitted' ? `Noted: you submitted ${d.company} yourself.` : `Skipped ${d.company}.`)
      await loadAll()
    } catch (e) {
      toast(errorText(e), 'danger')
      if (e instanceof ApiError && (e.detail === 'not_awaiting_approval' || e.detail === 'unknown_draft')) loadAll()
    }
  }

  const decide = async (d: Draft, action: 'approve' | 'reject') => {
    try {
      const res = await api<Decision>(`/me/drafts/${encodeURIComponent(d.key)}/${action}`, { method: 'POST' })
      if (res.status === 'scheduled') {
        const day = dayName(res.scheduled_for)
        toast(res.reason === 'weekend'
          ? `Approved. Applications only go out on weekdays, so ${d.company} is scheduled for ${day}.`
          : `You’ve reached today’s limit. ${d.company} is approved and scheduled for ${day}.`, 'held')
      } else {
        toast(action === 'approve' ? `Approved. Submitting your application to ${d.company} shortly.` : `Rejected. ${d.company} won’t get this application.`)
        wasActive.current = action === 'approve' || wasActive.current
      }
      await loadAll()
      return true
    } catch (e) {
      toast(errorText(e), 'danger')
      if (e instanceof ApiError && (e.detail === 'not_awaiting_approval' || e.detail === 'unknown_draft')) loadAll()
      return false
    }
  }

  const loading = runs === null && !loadErr
  const awaiting = drafts?.filter(d => d.status === 'awaiting_approval') || []
  const held = drafts?.filter(d => d.status === 'held') || []
  const needsYou = drafts?.filter(d => d.status === 'needs_you') || []
  const scheduled = (drafts?.filter(d => d.status === 'scheduled') || []).sort((a, b) => (a.scheduled_for || '').localeCompare(b.scheduled_for || ''))
  const inFlight = drafts?.filter(d => d.status === 'approved' || d.status === 'submitting') || []
  const mode = setup?.mode || me.mode
  const ready = setup?.complete ?? true

  return (
    <div className="page results">
      <div className="page-head results-head">
        <div>
          <h1>Results</h1>
          <p className="sub">
            {mode === 'auto'
              ? 'Applications that pass your rules are sent automatically. Anything that needs you shows up here.'
              : 'Applications wait here for your approval. Nothing is submitted until you approve it.'}
          </p>
        </div>
        <div className="head-action">
          <button className="btn btn-primary" onClick={start} disabled={starting || !!running || loading || !ready}>
            {running ? <><span className="spinner spinner-sm" aria-hidden="true" /> {running.kind === 'apply' ? 'Submitting…' : running.kind === 'replan' ? 'Updating…' : 'Searching…'}</> : starting ? 'Starting…' : 'Find jobs now'}
          </button>
          <p className="hint">Also runs automatically every weekday.</p>
        </div>
      </div>

      {loadErr && (
        <div className="notice tone-danger" role="alert">
          <Icon name="alert" />
          <p>Couldn’t load your results. {loadErr}</p>
          <button className="btn btn-quiet btn-sm" onClick={() => { setLoadErr(''); loadAll() }}><Icon name="refresh" size={16} /> Try again</button>
        </div>
      )}
      {setup && !setup.complete && (
        <div className="notice tone-held">
          <Icon name="alert" size={16} />
          <p>Finish setup to start searching. Searches only use answers you’ve confirmed.</p>
          <button className="btn btn-quiet btn-sm" onClick={() => goSetup(Object.entries(setup.steps).find(([, v]) => !v)?.[0] as SetupTarget || 'resume')}>Go to setup</button>
        </div>
      )}
      {startErr && (
        <div className="notice tone-held" role="alert">
          <Icon name="alert" size={16} />
          <p>{startErr.text}</p>
          {startErr.setup && <button className="btn btn-quiet btn-sm" onClick={() => goSetup('resume')}>Go to setup</button>}
        </div>
      )}

      {running && <RunBanner run={running} />}

      {loading ? <ResultsSkeleton /> : !loadErr && (
        <>
          <section className="r-section" aria-labelledby="awaiting-title">
            <div className="r-head">
              <h2 id="awaiting-title">Waiting for your approval</h2>
              {awaiting.length > 0 && <span className="count">{awaiting.length}</span>}
            </div>
            {awaiting.length === 0 ? (
              <div className="empty-panel">
                <p className="empty-title">Nothing to approve right now.</p>
                <p>
                  {mode === 'auto'
                    ? 'In automatic mode, applications that pass your rules are sent without waiting here. Only ones you choose to review would appear.'
                    : 'Each weekday the agent searches company career boards for roles that match your preferences and prepares the applications. They wait here for you to approve or reject.'}
                </p>
              </div>
            ) : (
              <div className="drafts">{awaiting.map(d => <DraftCard key={d.key} d={d} name={me.display_name || me.email} onDecide={decide} onAnswer={answer} onFinish={finish} />)}</div>
            )}
            {inFlight.length > 0 && (
              <ul className="inflight">
                {inFlight.map(d => (
                  <li key={d.key}><span className="spinner spinner-sm" aria-hidden="true" /> <span><strong>{d.company}</strong>, {d.title}: {d.status === 'submitting' ? 'submitting now.' : 'approved, waiting to be sent.'}</span></li>
                ))}
              </ul>
            )}
          </section>

          {needsYou.length > 0 && (
            <section className="r-section" aria-labelledby="needs-title">
              <div className="r-head">
                <h2 id="needs-title">Needs you to submit</h2>
                <span className="count tone-held">{needsYou.length}</span>
              </div>
              <p className="r-sub">A CAPTCHA (or the page itself) stopped the agent before it sent anything. The agent never solves CAPTCHAs, so these are yours to finish. Nothing was sent, and they don’t count against your daily limit.</p>
              <div className="drafts">{needsYou.map(d => <NeedsYouCard key={d.key} d={d} onFinish={finish} />)}</div>
            </section>
          )}

          {scheduled.length > 0 && (
            <section className="r-section" aria-labelledby="scheduled-title">
              <div className="r-head">
                <h2 id="scheduled-title">Scheduled</h2>
                <span className="count">{scheduled.length}</span>
              </div>
              <p className="r-sub">You approved these after reaching your daily limit. Each one is submitted on its day, after 9am New York time, with the answers you approved. Nothing has been sent yet.</p>
              <ul className="held">
                {scheduled.map(d => (
                  <li key={d.key} className="held-item sched-item">
                    <div className="held-top">
                      <JobTitle d={d} />
                      <span className="when">{dayName(d.scheduled_for)}</span>
                    </div>
                    <div className="sched-actions">
                      <button className="link-btn" onClick={() => decide(d, 'reject')}>Cancel this application</button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {held.length > 0 && (
            <section className="r-section" aria-labelledby="held-title">
              <div className="r-head">
                <h2 id="held-title">Held</h2>
                <span className="count tone-held">{held.length}</span>
              </div>
              <p className="r-sub">These matched your rules but can’t be submitted yet. Nothing was typed or sent. Answer what’s missing here, or fill the application in yourself.</p>
              <ul className="held">
                {held.map(d => <HeldCard key={d.key} d={d} goSetup={goSetup} onAnswer={answer} onFinish={finish} />)}
              </ul>
            </section>
          )}

          <section className="r-section" aria-labelledby="apps-title">
            <div className="r-head"><h2 id="apps-title">Applications</h2></div>
            <Applications apps={apps || []} />
          </section>

          <section className="r-section" aria-labelledby="runs-title">
            <div className="r-head"><h2 id="runs-title">Recent searches</h2></div>
            {runs && runs.length > 0 ? (
              <ul className="runs">
                {runs.map(r => (
                  <li key={r.id} className={`run run-${r.status}`}>
                    <span className="run-dot" aria-hidden="true" />
                    <div className="run-main">
                      <p className="run-name">{runName(r)}</p>
                      <p className="run-meta">
                        {r.status === 'failed' ? `Stopped with an error${r.error ? ` (${RUN_ERRORS[r.error] || r.error})` : ''}.` : r.status === 'queued' ? 'Waiting to start.' : r.status === 'running' ? 'Running now.' : countsText(r) || 'Finished.'}
                      </p>
                    </div>
                    <div className="run-time">
                      <time dateTime={r.created_at} title={fullTime(r.created_at)}>{relTime(r.created_at)}</time>
                      {r.finished_at && <span>took {duration(r.started_at || r.created_at, r.finished_at)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-panel">
                <p className="empty-title">No searches yet.</p>
                <p>The first search runs on the next weekday, or start one now with Find jobs now.</p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

/* ---------- pieces ---------- */

function RunBanner({ run }: { run: Run }) {
  const c = countsText(run)
  return (
    <div className="run-banner" role="status">
      <span className="spinner" aria-hidden="true" />
      <div>
        <p className="run-banner-title">
          {run.kind === 'apply'
            ? (run.status === 'queued' ? 'Submission queued. It will start in a moment.' : 'Submitting your approved application…')
            : run.kind === 'replan'
              ? (run.status === 'queued' ? 'Update queued. It starts after anything already running.' : 'Re-reading the application with your answers. Nothing is submitted…')
              : (run.status === 'queued' ? 'Search queued. It will start in a moment.' : 'Searching career boards for matching roles…')}
        </p>
        <p className="run-banner-meta">Started {relTime(run.started_at || run.created_at).toLowerCase()}{c ? `. ${c[0].toUpperCase()}${c.slice(1)} so far.` : '.'} This page updates on its own.</p>
      </div>
    </div>
  )
}

function JobTitle({ d }: { d: Pick<Draft, 'company' | 'title' | 'url'> }) {
  return (
    <div className="job">
      <p className="job-co">{d.company}</p>
      <a className="job-title" href={d.url} target="_blank" rel="noopener noreferrer">{d.title}<span className="sr-only"> (opens job posting in a new tab)</span></a>
    </div>
  )
}

function NeedsYouCard({ d, onFinish }: { d: Draft; onFinish: (d: Draft, how: 'submitted' | 'skipped') => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const count = d.plan.filter(p => p.value !== null && p.kind !== 'file').length
  const act = async (how: 'submitted' | 'skipped') => { setBusy(true); await onFinish(d, how); setBusy(false) }
  return (
    <article className="draft needs-card" aria-label={`${d.company}, ${d.title}`}>
      <div className="held-top">
        <JobTitle d={d} />
        <span className="when">{d.outcome === 'CAPTCHA_CHALLENGE' ? 'CAPTCHA appeared' : 'No confirmation, nothing sent'}</span>
      </div>
      <p className="draft-meta">Open the application, paste the answers you approved, attach your resume and submit it yourself.</p>
      <div className="needs-actions">
        <a className="btn btn-primary btn-sm" href={formUrl(d)} target="_blank" rel="noopener noreferrer">Open application<span className="sr-only"> (new tab)</span></a>
        <button className="disclose" aria-expanded={open} aria-controls={`needs-${d.key}`} onClick={() => setOpen(o => !o)}>
          <span className="chev" aria-hidden="true" /> {open ? 'Hide answers' : `Show ${count} answers to copy`}
        </button>
      </div>
      {open && <CopyAnswers rows={d.plan} id={`needs-${d.key}`} />}
      <div className="needs-actions needs-done">
        <button className="btn btn-quiet btn-sm" disabled={busy} onClick={() => act('skipped')}>Skip it</button>
        <button className="btn btn-quiet btn-sm" disabled={busy} onClick={() => act('submitted')}>I submitted it</button>
      </div>
    </article>
  )
}

type AnswerFn = (d: Draft, answers: AnswerIn[]) => Promise<string | null>
type FinishFn = (d: Draft, how: 'submitted' | 'skipped') => Promise<void>

function Updating({ d }: { d: Draft }) {
  if (d.updating) return <p className="updating" role="status"><span className="spinner spinner-sm" aria-hidden="true" /> Updating with your answers. This takes a minute.</p>
  if (d.update_error) return <p className="updating tone-danger"><Icon name="alert" size={15} /> {d.update_error}</p>
  return null
}

function DraftCard({ d, name, onDecide, onAnswer, onFinish }: {
  d: Draft; name: string; onDecide: (d: Draft, a: 'approve' | 'reject') => Promise<boolean>; onAnswer: AnswerFn; onFinish: FinishFn
}) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [myself, setMyself] = useState(false)
  const [answering, setAnswering] = useState<number | null>(null)
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const filled = d.plan.filter(p => p.value !== null).length
  const confirmRef = useRef<HTMLButtonElement>(null)

  const act = async (a: 'approve' | 'reject') => {
    setBusy(a)
    const ok = await onDecide(d, a)
    if (!ok) { setBusy(null); setConfirming(false) }
  }
  const askApprove = () => { setOpen(true); setConfirming(true); requestAnimationFrame(() => confirmRef.current?.focus()) }
  const save = async (answers: AnswerIn[]) => {
    const err = await onAnswer(d, answers)
    if (!err) setAnswering(null)
    return err
  }

  return (
    <article className={`draft${confirming ? ' confirming' : ''}`} aria-labelledby={`dt-${d.key}`}>
      <div className="draft-top">
        <div className="job" id={`dt-${d.key}`}>
          <p className="job-co">{d.company}</p>
          <a className="job-title" href={d.url} target="_blank" rel="noopener noreferrer">{d.title}<span className="sr-only"> (opens job posting in a new tab)</span></a>
        </div>
        {d.score != null && (
          <span className="fit" title={d.confidence ? `Model confidence: ${d.confidence}` : undefined}>
            <span className="fit-n">{d.score.toFixed(1)}</span><span className="fit-of">/5 fit</span>
          </span>
        )}
      </div>
      <p className="draft-meta">
        Via {PROVIDER[d.provider] || d.provider}. Found {relTime(d.created_at).toLowerCase()}. {filled} of {d.plan.length} questions answered{d.plan.length > filled ? `, ${d.plan.length - filled} left blank` : ''}.
      </p>
      <Updating d={d} />
      {d.auto_skipped && <p className="updating"><Icon name="alert" size={15} /> {d.auto_skipped}</p>}

      <button className="disclose" aria-expanded={open} aria-controls={`plan-${d.key}`} onClick={() => setOpen(o => !o)}>
        <span className="chev" aria-hidden="true" /> {open ? 'Hide answers' : `Show all ${d.plan.length} answers`}
      </button>
      {open && (
        <dl className="plan" id={`plan-${d.key}`}>
          {d.plan.map((p, i) => (
            <div key={i} className="plan-row">
              <dt>{p.label}</dt>
              <dd>
                {answering === i ? (
                  <AnswerForm questions={[p]} onSave={save} onCancel={() => setAnswering(null)} saveLabel="Save answer" />
                ) : (
                  <>
                    {p.value === null ? <span className="blank">Left blank</span> : <span className="plan-v">{p.value}</span>}
                    <span className="plan-src">{p.source}</span>
                    {p.value === null && canAnswer(p) && !d.updating && !confirming && (
                      <button className="link-btn" onClick={() => setAnswering(i)}>Answer this</button>
                    )}
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {myself && <ApplyMyself d={d} onFinish={onFinish} onClose={() => setMyself(false)} />}

      {confirming ? (
        <div className="confirm" role="group" aria-label="Confirm submission">
          <p>
            <strong>Submit to {d.company} as {name}?</strong> This sends exactly the answers above under your name{d.plan.length > filled ? ', and leaves the blank ones blank' : ''}. It can’t be undone.
          </p>
          <div className="confirm-actions">
            <button className="btn btn-quiet" onClick={() => setConfirming(false)} disabled={!!busy}>Cancel</button>
            <button ref={confirmRef} className="btn btn-primary" onClick={() => act('approve')} disabled={!!busy}>{busy === 'approve' ? 'Approving…' : 'Yes, submit it'}</button>
          </div>
        </div>
      ) : (
        <div className="draft-actions">
          {!myself && <button className="btn btn-quiet draft-myself" onClick={() => setMyself(true)} disabled={!!busy}>Apply myself</button>}
          <button className="btn btn-quiet" onClick={() => act('reject')} disabled={!!busy}>{busy === 'reject' ? 'Rejecting…' : 'Reject'}</button>
          <button className="btn btn-primary" onClick={askApprove} disabled={!!busy || !!d.updating}>Approve</button>
        </div>
      )}
    </article>
  )
}

function HeldCard({ d, goSetup, onAnswer, onFinish }: { d: Draft; goSetup: (s: SetupTarget) => void; onAnswer: AnswerFn; onFinish: FinishFn }) {
  const [myself, setMyself] = useState(false)
  const [busy, setBusy] = useState(false)
  const qs = (d.open_questions || []).filter(canAnswer)
  const covered = new Set(qs.map(q => q.reason))
  const other = d.holds.filter(h => !covered.has(h))
  return (
    <li className="held-item">
      <div className="held-top">
        <JobTitle d={d} />
        <span className="when">{relTime(d.created_at)}</span>
      </div>
      <Updating d={d} />
      {other.length > 0 && (
        <ul className="reasons">
          {other.map(h => {
            const fix = holdFix(h)
            return (
              <li key={h}>
                <Icon name="alert" size={15} />
                <span>{h}</span>
                {fix && <button className="link-btn" onClick={() => goSetup(fix.step)}>{fix.label}</button>}
              </li>
            )
          })}
        </ul>
      )}
      {d.holds.length === 0 && <ul className="reasons"><li><Icon name="alert" size={15} /><span>No reason was recorded.</span></li></ul>}
      {qs.length > 0 && !d.updating && (
        <AnswerForm questions={qs} onSave={answers => onAnswer(d, answers)}
          intro={`The agent couldn’t answer ${qs.length === 1 ? 'this question' : 'these questions'} from your profile. Answer here and it re-checks the application. Nothing is submitted until you approve it.`} />
      )}
      {myself ? <ApplyMyself d={d} onFinish={onFinish} onClose={() => setMyself(false)} /> : (
        <div className="held-actions">
          <button className="link-btn" onClick={() => setMyself(true)}>Show answers to fill it in myself</button>
          <span className="held-done">
            <button className="btn btn-quiet btn-sm" disabled={busy} onClick={async () => { setBusy(true); await onFinish(d, 'skipped'); setBusy(false) }}>Skip this job</button>
            <button className="btn btn-quiet btn-sm" disabled={busy} onClick={async () => { setBusy(true); await onFinish(d, 'submitted'); setBusy(false) }}>I applied myself</button>
          </span>
        </div>
      )}
    </li>
  )
}

function Applications({ apps }: { apps: Application[] }) {
  const [shots, setShots] = useState<Record<string, Screens | 'loading' | string>>({})
  const load = async (key: string) => {
    setShots(s => ({ ...s, [key]: 'loading' }))
    try {
      const r = await api<Screens>(`/me/drafts/${encodeURIComponent(key)}/screens`)
      setShots(s => ({ ...s, [key]: r }))
      // Links are short-lived; drop them before they expire so the button fetches fresh ones.
      setTimeout(() => setShots(s => { const n = { ...s }; delete n[key]; return n }), Math.max(30, (r.expires_in || 300) - 15) * 1000)
    }
    catch (e) {
      const none = e instanceof ApiError && e.status === 404
      setShots(s => ({ ...s, [key]: none ? { expires_in: 0 } : errorText(e) }))
    }
  }

  if (!apps.length) return (
    <div className="empty-panel">
      <p className="empty-title">No applications yet.</p>
      <p>Submitted applications are listed here with whether the company confirmed them.</p>
    </div>
  )

  return (
    <div className="panel table-panel">
      <div className="table-wrap">
        <table className="users apps">
          <thead><tr><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Applied</th><th scope="col"><span className="sr-only">Screenshots</span></th></tr></thead>
          <tbody>
            {apps.map(a => {
              const st = STATE[a.state] || { label: a.state, tone: 'plain', hint: '' }
              const s = shots[a.key]
              return (
                <tr key={a.key}>
                  <td><JobTitle d={a} /></td>
                  <td data-label="Status"><span className={`badge tone-${st.tone}`} title={st.hint}>{st.label}</span>{a.state === 'PENDING_VERIFICATION' && <p className="state-hint">{st.hint}</p>}</td>
                  <td data-label="Applied"><time dateTime={a.updated_at} title={fullTime(a.updated_at)}>{relTime(a.updated_at)}</time></td>
                  <td className="actions">
                    {s === undefined && <button className="btn btn-quiet btn-sm" onClick={() => load(a.key)}>Screenshots</button>}
                    {s === 'loading' && <span className="muted-sm"><span className="spinner spinner-sm" aria-hidden="true" /> Loading…</span>}
                    {typeof s === 'string' && s !== 'loading' && <span className="muted-sm">{s}</span>}
                    {typeof s === 'object' && (s.filled || s.result
                      ? <span className="shot-links">
                          {s.filled && <a href={s.filled} target="_blank" rel="noopener noreferrer">Filled form</a>}
                          {s.result && <a href={s.result} target="_blank" rel="noopener noreferrer">Result page</a>}
                        </span>
                      : <span className="muted-sm">No screenshots saved.</span>)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ResultsSkeleton() {
  return (
    <div className="r-section" aria-busy="true" aria-label="Loading results">
      <Skeleton w={240} h={22} />
      <div className="drafts" style={{ marginTop: 16 }}>
        {[0, 1].map(i => <div key={i} className="draft"><Skeleton w="30%" h={12} /><Skeleton w="60%" h={20} /><Skeleton w="80%" h={12} /></div>)}
      </div>
    </div>
  )
}

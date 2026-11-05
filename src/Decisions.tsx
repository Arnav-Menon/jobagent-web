import { useCallback, useEffect, useState } from 'react'
import { api, type AdminRun, type DecisionJob, type DecisionLog } from './api'
import { errorText } from './errors'
import { Badge, Icon, Skeleton, fullTime, relTime } from './ui'

const OUTCOME: Record<string, string> = {
  scored: 'Scored now', scored_before: 'Scored earlier', score_failed: 'Scoring failed',
  skipped_recent_failure: 'Skipped (failed recently)', not_scored_rate_limited: 'Not scored (OpenAI refused)', not_scored_budget: 'Not scored (limit for this search)',
}
const DECISION: Record<string, { text: string; tone: string }> = {
  meets_minimum: { text: 'Meets minimum', tone: 'ok' }, meets_minimum_over_run_limit: { text: 'Meets minimum (next search)', tone: 'held' },
  below_minimum: { text: 'Below minimum', tone: 'muted' }, no_score: { text: 'No score', tone: 'muted' },
}
const DRAFT: Record<string, string> = {
  awaiting_approval: 'Draft waiting for approval', held: 'Held', submitted: 'Submitted', needs_you: 'Needs the user', pending_verification: 'Sent, not confirmed',
  scheduled: 'Scheduled', approved: 'Approved', rejected: 'Rejected', failed: 'Failed',
}
const SETTING: Record<string, string> = {
  include_keywords: 'Roles', exclude_keywords: 'Skip', seniority: 'Level', locations: 'Locations', work_modes: 'Work', min_base_salary: 'Min salary',
  min_fit_score: 'Min fit', companies_avoid: 'Avoid', mode: 'Mode',
}
const show = (v: unknown) => Array.isArray(v) ? (v.length ? v.join(', ') : '—') : v === null || v === undefined || v === '' ? '—' : String(v)

function JobRow({ j }: { j: DecisionJob }) {
  const [open, setOpen] = useState(false)
  const d = j.detail
  const dec = j.decision ? DECISION[j.decision] : null
  return (
    <li className="dec-job">
      <div className="dec-job-head">
        <span className={`dec-score s${Math.round(j.score ?? 0)}`} aria-label={j.score != null ? `Score ${j.score} of 5` : 'No score'}>{j.score ?? '–'}</span>
        <div className="dec-job-text">
          <span className="dec-title">{j.url ? <a href={j.url} target="_blank" rel="noreferrer">{j.company} · {j.title}</a> : `${j.company} · ${j.title}`}</span>
          <span className="muted dec-sub">
            {[OUTCOME[j.outcome || ''] || j.outcome, j.confidence && `${j.confidence} confidence`, j.reason, j.location, j.salary_max ? `up to $${Math.round(j.salary_max / 1000)}k` : null, j.seniority]
              .filter(Boolean).join(' · ')}
          </span>
        </div>
        <div className="dec-tags">
          {dec && <span className={`src-tag tone-${dec.tone}`}>{dec.text}</span>}
          {j.draft_status && <span className="src-tag tone-ok">{DRAFT[j.draft_status] || j.draft_status}</span>}
          {d && <button className="btn btn-quiet btn-sm" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? 'Hide why' : 'Why?'}</button>}
        </div>
      </div>
      {j.holds && j.holds.length > 0 && <p className="dec-holds"><Icon name="alert" size={14} /> {j.holds.join(' · ')}</p>}
      {open && d && (
        <div className="dec-detail">
          <p>{d.rationale}</p>
          {Object.keys(d.dimensions || {}).length > 0 && (
            <p className="muted">{Object.entries(d.dimensions).map(([k, v]) => `${k.replace('_', ' ')} ${v ?? '?'}`).join(' · ')}</p>
          )}
          {d.met.length > 0 && <><h4>Key requirements met</h4><ul>{d.met.map(x => <li key={x}>{x}</li>)}</ul></>}
          {d.missing.length > 0 && <><h4>Key requirements not shown on the resume</h4><ul>{d.missing.map(x => <li key={x}>{x}</li>)}</ul></>}
          {d.open_questions.length > 0 && <><h4>Open questions</h4><ul>{d.open_questions.map(x => <li key={x}>{x}</li>)}</ul></>}
        </div>
      )}
    </li>
  )
}

function RunDetail({ id }: { id: string }) {
  const [data, setData] = useState<{ log: DecisionLog | null } | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { api<{ log: DecisionLog | null }>(`/admin/runs/${encodeURIComponent(id)}/decisions`).then(setData, e => setErr(errorText(e))) }, [id])
  if (err) return <p className="form-error"><Icon name="alert" size={16} /> {err}</p>
  if (!data) return <div className="dec-body"><Skeleton w="70%" /><Skeleton w="50%" /></div>
  const log = data.log
  if (!log) return <p className="dec-body muted">No decision log for this run (it ran before logging was added, or failed before finishing).</p>
  const f = log.funnel
  return (
    <div className="dec-body">
      {log.settings && (
        <p className="dec-settings">{Object.entries(log.settings).map(([k, v]) => <span key={k}><strong>{SETTING[k] || k}:</strong> {show(v)}</span>)}</p>
      )}
      {f && (
        <ol className="funnel">
          <li><strong>{f.scanned.toLocaleString()}</strong> jobs on tracked boards</li>
          <li><strong>{f.already_applied_or_drafted}</strong> already applied or drafted{f.excluded_company ? `, ${f.excluded_company} excluded companies` : ''}</li>
          <li><strong>{f.rejected_by_filters.toLocaleString()}</strong> filtered out by preferences</li>
          <li><strong>{f.passed_filters}</strong> passed the filters · scoring limit this search: {log.score_budget} (model calls left today: {log.model_calls_left_before})</li>
        </ol>
      )}
      {log.rejected_reasons && log.rejected_reasons.length > 0 && (
        <details className="dec-reasons">
          <summary>Why jobs were filtered out</summary>
          <table><tbody>
            {log.rejected_reasons.map(([r, n]) => <tr key={r}><td>{r}</td><td className="num">{n.toLocaleString()}</td>
              <td className="num muted">{(log.only_reason || []).find(x => x[0] === r)?.[1] ?? 0} only for this</td></tr>)}
          </tbody></table>
          <p className="hint">A job can fail several filters. “Only for this” = jobs that would have passed if this one filter didn’t exist.</p>
        </details>
      )}
      {log.kind === 'apply' && <p>Result: <Badge value={log.result || 'unknown'} /></p>}
      <ul className="dec-jobs">{log.jobs.map((j, i) => <JobRow key={`${j.company}-${j.title}-${i}`} j={j} />)}</ul>
      {log.jobs.length === 0 && <p className="muted">No jobs reached scoring.</p>}
    </div>
  )
}

/** Admin: every search and application run, what was filtered, how each job scored and why. */
export default function Decisions() {
  const [runs, setRuns] = useState<AdminRun[] | null>(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const load = useCallback(() => { api<AdminRun[]>('/admin/runs?days=14').then(r => { setRuns(r); setErr('') }, e => setErr(errorText(e))) }, [])
  useEffect(() => { load() }, [load])
  return (
    <section className="panel" aria-labelledby="dec-title" style={{ marginBottom: 24 }}>
      <div className="panel-head">
        <h2 id="dec-title">Decisions</h2>
        <button className="btn btn-quiet btn-sm" onClick={load}><Icon name="refresh" size={15} /> Refresh</button>
      </div>
      <p className="hint">Every search and application in the last 14 days: what was filtered out, how each job scored, the scorer’s explanation, and what happened next.</p>
      {err && <p className="form-error"><Icon name="alert" size={16} /> {err}</p>}
      {!runs && !err && <Skeleton />}
      <ul className="dec-runs">
        {runs?.map(r => {
          const c = r.counts || {}
          const isOpen = open === r.id
          return (
            <li key={r.id} className={isOpen ? 'open' : ''}>
              <button className="dec-run" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.id)}>
                <span className="dec-run-main">
                  <strong>{r.kind === 'apply' ? 'Application' : 'Search'}</strong> · {r.user} · <span className="muted">{r.trigger}</span>
                </span>
                <span className="dec-run-counts muted">
                  {r.kind === 'discover'
                    ? `${c.eligible ?? 0} passed · ${c.scored ?? 0} scored · ${c.drafts ?? 0} drafts · ${c.held ?? 0} held${c.submitted ? ` · ${c.submitted} sent` : ''}`
                    : `${c.submitted ? 'sent' : c.needs_you ? 'needs user' : c.pending ? 'not confirmed' : c.held ? 'held' : c.scheduled ? 'scheduled' : r.status}`}
                </span>
                <Badge value={r.status} />
                <time className="muted" dateTime={r.created_at} title={fullTime(r.created_at)}>{relTime(r.created_at)}</time>
              </button>
              {isOpen && <RunDetail id={r.id} />}
            </li>
          )
        })}
        {runs?.length === 0 && <li className="muted">No runs in the last 14 days.</li>}
      </ul>
    </section>
  )
}

import { useId, useState, type FormEvent } from 'react'
import type { Draft, PlanRow } from './api'

/** Questions the agent never answers from saved answers (mirrors the backend's NEVER_SAVED). Pronouns are allowed. */
const NEVER_SAVED = /gender|\brace\b|ethnic|hispanic|latin[oax]|veteran|disabilit|sexual orientation|transgender/i
const CHOICE_KINDS = ['radio', 'yesno', 'select', 'select-native', 'checkbox']

export type Question = { label: string; kind: string; options?: string[]; required?: boolean }
export type AnswerIn = { question: string; answer: string; remember: boolean }

/** A question the user can answer in the app: not a file upload and not a demographic question. */
export const canAnswer = (q: Question) => q.kind !== 'file' && !NEVER_SAVED.test(q.label)

/** Long, company-specific text ("Why us?") shouldn't be reused by default; short facts should. */
const rememberByDefault = (q: Question) => q.kind !== 'textarea' && !/\bwhy\b/i.test(q.label)

/** One question's input: a choice list when the form gave options, a text box otherwise, plus "remember". */
export function AnswerField({ q, value, remember, onChange, invalid }: {
  q: Question; value: string; remember: boolean; invalid?: boolean
  onChange: (value: string, remember: boolean) => void
}) {
  const id = useId()
  const opts = q.options || []
  const long = q.kind === 'textarea' || /\b(why|describe|tell us|explain)\b/i.test(q.label)
  return (
    <div className="answer-field">
      <label htmlFor={id} className="field-label">{q.label}{q.required && <span className="req"> (required)</span>}</label>
      {opts.length > 0 ? (
        <select id={id} value={value} aria-invalid={invalid || undefined} onChange={e => onChange(e.target.value, remember)}>
          <option value="">Choose an answer…</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : CHOICE_KINDS.includes(q.kind) && q.kind !== 'yesno' ? (
        <p className="field-help">This question’s options weren’t recorded. Run a search again to refresh it, or fill it in yourself.</p>
      ) : long ? (
        <textarea id={id} rows={4} value={value} maxLength={4000} aria-invalid={invalid || undefined} onChange={e => onChange(e.target.value, remember)} />
      ) : (
        <input id={id} type="text" value={value} maxLength={4000} aria-invalid={invalid || undefined} onChange={e => onChange(e.target.value, remember)} />
      )}
      <label className="remember">
        <input type="checkbox" checked={remember} onChange={e => onChange(value, e.target.checked)} />
        <span>Use this answer whenever a form asks this exact question</span>
      </label>
    </div>
  )
}

const answerable = (q: Question) => canAnswer(q) && ((q.options || []).length > 0 || !CHOICE_KINDS.includes(q.kind) || q.kind === 'yesno')

/** A small form answering one or more questions on a draft. */
export function AnswerForm({ questions, onSave, onCancel, saveLabel = 'Save answers', intro }: {
  questions: Question[]; onSave: (answers: AnswerIn[]) => Promise<string | null>; onCancel?: () => void; saveLabel?: string; intro?: string
}) {
  const [vals, setVals] = useState<Record<string, { value: string; remember: boolean }>>(
    () => Object.fromEntries(questions.map(q => [q.label, { value: '', remember: rememberByDefault(q) }])))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const usable = questions.filter(answerable)
  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    const filled = usable.filter(q => vals[q.label]?.value.trim())
    if (!filled.length) { setErr('Answer at least one question.'); return }
    setErr(''); setBusy(true)
    const failure = await onSave(filled.map(q => ({ question: q.label, answer: vals[q.label].value.trim(), remember: vals[q.label].remember })))
    setBusy(false)
    if (failure) setErr(failure)
  }
  if (!usable.length) return null
  return (
    <form className="answer-form" onSubmit={submit} noValidate>
      {intro && <p className="field-help">{intro}</p>}
      {usable.map(q => (
        <AnswerField key={q.label} q={q} value={vals[q.label].value} remember={vals[q.label].remember}
          onChange={(value, remember) => setVals(v => ({ ...v, [q.label]: { value, remember } }))} />
      ))}
      {err && <p className="form-error" role="alert">{err}</p>}
      <div className="answer-actions">
        {onCancel && <button type="button" className="btn btn-quiet btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>}
        <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : saveLabel}</button>
      </div>
    </form>
  )
}

/** Answers to paste into the real form, each with a Copy button. */
export function CopyAnswers({ rows, id }: { rows: PlanRow[]; id?: string }) {
  const [copied, setCopied] = useState<number | null>(null)
  const answers = rows.filter(p => p.value !== null && p.kind !== 'file')
  const copy = async (i: number, v: string) => {
    try { await navigator.clipboard.writeText(v); setCopied(i); setTimeout(() => setCopied(c => (c === i ? null : c)), 1500) } catch { /* clipboard blocked */ }
  }
  return (
    <dl className="plan" id={id}>
      {answers.map((p, i) => (
        <div key={i} className="plan-row">
          <dt>{p.label}</dt>
          <dd>
            <span className="plan-v">{p.value}</span>
            <button type="button" className="link-btn" onClick={() => copy(i, p.value as string)}>{copied === i ? 'Copied' : 'Copy'}</button>
          </dd>
        </div>
      ))}
      {answers.length === 0 && <div className="plan-row"><dt>No answers were prepared for this form.</dt><dd /></div>}
    </dl>
  )
}

export const formUrl = (d: Pick<Draft, 'url' | 'apply_url'>) => d.apply_url || d.url

/** Fill it in yourself: open the real form, copy the prepared answers, then tell the agent it's done. */
export function ApplyMyself({ d, onFinish, onClose }: {
  d: Draft; onFinish: (d: Draft, how: 'submitted' | 'skipped') => Promise<void>; onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const blanks = d.plan.filter(p => p.value === null && p.kind !== 'file').length + (d.open_questions?.length || 0)
  return (
    <div className="myself" role="group" aria-label="Apply yourself">
      <p>
        <strong>Fill it in yourself.</strong> Job sites don’t accept answers in a link, so the agent can’t hand you a pre-filled form.
        Open the application, paste the answers below{blanks ? `, answer the ${blanks} it couldn’t` : ''}, attach your resume and submit.
        Then tell the agent, so it never applies to this one.
      </p>
      <div className="needs-actions">
        <a className="btn btn-primary btn-sm" href={formUrl(d)} target="_blank" rel="noopener noreferrer">Open application<span className="sr-only"> (new tab)</span></a>
      </div>
      <CopyAnswers rows={d.plan} />
      <div className="needs-actions needs-done">
        <button className="btn btn-quiet btn-sm" disabled={busy} onClick={onClose}>Close</button>
        <button className="btn btn-quiet btn-sm" disabled={busy} onClick={async () => { setBusy(true); await onFinish(d, 'submitted'); setBusy(false) }}>I submitted it</button>
      </div>
    </div>
  )
}

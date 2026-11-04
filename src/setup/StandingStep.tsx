import { useEffect, useState, type FormEvent } from 'react'
import { api, type Standing, type StandingValue } from '../api'
import { errorText } from '../errors'
import { Icon, Skeleton } from '../ui'
import { Segmented, StepActions, useDirty } from './controls'
import type { StepProps } from './types'

const OPTIONS: { value: StandingValue; label: string; tone: 'ok' | 'danger' | 'held' }[] = [
  { value: 'yes', label: 'Yes', tone: 'ok' },
  { value: 'no', label: 'No', tone: 'danger' },
  { value: 'hold', label: 'Ask me', tone: 'held' },
]

const flat = (s: Standing) => Object.fromEntries(Object.entries(s.answers).map(([k, v]) => [k, v.value])) as Record<string, StandingValue>

export default function StandingStep({ onDone, setDirty }: StepProps) {
  const [data, setData] = useState<Standing | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [base, setBase] = useState<Record<string, StandingValue>>({})
  const [answers, setAnswers] = useState<Record<string, StandingValue>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const reset = (s: Standing) => { setData(s); setBase(flat(s)); setAnswers(flat(s)) }
  useEffect(() => { api<Standing>('/me/standing').then(reset, e => setLoadErr(errorText(e))) }, [])
  useDirty(answers, base, setDirty)

  if (loadErr) return <p className="form-error" role="alert"><Icon name="alert" size={16} /> {loadErr}</p>
  if (!data) return <div className="step-body">{[0, 1, 2, 3].map(i => <div key={i} className="sk-field"><Skeleton w="60%" /><Skeleton w={220} h={36} /></div>)}</div>

  const unanswered = data.keys.filter(k => !answers[k.key]).length

  const save = async (ev: FormEvent) => {
    ev.preventDefault()
    setErr('')
    if (unanswered) { setErr(`Answer all ${data.keys.length} questions. Choose “Ask me” for any you want to decide case by case.`); return }
    setBusy(true)
    try {
      reset(await api<Standing>('/me/standing', { method: 'PUT', body: JSON.stringify({ answers }) }))
      setDirty(false)
      onDone('Standing answers saved.')
    } catch (e) { setErr(errorText(e)) }
    finally { setBusy(false) }
  }

  return (
    <form className="step-body" onSubmit={save} noValidate>
      <p className="step-intro">
        Some applications ask yes-or-no questions your resume can’t answer. Answer them once here and the same answer is used every time.
        Choose <strong>Ask me</strong> and the agent stops at that question and asks you before going further.
      </p>
      <ul className="standing">
        {data.keys.map(k => (
          <li key={k.key} className={answers[k.key] ? '' : 'unanswered'}>
            <div className="standing-text">
              <p id={`st-${k.key}`} className="standing-q">{k.label}</p>
              {k.help && <p className="field-help">{k.help}</p>}
            </div>
            <Segmented name={k.key} labelledBy={`st-${k.key}`} value={answers[k.key] || ''} options={OPTIONS}
              invalid={!!err && !answers[k.key]} onChange={v => setAnswers(a => ({ ...a, [k.key]: v }))} />
          </li>
        ))}
      </ul>
      <p className="field-help">Questions about gender, race, veteran status and disability are always left blank or declined. You can’t change this.</p>
      <StepActions busy={busy} label="Save answers" busyLabel="Saving…" error={err}
        extra={unanswered > 0 ? <span className="pending-count">{unanswered} left to answer</span> : undefined} />
    </form>
  )
}

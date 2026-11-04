import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../api'
import { errorText } from '../errors'
import { Icon } from '../ui'
import { useDirty } from './controls'
import type { StepProps } from './types'

type Mode = 'review' | 'auto'
const STEP_NAMES: Record<string, string> = { resume: 'resume', details: 'details', standing: 'standing answers', preferences: 'preferences' }
const NAME: Record<Mode, string> = { review: 'Review each one', auto: 'Apply automatically' }

export default function ModeStep({ setup, onDone, setDirty }: StepProps) {
  const [mode, setMode] = useState<Mode>(setup.mode)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [justSaved, setJustSaved] = useState(false)
  useDirty(mode, setup.mode, setDirty)
  const left = Object.entries(setup.steps).filter(([, done]) => !done).map(([k]) => STEP_NAMES[k] || k)
  const changed = mode !== setup.mode

  const pick = (m: Mode) => { setMode(m); setJustSaved(false); setErr('') }

  const save = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!changed) return
    setErr('')
    setBusy(true)
    try {
      await api('/me/mode', { method: 'PUT', body: JSON.stringify({ mode }) })
      setDirty(false)
      setJustSaved(true)
      onDone(`Mode saved: ${NAME[mode].toLowerCase()}.`)
    } catch (e) {
      setErr(errorText(e))
      if (e instanceof ApiError && e.detail === 'setup_incomplete') setMode('review')
    } finally { setBusy(false) }
  }

  const card = (m: Mode, desc: string, locked?: React.ReactNode) => (
    <label className={`mode-card${mode === m ? ' on' : ''}${locked ? ' off' : ''}`}>
      <input className="sr-only" type="radio" name="mode" value={m} checked={mode === m} disabled={!!locked}
        onChange={() => pick(m)} aria-describedby={locked ? 'auto-locked' : undefined} />
      <span className="mode-radio" aria-hidden="true" />
      <span className="mode-title">
        {NAME[m]}
        {setup.mode === m && <span className="src-tag tone-ok"><Icon name="check" size={12} /> Saved</span>}
      </span>
      <span className="mode-desc">{desc}</span>
      {locked}
    </label>
  )

  return (
    <form className="step-body" onSubmit={save}>
      <p className="step-intro">Choose whether you approve each application or let the agent send them. You can switch at any time.</p>

      <div className="modes" role="radiogroup" aria-label="How it applies">
        {card('review', 'The agent prepares each application and waits. Nothing is submitted until you approve it.')}
        {card('auto', 'The agent submits applications that pass your rules, up to your daily limit, and emails you after each one. A question without a confirmed answer still stops it.',
          !setup.complete && <span id="auto-locked" className="mode-locked"><Icon name="lock" size={14} /> Available once setup is finished. Still to do: {left.join(', ')}.</span>)}
      </div>

      <div className="notice tone-plain">
        <Icon name="alert" size={16} />
        <p>
          <strong>Saving records your choice. It doesn’t start anything yet.</strong> Job Agent doesn’t run applications from this
          setup yet. That arrives in a later update, starting with review mode, and the mode you save here applies from then.
        </p>
      </div>

      <div className="step-actions">
        {err && <p className="form-error" role="alert"><Icon name="alert" size={16} /> {err}</p>}
        <div className="step-actions-row">
          <span className="save-state" role="status">
            {changed
              ? <>Not saved yet. Your saved mode is <strong>{NAME[setup.mode].toLowerCase()}</strong>.</>
              : justSaved ? <><Icon name="check" size={15} /> Saved</> : ''}
          </span>
          <button className="btn btn-primary" type="submit" disabled={busy || !changed}>
            {busy ? 'Saving…' : changed ? `Switch to ${NAME[mode].toLowerCase()}` : 'Saved'}
          </button>
        </div>
      </div>
    </form>
  )
}

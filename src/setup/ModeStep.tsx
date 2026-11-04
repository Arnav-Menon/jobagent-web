import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../api'
import { errorText } from '../errors'
import { Icon } from '../ui'
import { StepActions, useDirty } from './controls'
import type { StepProps } from './types'

const STEP_NAMES: Record<string, string> = { resume: 'resume', details: 'details', standing: 'standing answers', preferences: 'preferences' }

export default function ModeStep({ setup, onDone, setDirty }: StepProps) {
  const [mode, setMode] = useState<'review' | 'auto'>(setup.mode)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useDirty(mode, setup.mode, setDirty)
  const left = Object.entries(setup.steps).filter(([, done]) => !done).map(([k]) => STEP_NAMES[k] || k)

  const save = async (ev: FormEvent) => {
    ev.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await api('/me/mode', { method: 'PUT', body: JSON.stringify({ mode }) })
      setDirty(false)
      onDone(mode === 'auto' ? 'Automatic mode is on.' : 'Review mode is on.')
    } catch (e) {
      setErr(errorText(e))
      if (e instanceof ApiError && e.detail === 'setup_incomplete') setMode('review')
    } finally { setBusy(false) }
  }

  return (
    <form className="step-body" onSubmit={save}>
      <p className="step-intro">Choose whether you approve each application or let the agent send them. You can switch at any time.</p>
      <div className="modes" role="radiogroup" aria-label="How it applies">
        <label className={`mode-card${mode === 'review' ? ' on' : ''}`}>
          <input className="sr-only" type="radio" name="mode" value="review" checked={mode === 'review'} onChange={() => setMode('review')} />
          <span className="mode-radio" aria-hidden="true" />
          <span className="mode-title">Review each one</span>
          <span className="mode-desc">The agent prepares each application and waits. Nothing is submitted until you approve it.</span>
        </label>
        <label className={`mode-card${mode === 'auto' ? ' on' : ''}${setup.complete ? '' : ' off'}`}>
          <input className="sr-only" type="radio" name="mode" value="auto" checked={mode === 'auto'} disabled={!setup.complete} onChange={() => setMode('auto')} aria-describedby={setup.complete ? undefined : 'auto-locked'} />
          <span className="mode-radio" aria-hidden="true" />
          <span className="mode-title">Apply automatically</span>
          <span className="mode-desc">
            The agent submits applications that pass your rules, up to your daily limit, and emails you after each one.
            A question without a confirmed answer still stops it.
          </span>
          {!setup.complete && (
            <span id="auto-locked" className="mode-locked"><Icon name="lock" size={14} /> Available once setup is finished. Still to do: {left.join(', ')}.</span>
          )}
        </label>
      </div>
      <StepActions busy={busy} label="Save mode" busyLabel="Saving…" error={err} />
    </form>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type Me, type SetupStatus, type StepKey } from './api'
import { errorText } from './errors'
import DetailsStep from './setup/DetailsStep'
import ModeStep from './setup/ModeStep'
import PreferencesStep from './setup/PreferencesStep'
import DataStep from './setup/DataStep'
import ResumeStep from './setup/ResumeStep'
import StandingStep from './setup/StandingStep'
import type { StepProps } from './setup/types'
import { Badge, Icon, Skeleton, useToast } from './ui'
import { LEAVE_MESSAGE, unsaved } from './unsaved'

type Step = StepKey | 'mode' | 'data'
const ORDER: Step[] = ['resume', 'details', 'standing', 'preferences', 'mode', 'data']
const META: Record<Step, { title: string; short: string; Comp: (p: StepProps) => React.ReactNode }> = {
  resume: { title: 'Upload your resume', short: 'Resume', Comp: ResumeStep },
  details: { title: 'Confirm your details', short: 'Details', Comp: DetailsStep },
  standing: { title: 'Standing answers', short: 'Standing answers', Comp: StandingStep },
  preferences: { title: 'Preferences', short: 'Preferences', Comp: PreferencesStep },
  mode: { title: 'Choose how it applies', short: 'Mode', Comp: ModeStep },
  data: { title: 'Your data', short: 'Your data', Comp: () => null },
}

export default function Setup({ me, initialStep }: { me: Me; initialStep?: Step }) {
  const toast = useToast()
  const [setup, setSetup] = useState<SetupStatus | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [step, setStep] = useState<Step>('resume')
  const dirty = useRef(false)
  const panel = useRef<HTMLElement>(null)

  const refresh = useCallback(async () => {
    const s = await api<SetupStatus>('/me/setup')
    setSetup(s); setLoadErr('')
    return s
  }, [])

  const load = useCallback(() => {
    refresh().then(s => setStep(initialStep || ORDER.find(k => k !== 'mode' && k !== 'data' && !s.steps[k as StepKey]) || 'mode'), e => setLoadErr(errorText(e)))
  }, [refresh, initialStep])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) e.preventDefault() }
    addEventListener('beforeunload', warn)
    return () => removeEventListener('beforeunload', warn)
  }, [])

  const setDirty = useCallback((d: boolean) => { dirty.current = d; unsaved.dirty = d }, [])
  useEffect(() => () => { unsaved.dirty = false }, [])

  const go = (s: Step) => {
    if (s === step) return
    if (dirty.current && !confirm(LEAVE_MESSAGE.replace('in Setup', 'on this step'))) return
    dirty.current = false; unsaved.dirty = false
    setStep(s)
    requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }))
    panel.current?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  const onDone = async (message: string) => {
    dirty.current = false; unsaved.dirty = false
    if (message) toast(message)
    const i = ORDER.indexOf(step)
    if (i < ORDER.indexOf('mode')) go(ORDER[i + 1])
    try { await refresh() } catch { /* progress refresh is best-effort */ }
  }

  const first = me.display_name?.split(' ')[0]
  const doneCount = setup ? Object.values(setup.steps).filter(Boolean).length : 0
  const total = setup ? Object.keys(setup.steps).length : 4

  const status = (s: Step): { text: string; done: boolean } => {
    if (!setup) return { text: '', done: false }
    if (s === 'mode') return { text: setup.mode === 'auto' ? 'Automatic' : 'Review', done: false }
    if (s === 'data') return { text: 'Export or delete', done: false }
    if (setup.steps[s]) return { text: 'Done', done: true }
    if (s === 'details' && setup.steps.resume && setup.missing_details.length)
      return { text: `${setup.missing_details.length} required left`, done: false }
    return { text: 'To do', done: false }
  }

  const { Comp, title } = META[step]

  return (
    <div className="page setup">
      <div className="page-head">
        <h1>{first ? `Welcome, ${first}` : 'Welcome'}</h1>
        <p className="sub">
          {!setup ? 'Set up the agent so it can apply for you.'
            : setup.complete ? 'Setup is finished. You can change any of it below.'
            : `${doneCount} of ${total} setup steps done. Nothing is submitted until all of them are.`}
        </p>
        <div className="head-badges">
          <Badge value={me.status} />
          {setup && <Badge value={setup.mode} label={setup.mode === 'auto' ? 'Automatic mode' : 'Review mode'} />}
        </div>
      </div>

      {loadErr ? (
        <div className="notice tone-danger" role="alert">
          <Icon name="alert" />
          <p>Couldn’t load your setup. {loadErr}</p>
          <button className="btn btn-quiet btn-sm" onClick={() => { setLoadErr(''); load() }}><Icon name="refresh" size={16} /> Try again</button>
        </div>
      ) : (
        <div className="stepper">
          <nav className="stepper-nav" aria-label="Setup steps">
            <div className="progress" aria-hidden="true"><span style={{ width: `${(doneCount / total) * 100}%` }} /></div>
            <ol>
              {ORDER.map((s, i) => {
                const st = status(s)
                return (
                  <li key={s}>
                    <button className={`stepper-item${st.done ? ' done' : ''}`} aria-current={step === s ? 'step' : undefined} onClick={() => go(s)} disabled={!setup}>
                      <span className="check-n" aria-hidden="true">{st.done ? <Icon name="check" size={15} /> : s === 'data' ? <Icon name="lock" size={14} /> : i + 1}</span>
                      <span className="stepper-text">
                        <span className="stepper-title">{META[s].short}</span>
                        <span className="stepper-status">{setup ? st.text : <Skeleton w={50} h={10} />}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>

          <section className="panel step-panel" ref={panel} tabIndex={-1} aria-labelledby="step-title">
            <div className="step-head">
              {step !== 'data' && <p className="step-count">Step {ORDER.indexOf(step) + 1} of {ORDER.length - 1}</p>}
              <h2 id="step-title">{title}</h2>
            </div>
            {setup && step === 'data' ? <DataStep me={me} />
              : setup ? <Comp key={step} setup={setup} onDone={onDone} setDirty={setDirty} />
              : <div className="step-body">{[0, 1, 2].map(i => <div key={i} className="sk-field"><Skeleton w={140} h={12} /><Skeleton h={40} /></div>)}</div>}
          </section>
        </div>
      )}
    </div>
  )
}

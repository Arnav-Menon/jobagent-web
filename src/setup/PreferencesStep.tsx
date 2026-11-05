import { useEffect, useState, type FormEvent } from 'react'
import { api, type Preferences, type Seniority, type WorkMode } from '../api'
import { errorField, errorText } from '../errors'
import { Icon, Skeleton } from '../ui'
import { CheckChips, Field, Segmented, StepActions, TagInput, useDirty } from './controls'
import type { StepProps } from './types'

const DEFAULTS: Preferences = {
  locations: [], work_modes: [], include_keywords: [], exclude_keywords: [], seniority: [],
  min_base_salary: null, companies_avoid: [], companies_prefer: [], min_fit_score: 4, max_per_day: 3, notes: '',
  scan_time: '10:00', daily_scan: true, email_notifications: true,
}
const LABELS: Record<keyof Preferences, string> = {
  locations: 'Locations', work_modes: 'Work arrangement', include_keywords: 'Roles to look for', exclude_keywords: 'Roles to skip',
  seniority: 'Level', min_base_salary: 'Lowest base salary', companies_avoid: 'Companies to skip', companies_prefer: 'Companies you’d like most',
  min_fit_score: 'How close a fit', max_per_day: 'Applications per day', notes: 'Anything else',
  scan_time: 'Search time', daily_scan: 'Daily search', email_notifications: 'Email updates',
}
const FIT: Record<number, string> = {
  1: 'Apply broadly, even to loose matches.', 2: 'Apply to partial matches.', 3: 'Apply to reasonable matches.',
  4: 'Apply only to strong matches.', 5: 'Apply only to near-perfect matches.',
}
const NOTES_MAX = 2000

type Errors = Partial<Record<keyof Preferences, string>>

function validate(p: Preferences, salaryText: string): Errors {
  const e: Errors = {}
  if (!p.locations.length) e.locations = 'Add at least one location.'
  else if (p.locations.length > 10) e.locations = 'Up to 10 locations.'
  if (!p.work_modes.length) e.work_modes = 'Choose at least one.'
  if (!p.seniority.length) e.seniority = 'Choose at least one.'
  if (salaryText.trim() && !(Number(salaryText) > 0 && Number(salaryText) <= 2_000_000)) e.min_base_salary = 'Enter a yearly amount in US dollars, like 120000.'
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.scan_time)) e.scan_time = 'Pick a time, like 09:00.'
  if (p.notes.length > NOTES_MAX) e.notes = `Keep this under ${NOTES_MAX} characters.`
  return e
}

export default function PreferencesStep({ onDone, setDirty }: StepProps) {
  const [loaded, setLoaded] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  const [base, setBase] = useState<Preferences>(DEFAULTS)
  const [p, setP] = useState<Preferences>(DEFAULTS)
  const [salary, setSalary] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [formErr, setFormErr] = useState('')
  const [busy, setBusy] = useState(false)

  const reset = (x: Preferences | null) => {
    const v = { ...DEFAULTS, ...(x || {}) }
    setBase(v); setP(v); setSalary(v.min_base_salary ? String(v.min_base_salary) : ''); setLoaded(true)
  }
  useEffect(() => { api<{ preferences: Preferences | null }>('/me/preferences').then(r => reset(r.preferences), e => setLoadErr(errorText(e))) }, [])
  useDirty({ ...p, min_base_salary: salary.trim() ? Number(salary) : null }, base, setDirty)

  if (loadErr) return <p className="form-error" role="alert"><Icon name="alert" size={16} /> {loadErr}</p>
  if (!loaded) return <div className="step-body">{[0, 1, 2, 3].map(i => <div key={i} className="sk-field"><Skeleton w={140} h={12} /><Skeleton h={40} /></div>)}</div>

  const set = <K extends keyof Preferences>(k: K, v: Preferences[K]) => {
    setP(x => ({ ...x, [k]: v }))
    if (errors[k]) setErrors(x => ({ ...x, [k]: '' }))
  }

  const save = async (ev: FormEvent) => {
    ev.preventDefault()
    setFormErr('')
    const errs = validate(p, salary)
    setErrors(errs)
    const bad = Object.keys(errs) as (keyof Preferences)[]
    if (bad.length) { setFormErr(bad.length === 1 ? `Fix “${LABELS[bad[0]]}” to continue.` : `Fix the ${bad.length} highlighted fields to continue.`); return }
    const body: Preferences = { ...p, min_base_salary: salary.trim() ? Math.round(Number(salary)) : null, notes: p.notes.trim() }
    setBusy(true)
    try {
      const r = await api<{ preferences: Preferences }>('/me/preferences', { method: 'PUT', body: JSON.stringify(body) })
      reset(r.preferences)
      setDirty(false)
      onDone('Preferences saved.')
    } catch (e) {
      const f = errorField(e) as keyof Preferences | null
      if (f) setErrors(x => ({ ...x, [f]: 'This value wasn’t accepted. Check it and try again.' }))
      setFormErr(errorText(e, LABELS))
    } finally { setBusy(false) }
  }

  return (
    <form className="step-body" onSubmit={save} noValidate>
      <p className="step-intro">These rules decide which roles are worth applying to. Roles that don’t match are skipped before anything is filled in.</p>

      <fieldset className="group">
        <legend>Where</legend>
        <Field label={LABELS.locations} required help="Press Enter after each one. For example, New York, NY." error={errors.locations}>
          {({ id, describedBy }) => <TagInput id={id} describedBy={describedBy} invalid={!!errors.locations} value={p.locations} onChange={v => set('locations', v)} placeholder="New York, NY" max={10} commas={false} />}
        </Field>
        <Field label={LABELS.work_modes} required as="group" error={errors.work_modes}>
          {({ labelId }) => <CheckChips labelledBy={labelId} invalid={!!errors.work_modes} value={p.work_modes} onChange={(v: WorkMode[]) => set('work_modes', v)}
            options={[{ value: 'onsite', label: 'On-site' }, { value: 'hybrid', label: 'Hybrid' }, { value: 'remote', label: 'Remote' }]} />}
        </Field>
      </fieldset>

      <fieldset className="group">
        <legend>What</legend>
        <Field label={LABELS.include_keywords} help="Words to look for in job titles, like “backend” or “data analyst”. Separate with Enter or commas." error={errors.include_keywords}>
          {({ id, describedBy }) => <TagInput id={id} describedBy={describedBy} value={p.include_keywords} onChange={v => set('include_keywords', v)} placeholder="data analyst" />}
        </Field>
        <Field label={LABELS.exclude_keywords} help="Titles with these words are skipped." error={errors.exclude_keywords}>
          {({ id, describedBy }) => <TagInput id={id} describedBy={describedBy} value={p.exclude_keywords} onChange={v => set('exclude_keywords', v)} placeholder="sales engineer" />}
        </Field>
        <Field label={LABELS.seniority} required as="group" error={errors.seniority}>
          {({ labelId }) => <CheckChips labelledBy={labelId} invalid={!!errors.seniority} value={p.seniority} onChange={(v: Seniority[]) => set('seniority', v)}
            options={[{ value: 'junior', label: 'Junior' }, { value: 'mid', label: 'Mid' }, { value: 'senior', label: 'Senior' }, { value: 'staff', label: 'Staff' }]} />}
        </Field>
        <Field label={LABELS.min_base_salary} help="US dollars per year. Roles that list lower pay are skipped. Leave blank for no minimum." error={errors.min_base_salary}>
          {({ id, describedBy }) => (
            <div className="money">
              <span aria-hidden="true">$</span>
              <input id={id} aria-describedby={describedBy} aria-invalid={!!errors.min_base_salary || undefined} type="number" inputMode="numeric" min={0} step={1000}
                placeholder="120000" value={salary} onChange={e => { setSalary(e.target.value); if (errors.min_base_salary) setErrors(x => ({ ...x, min_base_salary: '' })) }} />
            </div>
          )}
        </Field>
      </fieldset>

      <fieldset className="group">
        <legend>Companies</legend>
        <Field label={LABELS.companies_prefer} help="These are tried first when they have a matching role." error={errors.companies_prefer}>
          {({ id, describedBy }) => <TagInput id={id} describedBy={describedBy} value={p.companies_prefer} onChange={v => set('companies_prefer', v)} placeholder="Example Corp" commas={false} />}
        </Field>
        <Field label={LABELS.companies_avoid} help="Never apply to these." error={errors.companies_avoid}>
          {({ id, describedBy }) => <TagInput id={id} describedBy={describedBy} value={p.companies_avoid} onChange={v => set('companies_avoid', v)} placeholder="Company name" commas={false} />}
        </Field>
      </fieldset>

      <fieldset className="group">
        <legend>Pace</legend>
        <Field label={LABELS.min_fit_score} as="group" help={FIT[p.min_fit_score]}>
          {({ labelId }) => <Segmented name="fit" labelledBy={labelId} value={String(p.min_fit_score) as '1'} onChange={v => set('min_fit_score', Number(v))}
            options={[1, 2, 3, 4, 5].map(n => ({ value: String(n) as '1', label: String(n) }))} />}
        </Field>
        <Field label={LABELS.max_per_day} as="group" help={`At most ${p.max_per_day} ${p.max_per_day === 1 ? 'application' : 'applications'} on a weekday.`}>
          {({ labelId }) => <Segmented name="perday" labelledBy={labelId} value={String(p.max_per_day) as '1'} onChange={v => set('max_per_day', Number(v))}
            options={[1, 2, 3, 4, 5].map(n => ({ value: String(n) as '1', label: String(n) }))} />}
        </Field>
      </fieldset>

      <fieldset className="group">
        <legend>Schedule and email</legend>
        <Field label={LABELS.daily_scan} as="group" help={p.daily_scan ? 'Searches for new roles every weekday on its own.' : 'Only searches when you press “Find jobs”.'}>
          {({ labelId }) => <Segmented name="daily" labelledBy={labelId} value={p.daily_scan ? 'on' : 'off'} onChange={v => set('daily_scan', v === 'on')}
            options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />}
        </Field>
        {p.daily_scan && (
          <Field label={LABELS.scan_time} help="New York time, Monday to Friday. Applications you approve are still sent from 9:00." error={errors.scan_time}>
            {({ id, describedBy }) => <input id={id} aria-describedby={describedBy} aria-invalid={!!errors.scan_time || undefined} type="time" step={900}
              className="time-input" value={p.scan_time} onChange={e => set('scan_time', e.target.value)} />}
          </Field>
        )}
        <Field label={LABELS.email_notifications} as="group" help={p.email_notifications ? 'After each search or application, a short summary goes to your sign-in email. Nothing is sent when nothing changed.' : 'No emails. Check Results for updates.'}>
          {({ labelId }) => <Segmented name="emails" labelledBy={labelId} value={p.email_notifications ? 'on' : 'off'} onChange={v => set('email_notifications', v === 'on')}
            options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />}
        </Field>
      </fieldset>

      <fieldset className="group">
        <legend>Dos and don’ts</legend>
        <Field label={LABELS.notes} help={`${p.notes.length} of ${NOTES_MAX} characters. For example: skip roles that need more than 3 office days.`} error={errors.notes}>
          {({ id, describedBy }) => <textarea id={id} aria-describedby={describedBy} rows={4} maxLength={NOTES_MAX} value={p.notes} onChange={e => set('notes', e.target.value)} />}
        </Field>
      </fieldset>

      <StepActions busy={busy} label="Save preferences" busyLabel="Saving…" error={formErr} />
    </form>
  )
}

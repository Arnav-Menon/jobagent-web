import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api, type FactValue, type FieldSpec, type Profile } from '../api'
import { errorField, errorText } from '../errors'
import { Icon, Skeleton } from '../ui'
import { Field, Segmented, StepActions, useDirty } from './controls'
import type { StepProps } from './types'

type Origin = 'confirmed' | 'suggested' | 'empty'

const GROUPS: { title: string; keys: string[] }[] = [
  { title: 'Contact', keys: ['name', 'email', 'phone', 'city', 'linkedin', 'github'] },
  { title: 'Work', keys: ['current_company', 'current_title', 'years_experience'] },
  { title: 'Education', keys: ['undergrad_school', 'recent_school', 'recent_degree', 'recent_field'] },
  { title: 'Work authorization', keys: ['work_authorized_us', 'requires_sponsorship'] },
]
const DEGREES: Record<string, string> = { bachelor: 'Bachelor’s', master: 'Master’s', phd: 'PhD', other: 'Other' }

// Form values are strings: bools as 'yes'/'no', numbers as their text.
const toText = (v: FactValue | undefined, f: FieldSpec) =>
  v === undefined || v === null ? '' : f.type === 'bool' ? (v === true || v === 'yes' || v === 'true' ? 'yes' : 'no') : String(v)
function fromText(s: string, f: FieldSpec): FactValue {
  if (f.type === 'bool') return s === 'yes'
  if (f.type === 'number') return Number(s)
  return s.trim()
}

function initial(p: Profile) {
  const values: Record<string, string> = {}
  const origin: Record<string, Origin> = {}
  for (const f of p.fields) {
    if (f.key in p.facts) { values[f.key] = toText(p.facts[f.key].value, f); origin[f.key] = 'confirmed' }
    else if (p.suggestions[f.key] !== undefined && p.suggestions[f.key] !== '') { values[f.key] = toText(p.suggestions[f.key], f); origin[f.key] = 'suggested' }
    else { values[f.key] = ''; origin[f.key] = 'empty' }
  }
  return { values, origin }
}

function validate(f: FieldSpec, v: string): string {
  if (!v.trim()) return f.required ? (f.type === 'bool' ? 'Choose yes or no.' : 'Required.') : ''
  if (f.type === 'number') {
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0 || n > 50) return 'Enter a number from 0 to 50.'
  }
  if (['text', 'email', 'tel', 'url'].includes(f.type) && v.trim().length > 200) return 'Keep this under 200 characters.'
  if (f.type === 'tel' && (!/^[0-9+().\-\s]{7,25}$/.test(v.trim()) || v.replace(/\D/g, '').length < 7)) return 'Enter a phone number with at least 7 digits.'
  if (f.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim())) return 'Enter an email address like name@example.com.'
  if (f.type === 'url' && !/^https?:\/\/\S+\.\S+/.test(v.trim())) return 'Enter a full link starting with https://'
  return ''
}

export default function DetailsStep({ onDone, setDirty }: StepProps) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [base, setBase] = useState<ReturnType<typeof initial>>({ values: {}, origin: {} })
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formErr, setFormErr] = useState('')
  const [busy, setBusy] = useState(false)

  const reset = (p: Profile) => { const b = initial(p); setProfile(p); setBase(b); setValues(b.values); setErrors({}) }
  useEffect(() => { api<Profile>('/me/profile').then(reset, e => setLoadErr(errorText(e))) }, [])
  useDirty(values, base.values, setDirty)

  const labels = useMemo(() => Object.fromEntries((profile?.fields || []).map(f => [f.key, f.label])), [profile])
  const groups = useMemo(() => {
    if (!profile) return []
    const known = new Set(GROUPS.flatMap(g => g.keys))
    const byKey = Object.fromEntries(profile.fields.map(f => [f.key, f]))
    const gs = GROUPS.map(g => ({ title: g.title, fields: g.keys.map(k => byKey[k]).filter(Boolean) }))
    const rest = profile.fields.filter(f => !known.has(f.key))
    if (rest.length) gs.push({ title: 'Other', fields: rest })
    return gs.filter(g => g.fields.length)
  }, [profile])

  if (loadErr) return <p className="form-error" role="alert"><Icon name="alert" size={16} /> {loadErr}</p>
  if (!profile) return <div className="step-body">{[0, 1, 2, 3].map(i => <div key={i} className="sk-field"><Skeleton w={140} h={12} /><Skeleton h={40} /></div>)}</div>

  const suggestedLeft = profile.fields.filter(f => base.origin[f.key] === 'suggested' && values[f.key] === base.values[f.key]).length
  const set = (k: string, v: string) => { setValues(x => ({ ...x, [k]: v })); if (errors[k]) setErrors(x => ({ ...x, [k]: '' })) }

  const save = async (ev: FormEvent) => {
    ev.preventDefault()
    setFormErr('')
    const errs: Record<string, string> = {}
    for (const f of profile.fields) { const m = validate(f, values[f.key] || ''); if (m) errs[f.key] = m }
    setErrors(errs)
    const bad = Object.keys(errs).filter(k => errs[k])
    if (bad.length) {
      setFormErr(bad.length === 1 ? `Fix “${labels[bad[0]]}” to continue.` : `Fix the ${bad.length} highlighted fields to continue.`)
      const target = document.querySelector<HTMLElement>(`[data-key="${bad[0]}"]`) || document.getElementById(`fact-${bad[0]}`)
      target?.focus()
      return
    }
    // Everything sent is stored as confirmed now; clearing a confirmed value removes it.
    const facts: Record<string, FactValue | null> = {}
    for (const f of profile.fields) {
      const v = values[f.key] || ''
      if (v.trim()) facts[f.key] = fromText(v, f)
      else if (f.key in profile.facts) facts[f.key] = null
    }
    setBusy(true)
    try {
      reset(await api<Profile>('/me/profile/facts', { method: 'PUT', body: JSON.stringify({ facts }) }))
      setDirty(false)
      onDone('Details confirmed.')
    } catch (e) {
      const f = errorField(e)
      if (f) setErrors(x => ({ ...x, [f]: 'This value wasn’t accepted. Check it and try again.' }))
      setFormErr(errorText(e, labels))
    } finally { setBusy(false) }
  }

  const tagFor = (k: string) => {
    const changed = values[k] !== base.values[k]
    if (changed) return <span className="src-tag tone-accent">Edited</span>
    if (base.origin[k] === 'confirmed') return <span className="src-tag tone-ok"><Icon name="check" size={12} /> Confirmed</span>
    if (base.origin[k] === 'suggested') return <span className="src-tag tone-held">From your resume</span>
    return null
  }

  return (
    <form className="step-body" onSubmit={save} noValidate>
      <p className="step-intro">
        These answer the standard questions on every application. Check each value. Saving confirms everything on this page.
      </p>
      {!profile.resume && <p className="notice tone-held"><Icon name="alert" size={16} /> Upload your resume first to fill most of these in for you, or type them yourself.</p>}
      {suggestedLeft > 0 && (
        <p className="notice tone-held">
          <Icon name="alert" size={16} /> {suggestedLeft} {suggestedLeft === 1 ? 'value was' : 'values were'} read from your resume and {suggestedLeft === 1 ? 'isn’t' : 'aren’t'} confirmed yet. Check {suggestedLeft === 1 ? 'it' : 'them'} before saving.
        </p>
      )}

      {groups.map(g => (
        <fieldset key={g.title} className="group">
          <legend>{g.title}</legend>
          <div className="field-grid">
            {g.fields.map(f => {
              const origin = values[f.key] === base.values[f.key] ? base.origin[f.key] : 'edited'
              return (
                <div key={f.key} className={`fact fact-${origin}${f.type === 'bool' ? ' fact-wide' : ''}`}>
                  <Field label={f.label} help={f.help} error={errors[f.key]} required={f.required} tag={tagFor(f.key)} as={f.type === 'bool' ? 'group' : 'label'}>
                    {({ id, describedBy, labelId }) => f.type === 'bool' ? (
                      <div id={`fact-${f.key}`} tabIndex={-1}>
                        <Segmented name={f.key} labelledBy={labelId} value={values[f.key] as 'yes' | 'no' | ''} invalid={!!errors[f.key]}
                          options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} onChange={v => set(f.key, v)} />
                      </div>
                    ) : f.type === 'enum' ? (
                      <select id={id} aria-describedby={describedBy} aria-invalid={!!errors[f.key] || undefined} value={values[f.key]} onChange={e => set(f.key, e.target.value)}
                        data-key={f.key}>
                        <option value="">Not set</option>
                        {(f.options || []).map(o => <option key={o} value={o}>{DEGREES[o] || o}</option>)}
                      </select>
                    ) : (
                      <input id={id} data-key={f.key} aria-describedby={describedBy} aria-invalid={!!errors[f.key] || undefined}
                        type={f.type === 'number' ? 'number' : f.type} inputMode={f.type === 'number' ? 'numeric' : undefined}
                        min={f.type === 'number' ? 0 : undefined} maxLength={f.type === 'number' ? undefined : 200} max={f.type === 'number' ? 50 : undefined}
                        autoComplete={({ name: 'name', email: 'email', phone: 'tel', city: 'address-level2' } as Record<string, string>)[f.key] || 'off'}
                        value={values[f.key]} onChange={e => set(f.key, e.target.value)} />
                    )}
                  </Field>
                </div>
              )
            })}
          </div>
        </fieldset>
      ))}

      <StepActions busy={busy} label="Confirm details" busyLabel="Saving…" error={formErr} />
    </form>
  )
}

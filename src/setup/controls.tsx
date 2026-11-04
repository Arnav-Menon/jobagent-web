import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Icon } from '../ui'

/** Single-choice segmented control built on native radios (arrow keys work). */
export function Segmented<V extends string>({ name, value, options, onChange, labelledBy, invalid, size = 'md' }: {
  name: string; value: V | ''; options: { value: V; label: ReactNode; tone?: 'ok' | 'held' | 'danger' }[]
  onChange: (v: V) => void; labelledBy?: string; invalid?: boolean; size?: 'md' | 'sm'
}) {
  return (
    <div className={`seg seg-${size}${invalid ? ' is-invalid' : ''}`} role="radiogroup" aria-labelledby={labelledBy} aria-invalid={invalid || undefined}>
      {options.map(o => (
        <label key={o.value} className={`${value === o.value ? 'on' : ''} ${o.tone ? `tone-${o.tone}` : ''}`}>
          <input className="sr-only" type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  )
}

/** Multi-choice chips built on native checkboxes. */
export function CheckChips<V extends string>({ value, options, onChange, labelledBy, invalid }: {
  value: V[]; options: { value: V; label: string }[]; onChange: (v: V[]) => void; labelledBy?: string; invalid?: boolean
}) {
  const toggle = (v: V) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
  return (
    <div className={`chips${invalid ? ' is-invalid' : ''}`} role="group" aria-labelledby={labelledBy}>
      {options.map(o => (
        <label key={o.value} className={value.includes(o.value) ? 'on' : ''}>
          <input className="sr-only" type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} />
          {value.includes(o.value) && <Icon name="check" size={14} />}
          {o.label}
        </label>
      ))}
    </div>
  )
}

/** Free-text list: Enter (or comma, unless disabled) adds, Backspace on empty removes the last one. */
export function TagInput({ id, value, onChange, placeholder, max = 30, maxLen = 80, describedBy, invalid, commas = true }: {
  id: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number; maxLen?: number; describedBy?: string; invalid?: boolean
  /** Treat commas as separators. Off for values that contain commas, like "New York, NY". */
  commas?: boolean
}) {
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const add = (raw: string) => {
    const parts = (commas ? raw.split(',') : [raw]).map(s => s.trim()).filter(Boolean)
    if (!parts.length) return
    const next = [...value]
    for (const p of parts) {
      if (p.length > maxLen) { setNote(`Keep each entry under ${maxLen} characters.`); continue }
      if (next.some(x => x.toLowerCase() === p.toLowerCase())) continue
      if (next.length >= max) { setNote(`Up to ${max} entries.`); break }
      next.push(p)
    }
    onChange(next); setText('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || (commas && e.key === ',')) { e.preventDefault(); add(text) }
    else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
  }
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(''), 4000); return () => clearTimeout(t) }, [note])
  return (
    <>
      <div className={`tags${invalid ? ' is-invalid' : ''}`} onClick={e => (e.currentTarget.querySelector('input') as HTMLInputElement).focus()}>
        {value.map(t => (
          <span key={t} className="tag">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter(x => x !== t))}><Icon name="x" size={13} /></button>
          </span>
        ))}
        <input id={id} value={text} placeholder={value.length ? '' : placeholder} aria-describedby={describedBy}
          onChange={e => {
            const v = e.target.value
            if (commas && v.includes(',')) { const parts = v.split(','); const rest = parts.pop() || ''; add(parts.join(',')); setText(rest.trimStart()) }
            else setText(v)
          }} onKeyDown={onKey} onBlur={() => add(text)} />
      </div>
      {note && <p className="field-error" role="status">{note}</p>}
    </>
  )
}

/** Labelled form row with help text and an error slot wired up for screen readers. */
export function Field({ label, help, error, required, children, tag, as = 'label' }: {
  label: string; help?: string; error?: string; required?: boolean; tag?: ReactNode
  children: (ids: { id: string; describedBy?: string; labelId: string }) => ReactNode; as?: 'label' | 'group'
}) {
  const id = useId()
  const labelId = `${id}-l`
  const describedBy = [help && `${id}-h`, error && `${id}-e`].filter(Boolean).join(' ') || undefined
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <div className="field-top">
        {as === 'label'
          ? <label id={labelId} htmlFor={id}>{label}{required && <span className="req" aria-hidden="true"> *</span>}{required && <span className="sr-only"> (required)</span>}</label>
          : <span id={labelId} className="field-label">{label}{required && <span className="req" aria-hidden="true"> *</span>}</span>}
        {tag}
      </div>
      {children({ id, describedBy, labelId })}
      {help && <p id={`${id}-h`} className="field-help">{help}</p>}
      {error && <p id={`${id}-e`} className="field-error">{error}</p>}
    </div>
  )
}

export function StepActions({ busy, label, busyLabel, error, extra }: { busy: boolean; label: string; busyLabel: string; error?: string; extra?: ReactNode }) {
  return (
    <div className="step-actions">
      {error && <p className="form-error" role="alert"><Icon name="alert" size={16} /> {error}</p>}
      <div className="step-actions-row">
        {extra}
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? busyLabel : label}</button>
      </div>
    </div>
  )
}

/** Report whether `current` differs from `initial` to the parent (for the unsaved-changes guard). */
export function useDirty(current: unknown, initial: unknown, setDirty: (d: boolean) => void) {
  const a = JSON.stringify(current), b = JSON.stringify(initial)
  useEffect(() => { setDirty(a !== b) }, [a, b, setDirty])
}

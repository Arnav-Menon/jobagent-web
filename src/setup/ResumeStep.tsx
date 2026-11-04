import { useEffect, useRef, useState, type DragEvent } from 'react'
import { api, type FactValue, type Profile, type ResumeMeta } from '../api'
import { errorText } from '../errors'
import { Icon, Skeleton, fullTime, relTime } from '../ui'
import type { StepProps } from './types'

const MAX = 10 * 1024 * 1024
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

export default function ResumeStep({ onDone }: StepProps) {
  const [resume, setResume] = useState<ResumeMeta | null | undefined>(undefined)
  const [loadErr, setLoadErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api<Profile>('/me/profile').then(p => setResume(p.resume), e => setLoadErr(errorText(e)))
  }, [])

  const upload = async (file?: File | null) => {
    if (!file) return
    setErr('')
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return setErr('That file isn’t a PDF. Export your resume as a PDF and upload it again.')
    if (file.size > MAX) return setErr('That file is over 10 MB. Upload a smaller PDF.')
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api<{ resume: ResumeMeta; suggestions: Record<string, FactValue> }>('/me/resume', { method: 'POST', body: fd })
      setResume(res.resume)
      const n = Object.keys(res.suggestions || {}).length
      onDone(n ? `Resume uploaded. ${n} details found for you to check.` : 'Resume uploaded.')
    } catch (e) { setErr(errorText(e)) }
    finally { setBusy(false); if (input.current) input.current.value = '' }
  }

  const view = async () => {
    const w = window.open('about:blank', '_blank')
    try {
      const { url } = await api<{ url: string }>('/me/resume/url')
      if (w) { w.opener = null; w.location.href = url } else window.location.assign(url)
    } catch (e) { w?.close(); setErr(errorText(e)) }
  }

  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files[0]) }

  return (
    <div className="step-body">
      <p className="step-intro">
        Your resume is the source for your details and for any written answers. Answers that quote it use its exact words.
      </p>

      {loadErr && <p className="form-error" role="alert"><Icon name="alert" size={16} /> {loadErr}</p>}
      {resume === undefined && !loadErr && <div className="file-card"><Skeleton w={40} h={48} /><div className="grow"><Skeleton w="50%" /><Skeleton w="30%" h={11} /></div></div>}
      {resume && (
        <div className="file-card">
          <span className="file-icon" aria-hidden="true">PDF</span>
          <div className="grow">
            <p className="file-name">{resume.filename}</p>
            <p className="file-meta">
              {kb(resume.size)}, {resume.pages} {resume.pages === 1 ? 'page' : 'pages'}. Uploaded <time dateTime={resume.uploaded_at} title={fullTime(resume.uploaded_at)}>{relTime(resume.uploaded_at).toLowerCase()}</time>
            </p>
          </div>
          <button type="button" className="btn btn-quiet btn-sm" onClick={view}>View PDF</button>
        </div>
      )}

      <div
        className={`drop${over ? ' over' : ''}${busy ? ' busy' : ''}`}
        onDragOver={e => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <input ref={input} id="resume-file" className="sr-only" type="file" accept="application/pdf,.pdf" onChange={e => upload(e.target.files?.[0])} disabled={busy} />
        {busy ? (
          <p className="drop-main" role="status"><span className="spinner" aria-hidden="true" /> Uploading and reading your resume…</p>
        ) : (
          <>
            <p className="drop-main">
              <label htmlFor="resume-file" className="drop-pick">{resume ? 'Choose a new PDF' : 'Choose a PDF'}</label> or drop it here
            </p>
            <p className="drop-sub">PDF only, up to 10 MB.{resume ? ' Uploading replaces your current resume.' : ''}</p>
          </>
        )}
      </div>
      {err && <p className="form-error" role="alert"><Icon name="alert" size={16} /> {err}</p>}
      {resume && !busy && (
        <div className="step-actions-row">
          <button type="button" className="btn btn-primary" onClick={() => onDone('')}>Continue to details</button>
        </div>
      )}
    </div>
  )
}

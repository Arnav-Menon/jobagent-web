import { useState, type FormEvent } from 'react'
import { api, logOut, type Me } from '../api'
import { errorText } from '../errors'
import { Icon, useToast } from '../ui'

/** Export or delete everything Job Agent stores about you. */
export default function DataStep({ me }: { me: Me }) {
  const toast = useToast()
  const [busy, setBusy] = useState<'' | 'export' | 'delete'>('')
  const [confirmText, setConfirmText] = useState('')
  const [err, setErr] = useState('')

  const download = async () => {
    setBusy('export'); setErr('')
    try {
      const data = await api<unknown>('/me/export')
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const a = Object.assign(document.createElement('a'), { href: url, download: `job-agent-data-${new Date().toISOString().slice(0, 10)}.json` })
      a.click(); URL.revokeObjectURL(url)
      toast('Your data was downloaded.')
    } catch (e) { setErr(errorText(e)) } finally { setBusy('') }
  }

  const remove = async (ev: FormEvent) => {
    ev.preventDefault()
    if (confirmText.trim().toLowerCase() !== me.email.toLowerCase()) { setErr('Type your email address exactly to confirm.'); return }
    setBusy('delete'); setErr('')
    try {
      await api('/me/delete', { method: 'POST', body: JSON.stringify({ confirm_email: confirmText.trim() }) })
      await logOut()
    } catch (e) { setErr(errorText(e)); setBusy('') }
  }

  return (
    <div className="step-body">
      <p className="step-intro">Job Agent stores your resume, confirmed details, standing answers, preferences, drafts, screenshots and the list of applications it sent.
        Read how it’s used in the <a href="#/terms">terms and privacy notice</a>.</p>

      <fieldset className="group">
        <legend>Download</legend>
        <p className="hint">A JSON file with everything above except the resume PDF itself (view that in the Resume step).</p>
        <div><button className="btn btn-quiet" onClick={download} disabled={!!busy}>{busy === 'export' ? 'Preparing…' : 'Download my data'}</button></div>
      </fieldset>

      <fieldset className="group danger-zone">
        <legend>Delete account</legend>
        {me.role === 'admin' ? <p className="hint">The admin account can’t be deleted from here.</p> : (
          <form onSubmit={remove} className="delete-form">
            <p className="hint">Deletes your resume, details, answers, preferences, drafts, screenshots and run history, then signs you out. This can’t be undone.
              The list of companies and roles already applied to is kept so you’re never sent to the same posting twice. Applications already sent can’t be withdrawn from here.</p>
            <label htmlFor="del-confirm">Type <strong>{me.email}</strong> to confirm</label>
            <div className="field-row">
              <input id="del-confirm" type="email" autoComplete="off" value={confirmText} onChange={e => { setConfirmText(e.target.value); setErr('') }} />
              <button className="btn btn-danger" type="submit" disabled={!!busy || !confirmText}><Icon name="trash" size={16} /> {busy === 'delete' ? 'Deleting…' : 'Delete everything'}</button>
            </div>
          </form>
        )}
      </fieldset>
      {err && <p className="form-error" role="alert"><Icon name="alert" size={16} /> {err}</p>}
    </div>
  )
}

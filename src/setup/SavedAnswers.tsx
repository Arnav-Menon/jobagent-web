import { useEffect, useState, type FormEvent } from 'react'
import { api, type SavedAnswer, type SavedAnswers as Saved } from '../api'
import { errorText } from '../errors'
import { Icon, Skeleton, useToast } from '../ui'

type Edit = { index: number | null; question: string; answer: string }

/** The user's own answers to questions the agent can't answer from the profile. Each change saves immediately. */
export default function SavedAnswers() {
  const toast = useToast()
  const [list, setList] = useState<SavedAnswer[] | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [edit, setEdit] = useState<Edit | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { api<Saved>('/me/answers').then(r => setList(r.answers), e => setLoadErr(errorText(e))) }, [])

  const store = async (next: SavedAnswer[], done: string) => {
    setBusy(true); setErr('')
    try {
      const r = await api<Saved>('/me/answers', { method: 'PUT', body: JSON.stringify({ answers: next.map(({ question, answer }) => ({ question, answer })) }) })
      setList(r.answers); setEdit(null)
      toast(r.replan_run ? `${done} Applications asking this question are being updated.` : done)
      return true
    } catch (e) { setErr(errorText(e)); return false }
    finally { setBusy(false) }
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!edit || !list) return
    const question = edit.question.trim(), answer = edit.answer.trim()
    if (!question || !answer) { setErr('Fill in both the question and your answer.'); return }
    const next = edit.index === null ? [...list, { question, answer }] : list.map((a, i) => (i === edit.index ? { question, answer } : a))
    await store(next, edit.index === null ? 'Answer saved.' : 'Answer updated.')
  }
  const remove = (i: number) => list && store(list.filter((_, j) => j !== i), 'Answer deleted.')

  if (loadErr) return <p className="form-error" role="alert"><Icon name="alert" size={16} /> {loadErr}</p>
  if (!list) return <div className="sk-field"><Skeleton w="60%" /><Skeleton w="80%" h={36} /></div>

  const form = (
    <form className="answer-form" onSubmit={submit} noValidate>
      <div className="answer-field">
        <label htmlFor="sa-q" className="field-label">Question, worded exactly as the form asks it</label>
        <input id="sa-q" type="text" maxLength={300} value={edit?.question || ''} onChange={e => setEdit(x => x && { ...x, question: e.target.value })} />
      </div>
      <div className="answer-field">
        <label htmlFor="sa-a" className="field-label">Your answer</label>
        <textarea id="sa-a" rows={3} maxLength={4000} value={edit?.answer || ''} onChange={e => setEdit(x => x && { ...x, answer: e.target.value })} />
        <p className="field-help">For a multiple-choice question, write the option exactly as it appears.</p>
      </div>
      {err && <p className="form-error" role="alert">{err}</p>}
      <div className="answer-actions">
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => { setEdit(null); setErr('') }} disabled={busy}>Cancel</button>
        <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save answer'}</button>
      </div>
    </form>
  )

  return (
    <section className="saved-answers" aria-labelledby="sa-title">
      <h3 id="sa-title">Your answers to other questions</h3>
      <p className="step-intro">
        When a form asks one of these questions, the agent uses your answer. It has to be the same question, ignoring capitals and punctuation;
        the agent never guesses that a differently worded question means the same thing. You can also add answers from a held application on the Results page.
      </p>
      {list.length === 0 && !edit && <p className="field-help">No saved answers yet.</p>}
      {list.length > 0 && (
        <ul className="sa-list">
          {list.map((a, i) => (
            <li key={a.question}>
              {edit?.index === i ? form : (
                <>
                  <div className="sa-text">
                    <p className="sa-q">{a.question}</p>
                    <p className="sa-a">{a.answer}</p>
                  </div>
                  <div className="sa-actions">
                    <button className="link-btn" disabled={busy || !!edit} onClick={() => { setErr(''); setEdit({ index: i, question: a.question, answer: a.answer }) }}>Edit</button>
                    <button className="link-btn" disabled={busy || !!edit} onClick={() => remove(i)}>Delete</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {edit?.index === null ? form : (
        <button className="btn btn-quiet btn-sm" disabled={busy || !!edit} onClick={() => { setErr(''); setEdit({ index: null, question: '', answer: '' }) }}>Add an answer</button>
      )}
      {err && !edit && <p className="form-error" role="alert">{err}</p>}
    </section>
  )
}

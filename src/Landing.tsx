import { useState } from 'react'
import { GoogleMark, Icon, Logo, ThemeToggle } from './ui'

type Field = { q: string; a: string; src: string; held?: boolean }
const FIELDS: Field[] = [
  { q: 'Full name', a: 'Alex Rivera', src: 'Your profile' },
  { q: 'Years working with SQL', a: '4', src: 'Resume: “4 years of SQL and dbt”' },
  { q: 'Authorized to work in the US?', a: 'Yes', src: 'Your standing answer' },
  { q: 'Expected base salary', a: '', src: 'No confirmed answer', held: true },
]

function FormDemo() {
  return (
    <figure className="demo" aria-label="Example: how the agent fills an application">
      <div className="demo-head">
        <div>
          <p className="demo-role">Data Analyst</p>
          <p className="demo-co">Example Corp, New York (hybrid)</p>
        </div>
        <span className="badge tone-plain">Greenhouse</span>
      </div>
      <ol className="demo-fields">
        {FIELDS.map((f, i) => (
          <li key={f.q} className={f.held ? 'demo-field held' : 'demo-field'} style={{ ['--i' as string]: i }}>
            <span className="demo-q">{f.q}</span>
            <span className="demo-a">{f.held ? <span className="demo-blank">Waiting for you</span> : f.a}</span>
            <span className="demo-src">
              <Icon name={f.held ? 'alert' : 'check'} size={14} />
              {f.src}
            </span>
          </li>
        ))}
      </ol>
      <figcaption className="demo-foot">
        <strong>Held.</strong> One required question has no confirmed answer, so nothing was typed or sent.
      </figcaption>
    </figure>
  )
}

const STEPS = [
  { t: 'Give it your facts', d: 'Upload your resume, confirm the details it pulls out, and answer the questions every application asks once.' },
  { t: 'Set your rules', d: 'Choose locations, titles and a pay floor. Roles that don’t pass are skipped before anything is scored.' },
  { t: 'Review or let it run', d: 'Approve each application yourself, or let it submit the ones that pass. Either way you get an email for each one.' },
]

export default function Landing({ onSignIn }: { onSignIn: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const go = async () => {
    setBusy(true); setErr('')
    try { await onSignIn() } catch (e) {
      const code = (e as { code?: string }).code
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request')
        setErr(code === 'auth/popup-blocked' ? 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.' : 'Sign-in didn’t finish. Try again.')
    } finally { setBusy(false) }
  }

  return (
    <div className="landing">
      <header className="bar bar-landing">
        <Logo />
        <ThemeToggle />
      </header>

      <section className="hero">
        <div className="hero-copy">
          <h1>Applies to jobs for you. Only with answers you’ve confirmed.</h1>
          <p className="lede">
            Job Agent finds roles on company career boards, checks them against your rules, and fills in the
            application. If a question needs an answer you haven’t confirmed, it stops and asks you instead of guessing.
          </p>
          <div className="cta">
            <button className="btn btn-google" onClick={go} disabled={busy}>
              <GoogleMark />
              {busy ? 'Opening Google…' : 'Sign in with Google'}
            </button>
            <p className="cta-note"><Icon name="lock" size={15} /> Invite only. Use the Google account you were invited with.</p>
          </div>
          {err && <p className="inline-error" role="alert">{err}</p>}
        </div>
        <FormDemo />
      </section>

      <section className="how" aria-labelledby="how-title">
        <h2 id="how-title">How it works</h2>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.t}>
              <span className="step-n" aria-hidden="true">{i + 1}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="trust">
        <h2>What it won’t do</h2>
        <ul>
          <li>Make up an answer. Every field comes from your profile, your resume or an answer you set.</li>
          <li>Apply twice to the same role, or more than five times a day.</li>
          <li>Solve CAPTCHAs or contact recruiters on your behalf.</li>
        </ul>
      </section>

      <footer className="foot">Job Agent is a private, invite-only tool.</footer>
    </div>
  )
}

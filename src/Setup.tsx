import type { Me } from './api'
import { Badge } from './ui'

const MODES: Record<string, string> = {
  review: 'You approve each application before it’s sent.',
  auto: 'Applications that pass your rules are sent without asking. You get an email for each one.',
}

const STEPS = [
  { t: 'Upload your resume', d: 'A PDF of your current resume. Answers are drawn from it with exact quotes.' },
  { t: 'Confirm your details', d: 'Check the name, contact details and history pulled from your resume.' },
  { t: 'Answer the standard questions', d: 'Work authorization, sponsorship, start date and the like. You answer once; it reuses them.' },
  { t: 'Set your preferences', d: 'Locations, titles you want, and the lowest pay you’ll consider.' },
  { t: 'Choose how it applies', d: 'Review each application yourself, or let it apply automatically.' },
]

export default function Setup({ me }: { me: Me }) {
  const first = me.display_name?.split(' ')[0]
  return (
    <div className="page setup">
      <div className="page-head">
        <h1>{first ? `Welcome, ${first}` : 'Welcome'}</h1>
        <p className="sub">Finish these steps and the agent can start applying for you.</p>
      </div>

      <div className="setup-grid">
        <section className="panel checklist" aria-labelledby="checklist-title">
          <div className="panel-head">
            <h2 id="checklist-title">Your setup</h2>
            <span className="progress-text">0 of {STEPS.length} done</span>
          </div>
          <div className="progress" aria-hidden="true"><span style={{ width: '0%' }} /></div>
          <ol className="check-steps">
            {STEPS.map((s, i) => (
              <li key={s.t} className={i === 0 ? 'next' : ''}>
                <span className="check-n" aria-hidden="true">{i + 1}</span>
                <div className="check-body">
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
                <span className="soon">{i === 0 ? 'Opens in the next update' : 'Coming next'}</span>
              </li>
            ))}
          </ol>
        </section>

        <aside className="panel account" aria-labelledby="account-title">
          <h2 id="account-title">Your account</h2>
          <dl>
            <div><dt>Status</dt><dd><Badge value={me.status} /></dd></div>
            <div><dt>Mode</dt><dd><Badge value={me.mode} /></dd></div>
            <div><dt>Signed in as</dt><dd className="mono-ish">{me.email}</dd></div>
          </dl>
          <p className="account-note">{MODES[me.mode] || 'Mode can be changed once setup is finished.'}</p>
          <p className="account-note">Nothing is submitted until your resume and details are confirmed.</p>
        </aside>
      </div>
    </div>
  )
}

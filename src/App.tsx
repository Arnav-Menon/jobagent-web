import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { api, ApiError, auth, logOut, signIn, type Me } from './api'
import Admin from './Admin'

type State = { kind: 'loading' } | { kind: 'signed_out' } | { kind: 'refused'; reason: string } | { kind: 'ready'; me: Me } | { kind: 'error'; message: string }

const REFUSALS: Record<string, string> = {
  not_invited: "This Google account hasn't been invited yet. Ask the admin to invite this email address.",
  paused: 'Your account is paused. Contact the admin.',
  email_not_verified: 'Your Google email is not verified.',
  google_sign_in_required: 'Please sign in with Google.',
}

export default function App() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [tab, setTab] = useState<'home' | 'admin'>('home')

  useEffect(() => onAuthStateChanged(auth, async (user: User | null) => {
    if (!user) return setState({ kind: 'signed_out' })
    setState({ kind: 'loading' })
    try {
      setState({ kind: 'ready', me: await api<Me>('/me') })
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setState({ kind: 'refused', reason: e.detail })
      else setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }), [])

  return (
    <main>
      <header>
        <h1>Job Agent</h1>
        {auth.currentUser && <button className="link" onClick={logOut}>Sign out</button>}
      </header>
      {state.kind === 'loading' && <p>Loading…</p>}
      {state.kind === 'signed_out' && (
        <section className="card">
          <p>Sign in to set up your job search. Access is invite-only.</p>
          <button onClick={() => signIn().catch(e => setState({ kind: 'error', message: e.message }))}>Sign in with Google</button>
        </section>
      )}
      {state.kind === 'refused' && <section className="card warn"><p>{REFUSALS[state.reason] || state.reason}</p><p className="muted">Signed in as {auth.currentUser?.email}</p></section>}
      {state.kind === 'error' && <section className="card warn"><p>Something went wrong: {state.message}</p></section>}
      {state.kind === 'ready' && (
        <>
          <nav>
            <button className={tab === 'home' ? 'tab on' : 'tab'} onClick={() => setTab('home')}>My setup</button>
            {state.me.role === 'admin' && <button className={tab === 'admin' ? 'tab on' : 'tab'} onClick={() => setTab('admin')}>Admin</button>}
          </nav>
          {tab === 'home' && (
            <section className="card">
              <h2>Welcome{state.me.display_name ? `, ${state.me.display_name}` : ''}</h2>
              <p>Your account is <b>{state.me.status}</b> ({state.me.mode} mode).</p>
              <p className="muted">Next: upload your resume, confirm your details and set your preferences. (Coming in the next update.)</p>
            </section>
          )}
          {tab === 'admin' && state.me.role === 'admin' && <Admin me={state.me} />}
        </>
      )}
    </main>
  )
}

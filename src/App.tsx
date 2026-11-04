import { useCallback, useEffect, useRef, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { api, ApiError, auth, DEMO, logOut, signIn, type Me } from './api'
import Admin from './Admin'
import Landing from './Landing'
import Setup from './Setup'
import { Avatar, Icon, Logo, Skeleton, ThemeToggle, ToastProvider } from './ui'

type State =
  | { kind: 'loading' }
  | { kind: 'signed_out' }
  | { kind: 'refused'; reason: string }
  | { kind: 'ready'; me: Me }
  | { kind: 'error'; message: string }

type Tab = 'setup' | 'admin'

const REFUSALS: Record<string, { title: string; body: string }> = {
  not_invited: {
    title: 'This account isn’t invited yet',
    body: 'Job Agent is invite only. Ask the admin to invite this email address, or sign in with the Google account you were invited with.',
  },
  paused: {
    title: 'Your account is paused',
    body: 'Nothing will be submitted for you while it’s paused. Ask the admin to resume it.',
  },
  email_not_verified: {
    title: 'Your Google email isn’t verified',
    body: 'Verify the email address on your Google account, then sign in again.',
  },
  google_sign_in_required: {
    title: 'Sign in with Google',
    body: 'Job Agent only accepts Google sign-in. Sign out and use “Sign in with Google”.',
  },
}

function demoState(): State | null {
  if (!import.meta.env.DEV || !DEMO) return null
  if (DEMO === 'landing') return { kind: 'signed_out' }
  if (DEMO === 'loading') return { kind: 'loading' }
  if (DEMO === 'error') return { kind: 'error', message: 'Failed to fetch' }
  if (REFUSALS[DEMO]) return { kind: 'refused', reason: DEMO }
  return null // admin / user / admin-*: fetch /me through the fixture API
}

export default function App() {
  const [state, setState] = useState<State>(() => demoState() || { kind: 'loading' })
  const [tab, setTab] = useState<Tab>(() => (DEMO?.startsWith('admin') ? 'admin' : 'setup'))

  const loadMe = useCallback(async () => {
    setState({ kind: 'loading' })
    try {
      setState({ kind: 'ready', me: await api<Me>('/me') })
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setState({ kind: 'refused', reason: e.detail })
      else setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }, [])

  useEffect(() => {
    if (import.meta.env.DEV && DEMO) {
      if (!demoState()) loadMe()
      return
    }
    return onAuthStateChanged(auth, user => (user ? loadMe() : setState({ kind: 'signed_out' })))
  }, [loadMe])

  const email = auth.currentUser?.email || (DEMO ? 'alex.rivera@example.com' : '')

  return (
    <ToastProvider>
      {state.kind === 'signed_out' && <Landing onSignIn={signIn} />}
      {state.kind === 'loading' && <Shell><LoadingPage /></Shell>}
      {state.kind === 'refused' && (
        <Shell me={null}>
          <Gate tone="held" title={REFUSALS[state.reason]?.title || 'You can’t use Job Agent with this account'}
            body={REFUSALS[state.reason]?.body || `The server refused access (${state.reason}).`} email={email} />
        </Shell>
      )}
      {state.kind === 'error' && (
        <Shell me={null}>
          <Gate tone="danger" title="Couldn’t reach Job Agent"
            body={`Your account details didn’t load (${state.message}). Check your connection and try again.`}
            email={email} onRetry={loadMe} />
        </Shell>
      )}
      {state.kind === 'ready' && (
        <Shell me={state.me} tab={tab} onTab={setTab}>
          {tab === 'admin' && state.me.role === 'admin' ? <Admin me={state.me} /> : <Setup me={state.me} />}
        </Shell>
      )}
    </ToastProvider>
  )
}

function Shell({ me, tab, onTab, children }: { me?: Me | null; tab?: Tab; onTab?: (t: Tab) => void; children: React.ReactNode }) {
  const tabs: { id: Tab; label: string }[] = me ? [{ id: 'setup', label: 'Setup' }, ...(me.role === 'admin' ? [{ id: 'admin' as Tab, label: 'Admin' }] : [])] : []
  return (
    <div className="shell">
      <a className="skip" href="#main">Skip to content</a>
      <header className="bar">
        <div className="bar-inner">
          <Logo />
          {tabs.length > 1 && (
            <nav className="tabs" aria-label="Sections">
              {tabs.map(t => (
                <button key={t.id} className="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => onTab?.(t.id)}>{t.label}</button>
              ))}
            </nav>
          )}
          <div className="bar-end">
            <ThemeToggle />
            {me === undefined ? <Skeleton w={32} h={32} /> : <UserMenu me={me} />}
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>{children}</main>
    </div>
  )
}

function UserMenu({ me }: { me: Me | null }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const user = auth.currentUser
  const name = me?.display_name || user?.displayName || ''
  const email = me?.email || user?.email || (DEMO ? 'alex.rivera@example.com' : '')

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="menu" ref={ref}>
      <button className="avatar-btn" aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen(o => !o)}>
        <Avatar name={name} email={email} photo={user?.photoURL} size={34} />
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          <div className="menu-who">
            {name && <strong>{name}</strong>}
            <span>{email}</span>
          </div>
          <button role="menuitem" className="menu-item" onClick={() => { setOpen(false); logOut() }} autoFocus>
            <Icon name="logout" size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function Gate({ tone, title, body, email, onRetry }: { tone: 'held' | 'danger'; title: string; body: string; email: string; onRetry?: () => void }) {
  return (
    <div className="gate">
      <div className={`gate-mark tone-${tone}`} aria-hidden="true"><Icon name={tone === 'held' ? 'lock' : 'alert'} size={24} /></div>
      <h1>{title}</h1>
      <p>{body}</p>
      {email && <p className="gate-who">Signed in as <strong>{email}</strong></p>}
      <div className="gate-actions">
        {onRetry && <button className="btn btn-primary" onClick={onRetry}><Icon name="refresh" size={16} /> Try again</button>}
        <button className={onRetry ? 'btn btn-quiet' : 'btn btn-primary'} onClick={() => logOut()}>
          <Icon name="logout" size={16} /> {onRetry ? 'Sign out' : 'Use a different account'}
        </button>
      </div>
    </div>
  )
}

function LoadingPage() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading your account">
      <div className="page-head"><Skeleton w={260} h={34} /><Skeleton w={380} h={14} /></div>
      <div className="setup-grid">
        <div className="panel">{[0, 1, 2, 3].map(i => <div key={i} className="sk-row"><Skeleton w={28} h={28} /><div><Skeleton w="50%" /><Skeleton w="80%" h={11} /></div></div>)}</div>
        <div className="panel"><Skeleton w="60%" /><Skeleton w="90%" h={11} /><Skeleton w="70%" h={11} /></div>
      </div>
    </div>
  )
}

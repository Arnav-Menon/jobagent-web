import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

/* ---------- time ---------- */

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60],
]
export function relTime(iso?: string): string {
  if (!iso) return 'Never'
  const secs = (new Date(iso).getTime() - Date.now()) / 1000
  if (Number.isNaN(secs)) return 'Unknown'
  for (const [unit, size] of UNITS) if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit)
  return 'Just now'
}
export const fullTime = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '')

/* ---------- avatar ---------- */

export function initials(name: string, email: string) {
  const src = name.trim() || email.split('@')[0]
  const parts = src.split(/[\s._-]+/).filter(Boolean)
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

// Stable hue per person so a table of initials is easy to scan.
function hue(seed: string) {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

export function Avatar({ name, email, photo, size = 32 }: { name: string; email: string; photo?: string | null; size?: number }) {
  const [broken, setBroken] = useState(false)
  if (photo && !broken)
    return <img className="avatar" src={photo} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBroken(true)} />
  return (
    <span className="avatar" aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.38, ['--h' as string]: hue(email) }}>
      {initials(name, email)}
    </span>
  )
}

/* ---------- badges ---------- */

const TONE: Record<string, string> = { active: 'ok', paused: 'held', admin: 'accent', user: 'plain', review: 'plain', auto: 'accent' }
export function Badge({ value, label }: { value: string; label?: string }) {
  return <span className={`badge tone-${TONE[value] || 'plain'}`}>{label || value[0].toUpperCase() + value.slice(1)}</span>
}

/* ---------- skeleton ---------- */

export const Skeleton = ({ w = '100%', h = 14 }: { w?: number | string; h?: number }) => (
  <span className="skeleton" style={{ width: w, height: h }} aria-hidden="true" />
)

/* ---------- toasts ---------- */

type Toast = { id: number; text: string; tone: 'ok' | 'held' | 'danger' }
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const next = useRef(0)
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = ++next.current
    setToasts(t => [...t, { id, text, tone }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), tone === 'ok' ? 4000 : 7000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast tone-${t.tone}`}>
            <Icon name={t.tone === 'ok' ? 'check' : 'alert'} />
            <span>{t.text}</span>
            <button className="icon-btn" aria-label="Dismiss" onClick={() => setToasts(x => x.filter(y => y.id !== t.id))}><Icon name="x" /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------- theme ---------- */

type Theme = 'light' | 'dark'
const systemTheme = (): Theme => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme | null) || systemTheme())
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  const toggle = () => setTheme(t => {
    const n = t === 'dark' ? 'light' : 'dark'
    localStorage.setItem('theme', n)
    return n
  })
  return [theme, toggle] as const
}

export function ThemeToggle() {
  const [theme, toggle] = useTheme()
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  return (
    <button className="icon-btn" onClick={toggle} aria-label={label} title={label}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  )
}

/* ---------- logo + icons ---------- */

export function Logo() {
  return (
    <span className="logo">
      <svg viewBox="0 0 28 28" width="26" height="26" aria-hidden="true">
        <rect x="3" y="2" width="19" height="24" rx="3.5" fill="var(--accent)" />
        <path d="M8 9h9M8 13.5h9M8 18h5" stroke="var(--accent-ink)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="21" cy="20" r="5.5" fill="var(--ok)" stroke="var(--bg)" strokeWidth="2" />
        <path d="m18.6 20 1.7 1.7 3-3.2" stroke="#fff" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Job Agent
    </span>
  )
}

const PATHS: Record<string, ReactNode> = {
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  alert: <><path d="M12 8v5" /><circle cx="12" cy="16.5" r=".6" fill="currentColor" /><circle cx="12" cy="12" r="9" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  pause: <path d="M9 6v12M15 6v12" />,
  play: <path d="M8 5.5v13l10.5-6.5Z" />,
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />,
  logout: <><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></>,
  mail: <><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></>,
}
export function Icon({ name, size = 18 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}

export function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

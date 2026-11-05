import { ApiError } from './api'

const CODES: Record<string, string> = {
  not_a_pdf: 'That file isn’t a PDF. Export your resume as a PDF and upload it again.',
  too_large: 'That file is over 10 MB. Upload a smaller PDF.',
  unreadable_pdf: 'The text in that PDF couldn’t be read. If it’s a scanned image, export a text-based PDF from your editor.',
  no_resume: 'You haven’t uploaded a resume yet.',
  setup_incomplete: 'Finish every setup step before turning on automatic mode.',
  network: 'Couldn’t reach the server. Check your connection and try again.',
  invalid_request: 'Some values weren’t accepted. Check the form and try again.',
  run_in_progress: 'A search is already running. Results will appear here when it finishes.',
  not_awaiting_approval: 'This application was already decided, so nothing changed. The list has been refreshed.',
  limit_full_pending: 'Your daily limit is taken up by applications that are still unconfirmed, so nothing new can be scheduled. Raise your daily limit in Preferences, or wait until those are confirmed.',
  unknown_draft: 'That application no longer exists. The list has been refreshed.',
  not_signed_in: 'Your sign-in expired. Sign out and sign in again.',
  missing_token: 'Your sign-in expired. Sign out and sign in again.',
  invalid_token: 'Your sign-in expired. Sign out and sign in again.',
}

/** The field named by `invalid_value:<f>` / `unknown_field:<f>`, if any. */
export function errorField(e: unknown): string | null {
  const d = e instanceof ApiError ? e.detail : ''
  const m = d.match(/^(?:invalid_value|unknown_field):(.+)$/)
  return m ? m[1] : null
}

export function errorText(e: unknown, labels: Record<string, string> = {}): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : String(e)
  if (CODES[e.detail]) return CODES[e.detail]
  const f = errorField(e)
  if (f) {
    const name = labels[f] || f.replace(/_/g, ' ')
    return e.detail.startsWith('unknown_field') ? `“${name}” isn’t a field the server knows about.` : `Check “${name}”. The value wasn’t accepted.`
  }
  if (e.status === 404) return 'This part of Job Agent isn’t available yet. Try again in a little while.'
  if (e.status >= 500) return 'The server had a problem. Try again in a moment.'
  return `Request failed (${e.detail}).`
}

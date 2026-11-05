/** Whether the open Setup step has edits that aren't saved yet (set by Setup, checked before leaving it). */
export const unsaved = { dirty: false }

export const LEAVE_MESSAGE = 'You have unsaved changes in Setup. Leave without saving?'

/** True if it's fine to leave: nothing unsaved, or the user agreed to discard it. */
export function confirmLeave(): boolean {
  if (!unsaved.dirty) return true
  if (!confirm(LEAVE_MESSAGE)) return false
  unsaved.dirty = false
  return true
}

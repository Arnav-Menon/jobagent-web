import type { SetupStatus } from '../api'

export type StepProps = {
  setup: SetupStatus
  /** Call after a successful save: shows `message` as a toast (if any), refreshes progress, moves on. */
  onDone: (message: string) => void
  /** Tell the stepper whether there are unsaved edits. */
  setDirty: (dirty: boolean) => void
}

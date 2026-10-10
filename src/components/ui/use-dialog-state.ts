"use client";

import { useState } from "react";

import type { FormState } from "@/lib/actions/state";

/**
 * Open/close state for a dialog that should close itself once its server
 * action succeeds.
 *
 * The close is decided during render by comparing against the last state object
 * seen, which is React's "adjusting state when a prop changes" pattern. Doing
 * it in a `useEffect` instead would schedule a second render pass for every
 * submit, and is what the `react-hooks/set-state-in-effect` rule warns about.
 *
 * `useActionState` returns a fresh object per dispatch, so identity comparison
 * also catches two successful submits in a row.
 */
export function useDialogState(state: FormState) {
  const [open, setOpen] = useState(false);
  const [seenState, setSeenState] = useState(state);

  if (state !== seenState) {
    setSeenState(state);
    if (state.status === "success") {
      setOpen(false);
    }
  }

  return [open, setOpen] as const;
}

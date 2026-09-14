/**
 * Pure state machine for WorkScheduleContext.
 *
 * - Load responses carry a sequence number; stale ones are dropped.
 * - Saves are optimistic: the patch shows immediately, a snapshot is kept,
 *   and a failure rolls back. While a save is in flight, background refreshes
 *   never overwrite the optimistic edit (same idea as AppContext's
 *   availabilityUpdateInFlight guard).
 * - A failed refresh keeps the last good schedule on screen.
 */

export const initialWorkScheduleState = {
  view: null,
  loading: false,
  error: null,
  loadedAt: 0,
  latestSeq: 0,
  saving: null, // day key, 'batch' or 'reset' while a write is in flight
  snapshot: null,
};

function applyPatch(view, patch) {
  if (!view || !view.workSchedule) return view;
  return {
    ...view,
    workSchedule: {
      ...view.workSchedule,
      source: 'custom',
      days: { ...view.workSchedule.days, ...patch },
    },
  };
}

export function workScheduleReducer(state, action) {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, latestSeq: action.seq };
    case 'LOAD_SUCCESS':
      if (action.seq !== state.latestSeq) return state;
      if (state.saving) return { ...state, loading: false };
      return { ...state, loading: false, error: null, view: action.view, loadedAt: Date.now() };
    case 'LOAD_FAILURE':
      if (action.seq !== state.latestSeq) return state;
      return { ...state, loading: false, error: action.error };
    case 'SAVE_START':
      return {
        ...state,
        saving: action.key,
        snapshot: state.view,
        view: action.patch ? applyPatch(state.view, action.patch) : state.view,
      };
    case 'SAVE_SUCCESS':
      return { ...state, saving: null, snapshot: null, error: null, view: action.view, loadedAt: Date.now() };
    case 'SAVE_FAILURE':
      return { ...state, saving: null, view: state.snapshot, snapshot: null };
    case 'CLEAR':
      return initialWorkScheduleState;
    default:
      return state;
  }
}

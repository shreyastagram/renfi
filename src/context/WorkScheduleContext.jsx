/**
 * WorkScheduleContext — the provider's weekly working hours.
 *
 * Deliberately separate from AppContext: schedule loads/edits must not
 * re-render AppContext's ~38 consumers. Mounted only for providers (see
 * RootNavigator). Callbacks are stable (state read via ref) so the memoized
 * value changes only when the schedule state itself changes.
 *
 * Usage: const { days, view, loading, error, saving, refresh, saveDays, resetToDefault } = useWorkSchedule();
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { AppState } from 'react-native';
import { useApp } from './AppContext';
import { initialWorkScheduleState, workScheduleReducer } from './workScheduleReducer';
import { getWorkSchedule, updateWorkSchedule, resetWorkSchedule } from '../services/workScheduleService';

const REFRESH_MIN_INTERVAL_MS = 60 * 1000;

const WorkScheduleContext = createContext(null);

export function WorkScheduleProvider({ children }) {
  const { user, profile } = useApp();
  const providerId = user?.mongoId || profile?.mongoId || user?._id || profile?._id || null;

  const [state, dispatch] = useReducer(workScheduleReducer, initialWorkScheduleState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const providerIdRef = useRef(providerId);
  providerIdRef.current = providerId;
  const seqRef = useRef(0);

  const refresh = useCallback(async ({ force = false } = {}) => {
    const id = providerIdRef.current;
    const s = stateRef.current;
    if (!id) return;
    if (!force && (s.loading || Date.now() - s.loadedAt < REFRESH_MIN_INTERVAL_MS)) return;
    const seq = ++seqRef.current;
    dispatch({ type: 'LOAD_START', seq });
    const result = await getWorkSchedule(id);
    if (providerIdRef.current !== id) return; // logged out / switched meanwhile
    dispatch(result.success
      ? { type: 'LOAD_SUCCESS', seq, view: result.data }
      : { type: 'LOAD_FAILURE', seq, error: result.error });
  }, []);

  /** @param {Object} patch { mon: { enabled, start, end }, … } @param {string} key saving indicator */
  const saveDays = useCallback(async (patch, key = 'batch') => {
    const id = providerIdRef.current;
    if (!id || stateRef.current.saving) return { success: false, error: { code: 'BUSY' } };
    dispatch({ type: 'SAVE_START', key, patch });
    const result = await updateWorkSchedule(id, patch);
    dispatch(result.success ? { type: 'SAVE_SUCCESS', view: result.data } : { type: 'SAVE_FAILURE' });
    return result;
  }, []);

  const resetToDefault = useCallback(async () => {
    const id = providerIdRef.current;
    if (!id || stateRef.current.saving) return { success: false, error: { code: 'BUSY' } };
    dispatch({ type: 'SAVE_START', key: 'reset' });
    const result = await resetWorkSchedule(id);
    dispatch(result.success ? { type: 'SAVE_SUCCESS', view: result.data } : { type: 'SAVE_FAILURE' });
    return result;
  }, []);

  // Initial load / logout
  useEffect(() => {
    if (providerId) refresh({ force: true });
    else dispatch({ type: 'CLEAR' });
  }, [providerId, refresh]);

  // Returning to the app: pick up edits an admin made meanwhile (throttled).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const value = useMemo(() => ({
    view: state.view,
    days: state.view?.workSchedule?.days || null,
    loading: state.loading,
    error: state.error,
    saving: state.saving,
    refresh,
    saveDays,
    resetToDefault,
  }), [state.view, state.loading, state.error, state.saving, refresh, saveDays, resetToDefault]);

  return <WorkScheduleContext.Provider value={value}>{children}</WorkScheduleContext.Provider>;
}

export function useWorkSchedule() {
  const ctx = useContext(WorkScheduleContext);
  if (!ctx) throw new Error('useWorkSchedule must be used inside WorkScheduleProvider');
  return ctx;
}

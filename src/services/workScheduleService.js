/**
 * Work Schedule Service
 *
 * Provider weekly working hours (Node backend owns defaults and validation).
 * Every call resolves to { success: true, data: view } or
 * { success: false, error: parseApiError(...) } — never throws.
 *
 * view = {
 *   providerId, workSchedule: { days: { mon: { enabled, start: 'HH:mm', end }, … }, source, updatedAt, updatedBy },
 *   defaultSchedule: { days, templateVersion }, scheduleEnforced, nightWindow: { start, end },
 *   isAvailable, emergencyServicesEnabled, lastActiveAt, lastLocationAt, now: { dayKey, time, status, available }
 * }
 */

import apiClient, { parseApiError } from './apiClient';
import { ENDPOINTS } from '../config/api';

const path = (providerId) => `${ENDPOINTS.PROFILE.PROVIDER_WORK_SCHEDULE}/${providerId}/work-schedule`;

const missingId = () => ({
  success: false,
  error: { message: 'Provider ID is required', code: 'MISSING_PROVIDER_ID' },
});

async function call(label, request) {
  try {
    const response = await request();
    return { success: true, data: response.data?.data };
  } catch (error) {
    console.error(`❌ [WorkScheduleService] ${label} failed:`, error.message);
    return { success: false, error: parseApiError(error) };
  }
}

export const getWorkSchedule = (providerId) => {
  if (!providerId) return Promise.resolve(missingId());
  return call('get', () => apiClient.get(path(providerId)));
};

/** @param {Object} days only the days that changed, e.g. { mon: { enabled, start, end } } */
export const updateWorkSchedule = (providerId, days) => {
  if (!providerId) return Promise.resolve(missingId());
  return call('update', () => apiClient.patch(path(providerId), { days }));
};

export const resetWorkSchedule = (providerId) => {
  if (!providerId) return Promise.resolve(missingId());
  return call('reset', () => apiClient.post(`${path(providerId)}/reset`));
};

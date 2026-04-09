/**
 * Referral Service
 *
 * API calls for the Refer & Earn system.
 * Uses authFetch for authenticated endpoints, plain fetch for public ones.
 *
 * @version 1.0.0
 */

import { NODE_BASE_URL } from '../config/api';
import { authFetch } from '../utils/authFetch';

const BASE = `${NODE_BASE_URL}/api/referral`;

/**
 * Get or generate the current user's referral code.
 */
export const getMyReferralCode = async () => {
  try {
    const res = await authFetch(`${BASE}/my-code`);
    return await res.json();
  } catch (err) {
    console.error('[ReferralService] getMyReferralCode error:', err.message);
    return { success: false };
  }
};

/**
 * Validate a referral code (public — used during registration).
 */
export const validateReferralCode = async (code) => {
  try {
    const res = await fetch(`${BASE}/validate-code/${encodeURIComponent(code)}`);
    return await res.json();
  } catch (err) {
    console.error('[ReferralService] validateReferralCode error:', err.message);
    return { success: false, valid: false };
  }
};

/**
 * Get user's stats: cycle points, rank, yearly points, referral count.
 */
export const getMyStats = async () => {
  try {
    const res = await authFetch(`${BASE}/my-stats`);
    return await res.json();
  } catch (err) {
    console.error('[ReferralService] getMyStats error:', err.message);
    return { success: false };
  }
};

/**
 * Get point transaction history (paginated).
 */
export const getMyHistory = async (page = 1, limit = 20) => {
  try {
    const res = await authFetch(`${BASE}/my-history?page=${page}&limit=${limit}`);
    return await res.json();
  } catch (err) {
    console.error('[ReferralService] getMyHistory error:', err.message);
    return { success: false, history: [] };
  }
};

/**
 * Get list of people referred by this user.
 */
export const getMyReferrals = async () => {
  try {
    const res = await authFetch(`${BASE}/my-referrals`);
    return await res.json();
  } catch (err) {
    console.error('[ReferralService] getMyReferrals error:', err.message);
    return { success: false, referrals: [] };
  }
};

/**
 * Get current cycle leaderboard (user or provider based on caller's role).
 */
export const getCycleLeaderboard = async () => {
  try {
    const res = await authFetch(`${BASE}/leaderboard/cycle`);
    return await res.json();
  } catch (err) {
    console.error('[ReferralService] getCycleLeaderboard error:', err.message);
    return { success: false, leaderboard: [] };
  }
};

/**
 * Get yearly competition leaderboard.
 */
export const getYearlyLeaderboard = async () => {
  try {
    const res = await authFetch(`${BASE}/leaderboard/yearly`);
    return await res.json();
  } catch (err) {
    console.error('[ReferralService] getYearlyLeaderboard error:', err.message);
    return { success: false, leaderboard: [] };
  }
};

/**
 * Get current cycle info (dates, days remaining, progress).
 */
export const getCycleInfo = async () => {
  try {
    const res = await authFetch(`${BASE}/cycle-info`);
    return await res.json();
  } catch (err) {
    console.error('[ReferralService] getCycleInfo error:', err.message);
    return { success: false };
  }
};

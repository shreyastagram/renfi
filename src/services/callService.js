/**
 * High-level call service — demo branch only.
 *
 * Wraps iacaxClient with the four call-lifecycle operations the screens
 * need. Returns plain objects (or throws an error with .parsed already
 * attached by the iacaxClient response interceptor) so screens never
 * touch axios directly.
 *
 * Iacax response shape on a successful Initiate / Accept:
 *   { callId, roomName, token, livekitUrl, status }
 *
 * Caller identity comes from the JWT (sub claim, set by jauth at login).
 * Callee identity is supplied by the renfi caller as a freely-chosen
 * mongoId — iacax stores it for analytics and forwards it to noefix
 * which looks it up against User._id then Provider._id.
 */

import iacaxClient from './iacaxClient';

/**
 * Start an outgoing call.
 *
 * @param {Object} args
 * @param {string} args.calleeId    — mongoId of the user being called
 * @param {string} [args.calleeName] — display name (optional)
 * @param {string} [args.calleeType] — 'user' | 'provider' (optional analytics tag)
 * @param {string} [args.callerName] — display name shown to the callee
 *   (fallback when JWT name claim is empty); usually the caller's full name
 * @returns {Promise<{callId, roomName, token, livekitUrl, status}>}
 */
export async function initiateCall({ calleeId, calleeName, calleeType, callerName }) {
  if (!calleeId) {
    const err = new Error('calleeId is required');
    err.parsed = { code: 'INVALID', message: 'Cannot start call: recipient is missing.' };
    throw err;
  }
  const body = { calleeId };
  if (calleeName) body.calleeName = calleeName;
  if (calleeType) body.calleeType = calleeType;
  if (callerName) body.callerName = callerName;

  const res = await iacaxClient.post('/api/v1/calls', body);
  return res.data;
}

/**
 * Accept an incoming call. Returns a fresh LiveKit token for the callee.
 */
export async function acceptCall(callId) {
  const res = await iacaxClient.post(`/api/v1/calls/${encodeURIComponent(callId)}/accept`);
  return res.data;
}

/**
 * Decline an incoming call before connect.
 *
 * @param {string} callId
 * @param {string} [reason] — optional free-form reason, e.g. "busy".
 *   Stored on the CDR's EndReason field for analytics.
 */
export async function rejectCall(callId, reason) {
  const body = reason ? { reason } : {};
  await iacaxClient.post(`/api/v1/calls/${encodeURIComponent(callId)}/reject`, body);
}

/**
 * Hang up. Status-aware on the server: connected→completed,
 * initiated/ringing→cancelled.
 */
export async function endCall(callId) {
  await iacaxClient.post(`/api/v1/calls/${encodeURIComponent(callId)}/end`);
}

/**
 * Look up a call's current state (for reconnection / debugging).
 */
export async function getCall(callId) {
  const res = await iacaxClient.get(`/api/v1/calls/${encodeURIComponent(callId)}`);
  return res.data;
}

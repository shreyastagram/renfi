/**
 * IACAX (in-app calling service) configuration — demo branch only.
 *
 * The calling backend lives at https://iacax.onrender.com and is fronted
 * by Render free tier. All demo credentials are hard-coded here because
 * the demo APK ships them anyway — these are throwaway and will be
 * rotated before any production release of the calling feature.
 */

// Public iacax base URL. HTTPS-only.
export const IACAX_URL = 'https://iacax.onrender.com';

// LiveKit websocket URL — iacax echoes this back on every call response,
// but we keep it here as a fallback for local dev / debug.
export const LIVEKIT_WS_URL = 'wss://iacax-demo-ng6squ7f.livekit.cloud';

// Demo tenant API key — identifies the renfi app to iacax. Required on
// every request as the X-API-Key header. Throwaway demo value.
export const IACAX_API_KEY = 'axs_live_16338b684257ea041d0e35b5b896d2d2';

// LiveKit ConnectionService account label shown in Android's "Calling
// Accounts" settings. Branded for the demo.
export const CALLKEEP_LABEL = 'Fixhomi';

// Ring timeout — must match iacax's RingTimeoutThreshold (60s) so the
// caller sees the same auto-cancel deadline as the server.
export const CALL_RING_TIMEOUT_MS = 60_000;

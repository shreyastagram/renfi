/**
 * Environment Configuration
 * 
 * Centralized environment switching for development and testing
 * 
 * USAGE:
 * - Set USE_PRODUCTION_NODE_API = true  → Uses Railway hosted Node.js backend
 * - Set USE_PRODUCTION_NODE_API = false → Uses local Node.js server
 * - Set USE_PRODUCTION_JAVA_AUTH = true  → Uses Render hosted Java Auth
 * - Set USE_PRODUCTION_JAVA_AUTH = false → Uses local Java Auth server
 * 
 * This is useful for:
 * - Testing Razorpay payments (requires public URL for Node)
 * - Testing webhooks (requires public URL)
 * - Local debugging and development
 * - Mixed environments (e.g., production Node + local Java)
 * 
 * @version 2.0.0
 */

// ============================================
// ENVIRONMENT TOGGLES (Separate for each service)
// ============================================

/**
 * Toggle for Node.js Backend (fixhomi-backend)
 *
 * true  = Use production backend (Render)
 * false = Use local development server
 */
export const USE_PRODUCTION_NODE_API = true;

/**
 * Toggle for Java Auth Service (jarbac)
 *
 * true  = Use production auth (Render)
 * false = Use local Java Auth server
 */
export const USE_PRODUCTION_JAVA_AUTH = true;

// ============================================
// ⚠️ TEMPORARY DEV / STAGING TESTING — DO NOT COMMIT AS true ⚠️
// ============================================
// When true, the app talks to the ISOLATED dev Render services
// (jauth-dev / noefix-dev), which use a dev Postgres + dev Mongo — NOT prod.
// Use ONLY for testing the phone-signup flow on a device.
// MUST be set back to false before committing or releasing.
export const USE_DEV_STAGING = false;

const DEV_STAGING_CONFIG = {
  NODE_API_URL: 'https://noefix-dev.onrender.com',
  JAVA_AUTH_URL: 'https://jauth-dev.onrender.com',
};

const REAL_PROD_CONFIG = {
  NODE_API_URL: 'https://api.fixhomi.com',
  JAVA_AUTH_URL: 'https://auth.fixhomi.com',
};

// ============================================
// PRODUCTION URLS
// ============================================

export const PRODUCTION_CONFIG = {
  // Node.js Backend (Cloudflare → Render). Redirected to dev when USE_DEV_STAGING.
  NODE_API_URL: USE_DEV_STAGING ? DEV_STAGING_CONFIG.NODE_API_URL : REAL_PROD_CONFIG.NODE_API_URL,

  // Java Auth Service (Cloudflare → Render). Redirected to dev when USE_DEV_STAGING.
  JAVA_AUTH_URL: USE_DEV_STAGING ? DEV_STAGING_CONFIG.JAVA_AUTH_URL : REAL_PROD_CONFIG.JAVA_AUTH_URL,

  // Razorpay key — set via RAZORPAY_KEY_ID env var at build time
  // NEVER commit live or test keys here
  RAZORPAY_KEY_ID: '',
};

// ============================================
// LOCAL DEVELOPMENT
// ============================================
// Local hosts/ports live in api.js (LOCAL_MACHINE_IP + __DEV__-only branches),
// which Metro dead-code-eliminates from release bundles. Nothing local is
// exported from here — exported literals survive minification.

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the current environment name (shows both services)
 */
export const getEnvironmentName = () => {
  const nodeEnv = USE_PRODUCTION_NODE_API ? 'Production' : 'Local';
  const javaEnv = USE_PRODUCTION_JAVA_AUTH ? 'Production' : 'Local';
  return `Node: ${nodeEnv} | Java: ${javaEnv}`;
};

/**
 * Check if using production Node API
 */
export const isNodeProduction = () => USE_PRODUCTION_NODE_API;

/**
 * Check if using production Java Auth
 */
export const isJavaProduction = () => USE_PRODUCTION_JAVA_AUTH;

/**
 * Get Razorpay Key ID (same for both environments in test mode)
 */
export const getRazorpayKeyId = () => {
  return PRODUCTION_CONFIG.RAZORPAY_KEY_ID;
};

// Log current environment on import
console.log('🌍 [Environment] Current Mode:', getEnvironmentName());
console.log('🔗 [Environment] Node API:', USE_PRODUCTION_NODE_API ? 'PRODUCTION' : 'LOCAL');
console.log('🔗 [Environment] Java Auth:', USE_PRODUCTION_JAVA_AUTH ? 'PRODUCTION' : 'LOCAL');
if (USE_DEV_STAGING) {
  console.warn('🚧🚧🚧 [Environment] USE_DEV_STAGING=true → app is hitting DEV Render (jauth-dev/noefix-dev), NOT prod. Revert to false before release. 🚧🚧🚧');
}

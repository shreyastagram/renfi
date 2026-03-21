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
 * true  = Use Railway hosted backend (for Razorpay, webhooks, etc.)
 * false = Use local development server
 */
export const USE_PRODUCTION_NODE_API = true;

/**
 * Toggle for Java Auth Service (jarbac)
 * 
 * true  = Use Render hosted Java Auth
 * false = Use local Java Auth server
 */
export const USE_PRODUCTION_JAVA_AUTH = true;

// ============================================
// PRODUCTION URLS
// ============================================

export const PRODUCTION_CONFIG = {
  // Node.js Backend (Render - Dev)
  NODE_API_URL: 'https://noefix-dev.onrender.com',

  // Java Auth Service (Render - Dev)
  JAVA_AUTH_URL: 'https://jauth-dev.onrender.com',
  
  // Razorpay key — set via RAZORPAY_KEY_ID env var at build time
  // NEVER commit live or test keys here
  RAZORPAY_KEY_ID: '',
};

// ============================================
// LOCAL DEVELOPMENT URLS
// ============================================

export const LOCAL_CONFIG = {
  // These will be dynamically set by api.js based on device type
  // Keeping them here for reference
  EMULATOR_HOST: '10.0.2.2',
  LOCALHOST: 'localhost',
  WIFI_IP: '192.168.1.17', // Update this to your machine's IP
  
  NODE_PORT: 5001,
  JAVA_PORT: 8080,
  
  // Razorpay key — set via RAZORPAY_KEY_ID env var at build time
  RAZORPAY_KEY_ID: '',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the current environment name (shows both services)
 */
export const getEnvironmentName = () => {
  const nodeEnv = USE_PRODUCTION_NODE_API ? 'Railway' : 'Local';
  const javaEnv = USE_PRODUCTION_JAVA_AUTH ? 'Render' : 'Local';
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
console.log('🔗 [Environment] Node API:', USE_PRODUCTION_NODE_API ? 'PRODUCTION (Railway)' : 'LOCAL');
console.log('🔗 [Environment] Java Auth:', USE_PRODUCTION_JAVA_AUTH ? 'PRODUCTION (Render)' : 'LOCAL');

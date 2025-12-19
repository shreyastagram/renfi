/**
 * API Configuration for FixHomi/Renfi Application
 * 
 * This file configures two separate backend services:
 * 1. JARBAC (Java Auth) - Handles all authentication (login, register, tokens, OAuth)
 * 2. Node.js Backend - Handles business logic (services, providers, requests)
 * 
 * @version 2.0.0
 * @updated 2024-12-19
 */

import { Platform } from 'react-native';

// ============================================================================
// JARBAC - Java Authentication Service (Port 8080)
// Handles: Login, Register, Token Refresh, OAuth, OTP, Password Reset
// ============================================================================

const JARBAC_AUTH_URL = __DEV__
  ? Platform.select({
      ios: 'http://localhost:8080',
      android: 'http://10.0.2.2:8080',
      default: 'http://localhost:8080',
    })
  : 'https://auth.fixhomi.com'; // Production URL

// ============================================================================
// Node.js Backend Service (Port 5050)
// Handles: Service Requests, Provider Management, User Profiles, History
// ============================================================================

const NODEJS_BASE_URL = __DEV__
  ? Platform.select({
      ios: 'http://localhost:5050',
      android: 'http://10.0.2.2:5050',
      default: 'http://localhost:5050',
    })
  : 'https://api.fixhomi.com'; // Production URL

// For physical device testing, set your computer's IP here
const PHYSICAL_DEVICE_IP = '192.168.1.100';
const USE_PHYSICAL_DEVICE = false; // Set to true when testing on physical device

// Override URLs for physical device testing
const AUTH_BASE_URL = USE_PHYSICAL_DEVICE 
  ? `http://${PHYSICAL_DEVICE_IP}:8080` 
  : JARBAC_AUTH_URL;

const BASE_URL = USE_PHYSICAL_DEVICE 
  ? `http://${PHYSICAL_DEVICE_IP}:5050` 
  : NODEJS_BASE_URL;

// ============================================================================
// API Configuration Export
// ============================================================================

export const API_CONFIG = {
  // Base URLs
  AUTH_BASE_URL,  // JARBAC Java Auth Service
  BASE_URL,       // Node.js Business Logic Service
  
  // ========================================================================
  // JARBAC Authentication Endpoints (Java - Port 8080)
  // All authentication is now handled by JARBAC
  // ========================================================================
  JARBAC_AUTH: {
    // Core Authentication
    LOGIN: `${AUTH_BASE_URL}/api/auth/login`,
    REGISTER: `${AUTH_BASE_URL}/api/auth/register`,
    LOGOUT: `${AUTH_BASE_URL}/api/auth/logout`,
    REFRESH: `${AUTH_BASE_URL}/api/auth/refresh`,
    HEALTH: `${AUTH_BASE_URL}/api/auth/health`,
    
    // OAuth2 (Google Sign-In)
    GOOGLE_MOBILE: `${AUTH_BASE_URL}/api/auth/oauth2/google/mobile`,
    
    // Phone OTP Verification
    OTP_SEND: `${AUTH_BASE_URL}/api/auth/otp/send`,
    OTP_VERIFY: `${AUTH_BASE_URL}/api/auth/otp/verify`,
    
    // Email Verification
    EMAIL_SEND: `${AUTH_BASE_URL}/api/auth/email/send-verification`,
    EMAIL_VERIFY: `${AUTH_BASE_URL}/api/auth/email/verify`,
    
    // Password Reset
    FORGOT_PASSWORD: `${AUTH_BASE_URL}/api/auth/forgot-password`,
    RESET_PASSWORD: `${AUTH_BASE_URL}/api/auth/reset-password`,
    
    // Token Validation
    TOKEN_VALIDATE: `${AUTH_BASE_URL}/api/token/validate`,
    TOKEN_ME: `${AUTH_BASE_URL}/api/token/me`,
    
    // User Profile (via JARBAC)
    USER_ME: `${AUTH_BASE_URL}/api/users/me`,
    CHANGE_PASSWORD: `${AUTH_BASE_URL}/api/users/change-password`,
  },
  
  // ========================================================================
  // Node.js Backend Endpoints (Port 5050)
  // Business logic - services, providers, requests
  // ========================================================================
  
  // User Business Logic (NOT authentication)
  USER: {
    PROFILE: (userId) => `${BASE_URL}/api/user/profile/${userId}`,
    SERVICE_HISTORY: (userId) => `${BASE_URL}/api/user/service-history/${userId}`,
    UPDATE_PROFILE: (userId) => `${BASE_URL}/api/user/profile/${userId}`,
  },
  
  // Provider Business Logic (NOT authentication)
  PROVIDER: {
    PROFILE: (providerId) => `${BASE_URL}/api/provider/profile/${providerId}`,
    UPDATE_PROFILE: (providerId) => `${BASE_URL}/api/provider/profile/${providerId}`,
    ACCEPTED_REQUESTS: (providerId) => `${BASE_URL}/api/provider/accepted-requests/${providerId}`,
    COMPLETE_REQUEST: `${BASE_URL}/api/provider/complete-request`,
    SERVICES: (providerId) => `${BASE_URL}/api/provider/services/${providerId}`,
    AVAILABILITY: (providerId) => `${BASE_URL}/api/provider/availability/${providerId}`,
  },
  
  // Service Request Endpoints
  SERVICES: {
    LIST: `${BASE_URL}/api/services`,
    REQUEST: `${BASE_URL}/api/services/request`,
    CANCEL: `${BASE_URL}/api/services/cancel`,
    STATUS: (requestId) => `${BASE_URL}/api/services/status/${requestId}`,
  },
  
  // ========================================================================
  // Common Headers
  // ========================================================================
  HEADERS: {
    JSON: {
      'Content-Type': 'application/json',
    },
    AUTH: (token) => ({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }),
    // For multipart form data (file uploads)
    MULTIPART: (token) => ({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    }),
  },
  
  // ========================================================================
  // User Roles (from JARBAC)
  // ========================================================================
  ROLES: {
    USER: 'USER',                    // Regular customer/homeowner
    SERVICE_PROVIDER: 'SERVICE_PROVIDER', // Service provider
    ADMIN: 'ADMIN',                  // Admin (not for mobile)
  },
  
  // ========================================================================
  // Legacy Endpoints (Deprecated - Will be removed)
  // These are kept for backward compatibility during migration
  // DO NOT USE FOR NEW CODE
  // ========================================================================
  /** @deprecated Use JARBAC_AUTH.LOGIN instead */
  AUTH: {
    USER_LOGIN: `${BASE_URL}/auth/login`,           // DEPRECATED
    USER_REGISTER: `${BASE_URL}/auth/register`,     // DEPRECATED
    PROVIDER_LOGIN: `${BASE_URL}/auth/provider/login`,     // DEPRECATED
    PROVIDER_REGISTER: `${BASE_URL}/auth/provider/register`, // DEPRECATED
    PROVIDER_PROFILE: `${BASE_URL}/auth/provider/profile`,   // DEPRECATED
  },
};

// ============================================================================
// Development Logging
// ============================================================================
if (__DEV__) {
  console.log('🔐 JARBAC Auth URL:', AUTH_BASE_URL);
  console.log('🌐 Node.js API URL:', BASE_URL);
  console.log('📱 Platform:', Platform.OS);
  console.log('🔧 Physical Device Mode:', USE_PHYSICAL_DEVICE ? 'ON' : 'OFF');
}
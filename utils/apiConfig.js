/**
 * API Configuration
 * 
 * Centralized configuration for all API endpoints
 * 
 * @version 1.0.0
 */

// Base URLs for different environments
const ENVIRONMENTS = {
  development: {
    // Node.js Backend (handles user registration, business logic)
    BASE_URL: 'http://localhost:5000',
    // Java Auth Service (handles authentication)
    AUTH_BASE_URL: 'http://localhost:8080',
  },
  production: {
    BASE_URL: 'https://api.fixhomi.com',
    AUTH_BASE_URL: 'https://auth.fixhomi.com',
  },
};

// Current environment - change this for different deployments
const CURRENT_ENV = 'development';

export const API_CONFIG = {
  // Node.js Backend URL (for user registration, business logic)
  BASE_URL: ENVIRONMENTS[CURRENT_ENV].BASE_URL,
  // Java Auth Service URL (for authentication tokens)
  AUTH_BASE_URL: ENVIRONMENTS[CURRENT_ENV].AUTH_BASE_URL,
  // Request timeout in milliseconds
  TIMEOUT: 30000,
};

// API Endpoints for Node.js Backend
export const ENDPOINTS = {
  // User Auth (via Node.js -> Java Auth)
  USER_REGISTER: '/api/auth/register',
  USER_LOGIN: '/api/auth/login',
  
  // Provider Auth (via Node.js -> Java Auth)
  PROVIDER_REGISTER: '/api/provider/auth/register',
  PROVIDER_LOGIN: '/api/provider/auth/login',
  
  // Token Management
  REFRESH_TOKEN: '/api/auth/refresh',
  LOGOUT: '/api/auth/logout',
  
  // User Profile
  USER_PROFILE: '/api/users/profile',
  UPDATE_LOCATION: '/api/users/location',
  
  // Provider endpoints
  PROVIDER_PROFILE: '/api/provider/profile',
  
  // Health check
  HEALTH: '/api/health',
};

// Error codes from backend
export const ERROR_CODES = {
  // Registration errors
  MISSING_REQUIRED_FIELDS: 'MISSING_REQUIRED_FIELDS',
  INVALID_EMAIL_FORMAT: 'INVALID_EMAIL_FORMAT',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  PASSWORD_TOO_LONG: 'PASSWORD_TOO_LONG',
  INVALID_FULL_NAME: 'INVALID_FULL_NAME',
  FULL_NAME_TOO_LONG: 'FULL_NAME_TOO_LONG',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  PHONE_ALREADY_EXISTS: 'PHONE_ALREADY_EXISTS',
  AUTH_SERVICE_UNAVAILABLE: 'AUTH_SERVICE_UNAVAILABLE',
  AUTH_SERVICE_ERROR: 'AUTH_SERVICE_ERROR',
  MONGODB_SYNC_FAILED: 'MONGODB_SYNC_FAILED',
  REGISTRATION_SUCCESS: 'REGISTRATION_SUCCESS',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  
  // Login errors
  MISSING_CREDENTIALS: 'MISSING_CREDENTIALS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  DATABASE_ERROR: 'DATABASE_ERROR',
  
  // General errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
};

// User-friendly error messages
export const ERROR_MESSAGES = {
  [ERROR_CODES.MISSING_REQUIRED_FIELDS]: 'Please fill in all required fields',
  [ERROR_CODES.INVALID_EMAIL_FORMAT]: 'Please enter a valid email address',
  [ERROR_CODES.WEAK_PASSWORD]: 'Password must be at least 8 characters',
  [ERROR_CODES.EMAIL_ALREADY_EXISTS]: 'An account with this email already exists. Try logging in instead.',
  [ERROR_CODES.PHONE_ALREADY_EXISTS]: 'This phone number is already registered',
  [ERROR_CODES.AUTH_SERVICE_UNAVAILABLE]: 'Service temporarily unavailable. Please try again later.',
  [ERROR_CODES.INVALID_CREDENTIALS]: 'Invalid email or password',
  [ERROR_CODES.USER_NOT_FOUND]: 'No account found with this email',
  [ERROR_CODES.INTERNAL_SERVER_ERROR]: 'Something went wrong. Please try again.',
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
};

export default API_CONFIG;

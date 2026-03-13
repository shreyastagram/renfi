/**
 * Validation Utility
 * 
 * Client-side validation functions for forms
 * Mirrors backend validation rules for consistency
 * 
 * @version 1.0.0
 */

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {Object} Validation result
 */
export const validateEmail = (email) => {
  if (!email || email.trim() === '') {
    return { isValid: false, error: 'Email is required' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }
  
  return { isValid: true, error: null };
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result
 */
export const validatePassword = (password) => {
  if (!password || password === '') {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters' };
  }

  if (password.length > 100) {
    return { isValid: false, error: 'Password must not exceed 100 characters' };
  }

  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one uppercase letter' };
  }

  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one lowercase letter' };
  }

  if (!/\d/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one number' };
  }

  if (!/[@$!%*?&#^()_+\-=]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one special character' };
  }

  return { isValid: true, error: null };
};

/**
 * Validate full name
 * @param {string} fullName - Full name to validate
 * @returns {Object} Validation result
 */
export const validateFullName = (fullName) => {
  if (!fullName || fullName.trim() === '') {
    return { isValid: false, error: 'Full name is required' };
  }
  
  if (fullName.trim().length < 2) {
    return { isValid: false, error: 'Name must be at least 2 characters' };
  }
  
  if (fullName.trim().length > 100) {
    return { isValid: false, error: 'Name must not exceed 100 characters' };
  }
  
  return { isValid: true, error: null };
};

/**
 * Validate phone number (optional field)
 * Expects raw 10-digit Indian number (no country code)
 * @param {string} phone - Phone number to validate
 * @returns {Object} Validation result
 */
export const validatePhone = (phone) => {
  if (!phone || phone.trim() === '') {
    return { isValid: true, error: null }; // Optional field
  }

  const digits = phone.trim().replace(/[^0-9]/g, '');
  if (digits.length !== 10) {
    return { isValid: false, error: 'Please enter a valid 10-digit phone number' };
  }

  // Indian mobile numbers start with 6-9
  if (!/^[6-9]/.test(digits)) {
    return { isValid: false, error: 'Please enter a valid Indian mobile number' };
  }

  return { isValid: true, error: null };
};

/**
 * Validate address (required for providers)
 * @param {string} address - Address to validate
 * @returns {Object} Validation result
 */
export const validateAddress = (address) => {
  if (!address || address.trim() === '') {
    return { isValid: false, error: 'Address is required' };
  }
  
  if (address.trim().length < 5) {
    return { isValid: false, error: 'Address must be at least 5 characters' };
  }
  
  return { isValid: true, error: null };
};

/**
 * Validate provider/business name
 * @param {string} name - Provider name to validate
 * @returns {Object} Validation result
 */
export const validateProviderName = (name) => {
  if (!name || name.trim() === '') {
    return { isValid: false, error: 'Business name is required' };
  }
  
  if (name.trim().length < 2) {
    return { isValid: false, error: 'Name must be at least 2 characters' };
  }
  
  if (name.trim().length > 100) {
    return { isValid: false, error: 'Name must not exceed 100 characters' };
  }
  
  return { isValid: true, error: null };
};

/**
 * Validate registration form
 * @param {Object} formData - Form data object
 * @returns {Object} Validation result with errors
 */
export const validateRegistrationForm = (formData) => {
  const errors = {};
  let isValid = true;
  
  // Email validation
  const emailResult = validateEmail(formData.email);
  if (!emailResult.isValid) {
    errors.email = emailResult.error;
    isValid = false;
  }
  
  // Password validation
  const passwordResult = validatePassword(formData.password);
  if (!passwordResult.isValid) {
    errors.password = passwordResult.error;
    isValid = false;
  }
  
  // Full name validation
  const nameResult = validateFullName(formData.fullName);
  if (!nameResult.isValid) {
    errors.fullName = nameResult.error;
    isValid = false;
  }
  
  // Phone validation (optional)
  const phoneResult = validatePhone(formData.phone);
  if (!phoneResult.isValid) {
    errors.phone = phoneResult.error;
    isValid = false;
  }
  
  return { isValid, errors };
};

/**
 * Validate provider registration form
 * @param {Object} formData - Form data object
 * @returns {Object} Validation result with errors
 */
export const validateProviderRegistrationForm = (formData) => {
  const errors = {};
  let isValid = true;
  
  // Email validation
  const emailResult = validateEmail(formData.email);
  if (!emailResult.isValid) {
    errors.email = emailResult.error;
    isValid = false;
  }
  
  // Password validation
  const passwordResult = validatePassword(formData.password);
  if (!passwordResult.isValid) {
    errors.password = passwordResult.error;
    isValid = false;
  }
  
  // Provider name validation
  const nameResult = validateProviderName(formData.name);
  if (!nameResult.isValid) {
    errors.name = nameResult.error;
    isValid = false;
  }
  
  // Address validation (required for providers)
  const addressResult = validateAddress(formData.address);
  if (!addressResult.isValid) {
    errors.address = addressResult.error;
    isValid = false;
  }
  
  // Phone validation (optional)
  const phoneResult = validatePhone(formData.phone);
  if (!phoneResult.isValid) {
    errors.phone = phoneResult.error;
    isValid = false;
  }
  
  return { isValid, errors };
};

export default {
  validateEmail,
  validatePassword,
  validateFullName,
  validatePhone,
  validateAddress,
  validateProviderName,
  validateRegistrationForm,
  validateProviderRegistrationForm,
};

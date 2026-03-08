/**
 * Subscription Service
 * 
 * Handles all subscription-related API calls and Razorpay checkout integration.
 * 
 * FLOW:
 * 1. getSubscriptionStatus() - Check if provider is premium
 * 2. getPlans() - Get available subscription plans
 * 3. createOrder() - Create Razorpay order
 * 4. openRazorpayCheckout() - Open Razorpay payment modal
 * 5. verifyPayment() - Verify payment on server
 * 
 * ENVIRONMENT:
 * - Uses Railway hosted backend when USE_PRODUCTION_API = true
 * - Uses local development server when USE_PRODUCTION_API = false
 * - Toggle in src/config/environment.js
 * 
 * @version 1.1.0
 */

import { NODE_BASE_URL } from '../config/api';
import { authFetch } from '../utils/authFetch';
import { getRazorpayKeyId, getEnvironmentName } from '../config/environment';
import { getTokens } from '../utils/storage';
import RazorpayCheckout from 'react-native-razorpay';

// Log environment on service import
console.log('[SubscriptionService] Environment:', getEnvironmentName());
console.log('[SubscriptionService] API Base URL:', NODE_BASE_URL);

// ============================================
// SUBSCRIPTION STATUS
// ============================================

/**
 * Get current subscription status for the provider
 * 
 * @returns {Promise<Object>} Subscription status
 */
export const getSubscriptionStatus = async () => {
  try {
    const { accessToken } = await getTokens();
    
    if (!accessToken) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const response = await authFetch(`${NODE_BASE_URL}/api/subscription/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    const data = await response.json();
    
    if (data.success) {
      return {
        success: true,
        subscription: data.subscription,
        razorpayKeyId: data.razorpayKeyId,
      };
    }
    
    return {
      success: false,
      error: data.error || 'Failed to get subscription status',
    };
  } catch (error) {
    console.error('[SubscriptionService] Get status error:', error);
    return {
      success: false,
      error: 'Network error. Please check your connection.',
    };
  }
};

// ============================================
// SUBSCRIPTION PLANS
// ============================================

/**
 * Get available subscription plans
 * 
 * @returns {Promise<Object>} Available plans
 */
export const getPlans = async () => {
  try {
    const response = await authFetch(`${NODE_BASE_URL}/api/subscription/plans`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    
    if (data.success) {
      return {
        success: true,
        plans: data.plans,
      };
    }
    
    return {
      success: false,
      error: data.error || 'Failed to get plans',
    };
  } catch (error) {
    console.error('[SubscriptionService] Get plans error:', error);
    return {
      success: false,
      error: 'Network error. Please check your connection.',
    };
  }
};

// ============================================
// ORDER CREATION
// ============================================

/**
 * Create a Razorpay order for subscription payment
 * 
 * @param {string} planId - Plan ID to subscribe to
 * @returns {Promise<Object>} Order details
 */
export const createOrder = async (planId) => {
  try {
    const { accessToken } = await getTokens();
    
    if (!accessToken) {
      return { success: false, error: 'Not authenticated' };
    }
    
    console.log('[SubscriptionService] Creating order for plan:', planId);
    
    const response = await authFetch(`${NODE_BASE_URL}/api/subscription/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ planId }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('[SubscriptionService] Order created:', data.order.id);
      return {
        success: true,
        order: data.order,
        plan: data.plan,
        prefill: data.prefill,
        razorpayKeyId: data.razorpayKeyId,
      };
    }
    
    return {
      success: false,
      error: data.error || 'Failed to create order',
    };
  } catch (error) {
    console.error('[SubscriptionService] Create order error:', error);
    return {
      success: false,
      error: 'Network error. Please check your connection.',
    };
  }
};

// ============================================
// PAYMENT VERIFICATION
// ============================================

/**
 * Verify payment on server and activate subscription
 * 
 * @param {Object} paymentData - Razorpay payment response
 * @returns {Promise<Object>} Verification result
 */
export const verifyPayment = async (paymentData) => {
  try {
    const { accessToken } = await getTokens();
    
    if (!accessToken) {
      return { success: false, error: 'Not authenticated' };
    }
    
    console.log('[SubscriptionService] Verifying payment:', paymentData.razorpay_payment_id);
    
    const response = await authFetch(`${NODE_BASE_URL}/api/subscription/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(paymentData),
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('[SubscriptionService] Payment verified successfully');
      return {
        success: true,
        subscription: data.subscription,
        transaction: data.transaction,
        message: data.message,
      };
    }
    
    return {
      success: false,
      error: data.error || 'Payment verification failed',
    };
  } catch (error) {
    console.error('[SubscriptionService] Verify payment error:', error);
    return {
      success: false,
      error: 'Network error. Please check your connection.',
    };
  }
};

/**
 * Report payment failure to server
 * 
 * @param {Object} failureData - Payment failure details
 * @returns {Promise<Object>} Result
 */
export const reportPaymentFailure = async (failureData) => {
  try {
    const { accessToken } = await getTokens();
    
    if (!accessToken) {
      return { success: false };
    }
    
    await authFetch(`${NODE_BASE_URL}/api/subscription/payment-failed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(failureData),
    });
    
    return { success: true };
  } catch (error) {
    console.error('[SubscriptionService] Report failure error:', error);
    return { success: false };
  }
};

// ============================================
// RAZORPAY CHECKOUT
// ============================================

/**
 * Open Razorpay checkout and handle payment
 * 
 * @param {Object} options - Checkout options
 * @param {Object} options.order - Order details from createOrder
 * @param {Object} options.plan - Plan details
 * @param {Object} options.prefill - Prefill data (email, contact, name)
 * @param {string} options.razorpayKeyId - Razorpay key ID
 * @returns {Promise<Object>} Payment result
 */
export const openRazorpayCheckout = async ({ order, plan, prefill, razorpayKeyId }) => {
  return new Promise((resolve) => {
    const options = {
      description: `${plan.name} - ${plan.durationDays} days premium access`,
      image: 'https://res.cloudinary.com/dj1aytbae/image/upload/v1707123456/fixhomi_logo.png',
      currency: order.currency,
      key: razorpayKeyId,
      amount: order.amount,
      name: 'FixHomi Premium',
      order_id: order.id,
      prefill: {
        email: prefill.email || '',
        contact: prefill.contact || '',
        name: prefill.name || '',
      },
      theme: {
        color: '#2563EB', // Blue theme matching app
      },
      retry: {
        enabled: true,
        max_count: 3,
      },
      send_sms_hash: true,
      remember_customer: true,
    };
    
    console.log('[SubscriptionService] Opening Razorpay checkout');
    
    RazorpayCheckout.open(options)
      .then((data) => {
        // Payment successful
        console.log('[SubscriptionService] Payment successful:', data.razorpay_payment_id);
        resolve({
          success: true,
          data: {
            razorpay_order_id: data.razorpay_order_id,
            razorpay_payment_id: data.razorpay_payment_id,
            razorpay_signature: data.razorpay_signature,
          },
        });
      })
      .catch((error) => {
        // Payment failed or cancelled
        console.log('[SubscriptionService] Payment failed/cancelled:', error);
        resolve({
          success: false,
          error: error.description || error.error?.description || 'Payment failed',
          code: error.code || error.error?.code,
          cancelled: error.code === 0 || error.description?.includes('cancelled'),
        });
      });
  });
};

// ============================================
// TRANSACTION HISTORY
// ============================================

/**
 * Get transaction history
 * 
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} Transactions
 */
export const getTransactions = async (page = 1, limit = 10) => {
  try {
    const { accessToken } = await getTokens();
    
    if (!accessToken) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const response = await authFetch(
      `${NODE_BASE_URL}/api/subscription/transactions?page=${page}&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    
    const data = await response.json();
    
    if (data.success) {
      return {
        success: true,
        transactions: data.transactions,
        pagination: data.pagination,
      };
    }
    
    return {
      success: false,
      error: data.error || 'Failed to get transactions',
    };
  } catch (error) {
    console.error('[SubscriptionService] Get transactions error:', error);
    return {
      success: false,
      error: 'Network error. Please check your connection.',
    };
  }
};

/**
 * Get single transaction details
 * 
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<Object>} Transaction details
 */
export const getTransactionDetails = async (transactionId) => {
  try {
    const { accessToken } = await getTokens();
    
    if (!accessToken) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const response = await authFetch(
      `${NODE_BASE_URL}/api/subscription/transactions/${transactionId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    
    const data = await response.json();
    
    if (data.success) {
      return {
        success: true,
        transaction: data.transaction,
      };
    }
    
    return {
      success: false,
      error: data.error || 'Failed to get transaction details',
    };
  } catch (error) {
    console.error('[SubscriptionService] Get transaction details error:', error);
    return {
      success: false,
      error: 'Network error. Please check your connection.',
    };
  }
};

// ============================================
// COMPLETE SUBSCRIPTION FLOW
// ============================================

/**
 * Complete subscription flow: create order, open checkout, verify payment
 * This is a convenience method that handles the entire flow
 * 
 * @param {string} planId - Plan ID to subscribe to
 * @param {Function} onStatusUpdate - Callback for status updates
 * @returns {Promise<Object>} Final result
 */
export const subscribeToplan = async (planId, onStatusUpdate = () => {}) => {
  try {
    // Step 1: Create order
    onStatusUpdate('Creating order...');
    const orderResult = await createOrder(planId);
    
    if (!orderResult.success) {
      return {
        success: false,
        error: orderResult.error,
        step: 'create_order',
      };
    }
    
    // Step 2: Open Razorpay checkout
    onStatusUpdate('Opening payment...');
    const paymentResult = await openRazorpayCheckout({
      order: orderResult.order,
      plan: orderResult.plan,
      prefill: orderResult.prefill,
      razorpayKeyId: orderResult.razorpayKeyId,
    });
    
    if (!paymentResult.success) {
      // Report failure to server
      await reportPaymentFailure({
        razorpay_order_id: orderResult.order.id,
        error_code: paymentResult.code,
        error_description: paymentResult.error,
      });
      
      return {
        success: false,
        error: paymentResult.cancelled ? 'Payment cancelled' : paymentResult.error,
        cancelled: paymentResult.cancelled,
        step: 'payment',
      };
    }
    
    // Step 3: Verify payment
    onStatusUpdate('Verifying payment...');
    const verifyResult = await verifyPayment(paymentResult.data);
    
    if (!verifyResult.success) {
      return {
        success: false,
        error: verifyResult.error,
        step: 'verify',
      };
    }
    
    // Success!
    return {
      success: true,
      subscription: verifyResult.subscription,
      transaction: verifyResult.transaction,
      message: verifyResult.message,
    };
  } catch (error) {
    console.error('[SubscriptionService] Subscribe flow error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      step: 'unknown',
    };
  }
};

// ============================================
// RESET PREMIUM (DEVELOPMENT/TESTING ONLY)
// ============================================

/**
 * Reset premium status for testing purposes
 * WARNING: This is for development only!
 * 
 * @returns {Promise<Object>} Reset result
 */
export const resetPremium = async () => {
  try {
    const { accessToken } = await getTokens();
    
    if (!accessToken) {
      return { success: false, error: 'Not authenticated' };
    }
    
    console.log('[SubscriptionService] Resetting premium status for testing...');
    
    const response = await authFetch(`${NODE_BASE_URL}/api/subscription/reset-premium`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('[SubscriptionService] Premium reset successfully');
      return {
        success: true,
        message: data.message,
        subscription: data.subscription,
      };
    }
    
    return {
      success: false,
      error: data.error || 'Failed to reset premium',
    };
  } catch (error) {
    console.error('[SubscriptionService] Reset premium error:', error);
    return {
      success: false,
      error: 'Network error. Please check your connection.',
    };
  }
};

export default {
  getSubscriptionStatus,
  getPlans,
  createOrder,
  verifyPayment,
  reportPaymentFailure,
  openRazorpayCheckout,
  getTransactions,
  getTransactionDetails,
  subscribeToplan,
  resetPremium,
};

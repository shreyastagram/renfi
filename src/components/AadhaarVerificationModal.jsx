/**
 * Aadhaar Verification Modal (DigiLocker Via Link)
 * 
 * A modal dialog for providers to verify their Aadhaar via DigiLocker.
 * Direct OTP flow is NOT used due to government compliance restrictions.
 * 
 * FLOW:
 * 1. User taps "Start Verification"
 * 2. App opens DigiLocker URL in browser
 * 3. User authenticates in DigiLocker (OTP handled by DigiLocker)
 * 4. DigiLocker redirects back to app
 * 5. App polls for verification status
 * 
 * COMPLIANCE NOTES:
 * - NO Aadhaar number collected
 * - NO OTP handled by our app
 * - DigiLocker handles all sensitive authentication
 * - Only verification status is saved
 * 
 * @version 2.0.0 - DigiLocker Via Link implementation
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
  AppState,
} from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { 
  initiateVerification, 
  openVerificationUrl, 
  checkVerificationStatus,
  getAadhaarStatus 
} from '../services/aadhaarService';

// Steps in the verification flow
const STEPS = {
  INTRO: 'intro',
  VERIFYING: 'verifying',
  POLLING: 'polling',
  VERIFIED: 'verified',
  ERROR: 'error',
};

const AadhaarVerificationModal = ({ visible, onClose, onVerified }) => {
  const [step, setStep] = useState(STEPS.INTRO);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [pollingAttempts, setPollingAttempts] = useState(0);
  
  const appStateRef = useRef(AppState.currentState);
  const pollingRef = useRef(null);
  
  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setStep(STEPS.INTRO);
      setError('');
      setSessionId('');
      setPollingAttempts(0);
      setLoading(false);
    } else {
      // Cleanup polling when modal closes
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, [visible]);
  
  // Handle app state changes (when user returns from browser)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        sessionId &&
        step === STEPS.VERIFYING
      ) {
        // User returned to app, start polling
        console.log('[DigiLocker] User returned to app, starting poll');
        setStep(STEPS.POLLING);
        startPolling();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription?.remove();
    };
  }, [sessionId, step]);
  
  // Handle deep link callback
  useEffect(() => {
    const handleDeepLink = (event) => {
      const url = event.url;
      console.log('[DigiLocker] Deep link received:', url);
      
      if (url.includes('aadhaar-verification')) {
        const params = new URLSearchParams(url.split('?')[1]);
        const status = params.get('status');
        
        if (status === 'success') {
          setStep(STEPS.VERIFIED);
          setTimeout(() => {
            onVerified?.();
            onClose();
          }, 1500);
        } else if (status === 'failed' || status === 'error') {
          setError(params.get('message') || 'Verification failed');
          setStep(STEPS.ERROR);
        } else {
          // Status unknown, start polling
          setStep(STEPS.POLLING);
          startPolling();
        }
      }
    };
    
    const linkingSubscription = Linking.addEventListener('url', handleDeepLink);
    
    return () => {
      linkingSubscription?.remove();
    };
  }, []);
  
  // Start polling for verification status
  const startPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    
    setPollingAttempts(0);
    
    pollingRef.current = setInterval(async () => {
      setPollingAttempts(prev => {
        const newAttempts = prev + 1;
        
        if (newAttempts > 20) {
          // Stop after 20 attempts (1 minute)
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          setError('Verification timeout. Please try again.');
          setStep(STEPS.ERROR);
          return prev;
        }
        
        return newAttempts;
      });
      
      const result = await checkVerificationStatus(sessionId);
      
      if (result.verified) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        setStep(STEPS.VERIFIED);
        setTimeout(() => {
          onVerified?.();
          onClose();
        }, 1500);
      } else if (result.status === 'failed' || result.status === 'expired') {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        setError(result.message || 'Verification failed');
        setStep(STEPS.ERROR);
      }
    }, 3000); // Poll every 3 seconds
  };
  
  // Handle start verification
  const handleStartVerification = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await initiateVerification();
      
      if (result.success) {
        setSessionId(result.sessionId);
        
        // Open DigiLocker URL in browser
        const opened = await openVerificationUrl(result.verificationUrl);
        
        if (opened) {
          setStep(STEPS.VERIFYING);
        } else {
          setError('Could not open verification page. Please try again.');
          setStep(STEPS.ERROR);
        }
      } else {
        setError(result.error || 'Failed to start verification');
        setStep(STEPS.ERROR);
      }
    } catch (err) {
      console.error('Start verification error:', err);
      setError('Something went wrong. Please try again.');
      setStep(STEPS.ERROR);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle retry
  const handleRetry = () => {
    setStep(STEPS.INTRO);
    setError('');
    setSessionId('');
  };
  
  // Check status manually
  const handleCheckStatus = async () => {
    if (!sessionId) return;
    
    setLoading(true);
    
    const result = await checkVerificationStatus(sessionId);
    
    setLoading(false);
    
    if (result.verified) {
      setStep(STEPS.VERIFIED);
      setTimeout(() => {
        onVerified?.();
        onClose();
      }, 1500);
    } else if (result.status === 'pending') {
      Alert.alert(
        'Verification Pending',
        'Please complete the verification in DigiLocker first.',
        [
          { text: 'Open DigiLocker', onPress: () => handleStartVerification() },
          { text: 'OK', style: 'cancel' }
        ]
      );
    } else {
      setError(result.message || 'Verification not complete');
    }
  };
  
  // Render intro step
  const renderIntroStep = () => (
    <>
      <Text style={styles.title}>Verify Your Identity</Text>
      <Text style={styles.description}>
        Verify your Aadhaar through DigiLocker - the government's official 
        digital document wallet. This ensures secure verification without 
        sharing your Aadhaar number with us.
      </Text>
      
      <View style={styles.benefitsList}>
        <View style={styles.benefitItem}>
          <MaterialIcon name="security" size={24} color="#10B981" />
          <Text style={styles.benefitText}>Government-approved verification</Text>
        </View>
        <View style={styles.benefitItem}>
          <MaterialIcon name="lock" size={24} color="#10B981" />
          <Text style={styles.benefitText}>Your Aadhaar is never shared with us</Text>
        </View>
        <View style={styles.benefitItem}>
          <MaterialIcon name="verified-user" size={24} color="#10B981" />
          <Text style={styles.benefitText}>Quick and secure process</Text>
        </View>
      </View>
      
      <View style={styles.privacyNote}>
        <MaterialIcon name="info" size={16} color="#2b76bc" />
        <Text style={styles.privacyText}>
          You'll be redirected to DigiLocker. After verification, you'll 
          automatically return to the app.
        </Text>
      </View>
      
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleStartVerification}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <MaterialIcon name="verified-user" size={20} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Start Verification</Text>
          </>
        )}
      </TouchableOpacity>
    </>
  );
  
  // Render verifying step (waiting for user to return from browser)
  const renderVerifyingStep = () => (
    <View style={styles.verifyingContainer}>
      <ActivityIndicator size="large" color="#2b76bc" />
      <Text style={styles.verifyingTitle}>Verification in Progress</Text>
      <Text style={styles.verifyingDescription}>
        Complete the verification in DigiLocker.{'\n'}
        This screen will update automatically.
      </Text>
      
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={handleCheckStatus}
        disabled={loading}
      >
        <Text style={styles.secondaryButtonText}>
          {loading ? 'Checking...' : 'I\'ve completed verification'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.textButton}
        onPress={handleStartVerification}
      >
        <Text style={styles.textButtonText}>Open DigiLocker again</Text>
      </TouchableOpacity>
    </View>
  );
  
  // Render polling step
  const renderPollingStep = () => (
    <View style={styles.verifyingContainer}>
      <ActivityIndicator size="large" color="#2b76bc" />
      <Text style={styles.verifyingTitle}>Checking Verification Status</Text>
      <Text style={styles.verifyingDescription}>
        Please wait while we confirm your verification...
      </Text>
      <Text style={styles.pollingInfo}>
        Attempt {pollingAttempts}/20
      </Text>
    </View>
  );
  
  // Render error step
  const renderErrorStep = () => (
    <View style={styles.errorStepContainer}>
      <View style={styles.errorIconContainer}>
        <MaterialIcon name="error-outline" size={64} color="#EF4444" />
      </View>
      <Text style={styles.errorTitle}>Verification Failed</Text>
      <Text style={styles.errorDescription}>{error}</Text>
      
      <TouchableOpacity
        style={styles.button}
        onPress={handleRetry}
      >
        <MaterialIcon name="refresh" size={20} color="#FFFFFF" style={styles.buttonIcon} />
        <Text style={styles.buttonText}>Try Again</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.textButton}
        onPress={onClose}
      >
        <Text style={styles.textButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
  
  // Render verified step
  const renderVerifiedStep = () => (
    <View style={styles.verifiedContainer}>
      <View style={styles.successIcon}>
        <MaterialIcon name="check-circle" size={80} color="#10B981" />
      </View>
      <Text style={styles.verifiedTitle}>Aadhaar Verified!</Text>
      <Text style={styles.verifiedDescription}>
        Your identity has been successfully verified through DigiLocker.
      </Text>
    </View>
  );
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={step !== STEPS.VERIFIED ? onClose : undefined}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={() => {
            if (step === STEPS.INTRO || step === STEPS.ERROR) {
              onClose();
            }
          }}
        />
        
        <View style={styles.modal}>
          {(step === STEPS.INTRO || step === STEPS.ERROR) && (
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <MaterialIcon name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          )}
          
          {step === STEPS.INTRO && renderIntroStep()}
          {step === STEPS.VERIFYING && renderVerifyingStep()}
          {step === STEPS.POLLING && renderPollingStep()}
          {step === STEPS.ERROR && renderErrorStep()}
          {step === STEPS.VERIFIED && renderVerifiedStep()}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    minHeight: 350,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    zIndex: 1,
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    marginTop: 8,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 20,
  },
  benefitsList: {
    marginBottom: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
    flex: 1,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  privacyText: {
    color: '#2b76bc',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#2b76bc',
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  textButton: {
    marginTop: 16,
    alignSelf: 'center',
    padding: 8,
  },
  textButtonText: {
    color: '#2b76bc',
    fontSize: 14,
    fontWeight: '500',
  },
  verifyingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  verifyingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 24,
    marginBottom: 8,
  },
  verifyingDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  pollingInfo: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
  },
  errorStepContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  errorIconContainer: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 8,
  },
  errorDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  verifiedContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successIcon: {
    marginBottom: 24,
  },
  verifiedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 8,
  },
  verifiedDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default AadhaarVerificationModal;

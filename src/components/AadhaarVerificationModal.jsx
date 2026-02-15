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
import { useApp } from '../context/AppContext';
import { 
  initiateVerification, 
  openVerificationUrl, 
  checkVerificationStatus,
  getAadhaarStatus 
} from '../services/aadhaarService';

// Steps in the verification flow
const STEPS = {
  INTRO: 'intro',
  NAME_CONFIRM: 'name_confirm',
  VERIFYING: 'verifying',
  POLLING: 'polling',
  VERIFIED: 'verified',
  ERROR: 'error',
};

const AadhaarVerificationModal = ({ visible, onClose, onVerified }) => {
  const { profile } = useApp();
  const [step, setStep] = useState(STEPS.INTRO);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [pollingAttempts, setPollingAttempts] = useState(0);
  
  const appStateRef = useRef(AppState.currentState);
  const pollingRef = useRef(null);
  
  // Get provider name from context — profile uses fullName (merged from mongoData.name)
  const providerName = profile?.fullName || profile?.name || '';
  
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
        } else if (status === 'name_mismatch') {
          const aadhaarName = params.get('aadhaarName') || '';
          const message = params.get('message') || 'Name does not match your Aadhaar card';
          setError(
            `${message}\n\nName on Aadhaar: "${aadhaarName}"\n\nPlease update your name in Profile to match your Aadhaar card exactly, then try again.`
          );
          setStep(STEPS.ERROR);
        } else if (status === 'name_retrieval_failed') {
          const message = params.get('message') || 'Could not retrieve name from DigiLocker';
          setError(
            `${message}\n\nThis may be a temporary issue with DigiLocker. Please wait a moment and try again.`
          );
          setStep(STEPS.ERROR);
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
      } else if (result.status === 'name_mismatch') {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        const aadhaarName = result.aadhaarName || '';
        setError(
          `Name mismatch detected!\n\nName on Aadhaar: "${aadhaarName}"\n\nPlease update your name in your Profile to match your Aadhaar card exactly, then try again.`
        );
        setStep(STEPS.ERROR);
      } else if (result.status === 'name_retrieval_failed') {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        setError(
          result.message || 'Could not retrieve your name from DigiLocker. This may be a temporary issue — please try again.'
        );
        setStep(STEPS.ERROR);
      } else if (result.status === 'failed' || result.status === 'expired') {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        setError(result.message || 'Verification failed');
        setStep(STEPS.ERROR);
      }
    }, 3000); // Poll every 3 seconds
  };
  
  // Handle start verification — show name confirmation first
  const handleStartVerification = async () => {
    // Check if provider has a name set
    if (!providerName || providerName.trim().length < 2) {
      setError('Please set your full name (as it appears on your Aadhaar card) in your Profile before starting verification.');
      setStep(STEPS.ERROR);
      return;
    }
    
    // Show the name confirmation step
    setStep(STEPS.NAME_CONFIRM);
  };
  
  // Handle confirmed name — actually initiate verification
  const handleNameConfirmed = async () => {
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
        // Handle NAME_REQUIRED — provider must set their name first
        if (result.code === 'NAME_REQUIRED') {
          setError('Please set your full name (as it appears on your Aadhaar card) in your Profile before starting verification.');
        } else {
          setError(result.error || 'Failed to start verification');
        }
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
    } else if (result.status === 'name_mismatch') {
      const aadhaarName = result.aadhaarName || '';
      setError(
        `Name mismatch!\n\nName on Aadhaar: "${aadhaarName}"\n\nUpdate your profile name to match your Aadhaar card, then try again.`
      );
      setStep(STEPS.ERROR);
    } else if (result.status === 'name_retrieval_failed') {
      setError(
        result.message || 'Could not retrieve your name from DigiLocker. Please try again.'
      );
      setStep(STEPS.ERROR);
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
      
      <View style={styles.nameWarningNote}>
        <MaterialIcon name="warning" size={16} color="#D97706" />
        <Text style={styles.nameWarningText}>
          Important: Your profile name must match your Aadhaar card exactly. 
          Verification will be rejected if names don't match.
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
  
  // Render name confirmation step — user must confirm their name before proceeding
  const renderNameConfirmStep = () => (
    <View style={styles.nameConfirmContainer}>
      <View style={styles.nameConfirmIconRow}>
        <MaterialIcon name="person" size={48} color="#2b76bc" />
      </View>
      <Text style={styles.nameConfirmTitle}>Confirm Your Name</Text>
      <Text style={styles.nameConfirmDescription}>
        Your profile name will be matched against the name on your Aadhaar card. 
        Verification will fail if names don't match.
      </Text>
      
      <View style={styles.nameDisplayBox}>
        <Text style={styles.nameDisplayLabel}>Your Profile Name</Text>
        <Text style={styles.nameDisplayValue}>{providerName}</Text>
      </View>
      
      <Text style={styles.nameConfirmQuestion}>
        Does this name match your Aadhaar card exactly?
      </Text>
      
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleNameConfirmed}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <MaterialIcon name="check" size={20} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Yes, Name Matches — Proceed</Text>
          </>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.nameUpdateButton}
        onPress={() => {
          onClose();
          Alert.alert(
            'Update Your Name',
            'Please go to your Profile and update your name to match your Aadhaar card exactly (including spelling and middle name), then return here to verify.',
            [{ text: 'OK' }]
          );
        }}
      >
        <MaterialIcon name="edit" size={18} color="#EF4444" style={{ marginRight: 6 }} />
        <Text style={styles.nameUpdateButtonText}>No, I Need to Update My Name</Text>
      </TouchableOpacity>
    </View>
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
            if (step === STEPS.INTRO || step === STEPS.ERROR || step === STEPS.NAME_CONFIRM) {
              onClose();
            }
          }}
        />
        
        <View style={styles.modal}>
          {(step === STEPS.INTRO || step === STEPS.ERROR || step === STEPS.NAME_CONFIRM) && (
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <MaterialIcon name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          )}
          
          {step === STEPS.INTRO && renderIntroStep()}
          {step === STEPS.NAME_CONFIRM && renderNameConfirmStep()}
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
  nameWarningNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  nameWarningText: {
    color: '#92400E',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  nameConfirmContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  nameConfirmIconRow: {
    marginBottom: 16,
  },
  nameConfirmTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  nameConfirmDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  nameDisplayBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#2b76bc',
  },
  nameDisplayLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  nameDisplayValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  nameConfirmQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 20,
    textAlign: 'center',
  },
  nameUpdateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  nameUpdateButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AadhaarVerificationModal;

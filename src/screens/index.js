/**
 * Screens Index
 * 
 * Export all screen components
 * 
 * @version 5.0.0
 */

// Onboarding & User Type Selection
export { default as UserTypeScreen } from './UserTypeScreen';

// User Authentication
export { default as UserAuthScreen } from './UserAuthScreen';
export { default as RegisterScreen } from './RegisterScreen';
export { default as LoginScreen } from './LoginScreen';

// Provider Authentication
export { default as ProviderAuthScreen } from './ProviderAuthScreen';
export { default as ProviderRegisterScreen } from './ProviderRegisterScreen';

// OTP-based Login
export { default as OTPLoginScreen } from './OTPLoginScreen';
export { default as OTPVerifyScreen } from './OTPVerifyScreen';

// Password Management
export { default as ForgotPasswordScreen } from './ForgotPasswordScreen';
export { default as ResetPasswordScreen } from './ResetPasswordScreen';
export { default as ChangePasswordScreen } from './ChangePasswordScreen';

// Account Verification & Profile
export { default as VerificationScreen } from './VerificationScreen';
export { default as EmailVerifyHandlerScreen } from './EmailVerifyHandlerScreen';
export { default as ProfileScreen } from './ProfileScreen';

// Main App
export { default as HomeScreen } from './HomeScreen';
export { default as UserHomeScreen } from './UserHomeScreen';
export { default as ProviderHomeScreen } from './ProviderHomeScreen';

// Service Requests - User
export { default as CreateServiceRequestScreen } from './CreateServiceRequestScreen';
export { default as UserServiceHistoryScreen } from './UserServiceHistoryScreen';
export { default as ServiceRequestDetailScreen } from './ServiceRequestDetailScreen';
export { default as LiveTrackingScreen } from './LiveTrackingScreen';

// Service Requests - Provider
export { default as ProviderRequestsScreen } from './ProviderRequestsScreen';
export { default as ProviderServiceHistoryScreen } from './ProviderServiceHistoryScreen';
export { default as ProviderJobsScreen } from './ProviderJobsScreen';

// Settings
export { default as SettingsScreen } from './SettingsScreen';
export { default as AccountSecurityScreen } from './AccountSecurityScreen';

// Document Verification
export { default as DocumentVerificationScreen } from './DocumentVerificationScreen';

// Service Approvals (RSAS)
export { default as ServiceApprovalsScreen } from './ServiceApprovalsScreen';

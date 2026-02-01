# Phase 1 & 2 Implementation: Password Management + Google OAuth

## Overview

This document details the implementation of **Phase 1 (Password Management)** and **Phase 2 (Google OAuth)** for the FixHomi app's Java Auth API integration.

---

## Phase 1: Password Management

### API Endpoints (Already in Java Auth)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/forgot-password` | POST | Request password reset email |
| `/api/auth/reset-password/validate` | GET | Validate reset token |
| `/api/auth/reset-password` | POST | Reset password with token |
| `/api/users/change-password` | POST | Change password (authenticated) |

### Frontend Implementation

#### 1. `authService.js` - New Functions Added

```javascript
// Request password reset email
export const forgotPassword = async (email)

// Validate reset token from email link
export const validateResetToken = async (token)

// Reset password using token
export const resetPassword = async (token, newPassword)

// Change password for authenticated users
export const changePassword = async (currentPassword, newPassword)
```

#### 2. New Screens Created

| Screen | Path | Purpose |
|--------|------|---------|
| `ForgotPasswordScreen.jsx` | `/src/screens/` | Email input for password reset |
| `ResetPasswordScreen.jsx` | `/src/screens/` | Token validation + new password form |
| `ChangePasswordScreen.jsx` | `/src/screens/` | Authenticated password change |

#### 3. Navigation Updates

- Added screens to `screens/index.js` exports
- Added to `RootNavigator.jsx`:
  - `ForgotPassword` - in Auth Navigator
  - `ResetPassword` - in Auth Navigator (with deep link)
  - `ChangePassword` - in User/Provider Main Navigator

#### 4. Deep Link Configuration

```javascript
// In api.js
export const DEEP_LINK_CONFIG = {
  SCHEME: 'fixhomi',
  HOST: 'auth',
  EMAIL_VERIFY_PATH: 'email-verify',
  RESET_PASSWORD_PATH: 'reset-password',
  // Deep links:
  // - fixhomi://auth/email-verify?token=xxx
  // - fixhomi://auth/reset-password?token=xxx
};
```

---

## Phase 2: Google OAuth Integration

### Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  React Native   │────>│   Java Auth      │────>│   PostgreSQL    │
│  Google Sign-In │     │   Backend        │     │   (Auth Data)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
  Google OAuth 2.0         MongoDB Profile
  (ID Token)               Sync (via Node.js)
```

### Key Principle: One Email = One Account Type

- A user registering via Google as USER cannot later register as PROVIDER with the same email
- This is enforced at the Java Auth backend level
- Frontend displays appropriate error messages when role conflict occurs

### Java Auth Backend Changes

#### 1. `GoogleMobileAuthRequest.java`
- Added `role` field with pattern validation: `^(USER|SERVICE_PROVIDER)?$`

#### 2. `GoogleAuthService.java`
- Updated to accept role parameter during registration
- Creates user with specified role (defaults to USER)

### Frontend Implementation

#### 1. `googleAuthService.js` - New Service Created

```javascript
// Configuration
export const configureGoogleSignIn = ()

// Sign-in methods
export const signInWithGoogle = async (role)
export const signInWithGoogleAsUser = async ()
export const signInWithGoogleAsProvider = async ()

// Token exchange
const exchangeGoogleTokenForAuth = async (idToken, role)

// Sign out
export const signOutFromGoogle = async ()
export const revokeGoogleAccess = async ()

// MongoDB Profile Sync (for new users)
export const createUserProfileFromGoogle = async (userData)
export const createProviderProfileFromGoogle = async (providerData)

// Error handling
export const getGoogleAuthErrorMessage = (code, defaultMessage)
```

#### 2. `LoginScreen.jsx` Updates

- Added Google Sign-In button
- Added `handleGoogleSignIn()` function
- Supports both USER and SERVICE_PROVIDER roles via `userType` prop
- Proper error handling for role conflicts

#### 3. App.tsx

- Added `configureGoogleSignIn()` call on app start

### Google Sign-In Flow

```
1. User taps "Continue with Google" button
2. Google SDK shows account picker
3. User selects account and grants permissions
4. App receives Google ID token
5. App sends ID token + role to Java Auth backend
6. Backend verifies token with Google
7. Backend creates/finds user, returns FixHomi JWT tokens
8. For new users: Sync profile to MongoDB via Node.js
9. User is authenticated and navigated to main app
```

---

## Configuration Required

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create/select your project
3. Enable Google Sign-In API
4. Create OAuth 2.0 credentials:
   - **Web Client** - For ID token verification on backend
   - **Android Client** - With SHA-1 fingerprint
   - **iOS Client** - With bundle identifier

### 2. Update Frontend Configuration

In `src/services/googleAuthService.js`:

```javascript
const GOOGLE_WEB_CLIENT_ID = 'YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com';
```

### 3. Android Configuration

Ensure `google-services.json` has the correct OAuth client configuration:
- Path: `android/app/google-services.json`

### 4. iOS Configuration

Ensure proper URL schemes in `ios/renfi/Info.plist`:
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.YOUR_CLIENT_ID</string>
    </array>
  </dict>
</array>
```

---

## Files Modified/Created

### New Files Created

| File | Purpose |
|------|---------|
| `src/services/googleAuthService.js` | Google OAuth service |
| `src/screens/ForgotPasswordScreen.jsx` | Forgot password screen |
| `src/screens/ResetPasswordScreen.jsx` | Reset password screen |
| `src/screens/ChangePasswordScreen.jsx` | Change password screen |

### Files Modified

| File | Changes |
|------|---------|
| `src/services/authService.js` | Added password management functions |
| `src/screens/LoginScreen.jsx` | Added Google Sign-In button and handler |
| `src/screens/index.js` | Added new screen exports |
| `src/config/api.js` | Added RESET_PASSWORD_PATH to deep links |
| `navigation/RootNavigator.jsx` | Added password screens to navigators |
| `App.tsx` | Added Google Sign-In configuration |

### Java Auth Files Modified (if applicable)

| File | Changes |
|------|---------|
| `GoogleMobileAuthRequest.java` | Added role field |
| `GoogleAuthService.java` | Role parameter support |

---

## Testing Checklist

### Password Management

- [ ] Forgot Password: Email request works
- [ ] Forgot Password: Success message with masked email
- [ ] Reset Password: Token validation on deep link
- [ ] Reset Password: Invalid/expired token handling
- [ ] Reset Password: New password validation
- [ ] Reset Password: Successful reset and redirect to login
- [ ] Change Password: Current password validation
- [ ] Change Password: New password different from current
- [ ] Change Password: Success message and form clear

### Google OAuth

- [ ] Google Sign-In button visible on login screen
- [ ] Account picker appears correctly
- [ ] Successful sign-in as USER
- [ ] Successful sign-in as PROVIDER
- [ ] Cancelled sign-in handled gracefully
- [ ] Role conflict error displayed correctly
- [ ] Account exists with password error handled
- [ ] Token exchange with backend works
- [ ] User navigated to correct home screen

### Deep Links

- [ ] `fixhomi://auth/reset-password?token=xxx` opens ResetPasswordScreen
- [ ] Token extracted from URL correctly
- [ ] Navigation works from quit state

---

## Error Codes

### Password Management

| Code | Message |
|------|---------|
| `USER_NOT_FOUND` | No account found with this email |
| `RESET_TOKEN_EXPIRED` | Reset link has expired |
| `RESET_TOKEN_INVALID` | Invalid reset link |
| `INVALID_CURRENT_PASSWORD` | Current password is incorrect |
| `SAME_PASSWORD` | New password must be different |
| `WEAK_PASSWORD` | Password must be at least 8 characters |

### Google OAuth

| Code | Message |
|------|---------|
| `GOOGLE_SIGN_IN_CANCELLED` | User cancelled sign-in |
| `PLAY_SERVICES_NOT_AVAILABLE` | Google Play Services needed |
| `ROLE_CONFLICT` | Email registered as different role |
| `ACCOUNT_EXISTS_WITH_PASSWORD` | Account exists, use password |
| `NO_GOOGLE_ID_TOKEN` | Failed to get Google token |

---

## Next Steps (Phase 3-6)

1. **Phase 3: Profile Sync** - Keep Java Auth and MongoDB profiles in sync
2. **Phase 4: Auth Infrastructure** - Token interceptors, multi-device management
3. **Phase 5: Deep Links** - Email verification, app links
4. **Phase 6: Health Monitoring** - Auth service health checks

---

## Support

For issues with:
- **Google Sign-In SDK**: Check `@react-native-google-signin/google-signin` documentation
- **Java Auth APIs**: Check the Postman collection in `jarbac/postman/`
- **Deep Links**: Test with `adb shell am start -a android.intent.action.VIEW -d "fixhomi://auth/reset-password?token=test"`

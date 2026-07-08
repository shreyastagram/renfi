/**
 * useBookingProfileGate
 *
 * USER booking gate: a customer must have a non-empty name AND a verified
 * phone number before creating ANY service request (traditional, event,
 * emergency). Needed because unified-auth accounts can start with an empty
 * name (phone signups) or no phone at all (Google/Apple signups).
 *
 * The backend enforces the same rule with
 *   403 { code: 'PROFILE_INCOMPLETE', missing: { name, phone, phoneVerified } }
 * — `handleProfileIncompleteError` maps that error to the same dialog in
 * case the client-side check ran against stale profile data.
 *
 * The dialog routes to the existing 'Profile' screen (Edit Profile), which
 * already has the add-name + add-phone + verify-phone OTP UI
 * (sendPhoneVerificationOtp / verifyPhoneOtp).
 *
 * USER flow only — provider screens never use this hook.
 */

import { useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';

export default function useBookingProfileGate(navigation) {
  const { user, profile, isAuthLoading, isProfileLoading } = useApp();
  const { dialog } = useDialog();
  const { t } = useLanguage();

  const showProfileIncompleteDialog = useCallback(() => {
    dialog(
      t('userHome.profileIncompleteTitle') || 'Complete your profile',
      t('userHome.profileIncompleteMsg') ||
        'Please add your name and verify your phone number to book a service.',
      [
        { text: t('common.later'), style: 'cancel' },
        {
          text: t('userHome.completeProfile') || 'Complete Profile',
          onPress: () => navigation?.navigate?.('Profile'),
        },
      ]
    );
  }, [dialog, t, navigation]);

  /**
   * Returns true when booking may proceed. When the profile is incomplete,
   * shows the "Complete your profile" dialog and returns false.
   * While the profile is still loading we do NOT block (matches the existing
   * phone-verification gates) — the backend 403 is the safety net.
   */
  const ensureBookingProfileComplete = useCallback(() => {
    if (isAuthLoading || isProfileLoading) return true;

    // Name: Mongo profile uses `name`, Java Auth / user state uses `fullName`.
    const name = (profile?.name || profile?.fullName || user?.fullName || '').trim();
    // Phone + verified flag (Java Auth is the source of truth; Google/Apple
    // accounts may have no phone at all).
    const phone = (profile?.phone || user?.phone || '').trim();
    const phoneVerified =
      profile?.isPhoneVerified ??
      user?.isPhoneVerified ??
      profile?.phoneVerified ??
      user?.phoneVerified ??
      false;

    if (!name || !phone || !phoneVerified) {
      showProfileIncompleteDialog();
      return false;
    }
    return true;
  }, [
    isAuthLoading,
    isProfileLoading,
    profile?.name,
    profile?.fullName,
    profile?.phone,
    profile?.isPhoneVerified,
    profile?.phoneVerified,
    user?.fullName,
    user?.phone,
    user?.isPhoneVerified,
    user?.phoneVerified,
    showProfileIncompleteDialog,
  ]);

  /**
   * Backend-403 handler for submit error paths. Pass the error code (or a
   * result object with `.code`); returns true when it was PROFILE_INCOMPLETE
   * and the dialog was shown (caller should stop its own error handling).
   */
  const handleProfileIncompleteError = useCallback(
    (codeOrResult) => {
      const code =
        typeof codeOrResult === 'string' ? codeOrResult : codeOrResult?.code;
      if (code === 'PROFILE_INCOMPLETE') {
        showProfileIncompleteDialog();
        return true;
      }
      return false;
    },
    [showProfileIncompleteDialog]
  );

  return {
    ensureBookingProfileComplete,
    handleProfileIncompleteError,
    showProfileIncompleteDialog,
  };
}

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
   * Route the user to fix the SPECIFIC missing piece (backend `missing` shape
   * { name, phone, phoneVerified }):
   *  - missing NAME  → Profile screen, identity editor, focused on the name
   *    field, returning to the booking screen after save.
   *  - missing / unverified PHONE → the dedicated OTP Verification screen
   *    (add + verify), matching the app's provider verification UX.
   */
  const promptCompleteProfile = useCallback(
    (missing) => {
      const nameMissing = !!missing?.name;
      const phoneMissing = !!missing?.phone;
      const phoneUnverified = !!missing?.phoneVerified;

      if (nameMissing) {
        dialog(
          t('userHome.profileIncompleteTitle') || 'Complete your profile',
          t('userHome.completeProfileNameMsg') ||
            'Please add your name to your profile to continue booking a service.',
          [
            { text: t('common.later'), style: 'cancel' },
            {
              text: t('userHome.completeProfile') || 'Complete Profile',
              onPress: () =>
                navigation?.navigate?.('Profile', {
                  editSection: 'identity',
                  focusField: 'name',
                  returnAfterSave: true,
                }),
            },
          ]
        );
        return;
      }

      if (phoneMissing || phoneUnverified) {
        dialog(
          t('userHome.profileIncompleteTitle') || 'Complete your profile',
          t('userHome.completeProfilePhoneMsg') ||
            'Please add and verify your mobile number to continue booking a service.',
          [
            { text: t('common.later'), style: 'cancel' },
            {
              text: t('userHome.verifyNow') || 'Verify Now',
              onPress: () =>
                navigation?.navigate?.('Verification', {
                  verificationType: 'phone',
                  // phone exists but isn't verified → force a re-verify
                  forceReVerify: phoneUnverified && !phoneMissing,
                }),
            },
          ]
        );
        return;
      }

      // Fallback — shouldn't normally happen.
      showProfileIncompleteDialog();
    },
    [dialog, t, navigation, showProfileIncompleteDialog]
  );

  /**
   * Returns true when booking may proceed. When the profile is incomplete,
   * routes the user to the right fix (name → Profile, phone → Verification)
   * and returns false. While the profile is still loading we do NOT block
   * (matches the existing phone-verification gates) — the backend 403 is the
   * safety net.
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

    const missing = { name: !name, phone: !phone, phoneVerified: !phoneVerified };
    if (missing.name || missing.phone || missing.phoneVerified) {
      promptCompleteProfile(missing);
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
    promptCompleteProfile,
  ]);

  /**
   * Backend-403 handler for submit error paths. Pass the result object (or
   * code). Returns true when it was PROFILE_INCOMPLETE and the user was routed
   * (caller should stop its own error handling). Uses the backend `missing`
   * map to route to the right screen; falls back to the generic dialog.
   */
  const handleProfileIncompleteError = useCallback(
    (codeOrResult) => {
      const isObj = codeOrResult && typeof codeOrResult === 'object';
      const code = isObj ? codeOrResult.code : codeOrResult;
      if (code === 'PROFILE_INCOMPLETE') {
        const missing = (isObj && codeOrResult.missing) || null;
        if (missing) {
          promptCompleteProfile(missing);
        } else {
          showProfileIncompleteDialog();
        }
        return true;
      }
      return false;
    },
    [promptCompleteProfile, showProfileIncompleteDialog]
  );

  return {
    ensureBookingProfileComplete,
    handleProfileIncompleteError,
    showProfileIncompleteDialog,
  };
}

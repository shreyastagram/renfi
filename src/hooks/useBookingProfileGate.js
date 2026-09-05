/**
 * useBookingProfileGate
 *
 * USER booking gate: a customer must have a non-empty name AND a verified
 * phone number before creating ANY service request (traditional, event,
 * emergency). Needed because unified-auth accounts can start with an empty
 * name (phone signups) or no phone at all (Google/Apple signups).
 *
 * A missing NAME is collected INLINE (a bottom-sheet, via ProfileCompletion
 * provider) so the user never leaves the booking flow or loses their selected
 * service. A missing / unverified PHONE routes to the existing add+verify OTP
 * Verification screen.
 *
 * The backend enforces the same rule with
 *   403 { code: 'PROFILE_INCOMPLETE', missing: { name, phone, phoneVerified } }
 * — `handleProfileIncompleteError` maps that error to the same UX in case the
 * client-side check ran against stale profile data.
 *
 * USER flow only — provider screens never use this hook.
 */

import { useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import { useProfileCompletion } from '../context/ProfileCompletionContext';

export default function useBookingProfileGate(navigation) {
  const { user, profile, isAuthLoading, isProfileLoading } = useApp();
  const { dialog } = useDialog();
  const { t } = useLanguage();
  const { collectRequiredField } = useProfileCompletion();

  // Generic fallback dialog — only used if we can't tell what's missing.
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

  // Missing / unverified PHONE → the dedicated add+verify OTP screen.
  const goToPhoneVerification = useCallback(
    (forceReVerify) => {
      navigation?.navigate?.('Verification', {
        verificationType: 'phone',
        forceReVerify: !!forceReVerify,
      });
    },
    [navigation]
  );

  /**
   * Returns true when booking may proceed. A missing NAME is collected INLINE
   * (no navigation — the booking selection is preserved); a missing/unverified
   * PHONE routes to Verification. While the profile is still loading we do NOT
   * block (matches the existing phone-verification gates) — the backend 403 is
   * the safety net. ASYNC: callers must `await`.
   */
  const ensureBookingProfileComplete = useCallback(async () => {
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

    // 1) NAME missing → collect inline; abort the booking if the user cancels
    //    or the save fails. A successful save reflects app-wide + on the backend.
    if (!name) {
      const ok = await collectRequiredField('name');
      if (!ok) return false;
    }

    // 2) PHONE missing or unverified → provider-style OTP screen. `forceReVerify`
    //    only when a number exists but isn't verified.
    if (!phone || !phoneVerified) {
      goToPhoneVerification(!!phone && !phoneVerified);
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
    collectRequiredField,
    goToPhoneVerification,
  ]);

  /**
   * Backend-403 handler for submit error paths. Pass the result object (or
   * code). Returns true when it was PROFILE_INCOMPLETE and the user was routed
   * (caller should stop its own error handling). Name → inline collector;
   * phone → Verification; unknown → generic dialog.
   */
  const handleProfileIncompleteError = useCallback(
    (codeOrResult) => {
      const isObj = codeOrResult && typeof codeOrResult === 'object';
      const code = isObj ? codeOrResult.code : codeOrResult;
      if (code !== 'PROFILE_INCOMPLETE') return false;

      const missing = (isObj && codeOrResult.missing) || null;
      if (missing?.name) {
        // Open the inline collector; the user re-taps Create after saving.
        collectRequiredField('name');
      } else if (missing?.phone || missing?.phoneVerified) {
        goToPhoneVerification(!!missing?.phoneVerified && !missing?.phone);
      } else {
        showProfileIncompleteDialog();
      }
      return true;
    },
    [collectRequiredField, goToPhoneVerification, showProfileIncompleteDialog]
  );

  return {
    ensureBookingProfileComplete,
    handleProfileIncompleteError,
    showProfileIncompleteDialog,
  };
}

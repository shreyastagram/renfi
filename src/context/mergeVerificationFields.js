/**
 * Merge a jauth `/api/users/me` response into the cached user/profile object.
 *
 * WHY THIS IS ITS OWN MODULE
 *
 * It was an inline closure inside `refreshVerificationStatus`, which meant the only
 * way to exercise it was to mount the whole provider with AsyncStorage, Keychain and
 * axios mocked. It is pure, it decides whether a user is verified, and it runs on
 * EVERY app foreground — it deserves direct tests. Same reasoning as
 * `resolveThemeName` and `screenEdges`.
 *
 * TWO PROPERTIES THIS MUST KEEP
 *
 * 1. **Absent is not false.** The previous version read `data.isEmailVerified ?? false`,
 *    so a response that simply omitted the field downgraded a verified user to
 *    unverified — re-prompting them to verify, and for providers re-triggering the
 *    "verify all" gate on Add Services. `getCurrentUser` returns `response.data`
 *    verbatim with no schema check, so a backend shape change is all it would take.
 *    An explicit `false` from the server still wins: `??` only falls through on
 *    null/undefined, so a genuine un-verification is still honoured. This now matches
 *    how every neighbouring field already behaved (`hasPassword ?? prev?.hasPassword`).
 *
 * 2. **Object identity survives a no-op merge.** Every foreground calls this. Returning
 *    a fresh object when nothing changed rebuilt user+profile each time and re-ran
 *    every consumer keyed on them — the jobs-screen reload loop and the dashboard
 *    churn on low-end devices. Callers rely on `prev` coming back unchanged.
 */

/**
 * @param {Object|null} prev - the cached user or profile
 * @param {Object} data - the raw jauth response body
 * @returns {Object} `prev` itself when nothing changed, otherwise a merged copy
 */
export const mergeVerificationFields = (prev, data) => {
  const next = {
    ...prev,
    email: data.email || prev?.email,
    fullName: data.fullName || prev?.fullName,
    phone: data.phoneNumber || prev?.phone, // Map phoneNumber to phone
    // `?? prev ?? default` — an omitted field keeps what we already knew; an
    // explicit value from the server always wins. See property 1 above.
    isEmailVerified: data.isEmailVerified ?? prev?.isEmailVerified ?? false,
    isPhoneVerified: data.isPhoneVerified ?? prev?.isPhoneVerified ?? false,
    isActive: data.isActive ?? prev?.isActive ?? true,
    role: data.role || prev?.role,
    hasPassword: data.hasPassword ?? prev?.hasPassword,
  };
  const unchanged =
    prev &&
    next.email === prev.email &&
    next.fullName === prev.fullName &&
    next.phone === prev.phone &&
    next.isEmailVerified === prev.isEmailVerified &&
    next.isPhoneVerified === prev.isPhoneVerified &&
    next.isActive === prev.isActive &&
    next.role === prev.role &&
    next.hasPassword === prev.hasPassword;
  return unchanged ? prev : next;
};

export default mergeVerificationFields;

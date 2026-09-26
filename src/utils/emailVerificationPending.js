/**
 * V5 — remember that a verification email is waiting.
 *
 * THE PROBLEM
 *
 * Tapping "Verify" on the email row fires a link and shows a one-shot dialog. The
 * user then leaves the app to go read that email — which is the whole point — and
 * when they come back the row looks exactly as it did before they tapped. Nothing
 * says a link is already in their inbox, so the natural move is to tap again, which
 * the backend rate-limits with "please wait 85 seconds". The app taught them to do
 * the thing it then refuses.
 *
 * So the sent state has to outlive the screen, the navigation stack and the process.
 *
 * WHY IT IS KEYED BY EMAIL, NOT JUST USER
 *
 * A pending link belongs to the ADDRESS it was sent to. If the user changes their
 * email, the old link is irrelevant and the row must go back to "Verify" — keying on
 * the address makes that automatic instead of something a caller has to remember to
 * clear.
 *
 * The TTL matches how long a verification link is worth chasing. It self-heals: even
 * if a clear is somehow missed, the row recovers on its own within a day rather than
 * telling the user forever that mail is on its way.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** A verification link is not worth chasing after this long. */
export const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

const keyFor = (userId) => `emailVerifyPending:${userId}`;

/**
 * Pure core, so the expiry and address-match rules are testable without storage.
 *
 * @param {{email: string, sentAt: number}|null} record - what was stored
 * @param {string} email - the address shown on the row right now
 * @param {number} now - epoch ms
 */
export const isPending = (record, email, now) => {
  if (!record || !record.email || !email) return false;
  if (record.email.toLowerCase() !== String(email).toLowerCase()) return false;
  if (typeof record.sentAt !== 'number' || !Number.isFinite(record.sentAt)) return false;
  const age = now - record.sentAt;
  // A negative age means the clock moved backwards (timezone change, NTP correction).
  // Treat it as pending rather than expired: a link probably IS in flight, and the
  // worse failure is telling the user to send another one the backend will refuse.
  if (age < 0) return true;
  return age < PENDING_TTL_MS;
};

/** Record that a link was just sent to `email`. Best-effort — never throws. */
export const markSent = async (userId, email, now = Date.now()) => {
  if (!userId || !email) return;
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify({ email, sentAt: now }));
  } catch (e) {
    // Storage unavailable — the badge just will not survive a restart. Not worth
    // failing a send the user already made.
  }
};

/** Is a link still outstanding for this address? Never throws. */
export const readPending = async (userId, email, now = Date.now()) => {
  if (!userId || !email) return false;
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    return isPending(raw ? JSON.parse(raw) : null, email, now);
  } catch (e) {
    return false;
  }
};

/** Called once the address is verified, or when it changes. Never throws. */
export const clearPending = async (userId) => {
  if (!userId) return;
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch (e) {
    // Same as above — the TTL will expire it anyway.
  }
};

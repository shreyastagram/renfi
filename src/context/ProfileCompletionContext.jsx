/**
 * ProfileCompletionContext
 *
 * Mounts ONE inline field-collector modal at the app root and exposes an
 * imperative, awaitable API:
 *
 *   const { collectRequiredField } = useProfileCompletion();
 *   const ok = await collectRequiredField('name'); // true = saved, false = cancelled/failed
 *
 * Modeled on DialogContext (single overlay at root, opened via context). Used
 * by useBookingProfileGate so a customer can add a missing REQUIRED field
 * (currently: name) WITHOUT leaving the booking flow — their selected service
 * is preserved because nothing navigates.
 *
 * Mount once, INSIDE AppProvider + LanguageProvider (the modal reads useApp /
 * useLanguage) and under SafeAreaProvider (for the bottom inset). The RN Modal
 * renders in its own window, so it overlays every screen regardless of depth.
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InlineFieldCollectorModal from '../components/InlineFieldCollectorModal';

const ProfileCompletionContext = createContext(null);

export const ProfileCompletionProvider = ({ children }) => {
  const [request, setRequest] = useState(null); // { field } | null
  const resolverRef = useRef(null);
  const insets = useSafeAreaInsets();

  /**
   * Open the collector for `field` and resolve to true (saved) / false
   * (cancelled or failed). Returns a Promise the caller can await.
   */
  const collectRequiredField = useCallback((field) => {
    return new Promise((resolve) => {
      // Guard: if one is somehow already open, resolve it false first so no
      // awaiting caller is left dangling.
      if (resolverRef.current) {
        try {
          resolverRef.current(false);
        } catch (e) {
          /* noop */
        }
      }
      resolverRef.current = resolve;
      setRequest({ field: field || 'name' });
    });
  }, []);

  const finish = useCallback((ok) => {
    setRequest(null); // unmounts the modal (nothing mounted when idle)
    const resolve = resolverRef.current;
    resolverRef.current = null;
    if (resolve) {
      try {
        resolve(!!ok);
      } catch (e) {
        /* noop */
      }
    }
  }, []);

  const value = useMemo(() => ({ collectRequiredField }), [collectRequiredField]);

  return (
    <ProfileCompletionContext.Provider value={value}>
      {children}
      {request ? (
        <InlineFieldCollectorModal
          field={request.field}
          bottomInset={insets.bottom}
          onDone={finish}
        />
      ) : null}
    </ProfileCompletionContext.Provider>
  );
};

/**
 * Access the collector. Safe no-op fallback (resolves false) when used outside
 * the provider, so callers never crash.
 */
export const useProfileCompletion = () => {
  const ctx = useContext(ProfileCompletionContext);
  if (!ctx) {
    return { collectRequiredField: async () => false };
  }
  return ctx;
};

export default ProfileCompletionContext;

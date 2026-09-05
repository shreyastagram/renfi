/**
 * SupportContext
 *
 * Mounts ONE Help & Support bottom-sheet (SupportSheet) at the app root and
 * exposes `openSupport(userType)`. Mirrors DialogContext / ProfileCompletion:
 * a single overlay, opened imperatively from anywhere via context — so every
 * Help entry point (home icons, Settings row, drawer, booking detail) shows the
 * identical iconized sheet.
 *
 * Mount once, INSIDE AppProvider + LanguageProvider + DialogProvider (the sheet
 * reads useApp/useLanguage/useDialog) and under SafeAreaProvider.
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SupportSheet from '../components/SupportSheet';

const SupportContext = createContext(null);

export const SupportProvider = ({ children }) => {
  const [request, setRequest] = useState(null); // { userType } | null
  const insets = useSafeAreaInsets();

  const openSupport = useCallback((userType) => {
    setRequest({ userType: userType || 'user' });
  }, []);

  const close = useCallback(() => setRequest(null), []);

  const value = useMemo(() => ({ openSupport }), [openSupport]);

  return (
    <SupportContext.Provider value={value}>
      {children}
      {request ? (
        <SupportSheet
          userType={request.userType}
          bottomInset={insets.bottom}
          onClose={close}
        />
      ) : null}
    </SupportContext.Provider>
  );
};

export const useSupport = () => {
  const ctx = useContext(SupportContext);
  if (!ctx) {
    return { openSupport: () => {} };
  }
  return ctx;
};

export default SupportContext;

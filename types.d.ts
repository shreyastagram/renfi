/**
 * Type declarations for JSX modules
 * 
 * This allows TypeScript to import .jsx files without errors
 */

declare module './navigation/RootNavigator.jsx' {
  import { ComponentType } from 'react';
  const RootNavigator: ComponentType<any>;
  export default RootNavigator;
}

declare module './context/AppContext.js' {
  import { ComponentType, Context } from 'react';
  
  export const AppProvider: ComponentType<{ children: React.ReactNode }>;
  export function useApp(): {
    isAuthenticated: boolean;
    isAuthLoading: boolean;
    userType: string | null;
    userData: any;
    loginUser: (userData: any, token: string) => Promise<void>;
    loginProvider: (providerData: any, token: string) => Promise<void>;
    loginWithGoogle: (googleResponse: any) => Promise<{ isNewUser: boolean }>;
    logout: () => Promise<void>;
    userLocation: number[] | null;
    setUserLocation: (location: number[] | null) => void;
    updateUserLocation: (location: number[]) => void;
    isLocationLoading: boolean;
    setIsLocationLoading: (loading: boolean) => void;
    selectedService: any;
    selectService: (service: any) => void;
    isSocketConnected: boolean;
    userId: string;
    realUserId: string | null;
    requestStatus: string;
    setRequestStatus: (status: string) => void;
    currentRequest: any;
    acceptedProvider: any;
    setAcceptedProvider: (provider: any) => void;
    currentRequestId: string | null;
    sendServiceRequest: () => boolean;
    cancelRequest: () => void;
    resetRequest: () => void;
    clearAppState: () => void;
    isWelcomeShown: boolean;
    setIsWelcomeShown: (shown: boolean) => void;
  };
}

declare module '*.jsx' {
  import { ComponentType } from 'react';
  const Component: ComponentType<any>;
  export default Component;
}

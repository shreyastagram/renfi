import React from 'react';
import { View, Text, StyleSheet, Linking} from 'react-native';
import TouchableOpacity from './TouchableOpacity';
import { getResolvedThemeOutsideProvider } from '../theme/lastResolvedTheme.js';

let crashlytics = null;
try {
  crashlytics = require('@react-native-firebase/crashlytics').default;
} catch (e) {
  // Crashlytics not installed yet — graceful fallback
}

// Keyed by theme name, mirroring useThemedStyles. A crash screen renders once, but
// "Try Again" can fail again, and rebuilding a StyleSheet per attempt is waste.
const sheetCache = new Map();
const stylesFor = (theme) => {
  if (!sheetCache.has(theme.name)) sheetCache.set(theme.name, build(theme.colors));
  return sheetCache.get(theme.name);
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (__DEV__) {
      console.error('[ErrorBoundary] Caught error:', error);
      console.error('[ErrorBoundary] Component stack:', errorInfo?.componentStack);
    }

    if (crashlytics) {
      try {
        crashlytics().recordError(error);
        if (errorInfo?.componentStack) {
          crashlytics().log(errorInfo.componentStack);
        }
      } catch (e) {
        // Crashlytics reporting failed — ignore
      }
    }
  }

  handleRestart = () => {
    // Increment resetKey to force a full remount of the entire child tree
    this.setState(prev => ({
      hasError: false,
      error: null,
      resetKey: prev.resetKey + 1,
    }));
  };

  handleContactSupport = () => {
    Linking.openURL('mailto:contact@fixhomi.com?subject=App%20Error%20Report').catch(() => {
      Linking.openURL('https://wa.me/918446385312?text=App%20Error%20Report');
    });
  };

  render() {
    if (this.state.hasError) {
      // Read without context: this component sits ABOVE ThemeProvider so it can catch
      // a crash inside it, which also means it cannot subscribe to it.
      const styles = stylesFor(getResolvedThemeOutsideProvider());
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.icon}>{'\u26A0\uFE0F'}</Text>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              The app encountered an unexpected error. Please try again.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={this.handleRestart}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Try Again"
            >
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={this.handleContactSupport}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Contact Support"
            >
              <Text style={styles.secondaryButtonText}>Contact Support</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // key={resetKey} forces a full unmount+remount of children when reset
    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}

const build = (C) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.bg,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    content: {
      alignItems: 'center',
      maxWidth: 340,
      width: '100%',
    },
    icon: {
      fontSize: 56,
      marginBottom: 24,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: C.textPrimary,
      marginBottom: 12,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 36,
    },
    primaryButton: {
      backgroundColor: C.altBlueIndigo,
      paddingVertical: 14,
      paddingHorizontal: 32,
      borderRadius: 12,
      width: '100%',
      alignItems: 'center',
      marginBottom: 12,
    },
    primaryButtonText: {
      color: C.onAltBlueIndigo,
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      paddingVertical: 14,
      paddingHorizontal: 32,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: C.altBlueIndigo,
      width: '100%',
      alignItems: 'center',
    },
    secondaryButtonText: {
      color: C.altBlueIndigo,
      fontSize: 16,
      fontWeight: '600',
    },
  });

export default ErrorBoundary;

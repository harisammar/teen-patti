import * as Sentry from '@sentry/react-native';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, LogBox } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { onAuthStateChanged } from './src/services/authService';
import { useAuthStore } from './src/store/authStore';
import { getUserProfile } from './src/services/authService';

Sentry.init({
  dsn: 'https://5c32497eee0cb8b77231afa633d07737@o4511441755111424.ingest.de.sentry.io/4511441759174736',
  tracesSampleRate: 1.0,
  enabled: !__DEV__,
});

// expo-firebase-recaptcha uses defaultProps on function components, which React 18
// warns about. It's a library bug — suppress it so it doesn't hijack the UI.
LogBox.ignoreLogs([
  'FirebaseRecaptcha: Support for defaultProps',
  'Support for defaultProps will be removed',
]);

function App() {
  const { setUser, clearUser, setLoading } = useAuthStore();

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          if (profile) {
            setUser(profile);
          } else {
            clearUser();
          }
        } catch {
          clearUser();
        }
      } else {
        clearUser();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#1a4a2e" />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default Sentry.wrap(App);

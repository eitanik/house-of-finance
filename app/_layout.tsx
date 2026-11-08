import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../src/context/AuthContext';
import { GameProvider } from '../src/context/GameContext';
import { useAuth } from '../src/context/AuthContext';
import { ensureFirestoreOnline, initFirebaseAnalytics } from '../src/firebase/config';

function RootNav() {
  const { uid, displayName } = useAuth();
  return (
    <GameProvider uid={uid} displayName={displayName}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="player/[uid]" options={{ headerShown: true, title: 'תיק שחקן' }} />
      </Stack>
    </GameProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void ensureFirestoreOnline();
    void initFirebaseAnalytics();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNav />
        <StatusBar style="light" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

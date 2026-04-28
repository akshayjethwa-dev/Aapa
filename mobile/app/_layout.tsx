import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/store/authStore';
import { useMarketWebSocket } from '../src/hooks/useMarketWebSocket';

export default function RootLayout() {
  const { isHydrating, hydrateFromStorage } = useAuthStore();

  useEffect(() => { hydrateFromStorage(); }, []);

  // Inject the market WebSocket lifecycle hook at root level.
  // Internally checks for a valid Upstox token before opening a connection.
  useMarketWebSocket();

  if (isHydrating) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: '#0f172a' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: 'bold' } }}>
        <Stack.Screen name="index" options={{ title: 'Aapa Capital' }} />
        <Stack.Screen name="auth" options={{ title: 'Connect Broker', headerBackVisible: false }} />
        <Stack.Screen name="oauth-callback" options={{ headerShown: false, presentation: 'transparentModal' }} />
      </Stack>
    </>
  );
}
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/authStore';
import { useMarketWebSocket } from '../src/hooks/useMarketWebSocket';

export default function RootLayout() {
  const { isHydrating, hydrateFromStorage } = useAuthStore();

  useEffect(() => { hydrateFromStorage(); }, []);

  useMarketWebSocket();

  if (isHydrating) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0f1e' }}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="stock-detail/[symbol]"
            options={{ headerShown: true, headerStyle: { backgroundColor: '#0a0f1e' }, headerTintColor: '#fff', headerTitle: 'Stock Detail' }}
          />
          <Stack.Screen
            name="fo-detail/[symbol]"
            options={{ headerShown: true, headerStyle: { backgroundColor: '#0a0f1e' }, headerTintColor: '#fff', headerTitle: 'F&O Detail' }}
          />
          <Stack.Screen
            name="order-window/[symbol]"
            options={{ presentation: 'modal', headerShown: true, headerStyle: { backgroundColor: '#0a0f1e' }, headerTintColor: '#fff', headerTitle: 'Place Order' }}
          />
          <Stack.Screen name="oauth-callback" options={{ headerShown: false, presentation: 'transparentModal' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
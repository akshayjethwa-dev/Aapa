import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';

export default function AuthLayout() {
  const { supabaseToken, isHydrating } = useAuthStore();

  useEffect(() => {
    if (!isHydrating && supabaseToken) {
      router.replace('/(tabs)/dashboard');
    }
  }, [isHydrating, supabaseToken]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
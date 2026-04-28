import { useEffect } from 'react';
import { router } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/store/authStore';

export default function IndexRedirect() {
  const { supabaseToken, isHydrating } = useAuthStore();

  useEffect(() => {
    if (isHydrating) return;
    if (supabaseToken) {
      router.replace('/(tabs)/dashboard');
    } else {
      router.replace('/(auth)/login');
    }
  }, [isHydrating, supabaseToken]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0f1e', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#3b82f6" />
    </View>
  );
}
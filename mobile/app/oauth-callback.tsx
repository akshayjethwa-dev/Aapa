import { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiClient } from '../src/api/client';
import { useAuthStore } from '../src/store/authStore';

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; refresh_token?: string; error?: string }>();
  const { setUpstoxTokens, setConnectingUpstox } = useAuthStore();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    handleCallback();
  }, []);

  const handleCallback = async () => {
    const { token, refresh_token, error } = params;

    if (error) {
      setConnectingUpstox(false);
      Alert.alert('Connection Failed', error.replace(/_/g, ' '), [
        { text: 'OK', onPress: () => router.replace('/auth') },
      ]);
      return;
    }

    if (!token) {
      setConnectingUpstox(false);
      Alert.alert('Connection Failed', 'No access token received.', [
        { text: 'OK', onPress: () => router.replace('/auth') },
      ]);
      return;
    }

    try {
      // Belt-and-suspenders save (backend /auth/callback already did this as an upsert)
      await apiClient.post('/api/auth/uptox/save-token', {
        access_token: token,
        refresh_token: refresh_token ?? '',
      });
    } catch (err) {
      console.warn('[OAuthCallback] save-token API call failed, continuing with local save:', err);
    }

    // Persist to SecureStore + update Zustand state
    await setUpstoxTokens(token, refresh_token ?? '');
    router.replace('/');
  };

  return (
    <View className="flex-1 items-center justify-center bg-slate-900">
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text className="text-slate-400 text-base mt-4">Connecting your Upstox account...</Text>
    </View>
  );
}
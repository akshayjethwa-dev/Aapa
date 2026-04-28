import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { apiClient } from '../src/api/client';
import { useAuthStore } from '../src/store/authStore';

WebBrowser.warmUpAsync(); // Pre-warm browser on Android for instant open

export default function AuthScreen() {
  const { isConnectingUpstox, setConnectingUpstox, isUpstoxConnected } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const handleConnectUpstox = async () => {
    setError(null);
    setConnectingUpstox(true);
    try {
      // 1. Get the OAuth URL (backend embeds user JWT as `state`)
      const { data } = await apiClient.get<{ url: string }>('/api/auth/uptox/url');
      if (!data.url) throw new Error('Could not get Upstox login URL.');

      // 2. Open in secure in-app browser — closes automatically on deep link redirect
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        'aapa://oauth-callback'
      );

      if (result.type === 'cancel' || result.type === 'dismiss') {
        setConnectingUpstox(false);
      }
      // If type === 'success', Expo Router navigates to /oauth-callback automatically
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setConnectingUpstox(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-slate-900 p-6">
      <View className="items-center mb-12">
        <Text className="text-white text-4xl font-bold tracking-tight">Aapa Capital</Text>
        <Text className="text-slate-400 text-base mt-2">Connect your broker to start trading</Text>
      </View>

      <View className="w-full max-w-sm bg-slate-800 rounded-2xl p-6 border border-slate-700">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-lg font-semibold">Upstox</Text>
          <View className={`px-3 py-1 rounded-full ${isUpstoxConnected ? 'bg-green-900/50' : 'bg-slate-700'}`}>
            <Text className={`text-xs font-bold uppercase tracking-wider ${isUpstoxConnected ? 'text-green-400' : 'text-slate-400'}`}>
              {isUpstoxConnected ? 'Connected' : 'Not Connected'}
            </Text>
          </View>
        </View>

        <Text className="text-slate-400 text-sm mb-6 leading-5">
          Securely link your Upstox account to place orders and view live portfolio data.
        </Text>

        {error && (
          <View className="bg-red-900/40 border border-red-700 rounded-xl p-3 mb-4">
            <Text className="text-red-400 text-sm text-center">{error}</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handleConnectUpstox}
          disabled={isConnectingUpstox || isUpstoxConnected}
          activeOpacity={0.8}
          className={`py-4 rounded-xl items-center justify-center flex-row ${
            isUpstoxConnected ? 'bg-green-800' : isConnectingUpstox ? 'bg-blue-700' : 'bg-blue-600 active:bg-blue-700'
          }`}
        >
          {isConnectingUpstox ? (
            <>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text className="text-white font-semibold text-base ml-3">Opening Upstox Login...</Text>
            </>
          ) : isUpstoxConnected ? (
            <Text className="text-green-200 font-semibold text-base">✓ Upstox Connected</Text>
          ) : (
            <Text className="text-white font-semibold text-base">Connect Upstox</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text className="text-slate-500 text-xs mt-8 text-center px-4">
        Tokens are encrypted and saved on this device using the system keychain.
      </Text>
    </View>
  );
}
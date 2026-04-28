// mobile/src/api/client.ts

import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../store/authStore';

// ─── Platform-safe storage adapter ─────────────────────────────────────────
// expo-secure-store is native-only. On web we use sessionStorage / in-memory.
const webMemory: Record<string, string> = {};

const storage = {
  getItemAsync: async (key: string): Promise<string | null> => {
    if (Platform.OS !== 'web') {
      return SecureStore.getItemAsync(key);
    }
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(key);
    }
    return webMemory[key] ?? null;
  },
};
// ───────────────────────────────────────────────────────────────────────────

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://aapa-production.up.railway.app';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

apiClient.interceptors.request.use(async (config) => {
  try {
    const supabaseToken = await storage.getItemAsync(SECURE_KEYS.SUPABASE_TOKEN);
    if (supabaseToken) {
      config.headers.Authorization = `Bearer ${supabaseToken}`;
    }

    const upstoxToken = await storage.getItemAsync(SECURE_KEYS.UPSTOX_ACCESS_TOKEN);
    if (upstoxToken && config.url?.includes('/broker/upstox')) {
      config.headers['X-Upstox-Token'] = upstoxToken;
    }
  } catch (error) {
    console.error('[apiClient] Error attaching tokens:', error);
  }
  return config;
});
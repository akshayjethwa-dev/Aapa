import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../store/authStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

apiClient.interceptors.request.use(async (config) => {
  try {
    const supabaseToken = await SecureStore.getItemAsync(SECURE_KEYS.SUPABASE_TOKEN);
    if (supabaseToken) {
      config.headers.Authorization = `Bearer ${supabaseToken}`;
    }

    const upstoxToken = await SecureStore.getItemAsync(SECURE_KEYS.UPSTOX_ACCESS_TOKEN);
    if (upstoxToken && config.url?.includes('/broker/upstox')) {
      config.headers['X-Upstox-Token'] = upstoxToken;
    }
  } catch (error) {
    console.error('[apiClient] Error attaching tokens:', error);
  }
  return config;
});
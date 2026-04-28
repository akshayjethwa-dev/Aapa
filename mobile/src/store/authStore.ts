import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// ─── Platform-safe storage adapter ─────────────────────────────────────────
const webMemory: Record<string, string> = {};

const storage = {
  getItemAsync: async (key: string): Promise<string | null> => {
    if (Platform.OS !== 'web') return SecureStore.getItemAsync(key);
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(key);
    }
    return webMemory[key] ?? null;
  },

  setItemAsync: async (key: string, value: string): Promise<void> => {
    if (Platform.OS !== 'web') return SecureStore.setItemAsync(key, value);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(key, value);
    } else {
      webMemory[key] = value;
    }
  },

  deleteItemAsync: async (key: string): Promise<void> => {
    if (Platform.OS !== 'web') return SecureStore.deleteItemAsync(key);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(key);
    } else {
      delete webMemory[key];
    }
  },
};
// ───────────────────────────────────────────────────────────────────────────

export const SECURE_KEYS = {
  SUPABASE_TOKEN: 'supabase_token',
  USER_ID: 'user_id',
  UPSTOX_ACCESS_TOKEN: 'upstox_access_token',
  UPSTOX_REFRESH_TOKEN: 'upstox_refresh_token',
} as const;

interface AuthState {
  supabaseToken: string | null;
  userId: string | null;
  isUpstoxConnected: boolean;
  upstoxAccessToken: string | null;
  isHydrating: boolean;
  isConnectingUpstox: boolean;

  hydrateFromStorage: () => Promise<void>;
  setSupabaseSession: (token: string, userId: string) => Promise<void>;
  setUpstoxTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  clearUpstoxTokens: () => Promise<void>;
  logout: () => Promise<void>;
  setConnectingUpstox: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  supabaseToken: null,
  userId: null,
  isUpstoxConnected: false,
  upstoxAccessToken: null,
  isHydrating: true,
  isConnectingUpstox: false,

  hydrateFromStorage: async () => {
    try {
      const [supabaseToken, userId, upstoxAccessToken] = await Promise.all([
        storage.getItemAsync(SECURE_KEYS.SUPABASE_TOKEN),
        storage.getItemAsync(SECURE_KEYS.USER_ID),           // ✅ read
        storage.getItemAsync(SECURE_KEYS.UPSTOX_ACCESS_TOKEN),
      ]);
      set({
        supabaseToken: supabaseToken ?? null,
        userId: userId ?? null,                               // ✅ FIX: now sets userId in store
        isUpstoxConnected: !!upstoxAccessToken,
        upstoxAccessToken: upstoxAccessToken ?? null,
        isHydrating: false,
      });
    } catch (error) {
      console.error('[authStore] hydrateFromStorage error:', error);
      set({ isHydrating: false });
    }
  },

  setSupabaseSession: async (token: string, userId: string) => {
    await Promise.all([
      storage.setItemAsync(SECURE_KEYS.SUPABASE_TOKEN, token),
      storage.setItemAsync(SECURE_KEYS.USER_ID, userId),     // ✅ FIX: persists userId to SecureStore
    ]);
    set({ supabaseToken: token, userId });
  },

  setUpstoxTokens: async (accessToken: string, refreshToken: string) => {
    await Promise.all([
      storage.setItemAsync(SECURE_KEYS.UPSTOX_ACCESS_TOKEN, accessToken),
      storage.setItemAsync(SECURE_KEYS.UPSTOX_REFRESH_TOKEN, refreshToken),
    ]);
    set({
      isUpstoxConnected: true,
      upstoxAccessToken: accessToken,
      isConnectingUpstox: false,
    });
  },

  clearUpstoxTokens: async () => {
    await Promise.all([
      storage.deleteItemAsync(SECURE_KEYS.UPSTOX_ACCESS_TOKEN),
      storage.deleteItemAsync(SECURE_KEYS.UPSTOX_REFRESH_TOKEN),
    ]);
    set({ isUpstoxConnected: false, upstoxAccessToken: null });
  },

  logout: async () => {
    await Promise.all(
      Object.values(SECURE_KEYS).map((k) => storage.deleteItemAsync(k))
    );
    set({
      supabaseToken: null,
      userId: null,
      isUpstoxConnected: false,
      upstoxAccessToken: null,
    });
  },

  setConnectingUpstox: (value: boolean) => set({ isConnectingUpstox: value }),
}));
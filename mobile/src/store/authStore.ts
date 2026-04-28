import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export const SECURE_KEYS = {
  SUPABASE_TOKEN: 'supabase_token',
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

export const useAuthStore = create<AuthState>((set, get) => ({
  supabaseToken: null,
  userId: null,
  isUpstoxConnected: false,
  upstoxAccessToken: null,
  isHydrating: true,
  isConnectingUpstox: false,

  hydrateFromStorage: async () => {
    try {
      const [supabaseToken, upstoxAccessToken] = await Promise.all([
        SecureStore.getItemAsync(SECURE_KEYS.SUPABASE_TOKEN),
        SecureStore.getItemAsync(SECURE_KEYS.UPSTOX_ACCESS_TOKEN),
      ]);
      set({
        supabaseToken: supabaseToken ?? null,
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
    await SecureStore.setItemAsync(SECURE_KEYS.SUPABASE_TOKEN, token);
    set({ supabaseToken: token, userId });
  },

  setUpstoxTokens: async (accessToken: string, refreshToken: string) => {
    await Promise.all([
      SecureStore.setItemAsync(SECURE_KEYS.UPSTOX_ACCESS_TOKEN, accessToken),
      SecureStore.setItemAsync(SECURE_KEYS.UPSTOX_REFRESH_TOKEN, refreshToken),
    ]);
    set({ isUpstoxConnected: true, upstoxAccessToken: accessToken, isConnectingUpstox: false });
  },

  clearUpstoxTokens: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(SECURE_KEYS.UPSTOX_ACCESS_TOKEN),
      SecureStore.deleteItemAsync(SECURE_KEYS.UPSTOX_REFRESH_TOKEN),
    ]);
    set({ isUpstoxConnected: false, upstoxAccessToken: null });
  },

  logout: async () => {
    await Promise.all(Object.values(SECURE_KEYS).map((k) => SecureStore.deleteItemAsync(k)));
    set({ supabaseToken: null, userId: null, isUpstoxConnected: false, upstoxAccessToken: null });
  },

  setConnectingUpstox: (value: boolean) => set({ isConnectingUpstox: value }),
}));
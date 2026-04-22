import { create } from 'zustand';
import { apiClient } from '../api/client';

// ── New types for profile completeness feature ────────────────────────────────
export type KycStatus   = 'not_started' | 'pending' | 'approved' | 'rejected';
export type RiskProfile = 'conservative' | 'moderate' | 'aggressive' | null;
export type SegmentCode = 'EQUITY' | 'FO' | 'COMMODITY' | 'CURRENCY';

export interface User {
  id: number;
  email: string;
  role: string;                          // 'admin' | 'user' | 'pre-onboarding'
  balance: number;
  is_uptox_connected?: boolean;
  has_upstox_account?: boolean;
  onboarding_step?: number;              // 0-4
  is_onboarding_complete?: boolean;
  first_login_completed_at?: string | null;
  // ── Profile completeness fields ──────────────────────────────────────────
  kyc_status?: KycStatus;
  risk_profile?: RiskProfile;
  segments_enabled?: SegmentCode[];
  profile_completeness?: number;         // 0-100, derived on backend
}

interface AuthState {
  user: User | null;
  token: string | null;
  isWsConnected: boolean;
  setIsWsConnected: (status: boolean) => void;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: (() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); }
    catch (e) { console.error('Failed to parse user from localStorage', e); return null; }
  })(),
  token: (() => {
    try { return localStorage.getItem('token'); }
    catch (e) { console.error('Failed to get token from localStorage', e); return null; }
  })(),
  isWsConnected: false,
  setIsWsConnected: (status) => set({ isWsConnected: status }),
  setAuth: (user, token) => {
    try {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', token);
    } catch (e) { console.error('Failed to save auth to localStorage', e); }
    set({ user, token });
  },
  logout: async () => {
    try {
      await apiClient.post('/api/auth/logout').catch(() => {});
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    } catch (e) { console.error('Failed to remove auth from localStorage', e); }
    set({ user: null, token: null, isWsConnected: false });
    window.location.href = '/';
  },
  refreshUser: async () => {
    const { token, setAuth } = get();
    if (!token) return;
    try {
      const res = await apiClient.get('/api/user/profile');
      if (res.data?.id) setAuth(res.data, token);
    } catch (e) { console.error('Failed to refresh user profile', e); }
  },
}));
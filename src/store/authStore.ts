import { create } from 'zustand';

interface User {
  id: number;
  email: string;
  role: string;
  balance: number;
  is_uptox_connected?: boolean;
  is_angelone_connected?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch (e) {
      console.error("Failed to parse user from localStorage", e);
      return null;
    }
  })(),
  token: (() => {
    try {
      return localStorage.getItem('token');
    } catch (e) {
      console.error("Failed to get token from localStorage", e);
      return null;
    }
  })(),
  setAuth: (user, token) => {
    try {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', token);
    } catch (e) {
      console.error("Failed to save auth to localStorage", e);
    }
    set({ user, token });
  },
  logout: () => {
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    } catch (e) {
      console.error("Failed to remove auth from localStorage", e);
    }
    set({ user: null, token: null });
  },
}));

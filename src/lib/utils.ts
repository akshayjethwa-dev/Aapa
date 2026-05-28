// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useMarketDataStore } from '../store/marketDataStore';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Dynamically checks if the Indian Stock Market is currently open
 * by reading the live Upstox API status stored in Zustand.
 */
export const isMarketOpen = (): boolean => {
  return useMarketDataStore.getState().isMarketOpen;
};
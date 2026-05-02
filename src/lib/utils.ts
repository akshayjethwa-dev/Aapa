import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
 * Checks if the Indian Stock Market is currently open.
 * Standard hours: Mon-Fri, 9:15 AM to 3:30 PM IST.
 */
export const isMarketOpen = (): boolean => {
  const now = new Date();
  // Convert current time to IST
  const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  
  const day = istTime.getDay();
  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();

  // Market is closed on Weekends (0 = Sunday, 6 = Saturday)
  if (day === 0 || day === 6) return false;

  const currentTimeInMinutes = hours * 60 + minutes;
  const marketOpenMinutes = 9 * 60 + 15; // 9:15 AM
  const marketCloseMinutes = 15 * 60 + 30; // 3:30 PM

  return currentTimeInMinutes >= marketOpenMinutes && currentTimeInMinutes < marketCloseMinutes;
};
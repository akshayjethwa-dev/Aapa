// src/api/client.ts
import axios from 'axios';
import { toast } from 'sonner';

export const apiClient = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- QUEUE MECHANISM FOR FRONTEND ---
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void, reject: (error: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token as string);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

apiClient.interceptors.response.use((response) => {
  return response;
}, async (error) => {
  const originalRequest = error.config;

  if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/')) {
    
    // If a refresh is already in progress, queue this request
    if (isRefreshing) {
      return new Promise(function(resolve, reject) {
        failedQueue.push({ resolve, reject });
      }).then(token => {
        originalRequest.headers['Authorization'] = `Bearer ${token}`;
        return apiClient(originalRequest);
      }).catch(err => {
        return Promise.reject(err);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Trigger the refresh endpoint
      const { data } = await axios.post('/api/auth/refresh', {}, {
        withCredentials: true 
      });

      localStorage.setItem('token', data.token);
      originalRequest.headers['Authorization'] = `Bearer ${data.token}`;
      
      // Resolve all queued requests with the new token
      processQueue(null, data.token);
      
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      toast.error('Session expired. Please log in again.');
      window.location.href = '/login'; 
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }

  // --- GLOBAL ERROR TOASTS ---
  if (error.response && error.response.data && error.response.data.error) {
    if (!(originalRequest.url?.includes('/auth/login') && error.response.status === 401)) {
      toast.error(error.response.data.error);
    }
  } else if (error.request) {
    toast.error('Network error. Please check your connection.');
  } else {
    toast.error('An unexpected error occurred.');
  }

  return Promise.reject(error);
});
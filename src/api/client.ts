import axios from 'axios';
import { toast } from 'sonner';

// Create a configured axios instance
export const apiClient = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to inject the current access token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Add a response interceptor to handle 401s, refresh tokens, and global error toasts
apiClient.interceptors.response.use((response) => {
  return response;
}, async (error) => {
  const originalRequest = error.config;

  // If error is 401, we haven't retried yet, and it's not the login/refresh route
  if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/')) {
    originalRequest._retry = true;

    try {
      // Attempt to refresh the token using the HTTP-only cookie
      const { data } = await axios.post('/api/auth/refresh', {}, {
        withCredentials: true // Important: sends the HTTP-only cookie
      });

      // Save the new access token
      localStorage.setItem('token', data.token);

      // Update the authorization header and retry the original request
      originalRequest.headers['Authorization'] = `Bearer ${data.token}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      // Refresh failed (token expired/invalid). Force logout on the frontend.
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      toast.error('Session expired. Please log in again.');
      window.location.href = '/login'; 
      return Promise.reject(refreshError);
    }
  }

  // --- GLOBAL ERROR TOASTS ---
  if (error.response && error.response.data && error.response.data.error) {
    // Prevent showing generic "Unauthorized" toast on login (handled specifically in Auth.tsx)
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
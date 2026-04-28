import axios from 'axios';

// Point to the Railway backend URL via environment variables
// Add this to your mobile/.env file: EXPO_PUBLIC_API_URL=https://your-aapa-backend.up.railway.app
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Interceptor to inject Supabase and Upstox tokens securely
apiClient.interceptors.request.use(async (config) => {
  try {
    // TODO: Implement SecureStore logic here once expo-secure-store is added
    // const supabaseToken = await SecureStore.getItemAsync('supabase_token');
    // if (supabaseToken) {
    //   config.headers.Authorization = `Bearer ${supabaseToken}`;
    // }

    // Differentiate Upstox proxy calls if your Railway backend requires specific headers
    // const upstoxToken = await SecureStore.getItemAsync('upstox_token');
    // if (upstoxToken && config.url?.includes('/broker/upstox')) {
    //   config.headers['X-Upstox-Token'] = upstoxToken;
    // }
  } catch (error) {
    console.error("Error attaching tokens to request:", error);
  }
  return config;
});
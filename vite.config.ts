import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,  // Removes all console.log statements in production
          drop_debugger: true, // Removes all debugger statements
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      // Allow all hosts in development so AWS Load Balancers don't get blocked
      allowedHosts: true, 
    },
  };
});
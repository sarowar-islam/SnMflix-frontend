import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  let target = 'http://localhost:8080';
  if (env.VITE_API_BASE_URL) {
    try {
      const url = new URL(env.VITE_API_BASE_URL);
      target = `${url.protocol}//${url.host}`;
    } catch (e) {}
  }

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
        },
      },
    },
  };
})

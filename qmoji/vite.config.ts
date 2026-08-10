import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      // Local dev only — the real arcade API's CORS allowlist doesn't
      // cover localhost, so requests go through this same-origin proxy
      // instead of straight to https://qmoji-arcade-api.vercel.app.
      '/arcade-api': {
        target: 'https://qmoji-arcade-api.vercel.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/arcade-api/, '/api'),
      },
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    proxy: {
      // Proxy /api requests to backend during development
      '/api': {
  target: process.env.VITE_API_PROXY || 'http://localhost:5172',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})

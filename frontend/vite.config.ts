import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // GitHub Pages serves the app under /jerome_market_navigator/ in production
  base: process.env.NODE_ENV === 'production' ? '/jerome_market_navigator/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5001,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:8001',
    },
  },
})

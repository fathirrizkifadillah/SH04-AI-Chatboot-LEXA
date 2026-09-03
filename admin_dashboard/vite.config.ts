import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/chat': 'http://localhost:8000',
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true
      },
      '/config': 'http://localhost:8000'
    }
  },
  build: {
    assetsInlineLimit: 100000000,
    rollupOptions: {
      output: {
        manualChunks: undefined,
        entryFileNames: 'admin-dashboard.js',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
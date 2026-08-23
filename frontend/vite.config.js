import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'

export default defineConfig({
  plugins: [
    react(),
    cssInjectedByJsPlugin(),
  ],
  build: {
    assetsInlineLimit: 100000000, // 100MB to inline all assets
    rollupOptions: {
      output: {
        manualChunks: undefined,
        entryFileNames: 'lexa-widget.js',
      },
    },
  },
})

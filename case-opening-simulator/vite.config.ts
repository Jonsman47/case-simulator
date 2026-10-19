import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { pwaOptions } from './pwa.config'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        manualChunks(id) {
          if (id.includes('/src/data/generated/skins.generated')) return 'catalog-skins'
          if (id.includes('/src/data/generated/skinPrices.generated')) return 'catalog-prices'
          if (id.includes('/src/data/generated/patternPercentages.generated')) return 'pattern-lookups'
          if (!id.includes('/node_modules/')) return undefined
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'vendor-react'
          if (id.includes('/node_modules/lucide-react/')) return 'vendor-icons'
          if (id.includes('/node_modules/react-window/')) return 'vendor-virtual'
          if (id.includes('/node_modules/workbox-')) return 'vendor-pwa'
          return undefined
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA(pwaOptions),
  ],
  test: {
    exclude: ['e2e/**', 'node_modules/**'],
  },
})

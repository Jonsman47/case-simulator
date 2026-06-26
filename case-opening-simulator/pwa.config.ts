import type { VitePWAOptions } from 'vite-plugin-pwa'

export const pwaThemeColor = '#0f172a'

export const pwaCoreAssets = [
  'favicon.svg',
  'icons.svg',
  'assets/placeholder.png',
  'sounds/case-opening.mp3',
] as const

export const pwaCacheNames = {
  appShell: 'case-opening-app-shell-v1',
  cs2Images: 'case-opening-cs2-images-v1',
  sounds: 'case-opening-sounds-v1',
} as const

export const pwaOptions: Partial<VitePWAOptions> = {
  includeAssets: [...pwaCoreAssets],
  manifest: {
    background_color: '#070b10',
    description: 'A browser-based CS-style case opening simulator with inventory, market, automation, and progression systems.',
    display: 'standalone',
    icons: [
      {
        sizes: 'any',
        src: 'favicon.svg',
        type: 'image/svg+xml',
      },
      {
        purpose: 'any maskable',
        sizes: 'any',
        src: 'icons.svg',
        type: 'image/svg+xml',
      },
    ],
    name: 'Case Opening Simulator',
    scope: './',
    short_name: 'Case Sim',
    start_url: './',
    theme_color: pwaThemeColor,
  },
  registerType: 'prompt',
  workbox: {
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    globIgnores: ['**/assets/cs2/**'],
    globPatterns: ['**/*.{js,css,html,webmanifest,svg,png,mp3,wav}'],
    maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
    navigateFallback: 'index.html',
    runtimeCaching: [
      {
        handler: 'CacheFirst',
        options: {
          cacheName: pwaCacheNames.cs2Images,
          cacheableResponse: {
            statuses: [0, 200],
          },
          expiration: {
            maxAgeSeconds: 30 * 24 * 60 * 60,
            maxEntries: 500,
          },
        },
        urlPattern: /\/assets\/cs2\/.*\.(?:avif|jpg|jpeg|png|svg|webp)$/i,
      },
      {
        handler: 'CacheFirst',
        options: {
          cacheName: pwaCacheNames.sounds,
          cacheableResponse: {
            statuses: [0, 200],
          },
          expiration: {
            maxAgeSeconds: 30 * 24 * 60 * 60,
            maxEntries: 32,
          },
        },
        urlPattern: /\/sounds\/.*\.(?:mp3|ogg|wav)$/i,
      },
    ],
  },
}

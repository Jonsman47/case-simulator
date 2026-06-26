import { describe, expect, it } from 'vitest'
import { pwaCacheNames, pwaCoreAssets, pwaOptions, pwaThemeColor } from './pwa.config'

describe('PWA release configuration', () => {
  it('defines installable manifest metadata', () => {
    expect(pwaOptions.manifest).toMatchObject({
      background_color: '#070b10',
      display: 'standalone',
      name: 'Case Opening Simulator',
      short_name: 'Case Sim',
      theme_color: pwaThemeColor,
    })
    expect(pwaOptions.manifest?.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: 'favicon.svg', type: 'image/svg+xml' }),
        expect.objectContaining({ purpose: 'any maskable', src: 'icons.svg' }),
      ]),
    )
  })

  it('pre-caches core shell assets without pre-caching the generated CS2 image catalog', () => {
    expect(pwaOptions.includeAssets).toEqual(expect.arrayContaining([...pwaCoreAssets]))
    expect(pwaOptions.workbox?.globPatterns).toEqual(
      expect.arrayContaining(['**/*.{js,css,html,webmanifest,svg,png,mp3,wav}']),
    )
    expect(pwaOptions.workbox?.globIgnores).toEqual(expect.arrayContaining(['**/assets/cs2/**']))
  })

  it('runtime-caches CS2 images and sounds for offline repeat visits', () => {
    const runtimeCaching = pwaOptions.workbox?.runtimeCaching ?? []

    expect(runtimeCaching).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          handler: 'CacheFirst',
          options: expect.objectContaining({ cacheName: pwaCacheNames.cs2Images }),
        }),
        expect.objectContaining({
          handler: 'CacheFirst',
          options: expect.objectContaining({ cacheName: pwaCacheNames.sounds }),
        }),
      ]),
    )
  })
})

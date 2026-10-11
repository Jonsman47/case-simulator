import { describe, expect, it } from 'vitest'
import { resolvePublicAssetUrl } from './publicAsset'

describe('resolvePublicAssetUrl', () => {
  it('keeps external and relative URLs unchanged', () => {
    expect(resolvePublicAssetUrl('https://example.com/skin.png')).toBe('https://example.com/skin.png')
    expect(resolvePublicAssetUrl('assets/skin.png')).toBe('assets/skin.png')
  })

  it('keeps root assets unchanged when the app is hosted at the root', () => {
    expect(resolvePublicAssetUrl('/assets/skin.png')).toBe('/assets/skin.png')
  })
})

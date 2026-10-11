const externalAssetPattern = /^(?:[a-z]+:)?\/\//i

export function resolvePublicAssetUrl(source: string) {
  if (!source.startsWith('/') || source.startsWith('//') || externalAssetPattern.test(source)) {
    return source
  }

  const baseUrl = import.meta.env.BASE_URL || '/'

  if (baseUrl === '/') {
    return source
  }

  return `${baseUrl.replace(/\/$/, '')}${source}`
}

import { memo, useState, type ImgHTMLAttributes } from 'react'

const fallbackImage = '/assets/placeholder.png'
const maxRetryCount = 1

interface AssetImageState {
  currentSrc: string
  retryCount: number
  source: string
}

export const AssetImage = memo(function AssetImage({
  alt,
  decoding,
  loading,
  onError,
  src,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  const normalizedSrc = src || fallbackImage
  const [imageState, setImageState] = useState<AssetImageState>({
    currentSrc: normalizedSrc,
    retryCount: 0,
    source: normalizedSrc,
  })
  const activeState = imageState.source === normalizedSrc
    ? imageState
    : { currentSrc: normalizedSrc, retryCount: 0, source: normalizedSrc }

  return (
    <img
      {...props}
      alt={alt ?? ''}
      decoding={decoding ?? 'async'}
      loading={loading ?? 'lazy'}
      onError={(event) => {
        setImageState((previousState) => {
          const currentState = previousState.source === normalizedSrc
            ? previousState
            : { currentSrc: normalizedSrc, retryCount: 0, source: normalizedSrc }

          if (currentState.currentSrc !== fallbackImage && currentState.retryCount < maxRetryCount) {
            return {
              currentSrc: `${normalizedSrc}${normalizedSrc.includes('?') ? '&' : '?'}retry=${Date.now()}`,
              retryCount: currentState.retryCount + 1,
              source: normalizedSrc,
            }
          }

          if (currentState.currentSrc !== fallbackImage) {
            return {
              currentSrc: fallbackImage,
              retryCount: currentState.retryCount,
              source: normalizedSrc,
            }
          }

          return currentState
        })

        onError?.(event)
      }}
      src={activeState.currentSrc}
    />
  )
})

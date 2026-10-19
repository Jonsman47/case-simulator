import { useEffect, useRef, type RefObject } from 'react'

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true')
}

export function useDialogFocus({
  containerRef,
  initialFocusRef,
  isActive = true,
  onEscape,
}: {
  containerRef: RefObject<HTMLElement | null>
  initialFocusRef?: RefObject<HTMLElement | null>
  isActive?: boolean
  onEscape: () => void
}) {
  const onEscapeRef = useRef(onEscape)
  useEffect(() => { onEscapeRef.current = onEscape }, [onEscape])

  useEffect(() => {
    if (!isActive) return
    const container = containerRef.current
    if (!container) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusable = getFocusableElements(container)
    ;(initialFocusRef?.current ?? focusable[0] ?? container).focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onEscapeRef.current(); return }
      if (event.key !== 'Tab') return
      const currentFocusable = getFocusableElements(container)
      if (currentFocusable.length === 0) { event.preventDefault(); container.focus(); return }
      const first = currentFocusable[0]
      const last = currentFocusable[currentFocusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [containerRef, initialFocusRef, isActive])
}

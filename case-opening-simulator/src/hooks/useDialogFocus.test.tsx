/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { useDialogFocus } from './useDialogFocus'

function DialogHarness() {
  const [isOpen, setIsOpen] = useState(false)
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  useDialogFocus({ containerRef: dialogRef, initialFocusRef: closeRef, isActive: isOpen, onEscape: () => setIsOpen(false) })

  return <><button onClick={() => setIsOpen(true)} type="button">Launch</button>{isOpen ? <section aria-label="Test dialog" ref={dialogRef} role="dialog" tabIndex={-1}><button ref={closeRef} type="button">Close</button><button type="button">Second</button></section> : null}</>
}

afterEach(cleanup)

describe('useDialogFocus', () => {
  it('focuses, traps, closes with Escape, and restores the trigger', () => {
    render(<DialogHarness />)
    const launch = screen.getByRole('button', { name: 'Launch' })
    launch.focus()
    fireEvent.click(launch)
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'Second' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(launch).toHaveFocus()
    expect(document.body.style.overflow).toBe('')
  })
})

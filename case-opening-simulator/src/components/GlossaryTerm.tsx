import { Info, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { GLOSSARY, type GlossaryKey } from '../data/glossary'

export function GlossaryTerm({ term, label }: { term: GlossaryKey; label?: string }) {
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState(false)
  const [position, setPosition] = useState({ left: 8, top: 8 })
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const leaveTimer = useRef<number | undefined>(undefined)
  const entry = GLOSSARY[term]

  const measure = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.min(320, window.innerWidth - 16)
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    const panelHeight = panel.current?.getBoundingClientRect().height ?? 180
    const below = rect.bottom + 8
    const top = below + panelHeight < window.innerHeight - 8 ? below : Math.max(8, rect.top - panelHeight - 8)
    setPosition({ left, top })
  }, [])

  useEffect(() => {
    if (!open) return
    measure()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); trigger.current?.focus(); setOpen(false) } }
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (!trigger.current?.contains(target) && !panel.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    if (trigger.current) observer?.observe(trigger.current)
    if (panel.current) observer?.observe(panel.current)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      observer?.disconnect()
    }
  }, [open, measure])

  function postponeClose() {
    window.clearTimeout(leaveTimer.current)
    leaveTimer.current = window.setTimeout(() => {
      if (!panel.current?.contains(document.activeElement) && document.activeElement !== trigger.current) setOpen(false)
    }, 180)
  }

  return <span className="inline-flex align-baseline">
    <button ref={trigger} aria-expanded={open} aria-label={`Explain ${entry.label}`} aria-controls={open ? `glossary-${term}` : undefined} className="inline-flex items-center gap-1 border-b border-dotted border-cs-muted text-inherit hover:text-rarity-industrial focus-visible:outline focus-visible:outline-2 focus-visible:outline-rarity-industrial" onClick={() => setOpen(true)} onFocus={() => setOpen(true)} onKeyDown={(event) => { if (event.key === 'Tab' && !event.shiftKey && open) { event.preventDefault(); panel.current?.querySelector('button')?.focus() } }} onMouseEnter={() => { window.clearTimeout(leaveTimer.current); setOpen(true) }} onMouseLeave={postponeClose} type="button">{label ?? entry.label}<Info aria-hidden="true" size={13} /></button>
    {open ? createPortal(<div ref={panel} id={`glossary-${term}`} role="dialog" aria-label={`${entry.label} explanation`} className="fixed z-[120] max-h-[calc(100vh-16px)] w-[min(20rem,calc(100vw-16px))] overflow-y-auto border border-rarity-industrial bg-cs-surface p-3 text-left text-sm text-cs-text shadow-xl" style={position} onMouseEnter={() => window.clearTimeout(leaveTimer.current)} onMouseLeave={postponeClose} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== trigger.current) postponeClose() }}>
      <div className="flex items-start justify-between gap-2"><strong>{entry.label}</strong><button aria-label="Close explanation" className="text-cs-muted hover:text-cs-text" onClick={() => setOpen(false)} type="button"><X size={16} /></button></div>
      <p className="mt-2 leading-5 text-cs-muted">{entry.short}</p>
      {details ? <p className="mt-2 leading-5 text-cs-muted">{entry.detail}</p> : null}
      <div className="mt-3 flex items-center gap-3"><button aria-expanded={details} className="text-xs text-rarity-industrial underline" onClick={() => { setDetails((value) => !value); window.requestAnimationFrame(measure) }} type="button">{details ? 'Less detail' : 'More details'}</button><Link className="text-xs text-rarity-industrial underline" to={`/help?term=${term}`} onClick={() => setOpen(false)}>Help Center</Link></div>
    </div>, document.body) : null}
  </span>
}

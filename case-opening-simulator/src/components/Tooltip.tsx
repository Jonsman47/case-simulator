import { HelpCircle } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

export function Tooltip({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  const tooltipId = useId()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <span className="relative inline-flex items-center">
      <button
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-label={label}
        className="inline-grid h-7 w-7 place-items-center border border-cs-border bg-cs-surface text-cs-muted transition-colors hover:border-rarity-special hover:text-cs-text focus:border-rarity-special focus:text-cs-text focus:outline-none"
        onBlur={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        type="button"
      >
        <HelpCircle size={15} />
      </button>
      {isOpen ? (
        <span
          className="absolute right-0 top-9 z-40 w-64 border border-cs-border bg-cs-surface p-3 text-left text-xs normal-case leading-relaxed text-cs-text shadow-glow"
          id={tooltipId}
          role="tooltip"
        >
          {children}
        </span>
      ) : null}
    </span>
  )
}

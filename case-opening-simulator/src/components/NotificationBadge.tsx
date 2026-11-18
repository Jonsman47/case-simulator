export function NotificationBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null
  return (
    <span
      aria-label={`${label}, ${count} ${count === 1 ? 'notification' : 'notifications'}`}
      className="inline-flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rarity-covert px-1.5 font-mono text-[10px] font-bold leading-none text-white shadow-[0_0_0_2px_rgb(var(--cs-panel))]"
      data-testid={`notification-badge-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`}
      role="status"
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

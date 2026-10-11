import { ChevronDown, Menu, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  flattenNavigationItems,
  getPrimaryNavigationItems,
  type NavigationItem,
} from '../data/navigation'

function itemMatchesPath(item: NavigationItem, pathname: string): boolean {
  if (item.end) {
    return pathname === item.path
  }

  if (pathname === item.path || pathname.startsWith(`${item.path}/`)) {
    return true
  }

  return item.items?.some((child) => itemMatchesPath(child, pathname)) ?? false
}

function getLinkClass(
  isActive: boolean,
  density: 'desktop' | 'mobile' = 'desktop',
  tone?: NavigationItem['tone'],
) {
  if (tone === 'danger') {
    return [
      'flex shrink-0 items-center border font-medium transition-colors',
      density === 'desktop' ? 'min-h-9 px-3 py-1.5 text-xs' : 'min-h-10 px-3 py-2 text-sm',
      isActive
        ? 'border-rarity-covert bg-rarity-covert/15 text-rarity-covert'
        : 'border-rarity-covert/60 text-rarity-covert hover:bg-rarity-covert/10',
    ].join(' ')
  }

  return [
    'flex min-w-0 shrink-0 items-center gap-2 whitespace-nowrap border font-medium transition-colors',
    density === 'desktop' ? 'min-h-9 px-3 py-1.5 text-xs' : 'min-h-10 px-3 py-2 text-sm',
    isActive
      ? 'border-rarity-special bg-rarity-special/10 text-rarity-special'
      : 'border-transparent text-cs-muted hover:border-cs-border hover:bg-cs-panelMuted hover:text-cs-text',
  ].join(' ')
}

function DesktopNavGroup({
  item,
  pathname,
}: {
  item: NavigationItem
  pathname: string
}) {
  const isGroupActive = itemMatchesPath(item, pathname)
  const subItems = item.items ?? []
  const Icon = item.icon

  return (
    <div className="group relative">
      <NavLink
        className={({ isActive }) => getLinkClass(isActive || isGroupActive, 'desktop', item.tone)}
        end={item.end}
        to={item.path}
      >
        {Icon ? <Icon aria-hidden="true" className="shrink-0" size={15} strokeWidth={1.8} /> : null}
        <span>{item.label}</span>
        {subItems.length > 0 ? <ChevronDown aria-hidden="true" className="ml-1" size={13} /> : null}
      </NavLink>

      {subItems.length > 0 ? (
        <div className="absolute left-0 top-[calc(100%+1px)] z-40 hidden max-h-[min(32rem,calc(100dvh-7rem))] min-w-48 overflow-y-auto border border-cs-border bg-cs-surface p-1 shadow-glow group-hover:grid group-focus-within:grid">
          {subItems.map((subItem) => (
            <NavLink
              className={({ isActive }) => getLinkClass(isActive, 'desktop')}
              end={subItem.end}
              key={subItem.path}
              to={subItem.path}
            >
              {subItem.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function TopNav({ isAdminUser = false }: { isAdminUser?: boolean }) {
  const location = useLocation()
  const primaryItems = useMemo(() => getPrimaryNavigationItems(isAdminUser), [isAdminUser])
  const flatItems = useMemo(() => flattenNavigationItems(primaryItems), [primaryItems])
  const [drawerState, setDrawerState] = useState({
    isOpen: false,
    pathname: '',
  })
  const isDrawerOpen = drawerState.isOpen && drawerState.pathname === location.pathname
  const activeItem = useMemo(() => {
    return [...flatItems]
      .sort((left, right) => right.path.length - left.path.length)
      .find((item) => {
        return itemMatchesPath(item, location.pathname)
      }) ?? primaryItems[0]
  }, [flatItems, location.pathname, primaryItems])

  useEffect(() => {
    if (!isDrawerOpen) {
      return undefined
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDrawerState((currentState) => ({ ...currentState, isOpen: false }))
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDrawerOpen])

  const leftDesktopLinks = primaryItems.filter((item) => item.align !== 'right').map((item) => (
    <DesktopNavGroup item={item} key={item.path} pathname={location.pathname} />
  ))
  const rightDesktopLinks = primaryItems.filter((item) => item.align === 'right').map((item) => (
    <DesktopNavGroup item={item} key={item.path} pathname={location.pathname} />
  ))

  const mobileLinks = primaryItems.map((item) => (
    <div className="grid gap-1" key={item.path}>
      <NavLink
        className={({ isActive }) => getLinkClass(isActive || itemMatchesPath(item, location.pathname), 'mobile', item.tone)}
        end={item.end}
        onClick={() => setDrawerState((currentState) => ({ ...currentState, isOpen: false }))}
        to={item.path}
      >
        {item.icon ? <item.icon aria-hidden="true" className="shrink-0" size={17} strokeWidth={1.8} /> : null}
        {item.label}
      </NavLink>
      {item.items && item.items.length > 0 ? (
        <div className="ml-3 grid gap-1 border-l border-cs-border pl-2">
          {item.items.map((subItem) => (
            <NavLink
              className={({ isActive }) => getLinkClass(isActive, 'mobile')}
              end={subItem.end}
              key={subItem.path}
              onClick={() => setDrawerState((currentState) => ({ ...currentState, isOpen: false }))}
              to={subItem.path}
            >
              {subItem.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  ))

  return (
    <>
      <nav aria-label="Primary navigation" className="hidden border-b border-cs-border bg-cs-panel px-2 py-2 lg:block">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {leftDesktopLinks}
          <div className="ml-auto flex min-w-0 flex-wrap gap-1.5">{rightDesktopLinks}</div>
        </div>
      </nav>

      <div className="border-b border-cs-border bg-cs-panel p-2 lg:hidden">
        <button
          aria-label={
            isDrawerOpen
              ? 'Close navigation menu'
              : `Open navigation menu, current screen ${activeItem.label}`
          }
          aria-controls="mobile-navigation-drawer"
          aria-expanded={isDrawerOpen}
          className="flex min-h-11 w-full items-center justify-between border border-cs-border bg-cs-surface px-3 py-2 text-left text-cs-text transition-colors hover:border-rarity-special"
          onClick={() =>
            setDrawerState((currentState) => ({
              isOpen: !(currentState.isOpen && currentState.pathname === location.pathname),
              pathname: location.pathname,
            }))
          }
          type="button"
        >
          <span className="flex min-w-0 items-center gap-3">
            {activeItem.icon ? <activeItem.icon aria-hidden="true" className="shrink-0 text-rarity-special" size={18} /> : null}
            <span className="min-w-0">
            <span className="block font-mono text-[10px] uppercase text-cs-muted">Menu</span>
            <span className="block truncate text-sm font-semibold">{activeItem.label}</span>
            </span>
          </span>
          {isDrawerOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden">
          <div
            aria-label="Primary navigation"
            aria-modal="true"
            className="flex h-dvh w-[min(22rem,88vw)] flex-col border-r border-cs-border bg-cs-surface p-3 shadow-glow"
            id="mobile-navigation-drawer"
            role="dialog"
          >
            <div className="flex items-center justify-between border-b border-cs-border pb-3">
              <div>
                <p className="font-mono text-xs uppercase text-rarity-special">Navigate</p>
                <p className="mt-1 text-sm text-cs-muted">Choose a compact section</p>
              </div>
              <button
                aria-label="Close navigation"
                className="grid h-11 w-11 place-items-center border border-cs-border text-cs-muted transition-colors hover:text-cs-text"
                onClick={() => setDrawerState((currentState) => ({ ...currentState, isOpen: false }))}
                type="button"
              >
                <X size={20} />
              </button>
            </div>
            <nav aria-label="Mobile primary navigation" className="mt-3 grid gap-2 overflow-y-auto pb-4">
              {mobileLinks}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  )
}

export interface NavigationItem {
  label: string
  path: string
  end?: boolean
  adminOnly?: boolean
  items?: NavigationItem[]
}

export const primaryNavigationItems: NavigationItem[] = [
  { label: 'Home', path: '/', end: true },
  {
    label: 'Cases',
    path: '/cases',
    items: [
      { label: 'Case Licenses', path: '/cases' },
      { label: 'Collection Book', path: '/collection-book' },
      { label: 'Daily Rewards', path: '/rewards' },
    ],
  },
  {
    label: 'Inventory',
    path: '/inventory',
    items: [
      { label: 'Inventory', path: '/inventory' },
      { label: 'Trade Ups', path: '/trade-ups' },
      { label: 'Trophy Room', path: '/trophy-room' },
    ],
  },
  {
    label: 'Market',
    path: '/market',
    items: [
      { label: 'Market', path: '/market' },
      // Admin Panel is intentionally a submenu item and is filtered for non-admin
      // sessions to keep the top-level nav compact and prevent casual event access.
      { label: 'Admin Panel', path: '/events', adminOnly: true },
    ],
  },
  {
    label: 'Automation',
    path: '/automation',
    items: [
      { label: 'Automation', path: '/automation' },
      { label: 'Upgrades', path: '/upgrades' },
      { label: 'Prestige', path: '/prestige' },
      { label: 'Skill Tree', path: '/skill-tree' },
      { label: 'Achievements', path: '/achievements' },
      { label: 'Stats', path: '/stats' },
    ],
  },
  { label: 'Settings', path: '/settings' },
]

function filterNavigationTree(items: NavigationItem[], isAdmin: boolean): NavigationItem[] {
  return items
    .filter((item) => !item.adminOnly || isAdmin)
    .map((item) => ({
      ...item,
      items: item.items ? filterNavigationTree(item.items, isAdmin) : undefined,
    }))
}

export function getPrimaryNavigationItems(isAdmin = false) {
  return filterNavigationTree(primaryNavigationItems, isAdmin)
}

export function flattenNavigationItems(items: NavigationItem[]) {
  return items.flatMap((item) => [item, ...(item.items ?? [])])
}

export function getNavigationItems(isAdmin = false) {
  return flattenNavigationItems(getPrimaryNavigationItems(isAdmin))
}

export const navigationItems = getNavigationItems(false)

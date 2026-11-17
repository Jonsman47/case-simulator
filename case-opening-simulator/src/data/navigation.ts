import {
  Backpack,
  BadgeInfo,
  BadgeCheck,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  RadioTower,
  Trophy,
  Users,
  House,
  PackageOpen,
  ScrollText,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavigationItem {
  label: string
  path: string
  icon?: LucideIcon
  end?: boolean
  adminOnly?: boolean
  align?: 'right'
  tone?: 'danger'
  items?: NavigationItem[]
}

export const primaryNavigationItems: NavigationItem[] = [
  { label: 'Home', path: '/', end: true, icon: House },
  {
    label: 'Cases',
    path: '/cases',
    icon: PackageOpen,
    items: [
      { label: 'Case Licenses', path: '/cases' },
      { label: 'Collection Book', path: '/collection-book' },
      { label: 'Daily Rewards', path: '/rewards' },
      { label: 'Quests & Characters', path: '/quests', icon: ScrollText },
    ],
  },
  {
    label: 'Inventory',
    path: '/inventory',
    icon: Backpack,
    items: [
      { label: 'Inventory', path: '/inventory' },
      { label: 'Trade Ups', path: '/trade-ups' },
      { label: 'Trophy Room', path: '/trophy-room' },
    ],
  },
  {
    label: 'Market',
    path: '/market',
    icon: ChartNoAxesCombined,
    items: [
      { label: 'Market', path: '/market' },
      { label: 'CSWEAR', path: '/cswear' },
      { label: 'Events', path: '/events', icon: RadioTower },
      { label: 'Admin Panel', path: '/admin', adminOnly: true },
    ],
  },
  {
    label: 'Progression',
    path: '/career',
    icon: BriefcaseBusiness,
    items: [
      { label: 'Business', path: '/business', icon: BriefcaseBusiness },
      { label: 'Career & Upgrades', path: '/career', icon: BadgeCheck },
      { label: 'Prestige', path: '/prestige' },
      { label: 'Achievements & Stats', path: '/progress' },
    ],
  },
  {
    label: 'Community',
    path: '/leaderboards',
    icon: Users,
    items: [
      { label: 'Leaderboards', path: '/leaderboards', icon: Trophy },
      { label: 'My Profile', path: '/profile', icon: Users },
    ],
  },
  { label: 'Settings', path: '/settings', icon: Settings },
  { label: 'Work', path: '/work', icon: BriefcaseBusiness },
  { label: 'Credits', path: '/credits', align: 'right', tone: 'danger', icon: BadgeInfo },
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

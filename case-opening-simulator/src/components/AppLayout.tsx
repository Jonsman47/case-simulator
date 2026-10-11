import { useMemo, useRef, type CSSProperties, type TouchEvent } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Rarity } from '../data/models'
import { defaultRarityColors } from '../data/gameState'
import { getPrimaryNavigationItems, type NavigationItem } from '../data/navigation'
import { useGame } from '../hooks/useGame'
import { isAdminSession } from '../utils/admin'
import { LowBalancePoopPrompt } from './LowBalancePoopPrompt'
import { MarketEventBanner } from './MarketEventBanner'
import { OnboardingTutorial } from './OnboardingTutorial'
import { StatusHeader } from './StatusHeader'
import { ToastNotifications } from './ToastNotifications'
import { TopNav } from './TopNav'
import { UiEffects } from './UiEffects'

const rarityCssVarNames: Record<Rarity, string> = {
  [Rarity.Consumer]: '--rarity-consumer',
  [Rarity.Industrial]: '--rarity-industrial',
  [Rarity.MilSpec]: '--rarity-mil-spec',
  [Rarity.Restricted]: '--rarity-restricted',
  [Rarity.Classified]: '--rarity-classified',
  [Rarity.Covert]: '--rarity-covert',
  [Rarity.SpecialItem]: '--rarity-special',
  [Rarity.Contraband]: '--rarity-contraband',
}

function hexToRgbTriplet(hexColor: string) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hexColor)

  if (!match) {
    return '255 255 255'
  }

  const value = match[1]

  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ].join(' ')
}

function getThemeVariables(
  settings: ReturnType<typeof useGame>['state']['settings'],
): CSSProperties {
  const lightTheme = settings.highContrastMode
    ? {
        '--cs-bg': '255 255 255',
        '--cs-surface': '250 250 250',
        '--cs-panel': '245 247 250',
        '--cs-panel-muted': '231 235 242',
        '--cs-border': '30 41 59',
        '--cs-text': '2 6 23',
        '--cs-muted': '51 65 85',
        '--cs-amber': '146 64 14',
        '--cs-green': '21 128 61',
      }
    : {
        '--cs-bg': '245 247 251',
        '--cs-surface': '255 255 255',
        '--cs-panel': '238 242 247',
        '--cs-panel-muted': '226 232 240',
        '--cs-border': '173 185 201',
        '--cs-text': '18 24 36',
        '--cs-muted': '83 99 122',
        '--cs-amber': '180 83 9',
        '--cs-green': '22 163 74',
      }
  const darkTheme = settings.highContrastMode
    ? {
        '--cs-bg': '0 0 0',
        '--cs-surface': '6 8 12',
        '--cs-panel': '12 16 24',
        '--cs-panel-muted': '19 26 39',
        '--cs-border': '128 148 176',
        '--cs-text': '255 255 255',
        '--cs-muted': '220 228 240',
        '--cs-amber': '255 215 0',
        '--cs-green': '76 255 154',
      }
    : {
        '--cs-bg': '8 11 16',
        '--cs-surface': '17 23 34',
        '--cs-panel': '23 31 45',
        '--cs-panel-muted': '32 42 58',
        '--cs-border': '42 52 70',
        '--cs-text': '238 242 248',
        '--cs-muted': '154 168 187',
        '--cs-amber': '242 184 75',
        '--cs-green': '90 209 154',
      }
  const themeVariables = settings.theme === 'light' ? lightTheme : darkTheme
  const rarityVariables = Object.values(Rarity).reduce<Record<string, string>>((variables, rarity) => {
    variables[rarityCssVarNames[rarity]] = hexToRgbTriplet(settings.rarityColors[rarity] ?? defaultRarityColors[rarity])
    return variables
  }, {})

  return {
    ...themeVariables,
    ...rarityVariables,
    colorScheme: settings.theme,
  } as CSSProperties
}

function shouldIgnoreSwipe(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return true
  }

  return Boolean(target.closest('button, a, input, select, textarea, [role="dialog"], [data-swipe-ignore="true"]'))
}

function navigationItemMatchesPath(item: NavigationItem, pathname: string): boolean {
  if (item.end) {
    return pathname === item.path
  }

  if (pathname === item.path || pathname.startsWith(`${item.path}/`)) {
    return true
  }

  return item.items?.some((child) => navigationItemMatchesPath(child, pathname)) ?? false
}

function getNavigationIndex(pathname: string, items: NavigationItem[]) {
  const matchedIndex = items.findIndex((item) => {
    if (item.end) {
      return pathname === item.path
    }

    return navigationItemMatchesPath(item, pathname)
  })

  return matchedIndex >= 0 ? matchedIndex : 0
}

export function AppLayout() {
  const { cloud, state } = useGame()
  const location = useLocation()
  const navigate = useNavigate()
  const touchStartRef = useRef<{ x: number; y: number } | undefined>(undefined)
  const themeStyle = useMemo(() => getThemeVariables(state.settings), [state.settings])
  const isAdminUser = isAdminSession(cloud.session)
  const swipeNavigationItems = useMemo(() => getPrimaryNavigationItems(isAdminUser), [isAdminUser])

  function handleMainTouchStart(event: TouchEvent<HTMLElement>) {
    if (event.touches.length !== 1 || shouldIgnoreSwipe(event.target)) {
      touchStartRef.current = undefined
      return
    }

    const touch = event.touches[0]

    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  function handleMainTouchEnd(event: TouchEvent<HTMLElement>) {
    const start = touchStartRef.current

    touchStartRef.current = undefined

    if (!start || shouldIgnoreSwipe(event.target)) {
      return
    }

    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y

    if (Math.abs(deltaX) < 86 || Math.abs(deltaY) > 72 || Math.abs(deltaY) > Math.abs(deltaX) * 0.7) {
      return
    }

    const currentIndex = getNavigationIndex(location.pathname, swipeNavigationItems)
    const nextIndex =
      deltaX < 0
        ? Math.min(swipeNavigationItems.length - 1, currentIndex + 1)
        : Math.max(0, currentIndex - 1)

    if (nextIndex !== currentIndex) {
      navigate(swipeNavigationItems[nextIndex].path)
    }
  }

  return (
    <div
      className={[
        'min-h-screen min-w-0 bg-cs-bg text-cs-text',
        state.settings.largeText ? 'text-lg' : 'text-base',
        state.settings.simplifiedAnimations ? 'simplified-motion' : '',
        ].join(' ')}
        data-theme={state.settings.theme}
        style={themeStyle}
      >
      <div className="mx-auto flex min-h-screen min-w-0 w-full max-w-screen-2xl flex-col px-2 py-2 sm:px-4 sm:py-3 lg:px-6">
        <StatusHeader />
        <TopNav isAdminUser={isAdminUser} />
        <MarketEventBanner />
        <main
          className="flex min-w-0 w-full flex-1 py-2 sm:py-4"
          onTouchEnd={handleMainTouchEnd}
          onTouchStart={handleMainTouchStart}
        >
          <Outlet />
        </main>
        <ToastNotifications />
        <LowBalancePoopPrompt key={state.money < 3 ? 'low-balance' : 'funded'} />
        <UiEffects />
        <OnboardingTutorial />
      </div>
    </div>
  )
}

import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { GameProvider } from './components/GameProvider'
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt'
import { useGame } from './hooks/useGame'
import { isAdminSession } from './utils/admin'

const Achievements = lazy(() => import('./views/Achievements').then((module) => ({ default: module.Achievements })))
const AdminPanel = lazy(() => import('./views/AdminPanel').then((module) => ({ default: module.AdminPanel })))
const Automation = lazy(() => import('./views/Automation').then((module) => ({ default: module.Automation })))
const CaseSelectionView = lazy(() => import('./views/CaseSelectionView').then((module) => ({ default: module.CaseSelectionView })))
const CollectionBookView = lazy(() => import('./views/CollectionBookView').then((module) => ({ default: module.CollectionBookView })))
const CreditsView = lazy(() => import('./views/CreditsView').then((module) => ({ default: module.CreditsView })))
const InventoryView = lazy(() => import('./views/InventoryView').then((module) => ({ default: module.InventoryView })))
const Main = lazy(() => import('./views/Main').then((module) => ({ default: module.Main })))
const Market = lazy(() => import('./views/Market').then((module) => ({ default: module.Market })))
const MarketEvents = lazy(() => import('./views/MarketEvents').then((module) => ({ default: module.MarketEvents })))
const Prestige = lazy(() => import('./views/Prestige').then((module) => ({ default: module.Prestige })))
const RewardsView = lazy(() => import('./views/RewardsView').then((module) => ({ default: module.RewardsView })))
const Settings = lazy(() => import('./views/Settings').then((module) => ({ default: module.Settings })))
const SkillTree = lazy(() => import('./views/SkillTree').then((module) => ({ default: module.SkillTree })))
const Stats = lazy(() => import('./views/Stats').then((module) => ({ default: module.Stats })))
const TradeUps = lazy(() => import('./views/TradeUps').then((module) => ({ default: module.TradeUps })))
const TrophyRoom = lazy(() => import('./views/TrophyRoom').then((module) => ({ default: module.TrophyRoom })))
const Upgrades = lazy(() => import('./views/Upgrades').then((module) => ({ default: module.Upgrades })))
const WorkView = lazy(() => import('./views/WorkView').then((module) => ({ default: module.WorkView })))

function RouteFallback() {
  return (
    <div className="grid min-h-80 w-full place-items-center border border-cs-border bg-cs-surface p-6 text-center">
      <div>
        <p className="font-mono text-xs uppercase text-rarity-special">Loading</p>
        <p className="mt-2 text-lg font-semibold text-cs-text">Preparing view...</p>
      </div>
    </div>
  )
}

function AdminOnlyRoute({ children }: { children: ReactNode }) {
  const { cloud } = useGame()

  // Admin tools are protected at the route level, not just hidden in navigation.
  if (!isAdminSession(cloud.session)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <GameProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<Suspense fallback={<RouteFallback />}><Main /></Suspense>} />
              <Route path="poop-cleaning" element={<Navigate to="/work" replace />} />
              <Route path="cases" element={<Suspense fallback={<RouteFallback />}><CaseSelectionView /></Suspense>} />
              <Route path="inventory" element={<Suspense fallback={<RouteFallback />}><InventoryView /></Suspense>} />
              <Route path="collection-book" element={<Suspense fallback={<RouteFallback />}><CollectionBookView /></Suspense>} />
              <Route path="market" element={<Suspense fallback={<RouteFallback />}><Market /></Suspense>} />
              <Route path="events" element={<Suspense fallback={<RouteFallback />}><MarketEvents /></Suspense>} />
              <Route
                path="admin"
                element={
                  <AdminOnlyRoute>
                    <Suspense fallback={<RouteFallback />}><AdminPanel /></Suspense>
                  </AdminOnlyRoute>
                }
              />
              <Route path="rewards" element={<Suspense fallback={<RouteFallback />}><RewardsView /></Suspense>} />
              <Route path="trade-ups" element={<Suspense fallback={<RouteFallback />}><TradeUps /></Suspense>} />
              <Route path="automation" element={<Suspense fallback={<RouteFallback />}><Automation /></Suspense>} />
              <Route path="upgrades" element={<Suspense fallback={<RouteFallback />}><Upgrades /></Suspense>} />
              <Route path="prestige" element={<Suspense fallback={<RouteFallback />}><Prestige /></Suspense>} />
              <Route path="skill-tree" element={<Suspense fallback={<RouteFallback />}><SkillTree /></Suspense>} />
              <Route path="achievements" element={<Suspense fallback={<RouteFallback />}><Achievements /></Suspense>} />
              <Route path="stats" element={<Suspense fallback={<RouteFallback />}><Stats /></Suspense>} />
              <Route path="work" element={<Suspense fallback={<RouteFallback />}><WorkView /></Suspense>} />
              <Route path="credits" element={<Suspense fallback={<RouteFallback />}><CreditsView /></Suspense>} />
              <Route path="leaderboards" element={<Navigate to="/" replace />} />
              <Route path="trophy-room" element={<Suspense fallback={<RouteFallback />}><TrophyRoom /></Suspense>} />
              <Route path="settings" element={<Suspense fallback={<RouteFallback />}><Settings /></Suspense>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <PWAUpdatePrompt />
      </ErrorBoundary>
    </GameProvider>
  )
}

export default App

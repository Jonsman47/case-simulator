import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { GameProvider } from './components/GameProvider'
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt'
import { useGame } from './hooks/useGame'
import { getFeatureProgress } from './progression/featureUnlocks'
import type { FeatureId } from './data/gameState'
import { Link } from 'react-router-dom'
import { isAdminSession } from './utils/admin'

const AchievementsStats = lazy(() => import('./views/AchievementsStats').then((module) => ({ default: module.AchievementsStats })))
const AdminPanel = lazy(() => import('./views/AdminPanel').then((module) => ({ default: module.AdminPanel })))
const Business = lazy(() => import('./views/Business').then((module) => ({ default: module.Business })))
const CaseSelectionView = lazy(() => import('./views/CaseSelectionView').then((module) => ({ default: module.CaseSelectionView })))
const Career = lazy(() => import('./views/Career').then((module) => ({ default: module.Career })))
const CollectionBookView = lazy(() => import('./views/CollectionBookView').then((module) => ({ default: module.CollectionBookView })))
const CreditsView = lazy(() => import('./views/CreditsView').then((module) => ({ default: module.CreditsView })))
const InventoryView = lazy(() => import('./views/InventoryView').then((module) => ({ default: module.InventoryView })))
const HelpCenter = lazy(() => import('./views/HelpCenter').then((module) => ({ default: module.HelpCenter })))
const LeaderboardView = lazy(() => import('./views/LeaderboardView').then((module) => ({ default: module.LeaderboardView })))
const Main = lazy(() => import('./views/Main').then((module) => ({ default: module.Main })))
const Market = lazy(() => import('./views/Market').then((module) => ({ default: module.Market })))
const CSWear = lazy(() => import('./views/CSWear').then((module) => ({ default: module.CSWear })))
const MarketEvents = lazy(() => import('./views/MarketEvents').then((module) => ({ default: module.MarketEvents })))
const Prestige = lazy(() => import('./views/Prestige').then((module) => ({ default: module.Prestige })))
const PlayerProfileView = lazy(() => import('./views/PlayerProfileView').then((module) => ({ default: module.PlayerProfileView })))
const RewardsView = lazy(() => import('./views/RewardsView').then((module) => ({ default: module.RewardsView })))
const QuestsView = lazy(() => import('./views/QuestsView').then((module) => ({ default: module.QuestsView })))
const Settings = lazy(() => import('./views/Settings').then((module) => ({ default: module.Settings })))
const TradeUps = lazy(() => import('./views/TradeUps').then((module) => ({ default: module.TradeUps })))
const TrophyRoom = lazy(() => import('./views/TrophyRoom').then((module) => ({ default: module.TrophyRoom })))
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

function FeatureRoute({ children, id }: { children: ReactNode; id: FeatureId }) {
  const { state } = useGame()
  const feature = getFeatureProgress(state).find((entry) => entry.id === id)
  if (feature?.unlocked) return <>{children}</>
  return <section className="grid w-full min-h-64 place-items-center border border-cs-border bg-cs-surface p-4 text-center"><div className="max-w-lg"><p className="font-mono text-xs uppercase text-rarity-special">Feature locked</p><h2 className="mt-2 text-xl font-semibold">{feature?.name}</h2><p className="mt-2 text-sm text-cs-muted">{feature?.description}</p><p className="mt-2 text-sm text-cs-muted">Progress: {feature?.current}/{feature?.target}</p><Link className="mt-4 inline-flex min-h-11 items-center border border-rarity-special px-4 text-sm text-rarity-special" to={id === 'business' || id === 'prestige' ? '/career' : id === 'market' ? '/inventory' : id === 'cswear' ? '/work' : '/cases'}>Continue progressing</Link></div></section>
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
              <Route path="collection-book" element={<FeatureRoute id="collection-book"><Suspense fallback={<RouteFallback />}><CollectionBookView /></Suspense></FeatureRoute>} />
              <Route path="market" element={<FeatureRoute id="market"><Suspense fallback={<RouteFallback />}><Market /></Suspense></FeatureRoute>} />
              <Route path="cswear" element={<FeatureRoute id="cswear"><Suspense fallback={<RouteFallback />}><CSWear /></Suspense></FeatureRoute>} />
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
              <Route path="quests" element={<FeatureRoute id="quests"><Suspense fallback={<RouteFallback />}><QuestsView /></Suspense></FeatureRoute>} />
              <Route path="trade-ups" element={<FeatureRoute id="trade-ups"><Suspense fallback={<RouteFallback />}><TradeUps /></Suspense></FeatureRoute>} />
              <Route path="automation" element={<Navigate to="/business" replace />} />
              <Route path="business" element={<FeatureRoute id="business"><Suspense fallback={<RouteFallback />}><Business /></Suspense></FeatureRoute>} />
              <Route path="career" element={<Suspense fallback={<RouteFallback />}><Career /></Suspense>} />
              <Route path="upgrades" element={<Navigate to="/career" replace />} />
              <Route path="prestige" element={<FeatureRoute id="prestige"><Suspense fallback={<RouteFallback />}><Prestige /></Suspense></FeatureRoute>} />
              <Route path="skill-tree" element={<Navigate to="/career" replace />} />
              <Route path="progress" element={<Suspense fallback={<RouteFallback />}><AchievementsStats /></Suspense>} />
              <Route path="achievements" element={<Navigate to="/progress?tab=achievements" replace />} />
              <Route path="stats" element={<Navigate to="/progress?tab=stats" replace />} />
              <Route path="achievements-stats" element={<Navigate to="/progress" replace />} />
              <Route path="work" element={<Suspense fallback={<RouteFallback />}><WorkView /></Suspense>} />
              <Route path="credits" element={<Suspense fallback={<RouteFallback />}><CreditsView /></Suspense>} />
              <Route path="leaderboards" element={<Suspense fallback={<RouteFallback />}><LeaderboardView /></Suspense>} />
              <Route path="profile" element={<Suspense fallback={<RouteFallback />}><PlayerProfileView /></Suspense>} />
              <Route path="profile/:userId" element={<Suspense fallback={<RouteFallback />}><PlayerProfileView /></Suspense>} />
              <Route path="trophy-room" element={<Suspense fallback={<RouteFallback />}><TrophyRoom /></Suspense>} />
              <Route path="settings" element={<Suspense fallback={<RouteFallback />}><Settings /></Suspense>} />
              <Route path="help" element={<Suspense fallback={<RouteFallback />}><HelpCenter /></Suspense>} />
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

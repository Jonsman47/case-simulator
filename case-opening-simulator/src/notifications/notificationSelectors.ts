import { ACHIEVEMENTS, getAchievementProgress } from '../data/achievements'
import type { GameState } from '../data/gameState'
import { CAREER_UPGRADE_DEFINITIONS, getCareerUpgradeLevel, getCareerUpgradeStatus } from '../career/careerUpgrades'
import { getPrestigeEligibilityV2 } from '../prestige/prestigeSystem'
import { QUEST_DEFINITIONS, getQuestProgressState, getQuestStageStatus, isQuestUnlocked } from '../quests/questSystem'

export type NotificationKind = 'claimable' | 'action' | 'new' | 'acknowledgement'

export interface GameNotification {
  id: string
  kind: NotificationKind
  label: string
  path: string
}

function getAchievementNotifications(state: GameState): GameNotification[] {
  return ACHIEVEMENTS.flatMap((achievement) => {
    const progress = getAchievementProgress(state.achievements, achievement.id, state.career.runId)
    return progress && !progress.isClaimed && achievement.reward
      ? [{ id: `achievement:${achievement.id}:${progress.unlockedAt}`, kind: 'claimable' as const, label: `${achievement.name} reward`, path: '/progress' }]
      : []
  })
}

function getQuestNotifications(state: GameState): GameNotification[] {
  return QUEST_DEFINITIONS.flatMap((quest) => {
    if (!isQuestUnlocked(state, quest)) return []
    const progress = getQuestProgressState(state, quest)
    const stage = quest.stages[progress.stageIndex]
    if (!stage || progress.completedAt || progress.claimedStageIds.includes(stage.id)) return []
    return getQuestStageStatus(state, quest).complete
      ? [{ id: `quest:${quest.id}:${stage.id}`, kind: 'claimable' as const, label: `${quest.name} stage reward`, path: '/quests' }]
      : []
  })
}

function getBusinessNotifications(state: GameState): GameNotification[] {
  const approval = state.business.pendingTradeUpApproval
    ? [{ id: `business-approval:${state.business.pendingTradeUpApproval.id}`, kind: 'action' as const, label: 'Trade-up approval required', path: '/business' }]
    : []
  const alerts = state.business.alerts.filter((alert) => alert.status === 'new').map((alert) => ({
    id: `scout:${alert.id}`,
    kind: 'new' as const,
    label: `Market Scout found ${alert.skinName}`,
    path: '/business',
  }))
  return [...approval, ...alerts]
}

function getCswearNotifications(state: GameState): GameNotification[] {
  const offers = state.marketplace.playerListings.flatMap((listing) => listing.incomingOffer ? [{
    id: `offer:${listing.incomingOffer.id}`,
    kind: 'action' as const,
    label: `Buyer offer for ${listing.item.weapon} | ${listing.item.finish}`,
    path: '/cswear',
  }] : [])
  const acquisition = state.marketplace.pendingAcquisition && state.marketplace.pendingAcquisition.source !== 'trade-up' ? [{
    id: `acquisition:${state.marketplace.pendingAcquisition.id}`,
    kind: 'claimable' as const,
    label: 'Purchased item ready to claim',
    path: '/cswear',
  }] : []
  const negotiations = state.marketplace.npcListings.flatMap((listing) => listing.negotiation?.status === 'open' ? [{
    id: `negotiation:${listing.id}`,
    kind: 'action' as const,
    label: `Open negotiation with ${listing.seller.username}`,
    path: '/cswear',
  }] : [])
  return [...offers, ...acquisition, ...negotiations]
}

export function getPrestigeNotificationKey(state: GameState) {
  const eligibility = getPrestigeEligibilityV2(state)
  return eligibility.canPrestige
    ? `${state.economyLedger.currentRunId}:tier-${eligibility.tier.tier}:score-${Math.floor(eligibility.score.total)}`
    : undefined
}

function getPrestigeNotifications(state: GameState): GameNotification[] {
  const key = getPrestigeNotificationKey(state)
  return key && key !== state.ui.notifications.acknowledgedPrestigeKey ? [{
    id: `prestige:${key}`,
    kind: 'acknowledgement' as const,
    label: 'Prestige is available',
    path: '/prestige',
  }] : []
}

export function getNewlyUnlockedUpgradeIds(state: GameState) {
  const acknowledged = new Set(state.ui.notifications.acknowledgedUpgradeIds)
  return CAREER_UPGRADE_DEFINITIONS.filter((definition) => {
    if (acknowledged.has(definition.id) || getCareerUpgradeLevel(state.careerUpgrades, definition.id) > 0) return false
    const status = getCareerUpgradeStatus(definition, { career: state.career, money: state.money, upgrades: state.careerUpgrades })
    return status.levelMet && status.activityMet && status.prerequisitesMet && !status.isMaxLevel
  }).map((definition) => definition.id)
}

function getCareerNotifications(state: GameState): GameNotification[] {
  return getNewlyUnlockedUpgradeIds(state).map((id) => ({
    id: `upgrade:${id}`,
    kind: 'new' as const,
    label: `${CAREER_UPGRADE_DEFINITIONS.find((definition) => definition.id === id)?.name ?? 'Career upgrade'} unlocked`,
    path: '/career',
  }))
}

function getDropJournalNotifications(state: GameState): GameNotification[] {
  const read = new Set(state.ui.notifications.readDropJournalEntryIds)
  return state.dropJournal.entries.filter((entry) => !read.has(entry.id)).map((entry) => ({
    id: `journal:${entry.id}`,
    kind: 'new' as const,
    label: `New journal record: ${entry.weapon} | ${entry.finish}`,
    path: '/quests?tab=completed',
  }))
}

export function getGameNotifications(state: GameState) {
  return [
    ...getAchievementNotifications(state),
    ...getQuestNotifications(state),
    ...getBusinessNotifications(state),
    ...getCswearNotifications(state),
    ...getPrestigeNotifications(state),
    ...getCareerNotifications(state),
    ...getDropJournalNotifications(state),
  ]
}

export function getNotificationsForPath(state: GameState, path: string) {
  const normalized = path.split('?')[0]
  const direct = getGameNotifications(state).filter((notification) => notification.path.split('?')[0] === normalized)
  const unique = new Map(direct.map((notification) => [notification.id, notification]))
  return [...unique.values()]
}

export function getNotificationCountForPath(state: GameState, path: string) {
  return getNotificationsForPath(state, path).length
}

export function getNotificationCountForPaths(state: GameState, paths: string[]) {
  const notifications = paths.flatMap((path) => getNotificationsForPath(state, path))
  return new Set(notifications.map((notification) => notification.id)).size
}

import {
  DailyChallengeType,
  DailyRewardKind,
  Rarity,
  type CaseDefinition,
  type DailyChallenge,
  type DailyChallengeReward,
  type DailyRewardDefinition,
  type DailyRewardsState,
} from '../data/models'

export const DAILY_REWARD_DISCOUNT_DURATION_MS = 24 * 60 * 60 * 1_000
export const DAILY_FREE_REROLLS = 1
export const MAX_OPENING_CREDIT_BALANCE = 20

export type DailyChallengeProgressEvent =
  | { type: 'cases_opened'; amount: number; caseId?: string; sessionId?: string }
  | { type: 'opening_session'; sessionId: string }
  | { type: 'skins_discovered'; skinIds: string[] }
  | { type: 'career_xp'; amount: number }
  | { type: 'collection_size'; amount: number }
  | { type: 'sell_value'; amount: number }
  | { type: 'rarity_obtained'; rarity: Rarity; amount?: number }
  | { type: 'trade_ups_completed'; amount: number }

export const DAILY_REWARD_SEQUENCE: DailyRewardDefinition[] = [
  {
    day: 1,
    kind: DailyRewardKind.Money,
    label: '$1 cash drop',
    money: 1,
    openingCredits: 2,
  },
  {
    day: 2,
    kind: DailyRewardKind.CaseDiscountBuff,
    label: '5% case discount',
    caseDiscountPercent: 0.05,
    durationMs: DAILY_REWARD_DISCOUNT_DURATION_MS,
  },
  {
    day: 3,
    kind: DailyRewardKind.RandomSkin,
    label: 'Random collection skin',
  },
  {
    day: 4,
    kind: DailyRewardKind.Money,
    label: '$10 bankroll boost',
    money: 10,
    openingCredits: 2,
  },
  {
    day: 5,
    kind: DailyRewardKind.CaseDiscountBuff,
    label: '10% case discount',
    caseDiscountPercent: 0.1,
    durationMs: DAILY_REWARD_DISCOUNT_DURATION_MS,
  },
  {
    day: 6,
    kind: DailyRewardKind.RandomSkin,
    label: 'Random Classified skin',
    skinRarity: Rarity.Classified,
  },
  {
    day: 7,
    kind: DailyRewardKind.RareCase,
    label: 'Legacy Rare Case access',
    caseId: 'legacy_rare_case',
  },
]

type ChallengeTemplate = {
  type: DailyChallengeType
  title: string
  description: string
  target: number
  reward: DailyChallengeReward
  rarity?: Rarity
}

const openingChallengeTemplates: ChallengeTemplate[] = [
  {
    type: DailyChallengeType.OpenCases,
    title: 'Open 3 cases',
    description: 'Open any three eligible cases today.',
    target: 3,
    reward: { openingCredits: 2 },
  },
  {
    type: DailyChallengeType.DiscoverSkins,
    title: 'Discover 2 skins',
    description: 'Add two new skin finishes to your collection book.',
    target: 2,
    reward: { openingCredits: 2 },
  },
  {
    type: DailyChallengeType.OpenDifferentCases,
    title: 'Try 2 different cases',
    description: 'Open at least one item from two different case types.',
    target: 2,
    reward: { money: 2, openingCredits: 1.5 },
  },
  {
    type: DailyChallengeType.CompleteOpeningSessions,
    title: 'Complete 2 opening sessions',
    description: 'Finish two separate manual case-opening sessions.',
    target: 2,
    reward: { openingCredits: 1.5 },
  },
  {
    type: DailyChallengeType.EarnCareerXp,
    title: 'Earn 120 Career XP',
    description: 'Make meaningful progress through openings and discoveries.',
    target: 120,
    reward: { openingCredits: 2 },
  },
  {
    type: DailyChallengeType.CollectionMilestone,
    title: 'Grow your collection to 5',
    description: 'Reach five unique skin finishes in your collection book.',
    target: 5,
    reward: { openingCredits: 2 },
  },
]

const supportChallengeTemplates: ChallengeTemplate[] = [
  {
    type: DailyChallengeType.SellValue,
    title: 'Sell $25 in skins',
    description: 'Sell skins worth $25 through any supported selling method.',
    target: 25,
    reward: { money: 4 },
  },
  {
    type: DailyChallengeType.CompleteTradeUps,
    title: 'Complete a trade-up',
    description: 'Finish one valid trade-up contract.',
    target: 1,
    reward: { money: 5 },
  },
  {
    type: DailyChallengeType.ObtainRarity,
    title: 'Find a Restricted item',
    description: 'Pull or trade into any Restricted skin.',
    target: 1,
    rarity: Rarity.Restricted,
    reward: { money: 6 },
  },
]

const challengeTemplates = [...openingChallengeTemplates, ...supportChallengeTemplates]

function roundCurrency(value: number) {
  return Number(value.toFixed(2))
}

function getLocalDayStart(value: number) {
  const date = new Date(value)

  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function getLocalDayKey(value = Date.now()) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function getPreviousLocalDayKey(value = Date.now()) {
  const date = new Date(getLocalDayStart(value))

  date.setDate(date.getDate() - 1)

  return getLocalDayKey(date.getTime())
}

export function getNextLocalResetTime(value = Date.now()) {
  const date = new Date(getLocalDayStart(value))

  date.setDate(date.getDate() + 1)

  return date.getTime()
}

function getDayKeyHash(dayKey: string) {
  return [...dayKey].reduce((hash, character) => {
    return (hash * 31 + character.charCodeAt(0)) % 10_000
  }, 7)
}

function createChallengeId(dayKey: string, templateIndex: number) {
  return `${dayKey}:${templateIndex}`
}

function createChallenge(templateIndex: number, dayKey: string, generatedAt: number): DailyChallenge {
  const template = challengeTemplates[templateIndex]

  return {
    id: createChallengeId(dayKey, templateIndex),
    type: template.type,
    title: template.title,
    description: template.description,
    target: template.target,
    progress: 0,
    reward: template.reward,
    isClaimed: false,
    rarity: template.rarity,
    generatedAt,
  }
}

export function generateDailyChallenges(dayKey = getLocalDayKey(), generatedAt = Date.now()) {
  const hash = getDayKeyHash(dayKey)
  const openingStart = hash % openingChallengeTemplates.length
  const openingIndices = Array.from({ length: 3 }, (_, index) => (
    (openingStart + index) % openingChallengeTemplates.length
  ))
  const supportIndex = openingChallengeTemplates.length + (hash % supportChallengeTemplates.length)

  return [...openingIndices, supportIndex].map((templateIndex) => createChallenge(templateIndex, dayKey, generatedAt))
}

export function createDefaultDailyRewardsState(now = Date.now()): DailyRewardsState {
  const dayKey = getLocalDayKey(now)

  return {
    streak: 0,
    lastClaimTime: 0,
    lastChallengeResetDayKey: dayKey,
    freeRerollDayKey: dayKey,
    freeRerollsUsed: 0,
    openingCredits: 0,
    challenges: generateDailyChallenges(dayKey, now),
  }
}

export function getDailyRewardForStreak(streak: number) {
  const sequenceIndex = Math.max(0, (Math.max(1, streak) - 1) % DAILY_REWARD_SEQUENCE.length)

  return DAILY_REWARD_SEQUENCE[sequenceIndex]
}

export function getNextDailyRewardInfo(dailyRewards: DailyRewardsState, now = Date.now()) {
  const todayKey = getLocalDayKey(now)
  const yesterdayKey = getPreviousLocalDayKey(now)
  const alreadyClaimedToday = Boolean(
    dailyRewards.lastClaimDayKey && dailyRewards.lastClaimDayKey >= todayKey,
  )
  const nextStreak = alreadyClaimedToday
    ? dailyRewards.streak
    : dailyRewards.lastClaimDayKey === yesterdayKey
      ? dailyRewards.streak + 1
      : 1

  return {
    alreadyClaimedToday,
    nextResetAt: getNextLocalResetTime(now),
    nextStreak,
    reward: getDailyRewardForStreak(nextStreak),
    todayKey,
  }
}

export function refreshDailyRewardsState(
  dailyRewards: DailyRewardsState,
  now = Date.now(),
): DailyRewardsState {
  const todayKey = getLocalDayKey(now)
  const caseDiscountBuff =
    dailyRewards.caseDiscountBuff && dailyRewards.caseDiscountBuff.expiresAt > now
      ? dailyRewards.caseDiscountBuff
      : undefined

  if (dailyRewards.lastChallengeResetDayKey >= todayKey) {
    return {
      ...dailyRewards,
      caseDiscountBuff,
      freeRerollDayKey: dailyRewards.freeRerollDayKey ?? todayKey,
      freeRerollsUsed:
        dailyRewards.freeRerollDayKey && dailyRewards.freeRerollDayKey >= todayKey
          ? dailyRewards.freeRerollsUsed
          : 0,
    }
  }

  return {
    ...dailyRewards,
    caseDiscountBuff,
    lastChallengeResetDayKey: todayKey,
    freeRerollDayKey: todayKey,
    freeRerollsUsed: 0,
    challenges: generateDailyChallenges(todayKey, now),
  }
}

export function applyDailyChallengeProgress(
  challenges: DailyChallenge[],
  progressEvent: DailyChallengeProgressEvent,
) {
  return challenges.map((challenge) => {
    if (challenge.isClaimed || challenge.progress >= challenge.target) {
      return challenge
    }

    const progressResult = getChallengeProgress(challenge, progressEvent)

    if (progressResult.amount <= 0) {
      return challenge
    }

    return {
      ...challenge,
      progress: Math.min(challenge.target, roundCurrency(challenge.progress + progressResult.amount)),
      progressKeys: progressResult.progressKeys ?? challenge.progressKeys,
    }
  })
}

function addUniqueProgressKeys(challenge: DailyChallenge, keys: string[]) {
  const existingKeys = new Set(challenge.progressKeys ?? [])
  const newKeys = [...new Set(keys)].filter((key) => key && !existingKeys.has(key))

  return {
    amount: newKeys.length,
    progressKeys: [...existingKeys, ...newKeys].slice(-100),
  }
}

function getChallengeProgress(
  challenge: DailyChallenge,
  progressEvent: DailyChallengeProgressEvent,
): { amount: number; progressKeys?: string[] } {
  if (challenge.type === DailyChallengeType.OpenCases && progressEvent.type === 'cases_opened') {
    return { amount: progressEvent.amount }
  }

  if (challenge.type === DailyChallengeType.OpenDifferentCases && progressEvent.type === 'cases_opened') {
    return progressEvent.caseId
      ? addUniqueProgressKeys(challenge, [progressEvent.caseId])
      : { amount: 0 }
  }

  if (challenge.type === DailyChallengeType.CompleteOpeningSessions && progressEvent.type === 'opening_session') {
    return addUniqueProgressKeys(challenge, [progressEvent.sessionId])
  }

  if (challenge.type === DailyChallengeType.DiscoverSkins && progressEvent.type === 'skins_discovered') {
    return addUniqueProgressKeys(challenge, progressEvent.skinIds)
  }

  if (challenge.type === DailyChallengeType.EarnCareerXp && progressEvent.type === 'career_xp') {
    return { amount: progressEvent.amount }
  }

  if (challenge.type === DailyChallengeType.CollectionMilestone && progressEvent.type === 'collection_size') {
    return { amount: Math.max(0, progressEvent.amount - challenge.progress) }
  }

  if (challenge.type === DailyChallengeType.SellValue && progressEvent.type === 'sell_value') {
    return { amount: progressEvent.amount }
  }

  if (challenge.type === DailyChallengeType.CompleteTradeUps && progressEvent.type === 'trade_ups_completed') {
    return { amount: progressEvent.amount }
  }

  if (challenge.type === DailyChallengeType.ObtainRarity && progressEvent.type === 'rarity_obtained') {
    return { amount: progressEvent.rarity === challenge.rarity ? progressEvent.amount ?? 1 : 0 }
  }

  return { amount: 0 }
}

export function addOpeningCredits(currentBalance: number, amount: number) {
  return roundCurrency(Math.min(
    MAX_OPENING_CREDIT_BALANCE,
    Math.max(0, currentBalance) + Math.max(0, amount),
  ))
}

export function getOpeningCreditQuote(caseCost: number, creditBalance: number, quantity = 1) {
  const safeQuantity = Math.max(1, Math.floor(quantity))
  const fullCost = roundCurrency(Math.max(0, caseCost) * safeQuantity)
  const eligible = fullCost > 0 && creditBalance > 0
  const creditUsed = roundCurrency(Math.min(Math.max(0, creditBalance), fullCost))

  return {
    eligible,
    fullCost,
    creditUsed,
    cashCost: roundCurrency(Math.max(0, fullCost - creditUsed)),
  }
}

export function getClaimableDailyChallenges(dailyRewards: DailyRewardsState) {
  return dailyRewards.challenges.filter((challenge) => {
    return !challenge.isClaimed && challenge.progress >= challenge.target
  })
}

export function markDailyChallengeClaimed(
  dailyRewards: DailyRewardsState,
  challengeId: string,
) {
  const challenge = dailyRewards.challenges.find((entry) => entry.id === challengeId)

  if (!challenge || challenge.isClaimed || challenge.progress < challenge.target) {
    return undefined
  }

  return {
    challenge,
    dailyRewards: {
      ...dailyRewards,
      challenges: dailyRewards.challenges.map((entry) => {
        if (entry.id !== challengeId) {
          return entry
        }

        return {
          ...entry,
          isClaimed: true,
        }
      }),
    },
  }
}

export function rerollDailyChallenge(
  dailyRewards: DailyRewardsState,
  challengeId: string,
  now = Date.now(),
) {
  const todayKey = getLocalDayKey(now)
  const refreshedState = refreshDailyRewardsState(dailyRewards, now)
  const freeRerollsUsed =
    refreshedState.freeRerollDayKey && refreshedState.freeRerollDayKey >= todayKey
      ? refreshedState.freeRerollsUsed
      : 0

  if (freeRerollsUsed >= DAILY_FREE_REROLLS) {
    return undefined
  }

  const challengeIndex = refreshedState.challenges.findIndex((challenge) => challenge.id === challengeId)

  if (challengeIndex < 0) {
    return undefined
  }

  if (refreshedState.challenges[challengeIndex]?.isClaimed) {
    return undefined
  }

  const activeChallengeTitles = new Set(refreshedState.challenges.map((challenge) => challenge.title))
  const replacementIndex = challengeTemplates.findIndex((template) => !activeChallengeTitles.has(template.title))

  if (replacementIndex < 0) {
    return undefined
  }

  const replacementChallenge = createChallenge(replacementIndex, todayKey, now)

  return {
    ...refreshedState,
    freeRerollDayKey: todayKey,
    freeRerollsUsed: freeRerollsUsed + 1,
    challenges: refreshedState.challenges.map((challenge, index) => {
      return index === challengeIndex ? replacementChallenge : challenge
    }),
  }
}

export function applyDailyCaseDiscountToCase(
  caseDef: CaseDefinition,
  dailyRewards: DailyRewardsState,
  now = Date.now(),
) {
  const buff = dailyRewards.caseDiscountBuff

  if (!buff || buff.expiresAt <= now || buff.percent <= 0) {
    return caseDef
  }

  return {
    ...caseDef,
    cost: Math.max(0.01, roundCurrency(caseDef.cost * (1 - Math.min(0.5, buff.percent)))),
  }
}

export function applyDailyRewardsToCases(
  caseDefinitions: CaseDefinition[],
  dailyRewards: DailyRewardsState,
  now = Date.now(),
) {
  return caseDefinitions.map((caseDef) => applyDailyCaseDiscountToCase(caseDef, dailyRewards, now))
}

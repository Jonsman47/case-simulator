import { nanoid } from 'nanoid'
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

export type DailyChallengeProgressEvent =
  | { type: 'cases_opened'; amount: number }
  | { type: 'sell_value'; amount: number }
  | { type: 'rarity_obtained'; rarity: Rarity; amount?: number }
  | { type: 'trade_ups_completed'; amount: number }

export const DAILY_REWARD_SEQUENCE: DailyRewardDefinition[] = [
  {
    day: 1,
    kind: DailyRewardKind.Money,
    label: '$1 cash drop',
    money: 1,
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

const challengeTemplates: Array<{
  type: DailyChallengeType
  title: string
  description: string
  target: number
  reward: DailyChallengeReward
  rarity?: Rarity
}> = [
  {
    type: DailyChallengeType.OpenCases,
    title: 'Open 50 cases',
    description: 'Crack open any 50 cases today.',
    target: 50,
    reward: { money: 30 },
  },
  {
    type: DailyChallengeType.SellValue,
    title: 'Sell $100 in skins',
    description: 'Manually, bulk, or auto-sell items worth $100 total.',
    target: 100,
    reward: { money: 40 },
  },
  {
    type: DailyChallengeType.ObtainRarity,
    title: 'Obtain a Classified item',
    description: 'Pull or trade into any Classified skin.',
    target: 1,
    rarity: Rarity.Classified,
    reward: { money: 60 },
  },
  {
    type: DailyChallengeType.CompleteTradeUps,
    title: 'Complete 2 trade-ups',
    description: 'Finish two valid trade-up contracts.',
    target: 2,
    reward: { money: 75 },
  },
  {
    type: DailyChallengeType.OpenCases,
    title: 'Open 10 cases',
    description: 'Warm up with any 10 case openings.',
    target: 10,
    reward: { money: 8 },
  },
  {
    type: DailyChallengeType.ObtainRarity,
    title: 'Obtain a Covert item',
    description: 'Pull or trade into any Covert skin.',
    target: 1,
    rarity: Rarity.Covert,
    reward: {
      money: 150,
      caseDiscountPercent: 0.05,
      durationMs: DAILY_REWARD_DISCOUNT_DURATION_MS,
    },
  },
]

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
  return `${dayKey}:${templateIndex}:${nanoid(6)}`
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
  const startIndex = getDayKeyHash(dayKey) % challengeTemplates.length
  const indices = Array.from({ length: challengeTemplates.length }, (_, index) => {
    return (startIndex + index) % challengeTemplates.length
  })

  return indices.slice(0, 4).map((templateIndex) => createChallenge(templateIndex, dayKey, generatedAt))
}

export function createDefaultDailyRewardsState(now = Date.now()): DailyRewardsState {
  const dayKey = getLocalDayKey(now)

  return {
    streak: 0,
    lastClaimTime: 0,
    lastChallengeResetDayKey: dayKey,
    freeRerollDayKey: dayKey,
    freeRerollsUsed: 0,
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
  const alreadyClaimedToday = dailyRewards.lastClaimDayKey === todayKey
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

  if (dailyRewards.lastChallengeResetDayKey === todayKey) {
    return {
      ...dailyRewards,
      caseDiscountBuff,
      freeRerollDayKey: dailyRewards.freeRerollDayKey ?? todayKey,
      freeRerollsUsed: dailyRewards.freeRerollDayKey === todayKey ? dailyRewards.freeRerollsUsed : 0,
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

    const progressAmount = getChallengeProgressAmount(challenge, progressEvent)

    if (progressAmount <= 0) {
      return challenge
    }

    return {
      ...challenge,
      progress: Math.min(challenge.target, roundCurrency(challenge.progress + progressAmount)),
    }
  })
}

function getChallengeProgressAmount(
  challenge: DailyChallenge,
  progressEvent: DailyChallengeProgressEvent,
) {
  if (challenge.type === DailyChallengeType.OpenCases && progressEvent.type === 'cases_opened') {
    return progressEvent.amount
  }

  if (challenge.type === DailyChallengeType.SellValue && progressEvent.type === 'sell_value') {
    return progressEvent.amount
  }

  if (challenge.type === DailyChallengeType.CompleteTradeUps && progressEvent.type === 'trade_ups_completed') {
    return progressEvent.amount
  }

  if (challenge.type === DailyChallengeType.ObtainRarity && progressEvent.type === 'rarity_obtained') {
    return progressEvent.rarity === challenge.rarity ? progressEvent.amount ?? 1 : 0
  }

  return 0
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
  const freeRerollsUsed = refreshedState.freeRerollDayKey === todayKey ? refreshedState.freeRerollsUsed : 0

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

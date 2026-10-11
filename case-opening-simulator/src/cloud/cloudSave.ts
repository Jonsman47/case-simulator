import { defaultDropsByRarity, type GameState } from '../data/gameState'
import { Rarity, type AchievementProgress, type CollectionEntry, type SkinInstance } from '../data/models'
import {
  CURRENT_SAVE_VERSION,
  createSaveEnvelope,
  parseGameSaveText,
  serializeGameState,
  type SaveEnvelope,
} from '../utils/save'
import { getInventoryValue } from '../utils/inventory'

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

export interface CloudUser {
  id: string
  email: string
  username?: string
  isAnonymous?: boolean
}

export interface CloudSession {
  accessToken: string
  refreshToken?: string
  user: CloudUser
}

export interface CloudSaveRecord {
  envelope: SaveEnvelope
  revision: number
  updatedAt: number
}

export interface LeaderboardEntry {
  casesOpened: number
  inventoryValue: number
  prestigeLevel: number
  totalProfit: number
  updatedAt: number
  userId: string
  username: string
}

export interface CloudBackend {
  forceOffline?: boolean
  getSession: () => Promise<CloudSession | null>
  signUp: (email: string, password: string, username?: string) => Promise<CloudSession>
  login: (email: string, password: string) => Promise<CloudSession>
  logout: (session: CloudSession) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  loadSave: (session: CloudSession) => Promise<CloudSaveRecord | null>
  saveSave: (session: CloudSession, envelope: SaveEnvelope, revision?: number) => Promise<CloudSaveRecord>
  listLeaderboard: (metric: LeaderboardMetric) => Promise<LeaderboardEntry[]>
}

export type LeaderboardMetric = 'inventoryValue' | 'prestigeLevel' | 'casesOpened' | 'totalProfit'

interface StoredAccount {
  email: string
  id: string
  passwordHash: string
  save?: CloudSaveRecord
  username?: string
}

const localCloudStorageKey = 'case-opening-simulator:mock-cloud'
const localCloudSessionKey = 'case-opening-simulator:mock-cloud-session'
const supabaseSessionKey = 'case-opening-simulator:supabase-session'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeEmail(email: string) {
  return email.trim().toLowerCase()
}

function getUserDisplayName(user: CloudUser) {
  return user.username?.trim() || user.email.split('@')[0] || 'Anonymous'
}

async function hashPassword(password: string) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)

  if (globalThis.crypto?.subtle) {
    const hash = await globalThis.crypto.subtle.digest('SHA-256', data)

    return Array.from(new Uint8Array(hash))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  }

  return btoa(password)
}

function createSession(account: StoredAccount): CloudSession {
  return {
    accessToken: `local-${account.id}-${Date.now()}`,
    user: {
      email: account.email,
      id: account.id,
      username: account.username,
    },
  }
}

function readJson<TValue>(key: string, fallback: TValue): TValue {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const text = window.localStorage.getItem(key)

    return text ? JSON.parse(text) as TValue : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

function normalizeSavedEnvelope(value: unknown): SaveEnvelope {
  if (isRecord(value) && typeof value.version === 'number' && 'state' in value) {
    const state = parseGameSaveText(JSON.stringify(value))

    return createSaveEnvelope(state)
  }

  throw new Error('Cloud save response did not contain a valid save envelope.')
}

export class LocalCloudBackend implements CloudBackend {
  forceOffline = false

  constructor(private readonly storageKey = localCloudStorageKey) {}

  async getSession() {
    if (this.forceOffline) {
      return null
    }

    const session = readJson<CloudSession | null>(localCloudSessionKey, null)

    if (!session) {
      return null
    }

    const accounts = this.readAccounts()

    return accounts[session.user.id] ? session : null
  }

  async signUp(email: string, password: string, username?: string) {
    this.assertOnline()

    const accounts = this.readAccounts()
    const normalizedEmail = safeEmail(email)
    const existingAccount = Object.values(accounts).find((account) => account.email === normalizedEmail)

    if (existingAccount) {
      throw new Error('An account with this email already exists.')
    }

    const account: StoredAccount = {
      email: normalizedEmail,
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      passwordHash: await hashPassword(password),
      username,
    }

    accounts[account.id] = account
    this.writeAccounts(accounts)

    const session = createSession(account)
    writeJson(localCloudSessionKey, session)

    return session
  }

  async login(email: string, password: string) {
    this.assertOnline()

    const accounts = this.readAccounts()
    const normalizedEmail = safeEmail(email)
    const passwordHash = await hashPassword(password)
    const account = Object.values(accounts).find((entry) => entry.email === normalizedEmail)

    if (!account || account.passwordHash !== passwordHash) {
      throw new Error('Email or password is incorrect.')
    }

    const session = createSession(account)
    writeJson(localCloudSessionKey, session)

    return session
  }

  async logout() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(localCloudSessionKey)
    }
  }

  async requestPasswordReset(email: string) {
    this.assertOnline()

    const normalizedEmail = safeEmail(email)
    const account = Object.values(this.readAccounts()).find((entry) => entry.email === normalizedEmail)

    if (!account) {
      throw new Error('No account was found for that email.')
    }
  }

  async loadSave(session: CloudSession) {
    this.assertOnline()

    return this.readAccounts()[session.user.id]?.save ?? null
  }

  async saveSave(session: CloudSession, envelope: SaveEnvelope, revision = 0) {
    this.assertOnline()

    const accounts = this.readAccounts()
    const account = accounts[session.user.id]

    if (!account) {
      throw new Error('Cloud account was not found.')
    }

    const record: CloudSaveRecord = {
      envelope,
      revision: Math.max(revision, account.save?.revision ?? 0) + 1,
      updatedAt: Date.now(),
    }

    accounts[session.user.id] = {
      ...account,
      save: record,
    }
    this.writeAccounts(accounts)

    return record
  }

  async listLeaderboard(metric: LeaderboardMetric) {
    const accounts = this.readAccounts()

    return Object.values(accounts)
      .flatMap((account) => {
        if (!account.save) {
          return []
        }

        return [createLeaderboardEntry(account, account.save)]
      })
      .sort((left, right) => right[metric] - left[metric])
      .slice(0, 50)
  }

  private assertOnline() {
    if (this.forceOffline) {
      throw new Error('Cloud service is offline.')
    }
  }

  private readAccounts() {
    return readJson<Record<string, StoredAccount>>(this.storageKey, {})
  }

  private writeAccounts(accounts: Record<string, StoredAccount>) {
    writeJson(this.storageKey, accounts)
  }
}

export class SupabaseCloudBackend implements CloudBackend {
  constructor(
    private readonly supabaseUrl: string,
    private readonly anonKey: string,
  ) {}

  async getSession() {
    return readJson<CloudSession | null>(supabaseSessionKey, null)
  }

  async signUp(email: string, password: string, username?: string) {
    const response = await this.request<{ access_token?: string; refresh_token?: string; user?: { id: string; email?: string; user_metadata?: { username?: string } } }>(
      '/auth/v1/signup',
      {
        body: JSON.stringify({
          email: safeEmail(email),
          password,
          data: { username },
        }),
        method: 'POST',
      },
    )

    return this.persistSession(response, safeEmail(email), username)
  }

  async login(email: string, password: string) {
    const response = await this.request<{ access_token: string; refresh_token?: string; user: { id: string; email?: string; user_metadata?: { username?: string } } }>(
      '/auth/v1/token?grant_type=password',
      {
        body: JSON.stringify({
          email: safeEmail(email),
          password,
        }),
        method: 'POST',
      },
    )

    return this.persistSession(response, safeEmail(email))
  }

  async logout(session: CloudSession) {
    await this.request('/auth/v1/logout', {
      method: 'POST',
      token: session.accessToken,
    })

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(supabaseSessionKey)
    }
  }

  async requestPasswordReset(email: string) {
    await this.request('/auth/v1/recover', {
      body: JSON.stringify({ email: safeEmail(email) }),
      method: 'POST',
    })
  }

  async loadSave(session: CloudSession) {
    const rows = await this.request<{
      revision?: number
      save_data?: unknown
      updated_at?: string
    }[]>(
      `/rest/v1/game_saves?select=save_data,revision,updated_at&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
      {
        token: session.accessToken,
      },
    )
    const row = rows[0]

    if (!row?.save_data) {
      return null
    }

    return {
      envelope: normalizeSavedEnvelope(row.save_data),
      revision: typeof row.revision === 'number' ? row.revision : 0,
      updatedAt: row.updated_at ? Date.parse(row.updated_at) : Date.now(),
    }
  }

  async saveSave(session: CloudSession, envelope: SaveEnvelope, revision = 0) {
    const rows = await this.request<{
      revision?: number
      save_data?: unknown
      updated_at?: string
    }[]>(
      '/rest/v1/game_saves?on_conflict=user_id',
      {
        body: JSON.stringify({
          cases_opened: envelope.state.statistics.casesOpened,
          inventory_value: envelope.state.inventoryValue,
          prestige_level: envelope.state.prestigeLevel,
          revision: revision + 1,
          save_data: envelope,
          total_profit: envelope.state.statistics.moneyEarned - envelope.state.statistics.moneySpent,
          updated_at: new Date().toISOString(),
          user_id: session.user.id,
        }),
        headers: {
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        method: 'POST',
        token: session.accessToken,
      },
    )
    const row = rows[0]

    return {
      envelope: row?.save_data ? normalizeSavedEnvelope(row.save_data) : envelope,
      revision: typeof row?.revision === 'number' ? row.revision : revision + 1,
      updatedAt: row?.updated_at ? Date.parse(row.updated_at) : Date.now(),
    }
  }

  async listLeaderboard(metric: LeaderboardMetric) {
    const orderColumn = {
      casesOpened: 'cases_opened',
      inventoryValue: 'inventory_value',
      prestigeLevel: 'prestige_level',
      totalProfit: 'total_profit',
    }[metric]
    const rows = await this.request<{
      cases_opened?: number
      display_name?: string
      inventory_value?: number
      prestige_level?: number
      total_profit?: number
      updated_at?: string
      user_id?: string
    }[]>(
      `/rest/v1/leaderboard_entries?select=*&order=${orderColumn}.desc&limit=50`,
    )

    return rows.map((row) => ({
      casesOpened: row.cases_opened ?? 0,
      inventoryValue: row.inventory_value ?? 0,
      prestigeLevel: row.prestige_level ?? 0,
      totalProfit: row.total_profit ?? 0,
      updatedAt: row.updated_at ? Date.parse(row.updated_at) : Date.now(),
      userId: row.user_id ?? 'unknown',
      username: row.display_name ?? 'Anonymous',
    }))
  }

  private persistSession(
    response: { access_token?: string; refresh_token?: string; user?: { id: string; email?: string; user_metadata?: { username?: string } } },
    fallbackEmail: string,
    fallbackUsername?: string,
  ) {
    if (!response.access_token || !response.user?.id) {
      throw new Error('Authentication succeeded but no session was returned. Check email confirmation settings.')
    }

    const session: CloudSession = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      user: {
        email: response.user.email ?? fallbackEmail,
        id: response.user.id,
        username: response.user.user_metadata?.username ?? fallbackUsername,
      },
    }

    writeJson(supabaseSessionKey, session)

    return session
  }

  private async request<TValue>(
    path: string,
    options: RequestInit & { token?: string } = {},
  ): Promise<TValue> {
    const headers = new Headers(options.headers)

    headers.set('apikey', this.anonKey)
    headers.set('Content-Type', 'application/json')

    if (options.token) {
      headers.set('Authorization', `Bearer ${options.token}`)
    }

    const response = await fetch(`${this.supabaseUrl.replace(/\/$/, '')}${path}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')

      throw new Error(text || `Cloud request failed with status ${response.status}.`)
    }

    if (response.status === 204) {
      return undefined as TValue
    }

    return await response.json() as TValue
  }
}

export function createCloudBackend() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (typeof url === 'string' && url && typeof anonKey === 'string' && anonKey) {
    return new SupabaseCloudBackend(url, anonKey)
  }

  return new LocalCloudBackend()
}

export function mergeGameStates(localState: GameState, cloudState: GameState): GameState {
  const latestState = cloudState.lastSaved > localState.lastSaved ? cloudState : localState
  const mergedMarketValues = cloudState.lastSaved > localState.lastSaved
    ? { ...localState.marketValues, ...cloudState.marketValues }
    : { ...cloudState.marketValues, ...localState.marketValues }
  const inventory = mergeInventory(latestState.inventory, [])
  const statistics = {
    ...localState.statistics,
    auctionPurchases: Math.max(
      localState.statistics.auctionPurchases,
      cloudState.statistics.auctionPurchases,
    ),
    auctionSavings: Math.max(
      localState.statistics.auctionSavings,
      cloudState.statistics.auctionSavings,
    ),
    casesOpened: Math.max(localState.statistics.casesOpened, cloudState.statistics.casesOpened),
    drops: Math.max(localState.statistics.drops, cloudState.statistics.drops),
    dropsByRarity: Object.values(Rarity).reduce((counts, rarity) => ({
      ...counts,
      [rarity]: Math.max(
        localState.statistics.dropsByRarity[rarity] ?? 0,
        cloudState.statistics.dropsByRarity[rarity] ?? 0,
      ),
    }), defaultDropsByRarity),
    itemsSold: Math.max(localState.statistics.itemsSold, cloudState.statistics.itemsSold),
    moneyEarned: Math.max(localState.statistics.moneyEarned, cloudState.statistics.moneyEarned),
    moneySpent: Math.max(localState.statistics.moneySpent, cloudState.statistics.moneySpent),
    rareDrops: Math.max(localState.statistics.rareDrops, cloudState.statistics.rareDrops),
    tradeUpsCompleted: Math.max(localState.statistics.tradeUpsCompleted, cloudState.statistics.tradeUpsCompleted),
  }
  const inventoryValue = getInventoryValue(inventory, mergedMarketValues)

  return {
    ...latestState,
    achievements: mergeAchievements(localState.achievements, cloudState.achievements),
    autoSellRules: latestState.autoSellRules,
    casesUnlocked: mergeStrings(localState.casesUnlocked, cloudState.casesUnlocked),
    collectionBook: mergeCollectionBook(localState.collectionBook, cloudState.collectionBook),
    collectionRewards: [
      ...new Map(
        [...localState.collectionRewards, ...cloudState.collectionRewards].map((reward) => [reward.id, reward]),
      ).values(),
    ],
    favoriteCaseIds: mergeStrings(localState.favoriteCaseIds, cloudState.favoriteCaseIds),
    hasUsedFirstCaseHook: localState.hasUsedFirstCaseHook || cloudState.hasUsedFirstCaseHook,
    inventory,
    inventoryValue,
    lastOpenedItems: mergeInventory(latestState.lastOpenedItems, []).slice(0, 100),
    lastSaved: Math.max(localState.lastSaved, cloudState.lastSaved, Date.now()),
    learnedSkillNodeIds: mergeStrings(localState.learnedSkillNodeIds, cloudState.learnedSkillNodeIds),
    marketHistory: {
      ...cloudState.marketHistory,
      ...localState.marketHistory,
    },
    marketValues: mergedMarketValues,
    money: latestState.money,
    prestigeBonuses: mergeNumberRecord(localState.prestigeBonuses, cloudState.prestigeBonuses),
    prestigeLevel: Math.max(localState.prestigeLevel, cloudState.prestigeLevel),
    prestigePoints: Math.max(localState.prestigePoints, cloudState.prestigePoints),
    recentDrops: mergeInventory(latestState.recentDrops, []).slice(0, 20),
    skillPoints: Math.max(localState.skillPoints, cloudState.skillPoints),
    specialEventCaseIds: mergeStrings(localState.specialEventCaseIds, cloudState.specialEventCaseIds),
    statistics,
    trophyAssignments: latestState.trophyAssignments,
    uiEvents: [],
    upgradePoints: Math.max(localState.upgradePoints, cloudState.upgradePoints),
    upgrades: mergeNumberRecord(localState.upgrades, cloudState.upgrades),
  }
}

export function createCloudSaveEnvelope(state: GameState) {
  return createSaveEnvelope({
    ...state,
    uiEvents: [],
  })
}

export function parseCloudSaveEnvelope(envelope: SaveEnvelope) {
  if (envelope.version > CURRENT_SAVE_VERSION) {
    throw new Error('Cloud save was created by a newer game version.')
  }

  return parseGameSaveText(JSON.stringify(envelope))
}

export function createLeaderboardEntry(account: Pick<StoredAccount, 'id' | 'email' | 'username'>, save: CloudSaveRecord): LeaderboardEntry {
  const state = parseCloudSaveEnvelope(save.envelope)
  const totalProfit = state.statistics.moneyEarned - state.statistics.moneySpent

  return {
    casesOpened: state.statistics.casesOpened,
    inventoryValue: state.inventoryValue,
    prestigeLevel: state.prestigeLevel,
    totalProfit,
    updatedAt: save.updatedAt,
    userId: account.id,
    username: account.username || account.email.split('@')[0] || 'Anonymous',
  }
}

export function getCloudUserDisplayName(user: CloudUser) {
  return getUserDisplayName(user)
}

function mergeStrings<TValue extends string>(left: TValue[], right: TValue[]) {
  return Array.from(new Set([...left, ...right]))
}

function mergeNumberRecord<TValue extends string>(
  left: Partial<Record<TValue, number>>,
  right: Partial<Record<TValue, number>>,
) {
  return Array.from(new Set([...Object.keys(left), ...Object.keys(right)] as TValue[])).reduce<Partial<Record<TValue, number>>>(
    (record, key) => {
      record[key] = Math.max(left[key] ?? 0, right[key] ?? 0)

      return record
    },
    {},
  )
}

function mergeInventory(left: SkinInstance[], right: SkinInstance[]) {
  return Array.from(
    new Map(
      [...right, ...left]
        .sort((a, b) => b.discoveredAt - a.discoveredAt)
        .map((item) => [item.instanceId, item]),
    ).values(),
  ).sort((a, b) => b.discoveredAt - a.discoveredAt)
}

function mergeAchievements(left: AchievementProgress[], right: AchievementProgress[]) {
  const byId = new Map<string, AchievementProgress>()

  for (const achievement of [...left, ...right]) {
    const existing = byId.get(achievement.id)

    byId.set(achievement.id, existing
      ? {
          id: achievement.id,
          isClaimed: existing.isClaimed || achievement.isClaimed,
          unlockedAt: Math.min(existing.unlockedAt, achievement.unlockedAt),
        }
      : achievement)
  }

  return Array.from(byId.values())
}

function mergeCollectionBook(left: CollectionEntry[], right: CollectionEntry[]) {
  const bySkinId = new Map<string, CollectionEntry>()

  for (const entry of [...left, ...right]) {
    const existing = bySkinId.get(entry.skinId)

    bySkinId.set(entry.skinId, existing
      ? {
          skinId: entry.skinId,
          bestFloat: Math.min(existing.bestFloat ?? Number.POSITIVE_INFINITY, entry.bestFloat ?? Number.POSITIVE_INFINITY),
          firstFoundAt: Math.min(existing.firstFoundAt, entry.firstFoundAt),
          foundWearConditions: mergeStrings(existing.foundWearConditions, entry.foundWearConditions),
          highestValue: Math.max(existing.highestValue ?? 0, entry.highestValue ?? 0),
          timesFound: Math.max(existing.timesFound, entry.timesFound),
        }
      : entry)
  }

  return Array.from(bySkinId.values())
}

export function isOfflineError(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof Error && /offline|network|fetch|failed/i.test(error.message))
  )
}

export function serializeCloudSaveForDebug(state: GameState) {
  return serializeGameState(state)
}

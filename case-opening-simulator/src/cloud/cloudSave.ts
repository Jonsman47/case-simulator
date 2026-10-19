import type { GameState } from '../data/gameState'
import { Rarity, type SkinInstance } from '../data/models'
import {
  CURRENT_SAVE_VERSION,
  createSaveEnvelope,
  parseGameSaveText,
  serializeGameState,
  type SaveEnvelope,
} from '../utils/save'
import { getCurrentItemMarketValue, getInventoryValue } from '../utils/inventory'

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'conflict' | 'error'

export interface CloudUser {
  id: string
  email: string
  username?: string
  isAnonymous?: boolean
}

export interface CloudSession {
  accessToken: string
  expiresAt?: number
  refreshToken?: string
  user: CloudUser
}

export interface CloudSaveRecord {
  envelope: SaveEnvelope
  revision: number
  updatedAt: number
}

export interface LeaderboardEntry {
  achievementCount: number
  casesOpened: number
  inventoryValue: number
  mostValuableSkin: number
  prestigeLevel: number
  rarePatterns: number
  totalProfit: number
  updatedAt: number
  userId: string
  username: string
}

export interface CloudProfile {
  avatarKey: string
  createdAt: number
  displayName: string
  isProfilePublic: boolean
  isTrophyShowcasePublic: boolean
  updatedAt: number
  userId: string
}

export interface PublicTrophyItem {
  baseMarketValue?: number
  finish: string
  floatValue: number
  image: string
  instanceId: string
  marketValue: number
  paintSeed?: number
  pattern?: SkinInstance['pattern']
  rarity: Rarity
  statTrak?: boolean
  souvenir?: boolean
  wear: SkinInstance['wear']
  weapon: string
}

export interface PublicPlayerSummary extends LeaderboardEntry {
  avatarKey: string
  createdAt: number
  trophyItems: PublicTrophyItem[]
}

export interface CloudConflict {
  localState: GameState
  remoteRecord: CloudSaveRecord
  remoteState: GameState
}

export type CloudConflictResolution = 'keep-local' | 'use-cloud'

export class CloudRevisionConflictError extends Error {
  constructor(public readonly remoteRecord: CloudSaveRecord | null) {
    super('Cloud save changed on another device. Choose which version to keep.')
    this.name = 'CloudRevisionConflictError'
  }
}

export interface CloudBackend {
  forceOffline?: boolean
  getSession: () => Promise<CloudSession | null>
  signUp: (email: string, password: string, username?: string) => Promise<CloudSession>
  login: (email: string, password: string) => Promise<CloudSession>
  logout: (session: CloudSession) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  getProfile: (session: CloudSession) => Promise<CloudProfile>
  updateProfile: (session: CloudSession, profile: Pick<CloudProfile, 'avatarKey' | 'displayName' | 'isProfilePublic' | 'isTrophyShowcasePublic'>) => Promise<CloudProfile>
  getPublicProfile: (userId: string, session?: CloudSession | null) => Promise<PublicPlayerSummary | null>
  publishPlayerSummary: (session: CloudSession, summary: PublicPlayerSummary) => Promise<void>
  loadSave: (session: CloudSession) => Promise<CloudSaveRecord | null>
  saveSave: (session: CloudSession, envelope: SaveEnvelope, revision?: number) => Promise<CloudSaveRecord>
  listLeaderboard: (metric: LeaderboardMetric) => Promise<LeaderboardEntry[]>
}

export type LeaderboardMetric =
  | 'inventoryValue'
  | 'mostValuableSkin'
  | 'casesOpened'
  | 'totalProfit'
  | 'prestigeLevel'
  | 'rarePatterns'
  | 'achievementCount'

interface StoredAccount {
  createdAt: number
  email: string
  id: string
  passwordHash: string
  profile: CloudProfile
  publicSummary?: PublicPlayerSummary
  save?: CloudSaveRecord
  username?: string
}

const localCloudStorageKey = 'case-opening-simulator:mock-cloud'
const localCloudSessionKey = 'case-opening-simulator:mock-cloud-session'
const supabaseSessionKey = 'case-opening-simulator:supabase-session'
const cloudGuestSaveKey = 'case-opening-simulator:guest-save'
const cloudAccountSaveKeyPrefix = 'case-opening-simulator:account-save:'
const cloudBackupKeyPrefix = 'case-opening-simulator:cloud-backup:'

interface AuthResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  user?: { id: string; email?: string; user_metadata?: { username?: string } }
}

interface ProfileRow {
  avatar_key?: string
  created_at?: string
  display_name?: string
  public_profile?: boolean
  public_trophy_room?: boolean
  updated_at?: string
  user_id?: string
}

interface PublicSummaryRow extends ProfileRow {
  achievement_count?: number
  cases_opened?: number
  inventory_value?: number
  most_valuable_skin?: number
  prestige_level?: number
  rare_patterns?: number
  total_profit?: number
  trophy_data?: unknown
}

export const CLOUD_DISPLAY_NAME_MIN_LENGTH = 3
export const CLOUD_DISPLAY_NAME_MAX_LENGTH = 24
export const CLOUD_AVATAR_KEYS = ['crosshair', 'case', 'knife', 'gloves', 'crown'] as const

export function normalizeDisplayName(value: string) {
  const displayName = value.trim().replace(/\s+/g, ' ')

  if (displayName.length < CLOUD_DISPLAY_NAME_MIN_LENGTH || displayName.length > CLOUD_DISPLAY_NAME_MAX_LENGTH) {
    throw new Error(`Display name must be ${CLOUD_DISPLAY_NAME_MIN_LENGTH}–${CLOUD_DISPLAY_NAME_MAX_LENGTH} characters.`)
  }

  if (!/^[A-Za-z0-9 _-]+$/.test(displayName)) {
    throw new Error('Display name may contain letters, numbers, spaces, underscores, and hyphens only.')
  }

  return displayName
}

function normalizeAvatarKey(value: string) {
  return CLOUD_AVATAR_KEYS.includes(value as (typeof CLOUD_AVATAR_KEYS)[number]) ? value : 'crosshair'
}

function mapProfileRow(row: ProfileRow): CloudProfile {
  return {
    avatarKey: normalizeAvatarKey(row.avatar_key ?? 'crosshair'),
    createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
    displayName: row.display_name ?? 'Anonymous',
    isProfilePublic: Boolean(row.public_profile),
    isTrophyShowcasePublic: Boolean(row.public_trophy_room),
    updatedAt: row.updated_at ? Date.parse(row.updated_at) : Date.now(),
    userId: row.user_id ?? 'unknown',
  }
}

function isPublicTrophyItem(value: unknown): value is PublicTrophyItem {
  return isRecord(value) && typeof value.instanceId === 'string' && typeof value.weapon === 'string' && typeof value.finish === 'string'
}

function mapPublicSummaryRow(row: PublicSummaryRow): PublicPlayerSummary {
  return {
    achievementCount: row.achievement_count ?? 0,
    avatarKey: normalizeAvatarKey(row.avatar_key ?? 'crosshair'),
    casesOpened: row.cases_opened ?? 0,
    createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
    inventoryValue: row.inventory_value ?? 0,
    mostValuableSkin: row.most_valuable_skin ?? 0,
    prestigeLevel: row.prestige_level ?? 0,
    rarePatterns: row.rare_patterns ?? 0,
    totalProfit: row.total_profit ?? 0,
    trophyItems: Array.isArray(row.trophy_data) ? row.trophy_data.filter(isPublicTrophyItem).slice(0, 16) : [],
    updatedAt: row.updated_at ? Date.parse(row.updated_at) : Date.now(),
    userId: row.user_id ?? 'unknown',
    username: row.display_name ?? 'Anonymous',
  }
}

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

  throw new Error('Secure password hashing is unavailable in this browser.')
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

function createDefaultProfile(userId: string, username: string | undefined, createdAt = Date.now()): CloudProfile {
  return {
    avatarKey: 'crosshair',
    createdAt,
    displayName: username?.trim() || 'Anonymous',
    isProfilePublic: false,
    isTrophyShowcasePublic: false,
    updatedAt: createdAt,
    userId,
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
    const displayName = normalizeDisplayName(username ?? normalizedEmail.split('@')[0] ?? 'Player')

    if (existingAccount) {
      throw new Error('An account with this email already exists.')
    }

    if (Object.values(accounts).some((account) => account.profile.displayName.toLowerCase() === displayName.toLowerCase())) {
      throw new Error('That display name is already in use.')
    }

    const createdAt = Date.now()
    const id = `user-${createdAt}-${Math.random().toString(36).slice(2)}`

    const account: StoredAccount = {
      createdAt,
      email: normalizedEmail,
      id,
      passwordHash: await hashPassword(password),
      profile: createDefaultProfile(id, displayName, createdAt),
      username: displayName,
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

    // Match hosted-auth behavior: do not reveal whether an account exists.
    safeEmail(email)
  }

  async getProfile(session: CloudSession) {
    this.assertOnline()
    const account = this.readAccounts()[session.user.id]

    if (!account) {
      throw new Error('Cloud account was not found.')
    }

    return account.profile
  }

  async updateProfile(
    session: CloudSession,
    profile: Pick<CloudProfile, 'avatarKey' | 'displayName' | 'isProfilePublic' | 'isTrophyShowcasePublic'>,
  ) {
    this.assertOnline()
    const accounts = this.readAccounts()
    const account = accounts[session.user.id]

    if (!account) {
      throw new Error('Cloud account was not found.')
    }

    const displayName = normalizeDisplayName(profile.displayName)

    if (Object.values(accounts).some((candidate) => (
      candidate.id !== account.id && candidate.profile.displayName.toLowerCase() === displayName.toLowerCase()
    ))) {
      throw new Error('That display name is already in use.')
    }

    const nextProfile: CloudProfile = {
      ...account.profile,
      avatarKey: normalizeAvatarKey(profile.avatarKey),
      displayName,
      isProfilePublic: Boolean(profile.isProfilePublic),
      isTrophyShowcasePublic: Boolean(profile.isTrophyShowcasePublic),
      updatedAt: Date.now(),
    }

    accounts[account.id] = { ...account, profile: nextProfile, username: displayName }
    this.writeAccounts(accounts)
    const storedSession = readJson<CloudSession | null>(localCloudSessionKey, null)
    if (storedSession?.user.id === account.id) {
      writeJson(localCloudSessionKey, {
        ...storedSession,
        user: { ...storedSession.user, username: displayName },
      })
    }

    return nextProfile
  }

  async getPublicProfile(userId: string, session?: CloudSession | null) {
    this.assertOnline()
    const account = this.readAccounts()[userId]

    if (!account?.publicSummary || (!account.profile.isProfilePublic && session?.user.id !== userId)) {
      return null
    }

    return {
      ...account.publicSummary,
      trophyItems: account.profile.isTrophyShowcasePublic || session?.user.id === userId
        ? account.publicSummary.trophyItems
        : [],
    }
  }

  async publishPlayerSummary(session: CloudSession, summary: PublicPlayerSummary) {
    this.assertOnline()
    const accounts = this.readAccounts()
    const account = accounts[session.user.id]

    if (!account) {
      throw new Error('Cloud account was not found.')
    }

    accounts[account.id] = {
      ...account,
      publicSummary: {
        ...summary,
        trophyItems: account.profile.isTrophyShowcasePublic ? summary.trophyItems.slice(0, 16) : [],
        userId: account.id,
        username: account.profile.displayName,
      },
    }
    this.writeAccounts(accounts)
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

    const currentRevision = account.save?.revision ?? 0

    if (revision !== currentRevision) {
      throw new CloudRevisionConflictError(account.save ?? null)
    }

    const record: CloudSaveRecord = {
      envelope,
      revision: revision + 1,
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
        if (!account.profile.isProfilePublic || !account.publicSummary) {
          return []
        }

        return [account.publicSummary]
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
    const accounts = readJson<Record<string, StoredAccount>>(this.storageKey, {})

    return Object.fromEntries(Object.entries(accounts).map(([id, account]) => {
      const createdAt = account.createdAt ?? account.save?.updatedAt ?? Date.now()
      const profile = account.profile ?? createDefaultProfile(id, account.username, createdAt)

      return [id, { ...account, createdAt, profile }]
    }))
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
    const session = readJson<CloudSession | null>(supabaseSessionKey, null)

    if (!session) {
      return null
    }

    if (!session.expiresAt || session.expiresAt > Date.now() + 60_000) {
      return session
    }

    if (!session.refreshToken) {
      window.localStorage.removeItem(supabaseSessionKey)
      return null
    }

    const response = await this.request<AuthResponse>('/auth/v1/token?grant_type=refresh_token', {
      body: JSON.stringify({ refresh_token: session.refreshToken }),
      method: 'POST',
    })

    return this.persistSession(response, session.user.email, session.user.username)
  }

  async signUp(email: string, password: string, username?: string) {
    const displayName = normalizeDisplayName(username ?? safeEmail(email).split('@')[0] ?? 'Player')
    const response = await this.request<AuthResponse>(
      '/auth/v1/signup',
      {
        body: JSON.stringify({
          email: safeEmail(email),
          password,
          data: { username: displayName },
        }),
        method: 'POST',
      },
    )

    const session = this.persistSession(response, safeEmail(email), displayName)

    await this.updateProfile(session, {
      avatarKey: 'crosshair',
      displayName,
      isProfilePublic: false,
      isTrophyShowcasePublic: false,
    })

    return session
  }

  async login(email: string, password: string) {
    const response = await this.request<AuthResponse>(
      '/auth/v1/token?grant_type=password',
      {
        body: JSON.stringify({
          email: safeEmail(email),
          password,
        }),
        method: 'POST',
      },
    )

    const session = this.persistSession(response, safeEmail(email))

    try {
      const profile = await this.getProfile(session)
      session.user.username = profile.displayName
      writeJson(supabaseSessionKey, session)
    } catch {
      // The auth session remains usable if the optional profile migration is not installed yet.
    }

    return session
  }

  async logout(session: CloudSession) {
    try {
      await this.request('/auth/v1/logout', {
        method: 'POST',
        token: session.accessToken,
      })
    } finally {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(supabaseSessionKey)
      }
    }
  }

  async requestPasswordReset(email: string) {
    await this.request('/auth/v1/recover', {
      body: JSON.stringify({ email: safeEmail(email) }),
      method: 'POST',
    })
  }

  async getProfile(session: CloudSession) {
    const rows = await this.request<ProfileRow[]>(
      `/rest/v1/profiles?select=user_id,display_name,avatar_key,public_profile,public_trophy_room,created_at,updated_at&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
      { token: session.accessToken },
    )
    const row = rows[0]

    if (!row) {
      throw new Error('Player profile was not found. Apply the social cloud migration.')
    }

    return mapProfileRow(row)
  }

  async updateProfile(
    session: CloudSession,
    profile: Pick<CloudProfile, 'avatarKey' | 'displayName' | 'isProfilePublic' | 'isTrophyShowcasePublic'>,
  ) {
    const displayName = normalizeDisplayName(profile.displayName)
    const rows = await this.request<ProfileRow[]>('/rest/v1/profiles?on_conflict=user_id', {
      body: JSON.stringify({
        avatar_key: normalizeAvatarKey(profile.avatarKey),
        display_name: displayName,
        public_profile: Boolean(profile.isProfilePublic),
        public_trophy_room: Boolean(profile.isTrophyShowcasePublic),
        updated_at: new Date().toISOString(),
        user_id: session.user.id,
      }),
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      method: 'POST',
      token: session.accessToken,
    })
    const row = rows[0]

    if (!row) {
      throw new Error('Profile update did not return a record.')
    }
    const nextProfile = mapProfileRow(row)
    const storedSession = readJson<CloudSession | null>(supabaseSessionKey, null)
    if (storedSession?.user.id === session.user.id) {
      writeJson(supabaseSessionKey, {
        ...storedSession,
        user: { ...storedSession.user, username: nextProfile.displayName },
      })
    }

    return nextProfile
  }

  async getPublicProfile(userId: string, session?: CloudSession | null) {
    const rows = await this.request<PublicSummaryRow[]>(
      `/rest/v1/public_player_profiles?select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      { token: session?.accessToken },
    )

    return rows[0] ? mapPublicSummaryRow(rows[0]) : null
  }

  async publishPlayerSummary(session: CloudSession, summary: PublicPlayerSummary) {
    await this.request('/rest/v1/public_player_stats?on_conflict=user_id', {
      body: JSON.stringify({
        achievement_count: summary.achievementCount,
        cases_opened: summary.casesOpened,
        inventory_value: summary.inventoryValue,
        most_valuable_skin: summary.mostValuableSkin,
        prestige_level: summary.prestigeLevel,
        rare_patterns: summary.rarePatterns,
        total_profit: summary.totalProfit,
        updated_at: new Date(summary.updatedAt).toISOString(),
        user_id: session.user.id,
      }),
      headers: { Prefer: 'resolution=merge-duplicates' },
      method: 'POST',
      token: session.accessToken,
    })
    await this.request('/rest/v1/public_trophy_rooms?on_conflict=user_id', {
      body: JSON.stringify({
        trophy_data: summary.trophyItems.slice(0, 16),
        updated_at: new Date(summary.updatedAt).toISOString(),
        user_id: session.user.id,
      }),
      headers: { Prefer: 'resolution=merge-duplicates' },
      method: 'POST',
      token: session.accessToken,
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
    let rows: { revision?: number; save_data?: unknown; updated_at?: string }[]

    try {
      rows = await this.request('/rest/v1/rpc/save_game_if_revision', {
        body: JSON.stringify({
          p_expected_revision: revision,
          p_save_data: envelope,
        }),
        method: 'POST',
        token: session.accessToken,
      })
    } catch (error) {
      if (error instanceof Error && /revision[_ ]conflict/i.test(error.message)) {
        throw new CloudRevisionConflictError(await this.loadSave(session))
      }

      throw error
    }
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
      mostValuableSkin: 'most_valuable_skin',
      prestigeLevel: 'prestige_level',
      rarePatterns: 'rare_patterns',
      achievementCount: 'achievement_count',
      totalProfit: 'total_profit',
    }[metric]
    const rows = await this.request<{
      cases_opened?: number
      achievement_count?: number
      display_name?: string
      inventory_value?: number
      most_valuable_skin?: number
      prestige_level?: number
      rare_patterns?: number
      total_profit?: number
      updated_at?: string
      user_id?: string
    }[]>(
      `/rest/v1/leaderboard_entries?select=*&order=${orderColumn}.desc&limit=50`,
    )

    return rows.map((row) => ({
      achievementCount: row.achievement_count ?? 0,
      casesOpened: row.cases_opened ?? 0,
      inventoryValue: row.inventory_value ?? 0,
      mostValuableSkin: row.most_valuable_skin ?? 0,
      prestigeLevel: row.prestige_level ?? 0,
      rarePatterns: row.rare_patterns ?? 0,
      totalProfit: row.total_profit ?? 0,
      updatedAt: row.updated_at ? Date.parse(row.updated_at) : Date.now(),
      userId: row.user_id ?? 'unknown',
      username: row.display_name ?? 'Anonymous',
    }))
  }

  private persistSession(
    response: AuthResponse,
    fallbackEmail: string,
    fallbackUsername?: string,
  ) {
    if (!response.access_token || !response.user?.id) {
      throw new Error('Authentication succeeded but no session was returned. Check email confirmation settings.')
    }

    const session: CloudSession = {
      accessToken: response.access_token,
      expiresAt: Date.now() + Math.max(60, response.expires_in ?? 3_600) * 1_000,
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
      let message: string

      try {
        const payload = JSON.parse(text) as { code?: string; error_description?: string; message?: string; msg?: string }

        message = payload.error_description ?? payload.msg ?? payload.message ?? ''
      } catch {
        message = text
      }

      if (/profiles_display_name_unique|duplicate key/i.test(message)) {
        throw new Error('That display name is already in use.')
      }

      if (/revision_conflict/i.test(message)) {
        throw new Error('revision_conflict')
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error('Your account session is invalid or expired. Please sign in again.')
      }

      throw new Error(message && message.length <= 240 ? message : `Cloud request failed with status ${response.status}.`)
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

export function createCloudSaveEnvelope(state: GameState) {
  return createSaveEnvelope({
    ...state,
    uiEvents: [],
  })
}

export function haveSameCloudState(left: GameState, right: GameState) {
  const normalize = (state: GameState) => {
    const normalizedState = createCloudSaveEnvelope({
      ...state,
      lastSaved: 0,
      uiEvents: [],
    }).state

    return {
      ...normalizedState,
      lastSaved: 0,
    }
  }

  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right))
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
  const itemValues = state.inventory.map((item) => getCurrentItemMarketValue(item, state.marketValues))

  return {
    achievementCount: state.achievements.length,
    casesOpened: state.statistics.casesOpened,
    inventoryValue: state.inventoryValue,
    mostValuableSkin: itemValues.length > 0 ? Math.max(...itemValues) : 0,
    prestigeLevel: state.prestigeLevel,
    rarePatterns: state.inventory.filter((item) => (
      item.pattern && ['rare', 'exceptional', 'iconic'].includes(item.pattern.tier)
    )).length,
    totalProfit,
    updatedAt: save.updatedAt,
    userId: account.id,
    username: account.username || account.email.split('@')[0] || 'Anonymous',
  }
}

export function createPublicPlayerSummary(
  state: GameState,
  profile: CloudProfile,
): PublicPlayerSummary {
  const inventoryById = new Map(state.inventory.map((item) => [item.instanceId, item]))
  const trophyItems = profile.isTrophyShowcasePublic
    ? Object.values(state.trophyAssignments)
        .flatMap((assignment) => {
          const item = assignment ? inventoryById.get(assignment.itemId) : undefined

          return item ? [{
            baseMarketValue: item.baseMarketValue,
            finish: item.finish,
            floatValue: item.floatValue,
            image: item.image,
            instanceId: item.instanceId,
            marketValue: getCurrentItemMarketValue(item, state.marketValues),
            paintSeed: item.paintSeed,
            pattern: item.pattern,
            rarity: item.rarity,
            statTrak: item.statTrak,
            souvenir: item.souvenir,
            wear: item.wear,
            weapon: item.weapon,
          } satisfies PublicTrophyItem] : []
        })
        .slice(0, 16)
    : []
  const itemValues = state.inventory.map((item) => getCurrentItemMarketValue(item, state.marketValues))

  return {
    achievementCount: state.achievements.length,
    avatarKey: profile.avatarKey,
    casesOpened: state.statistics.casesOpened,
    createdAt: profile.createdAt,
    inventoryValue: getInventoryValue(state.inventory, state.marketValues),
    mostValuableSkin: itemValues.length > 0 ? Math.max(...itemValues) : 0,
    prestigeLevel: state.prestigeLevel,
    rarePatterns: state.inventory.filter((item) => (
      item.pattern && ['rare', 'exceptional', 'iconic'].includes(item.pattern.tier)
    )).length,
    totalProfit: state.statistics.moneyEarned - state.statistics.moneySpent,
    trophyItems,
    updatedAt: Date.now(),
    userId: profile.userId,
    username: profile.displayName,
  }
}

export function getCloudUserDisplayName(user: CloudUser) {
  return getUserDisplayName(user)
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

export function storeGuestSave(state: GameState) {
  writeJson(cloudGuestSaveKey, createCloudSaveEnvelope(state))
}

export function loadGuestSave() {
  const envelope = readJson<SaveEnvelope | null>(cloudGuestSaveKey, null)

  return envelope ? parseCloudSaveEnvelope(envelope) : null
}

export function storeAccountSave(userId: string, state: GameState) {
  writeJson(`${cloudAccountSaveKeyPrefix}${userId}`, createCloudSaveEnvelope(state))
}

export function loadAccountSave(userId: string) {
  const envelope = readJson<SaveEnvelope | null>(`${cloudAccountSaveKeyPrefix}${userId}`, null)

  return envelope ? parseCloudSaveEnvelope(envelope) : null
}

export function storeCloudConflictBackup(userId: string, side: 'local' | 'remote', state: GameState) {
  writeJson(`${cloudBackupKeyPrefix}${userId}:${side}:${Date.now()}`, createCloudSaveEnvelope(state))
}

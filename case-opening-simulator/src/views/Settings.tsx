import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Compass,
  Contrast,
  Download,
  Eye,
  Gauge,
  Languages,
  Music,
  Palette,
  RadioTower,
  RotateCcw,
  Save,
  Sparkles,
  Upload,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { type ChangeEvent, type ComponentType, type FormEvent, type ReactNode, useRef, useState } from 'react'
import { AutoSellRulesPanel } from '../components/AutoSellRulesPanel'
import {
  defaultRarityColors,
  type AnimationSpeed,
  type GameState,
  type LanguageCode,
  type ThemeMode,
} from '../data/gameState'
import { Rarity } from '../data/models'
import { useGame } from '../hooks/useGame'
import { getRarityLabel } from '../utils/itemLabels'
import {
  SaveGameError,
  clearSavedGame,
  exportGameStateToFile,
  getSaveFileName,
  parseGameSaveText,
  shouldPromptForBackup,
} from '../utils/save'

const animationSpeeds: { label: string; value: AnimationSpeed }[] = [
  { label: 'Normal', value: 'normal' },
  { label: 'Fast', value: 'fast' },
  { label: 'Skip', value: 'skip' },
]

const themeOptions: { label: string; value: ThemeMode }[] = [
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' },
]

const languageOptions: { label: string; value: LanguageCode }[] = [
  { label: 'English', value: 'en' },
  { label: 'Czech', value: 'cs' },
  { label: 'German', value: 'de' },
  { label: 'Spanish', value: 'es' },
  { label: 'French', value: 'fr' },
]

const rarityOrder = [
  Rarity.Consumer,
  Rarity.Industrial,
  Rarity.MilSpec,
  Rarity.Restricted,
  Rarity.Classified,
  Rarity.Covert,
  Rarity.SpecialItem,
  Rarity.Contraband,
]

function formatSavedAt(timestamp: number) {
  return timestamp > 0 ? new Date(timestamp).toLocaleString() : 'Never'
}

function hasRunningAutomation(state: GameState) {
  return (
    (state.automation.autoOpener.isEnabled && state.automation.autoOpener.level > 0) ||
    Object.values(state.automation.modules).some((moduleState) => (
      moduleState.isEnabled && moduleState.level > 0
    ))
  )
}

export function Settings() {
  const {
    addAutoSellRule,
    cloud,
    markBackupCreated,
    removeAutoSellRule,
    reorderAutoSellRules,
    replaceGameState,
    state,
    updateAutoSellRule,
    updateOnboardingState,
    updateSettings,
  } = useGame()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [message, setMessage] = useState<string | undefined>()
  const [isError, setIsError] = useState(false)
  const [pendingImportState, setPendingImportState] = useState<GameState | undefined>()
  const [cloudEmail, setCloudEmail] = useState('')
  const [cloudPassword, setCloudPassword] = useState('')
  const [cloudUsername, setCloudUsername] = useState('')
  const isBackupDue = shouldPromptForBackup(state)
  const automationIsRunning = hasRunningAutomation(state)

  function showMessage(nextMessage: string, error = false) {
    setMessage(nextMessage)
    setIsError(error)
  }

  function handleExport() {
    const { fileName } = exportGameStateToFile(state)

    showMessage(`Save exported: ${fileName}`)
  }

  function handleBackupExport() {
    const now = Date.now()
    const { fileName } = exportGameStateToFile(state, {
      fileName: getSaveFileName('case-opening-backup', now),
    })

    markBackupCreated(now)
    showMessage(`Backup downloaded: ${fileName}`)
  }

  function commitImportedState(importedState: GameState) {
    replaceGameState(importedState)
    setPendingImportState(undefined)
    showMessage('Save imported.')
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const importedState = parseGameSaveText(await file.text())

      if (automationIsRunning) {
        setPendingImportState(importedState)
        showMessage('Automation is running. Confirm the import before replacing this save.', true)
        return
      }

      commitImportedState(importedState)
    } catch (error) {
      showMessage(
        error instanceof SaveGameError
          ? error.message
          : 'Save file could not be imported.',
        true,
      )
    } finally {
      event.target.value = ''
    }
  }

  function handleReset() {
    const confirmed = window.confirm('Reset all progress and clear the local save?')

    if (!confirmed) {
      return
    }

    clearSavedGame()
    window.location.reload()
  }

  function updateRarityColor(rarity: Rarity, color: string) {
    updateSettings({
      rarityColors: {
        ...state.settings.rarityColors,
        [rarity]: color,
      },
    })
  }

  async function handleCloudLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await cloud.login(cloudEmail, cloudPassword)
  }

  async function handleCloudSignUp() {
    await cloud.signUp(cloudEmail, cloudPassword, cloudUsername)
  }

  async function handleCloudReset() {
    await cloud.requestPasswordReset(cloudEmail)
    showMessage('Password reset requested. Check your email if this is a real backend account.')
  }

  return (
    <section className="w-full border border-cs-border bg-cs-surface p-5 sm:p-7">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="border-l-4 border-rarity-industrial pl-4">
          <p className="font-mono text-xs uppercase text-rarity-industrial">Preferences</p>
          <h2 className="mt-1 text-3xl font-semibold text-cs-text sm:text-4xl">Settings</h2>
        </div>
        <div className="grid gap-2 border border-cs-border bg-cs-panel p-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryPill label="Theme" value={state.settings.theme} />
          <SummaryPill label="Language" value={state.settings.language.toUpperCase()} />
          <SummaryPill label="Animation" value={state.settings.animationSpeed} />
          <SummaryPill label="Autosave" value={state.settings.autosaveEnabled ? 'On' : 'Off'} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <ActionButton
          icon={Download}
          label="Download Save"
          meta="Export"
          onClick={handleExport}
          tone="industrial"
        />
        <ActionButton
          icon={Upload}
          label="Load Save File"
          meta="Import"
          onClick={() => fileInputRef.current?.click()}
          tone="special"
        />
        <ActionButton
          icon={RotateCcw}
          label="Clear Progress"
          meta="Reset"
          onClick={handleReset}
          tone="covert"
        />
      </div>

      <input
        accept="application/json,.json"
        className="hidden"
        onChange={handleImport}
        ref={fileInputRef}
        type="file"
      />

      {message ? (
        <div
          aria-live="polite"
          className={[
            'mt-5 border px-4 py-3 text-sm',
            isError
              ? 'border-rarity-covert bg-rarity-covert/10 text-rarity-covert'
              : 'border-cs-green bg-cs-green/10 text-cs-green',
          ].join(' ')}
        >
          {message}
        </div>
      ) : null}

      {pendingImportState ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          role="dialog"
        >
          <div className="w-full max-w-md border border-rarity-special bg-cs-surface p-5 shadow-glow">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 text-rarity-special" size={22} />
              <div>
                <h3 className="text-xl font-semibold text-cs-text">Confirm Import</h3>
                <p className="mt-2 text-sm text-cs-muted">
                  Automation is active. Importing now will replace the current save state.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                className="min-h-11 border border-cs-border px-4 py-2 text-sm font-semibold text-cs-muted transition-colors hover:text-cs-text"
                onClick={() => setPendingImportState(undefined)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="min-h-11 border border-rarity-special bg-rarity-special/10 px-4 py-2 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/20"
                onClick={() => commitImportedState(pendingImportState)}
                type="button"
              >
                Replace Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-8 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <SettingsPanel icon={Save} title="Save Management">
          <div className="grid gap-3 md:grid-cols-2">
            <ToggleControl
              checked={state.settings.autosaveEnabled}
              icon={Save}
              label="Autosave"
              onChange={(checked) => updateSettings({ autosaveEnabled: checked })}
            />
            <ToggleControl
              checked={state.settings.backupPromptEnabled}
              icon={CalendarClock}
              label="Weekly Backup Prompt"
              onChange={(checked) => updateSettings({ backupPromptEnabled: checked })}
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SummaryPill label="Last Save" value={formatSavedAt(state.lastSaved)} />
            <SummaryPill label="Last Backup" value={formatSavedAt(state.lastBackupAt)} />
          </div>
          {isBackupDue ? (
            <div className="mt-4 border border-rarity-special bg-rarity-special/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono text-xs uppercase text-rarity-special">Backup Due</p>
                  <p className="mt-1 text-sm text-cs-muted">Download a fresh local backup.</p>
                </div>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 border border-rarity-special px-3 py-2 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/10"
                  onClick={handleBackupExport}
                  type="button"
                >
                  <Download size={16} />
                  Download Backup
                </button>
              </div>
            </div>
          ) : null}
          <div className="mt-4 border border-cs-border bg-cs-surface p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-xs uppercase text-cs-muted">Onboarding</p>
                <p className="mt-1 text-sm text-cs-muted">Review the opening, inventory, selling, and auto-sell tutorial.</p>
              </div>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-rarity-special px-3 py-2 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/10"
                onClick={() => updateOnboardingState({
                  activeStepId: 'open_case',
                  isDismissed: false,
                  isReviewing: true,
                })}
                type="button"
              >
                <Compass size={16} />
                Review Tutorial
              </button>
            </div>
          </div>
        </SettingsPanel>

        <SettingsPanel icon={User} title="Account & Cloud Save">
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryPill label="Backend" value={cloud.isConfigured ? 'Supabase' : 'Local Mock'} />
            <SummaryPill label="Sync" value={cloud.status} />
            <SummaryPill
              label="Last Synced"
              value={cloud.lastSyncedAt ? formatSavedAt(cloud.lastSyncedAt) : 'Never'}
            />
            <SummaryPill label="User" value={cloud.session?.user.username || cloud.session?.user.email || 'Offline'} />
          </div>

          {cloud.error ? (
            <div className="mt-4 border border-rarity-covert bg-rarity-covert/10 p-3 text-sm text-rarity-covert">
              {cloud.error}
            </div>
          ) : null}

          {cloud.session ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-rarity-special px-3 py-2 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/10"
                disabled={cloud.status === 'syncing'}
                onClick={() => void cloud.forceSync()}
                type="button"
              >
                <RadioTower size={16} />
                Force Cloud Sync
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-cs-border px-3 py-2 text-sm font-semibold text-cs-muted transition-colors hover:text-cs-text"
                onClick={() => void cloud.logout()}
                type="button"
              >
                Logout
              </button>
            </div>
          ) : (
            <form className="mt-4 grid gap-3" onSubmit={handleCloudLogin}>
              <label className="grid gap-2 text-sm text-cs-muted">
                Email
                <input
                  autoComplete="email"
                  className="min-h-11 border border-cs-border bg-cs-surface px-3 py-2 text-cs-text outline-none focus:border-rarity-special"
                  onChange={(event) => setCloudEmail(event.target.value)}
                  type="email"
                  value={cloudEmail}
                />
              </label>
              <label className="grid gap-2 text-sm text-cs-muted">
                Password
                <input
                  autoComplete="current-password"
                  className="min-h-11 border border-cs-border bg-cs-surface px-3 py-2 text-cs-text outline-none focus:border-rarity-special"
                  onChange={(event) => setCloudPassword(event.target.value)}
                  type="password"
                  value={cloudPassword}
                />
              </label>
              <label className="grid gap-2 text-sm text-cs-muted">
                Username
                <input
                  autoComplete="nickname"
                  className="min-h-11 border border-cs-border bg-cs-surface px-3 py-2 text-cs-text outline-none focus:border-rarity-special"
                  onChange={(event) => setCloudUsername(event.target.value)}
                  type="text"
                  value={cloudUsername}
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  className="min-h-11 border border-rarity-special px-3 py-2 text-sm font-semibold text-rarity-special transition-colors hover:bg-rarity-special/10"
                  disabled={cloud.status === 'syncing'}
                  type="submit"
                >
                  Login
                </button>
                <button
                  className="min-h-11 border border-rarity-industrial px-3 py-2 text-sm font-semibold text-rarity-industrial transition-colors hover:bg-rarity-industrial/10"
                  disabled={cloud.status === 'syncing'}
                  onClick={() => void handleCloudSignUp()}
                  type="button"
                >
                  Sign Up
                </button>
                <button
                  className="min-h-11 border border-cs-border px-3 py-2 text-sm font-semibold text-cs-muted transition-colors hover:text-cs-text"
                  disabled={cloud.status === 'syncing' || !cloudEmail}
                  onClick={() => void handleCloudReset()}
                  type="button"
                >
                  Reset
                </button>
              </div>
            </form>
          )}

          <p className="mt-4 text-xs text-cs-muted">
            Cloud saves are optional. If the backend is offline, the simulator keeps using the local save and syncs later.
          </p>
        </SettingsPanel>

        <SettingsPanel icon={Gauge} title="Playback">
          <div className="grid gap-3 md:grid-cols-2">
            <ToggleControl
              checked={state.settings.soundEnabled}
              icon={state.settings.soundEnabled ? Volume2 : VolumeX}
              label="Sound Effects"
              onChange={(checked) => updateSettings({ soundEnabled: checked })}
            />
            <ToggleControl
              checked={state.settings.musicEnabled}
              icon={Music}
              label="Music"
              onChange={(checked) => updateSettings({ musicEnabled: checked })}
            />
            <ToggleControl
              checked={state.settings.animationsEnabled}
              icon={Sparkles}
              label="Opening Animations"
              onChange={(checked) => updateSettings({ animationsEnabled: checked })}
            />
            <ToggleControl
              checked={state.settings.recentDropFeedAnimationsEnabled}
              icon={Eye}
              label="Recent Drop Motion"
              onChange={(checked) => updateSettings({ recentDropFeedAnimationsEnabled: checked })}
            />
          </div>
          <label className="mt-4 block border border-cs-border bg-cs-surface p-4">
            <span className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-mono text-xs uppercase text-cs-muted">
                <Volume2 size={15} />
                Sound Volume
              </span>
              <span className="font-mono text-xs text-cs-text">
                {Math.round(state.settings.soundVolume * 100)}%
              </span>
            </span>
            <input
              aria-label="Sound Volume"
              className="mt-3 h-2 w-full accent-rarity-special"
              max="1"
              min="0"
              onChange={(event) => updateSettings({ soundVolume: Number(event.target.value) })}
              step="0.05"
              type="range"
              value={state.settings.soundVolume}
            />
          </label>
          <SegmentedControl
            label="Animation Speed"
            onChange={(animationSpeed) => updateSettings({ animationSpeed })}
            options={animationSpeeds}
            value={state.settings.animationSpeed}
          />
        </SettingsPanel>

        <SettingsPanel icon={Bell} title="Notifications">
          <div className="grid gap-3 md:grid-cols-2">
            <ToggleControl
              checked={state.settings.autoSellNotificationsEnabled}
              icon={Bell}
              label="Auto-Sell Notifications"
              onChange={(checked) => updateSettings({ autoSellNotificationsEnabled: checked })}
            />
            <ToggleControl
              checked={state.settings.marketEventBannersEnabled}
              icon={RadioTower}
              label="Market Event Banner"
              onChange={(checked) => updateSettings({ marketEventBannersEnabled: checked })}
            />
            <ToggleControl
              checked={state.settings.marketSimulationEnabled}
              icon={Save}
              label="Market Simulation"
              onChange={(checked) => updateSettings({ marketSimulationEnabled: checked })}
            />
          </div>
        </SettingsPanel>

        <SettingsPanel icon={Contrast} title="Accessibility">
          <div className="grid gap-3 md:grid-cols-2">
            <ToggleControl
              checked={state.settings.highContrastMode}
              icon={Contrast}
              label="High Contrast"
              onChange={(checked) => updateSettings({ highContrastMode: checked })}
            />
            <ToggleControl
              checked={state.settings.simplifiedAnimations}
              icon={Sparkles}
              label="Simplified Animations"
              onChange={(checked) => updateSettings({ simplifiedAnimations: checked })}
            />
            <ToggleControl
              checked={state.settings.largeText}
              icon={Eye}
              label="Large Text"
              onChange={(checked) => updateSettings({ largeText: checked })}
            />
          </div>
          <SegmentedControl
            label="Theme"
            onChange={(theme) => updateSettings({ theme })}
            options={themeOptions}
            value={state.settings.theme}
          />
          <label className="mt-4 block border border-cs-border bg-cs-surface p-4">
            <span className="flex items-center gap-2 font-mono text-xs uppercase text-cs-muted">
              <Languages size={15} />
              Language
            </span>
            <select
              className="mt-3 w-full border border-cs-border bg-cs-panel px-3 py-2 text-cs-text outline-none focus:border-rarity-special"
              onChange={(event) => updateSettings({ language: event.target.value as LanguageCode })}
              value={state.settings.language}
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </SettingsPanel>

        <SettingsPanel icon={Palette} title="Rarity Colours">
          <div className="grid gap-3 sm:grid-cols-2">
            {rarityOrder.map((rarity) => (
              <label
                className="flex items-center justify-between gap-3 border border-cs-border bg-cs-surface p-3"
                key={rarity}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-cs-text">
                    {getRarityLabel(rarity)}
                  </span>
                  <span className="mt-1 block font-mono text-[10px] uppercase text-cs-muted">
                    {state.settings.rarityColors[rarity]}
                  </span>
                </span>
                <input
                  aria-label={`${getRarityLabel(rarity)} colour`}
                  className="h-10 w-12 shrink-0 cursor-pointer border border-cs-border bg-cs-panel"
                  onChange={(event) => updateRarityColor(rarity, event.target.value)}
                  type="color"
                  value={state.settings.rarityColors[rarity]}
                />
              </label>
            ))}
          </div>
          <button
            className="mt-4 inline-flex items-center gap-2 border border-cs-border px-3 py-2 text-sm font-semibold text-cs-muted transition-colors hover:border-rarity-special hover:text-cs-text"
            onClick={() => updateSettings({ rarityColors: defaultRarityColors })}
            type="button"
          >
            <RotateCcw size={15} />
            Reset Colours
          </button>
        </SettingsPanel>
      </div>

      <AutoSellRulesPanel
        inventory={state.inventory}
        onAddRule={addAutoSellRule}
        onRemoveRule={removeAutoSellRule}
        onReorderRules={reorderAutoSellRules}
        onUpdateRule={updateAutoSellRule}
        rules={state.autoSellRules}
      />
    </section>
  )
}

function ActionButton({
  icon: Icon,
  label,
  meta,
  onClick,
  tone,
}: {
  icon: ComponentType<{ size?: number; className?: string }>
  label: string
  meta: string
  onClick: () => void
  tone: 'covert' | 'industrial' | 'special'
}) {
  const toneClasses = {
    covert: 'hover:border-rarity-covert text-rarity-covert',
    industrial: 'hover:border-rarity-industrial text-rarity-industrial',
    special: 'hover:border-rarity-special text-rarity-special',
  }[tone]

  return (
    <button
      className="flex min-h-28 items-center justify-between gap-4 border border-cs-border bg-cs-panel p-5 text-left transition-colors hover:bg-cs-panelMuted"
      onClick={onClick}
      type="button"
    >
      <span>
        <span className="block font-mono text-xs uppercase text-cs-muted">{meta}</span>
        <span className="mt-2 block text-lg font-semibold text-cs-text">{label}</span>
      </span>
      <Icon className={toneClasses} size={28} />
    </button>
  )
}

function SettingsPanel({
  children,
  icon: Icon,
  title,
}: {
  children: ReactNode
  icon: ComponentType<{ size?: number; className?: string }>
  title: string
}) {
  return (
    <section className="border border-cs-border bg-cs-panel p-5">
      <div className="flex items-center gap-3">
        <Icon className="text-rarity-special" size={22} />
        <h3 className="text-xl font-semibold text-cs-text">{title}</h3>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function ToggleControl({
  checked,
  icon: Icon,
  label,
  onChange,
}: {
  checked: boolean
  icon: ComponentType<{ size?: number }>
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex min-h-20 items-center justify-between gap-4 border border-cs-border bg-cs-surface p-4">
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center border border-cs-border bg-cs-panel text-rarity-special">
          <Icon size={16} />
        </span>
        <span className="truncate text-sm font-semibold text-cs-text">{label}</span>
      </span>
      <input
        checked={checked}
        className="h-5 w-5 shrink-0 accent-rarity-special"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  )
}

function SegmentedControl<TValue extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: TValue) => void
  options: { label: string; value: TValue }[]
  value: TValue
}) {
  return (
    <div className="mt-4 border border-cs-border bg-cs-surface p-4">
      <p className="font-mono text-xs uppercase text-cs-muted">{label}</p>
      <div className="mt-3 grid border border-cs-border bg-cs-panel p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <button
            aria-pressed={value === option.value}
            className={[
              'px-2 py-2 text-sm font-semibold transition-colors',
              value === option.value
                ? 'bg-rarity-special/10 text-rarity-special'
                : 'text-cs-muted hover:text-cs-text',
            ].join(' ')}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-cs-border bg-cs-surface px-3 py-2">
      <p className="font-mono text-[10px] uppercase text-cs-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize text-cs-text">{value}</p>
    </div>
  )
}

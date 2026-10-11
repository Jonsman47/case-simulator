import { nanoid } from 'nanoid'
import { useMemo, useState } from 'react'
import { ACHIEVEMENTS } from '../data/achievements'
import { CASE_DEFINITIONS } from '../data/cases'
import { defaultGameState } from '../data/gameState'
import { Rarity, WearCondition, type SkinBase, type SkinInstance } from '../data/models'
import { SKIN_DEFINITIONS } from '../data/skins'
import { PREDEFINED_GAME_EVENTS } from '../events/eventManager'
import { useGame } from '../hooks/useGame'
import { formatCurrency } from '../utils/format'
import { clearSavedGame, exportGameStateToFile, loadGameState, parseGameSaveText, saveGame } from '../utils/save'

function makeAdminSkin(skin: SkinBase): SkinInstance {
  return {
    ...skin,
    discoveredAt: Date.now(),
    floatValue: 0.01,
    instanceId: nanoid(),
    isFavorited: false,
    isLocked: false,
    marketValue: skin.baseValue,
    wear: WearCondition.FactoryNew,
  }
}

function AdminButton({
  children,
  onClick,
  tone = 'default',
}: {
  children: string
  onClick: () => void
  tone?: 'default' | 'danger' | 'gold'
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-rarity-covert text-rarity-covert hover:bg-rarity-covert/10'
      : tone === 'gold'
        ? 'border-rarity-special text-rarity-special hover:bg-rarity-special/10'
        : 'border-cs-border text-cs-text hover:border-rarity-special'

  return (
    <button
      className={`min-h-10 border px-3 py-2 text-sm font-semibold transition-colors ${toneClass}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

export function AdminPanel() {
  const {
    addItem,
    addMoney,
    clearUiEvents,
    removeItem,
    replaceGameState,
    resetGame,
    spendMoney,
    state,
    tickEventsNow,
    triggerGameEvent,
  } = useGame()
  const [moneyAmount, setMoneyAmount] = useState(1000)
  const [levelAmount, setLevelAmount] = useState(state.prestigeLevel)
  const [selectedSkinId, setSelectedSkinId] = useState(SKIN_DEFINITIONS[0]?.id ?? '')
  const [selectedItemId, setSelectedItemId] = useState(state.inventory[0]?.instanceId ?? '')
  const selectedSkin = useMemo(
    () => SKIN_DEFINITIONS.find((skin) => skin.id === selectedSkinId) ?? SKIN_DEFINITIONS[0],
    [selectedSkinId],
  )
  const saveInfo = {
    achievements: state.achievements.length,
    cases: state.casesUnlocked.length,
    collection: state.collectionBook.length,
    inventory: state.inventory.length,
    lastSaved: state.lastSaved ? new Date(state.lastSaved).toLocaleString() : 'Never',
    money: formatCurrency(state.money),
    prestige: state.prestigeLevel,
    skillPoints: state.skillPoints,
  }

  function giveSelectedSkin() {
    if (selectedSkin) {
      addItem(makeAdminSkin(selectedSkin))
    }
  }

  function spawnTestInventory() {
    SKIN_DEFINITIONS
      .filter((skin) => skin.rarity !== Rarity.SpecialItem)
      .slice(0, 25)
      .forEach((skin) => addItem(makeAdminSkin(skin)))
  }

  function unlockEveryAchievement() {
    const unlockedAt = Date.now()

    replaceGameState({
      ...state,
      achievements: ACHIEVEMENTS.map((achievement) => ({
        id: achievement.id,
        isClaimed: true,
        unlockedAt,
      })),
    })
  }

  function importSave(file: File | undefined) {
    if (!file) {
      return
    }

    const reader = new FileReader()

    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string') {
        return
      }

      try {
        replaceGameState(parseGameSaveText(reader.result))
      } catch (error) {
        console.error('Admin save import failed.', error)
      }
    })
    reader.readAsText(file)
  }

  return (
    <section className="w-full border border-cs-border bg-cs-surface p-5 sm:p-7">
      <div className="border-l-4 border-rarity-special pl-4">
        <p className="font-mono text-xs uppercase text-rarity-special">Jonsman Only</p>
        <h2 className="mt-1 text-3xl font-semibold text-cs-text">Admin Panel</h2>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <section className="border border-cs-border bg-cs-panel p-4">
          <h3 className="text-xl font-semibold text-cs-text">Money</h3>
          <label className="mt-3 block text-sm text-cs-muted">
            Amount
            <input
              className="mt-2 w-full border border-cs-border bg-cs-surface px-3 py-2 text-cs-text"
              min={0}
              onChange={(event) => setMoneyAmount(Number(event.target.value))}
              type="number"
              value={moneyAmount}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <AdminButton onClick={() => addMoney(moneyAmount)} tone="gold">Add Money</AdminButton>
            <AdminButton onClick={() => spendMoney(moneyAmount)} tone="danger">Remove Money</AdminButton>
          </div>
        </section>

        <section className="border border-cs-border bg-cs-panel p-4">
          <h3 className="text-xl font-semibold text-cs-text">Inventory</h3>
          <label className="mt-3 block text-sm text-cs-muted">
            Give Skin
            <select
              className="mt-2 w-full border border-cs-border bg-cs-surface px-3 py-2 text-cs-text"
              onChange={(event) => setSelectedSkinId(event.target.value)}
              value={selectedSkinId}
            >
              {SKIN_DEFINITIONS.map((skin) => (
                <option key={skin.id} value={skin.id}>{skin.weapon} | {skin.finish}</option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm text-cs-muted">
            Remove Owned Skin
            <select
              className="mt-2 w-full border border-cs-border bg-cs-surface px-3 py-2 text-cs-text"
              onChange={(event) => setSelectedItemId(event.target.value)}
              value={selectedItemId}
            >
              <option value="">Select item</option>
              {state.inventory.map((item) => (
                <option key={item.instanceId} value={item.instanceId}>{item.weapon} | {item.finish}</option>
              ))}
            </select>
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <AdminButton onClick={giveSelectedSkin} tone="gold">Give Any Skin</AdminButton>
            <AdminButton onClick={() => selectedItemId && removeItem(selectedItemId)} tone="danger">Remove Any Skin</AdminButton>
            <AdminButton onClick={spawnTestInventory}>Spawn Test Inventory</AdminButton>
          </div>
        </section>

        <section className="border border-cs-border bg-cs-panel p-4">
          <h3 className="text-xl font-semibold text-cs-text">Progression</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <AdminButton onClick={() => replaceGameState({ ...state, casesUnlocked: CASE_DEFINITIONS.map((caseDef) => caseDef.id) })}>Unlock All Cases</AdminButton>
            <AdminButton onClick={() => replaceGameState({ ...state, casesUnlocked: defaultGameState.casesUnlocked })}>Lock All Cases</AdminButton>
            <AdminButton onClick={() => replaceGameState({ ...state, learnedSkillNodeIds: [], skillPoints: 0 })}>Reset Skill Tree</AdminButton>
            <AdminButton onClick={() => replaceGameState({ ...state, prestigeLevel: 0, prestigePoints: 0, prestigeBonuses: {} })}>Reset Prestige</AdminButton>
            <AdminButton onClick={() => replaceGameState({ ...state, achievements: [] })}>Reset Achievements</AdminButton>
            <AdminButton onClick={unlockEveryAchievement}>Unlock Every Achievement</AdminButton>
            <AdminButton onClick={() => replaceGameState({ ...state, casesUnlocked: CASE_DEFINITIONS.map((caseDef) => caseDef.id) })}>Complete Every License</AdminButton>
          </div>
          <label className="mt-3 block text-sm text-cs-muted">
            Player Level
            <input
              className="mt-2 w-full border border-cs-border bg-cs-surface px-3 py-2 text-cs-text"
              min={0}
              onChange={(event) => setLevelAmount(Number(event.target.value))}
              type="number"
              value={levelAmount}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <AdminButton onClick={() => replaceGameState({ ...state, prestigeLevel: Math.max(0, Math.floor(levelAmount)) })}>Set Player Level</AdminButton>
            <AdminButton onClick={() => replaceGameState({ ...state, skillPoints: state.skillPoints + 10, upgradePoints: state.upgradePoints + 10, prestigePoints: state.prestigePoints + 10 })}>Add 10 Points</AdminButton>
          </div>
        </section>

        <section className="border border-cs-border bg-cs-panel p-4">
          <h3 className="text-xl font-semibold text-cs-text">Save Tools</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <AdminButton onClick={() => replaceGameState({ ...state, inventory: [] })} tone="danger">Reset Inventory</AdminButton>
            <AdminButton onClick={() => replaceGameState({ ...state, collectionBook: [], collectionRewards: [] })} tone="danger">Reset Collection Book</AdminButton>
            <AdminButton onClick={() => replaceGameState({ ...state, trophyAssignments: {} })} tone="danger">Reset Trophy Room</AdminButton>
            <AdminButton onClick={() => { clearSavedGame(); resetGame() }} tone="danger">Reset Save</AdminButton>
            <AdminButton onClick={() => saveGame(state)}>Force Save</AdminButton>
            <AdminButton onClick={() => { const loaded = loadGameState(); if (loaded) replaceGameState(loaded) }}>Force Load</AdminButton>
            <AdminButton onClick={() => exportGameStateToFile(state)}>Export Save</AdminButton>
            <AdminButton onClick={clearUiEvents}>Clear Notifications</AdminButton>
            <AdminButton onClick={() => replaceGameState({ ...state, settings: { ...state.settings, debugMode: !state.settings.debugMode } })}>Toggle Debug Mode</AdminButton>
          </div>
          <label className="mt-3 block cursor-pointer border border-cs-border bg-cs-surface px-3 py-2 text-sm font-semibold text-cs-text transition-colors hover:border-rarity-special">
            Import Save
            <input
              className="sr-only"
              onChange={(event) => importSave(event.target.files?.[0])}
              type="file"
              accept="application/json,.json"
            />
          </label>
        </section>

        <section className="border border-cs-border bg-cs-panel p-4 xl:col-span-2">
          <h3 className="text-xl font-semibold text-cs-text">Event Controls</h3>
          <p className="mt-2 text-sm text-cs-muted">Start a real event or advance activation and expiration checks immediately.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PREDEFINED_GAME_EVENTS.map((event) => (
              <AdminButton key={event.type} onClick={() => triggerGameEvent(event.type)} tone="gold">
                {event.name}
              </AdminButton>
            ))}
            <AdminButton onClick={tickEventsNow}>Tick Events Now</AdminButton>
          </div>
        </section>
      </div>

      <section className="mt-5 border border-cs-border bg-cs-panel p-4">
        <h3 className="text-xl font-semibold text-cs-text">Save Information</h3>
        <dl className="mt-3 grid gap-2 sm:grid-cols-4">
          {Object.entries(saveInfo).map(([label, value]) => (
            <div className="border border-cs-border bg-cs-surface px-3 py-2" key={label}>
              <dt className="font-mono text-[10px] uppercase text-cs-muted">{label}</dt>
              <dd className="mt-1 text-sm font-semibold text-cs-text">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </section>
  )
}

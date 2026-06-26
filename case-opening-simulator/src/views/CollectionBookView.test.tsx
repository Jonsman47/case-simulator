/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultGameState, type GameState } from '../data/gameState'
import { WearCondition } from '../data/models'
import { SKIN_DEFINITIONS } from '../data/skins'
import { CollectionBookView } from './CollectionBookView'

const mockUseGame = vi.fn()

vi.mock('../hooks/useGame', () => ({
  useGame: () => mockUseGame(),
}))

function makeState(overrides: Partial<GameState> = {}): GameState {
  const discoveredSkins = SKIN_DEFINITIONS.slice(0, 16)

  return {
    ...defaultGameState,
    collectionBook: discoveredSkins.map((skin, index) => ({
      skinId: skin.id,
      foundWearConditions: [WearCondition.FactoryNew],
      bestFloat: 0.01 + index / 1000,
      highestValue: index === 3 ? 999_999 : skin.baseValue,
      timesFound: 1,
      firstFoundAt: 1_700_000_000_000 + index,
    })),
    inventory: [],
    uiEvents: [],
    ...overrides,
  }
}

function renderCollectionBook(state = makeState()) {
  mockUseGame.mockReturnValue({
    assignTrophyItem: vi.fn(),
    sellItem: vi.fn(),
    state,
    toggleItemFavorite: vi.fn(),
    toggleItemLock: vi.fn(),
  })

  render(<CollectionBookView />)
}

describe('CollectionBookView', () => {
  beforeEach(() => {
    mockUseGame.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders eight collection cards per page and supports next page navigation', () => {
    renderCollectionBook()

    expect(screen.getByLabelText('Hide Undiscovered')).toBeChecked()
    expect(screen.getAllByTestId('collection-card')).toHaveLength(8)

    fireEvent.click(screen.getByRole('button', { name: /next collection page/i }))

    expect(screen.getByLabelText('Collection page')).toHaveValue(2)
    expect(screen.getAllByTestId('collection-card')).toHaveLength(8)
  })

  it('sorts the collection by most expensive records', () => {
    renderCollectionBook()

    fireEvent.change(screen.getByLabelText(/sort/i), {
      target: { value: 'valueDesc' },
    })

    const expectedSkin = SKIN_DEFINITIONS[3]
    const firstCard = screen.getAllByTestId('collection-card')[0]

    expect(within(firstCard).getByText(`${expectedSkin.weapon} | ${expectedSkin.finish}`)).toBeInTheDocument()
  })

  it('shows an empty-state message when filters hide every entry', () => {
    renderCollectionBook(makeState({ collectionBook: [] }))

    expect(screen.queryAllByTestId('collection-card')).toHaveLength(0)
    expect(screen.getByText('No collection entries match')).toBeInTheDocument()
  })
})

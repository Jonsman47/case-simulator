/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Profiler } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DiamondMinerJob, WarehouseRushJob } from './WorkExpansionGames'

const dispatch = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useGame', () => ({ useGame: () => ({ dispatch, state: { upgrades: {}, learnedSkillNodeIds: [] } }) }))

describe('Work expansion input', () => {
  beforeEach(() => {
    dispatch.mockClear()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    vi.useFakeTimers()
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() })
    Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', { configurable: true, value: () => true })
    Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', { configurable: true, value: vi.fn() })
  })
  afterEach(() => { cleanup(); Reflect.deleteProperty(document, 'hidden'); vi.useRealTimers(); vi.restoreAllMocks() })

  it('starts Warehouse Rush on the first keyboard action and scores that box', () => {
    render(<WarehouseRushJob />)
    expect(screen.queryByText('Start conveyor')).not.toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(3_000) })
    expect(screen.getByText('0 correct · 0 missed')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: '1' })
    expect(screen.getByText('1 correct · 0 missed')).toBeInTheDocument()
  })

  it('scores a touch drag once through the same bin logic and ignores cancellation', () => {
    const { container } = render(<WarehouseRushJob />)
    const box = screen.getByAltText('red package')
    const bin = screen.getByRole('button', { name: 'Sort into red dock' })
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => bin })
    fireEvent.pointerDown(box, { pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 10 })
    fireEvent.pointerUp(box, { pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 20 })
    expect(container).toHaveTextContent('1 correct · 0 missed')
    fireEvent.pointerUp(box, { pointerId: 1, pointerType: 'touch' })
    expect(container).toHaveTextContent('1 correct · 0 missed')
    const nextBox = screen.getByAltText('red package')
    fireEvent.pointerDown(nextBox, { pointerId: 2, pointerType: 'touch' })
    fireEvent.pointerCancel(nextBox, { pointerId: 2, pointerType: 'touch' })
    expect(container).toHaveTextContent('1 correct · 0 missed')
  })

  it('moves the drag image without a React commit for every pointer event', () => {
    let commits = 0
    render(<Profiler id="warehouse" onRender={() => { commits += 1 }}><WarehouseRushJob /></Profiler>)
    const box = screen.getByAltText('red package')
    fireEvent.pointerDown(box, { pointerId: 7, pointerType: 'mouse', clientX: 10, clientY: 10 })
    const afterStart = commits
    for (let index = 0; index < 80; index += 1) fireEvent.pointerMove(box, { pointerId: 7, pointerType: 'mouse', clientX: index + 20, clientY: 40 })
    expect(commits).toBe(afterStart)
    expect(document.querySelector('img.pointer-events-none.fixed')).toHaveStyle({ left: '99px', top: '40px' })
  })

  it('pauses the conveyor deadline while the browser tab is hidden and removes its timer on unmount', () => {
    const view = render(<WarehouseRushJob />)
    fireEvent.keyDown(window, { key: '1' })
    expect(screen.getByText('1 correct · 0 missed')).toBeInTheDocument()
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    fireEvent(document, new Event('visibilitychange'))
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(screen.getByText('1 correct · 0 missed')).toBeInTheDocument()
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    fireEvent(document, new Event('visibilitychange'))
    act(() => { vi.advanceTimersByTime(1_750) })
    expect(screen.getByText('1 correct · 1 missed')).toBeInTheDocument()
    view.unmount()
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('keeps Diamond Miner mechanics intact with concise, accurate instructions', () => {
    render(<DiamondMinerJob />)
    expect(screen.getByText(/Find valuable ores and diamonds in 18 swings/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start mining' }))
    fireEvent.click(screen.getAllByRole('button', { name: /block at depth 1/ })[0])
    expect(screen.getByText('17')).toBeInTheDocument()
  })
})

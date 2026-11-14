import { describe, expect, it } from 'vitest'
import { defaultGameState } from '../data/gameState'
import { createEmptyEconomyTotals } from '../economy/economyLedger'
import { getProgressionReport } from './progressionReporting'

describe('progression reporting selectors', () => {
  it('uses the same authoritative run XP and collection counts as Career and Collection Book', () => {
    const state = {
      ...defaultGameState,
      career: { ...defaultGameState.career, currentRunXp: 12_345, lifetimeXp: 45_678 },
      collectionBook: [
        { skinId: 'a', foundWearConditions: [], timesFound: 1, firstFoundAt: 1 },
        { skinId: 'b', foundWearConditions: [], timesFound: 1, firstFoundAt: 2 },
      ],
      currentRunCollectionBook: [
        { skinId: 'b', foundWearConditions: [], timesFound: 1, firstFoundAt: 2 },
      ],
    }
    const report = getProgressionReport(state)
    expect(report.career.currentRunXp).toBe(state.career.currentRunXp)
    expect(report.career.lifetimeXp).toBe(state.career.lifetimeXp)
    expect(report.collection.allTimeUnique).toBe(2)
    expect(report.collection.currentRunUnique).toBe(1)
  })

  it('does not double-count reserved employee capital in wallet cash or inventory value', () => {
    const employee = defaultGameState.business.employees.caseOperator
    const state = {
      ...defaultGameState,
      money: 100,
      inventoryValue: 250,
      business: {
        ...defaultGameState.business,
        employees: {
          ...defaultGameState.business.employees,
          caseOperator: { ...employee, availableCapital: 75, reservedCapital: 25 },
        },
      },
    }
    const report = getProgressionReport(state)
    expect(report.finances.cash).toBe(100)
    expect(report.finances.reservedCapital).toBe(100)
    expect(report.finances.netWorth).toBe(450)
  })

  it('derives payroll and business result from the economy ledger', () => {
    const lifetime = {
      ...createEmptyEconomyTotals(),
      businessRevenue: 500,
      businessExpenses: 180,
      businessPayroll: 80,
    }
    const state = {
      ...defaultGameState,
      economyLedger: { ...defaultGameState.economyLedger, lifetime },
    }
    const report = getProgressionReport(state)
    expect(report.business.revenue).toBe(500)
    expect(report.business.expenses).toBe(180)
    expect(report.business.payroll).toBe(80)
    expect(report.business.realizedResult).toBe(320)
  })
})

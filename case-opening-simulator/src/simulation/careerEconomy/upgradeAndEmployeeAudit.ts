import { CAREER_UPGRADE_DEFINITIONS, getCareerUpgradeCost, type CareerUpgradeDefinition } from '../../career/careerUpgrades'
import { BUSINESS_MAX_TRAINING_LEVEL, EMPLOYEE_ROLE_DEFINITIONS, getEmployeeHireCost, getEmployeeHourlyWage, getEmployeeOperationInterval, getEmployeeTrainingCost, type EmployeeRoleId } from '../../business/business'

export interface UpgradeBalanceRow {
  id: string
  specialization: string
  gate: number
  levels: number
  totalCurrentCost: number
  proposedCostCurve: string
  practicalBenefit: string
  conclusion: 'balanced' | 'monitor' | 'adjusted'
}

export interface EmployeeEconomyRow {
  roleId: EmployeeRoleId
  level: number
  hireCost: number
  cumulativeTrainingCost: number
  hourlyWage: number
  operationsPerHour: number
  directCashCreation: 0
  economicRole: string
}

function sumUpgradeCost(definition: CareerUpgradeDefinition) {
  let total = 0
  for (let level = 0; level < definition.maxLevel; level += 1) total += getCareerUpgradeCost(definition, level)
  return Number(total.toFixed(2))
}

export function auditCareerUpgrades(): UpgradeBalanceRow[] {
  return CAREER_UPGRADE_DEFINITIONS.map((definition) => ({
    id: definition.id,
    specialization: definition.specialization,
    gate: definition.requiredLevel,
    levels: definition.maxLevel,
    totalCurrentCost: sumUpgradeCost(definition),
    proposedCostCurve: `base x 1.72^L x ${definition.rankMultiplier}`,
    practicalBenefit: `${definition.consumer}: ${definition.effectPerLevel}${definition.effectUnit} per level`,
    conclusion: definition.effectKind === 'discount' || definition.effectKind === 'speed' ? 'monitor' : 'balanced',
  }))
}

const employeeRoles = Object.keys(EMPLOYEE_ROLE_DEFINITIONS) as EmployeeRoleId[]

export function auditEmployeeEconomy(): EmployeeEconomyRow[] {
  return employeeRoles.flatMap((roleId) => {
    let cumulativeTrainingCost = 0
    return Array.from({ length: BUSINESS_MAX_TRAINING_LEVEL + 1 }, (_, level) => {
      if (level > 0) cumulativeTrainingCost += getEmployeeTrainingCost(roleId, level - 1)
      return {
        roleId,
        level,
        hireCost: getEmployeeHireCost(roleId),
        cumulativeTrainingCost,
        hourlyWage: getEmployeeHourlyWage(roleId, level),
        operationsPerHour: Number((3_600_000 / getEmployeeOperationInterval(roleId, level)).toFixed(2)),
        directCashCreation: 0 as const,
        economicRole: roleId === 'caseOperator' ? 'Paid opening convenience and collection throughput'
          : roleId === 'salesAssistant' ? 'Inventory liquidity and routine listing labor'
            : roleId === 'marketScout' ? 'Bounded information discovery; no automatic purchase'
              : roleId === 'tradeUpSpecialist' ? 'Opportunity-cost-checked ordinary contracts'
                : 'Budgeted low-risk acquisition with exposure limits',
      }
    })
  })
}

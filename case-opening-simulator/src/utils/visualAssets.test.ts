/// <reference types="node" />
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const requiredAssets = [
  'work/trash-can.png',
  'work/precision-target.png',
  'work/ore-diamond.png',
  'work/pickaxe.png',
  'work/delivery-van.png',
  'work/package.png',
  'work/conveyor-horizontal.png',
  'work/circuit-09.png',
  'business/case-operator.png',
  'business/sales-assistant.png',
  'business/market-scout.png',
  'business/trade-up-specialist.png',
  'business/junior-trader.png',
]

describe('local visual assets', () => {
  it.each(requiredAssets)('ships a non-empty offline asset: %s', (asset) => {
    const path = resolve(process.cwd(), 'public', 'assets', asset)
    expect(existsSync(path)).toBe(true)
    expect(statSync(path).size).toBeGreaterThan(100)
  })
})

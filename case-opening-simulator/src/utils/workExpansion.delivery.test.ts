import { describe, expect, it } from 'vitest'
import { DELIVERY_MAX_MOVES, findShortestDeliveryRoute, generateDeliveryMap, moveDeliveryPosition, pointKey } from './workExpansion'

describe('seeded Package Delivery maps', () => {
  it('reproduces a map from the same seed and varies layouts across rounds', () => {
    expect(generateDeliveryMap(123456)).toEqual(generateDeliveryMap(123456))
    const maps = Array.from({ length: 120 }, (_, seed) => generateDeliveryMap(seed + 91))
    expect(new Set(maps.map((map) => JSON.stringify([map.start, map.obstacles, map.packages, map.destinations]))).size).toBeGreaterThan(100)
    expect(new Set(maps.map((map) => map.layout)).size).toBeGreaterThanOrEqual(3)
  })

  it('keeps 2,000 generated routes distinct, reachable, and inside the existing move budget', () => {
    for (let seed = 0; seed < 2_000; seed += 1) {
      const map = generateDeliveryMap(seed * 7919 + 17)
      const route = findShortestDeliveryRoute(map)
      expect(route, `seed ${seed}`).toBeDefined()
      expect(route!.length).toBe(map.shortestRoute)
      expect(route!.length).toBeGreaterThanOrEqual(9)
      expect(route!.length).toBeLessThanOrEqual(DELIVERY_MAX_MOVES)
      const occupied = [pointKey(map.start), ...map.obstacles, ...map.packages, ...map.destinations]
      expect(new Set(occupied).size).toBe(occupied.length)
      let position = map.start
      const packages = new Set(map.packages)
      const destinations = new Set(map.destinations)
      let carrying = 0
      for (const direction of route!) {
        const next = moveDeliveryPosition(position, direction, new Set(map.obstacles))
        expect(next).not.toBe(position)
        position = next
        const key = pointKey(next)
        if (packages.delete(key)) carrying += 1
        else if (carrying > 0 && destinations.delete(key)) carrying -= 1
      }
      expect(destinations.size).toBe(0)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { nearestGoldDistance } from '../src/maze/hints'

describe('nearestGoldDistance', () => {
  it('returns null when there is no remaining gold', () => {
    const d = nearestGoldDistance([], { i: 0, j: 0 })
    expect(d).toBeNull()
  })

  it('ignores collected gold and returns the nearest distance', () => {
    const gold = [
      { i: 2, j: 2, show: false },
      { i: 5, j: 5, show: true },
      { i: 1, j: 7, show: true },
    ]
    expect(nearestGoldDistance(gold as any, { i: 0, j: 0 })).toBe(8)
    expect(nearestGoldDistance(gold as any, { i: 5, j: 4 })).toBe(1)
  })
})


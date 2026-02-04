import { describe, expect, it } from 'vitest'
import { cellFromWorld, collectAtCell, collectedGold, isOnExit, remainingGold, shouldAdvanceLevel, shouldUnlockExit, stepCounter } from '../src/maze/step'

describe('3D step logic', () => {
  it('maps world coordinates to clamped cell indices', () => {
    expect(cellFromWorld(0.01, 0.01, 1, 4, 3)).toEqual({ i: 0, j: 0 })
    expect(cellFromWorld(3.99, 2.99, 1, 4, 3)).toEqual({ i: 3, j: 2 })
    expect(cellFromWorld(-10, -10, 1, 4, 3)).toEqual({ i: 0, j: 0 })
    expect(cellFromWorld(999, 999, 1, 4, 3)).toEqual({ i: 3, j: 2 })
  })

  it('collects gold only at the current cell', () => {
    const gold = [
      { i: 0, j: 0, show: true },
      { i: 1, j: 0, show: true },
      { i: 2, j: 2, show: false },
    ]

    const { gold: next, collected } = collectAtCell(gold, { i: 1, j: 0 })
    expect(collected).toBe(1)
    expect(next[0].show).toBe(true)
    expect(next[1].show).toBe(false)
    expect(next[2].show).toBe(false)

    // should not mutate original
    expect(gold[1].show).toBe(true)
  })

  it('increments steps only when changing cells', () => {
    const last = { i: 0, j: 0 }
    expect(stepCounter(0, last, { i: 0, j: 0 })).toEqual({ steps: 0, lastCell: last, stepped: false })
    expect(stepCounter(0, last, { i: 1, j: 0 })).toEqual({ steps: 1, lastCell: { i: 1, j: 0 }, stepped: true })
    expect(stepCounter(10, { i: 2, j: 2 }, { i: 2, j: 3 })).toEqual({ steps: 11, lastCell: { i: 2, j: 3 }, stepped: true })
  })

  it('preserves extra gold fields when collected', () => {
    const gold: any[] = [{ i: 1, j: 1, show: true, sparkle: 123 }]
    const { gold: next, collected } = collectAtCell(gold as any, { i: 1, j: 1 })
    expect(collected).toBe(1)
    expect((next[0] as any).sparkle).toBe(123)
    expect(next[0].show).toBe(false)
  })

  it('unlocks exit only when all gold is collected', () => {
    expect(shouldUnlockExit([])).toBe(false)

    const gold = [
      { i: 0, j: 1, show: false },
      { i: 1, j: 1, show: true },
    ]
    expect(remainingGold(gold)).toBe(1)
    expect(collectedGold(gold)).toBe(1)
    expect(shouldUnlockExit(gold)).toBe(false)
    const { gold: next } = collectAtCell(gold, { i: 1, j: 1 })
    expect(remainingGold(next)).toBe(0)
    expect(collectedGold(next)).toBe(2)
    expect(shouldUnlockExit(next)).toBe(true)
  })

  it('advances level only when exit is unlocked, on exit cell, and all gold collected', () => {
    const exit = { i: 2, j: 2 }
    const cell = { i: 2, j: 2 }
    const notOnExit = { i: 1, j: 2 }
    const goldRemaining = [{ i: 0, j: 1, show: true }]
    const goldDone = [{ i: 0, j: 1, show: false }]

    expect(isOnExit(cell, exit)).toBe(true)
    expect(isOnExit(notOnExit, exit)).toBe(false)

    expect(shouldAdvanceLevel(goldRemaining, true, cell, exit)).toBe(false)
    expect(shouldAdvanceLevel(goldDone, false, cell, exit)).toBe(false)
    expect(shouldAdvanceLevel(goldDone, true, notOnExit, exit)).toBe(false)
    expect(shouldAdvanceLevel(goldDone, true, cell, exit)).toBe(true)
  })
})

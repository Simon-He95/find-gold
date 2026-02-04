import { describe, expect, it } from 'vitest'
import { computeGodOrthoFrustum } from '../src/maze/godview'

function expectCoversMaze(fr: { left: number, right: number, top: number, bottom: number }, cols: number, rows: number) {
  const halfW = cols / 2
  const halfH = rows / 2
  expect(fr.left).toBeLessThanOrEqual(-halfW)
  expect(fr.right).toBeGreaterThanOrEqual(halfW)
  expect(fr.bottom).toBeLessThanOrEqual(-halfH)
  expect(fr.top).toBeGreaterThanOrEqual(halfH)
}

describe('computeGodOrthoFrustum', () => {
  it('covers the whole maze across common aspect ratios', () => {
    const cols = 20
    const rows = 12
    for (const aspect of [16 / 9, 4 / 3, 1, 3 / 4, 9 / 16]) {
      const fr = computeGodOrthoFrustum(cols, rows, aspect, 1)
      expectCoversMaze(fr, cols, rows)

      const w = fr.right - fr.left
      const h = fr.top - fr.bottom
      expect(w).toBeGreaterThan(0)
      expect(h).toBeGreaterThan(0)
      expect(w / h).toBeCloseTo(aspect, 6)
    }
  })

  it('treats zoom as a zoom-out multiplier and clamps zoom < 1', () => {
    const cols = 10
    const rows = 10
    const aspect = 1

    const base = computeGodOrthoFrustum(cols, rows, aspect, 1)
    const zoomedOut = computeGodOrthoFrustum(cols, rows, aspect, 2)
    const clamped = computeGodOrthoFrustum(cols, rows, aspect, 0.25)

    expect((zoomedOut.right - zoomedOut.left)).toBeGreaterThan(base.right - base.left)
    expect((zoomedOut.top - zoomedOut.bottom)).toBeGreaterThan(base.top - base.bottom)

    expect(clamped).toEqual(base)
  })

  it('handles non-finite inputs', () => {
    const fr = computeGodOrthoFrustum(Number.NaN, Number.POSITIVE_INFINITY, Number.NaN, Number.NaN)
    for (const v of [fr.left, fr.right, fr.top, fr.bottom])
      expect(Number.isFinite(v)).toBe(true)
  })
})


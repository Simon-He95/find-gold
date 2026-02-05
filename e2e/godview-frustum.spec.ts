import { expect, test } from '@playwright/test'

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value))
    return min
  return Math.max(min, Math.min(max, value))
}

function computeGodOrthoFrustum(cols: number, rows: number, aspect: number, zoom = 1) {
  const safeCols = Math.floor(clampNumber(cols, 1, 5000))
  const safeRows = Math.floor(clampNumber(rows, 1, 5000))
  const safeAspect = clampNumber(aspect, 0.1, 10)
  const safeZoom = clampNumber(zoom, 1, 10)

  const padding = 0.9

  let halfW = (safeCols / 2 + padding) * safeZoom
  let halfH = (safeRows / 2 + padding) * safeZoom

  if (safeAspect >= halfW / halfH)
    halfW = halfH * safeAspect
  else
    halfH = halfW / safeAspect

  return { left: -halfW, right: halfW, top: halfH, bottom: -halfH }
}

test('god view frustum updates when advancing levels', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('FIND_GOLD_view_mode', '3d')
    localStorage.setItem('FIND_GOLD_god_view', 'true')
    localStorage.setItem('FIND_GOLD_god_zoom', '1')

    // Keep maze generation stable in e2e.
    let s = 0xBADC0DE
    Math.random = () => {
      s = (s * 1664525 + 1013904223) >>> 0
      return s / 0x100000000
    }
  })

  await page.goto('/?e2e=1')
  await page.waitForFunction(() => {
    const api = (window as any).__FIND_GOLD_E2E__?.flee3d
    return !!api?.getMazeMeta && !!api?.getGodCameraFrustum && !!api?.nextLevel
  })

  const aspect = await page.$eval('.three-root', (el) => {
    const r = el.getBoundingClientRect()
    return r.width / Math.max(1, r.height)
  })

  const initial = await page.evaluate(() => {
    const api = (window as any).__FIND_GOLD_E2E__.flee3d
    return { meta: api.getMazeMeta(), frustum: api.getGodCameraFrustum() }
  })
  expect(initial.frustum).not.toBeNull()

  {
    const expected = computeGodOrthoFrustum(initial.meta.cols, initial.meta.rows, aspect, 1)
    expect(initial.frustum.left).toBeCloseTo(expected.left, 6)
    expect(initial.frustum.right).toBeCloseTo(expected.right, 6)
    expect(initial.frustum.top).toBeCloseTo(expected.top, 6)
    expect(initial.frustum.bottom).toBeCloseTo(expected.bottom, 6)
  }

  let current = initial
  for (let i = 0; i < 16; i++) {
    await page.evaluate(() => (window as any).__FIND_GOLD_E2E__.flee3d.nextLevel())
    await page.waitForTimeout(50)
    current = await page.evaluate(() => {
      const api = (window as any).__FIND_GOLD_E2E__.flee3d
      return { meta: api.getMazeMeta(), frustum: api.getGodCameraFrustum() }
    })
    if (current.meta.cols !== initial.meta.cols || current.meta.rows !== initial.meta.rows)
      break
  }

  expect(
    current.meta.cols !== initial.meta.cols || current.meta.rows !== initial.meta.rows,
    `maze size did not change after advancing levels (initial ${initial.meta.cols}x${initial.meta.rows})`,
  ).toBeTruthy()

  const expected = computeGodOrthoFrustum(current.meta.cols, current.meta.rows, aspect, 1)
  expect(current.frustum).not.toBeNull()
  expect(current.frustum.left).toBeCloseTo(expected.left, 6)
  expect(current.frustum.right).toBeCloseTo(expected.right, 6)
  expect(current.frustum.top).toBeCloseTo(expected.top, 6)
  expect(current.frustum.bottom).toBeCloseTo(expected.bottom, 6)
})

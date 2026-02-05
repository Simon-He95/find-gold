import { expect, test } from '@playwright/test'

test('fun mirrors spawn, hide in god view, and swap variants', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('FIND_GOLD_view_mode', '3d')
    localStorage.setItem('FIND_GOLD_god_view', 'false')
    localStorage.setItem('FIND_GOLD_fun_mirrors', 'true')

    // Make maze generation stable in e2e.
    let s = 0xC0FFEE
    Math.random = () => {
      s = (s * 1664525 + 1013904223) >>> 0
      return s / 0x100000000
    }
  })

  await page.goto('/?e2e=1&mirrorTest=1')
  await page.waitForFunction(() => !!(window as any).__FIND_GOLD_E2E__?.flee3d?.getMirrors)

  const { initial, constants } = await page.evaluate(() => {
    const api = (window as any).__FIND_GOLD_E2E__.flee3d
    return { initial: api.getMirrors(), constants: api.constants }
  })
  expect(initial.length).toBeGreaterThan(0)
  expect(initial.every((m: any) => m.variant === 'self')).toBeTruthy()
  // Placement sanity: mirror surface is just outside the wall face; bounding box stays within wall height.
  for (const m of initial) {
    expect(m.visible).toBe(true)
    expect(m.wallFaceDelta, `wallFaceDelta=${m.wallFaceDelta}`).toBeGreaterThanOrEqual(0.001)
    expect(m.wallFaceDelta, `wallFaceDelta=${m.wallFaceDelta}`).toBeLessThanOrEqual(0.02)
    expect(m.bbox.maxY, `maxY=${m.bbox.maxY} wallHeight=${constants.wallHeight}`).toBeLessThanOrEqual(constants.wallHeight + 0.001)
    expect(m.bbox.minY, `minY=${m.bbox.minY}`).toBeGreaterThanOrEqual(-0.001)
  }

  await page.evaluate(() => (window as any).__FIND_GOLD_E2E__.flee3d.setGodView(true))
  await page.waitForFunction(() => (window as any).__FIND_GOLD_E2E__.flee3d.getMirrors().every((m: any) => m.visible === false))

  await page.evaluate(() => (window as any).__FIND_GOLD_E2E__.flee3d.setGodView(false))
  await page.waitForFunction(() => (window as any).__FIND_GOLD_E2E__.flee3d.getMirrors().some((m: any) => m.visible === true))

  const teleported = await page.evaluate(() => (window as any).__FIND_GOLD_E2E__.flee3d.teleportAndLookAtMirror(0, 0.7))
  expect(teleported).toBe(true)
  await page.waitForFunction(() => (window as any).__FIND_GOLD_E2E__.flee3d.getMirrors()[0]?.opacity > 0.22)

  await page.evaluate(() => (window as any).__FIND_GOLD_E2E__.flee3d.forceSwapNow(0))
  await page.waitForFunction(() => (window as any).__FIND_GOLD_E2E__.flee3d.getMirrors()[0]?.variant === 'ghost')

  await page.evaluate(() => (window as any).__FIND_GOLD_E2E__.flee3d.forceSwapNow(0))
  await page.waitForFunction(() => (window as any).__FIND_GOLD_E2E__.flee3d.getMirrors()[0]?.variant === 'demon')

  await page.evaluate(() => (window as any).__FIND_GOLD_E2E__.flee3d.setFunMirrors(false))
  await page.waitForFunction(() => (window as any).__FIND_GOLD_E2E__.flee3d.getMirrors().length === 0)

  await page.evaluate(() => (window as any).__FIND_GOLD_E2E__.flee3d.setFunMirrors(true))
  await page.waitForFunction(() => (window as any).__FIND_GOLD_E2E__.flee3d.getMirrors().length > 0)
})

import { expect, test } from '@playwright/test'

test('torch aim aligns with crosshair center', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('FIND_GOLD_view_mode', '3d')
    localStorage.setItem('FIND_GOLD_god_view', 'false')
  })
  await page.goto('/?torchTest=1')
  const crosshair = page.locator('.crosshair')
  const aim = page.locator('.torch-aim')

  await expect(crosshair).toBeVisible()
  await expect(aim).toBeVisible()

  await page.waitForTimeout(800)
  const diff = await page.evaluate(() => {
    const cross = document.querySelector('.crosshair') as HTMLElement | null
    const aimEl = document.querySelector('.torch-aim') as HTMLElement | null
    if (!cross || !aimEl)
      return { dx: 9999, dy: 9999, aimLeft: 'n/a', aimTop: 'n/a' }
    const c = cross.getBoundingClientRect()
    const a = aimEl.getBoundingClientRect()
    const cx = c.left + c.width / 2
    const cy = c.top + c.height / 2
    const ax = a.left + a.width / 2
    const ay = a.top + a.height / 2
    return {
      dx: Math.abs(cx - ax),
      dy: Math.abs(cy - ay),
      aimLeft: aimEl.style.left || getComputedStyle(aimEl).left,
      aimTop: aimEl.style.top || getComputedStyle(aimEl).top,
    }
  })
  expect(diff.dx, `dx=${diff.dx} left=${diff.aimLeft} top=${diff.aimTop}`).toBeLessThanOrEqual(2)
  expect(diff.dy, `dy=${diff.dy} left=${diff.aimLeft} top=${diff.aimTop}`).toBeLessThanOrEqual(2)
})

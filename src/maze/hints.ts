import type { GoldCell, GridCell } from './step'

export function nearestGoldDistance(gold: GoldCell[], cell: GridCell) {
  let best = Number.POSITIVE_INFINITY
  for (const g of gold) {
    if (!g.show)
      continue
    const d = Math.abs(g.i - cell.i) + Math.abs(g.j - cell.j)
    if (d < best)
      best = d
  }
  return Number.isFinite(best) ? best : null
}

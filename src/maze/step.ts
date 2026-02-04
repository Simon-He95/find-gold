export interface GridCell {
  i: number
  j: number
}

export interface ExitCell {
  i: number
  j: number
}

export interface GoldCell {
  i: number
  j: number
  show: boolean
}

export function cellFromWorld(
  x: number,
  z: number,
  cellSize: number,
  cols: number,
  rows: number,
): GridCell {
  const i = Math.max(0, Math.min(cols - 1, Math.floor(x / cellSize)))
  const j = Math.max(0, Math.min(rows - 1, Math.floor(z / cellSize)))
  return { i, j }
}

export function collectAtCell(gold: GoldCell[], cell: GridCell) {
  let collected = 0
  const next = gold.map((g) => {
    if (!g.show)
      return g
    if (g.i === cell.i && g.j === cell.j) {
      collected++
      return { ...g, show: false }
    }
    return g
  })
  return { gold: next, collected }
}

export function remainingGold(gold: GoldCell[]) {
  let remaining = 0
  for (const g of gold) {
    if (g.show)
      remaining++
  }
  return remaining
}

export function shouldUnlockExit(gold: GoldCell[]) {
  return gold.length > 0 && remainingGold(gold) === 0
}

export function isOnExit(cell: GridCell, exit: ExitCell | null) {
  if (!exit)
    return false
  return cell.i === exit.i && cell.j === exit.j
}

export function shouldAdvanceLevel(
  gold: GoldCell[],
  exitUnlocked: boolean,
  cell: GridCell,
  exit: ExitCell | null,
) {
  if (!exitUnlocked)
    return false
  if (!isOnExit(cell, exit))
    return false
  return shouldUnlockExit(gold)
}

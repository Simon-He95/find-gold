import type { MazeSnapshot } from '~/canvas'

export interface PlayerState {
  x: number
  z: number
  y: number
}

export interface CollisionConfig {
  cellSize: number
  radius: number
  height: number
  epsilon: number
}

export function cellIndexFromWorld(value: number, cellSize: number) {
  return Math.floor(value / cellSize)
}

export function worldFromCellCenter(i: number, cellSize: number) {
  return i * cellSize + cellSize / 2
}

export function getCell(snapshot: MazeSnapshot, i: number, j: number) {
  if (i < 0 || j < 0 || i > snapshot.cols - 1 || j > snapshot.rows - 1)
    return null
  const idx = i + j * snapshot.cols
  return snapshot.cells[idx] ?? null
}

export function moveWithGridCollisions(
  snapshot: MazeSnapshot,
  cfg: CollisionConfig,
  player: PlayerState,
  dx: number,
  dz: number,
) {
  // Move with sub-steps to avoid "tunneling" through multiple cells on large deltas.
  const maxDelta = Math.max(Math.abs(dx), Math.abs(dz))
  const maxStep = Math.max(0.01, cfg.cellSize * 0.25)
  const steps = Math.max(1, Math.ceil(maxDelta / maxStep))

  let x = player.x
  let z = player.z

  const stepX = dx / steps
  const stepZ = dz / steps

  for (let s = 0; s < steps; s++) {
    x = resolveAxis(snapshot, cfg, x, z, stepX, 'x')
    z = resolveAxis(snapshot, cfg, x, z, stepZ, 'z')
  }

  return { ...player, x, z }
}

function resolveAxis(
  snapshot: MazeSnapshot,
  cfg: CollisionConfig,
  x: number,
  z: number,
  d: number,
  axis: 'x' | 'z',
) {
  if (!d)
    return axis === 'x' ? x : z

  const cellSize = cfg.cellSize
  const radius = cfg.radius
  const eps = cfg.epsilon

  const maxX = snapshot.cols * cellSize
  const maxZ = snapshot.rows * cellSize

  const currentI = cellIndexFromWorld(x, cellSize)
  const currentJ = cellIndexFromWorld(z, cellSize)
  const cell = getCell(snapshot, currentI, currentJ)
  const current = axis === 'x' ? x : z
  let value = current + d

  // hard bounds
  if (axis === 'x')
    value = Math.max(radius + eps, Math.min(maxX - radius - eps, value))
  else
    value = Math.max(radius + eps, Math.min(maxZ - radius - eps, value))

  if (!cell)
    return value

  const local = axis === 'x'
    ? x - currentI * cellSize
    : z - currentJ * cellSize

  // boundaries in local space [0, cellSize]
  const min = radius
  const max = cellSize - radius

  // Left / Top
  if (local + d < min) {
    const blocked = axis === 'x' ? cell.walls[2] : cell.walls[0]
    if (blocked) {
      const base = axis === 'x' ? currentI * cellSize : currentJ * cellSize
      value = base + min + eps
    }
  }

  // Right / Bottom
  if (local + d > max) {
    const blocked = axis === 'x' ? cell.walls[3] : cell.walls[1]
    if (blocked) {
      const base = axis === 'x' ? currentI * cellSize : currentJ * cellSize
      value = base + max - eps
    }
  }

  return value
}

export function manhattanCellDistance(a: { i: number, j: number }, b: { i: number, j: number }) {
  return Math.abs(a.i - b.i) + Math.abs(a.j - b.j)
}

import { describe, expect, it, vi } from 'vitest'
import { exitUnlocked, getMazeSnapshot, goldArray, n, setup } from '../src/canvas'
import { getCell, moveWithGridCollisions } from '../src/maze/collision'
import { cellFromWorld, collectAtCell, shouldAdvanceLevel, shouldUnlockExit, stepCounter } from '../src/maze/step'

function bfsPath(snapshot: any, from: { i: number, j: number }, to: { i: number, j: number }) {
  const startKey = `${from.i},${from.j}`
  const targetKey = `${to.i},${to.j}`
  const queue: Array<{ i: number, j: number }> = [from]
  const prev = new Map<string, string | null>([[startKey, null]])

  while (queue.length) {
    const cur = queue.shift()!
    const curKey = `${cur.i},${cur.j}`
    if (curKey === targetKey)
      break

    const curCell = getCell(snapshot, cur.i, cur.j)!
    const dirs: Array<[number, number, 0 | 1 | 2 | 3]> = [
      [0, -1, 0],
      [0, 1, 1],
      [-1, 0, 2],
      [1, 0, 3],
    ]
    for (const [di, dj, wIdx] of dirs) {
      if (curCell.walls[wIdx])
        continue
      const ni = cur.i + di
      const nj = cur.j + dj
      const next = getCell(snapshot, ni, nj)
      if (!next)
        continue
      const key = `${ni},${nj}`
      if (prev.has(key))
        continue
      prev.set(key, curKey)
      queue.push({ i: ni, j: nj })
    }
  }

  if (!prev.has(targetKey))
    throw new Error(`No path from ${startKey} to ${targetKey}`)

  const path: Array<{ i: number, j: number }> = []
  let cur: string | null = targetKey
  while (cur) {
    const [i, j] = cur.split(',').map(Number)
    path.push({ i, j })
    cur = prev.get(cur) ?? null
  }
  path.reverse()
  return path
}

describe('3D integration (logic-only)', () => {
  it('can traverse to collect all gold and reach exit with collision steps', () => {
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.42)
    const prevLevel = n.value
    const storageKey = 'FIND_GOLD_level'
    const prevStored = globalThis.localStorage?.getItem(storageKey) ?? null
    try {
      // keep this integration test small + deterministic to avoid slow/heavy runs
      globalThis.localStorage?.setItem(storageKey, '3')
      n.value = 3
      setup()
      const snap = getMazeSnapshot()
      expect(snap.exit).not.toBeNull()
      expect(snap.gold.length).toBeGreaterThan(1)

      const cfg = { cellSize: 1, radius: 0.18, height: 1.6, epsilon: 0.001 }
      const pos = { x: 0.5, y: 0.55, z: 0.5 }
      let lastCell = { i: 0, j: 0 }
      let steps = 0

      // deterministic visiting order for test stability
      const targets = [...snap.gold].filter((g: any) => g.show).map((g: any) => ({ i: g.i, j: g.j }))
      targets.sort((a, b) => (a.j - b.j) || (a.i - b.i))

      const walkPath = (path: Array<{ i: number, j: number }>) => {
        for (let idx = 1; idx < path.length; idx++) {
          const next = path[idx]
          const targetX = next.i + 0.5
          const targetZ = next.j + 0.5
          const moved = moveWithGridCollisions(snap, cfg, pos, targetX - pos.x, targetZ - pos.z)
          pos.x = moved.x
          pos.z = moved.z

          const cell = cellFromWorld(pos.x, pos.z, 1, snap.cols, snap.rows)
          if (cell.i !== next.i || cell.j !== next.j)
            throw new Error(`Step mismatch: expected (${next.i},${next.j}) got (${cell.i},${cell.j})`)

          const stepped = stepCounter(steps, lastCell, cell)
          steps = stepped.steps
          lastCell = stepped.lastCell
        }
      }

      for (const t of targets) {
        const here = cellFromWorld(pos.x, pos.z, 1, snap.cols, snap.rows)
        const path = bfsPath(snap, here, t)
        walkPath(path)

        const cell = cellFromWorld(pos.x, pos.z, 1, snap.cols, snap.rows)
        const collected = collectAtCell(goldArray.value as any, cell)
        goldArray.value = collected.gold as any
      }

      expect(shouldUnlockExit(goldArray.value as any)).toBe(true)
      exitUnlocked.value = true

      const exit = snap.exit!
      const here = cellFromWorld(pos.x, pos.z, 1, snap.cols, snap.rows)
      walkPath(bfsPath(snap, here, exit))

      const cell = cellFromWorld(pos.x, pos.z, 1, snap.cols, snap.rows)
      expect(cell).toEqual(exit)
      expect(shouldAdvanceLevel(goldArray.value as any, exitUnlocked.value, cell, exit)).toBe(true)
      expect(steps).toBeGreaterThan(0)
    }
    finally {
      n.value = prevLevel
      if (prevStored === null)
        globalThis.localStorage?.removeItem(storageKey)
      else
        globalThis.localStorage?.setItem(storageKey, prevStored)
      rnd.mockRestore()
    }
  })
})

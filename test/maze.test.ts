import { describe, expect, it, vi } from 'vitest'
import { getMazeSnapshot, setup } from '../src/canvas'
import { getCell, moveWithGridCollisions } from '../src/maze/collision'

describe('maze snapshot invariants', () => {
  it('generates a connected maze and valid items', () => {
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.42)
    try {
      setup()
      const snap = getMazeSnapshot()
      expect(snap.cols).toBeGreaterThan(1)
      expect(snap.rows).toBeGreaterThan(1)
      expect(snap.cells.length).toBe(snap.cols * snap.rows)
      expect(snap.gold.length).toBeGreaterThanOrEqual(1)
      expect(snap.exit).not.toBeNull()

      const exit = snap.exit!
      expect(exit.i).toBeGreaterThanOrEqual(0)
      expect(exit.j).toBeGreaterThanOrEqual(0)
      expect(exit.i).toBeLessThan(snap.cols)
      expect(exit.j).toBeLessThan(snap.rows)

      // no gold on start or exit
      const goldPos = new Set<string>()
      for (const g of snap.gold) {
        expect(!(g.i === 0 && g.j === 0)).toBe(true)
        expect(!(g.i === exit.i && g.j === exit.j)).toBe(true)
        const key = `${g.i},${g.j}`
        expect(goldPos.has(key)).toBe(false)
        goldPos.add(key)
      }

      // wall symmetry between neighbors
      for (let j = 0; j < snap.rows; j++) {
        for (let i = 0; i < snap.cols; i++) {
          const cell = getCell(snap, i, j)!
          const right = getCell(snap, i + 1, j)
          const bottom = getCell(snap, i, j + 1)
          if (right)
            expect(cell.walls[3]).toBe(right.walls[2])
          if (bottom)
            expect(cell.walls[1]).toBe(bottom.walls[0])
        }
      }

      // snapshot cell order should be row-major: i + j * cols
      for (let idx = 0; idx < snap.cells.length; idx++) {
        const cell = snap.cells[idx]
        expect(cell.i + cell.j * snap.cols).toBe(idx)
      }

      // reachable exit from start via BFS
      const startKey = '0,0'
      const targetKey = `${exit.i},${exit.j}`
      const queue: Array<{ i: number, j: number }> = [{ i: 0, j: 0 }]
      const visited = new Set<string>([startKey])

      while (queue.length) {
        const cur = queue.shift()!
        const curCell = getCell(snap, cur.i, cur.j)!
        const steps: Array<[number, number, 0 | 1 | 2 | 3]> = [
          [0, -1, 0], // top
          [0, 1, 1], // bottom
          [-1, 0, 2], // left
          [1, 0, 3], // right
        ]
        for (const [di, dj, wIdx] of steps) {
          if (curCell.walls[wIdx as 0 | 1 | 2 | 3])
            continue
          const ni = cur.i + di
          const nj = cur.j + dj
          const nextCell = getCell(snap, ni, nj)
          if (!nextCell)
            continue
          const key = `${ni},${nj}`
          if (visited.has(key))
            continue
          visited.add(key)
          queue.push({ i: ni, j: nj })
        }
      }

      expect(visited.size).toBe(snap.cols * snap.rows)
      expect(visited.has(targetKey)).toBe(true)

      // Perfect maze: edges = nodes - 1 (tree)
      let edges = 0
      for (let j = 0; j < snap.rows; j++) {
        for (let i = 0; i < snap.cols; i++) {
          const cell = getCell(snap, i, j)!
          if (i + 1 < snap.cols && !cell.walls[3])
            edges++
          if (j + 1 < snap.rows && !cell.walls[1])
            edges++
        }
      }
      expect(edges).toBe(snap.cols * snap.rows - 1)
    }
    finally {
      rnd.mockRestore()
    }
  })
})

describe('grid collision', () => {
  it('does not cross through closed walls', () => {
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.42)
    try {
      setup()
      const snap = getMazeSnapshot()
      const cfg = { cellSize: 1, radius: 0.2, height: 1.6, epsilon: 0.001 }
      const start = { x: 0.5, y: 0.55, z: 0.5 }
      const cell = getCell(snap, 0, 0)!

      // attempt to cross left/top should clamp if wall exists (outer border almost always closed)
      const movedLeft = moveWithGridCollisions(snap, cfg, start, -1, 0)
      if (cell.walls[2])
        expect(movedLeft.x).toBeGreaterThan(0)

      const movedUp = moveWithGridCollisions(snap, cfg, start, 0, -1)
      if (cell.walls[0])
        expect(movedUp.z).toBeGreaterThan(0)
    }
    finally {
      rnd.mockRestore()
    }
  })

  it('clamps against an internal right wall', () => {
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.42)
    try {
      setup()
      const snap = getMazeSnapshot()
      const cfg = { cellSize: 1, radius: 0.2, height: 1.6, epsilon: 0.001 }

      let picked: { i: number, j: number } | null = null
      for (let j = 0; j < snap.rows; j++) {
        for (let i = 0; i < snap.cols - 1; i++) {
          const cell = getCell(snap, i, j)!
          if (cell.walls[3]) {
            picked = { i, j }
            break
          }
        }
        if (picked)
          break
      }

      expect(picked).not.toBeNull()
      const { i, j } = picked!
      const start = { x: i + 0.5, y: 0.55, z: j + 0.5 }
      const moved = moveWithGridCollisions(snap, cfg, start, 0.8, 0)

      const maxLocal = cfg.cellSize - cfg.radius - cfg.epsilon
      const maxX = i * cfg.cellSize + maxLocal
      expect(moved.x).toBeLessThanOrEqual(maxX + 1e-6)
    }
    finally {
      rnd.mockRestore()
    }
  })

  it('does not tunnel through multiple cells on large deltas', () => {
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.42)
    try {
      setup()
      const snap = getMazeSnapshot()
      const cfg = { cellSize: 1, radius: 0.2, height: 1.6, epsilon: 0.001 }

      let found: { i: number, j: number } | null = null

      // Find pattern: open between (i,j)->(i+1,j), but closed between (i+1,j)->(i+2,j)
      for (let j = 0; j < snap.rows; j++) {
        for (let i = 0; i < snap.cols - 2; i++) {
          const c0 = getCell(snap, i, j)!
          const c1 = getCell(snap, i + 1, j)!
          if (!c0.walls[3] && c1.walls[3]) {
            found = { i, j }
            break
          }
        }
        if (found)
          break
      }

      expect(found).not.toBeNull()
      const { i, j } = found!

      const start = { x: i + 0.5, y: 0.55, z: j + 0.5 }
      const moved = moveWithGridCollisions(snap, cfg, start, 2.4, 0)

      // should not pass the wall at the right edge of cell (i+1,j)
      const maxLocal = cfg.cellSize - cfg.radius - cfg.epsilon
      const maxX = (i + 1) * cfg.cellSize + maxLocal
      expect(moved.x).toBeLessThanOrEqual(maxX + 1e-6)
    }
    finally {
      rnd.mockRestore()
    }
  })

  it('does not bypass a closed wall when moving diagonally', () => {
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.42)
    try {
      setup()
      const snap = getMazeSnapshot()
      const cfg = { cellSize: 1, radius: 0.2, height: 1.6, epsilon: 0.001 }

      let picked: { i: number, j: number } | null = null
      for (let j = 0; j < snap.rows; j++) {
        for (let i = 0; i < snap.cols - 1; i++) {
          const cell = getCell(snap, i, j)!
          if (cell.walls[3]) {
            picked = { i, j }
            break
          }
        }
        if (picked)
          break
      }

      expect(picked).not.toBeNull()
      const { i, j } = picked!
      const start = { x: i + 0.5, y: 0.55, z: j + 0.5 }

      // Attempt to move towards the closed right wall, with a small Z component.
      const moved = moveWithGridCollisions(snap, cfg, start, 0.8, 0.3)
      const maxLocal = cfg.cellSize - cfg.radius - cfg.epsilon
      const maxX = i * cfg.cellSize + maxLocal
      expect(moved.x).toBeLessThanOrEqual(maxX + 1e-6)
    }
    finally {
      rnd.mockRestore()
    }
  })
})

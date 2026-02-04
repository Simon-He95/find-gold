import { computed, ref } from 'vue'

export const n = ref(1)
export const hideMask = ref(false)
useStorage('FIND_GOLD_level', n)

function getDevicePixelRatio() {
  if (typeof window === 'undefined')
    return 1
  const v = window.devicePixelRatio || 1
  if (!Number.isFinite(v))
    return 1
  return Math.max(1, Math.min(4, v))
}

function getInitialBoardSizePx() {
  if (typeof window === 'undefined')
    return 600
  const viewportW = window.innerWidth || window.outerWidth || 600
  const raw = viewportW > 600 ? 600 : (viewportW - 70)
  return Math.max(240, Math.floor(raw))
}

export const boardSizePx = ref(getInitialBoardSizePx())
const boardPx = computed(() => boardSizePx.value)

export const w = computed(() => {
  const size = boardPx.value
  // 计算最佳单元格大小以填充画布
  const rawMinSize = Math.floor(size / (3 * n.value))
  const minSize = rawMinSize < 20 ? 20 : rawMinSize
  // 调整单元格大小，确保能够均匀分布（避免边缘黑边）
  const divisor = Math.max(1, Math.floor(size / minSize))
  return Math.floor(size / divisor)
})
const grid: Cell[] = []
const canvas: HTMLCanvasElement = document.createElement('canvas')
canvas.style.display = 'block'
let ctx: CanvasRenderingContext2D = makeStubContext(canvas)
let current: Cell
// 通过计算得出能够整除画布宽度的列数
const cols = computed(() => Math.floor(boardPx.value / w.value))
// 通过计算得出能够整除画布高度的行数
const rows = computed(() => Math.floor(boardPx.value / w.value))
export const imgLeft = ref(0)
export const imgTop = ref(0)
export const mazeCols = cols
export const mazeRows = rows

// mask
export const mask: HTMLCanvasElement = document.createElement('canvas')
let maskCtx: CanvasRenderingContext2D = makeStubContext(mask)
let maskX = 0
let maskY = 0

// golds
export const golds: any[] = []
export const goldArray = ref<any[]>([])
export const start = ref()
export const win = ref(false)
export const rangeScope = ref(1)
const range = computed(() => rangeScope.value * (n.value > 5 ? w.value : w.value * 5 / n.value))

export const exit = ref<{ x: number, y: number, i: number, j: number } | null>(null)
export const exitUnlocked = ref(false)

export interface MazeCellSnapshot {
  i: number
  j: number
  walls: [boolean, boolean, boolean, boolean]
}

export interface MazeSnapshot {
  cols: number
  rows: number
  cellSizePx: number
  exit: { i: number, j: number } | null
  gold: Array<{ i: number, j: number, show: boolean }>
  cells: MazeCellSnapshot[]
}

export const magnifying = ref<any[]>([])

export const gift = ref<any[]>([])

interface MazeTheme {
  wall: [number, number, number]
  wallHi: [number, number, number]
  wallLo: [number, number, number]
  wallStroke: [number, number, number]
  floor: [number, number, number]
  floorHi: [number, number, number]
}

const theme = ref<MazeTheme>({
  wall: [140, 110, 255],
  wallHi: [200, 180, 255],
  wallLo: [70, 45, 160],
  wallStroke: [20, 16, 40],
  floor: [10, 12, 18],
  floorHi: [18, 22, 34],
})

function safeGet2dContext(el: HTMLCanvasElement): CanvasRenderingContext2D {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isJSDOM = /jsdom/i.test(ua)
  const isNoWebGL = typeof (globalThis as any).WebGLRenderingContext === 'undefined'
  if (isJSDOM || isNoWebGL)
    return makeStubContext(el)

  try {
    const context = el.getContext('2d')
    if (context)
      return context
  }
  catch {}

  return makeStubContext(el)
}

function makeStubContext(el: HTMLCanvasElement): CanvasRenderingContext2D {
  const noop = () => {}
  const gradient = { addColorStop: noop } as unknown as CanvasGradient
  return {
    canvas: el,
    clearRect: noop,
    fillRect: noop,
    strokeRect: noop,
    beginPath: noop,
    arc: noop,
    fill: noop,
    stroke: noop,
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
    setTransform: noop,
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
    rotate: noop,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D
}

function clampInt(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    clampInt(a[0] + (b[0] - a[0]) * t),
    clampInt(a[1] + (b[1] - a[1]) * t),
    clampInt(a[2] + (b[2] - a[2]) * t),
  ]
}

function rgba(c: [number, number, number], alpha = 1) {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = (h % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r1 = 0
  let g1 = 0
  let b1 = 0
  if (hp >= 0 && hp < 1) {
    [r1, g1, b1] = [c, x, 0]
  }
  else if (hp >= 1 && hp < 2) {
    [r1, g1, b1] = [x, c, 0]
  }
  else if (hp >= 2 && hp < 3) {
    [r1, g1, b1] = [0, c, x]
  }
  else if (hp >= 3 && hp < 4) {
    [r1, g1, b1] = [0, x, c]
  }
  else if (hp >= 4 && hp < 5) {
    [r1, g1, b1] = [x, 0, c]
  }
  else {
    [r1, g1, b1] = [c, 0, x]
  }

  const m = l - c / 2
  return [
    clampInt((r1 + m) * 255),
    clampInt((g1 + m) * 255),
    clampInt((b1 + m) * 255),
  ]
}

function hash2(i: number, j: number) {
  // deterministic tiny noise for floor texture
  let x = (i * 73856093) ^ (j * 19349663)
  x = (x ^ (x >>> 13)) >>> 0
  x = (x * 1274126177) >>> 0
  return x / 0xFFFFFFFF
}

function applyCanvasSizing() {
  const size = boardSizePx.value
  const dpr = getDevicePixelRatio()
  canvas.style.width = `${size}px`
  canvas.style.height = `${size}px`
  canvas.width = Math.max(1, Math.round(size * dpr))
  canvas.height = Math.max(1, Math.round(size * dpr))
  ctx = safeGet2dContext(canvas)
  try {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  catch {}
}

function applyMaskSizing() {
  const size = boardSizePx.value
  const dpr = getDevicePixelRatio()
  mask.style.width = `${2 * size}px`
  mask.style.height = `${2 * size}px`
  mask.width = Math.max(1, Math.round(2 * size * dpr))
  mask.height = Math.max(1, Math.round(2 * size * dpr))
  maskCtx = safeGet2dContext(mask)
  try {
    maskCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  catch {}
}

// 优化后的setup函数，增加难度调整
export function setup() {
  applyCanvasSizing()
  const h = Math.floor(Math.random() * 360)
  const wall = hslToRgb(h, 0.72, 0.55)
  const wallHi = mix(wall, [255, 255, 255], 0.35)
  const wallLo = mix(wall, [0, 0, 0], 0.55)
  const wallStroke = mix(wall, [0, 0, 0], 0.8)
  const floor = mix(wall, [8, 10, 16], 0.8)
  const floorHi = mix(floor, [255, 255, 255], 0.06)
  theme.value = { wall, wallHi, wallLo, wallStroke, floor, floorHi }

  // 基于关卡动态调整视野范围
  rangeScope.value = Math.max(0.6, 1.2 - (n.value * 0.04)) // 随着关卡增加，初始视野会逐渐减小

  const size = boardSizePx.value
  ctx.clearRect(0, 0, size, size)
  imgLeft.value = 0
  imgTop.value = 0
  win.value = false
  exitUnlocked.value = false
  grid.length = 0
  golds.length = 0
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, size, size)

  // 动态调整迷宫大小，随关卡增加（按 row-major: i + j * cols）
  for (let j = 0; j < rows.value; j++) {
    for (let i = 0; i < cols.value; i++) {
      grid.push(new Cell(i, j))
    }
  }

  // 填充底色，确保不留黑边
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, size, size)

  current = grid[0]
  generatePerfectMaze()
  renderMaze()
  chooseExit()
  goldArray.value = getGold()
  start.value = Date.now()
  return canvas
}

class Cell {
  i: number
  j: number
  walls: boolean[] = [true, true, true, true]
  visited = false
  status = false
  constructor(i: number, j: number) {
    this.i = i
    this.j = j
  }

  show() {
    const x = this.i * w.value
    const y = this.j * w.value
    const size = w.value
    const wallThickness = Math.max(2, Math.min(7, Math.floor(size / 5)))
    const depth = Math.max(2, Math.min(7, Math.floor(wallThickness * 1.15)))

    // --- Floor tile (pseudo 3D) ---
    const noise = hash2(this.i, this.j)
    const floorJitter = (noise - 0.5) * 10
    const floorColor = [
      clampInt(theme.value.floor[0] + floorJitter),
      clampInt(theme.value.floor[1] + floorJitter),
      clampInt(theme.value.floor[2] + floorJitter),
    ] as [number, number, number]
    ctx.fillStyle = rgba(floorColor, 1)
    ctx.fillRect(x, y, size, size)

    // subtle vignette inside cell
    ctx.fillStyle = rgba(theme.value.floorHi, 0.18)
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2)

    const drawWall = (wx: number, wy: number, ww: number, wh: number, dir: 'h' | 'v') => {
      // shadow (down-right)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
      ctx.fillRect(wx + depth, wy + depth, ww, wh)

      // body gradient
      const g = dir === 'h'
        ? ctx.createLinearGradient(wx, wy, wx, wy + wh)
        : ctx.createLinearGradient(wx, wy, wx + ww, wy)
      g.addColorStop(0, rgba(theme.value.wallHi, 1))
      g.addColorStop(0.45, rgba(theme.value.wall, 1))
      g.addColorStop(1, rgba(theme.value.wallLo, 1))
      ctx.fillStyle = g
      ctx.fillRect(wx, wy, ww, wh)

      // bevel highlight + stroke
      ctx.fillStyle = rgba(theme.value.wallHi, 0.8)
      if (dir === 'h')
        ctx.fillRect(wx, wy, ww, 1)
      else
        ctx.fillRect(wx, wy, 1, wh)

      ctx.fillStyle = rgba(theme.value.wallStroke, 0.75)
      if (dir === 'h')
        ctx.fillRect(wx, wy + wh - 1, ww, 1)
      else
        ctx.fillRect(wx + ww - 1, wy, 1, wh)
    }

    // --- Walls ---
    // avoid double-draw: only render top/left, plus border bottom/right
    if (this.walls[0])
      drawWall(x, y, size, wallThickness, 'h')

    if (this.walls[2])
      drawWall(x, y, wallThickness, size, 'v')

    if (this.j === rows.value - 1 && this.walls[1])
      drawWall(x, y + size - wallThickness, size, wallThickness, 'h')

    if (this.i === cols.value - 1 && this.walls[3])
      drawWall(x + size - wallThickness, y, wallThickness, size, 'v')
  }

  // The line method is no longer needed, but we'll keep it for compatibility
  line(x: number, y: number, x2: number, y2: number) {
    // This method is now empty as we're using fillRect instead
  }

  index(i: number, j: number) {
    if (i < 0 || j < 0 || i > cols.value - 1 || j > rows.value - 1)
      return -1
    return i + j * cols.value
  }

  checkNeighbors() {
    const neighbors = []
    const top = grid[this.index(this.i, this.j - 1)]
    const bottom = grid[this.index(this.i, this.j + 1)]
    const left = grid[this.index(this.i - 1, this.j)]
    const right = grid[this.index(this.i + 1, this.j)]

    if (top && !top.visited)
      neighbors.push(top)

    if (bottom && !bottom.visited)
      neighbors.push(bottom)

    if (left && !left.visited)
      neighbors.push(left)

    if (right && !right.visited)
      neighbors.push(right)

    if (neighbors.length) {
      const neighbor = neighbors[Math.floor(Math.random() * neighbors.length)]
      return neighbor
    }
    else {
      return undefined
    }
  }

  checkEveryNeighbors() {
    const neighbors = []
    const top = grid[this.index(this.i, this.j - 1)]
    const bottom = grid[this.index(this.i, this.j + 1)]
    const left = grid[this.index(this.i - 1, this.j)]
    const right = grid[this.index(this.i + 1, this.j)]
    if (top && !top.status && !this.walls[0] && !top.walls[1])
      neighbors.push(top)
    if (bottom && !bottom.status && !this.walls[1] && !bottom.walls[0])
      neighbors.push(bottom)
    if (left && !left.status && !this.walls[2] && !left.walls[3])
      neighbors.push(left)
    if (right && !right.status && !this.walls[3] && !right.walls[2])
      neighbors.push(right)
    if (neighbors.length) {
      const neighbor = neighbors[Math.floor(Math.random() * neighbors.length)]
      return neighbor
    }
    return undefined
  }
}

// 生成“完美迷宫”(Perfect Maze)：连通且任意两点路径唯一
function generatePerfectMaze() {
  // 重置所有单元格
  grid.forEach((cell) => {
    cell.visited = false
    cell.status = false
    cell.walls = [true, true, true, true] // 初始化所有墙
  })

  const stack = []
  current = grid[0] // 起点
  current.visited = true
  stack.push(current)

  // 深度优先搜索生成迷宫
  while (stack.length > 0) {
    current = stack[stack.length - 1]
    const next = current.checkNeighbors()

    if (next) {
      next.visited = true
      removeWalls(current, next)
      stack.push(next)
    }
    else {
      stack.pop()
    }
  }
}

function renderMaze() {
  const size = boardSizePx.value
  // Base floor (pseudo-3D ambience)
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = 'rgba(6, 8, 12, 1)'
  ctx.fillRect(0, 0, size, size)
  const glow = ctx.createRadialGradient(size * 0.45, size * 0.35, 0, size * 0.45, size * 0.35, size * 0.95)
  glow.addColorStop(0, rgba(theme.value.floorHi, 0.35))
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, size, size)

  // 绘制迷宫
  for (let i = 0; i < grid.length; i++) {
    grid[i].show()
  }

  // Outer frame for crisp edges
  ctx.strokeStyle = rgba(theme.value.wallStroke, 0.45)
  ctx.lineWidth = Math.max(2, Math.min(5, Math.floor(w.value / 8)))
  ctx.strokeRect(1, 1, size - 2, size - 2)

  // 设置起点
  current = grid[0]
}

function chooseExit() {
  // 选择出口：从起点出发最远的格子（更鼓励探索）
  const startCell = grid[0]
  const farthest = findFarthestCell(startCell)
  exit.value = {
    i: farthest.i,
    j: farthest.j,
    x: farthest.i * w.value,
    y: farthest.j * w.value,
  }
}

export function getMazeSnapshot(): MazeSnapshot {
  return {
    cols: cols.value,
    rows: rows.value,
    cellSizePx: w.value,
    exit: exit.value ? { i: exit.value.i, j: exit.value.j } : null,
    gold: goldArray.value.map(g => ({ i: g.i, j: g.j, show: !!g.show })),
    cells: grid.map((c: Cell) => ({
      i: c.i,
      j: c.j,
      walls: [!!c.walls[0], !!c.walls[1], !!c.walls[2], !!c.walls[3]],
    })) as MazeCellSnapshot[],
  }
}

function getOpenNeighbors(cell: Cell) {
  const neighbors: Cell[] = []
  if (!cell.walls[0]) {
    const top = grid[cell.index(cell.i, cell.j - 1)]
    if (top)
      neighbors.push(top)
  }
  if (!cell.walls[1]) {
    const bottom = grid[cell.index(cell.i, cell.j + 1)]
    if (bottom)
      neighbors.push(bottom)
  }
  if (!cell.walls[2]) {
    const left = grid[cell.index(cell.i - 1, cell.j)]
    if (left)
      neighbors.push(left)
  }
  if (!cell.walls[3]) {
    const right = grid[cell.index(cell.i + 1, cell.j)]
    if (right)
      neighbors.push(right)
  }
  return neighbors
}

function findFarthestCell(from: Cell) {
  const visited = new Set<Cell>()
  const queue: Array<{ cell: Cell, d: number }> = [{ cell: from, d: 0 }]
  visited.add(from)
  let farthest = from
  let farthestDistance = 0

  while (queue.length) {
    const { cell, d } = queue.shift()!
    if (d >= farthestDistance) {
      farthest = cell
      farthestDistance = d
    }
    for (const next of getOpenNeighbors(cell)) {
      if (visited.has(next))
        continue
      visited.add(next)
      queue.push({ cell: next, d: d + 1 })
    }
  }

  return farthest
}

function removeWalls(a: Cell, b: Cell) {
  const x = a.i - b.i
  const y = a.j - b.j
  if (x === 1) {
    a.walls[2] = false
    b.walls[3] = false
  }
  else if (x === -1) {
    a.walls[3] = false
    b.walls[2] = false
  }
  else if (y === 1) {
    a.walls[0] = false
    b.walls[1] = false
  }
  else if (y === -1) {
    a.walls[1] = false
    b.walls[0] = false
  }
}

export function rightMove() {
  const right = grid[current.index(current.i + 1, current.j)]
  if (current.walls[3] || !right || right.walls[2])
    return false
  if (imgLeft.value < (cols.value - 1) * w.value) {
    imgLeft.value += w.value
    mask.style.transform = `translate(${maskX += w.value}px, ${maskY}px)`
  }
  current = right
  return true
}

export function leftMove() {
  const left = grid[current.index(current.i - 1, current.j)]
  if (current.walls[2] || !left || left.walls[3])
    return false
  if (imgLeft.value > 0) {
    imgLeft.value -= w.value
    mask.style.transform = `translate(${maskX -= w.value}px, ${maskY}px)`
  }
  current = left
  return true
}

export function topMove() {
  const top = grid[current.index(current.i, current.j - 1)]
  if (current.walls[0] || !top || top.walls[1])
    return false
  if (imgTop.value > 0) {
    imgTop.value -= w.value
    mask.style.transform = `translate(${maskX}px, ${maskY -= w.value}px)`
  }
  current = top
  return true
}

export function downMove() {
  const down = grid[current.index(current.i, current.j + 1)]
  if (current.walls[1] || !down || down.walls[0])
    return false
  if (imgTop.value < (rows.value - 1) * w.value) {
    imgTop.value += w.value
    mask.style.transform = `translate(${maskX}px, ${maskY += w.value}px)`
  }
  current = down
  return true
}

let stepClear = 1

export function initMask() {
  applyMaskSizing()
  maskX = 0
  maskY = 0
  stepClear = 1
  const size = boardSizePx.value
  drawCircle(size + w.value / 2, size + w.value / 2, range.value)
  mask.style.position = 'absolute'
  mask.style.left = `-${size}px`
  mask.style.top = `-${size}px`
  mask.style.zIndex = '10'
  mask.style.transform = ''

  return mask
}

export function updateMask() {
  stepClear = 1
  applyMaskSizing()
  const size = boardSizePx.value
  drawCircle(size + w.value / 2, size + w.value / 2, range.value)
  mask.style.position = 'absolute'
  mask.style.left = `-${size}px`
  mask.style.top = `-${size}px`
  mask.style.zIndex = '10'
  mask.style.transform = `translate(${maskX}px, ${maskY}px)`
}

function clearArc(x: number, y: number, radius: number) {
  const calWidth = radius - stepClear
  const calHeight = Math.sqrt(radius * radius - calWidth * calWidth)
  const posX = x - calWidth
  const posY = y - calHeight
  const widthX = 2 * calWidth
  const heightY = 2 * calHeight
  if (stepClear < radius) {
    maskCtx.clearRect(posX, posY, widthX, heightY)
    stepClear += 1
    clearArc(x, y, radius)
  }
}

function drawCircle(x: number, y: number, r: number) {
  const size = boardSizePx.value
  maskCtx.clearRect(0, 0, 2 * size, 2 * size)
  maskCtx.beginPath()
  maskCtx.fillStyle = '#000'
  maskCtx.fillRect(0, 0, 2 * size, 2 * size)

  // Create a gradient for the edge of the visibility circle
  const gradient = maskCtx.createRadialGradient(x, y, r * 0.85, x, y, r)
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)') // Fully transparent in the center
  gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.1)') // Start fading
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.95)') // Almost opaque at the edge

  // Clear the basic circle first
  clearArc(x, y, r)

  // Add the gradient overlay
  maskCtx.beginPath()
  maskCtx.arc(x, y, r, 0, Math.PI * 2)
  maskCtx.fillStyle = gradient
  maskCtx.fill()

  // Add a glowing edge effect
  maskCtx.beginPath()
  maskCtx.arc(x, y, r, 0, Math.PI * 2)
  maskCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)' // Brighter glow
  maskCtx.lineWidth = 2
  maskCtx.stroke()

  // Add a second, thinner glow line
  maskCtx.beginPath()
  maskCtx.arc(x, y, r * 0.95, 0, Math.PI * 2)
  maskCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  maskCtx.lineWidth = 1
  maskCtx.stroke()
}

export function getGold() {
  return randomGold().map((item) => {
    return {
      x: item.i * w.value,
      y: item.j * w.value,
      i: item.i,
      j: item.j,
      show: true,
      // Add animation properties for visual enhancement
      scale: 1,
      rotation: 0,
      glowIntensity: 0.5 + Math.random() * 0.5, // Random glow intensity
    }
  })
}

export function resizeBoard(nextBoardSizePx: number, opts?: { preserve?: boolean }) {
  const next = Math.max(240, Math.floor(nextBoardSizePx))
  const prev = boardSizePx.value
  if (Math.abs(next - prev) < 2)
    return

  const prevCols = cols.value
  const prevRows = rows.value
  const prevW = w.value
  const prevI = Math.max(0, Math.min(prevCols - 1, Math.round(imgLeft.value / (prevW || 1))))
  const prevJ = Math.max(0, Math.min(prevRows - 1, Math.round(imgTop.value / (prevW || 1))))

  boardSizePx.value = next
  applyCanvasSizing()

  const canPreserve = !!opts?.preserve
    && grid.length > 0
    && cols.value === prevCols
    && rows.value === prevRows

  if (!canPreserve) {
    // Resize changed logical grid; rebuild visuals (keep level n, timer start, etc.)
    const t = start.value
    const wasWin = win.value
    const wasExitUnlocked = exitUnlocked.value
    setup()
    initMask()
    start.value = t
    win.value = wasWin
    exitUnlocked.value = wasExitUnlocked
    return
  }

  // Preserve logical state: recompute all pixel-space positions.
  imgLeft.value = prevI * w.value
  imgTop.value = prevJ * w.value
  maskX = imgLeft.value
  maskY = imgTop.value
  current = grid[prevI + prevJ * prevCols] ?? grid[0]

  if (exit.value) {
    exit.value = {
      ...exit.value,
      x: exit.value.i * w.value,
      y: exit.value.j * w.value,
    }
  }

  goldArray.value = goldArray.value.map((g) => {
    const i = g.i ?? Math.round((g.x ?? 0) / (prevW || 1))
    const j = g.j ?? Math.round((g.y ?? 0) / (prevW || 1))
    return { ...g, i, j, x: i * w.value, y: j * w.value }
  })

  magnifying.value = magnifying.value.map((m) => {
    const i = m.i ?? Math.round((m.x ?? 0) / (prevW || 1))
    const j = m.j ?? Math.round((m.y ?? 0) / (prevW || 1))
    return { ...m, i, j, x: i * w.value, y: j * w.value }
  })

  gift.value = gift.value.map((g) => {
    const i = g.i ?? Math.round((g.x ?? 0) / (prevW || 1))
    const j = g.j ?? Math.round((g.y ?? 0) / (prevW || 1))
    return { ...g, i, j, x: i * w.value, y: j * w.value }
  })

  renderMaze()
  updateMask()
}

// 优化金币生成逻辑，确保每一关都有金币
function randomGold() {
  const reserved = new Set<string>()
  reserved.add('0-0')
  if (exit.value)
    reserved.add(`${exit.value.i}-${exit.value.j}`)

  const all = grid.map(cell => ({ i: cell.i, j: cell.j }))
  const available = all.filter(p => !reserved.has(`${p.i}-${p.j}`))

  const goldCount = Math.max(1, Math.min(n.value, available.length))
  const chosen: Array<{ i: number, j: number }> = []
  const chosenKey = new Set<string>()

  function tryAdd(i: number, j: number) {
    const key = `${i}-${j}`
    if (reserved.has(key) || chosenKey.has(key))
      return false
    if (i < 0 || j < 0 || i > cols.value - 1 || j > rows.value - 1)
      return false
    chosen.push({ i, j })
    chosenKey.add(key)
    return true
  }

  const iMid = Math.floor(cols.value / 2)
  const jMid = Math.floor(rows.value / 2)
  const preferred = [
    [iMid, jMid],
    [cols.value - 1, 0],
    [0, rows.value - 1],
    [cols.value - 1, rows.value - 1],
    [Math.floor(cols.value / 3), Math.floor(rows.value / 3)],
    [Math.floor(cols.value * 2 / 3), Math.floor(rows.value / 3)],
    [Math.floor(cols.value / 3), Math.floor(rows.value * 2 / 3)],
    [Math.floor(cols.value * 2 / 3), Math.floor(rows.value * 2 / 3)],
  ]

  for (const [i, j] of preferred) {
    if (chosen.length >= goldCount)
      break
    tryAdd(i, j)
  }

  while (chosen.length < goldCount) {
    const pos = available[Math.floor(Math.random() * available.length)]
    if (!pos)
      break
    tryAdd(pos.i, pos.j)
  }

  const goldResult = chosen

  // 创建一个共享的位置管理器，用于确保所有道具不重叠
  // 使用Map而不是Set，这样可以存储更多信息，包括位置和类型
  const usedPositionsMap = new Map()

  // 将所有金币位置加入位置管理器
  goldResult.forEach((pos) => {
    const key = `${pos.i}-${pos.j}`
    usedPositionsMap.set(key, 'gold')
  })
  if (exit.value)
    usedPositionsMap.set(`${exit.value.i}-${exit.value.j}`, 'exit')

  const itemPositionManager = {
    usedPositionsMap,
    addPosition(i: number, j: number, type: string) {
      const key = `${i}-${j}`
      if (this.usedPositionsMap.has(key)) {
        return false
      }
      this.usedPositionsMap.set(key, type)
      return true
    },
    hasPosition(i: number, j: number) {
      const key = `${i}-${j}`
      return this.usedPositionsMap.has(key)
    },
    getAllPositions() {
      return Array.from(this.usedPositionsMap.entries()).map(([key, type]) => ({ pos: key, type }))
    },
  }

  // 道具数量基于难度调整
  let magnifyingCount = 0
  let giftCount = 0

  if (n.value >= 8) {
    magnifyingCount = 3
    giftCount = 3
  }
  else if (n.value >= 5) {
    magnifyingCount = 2
    giftCount = 2
  }
  else if (n.value >= 3) {
    magnifyingCount = 1
    giftCount = 1
  }

  // 生成柴火和礼物，确保它们之间不会互相重叠，也不会与金币重叠
  generateItems(itemPositionManager, magnifyingCount, giftCount)

  return goldResult
}

// 新增：统一的道具生成函数，确保柴火和礼物不会互相重叠
function generateItems(positionManager: { usedPositionsMap: Map<string, string>, addPosition: Function, hasPosition: Function, getAllPositions: Function }, magnifyingCount: number, giftCount: number) {
  magnifying.value = []
  gift.value = []
  const randomImage: string[] = []

  // 1. 首先尝试生成柴火
  for (let i = 0; i < magnifyingCount; i++) {
    // 选择不与任何已有道具重叠的格子
    const possibleCells = grid.filter((cell) => {
      // 避免在起点放置
      if (cell.i === 0 && cell.j === 0)
        return false

      // 不与金币和其他道具重叠(严格检查)
      if (positionManager.hasPosition(cell.i, cell.j))
        return false

      // 检查是否与现有柴火保持一定距离
      if (magnifying.value.length > 0) {
        for (const mag of magnifying.value) {
          const dx = Math.abs(cell.i - mag.i)
          const dy = Math.abs(cell.j - mag.j)
          if (dx + dy < Math.max(3, Math.floor(rows.value / 6))) {
            return false
          }
        }
      }

      return true
    })

    if (possibleCells.length === 0)
      continue

    const index = Math.floor(Math.random() * possibleCells.length)
    const cell = possibleCells[index]

    if (cell) {
      // 使用新的位置管理器API，包含类型标记
      if (!positionManager.addPosition(cell.i, cell.j, 'wood')) {
        console.warn(`无法在位置 ${cell.i}-${cell.j} 添加柴火，该位置可能已被占用`)
        continue
      }

      magnifying.value.push({
        x: cell.i * w.value,
        y: cell.j * w.value,
        i: cell.i,
        j: cell.j,
        show: true,
      })
    }
  }

  // 2. 然后生成礼物
  for (let i = 0; i < giftCount; i++) {
    // 优先选择远离起点的格子，且不与已有任何道具重叠
    const possibleCells = grid.filter((cell) => {
      // 避免在起点放置
      if (cell.i === 0 && cell.j === 0)
        return false

      // 不与金币和其他道具重叠(严格检查)
      if (positionManager.hasPosition(cell.i, cell.j))
        return false

      // 计算与起点的距离（曼哈顿距离）
      const distanceFromStart = cell.i + cell.j
      const threshold = Math.floor((rows.value + cols.value) / (n.value <= 5 ? 8 : 6))

      // 检查与现有礼物保持一定距离
      if (gift.value.length > 0) {
        for (const g of gift.value) {
          const dx = Math.abs(cell.i - g.i)
          const dy = Math.abs(cell.j - g.j)
          if (dx + dy < Math.max(3, Math.floor(rows.value / 6))) {
            return false
          }
        }
      }

      return distanceFromStart >= threshold
    })

    if (possibleCells.length === 0) {
      // 如果找不到满足条件的位置，尝试放宽条件
      const alternativeCells = grid.filter(cell =>
        cell.i + cell.j > 0 // 不是起点
        && !positionManager.hasPosition(cell.i, cell.j), // 不与已有任何道具重叠
      )

      if (alternativeCells.length === 0)
        continue

      const index = Math.floor(Math.random() * alternativeCells.length)
      const cell = alternativeCells[index]

      if (cell) {
        // 使用新的位置管理器API，包含类型标记
        if (!positionManager.addPosition(cell.i, cell.j, 'gift')) {
          console.warn(`无法在位置 ${cell.i}-${cell.j} 添加礼物，该位置可能已被占用`)
          continue
        }

        const src = getRandomImage()
        gift.value.push({
          x: cell.i * w.value,
          y: cell.j * w.value,
          i: cell.i,
          j: cell.j,
          show: true,
          srcShow: false,
          src,
          url: getRandomGift(),
        })

        randomImage.push(src)
      }
    }
    else {
      const index = Math.floor(Math.random() * possibleCells.length)
      const cell = possibleCells[index]

      if (cell) {
        // 使用新的位置管理器API，包含类型标记
        if (!positionManager.addPosition(cell.i, cell.j, 'gift')) {
          console.warn(`无法在位置 ${cell.i}-${cell.j} 添加礼物，该位置可能已被占用`)
          continue
        }

        let src = getRandomImage()
        while (randomImage.includes(src) && randomImage.length < 19) {
          src = getRandomImage()
        }

        gift.value.push({
          x: cell.i * w.value,
          y: cell.j * w.value,
          i: cell.i,
          j: cell.j,
          show: true,
          srcShow: false,
          src,
          url: getRandomGift(),
        })

        randomImage.push(src)
      }
    }
  }

  // 预加载礼物图片
  gift.value.forEach((img) => {
    const image = document.createElement('img')
    image.src = img.src
  })
}

function getRandomImage() {
  return `/img/${Math.floor(Math.random() * 19) + 1}.jpg`
}

function getRandomGift() {
  return `/img/gift${Math.floor(Math.random() * 2) + 1}.svg`
}

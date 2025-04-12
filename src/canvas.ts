import { computed, ref } from 'vue'

export const n = ref(5)
export const hideMask = ref(false)
useStorage('FIND_GOLD_level', n)

const WIDTH = window.outerWidth > 600 ? 600 : (window.outerWidth - 70)
const HEIGHT = WIDTH
export const w = computed(() => {
  // 计算最佳单元格大小以填充画布
  const minSize = Math.floor(HEIGHT / (3 * n.value)) < 20 ? 20 : Math.floor(HEIGHT / (3 * n.value))
  // 调整单元格大小，确保能够均匀分布（避免边缘黑边）
  return Math.floor(WIDTH / Math.floor(WIDTH / minSize))
})
const grid: any[] = []
const canvas: HTMLCanvasElement = document.createElement('canvas')
canvas.setAttribute('style', 'margin: 0 auto;')
const ctx: CanvasRenderingContext2D = canvas.getContext('2d')!
canvas.width = WIDTH
canvas.height = HEIGHT
let current: Cell
// 通过计算得出能够整除画布宽度的列数
const cols = computed(() => Math.floor(WIDTH / w.value))
// 通过计算得出能够整除画布高度的行数
const rows = computed(() => Math.floor(HEIGHT / w.value))
export const imgLeft = ref(0)
export const imgTop = ref(0)

// mask
export const mask: HTMLCanvasElement = document.createElement('canvas')
const maskCtx = mask.getContext('2d')!
let maskX = 0
let maskY = 0

// golds
export const golds: any[] = []
export const goldArray = ref<any[]>([])
export const start = ref()
export const win = ref(false)
export const rangeScope = ref(1)
const range = computed(() => rangeScope.value * (n.value > 5 ? w.value : w.value * 5 / n.value))

export const magnifying = ref<any[]>([])

export const gift = ref<any[]>([])
const color = ref()

// 优化后的setup函数，增加难度调整
export function setup() {
  color.value = `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.9)`

  // 基于关卡动态调整视野范围
  rangeScope.value = Math.max(0.6, 1.2 - (n.value * 0.04)) // 随着关卡增加，初始视野会逐渐减小

  ctx.clearRect(0, 0, WIDTH, HEIGHT)
  imgLeft.value = 0
  imgTop.value = 0
  win.value = false
  grid.length = 0
  golds.length = 0
  ctx.clearRect(0, 0, WIDTH, HEIGHT)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // 动态调整迷宫大小，随关卡增加
  for (let i = 0; i < cols.value; i++) {
    for (let j = 0; j < rows.value; j++) {
      const cell = new Cell(j, i)
      grid.push(cell)
    }
  }

  // 填充底色，确保不留黑边
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  current = grid[0]
  draw()
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
    const wallThickness = Math.max(2, Math.min(5, w.value / 5)) // Wall thickness is proportional but capped

    // Draw the cell background
    ctx.fillStyle = 'black'
    ctx.fillRect(x, y, w.value, w.value)

    // Draw walls as solid blocks instead of lines
    ctx.fillStyle = color.value

    // Top wall
    if (this.walls[0])
      ctx.fillRect(x, y, w.value, wallThickness)

    // Bottom wall
    if (this.walls[1])
      ctx.fillRect(x, y + w.value - wallThickness, w.value, wallThickness)

    // Left wall
    if (this.walls[2])
      ctx.fillRect(x, y, wallThickness, w.value)

    // Right wall
    if (this.walls[3])
      ctx.fillRect(x + w.value - wallThickness, y, wallThickness, w.value)
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

function canDerive(cur: Cell, target: Cell, map = new Set()) {
  const stacks: Cell[] = []
  const queue = [cur]
  while (queue.length) {
    const current: Cell = queue.shift()!
    if (map.has(current))
      continue
    map.add(current)
    current.status = true
    if (current.i === target.i && current.j === target.j)
      return true

    const next = current.checkEveryNeighbors()
    if (next) {
      stacks.push(current)
      queue.push(next)
    }
    else {
      const pre = stacks.pop()
      if (pre) {
        map.delete(pre)
        queue.push(pre)
      }
    }
  }
  const result = grid.filter(item => item.status).sort((a, b) => b.j - a.j)
  const item = result[0]
  const down = grid[item.index(item.i, item.j + 1)]
  if (down) {
    removeWalls(item, down)
    canDerive(down, target)
  }
  return false
}

// 新的迷宫生成算法，确保有且只有一条通向终点的路径
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

  // 确保从起点到终点有路径
  const start = grid[0]
  const end = grid[grid.length - 1]
  validatePath(start, end)
}

// 验证并确保路径从起点到终点
function validatePath(start: Cell, end: Cell) {
  // 重置状态标志，用于路径验证
  grid.forEach(cell => cell.status = false)

  // 检查是否存在路径
  const pathExists = findPath(start, end)

  if (!pathExists) {
    // 如果不存在路径，创建一条直接路径
    const path = createDirectPath(start, end)
    if (path) {
      for (let i = 0; i < path.length - 1; i++) {
        removeWalls(path[i], path[i + 1])
      }
    }
  }
}

// 寻找从起点到终点的路径
function findPath(start: Cell, end: Cell) {
  const queue = [start]
  const visited = new Set()
  const parent = new Map()

  while (queue.length > 0) {
    const current = queue.shift()

    if (current === end) {
      // 找到路径，标记路径状态
      const path = []
      let temp = current
      while (temp) {
        path.unshift(temp)
        temp = parent.get(temp)
      }

      // 标记路径上的单元格
      path.forEach(cell => cell.status = true)
      return true
    }

    if (visited.has(current))
      continue
    visited.add(current)

    // 检查四个方向
    const i = current.i
    const j = current.j
    const neighbors = []

    // 上
    if (!current.walls[0]) {
      const top = grid[current.index(i, j - 1)]
      if (top && !visited.has(top)) {
        neighbors.push(top)
      }
    }

    // 下
    if (!current.walls[1]) {
      const bottom = grid[current.index(i, j + 1)]
      if (bottom && !visited.has(bottom)) {
        neighbors.push(bottom)
      }
    }

    // 左
    if (!current.walls[2]) {
      const left = grid[current.index(i - 1, j)]
      if (left && !visited.has(left)) {
        neighbors.push(left)
      }
    }

    // 右
    if (!current.walls[3]) {
      const right = grid[current.index(i + 1, j)]
      if (right && !visited.has(right)) {
        neighbors.push(right)
      }
    }

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        queue.push(neighbor)
        parent.set(neighbor, current)
      }
    }
  }

  return false
}

// 创建一条直接路径从起点到终点
function createDirectPath(start: Cell, end: Cell) {
  const path = []
  let current = start
  path.push(current)

  // 基于坐标差决定移动方向的优先级
  const dx = end.i - start.i
  const dy = end.j - start.j

  while (current !== end) {
    let next = null

    // 优先水平移动
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        // 向右移动
        next = grid[current.index(current.i + 1, current.j)]
        if (next) {
          current.walls[3] = false
          next.walls[2] = false
        }
      }
      else if (dx < 0) {
        // 向左移动
        next = grid[current.index(current.i - 1, current.j)]
        if (next) {
          current.walls[2] = false
          next.walls[3] = false
        }
      }

      if (!next) {
        // 如果不能水平移动，尝试垂直移动
        if (dy > 0) {
          // 向下移动
          next = grid[current.index(current.i, current.j + 1)]
          if (next) {
            current.walls[1] = false
            next.walls[0] = false
          }
        }
        else {
          // 向上移动
          next = grid[current.index(current.i, current.j - 1)]
          if (next) {
            current.walls[0] = false
            next.walls[1] = false
          }
        }
      }
    }
    // 优先垂直移动
    else {
      if (dy > 0) {
        // 向下移动
        next = grid[current.index(current.i, current.j + 1)]
        if (next) {
          current.walls[1] = false
          next.walls[0] = false
        }
      }
      else if (dy < 0) {
        // 向上移动
        next = grid[current.index(current.i, current.j - 1)]
        if (next) {
          current.walls[0] = false
          next.walls[1] = false
        }
      }

      if (!next) {
        // 如果不能垂直移动，尝试水平移动
        if (dx > 0) {
          // 向右移动
          next = grid[current.index(current.i + 1, current.j)]
          if (next) {
            current.walls[3] = false
            next.walls[2] = false
          }
        }
        else {
          // 向左移动
          next = grid[current.index(current.i - 1, current.j)]
          if (next) {
            current.walls[2] = false
            next.walls[3] = false
          }
        }
      }
    }

    if (!next) {
      // 如果无法移动，退出循环
      break
    }

    current = next
    path.push(current)
  }

  return path
}

// 替换原有的draw函数
function draw() {
  generatePerfectMaze()

  // 绘制迷宫
  for (let i = 0; i < grid.length; i++) {
    grid[i].show()
  }

  // 设置起点和终点
  current = grid[0]
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
  if (imgLeft.value < (rows.value - 1) * w.value) {
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
  if (imgTop.value < (cols.value - 1) * w.value) {
    imgTop.value += w.value
    mask.style.transform = `translate(${maskX}px, ${maskY += w.value}px)`
  }
  current = down
  return true
}

let stepClear = 1

export function initMask() {
  maskX = 0
  maskY = 0
  stepClear = 1
  mask.width = 2 * WIDTH
  mask.height = 2 * WIDTH
  drawCircle(WIDTH + w.value / 2, WIDTH + w.value / 2, range.value)
  mask.setAttribute('style', `position:absolute;left:-${WIDTH}px;top:-${WIDTH}px;z-index:10`)

  return mask
}

export function updateMask() {
  stepClear = 1
  drawCircle(WIDTH + w.value / 2, WIDTH + w.value / 2, range.value)
  mask.setAttribute('style', `position:absolute;left:-${WIDTH}px;top:-${WIDTH}px;z-index:10;transform:translate(${maskX}px, ${maskY}px`)
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
  maskCtx.clearRect(0, 0, 2 * WIDTH, 2 * WIDTH)
  maskCtx.beginPath()
  maskCtx.fillStyle = '#000'
  maskCtx.fillRect(0, 0, 2 * WIDTH, 2 * WIDTH)

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

// 优化金币生成逻辑，确保每一关都有金币
function randomGold() {
  const left: Cell = grid[grid.length - rows.value]
  const right: Cell = grid[rows.value - 1]

  // 创建默认的固定位置金币（无论任何关卡级别）
  const defaultGoldPositions = [
    { i: Math.floor(rows.value / 3), j: Math.floor(cols.value / 3) },
    { i: Math.floor(rows.value * 2 / 3), j: Math.floor(cols.value / 3) },
    { i: Math.floor(rows.value / 3), j: Math.floor(cols.value * 2 / 3) },
    { i: Math.floor(rows.value * 2 / 3), j: Math.floor(cols.value * 2 / 3) },
    { i: Math.floor(rows.value / 2), j: Math.floor(cols.value / 2) },
  ]

  // 金币结果数组
  let goldResult: any[] = []
  // 所有道具结果数组（包括金币、柴火和礼物）
  let allItemsResult: any[] = []

  // 根据关卡级别进行不同处理
  if (n.value <= 3) {
    // 低级别：使用默认金币位置
    goldResult = defaultGoldPositions.slice(0, n.value)
  }
  else if (n.value < 8) {
    // 中级别：使用通用金币位置加上一些特殊位置
    goldResult = [grid[grid.length - 1], left, right].map(cell => ({ i: cell.i, j: cell.j }))

    // 从默认位置中获取额外金币
    const additionalCount = n.value - 3
    for (let i = 0; i < additionalCount && i < defaultGoldPositions.length; i++) {
      goldResult.push(defaultGoldPositions[i])
    }
  }
  else {
    // 高级别：使用随机位置
    const goldPositions: any[] = []
    const goldCount = n.value

    // 先尝试使用golds数组
    if (golds.length >= goldCount) {
      for (let i = 0; i < goldCount; i++) {
        const index = Math.floor(Math.random() * golds.length)
        const gold = golds[index]
        if (gold && !goldPositions.some(p => p.i === gold.i && p.j === gold.j)) {
          goldPositions.push({ i: gold.i, j: gold.j })
        }
        else {
          i--
        }
      }
    }
    else {
      // 如果golds数组不够，使用随机位置
      for (let i = 0; i < goldCount; i++) {
        const position = {
          i: Math.floor(Math.random() * rows.value),
          j: Math.floor(Math.random() * cols.value),
        }

        // 避免和已有位置重复
        if (!goldPositions.some(p => p.i === position.i && p.j === position.j)) {
          goldPositions.push(position)
        }
        else {
          i--
        }
      }
    }

    goldResult = goldPositions
  }

  // 记录所有金币位置，用于调试
  console.log('金币位置:', goldResult.map(pos => `${pos.i}-${pos.j}`).join(', '))

  // 创建一个共享的位置管理器，用于确保所有道具不重叠
  // 使用Map而不是Set，这样可以存储更多信息，包括位置和类型
  const usedPositionsMap = new Map()

  // 将所有金币位置加入位置管理器
  goldResult.forEach((pos) => {
    const key = `${pos.i}-${pos.j}`
    usedPositionsMap.set(key, 'gold')
  })

  const itemPositionManager = {
    usedPositionsMap,
    addPosition(i: number, j: number, type: string) {
      const key = `${i}-${j}`
      if (this.usedPositionsMap.has(key)) {
        console.warn(`尝试将${type}添加到已有${this.usedPositionsMap.get(key)}的位置: ${key}`)
        return false
      }
      this.usedPositionsMap.set(key, type)
      return true
    },
    hasPosition(i: number, j: number) {
      const key = `${i}-${j}`
      const exists = this.usedPositionsMap.has(key)
      if (exists) {
        const type = this.usedPositionsMap.get(key)
        if (type === 'gold') {
          console.warn(`位置 ${key} 已被金币占用`)
        }
        else {
          console.warn(`位置 ${key} 已被 ${type} 占用`)
        }
      }
      return exists
    },
    getAllPositions() {
      return Array.from(this.usedPositionsMap.entries()).map(([key, type]) => ({ pos: key, type }))
    },
  }

  // 全量复制金币位置到所有道具结果数组
  allItemsResult = JSON.parse(JSON.stringify(goldResult))

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

  // 调试：打印所有位置信息
  console.log('所有道具位置:', itemPositionManager.getAllPositions())

  return allItemsResult
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

  console.log('柴火数量:', magnifying.value.length)
  console.log('礼物数量:', gift.value.length)
}

function getRandomImage() {
  return `/img/${Math.floor(Math.random() * 19) + 1}.jpg`
}

function getRandomGift() {
  return `/img/gift${Math.floor(Math.random() * 2) + 1}.svg`
}

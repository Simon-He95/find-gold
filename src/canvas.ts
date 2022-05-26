const WIDTH = window.outerWidth
const HEIGHT = WIDTH
export const w = HEIGHT / 10
const grid: any[] = []
const canvas: HTMLCanvasElement = document.createElement('canvas')
const ctx: CanvasRenderingContext2D = canvas.getContext('2d')!
canvas.width = WIDTH
canvas.height = HEIGHT
let current: Cell
const cols = Math.floor(WIDTH / w)
const rows = Math.floor(HEIGHT / w)
export const imgLeft = ref(0)
export const imgTop = ref(0)

// mask
export const mask: HTMLCanvasElement = document.createElement("canvas");
const maskCtx = mask.getContext("2d")!;
let maskX = 0
let maskY = 0
const range = w * 2

// golds
export const n = ref(5)
export const golds: any[] = []

export function setup() {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  return update()
}

export function update() {
  grid.length = 0
  maskX = 0
  maskY = 0
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const cell = new Cell(j, i)
      grid.push(cell)
    }
  }

  current = grid[0]

  draw()
  return canvas
}

class Cell {
  i: number
  j: number
  walls: boolean[] = [true, true, true, false]
  visited: boolean = false
  constructor(i: number, j: number) {
    this.i = i
    this.j = j
  }
  show() {
    const x = this.i * w
    const y = this.j * w
    if (this.walls[0])
      this.line(x, y, x + w, y);
    if (this.walls[1])
      this.line(x, y + w, x + w, y + w);
    if (this.walls[2])
      this.line(x, y, x, y + w);
    if (this.walls[3])
      this.line(x + w, y, x + w, y + w);
  }
  line(x: number, y: number, x2: number, y2: number) {
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#fff'
    ctx.stroke()
  }
  index(i: number, j: number) {
    if (i < 0 || j < 0 || i > cols - 1 || j > rows - 1) return -1
    return i + j * cols
  }
  checkNeighbors() {
    const neighbors = []
    const top = grid[this.index(this.i, this.j - 1)]
    const bottom = grid[this.index(this.i, this.j + 1)]
    const left = grid[this.index(this.i - 1, this.j)]
    const right = grid[this.index(this.i + 1, this.j)]

    if (top && !top.visited) {
      neighbors.push(top)
    }
    if (bottom && !bottom.visited) {
      neighbors.push(bottom)
    }
    if (left && !left.visited) {
      neighbors.push(left)
    }
    if (right && !right.visited) {
      neighbors.push(right)
    }
    if (neighbors.length) {
      const neighbor = neighbors[Math.floor(Math.random() * neighbors.length)]
      return neighbor
    } else {
      return undefined
    }

  }
}

function draw() {
  const end = grid[grid.length - 1]
  // 开辟一条终点的路
  const center = grid[rows * cols / 2 - Math.floor(rows / 2) - 1]
  findFar(grid[0], end)
  for (let i = 0; i < grid.length; i++) {
    if ((i & 1) === 1) {
      findFar(grid[i], center)
    }
  }

  for (let i = 0; i < grid.length; i++) {
    if (i > 0)
      grid[i].visited = false
    grid[i].show()
  }
}

function removeWalls(a: Cell, b: Cell) {
  let x = a.i - b.i
  let y = a.j - b.j
  if (x === 1) {
    a.walls[2] = false
    b.walls[3] = false
  } else if (x === -1) {
    a.walls[3] = false
    b.walls[2] = false
  } else if (y === 1) {
    a.walls[0] = false
    b.walls[1] = false
  } else if (y === -1) {
    a.walls[1] = false
    b.walls[0] = false
  }
}

function findFar(start: Cell, target: Cell, map = new Set) {
  const queue: any[] = [start]
  const stacks = []
  while (queue.length) {
    const current = queue.shift()
    if (map.has(current)) {
      continue
    }
    if (current.i === target.i && current.j === target.j) {
      stacks.push(current)
      continue
    }
    map.add(current)
    current.visited = true
    const next = current.checkNeighbors()
    if (next) {
      removeWalls(current, next)
      stacks.push(current)
      queue.push(next)
    } else {
      if (target === grid[grid.length - 1] && current.i > rows / 2 || current.j > cols / 2) {
        golds.push(current)
      }
      const pre = stacks.pop()
      if (pre) {
        map.delete(pre)
        queue.push(pre)
      }
    }
  }
  stacks.length && stacks.reduce((pre, cur) => {
    if (pre && cur)
      removeWalls(pre, cur)
    return cur
  })
}


export function rightMove() {
  const right = grid[current.index(current.i + 1, current.j)]
  if (current.walls[3] || !right || right.walls[2])
    return false
  if (imgLeft.value < (rows - 1) * w) {
    imgLeft.value += w
    mask.style.transform = `translate(${maskX += w}px, ${maskY}px)`
  }
  current = right
  return true
}

export function leftMove() {
  const left = grid[current.index(current.i - 1, current.j)]
  if (current.walls[2] || !left || left.walls[3])
    return false
  if (imgLeft.value > 0) {
    imgLeft.value -= w
    mask.style.transform = `translate(${maskX -= w}px, ${maskY}px)`
  }
  current = left
  return true
}

export function topMove() {
  const top = grid[current.index(current.i, current.j - 1)]
  if (current.walls[0] || !top || top.walls[1])
    return false
  if (imgTop.value > 0) {
    imgTop.value -= w
    mask.style.transform = `translate(${maskX}px, ${maskY -= w}px)`
  }
  current = top
  return true
}

export function downMove() {
  const down = grid[current.index(current.i, current.j + 1)]
  if (current.walls[1] || !down || down.walls[0])
    return false
  if (imgTop.value < (cols - 1) * w) {
    imgTop.value += w
    mask.style.transform = `translate(${maskX}px, ${maskY += w}px)`
  }
  current = down
  return true
}

export function initMask() {
  mask.width = 3 * WIDTH;
  mask.height = 3 * WIDTH;
  drawCircle(WIDTH + w / 2, WIDTH + w / 2, range)
  mask.style = `position:absolute;left:-${WIDTH}px;top:-${WIDTH}px;z-index:10;`
  return mask

}

let stepClear = 1;

function clearArc(x: number, y: number, radius: number) {
  const calWidth = radius - stepClear;
  const calHeight = Math.sqrt(radius * radius - calWidth * calWidth);
  const posX = x - calWidth;
  const posY = y - calHeight;
  const widthX = 2 * calWidth;
  const heightY = 2 * calHeight;
  if (stepClear < radius) {
    maskCtx.clearRect(posX, posY, widthX, heightY);
    stepClear += 1;
    clearArc(x, y, radius);
  }
}

function drawCircle(x: number, y: number, r: number) {
  maskCtx.fillStyle = "#000";
  maskCtx.fillRect(0, 0, 3 * WIDTH, 3 * WIDTH);
  clearArc(x, y, r);
  maskCtx.lineWidth = 1
  maskCtx.strokeStyle = 'rgba(255,255,255,0.2)'
  maskCtx.arc(x, y, r, 0, Math.PI * 2);
  maskCtx.stroke()
}

export function getGold() {
  return randomGold().map((item) => {
    return {
      x: item.i * w,
      y: item.j * w,
      i: item.i, j: item.j,
      show: true
    };
  });
}
function randomGold() {
  const result: any[] = []
  if (golds.length < n.value) {
    return [
      { i: 5, j: 5 },
      { i: 5, j: 8 },
      { i: 8, j: 5 },
      { i: 8, j: 8 },
      { i: 7, j: 3 }
    ]
  }
  for (let i = 0; i < n.value; i++) {
    const index = Math.floor(Math.random() * golds.length - 1)
    const gold = golds[index]
    if (gold && !result.includes(gold))
      result.push(gold)
    else {
      i--
    }
  }
  return result
}





<script setup lang="ts">
import { useNow, useStorage } from '@vueuse/core'
import * as THREE from 'three'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  exitUnlocked,
  getMazeSnapshot,
  goldArray,
  n,
  setup,
  start,
  win,
} from '../canvas'
import { manhattanCellDistance, moveWithGridCollisions } from '../maze/collision'
import { computeGodOrthoFrustum } from '../maze/godview'
import { cellFromWorld, collectAtCell, collectedGold, shouldAdvanceLevel, shouldUnlockExit, stepCounter } from '../maze/step'

const props = defineProps({
  soundEnabled: {
    type: Boolean,
    default: true,
  },
})

const rootEl = ref<HTMLElement | null>(null)
const locked = ref(false)
const paused = ref(true)
const steps = ref(0)
const bumping = ref(false)

interface LevelRecord {
  time: number
  steps: number
}
const records = useStorage<Record<string, LevelRecord>>('FIND_GOLD_records', {})

const now = useNow()
const countDown = computed(() => Math.round((+now.value - start.value) / 1000))
const remainingGold = computed(() => goldArray.value.filter(g => g.show).length)
const totalGold = computed(() => goldArray.value.length)
const collectedGoldCount = computed(() => collectedGold(goldArray.value as any))

const showWin = ref(false)
const winText = ref('')

const godView = useStorage<boolean>('FIND_GOLD_god_view', false)
const godZoom = useStorage<number>('FIND_GOLD_god_zoom', 1)

const cellSize = 1
const wallThickness = 0.1
const wallHeight = 1.25

const cfg = {
  cellSize,
  radius: 0.18,
  height: 1.6,
  epsilon: 0.001,
}

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let baseFog: THREE.FogExp2 | null = null
let camera: THREE.Camera | null = null
let fpsCamera: THREE.PerspectiveCamera | null = null
let godCamera: THREE.OrthographicCamera | null = null
let raf = 0
let clock: THREE.Clock | null = null
let resizeObserver: ResizeObserver | null = null

let mazeGroup: THREE.Group | null = null

let exitMesh: THREE.Mesh | null = null
let exitMarkerMesh: THREE.Mesh | null = null
let goldMeshes: THREE.Mesh[] = []
let playerMarkerMesh: THREE.Mesh | null = null

let flashlight: THREE.SpotLight | null = null
let flashlightTarget: THREE.Object3D | null = null
let baseAmbient: THREE.AmbientLight | null = null

interface MaterialTextureSet {
  map: THREE.Texture
  normalMap: THREE.DataTexture
  roughnessMap: THREE.DataTexture
}

let wallTextures: MaterialTextureSet | null = null
let floorTextures: MaterialTextureSet | null = null

const keys = new Set<string>()
let yaw = 0
let pitch = 0
let yawTarget = 0
let pitchTarget = 0

const player = reactive({ x: 0.5, y: 0.55, z: 0.5 })
let lastCell = { i: 0, j: 0 }
let stepSoundCooldown = 0

const audioWalk = document.createElement('audio')
audioWalk.src = '/bgm/walk.mp3'
const audioGold = document.createElement('audio')
audioGold.src = '/bgm/gold.mp3'
const audioWin = document.createElement('audio')
audioWin.src = '/bgm/win.mp3'

watch(() => props.soundEnabled, (v) => {
  audioWalk.muted = !v
  audioGold.muted = !v
  audioWin.muted = !v
}, { immediate: true })

function isInputLocked() {
  return showWin.value
}

function resetInput() {
  keys.clear()
}

function bump() {
  if (bumping.value)
    return
  bumping.value = true
  try {
    navigator.vibrate?.(20)
  }
  catch {}
  setTimeout(() => {
    bumping.value = false
  }, 140)
}

function makeRng(seed: number) {
  let s = (seed >>> 0) || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

function heightToNormalMap(
  height: Float32Array,
  width: number,
  heightPx: number,
  strength: number,
) {
  const data = new Uint8Array(width * heightPx * 3)
  const idx = (x: number, y: number) => x + y * width

  for (let y = 0; y < heightPx; y++) {
    const y0 = Math.max(0, y - 1)
    const y1 = Math.min(heightPx - 1, y + 1)
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - 1)
      const x1 = Math.min(width - 1, x + 1)
      const hL = height[idx(x0, y)]
      const hR = height[idx(x1, y)]
      const hU = height[idx(x, y0)]
      const hD = height[idx(x, y1)]

      const dx = (hR - hL) * strength
      const dy = (hD - hU) * strength

      // normal = normalize([-dx, -dy, 1])
      let nx = -dx
      let ny = -dy
      let nz = 1
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
      nx /= len
      ny /= len
      nz /= len

      const o = (x + y * width) * 3
      data[o + 0] = Math.round((nx * 0.5 + 0.5) * 255)
      data[o + 1] = Math.round((ny * 0.5 + 0.5) * 255)
      data[o + 2] = Math.round((nz * 0.5 + 0.5) * 255)
    }
  }

  const tex = new THREE.DataTexture(data, width, heightPx, THREE.RGBFormat)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.needsUpdate = true
  tex.colorSpace = THREE.NoColorSpace
  return tex
}

function makeRoughnessMap(height: Float32Array, width: number, heightPx: number) {
  const data = new Uint8Array(width * heightPx)
  for (let i = 0; i < data.length; i++) {
    // invert a bit: recesses tend to be rougher
    const v = clamp01(0.35 + (1 - height[i]) * 0.55)
    data[i] = Math.round(v * 255)
  }
  const tex = new THREE.DataTexture(data, width, heightPx, THREE.RedFormat)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.needsUpdate = true
  tex.colorSpace = THREE.NoColorSpace
  return tex
}

function makeCanvasAlbedo(kind: 'wall' | 'floor', size = 512, seed = 1) {
  const rng = makeRng(seed)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  if (kind === 'wall') {
    // stone/brick-ish base
    ctx.fillStyle = '#E8E3DA'
    ctx.fillRect(0, 0, size, size)

    const brickH = Math.floor(size / 10)
    const brickW = Math.floor(size / 6)
    const mortar = Math.max(2, Math.floor(size / 128))

    for (let y = 0; y < size + brickH; y += brickH) {
      const offset = ((y / brickH) % 2) ? Math.floor(brickW * 0.5) : 0
      for (let x = -brickW; x < size + brickW; x += brickW) {
        const bx = x + offset
        const by = y
        const hue = 20 + rng() * 20
        const sat = 10 + rng() * 18
        const lit = 62 + rng() * 12
        ctx.fillStyle = `hsl(${hue} ${sat}% ${lit}%)`
        ctx.fillRect(bx + mortar, by + mortar, brickW - mortar * 2, brickH - mortar * 2)
      }
    }

    // grime / stains
    ctx.globalAlpha = 0.08
    for (let i = 0; i < 1200; i++) {
      const x = rng() * size
      const y = rng() * size
      const r = 2 + rng() * 10
      const g = Math.floor(12 + rng() * 20)
      ctx.fillStyle = `rgba(0,0,0,${g / 255})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // subtle vertical variation
    const grad = ctx.createLinearGradient(0, 0, 0, size)
    grad.addColorStop(0, 'rgba(255,255,255,0.10)')
    grad.addColorStop(1, 'rgba(0,0,0,0.14)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
  }
  else {
    // floor: concrete + speckles + faint tiles
    ctx.fillStyle = '#0B1220'
    ctx.fillRect(0, 0, size, size)

    const tile = Math.floor(size / 8)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    for (let y = 0; y <= size; y += tile) {
      ctx.beginPath()
      ctx.moveTo(0, y + 0.5)
      ctx.lineTo(size, y + 0.5)
      ctx.stroke()
    }
    for (let x = 0; x <= size; x += tile) {
      ctx.beginPath()
      ctx.moveTo(x + 0.5, 0)
      ctx.lineTo(x + 0.5, size)
      ctx.stroke()
    }

    ctx.globalAlpha = 0.35
    for (let i = 0; i < 4200; i++) {
      const x = rng() * size
      const y = rng() * size
      const r = rng() < 0.75 ? 0.6 : 1.6
      const c = 40 + rng() * 40
      ctx.fillStyle = `rgba(255,255,255,${c / 255})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    const grad = ctx.createRadialGradient(size * 0.5, size * 0.45, 0, size * 0.5, size * 0.45, size * 0.75)
    grad.addColorStop(0, 'rgba(255,255,255,0.06)')
    grad.addColorStop(1, 'rgba(0,0,0,0.22)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = renderer?.capabilities.getMaxAnisotropy?.() ?? 1
  tex.needsUpdate = true
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeHeightField(kind: 'wall' | 'floor', size = 256, seed = 1) {
  const rng = makeRng(seed)
  const h = new Float32Array(size * size)

  if (kind === 'wall') {
    const brickH = Math.floor(size / 10)
    const brickW = Math.floor(size / 6)
    const mortar = Math.max(1, Math.floor(size / 128))
    for (let y = 0; y < size; y++) {
      const row = Math.floor(y / brickH)
      const offset = (row % 2) ? Math.floor(brickW * 0.5) : 0
      for (let x = 0; x < size; x++) {
        const lx = (x + offset) % brickW
        const ly = y % brickH
        const isMortar = lx < mortar || ly < mortar || lx > brickW - mortar || ly > brickH - mortar
        const base = isMortar ? 0.15 : 0.6
        const noise = (rng() - 0.5) * (isMortar ? 0.08 : 0.18)
        h[x + y * size] = clamp01(base + noise)
      }
    }
  }
  else {
    const tile = Math.floor(size / 8)
    const grout = Math.max(1, Math.floor(size / 180))
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const isGrout = (x % tile) < grout || (y % tile) < grout
        const base = isGrout ? 0.28 : 0.52
        const noise = (rng() - 0.5) * 0.18
        h[x + y * size] = clamp01(base + noise)
      }
    }
  }

  return h
}

function ensureMaterialTextures() {
  if (wallTextures && floorTextures)
    return

  const seedBase = (n.value * 9973) ^ 0xA2C2
  const wallHeightField = makeHeightField('wall', 256, seedBase + 1)
  const floorHeightField = makeHeightField('floor', 256, seedBase + 2)

  wallTextures = {
    map: makeCanvasAlbedo('wall', 512, seedBase + 10),
    normalMap: heightToNormalMap(wallHeightField, 256, 256, 3.2),
    roughnessMap: makeRoughnessMap(wallHeightField, 256, 256),
  }

  floorTextures = {
    map: makeCanvasAlbedo('floor', 512, seedBase + 20),
    normalMap: heightToNormalMap(floorHeightField, 256, 256, 4.0),
    roughnessMap: makeRoughnessMap(floorHeightField, 256, 256),
  }

  const maxAniso = renderer?.capabilities.getMaxAnisotropy?.() ?? 1
  for (const t of [wallTextures.map, floorTextures.map]) {
    t.anisotropy = maxAniso
  }
}

function requestLock() {
  if (!rootEl.value)
    return
  if (godView.value)
    return
  rootEl.value.requestPointerLock?.()
}

function onPointerLockChange() {
  if (godView.value) {
    locked.value = false
    paused.value = false
    return
  }
  const el = document.pointerLockElement
  locked.value = !!el
  paused.value = !locked.value
  if (!locked.value)
    resetInput()
}

function onKeyDown(e: KeyboardEvent) {
  if (isInputLocked())
    return

  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyM', 'ShiftLeft', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault()

  if (e.code === 'KeyM') {
    godView.value = !godView.value
    return
  }

  keys.add(e.code)
  if (e.code === 'KeyQ')
    yawTarget = (Math.round(yawTarget / (Math.PI / 2)) * (Math.PI / 2)) + Math.PI / 2
  if (e.code === 'KeyE')
    yawTarget = (Math.round(yawTarget / (Math.PI / 2)) * (Math.PI / 2)) - Math.PI / 2
  if (e.code === 'Escape')
    document.exitPointerLock?.()
}

function onKeyUp(e: KeyboardEvent) {
  keys.delete(e.code)
}

function onMouseMove(e: MouseEvent) {
  if (!locked.value)
    return
  if (isInputLocked())
    return
  const sensitivity = 0.0022
  yawTarget -= e.movementX * sensitivity
  pitchTarget -= e.movementY * sensitivity
  const limit = Math.PI * 0.48
  pitchTarget = Math.max(-limit, Math.min(limit, pitchTarget))
}

function setCameraPose() {
  if (godView.value) {
    if (!godCamera)
      return
    const snap = getMazeSnapshot()
    const centerX = snap.cols * 0.5
    const centerZ = snap.rows * 0.5
    const height = Math.max(snap.cols, snap.rows) * 1.35 + wallHeight * 2
    godCamera.position.set(centerX, height, centerZ)
    godCamera.up.set(0, 0, -1)
    godCamera.lookAt(new THREE.Vector3(centerX, 0, centerZ))
    godCamera.updateMatrixWorld()
    return
  }

  if (!fpsCamera)
    return
  yaw += (yawTarget - yaw) * 0.18
  pitch += (pitchTarget - pitch) * 0.18
  fpsCamera.rotation.set(pitch, yaw, 0, 'YXZ')
  fpsCamera.position.set(player.x, player.y, player.z)
  if (flashlight) {
    flashlight.position.copy(fpsCamera.position)
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(fpsCamera.rotation)
    if (flashlightTarget) {
      flashlightTarget.position.set(player.x + dir.x, player.y + dir.y, player.z + dir.z)
      flashlightTarget.updateMatrixWorld()
    }
  }
}

function currentCell() {
  const snap = getMazeSnapshot()
  return cellFromWorld(player.x, player.z, cellSize, snap.cols, snap.rows)
}

function collectIfNeeded() {
  const cell = currentCell()
  const stepped = stepCounter(steps.value, lastCell, cell)
  steps.value = stepped.steps
  lastCell = stepped.lastCell

  const before = remainingGold.value
  const { gold, collected } = collectAtCell(goldArray.value, cell)
  if (collected) {
    tryPlay(audioGold)
    goldArray.value = gold as any
  }
  if (before !== remainingGold.value) {
    syncGoldMeshes()
  }

  if (!exitUnlocked.value && shouldUnlockExit(goldArray.value as any)) {
    exitUnlocked.value = true
    syncExitMaterial()
  }

  const snap = getMazeSnapshot()
  if (shouldAdvanceLevel(goldArray.value as any, exitUnlocked.value, cell, snap.exit))
    advanceLevel()
}

function tryPlay(audio: HTMLAudioElement) {
  if (!props.soundEnabled)
    return
  audio.currentTime = 0
  audio.play().catch(() => {})
}

function advanceLevel() {
  if (win.value)
    return
  win.value = true
  resetInput()

  const finishedLevel = n.value
  const key = String(finishedLevel)
  const current = { time: countDown.value, steps: steps.value }
  const prev = records.value[key]
  if (!prev || current.time < prev.time || (current.time === prev.time && current.steps < prev.steps))
    records.value[key] = current

  tryPlay(audioWin)
  const best = records.value[key]
  const bestLine = best ? `\n最佳: ${best.time}秒 / ${best.steps}步` : ''
  winText.value = `恭喜通关第${finishedLevel}关!\n用时: ${countDown.value}秒\n步数: ${steps.value}${bestLine}\n即将进入第${finishedLevel + 1}关...`
  showWin.value = true

  setTimeout(() => {
    showWin.value = false
    n.value++
    steps.value = 0
    setup()
    start3DLevel()
    win.value = false
  }, 1800)
}

function syncGoldMeshes() {
  if (!scene)
    return
  const snap = getMazeSnapshot()
  for (let idx = 0; idx < goldMeshes.length; idx++) {
    const mesh = goldMeshes[idx]
    const g = snap.gold[idx]
    if (!mesh || !g)
      continue
    mesh.visible = g.show
  }
}

function syncExitMaterial() {
  if (!exitMesh)
    return
  const mat = exitMesh.material as THREE.MeshStandardMaterial
  if (exitUnlocked.value) {
    mat.color.setHex(0x22C55E)
    mat.emissive.setHex(0x0B4D24)
    mat.emissiveIntensity = 1.2
    mat.opacity = 1
    mat.transparent = false
  }
  else {
    mat.color.setHex(0x64748B)
    mat.emissive.setHex(0x000000)
    mat.emissiveIntensity = 0
    mat.opacity = 0.7
    mat.transparent = true
  }
  mat.needsUpdate = true

  if (exitMarkerMesh) {
    const markerMat = exitMarkerMesh.material as THREE.MeshStandardMaterial
    if (exitUnlocked.value) {
      markerMat.color.setHex(0x22C55E)
      markerMat.emissive.setHex(0x14532D)
      markerMat.emissiveIntensity = 1.6
      markerMat.opacity = 0.92
      markerMat.transparent = true
    }
    else {
      markerMat.color.setHex(0x64748B)
      markerMat.emissive.setHex(0x000000)
      markerMat.emissiveIntensity = 0
      markerMat.opacity = 0.45
      markerMat.transparent = true
    }
    markerMat.needsUpdate = true
  }
}

function start3DLevel() {
  const snap = getMazeSnapshot()
  player.x = 0.5
  player.z = 0.5
  player.y = 0.55
  lastCell = { i: 0, j: 0 }
  yaw = 0
  pitch = 0
  yawTarget = 0
  pitchTarget = 0

  if (!scene || !mazeGroup)
    return

  // rebuild maze objects (per-level)
  for (const child of [...mazeGroup.children]) {
    mazeGroup.remove(child)
    disposeObject(child)
  }
  goldMeshes = []
  exitMesh = null
  exitMarkerMesh = null
  playerMarkerMesh = null

  ensureMaterialTextures()

  // floor
  const floorGeo = new THREE.PlaneGeometry(snap.cols * cellSize, snap.rows * cellSize, 1, 1)
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,
    roughness: 0.92,
    metalness: 0,
    map: floorTextures?.map ?? null,
    normalMap: floorTextures?.normalMap ?? null,
    roughnessMap: floorTextures?.roughnessMap ?? null,
  })
  if (floorMat.map) {
    floorMat.map.repeat.set(Math.max(1, snap.cols / 2.2), Math.max(1, snap.rows / 2.2))
    floorMat.map.needsUpdate = true
  }
  if (floorMat.normalMap) {
    floorMat.normalMap.repeat.copy(floorMat.map?.repeat ?? new THREE.Vector2(1, 1))
    floorMat.normalScale = new THREE.Vector2(0.55, 0.55)
  }
  if (floorMat.roughnessMap)
    floorMat.roughnessMap.repeat.copy(floorMat.map?.repeat ?? new THREE.Vector2(1, 1))
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(snap.cols * cellSize / 2, 0, snap.rows * cellSize / 2)
  floor.receiveShadow = true
  mazeGroup.add(floor)

  const grid = new THREE.GridHelper(Math.max(snap.cols, snap.rows) * cellSize, Math.max(snap.cols, snap.rows), 0x334155, 0x111827)
  grid.position.set(snap.cols * cellSize / 2, 0.001, snap.rows * cellSize / 2)
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
  for (const m of gridMaterials) {
    m.opacity = 0.25
    m.transparent = true
  }
  mazeGroup.add(grid)

  // walls
  const wallColor = new THREE.Color().setHSL(Math.random(), 0.16, 0.56)
  const wallMat = new THREE.MeshStandardMaterial({
    color: wallColor,
    roughness: 0.78,
    metalness: 0.02,
    emissive: new THREE.Color(0x000000),
    map: wallTextures?.map ?? null,
    normalMap: wallTextures?.normalMap ?? null,
    roughnessMap: wallTextures?.roughnessMap ?? null,
  })
  if (wallMat.map) {
    wallMat.map.repeat.set(1, Math.max(1, wallHeight * 0.9))
    wallMat.map.needsUpdate = true
  }
  if (wallMat.normalMap) {
    wallMat.normalMap.repeat.copy(wallMat.map?.repeat ?? new THREE.Vector2(1, 1))
    wallMat.normalScale = new THREE.Vector2(0.55, 0.55)
  }
  if (wallMat.roughnessMap)
    wallMat.roughnessMap.repeat.copy(wallMat.map?.repeat ?? new THREE.Vector2(1, 1))
  const wallEdgeMat = new THREE.LineBasicMaterial({ color: 0x111827, transparent: true, opacity: 0.35 })

  const hGeo = new THREE.BoxGeometry(cellSize, wallHeight, wallThickness)
  const vGeo = new THREE.BoxGeometry(wallThickness, wallHeight, cellSize)

  // count instances
  let hCount = 0
  let vCount = 0
  for (const c of snap.cells) {
    if (c.walls[0])
      hCount++
    if (c.walls[2])
      vCount++
    if (c.j === snap.rows - 1 && c.walls[1])
      hCount++
    if (c.i === snap.cols - 1 && c.walls[3])
      vCount++
  }

  const hMesh = new THREE.InstancedMesh(hGeo, wallMat, Math.max(1, hCount))
  const vMesh = new THREE.InstancedMesh(vGeo, wallMat, Math.max(1, vCount))
  hMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  vMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

  const tmp = new THREE.Object3D()
  let hi = 0
  let vi = 0
  for (const c of snap.cells) {
    const x0 = c.i * cellSize
    const z0 = c.j * cellSize
    const y0 = wallHeight / 2

    if (c.walls[0]) {
      tmp.position.set(x0 + cellSize / 2, y0, z0 + wallThickness / 2)
      tmp.rotation.set(0, 0, 0)
      tmp.updateMatrix()
      hMesh.setMatrixAt(hi++, tmp.matrix)
    }
    if (c.walls[2]) {
      tmp.position.set(x0 + wallThickness / 2, y0, z0 + cellSize / 2)
      tmp.rotation.set(0, 0, 0)
      tmp.updateMatrix()
      vMesh.setMatrixAt(vi++, tmp.matrix)
    }

    if (c.j === snap.rows - 1 && c.walls[1]) {
      tmp.position.set(x0 + cellSize / 2, y0, z0 + cellSize - wallThickness / 2)
      tmp.updateMatrix()
      hMesh.setMatrixAt(hi++, tmp.matrix)
    }
    if (c.i === snap.cols - 1 && c.walls[3]) {
      tmp.position.set(x0 + cellSize - wallThickness / 2, y0, z0 + cellSize / 2)
      tmp.updateMatrix()
      vMesh.setMatrixAt(vi++, tmp.matrix)
    }
  }

  hMesh.instanceMatrix.needsUpdate = true
  vMesh.instanceMatrix.needsUpdate = true
  mazeGroup.add(hMesh)
  mazeGroup.add(vMesh)

  // edges
  const addEdges = (mesh: THREE.InstancedMesh) => {
    const edges = new THREE.EdgesGeometry(mesh.geometry as THREE.BufferGeometry)
    const lines = new THREE.LineSegments(edges, wallEdgeMat)
    lines.matrixAutoUpdate = false
    mesh.add(lines)
  }
  addEdges(hMesh)
  addEdges(vMesh)

  // exit portal
  if (snap.exit) {
    const geo = new THREE.BoxGeometry(0.6, 1, 0.12)
    const mat = new THREE.MeshStandardMaterial({ color: 0x64748B, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.7 })
    const portal = new THREE.Mesh(geo, mat)
    portal.position.set(snap.exit.i * cellSize + 0.5, 0.5, snap.exit.j * cellSize + 0.5)
    mazeGroup.add(portal)
    exitMesh = portal

    const markerGeo = new THREE.CircleGeometry(0.36, 32)
    const markerMat = new THREE.MeshStandardMaterial({
      color: 0x64748B,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0,
      transparent: true,
      opacity: 0.45,
      roughness: 0.9,
      metalness: 0,
      depthWrite: false,
    })
    const marker = new THREE.Mesh(markerGeo, markerMat)
    marker.rotation.x = -Math.PI / 2
    marker.position.set(snap.exit.i * cellSize + 0.5, 0.012, snap.exit.j * cellSize + 0.5)
    marker.visible = godView.value
    mazeGroup.add(marker)
    exitMarkerMesh = marker
    syncExitMaterial()
  }

  // gold coins
  const coinGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.06, 18)
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xFBBF24, roughness: 0.25, metalness: 0.8, emissive: new THREE.Color(0x3D2A00), emissiveIntensity: 0.25 })
  for (const g of snap.gold) {
    const coin = new THREE.Mesh(coinGeo, coinMat)
    coin.position.set(g.i * cellSize + 0.5, godView.value ? 0.06 : 0.18, g.j * cellSize + 0.5)
    coin.rotation.x = godView.value ? 0 : Math.PI / 2
    coin.visible = g.show
    mazeGroup.add(coin)
    goldMeshes.push(coin)
  }

  // player marker (god view)
  const markerGeo = new THREE.SphereGeometry(0.12, 14, 10)
  const markerMat = new THREE.MeshStandardMaterial({
    color: 0x38BDF8,
    emissive: new THREE.Color(0x0EA5E9),
    emissiveIntensity: 0.45,
    roughness: 0.35,
    metalness: 0.05,
  })
  const marker = new THREE.Mesh(markerGeo, markerMat)
  marker.position.set(player.x, 0.16, player.z)
  marker.visible = godView.value
  mazeGroup.add(marker)
  playerMarkerMesh = marker

  // bounds hint (visual polish)
  const border = new THREE.Box3Helper(
    new THREE.Box3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(snap.cols * cellSize, wallHeight, snap.rows * cellSize),
    ),
    0x111827,
  )
  const borderMaterials = Array.isArray(border.material) ? border.material : [border.material]
  for (const m of borderMaterials) {
    m.transparent = true
    m.opacity = 0.12
  }
  mazeGroup.add(border)
}

function initThree() {
  if (!rootEl.value)
    return

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050814)
  baseFog = new THREE.FogExp2(0x050814, 0.12)
  scene.fog = baseFog

  mazeGroup = new THREE.Group()
  scene.add(mazeGroup)

  const rect = rootEl.value.getBoundingClientRect()
  const w = Math.max(1, Math.floor(rect.width))
  const h = Math.max(1, Math.floor(rect.height))
  fpsCamera = new THREE.PerspectiveCamera(72, w / h, 0.01, 60)
  fpsCamera.position.set(player.x, player.y, player.z)
  fpsCamera.rotation.order = 'YXZ'

  const snap = getMazeSnapshot()
  const { left, right, top, bottom } = computeGodOrthoFrustum(snap.cols, snap.rows, w / h, godZoom.value)
  godCamera = new THREE.OrthographicCamera(left, right, top, bottom, 0.01, 200)
  camera = godView.value ? godCamera : fpsCamera

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.setSize(w, h, false)
  renderer.setClearColor(0x050814, 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  ;(renderer as any).physicallyCorrectLights = true
  renderer.shadowMap.enabled = false
  renderer.domElement.style.position = 'absolute'
  renderer.domElement.style.inset = '0'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.zIndex = '0'
  rootEl.value.appendChild(renderer.domElement)
  requestAnimationFrame(resize)

  clock = new THREE.Clock()

  // flashlight
  flashlight = new THREE.SpotLight(0xFFFFFF, 3.2, 10, Math.PI / 6, 0.35, 1)
  flashlight.position.set(player.x, player.y, player.z)
  flashlightTarget = new THREE.Object3D()
  flashlightTarget.position.set(player.x, player.y, player.z - 1)
  scene.add(flashlightTarget)
  flashlight.target = flashlightTarget
  scene.add(flashlight)

  // small ambient to avoid pure black
  scene.add(new THREE.AmbientLight(0x0B1220, 0.3))

  // base lighting
  baseAmbient = new THREE.AmbientLight(0x1F2937, 0.55)
  scene.add(baseAmbient)

  const hemi = new THREE.HemisphereLight(0x93C5FD, 0x0B1220, 0.55)
  scene.add(hemi)

  const dir = new THREE.DirectionalLight(0xFFFFFF, 0.5)
  dir.position.set(6, 9, 5)
  scene.add(dir)

  const dir2 = new THREE.DirectionalLight(0xFFE6C7, 0.25)
  dir2.position.set(-5, 6, -7)
  scene.add(dir2)

  start3DLevel()
}

function applyViewState(v: boolean) {
  if (scene)
    scene.fog = v ? null : baseFog
  if (flashlight)
    flashlight.visible = !v
  if (baseAmbient)
    baseAmbient.intensity = v ? 0.9 : 0.55
  if (exitMarkerMesh)
    exitMarkerMesh.visible = v
  if (playerMarkerMesh)
    playerMarkerMesh.visible = v
  for (const m of goldMeshes) {
    m.rotation.x = v ? 0 : Math.PI / 2
    m.position.y = v ? 0.06 : 0.18
    m.scale.setScalar(v ? 1.1 : 1)
  }

  if (godCamera && fpsCamera)
    camera = v ? godCamera : fpsCamera
}

watch(godView, (v) => {
  if (v) {
    document.exitPointerLock?.()
    locked.value = false
    paused.value = false
  }
  else {
    paused.value = !locked.value
  }

  applyViewState(v)
  requestAnimationFrame(resize)
  requestAnimationFrame(setCameraPose)
}, { immediate: true })

watch(godZoom, () => {
  if (!godCamera)
    return
  resize()
})

function disposeObject(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as unknown as THREE.Mesh
    const geometry = (mesh as any).geometry as THREE.BufferGeometry | undefined
    geometry?.dispose?.()
    const material = (mesh as any).material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(material)) {
      for (const m of material)
        m.dispose?.()
    }
    else {
      material?.dispose?.()
    }
  })
}

function resize() {
  if (!rootEl.value || !renderer)
    return
  const rect = rootEl.value.getBoundingClientRect()
  const w = Math.max(1, Math.floor(rect.width))
  const h = Math.max(1, Math.floor(rect.height))
  renderer.setSize(w, h, false)
  const aspect = w / h
  if (fpsCamera) {
    fpsCamera.aspect = aspect
    fpsCamera.updateProjectionMatrix()
  }
  if (godCamera) {
    const snap = getMazeSnapshot()
    const { left, right, top, bottom } = computeGodOrthoFrustum(snap.cols, snap.rows, aspect, godZoom.value)
    godCamera.left = left
    godCamera.right = right
    godCamera.top = top
    godCamera.bottom = bottom
    godCamera.updateProjectionMatrix()
  }
}

function animate() {
  raf = requestAnimationFrame(animate)
  if (!renderer || !scene || !camera || !clock)
    return

  const dt = Math.min(0.04, clock.getDelta())

  const canMove = !paused.value && !isInputLocked() && (locked.value || godView.value)
  if (canMove) {
    const forward = godView.value
      ? new THREE.Vector3(0, 0, -1)
      : new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, yaw, 0, 'YXZ'))
    const right = godView.value
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, yaw, 0, 'YXZ'))

    const move = new THREE.Vector3(0, 0, 0)
    const sprint = keys.has('ShiftLeft')
    const speed = sprint ? 3.2 : 1.9
    if (keys.has('KeyW'))
      move.add(forward)
    if (keys.has('KeyS'))
      move.addScaledVector(forward, -1)
    if (keys.has('KeyA'))
      move.addScaledVector(right, -1)
    if (keys.has('KeyD'))
      move.add(right)

    const moving = move.lengthSq() > 0.0001
    if (moving) {
      move.normalize().multiplyScalar(speed * dt)
      const snap = getMazeSnapshot()
      const next = moveWithGridCollisions(snap, cfg, { x: player.x, y: player.y, z: player.z }, move.x, move.z)
      const blocked = Math.abs(next.x - (player.x + move.x)) > 1e-6 || Math.abs(next.z - (player.z + move.z)) > 1e-6
      player.x = next.x
      player.z = next.z

      // head bob + footsteps
      const t = clock.elapsedTime
      player.y = 0.55 + (godView.value ? 0 : Math.sin(t * 10) * 0.015)
      if (blocked)
        bump()

      stepSoundCooldown -= dt
      if (stepSoundCooldown <= 0) {
        stepSoundCooldown = sprint ? 0.22 : 0.32
        tryPlay(audioWalk)
      }
    }
    else {
      // settle camera
      player.y += (0.55 - player.y) * 0.2
      stepSoundCooldown = 0
    }

    collectIfNeeded()

    // sprint FOV kick (fps only)
    if (fpsCamera && !godView.value) {
      fpsCamera.fov += ((sprint ? 78 : 72) - fpsCamera.fov) * 0.12
      fpsCamera.updateProjectionMatrix()
    }
  }

  // animate coins + exit pulse
  for (const m of goldMeshes) {
    if (!m.visible)
      continue
    m.rotation.z += dt * 2.8
    if (!godView.value)
      m.position.y = 0.18 + Math.sin((clock.elapsedTime * 3) + m.position.x + m.position.z) * 0.02
  }
  if (exitMesh && exitUnlocked.value) {
    const mat = exitMesh.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = 0.9 + Math.sin(clock.elapsedTime * 3.2) * 0.35
  }
  if (playerMarkerMesh) {
    playerMarkerMesh.position.x = player.x
    playerMarkerMesh.position.z = player.z
  }

  setCameraPose()
  renderer.render(scene, camera)
}

onMounted(() => {
  // ensure initial level exists
  if (!goldArray.value.length)
    setup()

  initThree()
  applyViewState(godView.value)

  resizeObserver = new ResizeObserver(() => resize())
  if (rootEl.value)
    resizeObserver.observe(rootEl.value)

  window.addEventListener('resize', resize)
  document.addEventListener('pointerlockchange', onPointerLockChange)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('mousemove', onMouseMove)

  animate()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', resize)
  document.removeEventListener('pointerlockchange', onPointerLockChange)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('mousemove', onMouseMove)

  if (scene)
    disposeObject(scene)

  wallTextures?.map.dispose()
  wallTextures?.normalMap.dispose()
  wallTextures?.roughnessMap.dispose()
  wallTextures = null

  floorTextures?.map.dispose()
  floorTextures?.normalMap.dispose()
  floorTextures?.roughnessMap.dispose()
  floorTextures = null

  if (renderer) {
    renderer.dispose()
    renderer.domElement.remove()
  }
  renderer = null
  scene = null
  baseFog = null
  camera = null
  clock = null
  mazeGroup = null
  flashlight = null
  flashlightTarget = null
})

const exitHint = computed(() => {
  const snap = getMazeSnapshot()
  if (!snap.exit)
    return ''
  const cell = currentCell()
  const dist = manhattanCellDistance(cell, snap.exit)
  return exitUnlocked.value ? `出口约 ${dist} 步` : `出口未开启（剩余 ${remainingGold.value}）`
})
</script>

<template>
  <div class="flee3d" :class="{ bump: bumping }">
    <div ref="rootEl" class="three-root" @click="requestLock">
      <div class="hud">
        <div class="pill">
          <span class="label">Lv</span>
          <span class="value">{{ n }}</span>
        </div>
        <div class="pill">
          <img src="/img/gold.svg" class="icon" alt="gold">
          <span class="value">{{ collectedGoldCount }}</span>
          <span class="sub">/ {{ totalGold }}</span>
        </div>
        <div class="pill">
          <span class="label">步数</span>
          <span class="value">{{ steps }}</span>
        </div>
        <div class="pill">
          <span class="label">时间</span>
          <span class="value">{{ countDown }}s</span>
        </div>
        <div class="pill wide">
          <span class="label">{{ exitHint }}</span>
        </div>
      </div>

      <div v-if="!godView" class="crosshair" />

      <div v-if="paused && !godView" class="overlay">
        <div class="card">
          <div class="title">
            3D 第一人称模式
          </div>
          <div class="desc">
            点击画面进入（锁定鼠标）<br>
            移动：WASD  冲刺：Shift<br>
            转角：Q / E（顺滑转身）<br>
            上帝视角：M<br>
            退出：Esc
          </div>
          <button class="btn" type="button">
            点击开始
          </button>
        </div>
      </div>

      <div v-if="showWin" class="overlay win">
        <div class="card">
          <div class="title">
            恭喜过关
          </div>
          <div class="desc pre">
            {{ winText }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flee3d {
  width: 100%;
  height: 100%;
  position: relative;
}

.three-root {
  position: relative;
  width: 100%;
  height: auto;
  aspect-ratio: 1 / 1;
  max-width: 600px;
  margin: 0 auto;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.hud {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  z-index: 5;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
  color: rgba(255, 255, 255, 0.92);
}

  .pill.wide {
    padding-right: 14px;
  }

.label {
  font-size: 0.85rem;
  opacity: 0.8;
}

.value {
  font-weight: 800;
  color: #fbbf24;
  text-shadow: 0 0 10px rgba(251, 191, 36, 0.18);
}

.sub {
  font-size: 0.85rem;
  opacity: 0.7;
}

.icon {
  width: 18px;
  height: 18px;
  filter: drop-shadow(0 6px 8px rgba(0, 0, 0, 0.5));
}

.crosshair {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 10px;
  height: 10px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 0 16px rgba(255, 255, 255, 0.15);
  z-index: 5;
  pointer-events: none;
}

.overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 40%, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.7));
}

.overlay.win {
  background: rgba(0, 0, 0, 0.55);
}

.card {
  width: min(420px, calc(100% - 28px));
  padding: 16px 16px 14px;
  border-radius: 14px;
  background: rgba(20, 20, 20, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  text-align: center;
}

.title {
  font-weight: 900;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  color: #fbbf24;
}

.desc {
  font-size: 0.92rem;
  opacity: 0.9;
  line-height: 1.45;
}

.desc.pre {
  white-space: pre-line;
}

.btn {
  margin-top: 12px;
  width: 100%;
  border: none;
  border-radius: 12px;
  padding: 10px 12px;
  font-weight: 800;
  cursor: pointer;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #111827;
}

.bump {
  animation: bump 140ms ease-in-out;
}

@keyframes bump {
  0% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  55% { transform: translateX(3px); }
  100% { transform: translateX(0); }
}
</style>

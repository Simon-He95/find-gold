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
import { nearestGoldDistance } from '../maze/hints'
import { cellFromWorld, collectAtCell, collectedGold, shouldAdvanceLevel, shouldUnlockExit, stepCounter } from '../maze/step'
import { createTorchRig } from '../three/torch'

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
const debugTorch = ref(false)
const debugTorchText = ref('')

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
let camera: THREE.Camera | null = null
let fpsCamera: THREE.PerspectiveCamera | null = null
let godCamera: THREE.OrthographicCamera | null = null
let raf = 0
let clock: THREE.Clock | null = null
let resizeObserver: ResizeObserver | null = null
const fpsExposure = 1.2
const godExposure = 1.08

let mazeGroup: THREE.Group | null = null
let gridHelper: THREE.GridHelper | null = null
let borderHelper: THREE.Box3Helper | null = null
let mazeWallLines: THREE.LineSegments | null = null

let exitMesh: THREE.Mesh | null = null
let exitMarkerMesh: THREE.Mesh | null = null
let goldMeshes: THREE.Mesh[] = []
let playerMarkerMesh: THREE.Mesh | null = null

let flashlight: THREE.SpotLight | null = null
let flashlightFill: THREE.SpotLight | null = null
let flashlightBounce: THREE.PointLight | null = null
let flashlightBeam: THREE.Mesh | null = null
let flashlightBeamEnabled = false
let flashlightTarget: THREE.Object3D | null = null
let flashlightCookie: THREE.Texture | null = null
let torchSpot: THREE.Sprite | null = null
let torchSpotTexture: THREE.Texture | null = null
let torchIntensityScale = 1
let baseAmbient: THREE.AmbientLight | null = null
let fillAmbient: THREE.AmbientLight | null = null
let hemiLight: THREE.HemisphereLight | null = null
let dirLight: THREE.DirectionalLight | null = null
let dirLight2: THREE.DirectionalLight | null = null

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
const debugRaycaster = new THREE.Raycaster()
const debugNdc = new THREE.Vector2(0, 0)
const debugV0 = new THREE.Vector3()
const debugV1 = new THREE.Vector3()
const torchOrigin = new THREE.Vector3()
const torchForward = new THREE.Vector3()
const torchAimWorld = new THREE.Vector3()
const torchAimNdc = new THREE.Vector3()
const meshHitsOnly = (hits: THREE.Intersection[]) =>
  hits.filter(h => (h.object as any)?.isMesh)

const torchTest = ref(false)
const torchAimScreen = reactive({ x: 0, y: 0 })
const torchAimStyle = computed(() => ({
  left: `${torchAimScreen.x}px`,
  top: `${torchAimScreen.y}px`,
}))

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

    // accentuate mortar so brick pattern reads under low light
    ctx.globalAlpha = 0.22
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.lineWidth = Math.max(1, Math.floor(size / 220))
    for (let y = 0; y <= size; y += brickH) {
      ctx.beginPath()
      ctx.moveTo(0, y + 0.5)
      ctx.lineTo(size, y + 0.5)
      ctx.stroke()
    }
    for (let x = 0; x <= size; x += brickW) {
      ctx.beginPath()
      ctx.moveTo(x + 0.5, 0)
      ctx.lineTo(x + 0.5, size)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

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
    ctx.fillStyle = '#374151'
    ctx.fillRect(0, 0, size, size)

    const tile = Math.floor(size / 8)
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'
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

    ctx.globalAlpha = 0.55
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

function makeTorchSpotTexture(size = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return null

  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,255,255,0.95)')
  grad.addColorStop(0.4, 'rgba(255,244,214,0.7)')
  grad.addColorStop(0.7, 'rgba(255,244,214,0.25)')
  grad.addColorStop(1, 'rgba(255,244,214,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)

  const tex = new THREE.CanvasTexture(canvas)
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

  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyM', 'ShiftLeft', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backquote'].includes(e.code))
    e.preventDefault()

  if (e.code === 'Backquote' && import.meta.env.DEV) {
    debugTorch.value = !debugTorch.value
    return
  }

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
  fpsCamera.updateMatrixWorld()
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
  // Face into the maze. At the start cell (z≈0.5), looking -Z points outside bounds.
  yaw = Math.PI
  // Slightly down so floor + grid are visible immediately.
  pitch = -0.12
  yawTarget = yaw
  pitchTarget = pitch

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
  gridHelper = null
  borderHelper = null
  mazeWallLines = null

  ensureMaterialTextures()

  // floor
  const floorGeo = new THREE.PlaneGeometry(snap.cols * cellSize, snap.rows * cellSize, 1, 1)
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,
    roughness: 0.92,
    metalness: 0,
    emissive: new THREE.Color(0x0B1220),
    emissiveIntensity: 0.12,
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
    floorMat.normalScale = new THREE.Vector2(0.8, 0.8)
  }
  if (floorMat.roughnessMap)
    floorMat.roughnessMap.repeat.copy(floorMat.map?.repeat ?? new THREE.Vector2(1, 1))
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(snap.cols * cellSize / 2, 0, snap.rows * cellSize / 2)
  floor.receiveShadow = true
  mazeGroup.add(floor)

  const grid = new THREE.GridHelper(
    Math.max(snap.cols, snap.rows) * cellSize,
    Math.max(snap.cols, snap.rows),
    0x94A3B8,
    0x334155,
  )
  grid.position.set(snap.cols * cellSize / 2, 0.01, snap.rows * cellSize / 2)
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
  for (const m of gridMaterials) {
    // Keep the grid subtle in god view; walls are drawn separately for clarity.
    m.opacity = 0.14
    m.transparent = true
    ;(m as any).depthWrite = false
    ;(m as any).depthTest = true
  }
  grid.visible = godView.value
  mazeGroup.add(grid)
  gridHelper = grid

  // god view wall outlines (only closed walls)
  {
    const y = 0.022
    const positions: number[] = []
    const pushSeg = (x0: number, z0: number, x1: number, z1: number) => {
      positions.push(x0, y, z0, x1, y, z1)
    }

    for (const c of snap.cells) {
      const x0 = c.i * cellSize
      const z0 = c.j * cellSize

      if (c.walls[0])
        pushSeg(x0, z0, x0 + cellSize, z0)
      if (c.walls[2])
        pushSeg(x0, z0, x0, z0 + cellSize)
      if (c.j === snap.rows - 1 && c.walls[1])
        pushSeg(x0, z0 + cellSize, x0 + cellSize, z0 + cellSize)
      if (c.i === snap.cols - 1 && c.walls[3])
        pushSeg(x0 + cellSize, z0, x0 + cellSize, z0 + cellSize)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const mat = new THREE.LineBasicMaterial({
      color: 0xE2E8F0,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    })
    const lines = new THREE.LineSegments(geo, mat)
    lines.renderOrder = 10
    lines.visible = godView.value
    mazeGroup.add(lines)
    mazeWallLines = lines
  }

  // walls
  const wallColor = new THREE.Color().setHSL(Math.random(), 0.10, 0.76)
  const wallMat = new THREE.MeshStandardMaterial({
    color: wallColor,
    roughness: 0.78,
    metalness: 0.02,
    emissive: new THREE.Color(0x0B1220),
    emissiveIntensity: 0.08,
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
    wallMat.normalScale = new THREE.Vector2(0.8, 0.8)
  }
  if (wallMat.roughnessMap)
    wallMat.roughnessMap.repeat.copy(wallMat.map?.repeat ?? new THREE.Vector2(1, 1))
  const wallEdgeMat = new THREE.LineBasicMaterial({ color: 0xCBD5E1, transparent: true, opacity: 0.22 })

  // NOTE: Horizontal/vertical wall boxes can create coplanar overlaps at corners.
  // Use polygon offset on one set to avoid z-fighting "mosaic" artifacts.
  const wallMatV = wallMat.clone()
  wallMatV.polygonOffset = true
  wallMatV.polygonOffsetFactor = 1
  wallMatV.polygonOffsetUnits = 1

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
  const vMesh = new THREE.InstancedMesh(vGeo, wallMatV, Math.max(1, vCount))
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
  border.visible = godView.value
  borderHelper = border
}

function initThree() {
  if (!rootEl.value)
    return

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050814)
  // Fog tends to "overwrite" the torch beam and make the center look black at distance.
  // Keep it off in FPS mode and rely on the torch falloff for darkness.
  scene.fog = null

  mazeGroup = new THREE.Group()
  scene.add(mazeGroup)

  const rect = rootEl.value.getBoundingClientRect()
  const w = Math.max(1, Math.floor(rect.width))
  const h = Math.max(1, Math.floor(rect.height))
  fpsCamera = new THREE.PerspectiveCamera(72, w / h, 0.01, 60)
  fpsCamera.position.set(player.x, player.y, player.z)
  fpsCamera.rotation.order = 'YXZ'
  // Add the FPS camera to the scene so children (flashlight/target) get matrixWorld updates.
  scene.add(fpsCamera)

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
  renderer.toneMappingExposure = fpsExposure
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
  // Attach to the FPS camera so it always follows mouse look (yaw + pitch).
  // Use a 2-light rig to simulate a torch/flashlight: sharp bright center + soft wide falloff,
  // plus a small bounce point light so walls nearby never look "unlit".
  const torch = createTorchRig(fpsCamera)
  flashlight = torch.main
  flashlightFill = torch.fill
  flashlightBounce = torch.bounce
  flashlightBeam = torch.beam
  flashlightBeamEnabled = false
  if (flashlightBeam)
    flashlightBeam.visible = false
  flashlightTarget = torch.target
  flashlightCookie = torch.cookie
  torchIntensityScale = 1
  if (flashlight)
    flashlight.userData.baseIntensity = flashlight.intensity
  if (flashlightFill)
    flashlightFill.userData.baseIntensity = flashlightFill.intensity
  if (flashlightBounce)
    flashlightBounce.userData.baseIntensity = flashlightBounce.intensity

  // visible hotspot (fake decal) to ensure the wall shows the torch center
  torchSpotTexture = makeTorchSpotTexture(256)
  if (torchSpotTexture) {
    const spotMat = new THREE.SpriteMaterial({
      map: torchSpotTexture,
      color: 0xFFF2CC,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    torchSpot = new THREE.Sprite(spotMat)
    torchSpot.visible = false
    torchSpot.renderOrder = 3
    scene.add(torchSpot)
  }

  // small ambient to avoid pure black
  fillAmbient = new THREE.AmbientLight(0x0B1220, 0.3)
  scene.add(fillAmbient)

  // base lighting
  baseAmbient = new THREE.AmbientLight(0x1F2937, 0.55)
  scene.add(baseAmbient)

  hemiLight = new THREE.HemisphereLight(0x93C5FD, 0x0B1220, 0.55)
  scene.add(hemiLight)

  dirLight = new THREE.DirectionalLight(0xFFFFFF, 0.5)
  dirLight.position.set(6, 9, 5)
  scene.add(dirLight)

  dirLight2 = new THREE.DirectionalLight(0xFFE6C7, 0.25)
  dirLight2.position.set(-5, 6, -7)
  scene.add(dirLight2)

  start3DLevel()
}

function applyViewState(v: boolean) {
  if (scene)
    scene.fog = null
  if (renderer)
    renderer.toneMappingExposure = v ? godExposure : fpsExposure
  if (flashlight)
    flashlight.visible = !v
  if (flashlightFill)
    flashlightFill.visible = !v
  if (flashlightBounce)
    flashlightBounce.visible = !v
  if (flashlightBeam)
    flashlightBeam.visible = flashlightBeamEnabled && !v
  if (torchSpot)
    torchSpot.visible = !v
  if (baseAmbient)
    baseAmbient.intensity = v ? 0.9 : 0.26
  if (fillAmbient)
    fillAmbient.intensity = v ? 0.3 : 0.12
  if (hemiLight)
    hemiLight.intensity = v ? 0.55 : 0.18
  if (dirLight)
    dirLight.intensity = v ? 0.5 : 0
  if (dirLight2)
    dirLight2.intensity = v ? 0.25 : 0
  if (exitMarkerMesh)
    exitMarkerMesh.visible = v
  if (playerMarkerMesh)
    playerMarkerMesh.visible = v
  if (gridHelper)
    gridHelper.visible = v
  if (borderHelper)
    borderHelper.visible = v
  if (mazeWallLines)
    mazeWallLines.visible = v
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

function updateTorchAim() {
  if (!fpsCamera || !flashlightTarget)
    return
  if (godView.value)
    return

  fpsCamera.updateMatrixWorld()
  const aimDistance = 20
  torchForward.set(0, 0, -1).applyQuaternion(fpsCamera.quaternion)
  torchAimWorld.copy(fpsCamera.position).addScaledVector(torchForward, aimDistance)

  flashlightTarget.position.set(0, 0, -1)
  flashlightTarget.updateMatrixWorld()

  let hit: THREE.Intersection | null = null
  if (mazeGroup) {
    if (flashlight)
      flashlight.getWorldPosition(torchOrigin)
    else
      fpsCamera.getWorldPosition(torchOrigin)
    debugRaycaster.set(torchOrigin, torchForward)
    const hits = meshHitsOnly(debugRaycaster.intersectObject(mazeGroup, true))
    hit = hits[0] ?? null
  }

  // Auto-scale intensity: dim when very close to a wall (avoid blowout),
  // boost a bit when looking down a long corridor (avoid "can't see the road").
  {
    const d = hit?.distance ?? aimDistance
    const targetScale = Math.min(1.35, Math.max(0.25, d / 4))
    torchIntensityScale += (targetScale - torchIntensityScale) * 0.12
    if (flashlight) {
      const base = typeof flashlight.userData?.baseIntensity === 'number'
        ? flashlight.userData.baseIntensity
        : flashlight.intensity
      flashlight.intensity = base * torchIntensityScale
    }
    if (flashlightFill) {
      const base = typeof flashlightFill.userData?.baseIntensity === 'number'
        ? flashlightFill.userData.baseIntensity
        : flashlightFill.intensity
      flashlightFill.intensity = base * torchIntensityScale
    }
    if (flashlightBounce) {
      const base = typeof flashlightBounce.userData?.baseIntensity === 'number'
        ? flashlightBounce.userData.baseIntensity
        : flashlightBounce.intensity
      flashlightBounce.intensity = base * torchIntensityScale
    }
  }

  if (flashlightBeam && flashlightBeamEnabled) {
    flashlightBeam.lookAt(torchAimWorld)
    const baseLength = typeof flashlightBeam.userData?.baseLength === 'number'
      ? flashlightBeam.userData.baseLength
      : 10
    const startZ = typeof flashlightBeam.userData?.startZ === 'number'
      ? flashlightBeam.userData.startZ
      : 0
    if (hit) {
      const dist = Math.max(0.2, hit.distance - 0.15)
      const ratio = Math.min(Math.max(dist / baseLength, 0.05), 1)
      flashlightBeam.scale.setScalar(ratio)
      // Keep the near end fixed at -startZ (avoid near-plane clipping artifacts).
      flashlightBeam.position.z = startZ * (ratio - 1)
    }
    else {
      flashlightBeam.scale.setScalar(1)
      flashlightBeam.position.z = 0
    }
  }

  if (torchSpot) {
    if (hit) {
      torchSpot.visible = true
      const normal = hit.face
        ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
        : torchForward
      torchSpot.position.copy(hit.point).addScaledVector(normal, 0.02)
      const size = Math.min(1.55, Math.max(0.32, hit.distance * 0.09))
      torchSpot.scale.set(size, size, size)
    }
    else {
      torchSpot.visible = false
    }
  }

  if (torchTest.value && rootEl.value) {
    torchAimNdc.copy(torchAimWorld).project(fpsCamera)
    const rect = rootEl.value.getBoundingClientRect()
    torchAimScreen.x = (torchAimNdc.x * 0.5 + 0.5) * rect.width
    torchAimScreen.y = (-torchAimNdc.y * 0.5 + 0.5) * rect.height
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
  updateTorchAim()

  if (import.meta.env.DEV && debugTorch.value && fpsCamera && flashlight) {
    debugRaycaster.setFromCamera(debugNdc, fpsCamera)
    const hits = mazeGroup ? meshHitsOnly(debugRaycaster.intersectObject(mazeGroup, true)) : []
    const hit = hits[0]

    flashlight.getWorldPosition(debugV0)
    flashlight.target.getWorldPosition(debugV1)
    debugTorchText.value = [
      `cam: ${fpsCamera.position.x.toFixed(2)},${fpsCamera.position.y.toFixed(2)},${fpsCamera.position.z.toFixed(2)}`,
      `yaw/pitch: ${yaw.toFixed(2)} / ${pitch.toFixed(2)}`,
      `main: I=${flashlight.intensity.toFixed(0)} dist=${flashlight.distance || 0} decay=${flashlight.decay} ang=${(flashlight.angle * 180 / Math.PI).toFixed(1)}° pen=${flashlight.penumbra.toFixed(2)}`,
      `light->target: ${debugV0.distanceTo(debugV1).toFixed(2)}`,
      hit ? `hit: ${hit.distance.toFixed(2)} obj=${(hit.object as any).type}` : 'hit: none',
    ].join('\n')
  }

  renderer.render(scene, camera)
}

onMounted(() => {
  // ensure initial level exists
  if (!goldArray.value.length)
    setup()

  torchTest.value = typeof window !== 'undefined' && window.location.search.includes('torchTest=1')
  if (torchTest.value)
    godView.value = false

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
  camera = null
  clock = null
  mazeGroup = null
  gridHelper = null
  borderHelper = null
  mazeWallLines = null
  flashlight = null
  flashlightFill = null
  flashlightBounce = null
  flashlightBeam = null
  flashlightBeamEnabled = false
  flashlightTarget = null
  flashlightCookie?.dispose()
  flashlightCookie = null
  if (torchSpot) {
    const mat = torchSpot.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) {
      for (const m of mat)
        m.dispose?.()
    }
    else {
      mat?.dispose?.()
    }
  }
  torchSpot = null
  torchSpotTexture?.dispose()
  torchSpotTexture = null
  baseAmbient = null
  fillAmbient = null
  hemiLight = null
  dirLight = null
  dirLight2 = null
})

const exitHint = computed(() => {
  const snap = getMazeSnapshot()
  if (!snap.exit)
    return ''
  const cell = currentCell()
  const dist = manhattanCellDistance(cell, snap.exit)
  return exitUnlocked.value ? `出口约 ${dist} 步` : `出口未开启（剩余 ${remainingGold.value}）`
})

const nearestGoldHint = computed(() => {
  const snap = getMazeSnapshot()
  const cell = currentCell()
  const d = nearestGoldDistance(snap.gold as any, cell as any)
  if (d === null)
    return '金币已收集完'
  return `最近金币约 ${d} 步`
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
          <span class="label">{{ nearestGoldHint }}</span>
        </div>
        <div class="pill wide">
          <span class="label">{{ exitHint }}</span>
        </div>
      </div>

      <pre v-if="debugTorch && !godView" class="debug-torch">{{ debugTorchText }}</pre>
      <div v-if="torchTest || !godView" class="crosshair" />
      <div v-if="torchTest && !godView" class="torch-aim" :style="torchAimStyle" />

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

.torch-aim {
  position: absolute;
  width: 8px;
  height: 8px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: rgba(34, 211, 238, 0.85);
  box-shadow: 0 0 10px rgba(34, 211, 238, 0.6);
  z-index: 6;
  pointer-events: none;
}

.debug-torch {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 10px;
  z-index: 6;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  font-size: 12px;
  line-height: 1.25;
  color: rgba(255, 255, 255, 0.9);
  pointer-events: none;
  white-space: pre-wrap;
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

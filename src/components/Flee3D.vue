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
import { cellFromWorld, collectAtCell, shouldAdvanceLevel, shouldUnlockExit, stepCounter } from '../maze/step'

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

const showWin = ref(false)
const winText = ref('')

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
let camera: THREE.PerspectiveCamera | null = null
let raf = 0
let clock: THREE.Clock | null = null

let mazeGroup: THREE.Group | null = null

let exitMesh: THREE.Mesh | null = null
let goldMeshes: THREE.Mesh[] = []

let flashlight: THREE.SpotLight | null = null
let flashlightTarget: THREE.Object3D | null = null

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

function requestLock() {
  if (!rootEl.value)
    return
  rootEl.value.requestPointerLock?.()
}

function onPointerLockChange() {
  const el = document.pointerLockElement
  locked.value = !!el
  paused.value = !locked.value
  if (!locked.value)
    resetInput()
}

function onKeyDown(e: KeyboardEvent) {
  if (isInputLocked())
    return

  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault()

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
  if (!camera)
    return
  yaw += (yawTarget - yaw) * 0.18
  pitch += (pitchTarget - pitch) * 0.18
  camera.rotation.set(pitch, yaw, 0, 'YXZ')
  camera.position.set(player.x, player.y, player.z)
  if (flashlight) {
    flashlight.position.copy(camera.position)
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation)
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

  // floor
  const floorGeo = new THREE.PlaneGeometry(snap.cols * cellSize, snap.rows * cellSize, 1, 1)
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0B1220,
    roughness: 1,
    metalness: 0,
  })
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
  const wallColor = new THREE.Color().setHSL(Math.random(), 0.7, 0.55)
  const wallMat = new THREE.MeshStandardMaterial({
    color: wallColor,
    roughness: 0.55,
    metalness: 0.05,
    emissive: new THREE.Color(0x000000),
  })
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
    syncExitMaterial()
  }

  // gold coins
  const coinGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.06, 18)
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xFBBF24, roughness: 0.25, metalness: 0.8, emissive: new THREE.Color(0x3D2A00), emissiveIntensity: 0.25 })
  for (const g of snap.gold) {
    const coin = new THREE.Mesh(coinGeo, coinMat)
    coin.position.set(g.i * cellSize + 0.5, 0.18, g.j * cellSize + 0.5)
    coin.rotation.x = Math.PI / 2
    coin.visible = g.show
    mazeGroup.add(coin)
    goldMeshes.push(coin)
  }

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
  scene.fog = new THREE.FogExp2(0x050814, 0.12)

  mazeGroup = new THREE.Group()
  scene.add(mazeGroup)

  const w = rootEl.value.clientWidth
  const h = rootEl.value.clientHeight
  camera = new THREE.PerspectiveCamera(72, w / h, 0.01, 60)
  camera.position.set(player.x, player.y, player.z)
  camera.rotation.order = 'YXZ'

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.setSize(w, h)
  renderer.shadowMap.enabled = false
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
  const ambient = new THREE.AmbientLight(0x1F2937, 0.55)
  scene.add(ambient)

  const dir = new THREE.DirectionalLight(0xFFFFFF, 0.5)
  dir.position.set(6, 8, 5)
  scene.add(dir)

  start3DLevel()
}

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
  if (!rootEl.value || !renderer || !camera)
    return
  const w = rootEl.value.clientWidth
  const h = rootEl.value.clientHeight
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

function animate() {
  raf = requestAnimationFrame(animate)
  if (!renderer || !scene || !camera || !clock)
    return

  const dt = Math.min(0.04, clock.getDelta())
  if (!paused.value && locked.value && !isInputLocked()) {
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, yaw, 0, 'YXZ'))
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, yaw, 0, 'YXZ'))

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
      player.y = 0.55 + Math.sin(t * 10) * 0.015
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

    // sprint FOV kick
    camera.fov += ((sprint ? 78 : 72) - camera.fov) * 0.12
    camera.updateProjectionMatrix()
  }

  // animate coins + exit pulse
  for (const m of goldMeshes) {
    if (!m.visible)
      continue
    m.rotation.z += dt * 2.8
    m.position.y = 0.18 + Math.sin((clock.elapsedTime * 3) + m.position.x + m.position.z) * 0.02
  }
  if (exitMesh && exitUnlocked.value) {
    const mat = exitMesh.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = 0.9 + Math.sin(clock.elapsedTime * 3.2) * 0.35
  }

  setCameraPose()
  renderer.render(scene, camera)
}

onMounted(() => {
  // ensure initial level exists
  if (!goldArray.value.length)
    setup()

  initThree()

  window.addEventListener('resize', resize)
  document.addEventListener('pointerlockchange', onPointerLockChange)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('mousemove', onMouseMove)

  animate()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
  document.removeEventListener('pointerlockchange', onPointerLockChange)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('mousemove', onMouseMove)

  if (scene)
    disposeObject(scene)

  if (renderer) {
    renderer.dispose()
    renderer.domElement.remove()
  }
  renderer = null
  scene = null
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
  return exitUnlocked.value ? `出口约 ${dist} 步` : '出口未开启'
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
          <span class="value">{{ remainingGold }}</span>
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

      <div class="crosshair" />

      <div v-if="paused" class="overlay">
        <div class="card">
          <div class="title">
            3D 第一人称模式
          </div>
          <div class="desc">
            点击画面进入（锁定鼠标）<br>
            移动：WASD  冲刺：Shift<br>
            转角：Q / E（顺滑转身）<br>
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

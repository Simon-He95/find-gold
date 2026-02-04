<script setup lang="ts">
import { isDark } from '~/composables'
import { hideMask, n } from './canvas'

const content = ref('欢迎来到寻找金币游戏')
const contentList = [
  '欢迎来到寻找金币游戏！使用方向键或WASD移动',
  '收集所有金币以开启出口，再前往绿色出口通关',
  '礼物盒会给你惊喜！点击星星可收藏此游戏',
  '每一关难度都会增加，迷宫更大，金币更多',
  '找到所有金币，挑战自己的迷宫解谜能力！',
]
const index = ref(0)
function finish() {
  if (index.value < contentList.length - 1)
    index.value++
  else index.value = 0
  setTimeout(() => {
    content.value = contentList[index.value]
  }, 500)
}

function styleFn(i: number) {
  return `color:rgb(${Math.random() * 255},${Math.random() * 255}, ${
    Math.random() * 255
  });animation-delay:${i * 0.1}s;`
}

const Title = ref('寻找金币')
function finishTitle() {
  if (Title.value === '寻找金币')
    Title.value = 'Find Gold'
  else
    Title.value = '寻找金币'
}

// Set dark mode by default for game
isDark.value = true

// Compute difficulty level text based on level number
const difficultyText = computed(() => {
  if (n.value <= 3)
    return { text: '简单', class: 'easy' }
  if (n.value <= 7)
    return { text: '中等', class: 'medium' }
  return { text: '困难', class: 'hard' }
})

// Control game sounds
const soundEnabled = ref(true)
function toggleSound() {
  soundEnabled.value = !soundEnabled.value
}

// Show/hide game help modal
const showHelp = ref(false)
function toggleHelp() {
  showHelp.value = !showHelp.value
}

const viewMode = useStorage<'2d' | '3d'>('FIND_GOLD_view_mode', '2d')
const is3D = computed(() => viewMode.value === '3d')
const godView = useStorage<boolean>('FIND_GOLD_god_view', false)

watch(viewMode, () => {
  // Switching view mode should always leave "god view" state.
  godView.value = false
  hideMask.value = false
  document.exitPointerLock?.()
})

function toggleViewMode() {
  viewMode.value = is3D.value ? '2d' : '3d'
}

const fsTarget = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)

function getFullscreenElement() {
  const anyDoc = document as any
  return (document.fullscreenElement ?? anyDoc.webkitFullscreenElement ?? null) as Element | null
}

function syncFullscreen() {
  isFullscreen.value = getFullscreenElement() === fsTarget.value
}

async function toggleFullscreen() {
  const el = fsTarget.value
  if (!el)
    return

  try {
    if (!getFullscreenElement()) {
      const anyEl = el as any
      await (anyEl.requestFullscreen?.() ?? anyEl.webkitRequestFullscreen?.())
    }
    else {
      const anyDoc = document as any
      await (document.exitFullscreen?.() ?? anyDoc.webkitExitFullscreen?.())
    }
  }
  catch {}

  requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'))
  })
}

onMounted(() => {
  syncFullscreen()
  document.addEventListener('fullscreenchange', syncFullscreen)
  document.addEventListener('webkitfullscreenchange', syncFullscreen as any)

  window.addEventListener('keydown', onGlobalKeyDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncFullscreen)
  document.removeEventListener('webkitfullscreenchange', syncFullscreen as any)
  window.removeEventListener('keydown', onGlobalKeyDown)
})

function onGlobalKeyDown(e: KeyboardEvent) {
  if (e.code !== 'KeyM' || e.repeat)
    return

  // 3D mode handles KeyM inside Flee3D (to avoid double-toggle).
  if (is3D.value)
    return

  hideMask.value = !hideMask.value
  e.preventDefault()
}
</script>

<template>
  <div class="app-shell">
    <main class="app-card">
      <header class="app-header">
        <div class="header-left">
          <div class="level-badge">
            Lv {{ n }}
          </div>
          <div class="difficulty-badge" :class="difficultyText.class">
            {{ difficultyText.text }}
          </div>
        </div>

        <button class="app-title" type="button" title="点击切换标题" @click="finishTitle">
          {{ Title }}
        </button>

        <div class="header-right">
          <button class="mode-button" type="button" :title="is3D ? '切换到2D' : '切换到3D'" @click="toggleViewMode">
            <div :class="is3D ? 'i-carbon-grid' : 'i-carbon-cube'" class="mr1" />
            <span>{{ is3D ? '2D' : '3D' }}</span>
          </button>
          <button class="icon-button" :title="isFullscreen ? '退出全屏' : '全屏模式'" @click="toggleFullscreen">
            <div :class="isFullscreen ? 'i-carbon-minimize' : 'i-carbon-fit-to-screen'" />
          </button>
          <button class="icon-button" :title="soundEnabled ? '关闭声音' : '开启声音'" @click="toggleSound">
            <div :class="soundEnabled ? 'i-carbon-volume-up' : 'i-carbon-volume-mute'" />
          </button>
          <button class="icon-button" title="游戏帮助" @click="toggleHelp">
            <div i-carbon-help />
          </button>
        </div>
      </header>

      <div class="objective-bar">
        <div class="objective-pill">
          <img src="/img/gold.svg" class="w5 h5" alt="金币">
          <span>收集金币</span>
          <span class="arrow">→</span>
          <img src="/img/exit.svg" class="w5 h5" alt="出口">
          <span>前往出口</span>
        </div>
        <div class="objective-hint">
          {{ is3D ? 'WASD + 鼠标 / Q E 转角' : 'WASD / 方向键' }}
        </div>
      </div>

      <div class="game-content">
        <div ref="fsTarget" class="game-stage">
          <button v-if="isFullscreen" class="fs-fab" type="button" title="退出全屏 (Esc)" @click.stop="toggleFullscreen">
            <div i-carbon-close />
          </button>
          <Flee v-if="!is3D" :sound-enabled="soundEnabled" class="game-board" />
          <Flee3D v-else :sound-enabled="soundEnabled" class="game-board" />
        </div>

        <div class="game-info">
          <vivid-typing
            :content="content"
            :speed="2"
            h-20px
            :spilt-style="styleFn"
            spilt-tag="span"
            :finish="finish"
          />
        </div>
      </div>

      <div class="game-footer">
        <Footer />
      </div>

      <div v-if="showHelp" class="popup" @click="showHelp = false">
        <div class="popup-content" @click.stop>
          <h2 class="text-xl font-bold mb3">
            游戏帮助
          </h2>
          <div class="text-left text-sm">
            <p class="mb2">
              <b>游戏目标：</b>收集所有金币以开启出口，然后前往绿色出口通关
            </p>
            <p class="mb2">
              <b>控制方式：</b>方向键 / WASD（移动受墙体阻挡）
            </p>
            <p class="mb2">
              <b>3D模式：</b>点击画面进入第一人称（锁定鼠标），WASD移动，Shift冲刺，Q/E顺滑转角，Esc退出
            </p>
            <p class="mb2">
              <b>全屏模式：</b>点击右上角全屏按钮，可更沉浸地游玩（建议搭配3D模式）
            </p>
            <p class="mb2">
              <b>上帝视角：</b>按 M 切换（2D/3D均可）
            </p>
            <p class="mb2">
              <b>2D上帝视角：</b>2D模式下按 M 可切换迷雾/上帝视角（上帝视角会移除黑色迷雾遮罩）
            </p>
            <p class="mb2">
              <b>道具说明：</b>
            </p>
            <div class="flex items-center my1">
              <img src="/img/gold.svg" class="w5 h5 mr2" alt="金币">
              <span>金币 - 全部收集后出口开启</span>
            </div>
            <div class="flex items-center my1">
              <img src="/img/exit.svg" class="w5 h5 mr2" alt="出口">
              <span>出口 - 开启后抵达即可进入下一关</span>
            </div>
            <div class="flex items-center my1">
              <img src="/img/wood.svg" class="w5 h5 mr2" alt="木柴">
              <span>木柴 - 扩大你的视野范围</span>
            </div>
            <div class="flex items-center my1">
              <img src="/img/gift1.svg" class="w5 h5 mr2" alt="礼物">
              <span>礼物 - 打开会有惊喜！</span>
            </div>
          </div>
          <button class="control-button mt3" @click="showHelp = false">
            关闭
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
:global(:root) {
  --game-max-width: 640px;
  --mobile-padding: 10px;
}

.app-shell {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 10px;
}

.app-card {
  width: 100%;
  max-width: var(--game-max-width);
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
  background: rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 14px 14px 10px;
}

.header-left, .header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mode-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(8px);
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 800;
  font-size: 0.9rem;
}

.mode-button:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: translateY(-1px);
}

.mode-button > div {
  width: 18px;
  height: 18px;
  opacity: 0.9;
}

.app-title {
  flex: 1;
  text-align: center;
  font-size: 1.35rem;
  font-weight: 800;
  background: linear-gradient(to right, #FFD700, #FFA500);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.35));
  border: none;
  background-color: transparent;
  cursor: pointer;
  padding: 6px 8px;
}

.game-content {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 10px;
}

.game-stage {
  width: 100%;
  display: flex;
  justify-content: center;
  position: relative;
}

:global(.game-stage:fullscreen),
:global(.game-stage:-webkit-full-screen) {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 40% 30%, rgba(15, 23, 42, 0.65), rgba(0, 0, 0, 0.85));
}

:global(.game-stage:fullscreen) .game-board,
:global(.game-stage:-webkit-full-screen) .game-board {
  padding: 0;
  align-items: stretch;
  height: 100%;
}

:global(.game-stage:fullscreen) :deep(.flee3d),
:global(.game-stage:-webkit-full-screen) :deep(.flee3d) {
  height: 100%;
}

:global(.game-stage:fullscreen) :deep(.three-root),
:global(.game-stage:-webkit-full-screen) :deep(.three-root) {
  max-width: none;
  width: 100%;
  height: 100%;
  aspect-ratio: auto;
  border-radius: 0;
}

:global(.game-stage:fullscreen) :deep(.three-root canvas),
:global(.game-stage:-webkit-full-screen) :deep(.three-root canvas) {
  width: 100%;
  height: 100%;
}

:global(.game-stage:fullscreen) :deep(.game-board-container canvas),
:global(.game-stage:-webkit-full-screen) :deep(.game-board-container canvas) {
  width: min(100vw, 100vh);
  height: min(100vw, 100vh);
}

.fs-fab {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 20;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
}

.fs-fab:hover {
  background: rgba(255, 255, 255, 0.12);
}

.fs-fab > div {
  width: 18px;
  height: 18px;
  margin: 0 auto;
}

.game-board {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 0 var(--mobile-padding);
}

.objective-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 14px 12px;
}

.objective-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
  font-size: 0.9rem;
}

.objective-pill .arrow {
  opacity: 0.65;
}

.objective-hint {
  font-size: 0.85rem;
  opacity: 0.8;
  white-space: nowrap;
}

.game-info {
  margin: 15px;
  text-align: center;
  padding: 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.game-footer {
  padding: 10px 15px;
}

.level-badge {
  background: linear-gradient(135deg, #7c3aed, #a78bfa);
  color: white;
  font-weight: bold;
  padding: 6px 10px;
  border-radius: 999px;
  min-width: 52px;
  text-align: center;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
}

.difficulty-badge {
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 700;
}

.easy { background-color: #10b981; color: white; }
.medium { background-color: #f59e0b; color: white; }
.hard { background-color: #ef4444; color: white; }

.popup {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
}

.popup-content {
  background-color: var(--bg-color-secondary);
  padding: 20px;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.control-button {
  background-color: #7c3aed;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.control-button:hover {
  background-color: #6d28d9;
}

/* 移动端适配样式 */
@media (max-width: 768px) {
  .app-card {
    border-radius: 8px;
  }

  .app-header {
    padding: 10px 10px 8px;
  }

  .game-board {
    /* 确保在移动设备上canvas居中且不溢出 */
    padding: 0;
    max-width: 100%;
    max-height: 70vh;
    min-height: 60vh !important;
  }

  .game-info {
    font-size: 0.9rem;
    margin: 10px;
    padding: 8px;
  }

  /* 调整弹窗宽度，确保更适合移动设备 */
  .popup-content {
    width: 95%;
    padding: 15px;
  }

  .objective-bar {
    padding: 0 10px 10px;
  }

  .objective-hint {
    display: none;
  }
}
</style>

<style>
/* Fullscreen: keep this unscoped to reliably override child SFC scoped styles. */
.game-stage:fullscreen,
.game-stage:-webkit-full-screen {
  width: 100vw !important;
  height: 100vh !important;
  display: block !important;
  background: radial-gradient(circle at 40% 30%, rgba(15, 23, 42, 0.65), rgba(0, 0, 0, 0.85)) !important;
}

.game-stage:fullscreen .game-board,
.game-stage:-webkit-full-screen .game-board {
  width: 100% !important;
  height: 100% !important;
  padding: 0 !important;
  display: block !important;
}

.game-stage:fullscreen .flee3d,
.game-stage:-webkit-full-screen .flee3d {
  width: 100% !important;
  height: 100% !important;
}

.game-stage:fullscreen .three-root,
.game-stage:-webkit-full-screen .three-root {
  max-width: none !important;
  width: 100% !important;
  height: 100% !important;
  aspect-ratio: auto !important;
  border-radius: 0 !important;
}

.game-stage:fullscreen .game-board-container,
.game-stage:-webkit-full-screen .game-board-container {
  width: 100% !important;
  height: 100% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.game-stage:fullscreen .game-board-container canvas,
.game-stage:-webkit-full-screen .game-board-container canvas {
  width: min(100vw, 100vh) !important;
  height: min(100vw, 100vh) !important;
}
</style>

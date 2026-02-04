<script setup lang="ts">
import {
  downMove,
  exit,
  exitUnlocked,
  gift,
  goldArray,
  hideMask,
  imgLeft,
  imgTop,
  initMask,
  leftMove,
  magnifying,
  n,
  rangeScope,
  resizeBoard,
  rightMove,
  setup,
  start,
  topMove,
  updateMask,
  w,
  win,
} from '../canvas'

// Props to control sound from parent component
const props = defineProps({
  soundEnabled: {
    type: Boolean,
    default: true,
  },
})

const boardLayerEl = ref<HTMLElement | null>(null)
const canvas = setup()
const mask = initMask()
const upgrade = ref(false)
// Monitor remaining gold count
const animate = ref(false)
const steps = ref(0)
const bumping = ref(false)
let resizeObserver: ResizeObserver | null = null

function syncBoardSize() {
  const el = boardLayerEl.value
  if (!el)
    return
  const rect = el.getBoundingClientRect()
  const size = Math.floor(Math.min(rect.width, rect.height))
  if (size > 0)
    resizeBoard(size, { preserve: true })
}

interface LevelRecord {
  time: number
  steps: number
}
const records = useStorage<Record<string, LevelRecord>>('FIND_GOLD_records', {})
const bestForCurrentLevel = computed(() => records.value[String(n.value)])

// Progress calculation for collecting gold
const progress = computed(() => {
  if (!goldArray.value.length)
    return 0
  const total = goldArray.value.length
  const collected = total - goldArray.value.filter(item => item.show).length
  return Math.round((collected / total) * 100)
})

const remainingGold = computed(() => goldArray.value.filter(item => item.show).length)
const totalGold = computed(() => goldArray.value.length)
const isOnExit = computed(() => {
  if (!exit.value)
    return false
  return exit.value.x === imgLeft.value && exit.value.y === imgTop.value
})
const exitAngle = computed(() => {
  if (!exit.value)
    return 0
  const dx = exit.value.x - imgLeft.value
  const dy = exit.value.y - imgTop.value
  return Math.atan2(dy, dx) * 180 / Math.PI + 90
})
const exitDistance = computed(() => {
  if (!exit.value)
    return 0
  const ci = Math.round(imgLeft.value / w.value)
  const cj = Math.round(imgTop.value / w.value)
  return Math.abs(exit.value.i - ci) + Math.abs(exit.value.j - cj)
})

// Keep track of last move time for mobile controls to prevent too fast movements
let lastMoveTime = 0
const moveDelay = 200 // ms between moves

// Handle mask visibility
watch(hideMask, (newV) => {
  mask.style.display = newV ? 'none' : ''
})

// Initialize game board
onMounted(() => {
  if (!boardLayerEl.value)
    return
  boardLayerEl.value.prepend(canvas)
  boardLayerEl.value.appendChild(mask)

  // First sync after DOM settles (incl. fullscreen CSS changes)
  requestAnimationFrame(syncBoardSize)

  resizeObserver?.disconnect()
  resizeObserver = new ResizeObserver(() => syncBoardSize())
  resizeObserver.observe(boardLayerEl.value)
  window.addEventListener('resize', syncBoardSize)
})

// Keyboard controls
window.addEventListener('keydown', keydown)
function keydown(e: KeyboardEvent) {
  if (isInputLocked())
    return

  if (e.keyCode === 40 || e.keyCode === 74 || e.keyCode === 83) {
    if (downMove())
      changeShow()
    else
      bump()
  }
  else if (e.keyCode === 37 || e.keyCode === 72 || e.keyCode === 65) {
    if (leftMove())
      changeShow()
    else
      bump()
  }
  else if (e.keyCode === 38 || e.keyCode === 75 || e.keyCode === 87) {
    if (topMove())
      changeShow()
    else
      bump()
  }
  else if (e.keyCode === 39 || e.keyCode === 76 || e.keyCode === 68) {
    if (rightMove())
      changeShow()
    else
      bump()
  }
}

// Touch controls for mobile
let startX: number | null = null
let startY: number | null = null
window.addEventListener('touchstart', touchstart)
function touchstart(e: TouchEvent) {
  const { clientX, clientY } = e.changedTouches[0]
  startX = clientX
  startY = clientY
}
const onTouchMove = throttle((e) => {
  if (isInputLocked())
    return
  e.preventDefault()
  if (startX === null || startY === null)
    return
  const { clientX, clientY } = e.changedTouches[0]
  if (clientX > startX && rightMove())
    changeShow()

  if (clientX < startX && leftMove())
    changeShow()

  if (clientY > startY && downMove())
    changeShow()

  if (clientY < startY && topMove())
    changeShow()
})
document.body.addEventListener('touchmove', onTouchMove, { passive: false })

// Custom directional controls - added for better mobile experience
function moveDirection(direction: 'up' | 'down' | 'left' | 'right') {
  if (isInputLocked())
    return
  const now = Date.now()
  if (now - lastMoveTime < moveDelay)
    return
  lastMoveTime = now

  let moved = false

  switch (direction) {
    case 'up':
      moved = topMove()
      break
    case 'down':
      moved = downMove()
      break
    case 'left':
      moved = leftMove()
      break
    case 'right':
      moved = rightMove()
      break
  }

  if (moved)
    changeShow()
  else
    bump()
}

// Clean up event listeners
onBeforeUnmount(() => {
  window.removeEventListener('keydown', keydown)
  document.body.removeEventListener('touchmove', onTouchMove)
  window.removeEventListener('touchstart', touchstart)
  window.removeEventListener('resize', syncBoardSize)
  resizeObserver?.disconnect()
  resizeObserver = null
})

// Prevent too rapid movements
function throttle<T extends (...args: any[]) => void>(fn: T) {
  let flag = false
  return (...rest: Parameters<T>) => {
    if (flag)
      return
    flag = true
    fn(...rest)
    setTimeout(() => {
      flag = false
    }, 200)
  }
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

// Handle item collection and interactions
function changeShow() {
  steps.value++
  let flag = true
  goldArray.value = goldArray.value.map((item) => {
    if (item.x === imgLeft.value && item.y === imgTop.value && item.show) {
      flag = false
      eatGold()
      animate.value = true
      item.show = false
      setTimeout(() => {
        animate.value = false
      }, 500)
    }
    return item
  })

  if (totalGold.value && remainingGold.value === 0 && !exitUnlocked.value) {
    exitUnlocked.value = true
    showExitUnlockedMessage()
  }

  magnifying.value = magnifying.value.map((item) => {
    if (item.x === imgLeft.value && item.y === imgTop.value && item.show) {
      flag = false
      fireSound()
      item.show = false
      widen()
    }
    return item
  })
  gift.value = gift.value.map((item) => {
    if (item.x === imgLeft.value && item.y === imgTop.value && item.show) {
      item.show = false
      flag = false
      play()
      item.srcShow = true
      setTimeout(() => {
        item.srcShow = false
        pause()
      }, 3000)
    }
    return item
  })

  if (exitUnlocked.value && isOnExit.value)
    advanceLevel()

  if (flag)
    walkSound()
}

// Time tracking
const now = useNow()
const countDown = computed(() => Math.round((+now.value - start.value) / 1000))

watch(remainingGold, (val) => {
  if (!totalGold.value)
    return
  if (val === 0 && !exitUnlocked.value) {
    exitUnlocked.value = true
    showExitUnlockedMessage()
  }
})

// Level up message with custom formatting
const levelUpMessage = ref('')
const showingLevelUp = ref(false)
function showLevelUpMessage(level: number) {
  const best = records.value[String(level)]
  const bestLine = best ? `\n最佳: ${best.time}秒 / ${best.steps}步` : ''
  levelUpMessage.value = `恭喜通关第${level}关!\n用时: ${countDown.value}秒\n步数: ${steps.value}${bestLine}\n即将进入第${level + 1}关...`
  showingLevelUp.value = true
  setTimeout(() => {
    showingLevelUp.value = false
  }, 3000)
}

const exitUnlockedMessage = ref('')
const showingExitUnlocked = ref(false)
function showExitUnlockedMessage() {
  exitUnlockedMessage.value = '出口已开启！前往绿色出口完成通关'
  showingExitUnlocked.value = true
  setTimeout(() => {
    showingExitUnlocked.value = false
  }, 2000)
}

function advanceLevel() {
  if (win.value)
    return
  win.value = true

  const finishedLevel = n.value
  const key = String(finishedLevel)
  const current = { time: countDown.value, steps: steps.value }
  const prev = records.value[key]
  if (!prev || current.time < prev.time || (current.time === prev.time && current.steps < prev.steps))
    records.value[key] = current

  winSound()
  showLevelUpMessage(finishedLevel)

  n.value++
  steps.value = 0
  upgrade.value = true
  setup()
  initMask()

  setTimeout(() => {
    upgrade.value = false
    win.value = false
  }, 500)
}

// Custom restart confirmation dialog
const showRestartConfirm = ref(false)

// Restart game
function restart() {
  // 不再使用window.confirm，改为显示自定义对话框
  showRestartConfirm.value = true
}

function confirmRestart() {
  n.value = 1
  steps.value = 0
  setup()
  initMask()
  showRestartConfirm.value = false
}

function isInputLocked() {
  return showingLevelUp.value || showRestartConfirm.value
}

function cancelRestart() {
  showRestartConfirm.value = false
}

// Expand vision
function widen() {
  rangeScope.value = rangeScope.value * 2
  updateMask()
}

// Sound management
const audio = document.createElement('audio')
audio.src = '/bgm/bgm.mp3'

const audioWalk = document.createElement('audio')
audioWalk.src = '/bgm/walk.mp3'
audioWalk.muted = !props.soundEnabled

const audioGold = document.createElement('audio')
audioGold.src = '/bgm/gold.mp3'
audioGold.muted = !props.soundEnabled

const audioFire = document.createElement('audio')
audioFire.src = '/bgm/fire.mp3'
audioFire.muted = !props.soundEnabled

const audioWin = document.createElement('audio')
audioWin.src = '/bgm/win.mp3'
audioWin.muted = !props.soundEnabled

// Update audio muted state when soundEnabled prop changes
watch(() => props.soundEnabled, (newValue) => {
  audioWalk.muted = !newValue
  audioGold.muted = !newValue
  audioFire.muted = !newValue
  audioWin.muted = !newValue
  audio.muted = !newValue
})

function play() {
  if (!props.soundEnabled)
    return
  audio.load()
  audio.play()
}

function pause() {
  audio.pause()
}

function walkSound() {
  if (!props.soundEnabled)
    return
  audioWalk.load()
  audioWalk.play()
}

function eatGold() {
  if (!props.soundEnabled)
    return
  audioGold.load()
  audioGold.play()
}

function fireSound() {
  if (!props.soundEnabled)
    return
  audioFire.load()
  audioFire.play()
}

function winSound() {
  if (!props.soundEnabled)
    return
  audioWin.load()
  audioWin.play()
}
</script>

<template>
  <div class="flee-container">
    <!-- Game stats bar integrated into a more compact design -->
    <div class="compact-stats">
      <div class="stat-item" title="重新开始游戏" @click="restart">
        <img w-6 src="/img/reset.svg" alt="reset" class="icon-button">
      </div>
      <div
        class="stat-item"
        :title="bestForCurrentLevel ? `本关最佳：${bestForCurrentLevel.time}秒 / ${bestForCurrentLevel.steps}步` : '计时'"
      >
        <img w-6 src="/img/clock.svg" alt="clock">
        <span class="stat-value">{{ countDown }}秒</span>
      </div>
      <div class="stat-item">
        <img src="/img/gold.svg" w-6 class="hud-gold" :class="[animate && 'win-animation']" alt="gold">
        <span class="stat-value">{{ remainingGold }}</span>
        <span class="stat-sub">/ {{ totalGold }}</span>
      </div>
      <div class="stat-item" title="步数">
        <div i-carbon-run class="w-5 h-5 opacity-80" />
        <span class="stat-value">{{ steps }}</span>
      </div>
      <div class="stat-item" :title="exitUnlocked ? '出口已开启' : '收集所有金币以开启出口'">
        <div :class="exitUnlocked ? 'i-carbon-unlocked' : 'i-carbon-locked'" class="w-5 h-5 opacity-80" />
        <span class="stat-mini">{{ exitUnlocked ? '出口' : '出口' }}</span>
      </div>
      <div v-if="exitUnlocked && exit" class="stat-item compass" :title="`出口方向（约${exitDistance}步）`">
        <div i-carbon-arrow-up class="compass-arrow w-5 h-5" :style="{ transform: `rotate(${exitAngle}deg)` }" />
      </div>
    </div>
    <!-- Progress bar for level completion -->
    <div class="progress-container">
      <div class="progress-bar" :style="{ width: `${progress}%` }" />
    </div>
    <!-- Game board -->
    <div relative overflow-hidden rounded-lg class="game-board-container" :class="{ bump: bumping }">
      <div ref="boardLayerEl" class="board-layer">
        <!-- Player character -->
        <img
          absolute
          src="/img/fire.svg"
          :style="{ width: `${w}px`, left: `${imgLeft}px`, top: `${imgTop}px` }"
          class="player"
          alt="fire"
        >
        <!-- Gold items -->
        <template v-for="item in goldArray" :key="`${item.i}-${item.j}`">
          <img
            v-if="item.show"
            src="/img/gold.svg"
            :style="{ width: `${w * 0.75}px`, left: `${item.x + 3}px`, top: `${item.y + 3}px` }"
            absolute
            class="gold-item"
            alt="gold"
          >
        </template>
        <!-- Exit (unlock after collecting all gold) -->
        <img
          v-if="exit"
          src="/img/exit.svg"
          :style="{ width: `${w}px`, left: `${exit.x}px`, top: `${exit.y}px` }"
          absolute
          class="exit-item"
          :class="[exitUnlocked ? 'exit-open' : 'exit-locked', isOnExit && exitUnlocked && 'exit-reached']"
          alt="exit"
          :title="exitUnlocked ? '出口已开启' : '收集所有金币以开启出口'"
        >
        <!-- Wood items -->
        <template v-for="item in magnifying" :key="`${item.i}-${item.j}`">
          <img
            v-if="item.show" :style="{ width: `${w}px`, left: `${item.x}px`, top: `${item.y}px` }"
            absolute src="/img/wood.svg" class="wood-item" alt="wood"
          >
        </template>
        <!-- Gift items -->
        <template v-for="item in gift" :key="`${item.i}-${item.j}`">
          <img
            v-if="item.show" :src="item.url" :style="{ width: `${w}px`, left: `${item.x}px`, top: `${item.y}px` }"
            absolute class="gift-item" alt="gift"
          >
          <img
            v-if="item.srcShow" fixed top-0 bottom-0 left-0 right-0 z-99 h-full md:min-w-150 :src="item.src" ma
            alt="pic"
          >
        </template>
      </div>
    </div>
    <!-- Mobile controls -->
    <div class="mobile-controls show-on-mobile">
      <button class="direction-button up" @click="moveDirection('up')">
        <div i-carbon-arrow-up />
      </button>
      <button class="direction-button left" @click="moveDirection('left')">
        <div i-carbon-arrow-left />
      </button>
      <button class="direction-button center" />
      <button class="direction-button right" @click="moveDirection('right')">
        <div i-carbon-arrow-right />
      </button>
      <button class="direction-button down" @click="moveDirection('down')">
        <div i-carbon-arrow-down />
      </button>
    </div>
    <!-- Level up popup -->
    <div v-if="showingLevelUp" class="popup">
      <div class="popup-content">
        <h2 class="text-xl font-bold mb3 text-yellow-400">
          恭喜过关!
        </h2>
        <p class="text-lg whitespace-pre-line">
          {{ levelUpMessage }}
        </p>
      </div>
    </div>
    <!-- Exit unlocked toast -->
    <div v-if="showingExitUnlocked" class="popup toast">
      <div class="popup-content toast-content">
        <p class="text-sm whitespace-pre-line">
          {{ exitUnlockedMessage }}
        </p>
      </div>
    </div>
    <!-- Restart confirmation dialog -->
    <div v-if="showRestartConfirm" class="popup">
      <div class="popup-content">
        <h2 class="text-xl font-bold mb3 text-yellow-400">
          确认重新开始游戏?
        </h2>
        <div class="flex justify-around mt4">
          <button class="btn btn-confirm" @click="confirmRestart">
            确认
          </button>
          <button class="btn btn-cancel" @click="cancelRestart">
            取消
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .flee-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .compact-stats {
    display: flex;
    justify-content: space-between;
    padding: 5px 10px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    margin-bottom: 5px;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(6px);
  }

  .stat-value {
    font-weight: 700;
    font-size: 1.05rem;
    color: #FFD700;
    text-shadow: 0 0 8px rgba(255, 215, 0, 0.25);
  }

  .stat-sub {
    font-size: 0.8rem;
    opacity: 0.7;
  }

  .stat-mini {
    font-size: 0.85rem;
    font-weight: 600;
    opacity: 0.85;
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

  .compass {
    padding: 6px 8px;
  }

  .compass-arrow {
    transition: transform 0.12s linear;
    filter: drop-shadow(0 0 10px rgba(34, 197, 94, 0.35));
  }

  .exit-item {
    filter: drop-shadow(0 0 8px rgba(34, 197, 94, 0.35));
    transition: transform 0.15s ease, filter 0.2s ease, opacity 0.2s ease;
    opacity: 0.9;
  }

  .exit-locked {
    filter: grayscale(1) brightness(0.7);
    opacity: 0.55;
  }

  .exit-open {
    animation: exitPulse 1.6s ease-in-out infinite;
  }

  .exit-reached {
    transform: scale(1.08);
    filter: drop-shadow(0 0 14px rgba(34, 197, 94, 0.9));
  }

  @keyframes exitPulse {
    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 10px rgba(34, 197, 94, 0.45)); }
    50% { transform: scale(1.04); filter: drop-shadow(0 0 16px rgba(34, 197, 94, 0.75)); }
  }

  .game-board-container .player {
    filter: drop-shadow(0 10px 10px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 10px rgba(255, 140, 0, 0.2));
    transition: transform 120ms ease;
    transform-origin: 50% 70%;
  }

  .game-board-container .gold-item {
    filter: drop-shadow(0 10px 10px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 18px rgba(255, 215, 0, 0.25));
    animation: floatGold 1.9s ease-in-out infinite;
  }

  .hud-gold {
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.45));
  }

  @keyframes floatGold {
    0%, 100% { transform: translateY(0) rotate(-2deg); }
    50% { transform: translateY(-2px) rotate(2deg); }
  }

  .game-board-container {
    flex: 1;
    min-height: 0;
    position: relative;
    width: 100%;
  }

  .board-layer {
    position: relative;
    display: inline-block;
  }

  /* 添加移动端专用样式 */
  @media (max-width: 768px) {
    .game-board-container {
      width: 90%;
      margin: 0 auto;
      max-width: 360px;
      max-height: 360px;
    }

    .compact-stats {
      padding: 3px 8px;
    }

    .stat-item {
      padding: 4px 8px;
    }

    .stat-value {
      font-size: 1rem;
    }
  }

  @media (max-height: 700px) {
    .compact-stats {
      padding: 3px 8px;
    }

    .stat-item {
      padding: 4px 8px;
    }

    .stat-value {
      font-size: 1rem;
    }
  }

  /* 自定义对话框和按钮样式 */
  .popup {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    backdrop-filter: blur(5px);
  }

  .toast {
    align-items: flex-start;
    justify-content: center;
    padding-top: 14px;
    background: rgba(0, 0, 0, 0.25);
    backdrop-filter: none;
  }

  .toast-content {
    max-width: 520px;
    padding: 10px 14px;
    border-radius: 999px;
    background: rgba(20, 20, 20, 0.85);
    border: 1px solid rgba(34, 197, 94, 0.35);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
  }

  .popup-content {
    background: rgba(30, 30, 30, 0.9);
    border-radius: 12px;
    padding: 20px;
    text-align: center;
    max-width: 320px;
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
    border: 1px solid rgba(255, 215, 0, 0.2);
    color: white;
  }

  .btn {
    padding: 8px 20px;
    border-radius: 8px;
    border: none;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
    color: white;
    font-size: 1rem;
  }

  .btn-confirm {
    background: linear-gradient(to right, #FFD700, #FFA500);
    box-shadow: 0 2px 5px rgba(255, 165, 0, 0.4);
  }

  .btn-confirm:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(255, 165, 0, 0.6);
  }

  .btn-cancel {
    background: rgba(255, 255, 255, 0.15);
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
  }

  .btn-cancel:hover {
    background: rgba(255, 255, 255, 0.25);
    transform: translateY(-2px);
  }
</style>

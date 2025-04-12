<script setup lang="ts">
import {
  downMove,
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

const FleeEl = ref(null)
const canvas = setup()
const mask = initMask()
const upgrade = ref(false)
// Monitor remaining gold count
const animate = ref(false)

// Progress calculation for collecting gold
const progress = computed(() => {
  if (!goldArray.value.length)
    return 0
  const total = goldArray.value.length
  const collected = total - goldArray.value.filter(item => item.show).length
  return Math.round((collected / total) * 100)
})

// Keep track of last move time for mobile controls to prevent too fast movements
let lastMoveTime = 0
const moveDelay = 200 // ms between moves

// Handle mask visibility
watch(hideMask, (newV) => {
  if (newV)
    mask.setAttribute('class', 'hide')
  else mask.removeAttribute('class', 'hide')
})

// Initialize game board
onMounted(() => {
  FleeEl.value.appendChild(canvas)
  FleeEl.value.appendChild(mask)
})

// Keyboard controls
window.addEventListener('keydown', keydown)
function keydown(e) {
  if ((e.keyCode === 40 || e.keyCode === 74 || e.keyCode === 83) && downMove()) {
    // down
    changeShow()
  }
  else if ((e.keyCode === 37 || e.keyCode === 72 || e.keyCode === 65) && leftMove()) {
    // left
    changeShow()
  }
  else if ((e.keyCode === 38 || e.keyCode === 75 || e.keyCode === 87) && topMove()) {
    // up
    changeShow()
  }
  else if ((e.keyCode === 39 || e.keyCode === 76 || e.keyCode === 68) && rightMove()) {
    // right
    changeShow()
  }
}

// Touch controls for mobile
let startX = null
let startY = null
window.addEventListener('touchstart', touchstart)
function touchstart(e) {
  const { clientX, clientY } = e.changedTouches[0]
  startX = clientX
  startY = clientY
}
document.body.addEventListener('touchmove', touchmove(), { passive: false })

function touchmove() {
  const fn = throttle((e) => {
    e.preventDefault()
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
  return fn
}

// Custom directional controls - added for better mobile experience
function moveDirection(direction) {
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
}

// Clean up event listeners
onBeforeUnmount(() => {
  window.removeEventListener('keydown', keydown)
  document.body.removeEventListener('touchmove', touchmove())
  window.removeEventListener('touchstart', touchstart)
})

// Prevent too rapid movements
function throttle(fn) {
  let flag = false
  return function (...rest) {
    if (flag)
      return
    flag = true
    fn.apply(this, rest)
    setTimeout(() => {
      flag = false
    }, 200)
  }
}

// Handle item collection and interactions
function changeShow() {
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
  if (flag)
    walkSound()
}

// Time tracking
const now = useNow()
const countDown = computed(() => Math.round((+now.value - start.value) / 1000))

const number = computed(() => {
  if (!goldArray.value.length)
    return
  const result = goldArray.value.filter(item => item.show).length
  if (result === 0 && !win.value) {
    win.value = true
    n.value++
    winSound()
    showLevelUpMessage()
    // eslint-disable-next-line vue/no-side-effects-in-computed-properties
    upgrade.value = true
    setup()
    initMask()
    // eslint-disable-next-line vue/no-async-in-computed-properties
    setTimeout(() => {
      upgrade.value = false
    }, 500)
  }
  return result
})

// Level up message with custom formatting
const levelUpMessage = ref('')
const showingLevelUp = ref(false)
function showLevelUpMessage() {
  levelUpMessage.value = `恭喜! 你完成了第${n.value - 1}关!\n用时: ${countDown.value}秒\n即将进入第${n.value}关...`
  showingLevelUp.value = true
  setTimeout(() => {
    showingLevelUp.value = false
  }, 3000)
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
  setup()
  initMask()
  showRestartConfirm.value = false
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
      <div class="stat-item">
        <img w-6 src="/img/clock.svg" alt="clock">
        <span class="stat-value">{{ countDown }}秒</span>
      </div>
      <div class="stat-item">
        <img src="/img/gold.svg" w-6 class="gold-item" :class="[animate && 'win-animation']" alt="gold">
        <span class="stat-value">{{ number }}</span>
      </div>
    </div>
    <!-- Progress bar for level completion -->
    <div class="progress-container">
      <div class="progress-bar" :style="{ width: `${progress}%` }" />
    </div>
    <!-- Game board -->
    <div ref="FleeEl" relative overflow-hidden rounded-lg class="game-board-container">
      <!-- Player character -->
      <img
        absolute src="/img/fire.svg" :style="{ width: `${w}px`, left: `${imgLeft}px`, top: `${imgTop}px` }"
        class="player" alt="fire"
      >
      <!-- Gold items -->
      <template v-for="(item, index) in goldArray" :key="index">
        <img
          v-if="item.show" src="/img/gold.svg"
          :style="{ width: `${w * 0.75}px`, left: `${item.x + 3}px`, top: `${item.y + 3}px` }" absolute class="gold-item"
          alt="gold"
        >
      </template>
      <!-- Wood items -->
      <template v-for="(item, index) in magnifying" :key="index">
        <img
          v-if="item.show" :style="{ width: `${w}px`, left: `${item.x}px`, top: `${item.y}px` }"
          absolute src="/img/wood.svg" class="wood-item" alt="wood"
        >
      </template>
      <!-- Gift items -->
      <template v-for="(item, index) in gift" :key="index">
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

<style>
  .hide {
    display: none;
  }

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

  .game-board-container {
    flex: 1;
    min-height: 0;
    position: relative;
    width: 100%;
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

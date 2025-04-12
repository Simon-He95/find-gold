<script setup lang="ts">
import { isDark } from '~/composables'
import { n } from './canvas'

const content = ref('欢迎来到寻找金币游戏')
const contentList = [
  '欢迎来到寻找金币游戏！使用方向键或WASD移动',
  '收集所有金币以通关升级，寻找木柴扩大视野',
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

function styleFn(i) {
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
</script>

<template>
  <div class="game-layout">
    <main class="game-container">
      <!-- Integrated header with title and level -->
      <div class="game-header">
        <div class="integrated-header">
          <div class="header-left">
            <div class="level-badge">
              {{ n }}
            </div>
            <div class="difficulty-badge" :class="difficultyText.class">
              {{ difficultyText.text }}
            </div>
          </div>

          <div class="compact-game-title" text-center>
            {{ Title }}
          </div>

          <div class="header-right">
            <button class="icon-button" title="声音开关" @click="toggleSound">
              <div :class="soundEnabled ? 'i-carbon-volume-up' : 'i-carbon-volume-mute'" />
            </button>
            <button class="icon-button" title="游戏帮助" @click="toggleHelp">
              <div i-carbon-help />
            </button>
          </div>
        </div>
      </div>

      <!-- Game content area -->
      <div class="game-content">
        <!-- Game board -->
        <Flee :sound-enabled="soundEnabled" class="game-board" />

        <!-- Mobile controls (shown only on mobile) -->
        <div class="mobile-controls show-on-mobile" />

        <!-- Game info text (hidden on small screens) -->
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

      <!-- Footer with game controls and social links -->
      <div class="game-footer">
        <Footer />
      </div>

      <!-- Help modal -->
      <div v-if="showHelp" class="popup" @click="showHelp = false">
        <div class="popup-content" @click.stop>
          <h2 class="text-xl font-bold mb3">
            游戏帮助
          </h2>
          <div class="text-left text-sm">
            <p class="mb2">
              <b>游戏目标：</b>找到迷宫中所有金币以通关升级
            </p>
            <p class="mb2">
              <b>控制方式：</b>使用方向键或WASD键移动角色
            </p>
            <p class="mb2">
              <b>道具说明：</b>
            </p>
            <div class="flex items-center my1">
              <img src="/img/gold.svg" class="w5 h5 mr2" alt="金币">
              <span>金币 - 收集所有金币来通关</span>
            </div>
            <div class="flex items-center my1">
              <img src="/img/wood.svg" class="w5 h5 mr2" alt="木柴">
              <span>木柴 - 扩大你的视野范围</span>
            </div>
            <div class="flex items-center my1">
              <img src="/img/gift1-pixel.svg" class="w5 h5 mr2" alt="礼物">
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

<style>
:root {
  --game-max-width: 640px;
  --mobile-padding: 10px;
}

.game-layout {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 10px;
  background-color: var(--bg-color);
}

.game-container {
  width: 100%;
  max-width: var(--game-max-width);
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  background-color: var(--bg-color-secondary);
}

.game-header {
  padding: 15px;
}

.integrated-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.header-left, .header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.compact-game-title {
  font-size: 1.5rem;
  font-weight: bold;
  background: linear-gradient(to right, #FFD700, #FFA500);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.5));
  flex: 1;
  text-align: center;
}

.game-content {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.game-board {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 0 var(--mobile-padding);
}

.game-info {
  margin: 15px;
  text-align: center;
  padding: 10px;
  border-radius: 8px;
  background-color: rgba(0, 0, 0, 0.1);
}

.game-footer {
  padding: 10px 15px;
}

.level-badge {
  background-color: #7c3aed;
  color: white;
  font-weight: bold;
  padding: 4px 8px;
  border-radius: 8px;
  min-width: 28px;
  text-align: center;
}

.difficulty-badge {
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 0.8rem;
}

.easy { background-color: #10b981; color: white; }
.medium { background-color: #f59e0b; color: white; }
.hard { background-color: #ef4444; color: white; }

.icon-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.1);
  transition: all 0.2s;
}

.icon-button:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

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
  .game-container {
    border-radius: 8px;
  }

  .game-header {
    padding: 10px;
  }

  .compact-game-title {
    font-size: 1.2rem;
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

  /* 在小屏幕上减小图标尺寸 */
  .icon-button {
    padding: 4px;
  }

  /* 调整弹窗宽度，确保更适合移动设备 */
  .popup-content {
    width: 95%;
    padding: 15px;
  }
}
</style>

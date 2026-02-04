<script setup lang="ts">
import { hideMask } from '../canvas'

const viewMode = useStorage<'2d' | '3d'>('FIND_GOLD_view_mode', '2d')
const is3D = computed(() => viewMode.value === '3d')
const godView = useStorage<boolean>('FIND_GOLD_god_view', false)

// Social links for the game
const socialLinks = [
  {
    name: 'GitHub',
    icon: 'i-carbon-logo-github',
    url: 'https://github.com/Simon-He95/find-gold',
    title: '访问GitHub源码',
  },
  {
    name: '收藏',
    icon: 'i-carbon-star',
    url: 'https://github.com/Simon-He95/find-gold/stargazers',
    title: '收藏项目',
  },
]

function toggleCheatMode() {
  if (is3D.value)
    godView.value = !godView.value
  else
    hideMask.value = !hideMask.value
}
</script>

<template>
  <div class="footer-container">
    <div class="footer-content" flex justify-between items-center>
      <div class="game-mode-toggle">
        <button
          class="icon-button"
          :title="is3D ? (godView ? '关闭上帝视角 (M)' : '开启上帝视角 (M)') : (hideMask ? '关闭作弊模式' : '开启作弊模式')"
          @click="toggleCheatMode"
        >
          <template v-if="is3D">
            <div :class="godView ? 'i-carbon-map' : 'i-carbon-location'" />
          </template>
          <template v-else>
            <div v-if="hideMask" i-carbon-sun />
            <div v-else i-carbon-moon />
          </template>
        </button>
        <span class="mode-label hide-on-mobile text-xs">
          <template v-if="is3D">
            {{ godView ? '上帝视角' : '第一人称' }}
          </template>
          <template v-else>
            {{ hideMask ? '作弊模式' : '正常模式' }}
          </template>
        </span>
      </div>

      <div class="social-links" flex="~ gap-2" items-center>
        <a
          v-for="link in socialLinks"
          :key="link.name"
          class="icon-button mini"
          :class="link.icon"
          rel="noreferrer"
          :href="link.url"
          target="_blank"
          :title="link.title"
        />
      </div>
    </div>

    <div class="copyright text-center text-xs opacity-70 hide-on-small">
      <p>© 2025 寻找金币 - Simon-He95</p>
    </div>
  </div>
</template>

<style scoped>
.footer-container {
  padding: 5px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(5px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: 5px;
}

.footer-content {
  margin: 0 auto;
}

.mode-label {
  margin-left: 5px;
}

.mini {
  padding: 6px;
  font-size: 0.9em;
}

@media (max-height: 700px) {
  .hide-on-small {
    display: none;
  }
}
</style>

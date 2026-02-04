<script setup lang="ts">
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
</script>

<template>
  <div class="footer-container">
    <div class="footer-content" flex justify-between items-center>
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

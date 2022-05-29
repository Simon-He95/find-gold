<script setup lang="ts">
import { isDark } from "~/composables";
import { hideMask } from "../canvas";
isDark.value = true;
</script>

<template>
  <nav text-2xl mt-6 inline-flex gap-10>
    <button class="icon-btn !outline-none" @click="hideMask = !hideMask">
      <div v-if="hideMask" i-carbon-moon />
      <div v-else i-carbon-sun />
    </button>

    <a
      class="icon-btn"
      i-carbon-logo-github
      rel="noreferrer"
      href="https://github.com/Simon-He95/find-gold"
      target="_blank"
      title="GitHub"
    />
  </nav>
</template>

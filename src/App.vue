<script setup lang="ts">
import { n } from "./canvas";
</script>

<template>
  <main font-sans p=" y-10" text="center gray-700 dark:gray-200" ma>
    <vivid-typing content="Find Gold" text-3xl m-b-2></vivid-typing>
    <div border-1 w-50 ma border-rd-1 border-dashed m-y-5>
      <vivid-typing
        :scrollY="true"
        :content="'当前关卡 level:' + n"
        text-sm
        h-5
      ></vivid-typing>
    </div>
    <Flee></Flee>
    <Footer />
  </main>
</template>

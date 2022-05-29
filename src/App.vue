<script setup lang="ts">
import { n } from "./canvas";
const content = ref("你好鸭~");
const contentList = [
  "我是Simon，欢迎fork提pr",
  "我是Simon，随手点个star噢~",
  "我是Simon，欢迎贡献一些有趣的idea~",
  "我是Simon，这是我写的小组件vivid-typing",
  "我是Simon，喜欢的话可以从npm上下载噢~",
  "我是Simon，欢迎提供您的宝贵意见~",
];
const index = ref(0);
function finish() {
  if (index.value < contentList.length - 1) index.value++;
  else index.value = 0;
  setTimeout(() => {
    content.value = contentList[index.value];
  }, 500);
}
</script>

<template>
  <main font-sans p=" y-10" text="center " ma>
    <vivid-typing content="Find Gold" text-3xl m-b-2></vivid-typing>
    <div border-2 w-50 ma border-rd-1 border-dashed m-y-5>
      <vivid-typing
        :scrollY="true"
        :content="'当前关卡 level:' + n"
        text-sm
        h-5
      ></vivid-typing>
    </div>
    <Flee></Flee>
    <Footer />
    <vivid-typing
      :content="content"
      :speed="1"
      m-t-2
      style="box-shadow: 0 0 10px rgba(255, 255, 255, 0.5)"
      :finish="finish"
    ></vivid-typing>
  </main>
</template>

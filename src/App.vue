<script setup lang="ts">
import { n } from './canvas'
const content = ref('你好鸭~')
const contentList = [
  '我是Simon，欢迎fork提pr',
  '我是Simon，随手点个star噢~',
  '我是Simon，欢迎贡献一些有趣的idea~',
  '我是Simon，这是我写的小组件vivid-typing',
  '我是Simon，喜欢的话可以从npm上下载噢~',
  '我是Simon，欢迎提供您的宝贵意见~',
]
const index = ref(0)
function finish() {
  if (index.value < contentList.length - 1) index.value++
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

const Title = ref('Find Gold')
function finishTitle() {
  if (Title.value.length > 4)
    Title.value = 'Find'
  else
    Title.value = 'Find Gold'
}
</script>

<template>
  <main font-sans p=" y-10" text="center " ma>
    <vivid-typing
      :content="Title"
      text-3xl
      m-b-2
      :interval="200"
      :stable="true"
      h-10
      :finish="finishTitle"
    />
    <div border-2 w-50 ma border-rd-1 border-dashed m-y-5 overflow-hidden>
      <vivid-typing
        :scroll-y="true"
        :content="'当前关卡 level:' + n"
        :speed="10"
        text-sm
        h-5
      />
    </div>
    <Flee />
    <Footer />
    <vivid-typing
      :content="content"
      :speed="1"
      m-t-2
      style="box-shadow: 0 0 10px rgba(255, 255, 255, 0.5)"
      :spilt-style="styleFn"
      spilt-tag="span"
      :finish="finish"
    />
  </main>
</template>

<script setup lang="ts">
import {
  setup,
  rightMove,
  leftMove,
  topMove,
  downMove,
  imgLeft,
  imgTop,
  initMask,
  getGold,
  update,
  w,
} from "../canvas";
const FleeEl = ref(null);
let canvas = setup();
const mask = initMask();
const goldArray = ref([]);

onMounted(() => {
  FleeEl.value.appendChild(canvas);
  FleeEl.value.appendChild(mask);
  goldArray.value = getGold();
});
window.addEventListener("keydown", (e) => {
  if (e.keyCode === 40 && downMove()) {
    // down
    changeShow();
  } else if (e.keyCode === 37 && leftMove()) {
    // left
    changeShow();
  } else if (e.keyCode === 38 && topMove()) {
    // up
    changeShow();
  } else if (e.keyCode === 39 && rightMove()) {
    // right
    changeShow();
  }
});
let startX = null;
let startY = null;
window.addEventListener("touchstart", (e) => {
  console.log("22", e);
  const { clientX, clientY } = e.changedTouches[0];
  startX = clientX;
  startY = clientY;
});
window.addEventListener(
  "touchmove",
  throttle((e) => {
    e.preventDefault();
    const { clientX, clientY } = e.changedTouches[0];
    let timer = setTimeout(() => {});
    console.log(clientX, clientY, startX, startY);
    if (clientX > startX && rightMove()) {
      changeShow();
    }
    if (clientX < startX && leftMove()) {
      changeShow();
    }
    if (clientY > startY && downMove()) {
      changeShow();
    }
    if (clientY < startY && topMove()) {
      changeShow();
    }
  })
);

function throttle(fn) {
  let flag = false;
  return function () {
    if (flag) return;
    flag = true;
    fn.apply(this, arguments);
    setTimeout(() => {
      flag = false;
    }, 200);
  };
}

function changeShow() {
  goldArray.value = goldArray.value.map((item) => {
    if (item.x === imgLeft.value && item.y === imgTop.value) item.show = false;
    return item;
  });
}
const number = computed(() => {
  if (!goldArray.value.length) return;
  const result = goldArray.value.filter((item) => item.show).length;
  if (result === 0) {
    alert("你找到了所有的金币!");
  }
  return result;
});
</script>

<template>
  <div flex="~" justify-center items-end m-b-5>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
      preserveAspectRatio="xMidYMid meet"
      viewBox="0 0 24 24"
      w-8
    >
      <path
        fill="gold"
        d="m1 22l1.5-5h7l1.5 5H1m12 0l1.5-5h7l1.5 5H13m-7-7l1.5-5h7l1.5 5H6m17-8.95l-3.86 1.09L18.05 11l-1.09-3.86l-3.86-1.09l3.86-1.09l1.09-3.86l1.09 3.86L23 6.05Z"
      /></svg
    ><span text-xl m-l-2>: {{ number }}</span>
  </div>

  <div ref="FleeEl" relative overflow="hidden">
    <svg
      absolute
      :style="{ width: w + 'px', left: imgLeft + 'px', top: imgTop + 'px' }"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
      color-red
      preserveAspectRatio="xMidYMid meet"
      viewBox="0 0 24 24"
    >
      <path
        fill="currentColor"
        d="M8.6 9.6c.4.6.9 1.1 1.6 1.4h4c.3-.1.5-.3.7-.5c1-1 1.4-2.5.9-3.8l-.1-.2c-.1-.3-.3-.5-.5-.7c-.1-.2-.3-.3-.4-.5c-.4-.3-.8-.6-1.2-1c-.9-.9-1-2.3-.5-3.3c-.5.1-1 .4-1.4.8C10.2 3 9.6 5.1 10.3 7v.2c0 .1-.1.2-.2.3c-.1.1-.3 0-.4-.1l-.1-.1c-.6-.8-.7-2-.3-3c-.9.8-1.4 2.1-1.3 3.4c0 .3.1.6.2.9c0 .3.2.7.4 1m3.7-1.5c.1-.5-.1-.9-.2-1.3s-.1-.8.1-1.2l.3.6c.4.6 1.1.8 1.3 1.6v.3c0 .5-.2 1-.5 1.3c-.2.1-.4.3-.6.3c-.6.2-1.3-.1-1.7-.5c.8 0 1.2-.6 1.3-1.1M15 12v2h-1l-1 8h-2l-1-8H9v-2h6Z"
      />
    </svg>
    <template v-for="(item, index) in goldArray" :key="index">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        role="img"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 24 24"
        v-if="item.show"
        :style="{ width: w + 'px', left: item.x + 'px', top: item.y + 'px' }"
        absolute
      >
        <path
          fill="gold"
          d="m1 22l1.5-5h7l1.5 5H1m12 0l1.5-5h7l1.5 5H13m-7-7l1.5-5h7l1.5 5H6m17-8.95l-3.86 1.09L18.05 11l-1.09-3.86l-3.86-1.09l3.86-1.09l1.09-3.86l1.09 3.86L23 6.05Z"
        />
      </svg>
    </template>
  </div>
</template>

<style scoped>
.mask {
  -webkit-mask-image: url("/file.png");
  -webkit-mask-repeat: no-repeat; /* 表示不重复 */
  border: 300px solid rgba(0, 0, 0, 0.7);
}
</style>

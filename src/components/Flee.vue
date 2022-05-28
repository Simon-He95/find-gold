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
  w,
  goldArray,
  start,
  win,
  n,
  hideMask,
} from "../canvas";
const FleeEl = ref(null);
let canvas = setup();
const mask = initMask();

const animate = $ref(false);
watch(hideMask, (newV) => {
  if (newV) mask.setAttribute("class", "hide");
  else mask.removeAttribute("class", "hide");
});
onMounted(() => {
  FleeEl.value.appendChild(canvas);
  FleeEl.value.appendChild(mask);
});
window.addEventListener("keydown", keydown);
function keydown(e) {
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
}
let startX = null;
let startY = null;
window.addEventListener("touchstart", touchstart);
function touchstart(e) {
  const { clientX, clientY } = e.changedTouches[0];
  startX = clientX;
  startY = clientY;
}
document.body.addEventListener("touchmove", touchmove(), { passive: false });

function touchmove() {
  const fn = throttle((e) => {
    e.preventDefault();
    const { clientX, clientY } = e.changedTouches[0];
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
  });
  return fn;
}

onBeforeUnmount(() => {
  window.removeEventListener("keydown", keydown);
  document.body.removeEventListener("touchmove", touchmove());
  window.removeEventListener("touchstart", touchstart);
});

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
    if (item.x === imgLeft.value && item.y === imgTop.value) {
      animate = true;
      item.show = false;
      setTimeout(() => {
        animate = false;
      }, 500);
    }
    return item;
  });
}

const now = $(useNow());

const countDown = $computed(() => Math.round((+now - start.value) / 1000));

const number = computed(() => {
  if (!goldArray.value.length) return;
  const result = goldArray.value.filter((item) => item.show).length;
  if (result === 0 && !win.value) {
    win.value = true;
    n.value++;
    alert(`你找到了所有的金币!用时间${countDown}秒, Level Up !!!`);
    setup();
    initMask();
  }
  return result;
});

function restart() {
  const isTrue = window.confirm("是否要重新从level 1 开始游戏 ?");
  if (!isTrue) {
    return;
  }
  n.value = 1;
  setup();
  initMask();
}
</script>

<template>
  <div flex="~ gap-5" justify-center items-end m-b-5 overflow-hidden max-w-150 ma>
    <div flex="~ gap-2" items-center="" justify="center" m-t-5="">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        role="img"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 32 32"
        w-5
        @click="restart"
      >
        <path
          fill="currentColor"
          d="M26 18A10 10 0 1 1 16 8h6.182l-3.584 3.585L20 13l6-6l-6-6l-1.402 1.414L22.185 6H16a12 12 0 1 0 12 12Z"
        />
      </svg>
      <div i-carbon-timer=""></div>
      {{ countDown }}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        role="img"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 24 24"
        w-5
        :class="animate && 'animate-heart-beat'"
      >
        <path
          fill="gold"
          d="m1 22l1.5-5h7l1.5 5H1m12 0l1.5-5h7l1.5 5H13m-7-7l1.5-5h7l1.5 5H6m17-8.95l-3.86 1.09L18.05 11l-1.09-3.86l-3.86-1.09l3.86-1.09l1.09-3.86l1.09 3.86L23 6.05Z"
        />
      </svg>
      {{ number }}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        role="img"
        w-5
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 32 32"
      >
        <path
          fill="currentColor"
          d="M21 24H11a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2zm0 4H11v-2h10zm7.707-13.707l-12-12a1 1 0 0 0-1.414 0l-12 12A1 1 0 0 0 4 16h5v4a2.002 2.002 0 0 0 2 2h10a2.003 2.003 0 0 0 2-2v-4h5a1 1 0 0 0 .707-1.707zM21 14v6H11v-6H6.414L16 4.414L25.586 14z"
        />
      </svg>
      {{ n }}
    </div>
  </div>

  <div ref="FleeEl" relative overflow="hidden" max-w-150 ma>
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
        animate-zoom-in
        animate-duration-700
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

<style>
.hide {
  display: none;
}
</style>

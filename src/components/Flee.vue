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
  rangeScope,
  magnifying,
  updateMask,
  gift,
} from "../canvas";
const FleeEl = ref(null);
let canvas = setup();
const mask = initMask();
const upgrade = ref(false);

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
  if ((e.keyCode === 40 || e.keyCode === 74 || e.keyCode === 83) && downMove()) {
    // down
    changeShow();
  } else if ((e.keyCode === 37 || e.keyCode === 72 || e.keyCode === 65) && leftMove()) {
    // left
    changeShow();
  } else if ((e.keyCode === 38 || e.keyCode === 75 || e.keyCode === 87) && topMove()) {
    // up
    changeShow();
  } else if ((e.keyCode === 39 || e.keyCode === 76 || e.keyCode === 68) && rightMove()) {
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
  let flag = true;
  goldArray.value = goldArray.value.map((item) => {
    if (item.x === imgLeft.value && item.y === imgTop.value && item.show) {
      flag = false;
      eatGold();
      animate = true;
      item.show = false;
      setTimeout(() => {
        animate = false;
      }, 500);
    }
    return item;
  });
  magnifying.value = magnifying.value.map((item) => {
    if (item.x === imgLeft.value && item.y === imgTop.value && item.show) {
      flag = false;
      eatGold();
      item.show = false;
      widen();
    }
    return item;
  });
  gift.value = gift.value.map((item) => {
    if (item.x === imgLeft.value && item.y === imgTop.value && item.show) {
      item.show = false;
      flag = false;
      play();
      item.srcShow = true;
      setTimeout(() => {
        item.srcShow = false;
        pause();
      }, 3000);
    }
    return item;
  });
  if (flag) walkSound();
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
    upgrade.value = true;
    setup();
    initMask();
    setTimeout(() => {
      upgrade.value = false;
    }, 500);
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

function widen() {
  rangeScope.value = rangeScope.value * 2;
  updateMask();
}

const audio = document.createElement("audio");
audio.src = "/bgm/bgm.mp3";
const audioWalk = document.createElement("audio");
audioWalk.src = "/bgm/walk.mp3";

const audioGold = document.createElement("audio");
audioGold.src = "/bgm/gold.mp3";

function play() {
  audio.load();
  audio.play();
}
function pause() {
  audio.pause();
}

function walkSound() {
  audioWalk.load();
  audioWalk.play();
}
function eatGold() {
  audioGold.load();
  audioGold.play();
}
</script>

<template>
  <div flex="~ gap-5" justify-center items-end m-b-5 overflow-hidden max-w-150 ma>
    <div flex="~ gap-2" items-center justify-center>
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
        :class="upgrade && 'animate-bounce-in-down'"
        animate-duration-500
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
      animate-flash
      animate-duration-2000
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

    <template v-for="(item, index) in magnifying" :key="index">
      <svg
        v-if="item.show"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        role="img"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 128 128"
        p-2
        :style="{ width: w + 'px', left: item.x + 'px', top: item.y + 'px' }"
        absolute
      >
        <path fill="#633D35" d="m37.29 113.26l-8.42 4.48V97.58l10.52 11.2z" />
        <path
          fill="#AD7156"
          d="M99.99 19.95c0 3.02.51 21.49.51 21.49s.26 1.98 1.75 2.48c.98.33 3.12-.37 5.73-2.41c.35-.27.82-.31 1.2-.09c1 .6 3.15 1.77 4.5 5.32c1.49 3.92 1.21 7.22.98 8.62c-.08.47-.3.9-.57 1.24c-2.43 3-14.59 18.58-14.59 28.48c0 0 .2 14.45.2 22.95c0 7.75-13.09 14.22-30.49 15.72l-9.71-2.67l-11.2 2.01c-3.56-.55-6.88-1.31-9.86-2.25l-7.47-21.02l-2.1 17.92s-5.61-5.75-5.61-9.71c0-8.57-2.1-88.03-2.1-88.03l78.83-.05z"
        />
        <linearGradient
          id="svgIDa"
          x1="102.035"
          x2="102.017"
          y1="43.768"
          y2="43.832"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stop-color="#CE8963" />
          <stop offset="1" stop-color="#D08A61" stop-opacity="0" />
        </linearGradient>
        <path fill="url(#svgIDa)" d="M102.25 43.91z" />
        <path
          fill="#CE8963"
          d="M47 35.58c-.33 5.56-.91 11.07-1.53 16.57l-.93 8.23c-.29 2.74-.67 5.45-.59 8.08c0 2.7.13 5.46.27 8.21l.37 8.28c.24 5.53.45 11.06.41 16.63c-1.2-5.44-2.05-10.93-2.74-16.44c-.68-5.52-1.21-11.02-1.31-16.67c-.02-2.91.4-5.71.78-8.46c.44-2.75.88-5.49 1.43-8.21c1.07-5.45 2.29-10.86 3.84-16.22zm-13 28c.27.7.3 1.46.38 2.19c.05.74.1 1.48.12 2.22c.04 1.48.06 2.96.04 4.44c-.02 2.96-.13 5.91-.29 8.86c-.15 2.95-.35 5.89-.59 8.83c-.21 2.94-.52 5.88-.81 8.82l-.03-.36l1.42 5.21l1.35 5.23c.87 3.5 1.7 7 2.41 10.55c-1.32-3.36-2.52-6.77-3.68-10.18l-1.7-5.13L31 99.13l-.05-.16l.02-.19c.25-2.93.46-5.87.74-8.81c.25-2.93.53-5.87.82-8.8l.89-8.79l.43-4.4c.07-.73.13-1.47.18-2.2c.02-.73.12-1.47-.03-2.2zm24.5 32.5v25l8 2s-5-15-8-27z"
        />
        <path
          fill="#965B44"
          d="M88.5 79.08c5.68-12.95 25.68-26.93 25.68-26.93l.59-.43c.11 1.76.02 3.04-.14 3.74c-.07.31-.3.82-.46 1.01c-1.92 2.36-14.67 18.42-14.67 28.6c0 0 .2 14.45.2 22.95c0 3.81-4.2 9.05-13.2 12.05l4-29l-9 9c0 .01 3.01-11.88 7-20.99zm12-38.29c.26 4.05 3.08 3.13 3.08 3.13c-3.24 1.52-7.94 2.37-10.66.56c-3-2-4.42-12.39-4.42-12.39l2-6l9.44-5.53l.56 20.23z"
        />
        <path
          fill="#FFCC80"
          d="M58.48 4.27C38.43 4.73 22.5 11.73 22.5 20.3c0 8.87 17.05 16.05 38.08 16.05s38.08-7.19 38.08-16.05c0-8.53-15.78-15.51-35.71-16.02"
        />
        <path
          fill="#CE8963"
          d="M58.48 4.27c-7.17.57-14.32 1.7-20.99 4.16c-3.32 1.21-6.56 2.71-9.27 4.8c-1.33 1.05-2.56 2.23-3.37 3.59c-.84 1.34-1.18 2.84-.94 4.28c.24 1.43 1.05 2.79 2.16 3.95c1.11 1.16 2.45 2.19 3.91 3.05c2.93 1.73 6.22 2.96 9.58 3.89c6.75 1.86 13.83 2.64 20.89 2.63c7.05.02 14.14-.73 20.9-2.57c3.36-.92 6.67-2.13 9.61-3.83c1.47-.85 2.84-1.84 3.96-3c1.13-1.14 2-2.48 2.28-3.91c.33-1.43-.01-2.93-.77-4.29c-.78-1.36-1.97-2.57-3.29-3.63c-2.67-2.13-5.91-3.64-9.22-4.87c-6.65-2.49-13.8-3.64-20.97-4.24c1.8-.03 3.6-.02 5.41.04c1.8.09 3.61.24 5.4.45c3.59.44 7.18 1.09 10.69 2.13c3.49 1.08 6.95 2.47 10.05 4.66c1.55 1.1 2.99 2.44 4.07 4.16c1.07 1.71 1.68 3.93 1.29 6.06c-.34 2.14-1.5 3.97-2.82 5.42c-1.34 1.47-2.9 2.62-4.52 3.62c-3.24 1.98-6.74 3.33-10.28 4.39c-7.12 2.04-14.47 2.84-21.8 2.87c-7.32-.06-14.68-.87-21.79-2.95c-3.54-1.07-7.03-2.45-10.26-4.45c-1.61-1.01-3.15-2.2-4.48-3.69c-1.3-1.48-2.4-3.37-2.68-5.51c-.13-1.06-.06-2.15.21-3.18c.26-1.03.74-1.96 1.29-2.81c1.11-1.7 2.59-2.99 4.14-4.08C30 9.27 33.45 7.89 36.95 6.83c3.51-1.02 7.1-1.66 10.7-2.09c1.8-.2 3.6-.35 5.41-.43c1.81-.08 3.62-.08 5.42-.04z"
        />
        <radialGradient
          id="svgIDb"
          cx="59.442"
          cy="16.159"
          r="21.667"
          gradientTransform="matrix(-1.1788 0 0 .9412 130.18 -.789)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset=".056" stop-color="#FFA726" />
          <stop offset=".135" stop-color="#FFA726" />
          <stop offset="1" stop-color="#FFA726" stop-opacity=".1" />
        </radialGradient>
        <path
          fill="url(#svgIDb)"
          d="M21.91 17.65c0 7.03 14.33 12.73 32.02 12.73s32.02-5.7 32.02-12.73S79.7 2.51 53.93 4.91c-17.61 1.65-32.02 5.7-32.02 12.74z"
        />
        <path
          fill="#7F441C"
          d="M31.08 18.62c-.01 1.39.81 2.64 1.79 3.61c1.01.96 2.21 1.71 3.46 2.34c2.51 1.24 5.22 2.04 7.95 2.66c5.48 1.15 11.1 1.56 16.68 1.49c5.58-.07 11.18-.63 16.57-1.95c2.68-.68 5.33-1.55 7.75-2.8c1.2-.62 2.33-1.38 3.26-2.26c.9-.9 1.57-1.98 1.54-3.08c-.01-1.09-.69-2.14-1.61-3.01c-.94-.86-2.07-1.58-3.28-2.17c-2.42-1.19-5.07-1.99-7.75-2.61c-2.69-.62-5.43-1.03-8.18-1.31c-2.75-.3-5.53-.44-8.3-.46c-5.55-.04-11.13.24-16.6 1.29c-2.72.56-5.43 1.28-7.95 2.46c-1.25.6-2.45 1.32-3.48 2.25c-.99.93-1.83 2.15-1.85 3.55zm-.22 0c-.02-1.48.83-2.79 1.83-3.79c1.03-1 2.21-1.82 3.47-2.49c2.5-1.37 5.19-2.34 7.93-3.11c5.48-1.52 11.18-2.27 16.87-2.33c2.85-.01 5.7.11 8.54.39c2.84.3 5.66.78 8.45 1.46c2.78.71 5.53 1.61 8.14 2.97c1.3.68 2.55 1.5 3.67 2.57c.54.55 1.05 1.17 1.44 1.89c.39.72.64 1.57.63 2.44c-.01.87-.27 1.71-.67 2.42s-.91 1.32-1.46 1.85c-1.12 1.04-2.38 1.83-3.69 2.47c-2.61 1.29-5.36 2.13-8.14 2.77c-5.56 1.25-11.24 1.71-16.9 1.67c-5.65-.1-11.32-.71-16.79-2.13c-2.73-.71-5.43-1.61-7.94-2.91c-1.26-.64-2.45-1.43-3.49-2.4c-1.01-.98-1.88-2.26-1.89-3.74z"
          opacity=".66"
        />
        <path
          fill="#B5772C"
          d="M37.81 17.5c0 3.71 9.66 6.72 21.57 6.72s21.57-3.01 21.57-6.72s-9.66-6.72-21.57-6.72s-21.57 3.01-21.57 6.72zm3.68 0c0-2.78 7.62-5.04 17.03-5.04s17.03 2.26 17.03 5.04s-7.62 5.04-17.03 5.04s-17.03-2.26-17.03-5.04z"
          opacity=".82"
        />
        <linearGradient
          id="svgIDc"
          x1="50.85"
          x2="67.839"
          y1="16.939"
          y2="16.939"
          gradientTransform="matrix(-1 0 0 1 120.75 0)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stop-color="#8A5140" />
          <stop offset="1" stop-color="#8A5140" />
        </linearGradient>
        <ellipse
          cx="61.41"
          cy="16.94"
          fill="url(#svgIDc)"
          opacity=".74"
          rx="8.49"
          ry="2.24"
        />
      </svg>
    </template>
    <template v-for="(item, index) in gift" :key="index">
      <svg
        v-if="item.show"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        role="img"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 64 64"
        p-1
        animate-shake-y
        animate-duration-2000
        :style="{ width: w + 'px', left: item.x + 'px', top: item.y + 'px' }"
        absolute
      >
        <path
          fill="#d07929"
          d="M57.3 16c-9.164-4.518-18.329-9.04-27.49-13.558c-.624-.307-1.282-.733-2.01-.514c-.449.137-.89.464-1.292.692c-2.11 1.204-4.223 2.405-6.334 3.611c-5.596 3.195-11.193 6.387-16.794 9.582c-.722.414-1.447.823-2.171 1.237a1.463 1.463 0 0 0-.57.333c-.796.527-.798 1.424-.384 2.078c.117.232.302.445.558.621l26.09 17.615c.609.41 1.219.823 1.826 1.235c.435.291 1.198.271 1.619-.039c8.411-6.268 16.827-12.538 25.24-18.809c.593-.439 1.183-.878 1.771-1.317c.907-.673 1.1-2.191-.061-2.767"
        />
        <path
          fill="#f6921e"
          d="M30.935 37.29c-.201-.667-.888-1.03-1.43-1.401c-8.868-6.05-17.736-12.09-26.604-18.15a1.222 1.222 0 0 0-.851-.534c-.841-.351-1.59.218-1.861.987a1.646 1.646 0 0 0-.128 1.046c.901 4.859 1.808 9.722 2.711 14.582l1.611 8.66c.222 1.179.23 2.224 1.225 3l23.26 18.15c1.056.823 2.741.308 2.706-1.194l-.351-15.12c-.064-2.777-.131-5.552-.191-8.33c-.013-.538.057-1.186-.097-1.706"
        />
        <path
          fill="#9a5524"
          d="M.946 23.839c.32-.175.701-.23 1.104-.062c.335.055.644.225.851.535l26.604 18.15c.542.371 1.229.733 1.43 1.4c.154.523.084 1.167.098 1.705c.061 2.778.127 5.556.191 8.334l.208 9.05c.088-.199.148-.418.143-.68l-.351-15.12c-.064-2.777-.131-5.556-.191-8.334c-.014-.535.057-1.183-.098-1.705c-.201-.665-.888-1.03-1.43-1.4c-8.868-6.05-17.736-12.09-26.604-18.15a1.237 1.237 0 0 0-.851-.535c-.841-.349-1.59.221-1.861.989a1.643 1.643 0 0 0-.128 1.045c.292 1.593.588 3.185.885 4.778"
        />
        <path
          fill="#d07929"
          d="M55.75 16.14c-8.246 6.104-16.491 12.212-24.739 18.317c-.552.406-1.104.817-1.652 1.224c-.057.041-.1.08-.146.119c-.363.263-.609.69-.597 1.285c.199 8.469.394 16.943.591 25.413c.035 1.502 1.699 1.939 2.686 1.069c7.251-6.375 14.506-12.75 21.763-19.12c.815-.718.761-2.657.911-3.641c.462-2.995.918-5.989 1.377-8.984c.714-4.645 1.426-9.282 2.136-13.924c.194-1.258-1.114-2.654-2.33-1.753"
        />
        <path
          fill="#9a5524"
          d="M29.21 41.979c.046-.035.091-.074.146-.113c.546-.391 1.1-.788 1.652-1.175c8.246-5.88 16.493-11.758 24.741-17.631c.526-.378 1.069-.322 1.5-.055c.275-1.726.552-3.457.825-5.185c.197-1.209-1.111-2.553-2.325-1.689c-8.248 5.876-16.495 11.755-24.741 17.631c-.552.393-1.106.786-1.652 1.177c-.055.039-.1.078-.146.115c-.361.253-.607.665-.595 1.236c.051 2.073.1 4.148.15 6.224c.106-.22.256-.403.445-.535"
        />
        <g fill="#be202e">
          <path d="M37.507 6.244L9.576 22.12l9 6.14l26.08-18.488z" />
          <path d="m19.427 6.663l28.19 15.265l-10.18 7.252l-24.706-18.693z" />
        </g>
        <g fill="#cc2f42">
          <path
            d="m18.581 28.26l1.225 28.31l-8.108-6.33l-2.122-28.12m27.857 7.06V58.7l9.242-8.119l.938-28.653"
          />
          <path
            d="M26.06 6.03c-3.531 2.928-5.442 8.232-5.879 12.176c-.468 4.208-.554 8.615-3.191 12.188c-.378.513-.043.829.488.507c1.531-.938 2.848-2.062 4.067-3.339c.778 1.58.521 3.451.345 5.177c-.082.784 1.086-.185 1.258-.364c3.58-3.919 2.405-8.749 3.365-13.616C29.056 5.876 28.557 3.962 26.06 6.03"
          />
          <path
            d="M31.1 18.654c2.255 4.417 2.435 9.385 6.954 12.177c.207.125 1.6.739 1.308.008c-.635-1.613-1.399-3.342-1.079-5.072c1.518.899 3.092 1.621 4.826 2.103c.601.164.827-.226.323-.62c-3.507-2.72-4.795-6.933-6.391-10.854c-1.502-3.677-4.783-8.263-8.981-10.11c-2.967-1.309-2.92.667 3.04 12.367"
          />
          <path
            d="M14.12 3.485c3.798-.53 12.446 1.024 12.91 4.354c.462 3.328-7.434 7.179-11.229 7.709c-3.796.527-6.081-1.912-6.544-5.24c-.468-3.333 1.069-6.296 4.863-6.823M38.27.126c-3.8.532-11.695 4.383-11.23 7.713c.462 3.328 9.114 4.879 12.902 4.354c3.804-.53 5.333-3.496 4.869-6.826C44.35 2.03 42.067-.4 38.27.126"
          />
        </g>
        <path
          fill="#ef556c"
          d="M33.935 6.175a4.708 4.708 0 0 1-4.02 5.312l-4.655.649a4.71 4.71 0 0 1-5.317-4.01a4.717 4.717 0 0 1 4.02-5.316l4.662-.649a4.718 4.718 0 0 1 5.315 4.02"
        />
      </svg>
      <img
        v-if="item.srcShow"
        fixed
        top-0
        bottom-0
        left-0
        right-0
        z-99
        h-full
        md:min-w-150
        :src="item.src"
        ma
        alt="pic"
      />
    </template>
  </div>
</template>

<style>
.hide {
  display: none;
}
</style>

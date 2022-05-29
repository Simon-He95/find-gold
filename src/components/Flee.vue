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
      fireSound();
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
    winSound();
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
audioWalk.muted = false;

const audioGold = document.createElement("audio");
audioGold.src = "/bgm/gold.mp3";

const audioFire = document.createElement("audio");
audioFire.src = "/bgm/fire.mp3";

const audioWin = document.createElement("audio");
audioWin.src = "/bgm/win.mp3";

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
function fireSound() {
  audioFire.load();
  audioFire.play();
}
function winSound() {
  audioWin.load();
  audioWin.play();
}
</script>

<template>
  <div flex="~ gap-5" justify-center items-end m-b-5 max-w-150 ma>
    <div flex="~ gap-4" items-center justify-center>
      <img w-7 src="/img/reset.svg" @click="restart" alt="reset" />
      <img w-7 src="/img/clock.svg" alt="clock" />
      {{ countDown }}
      <img src="/img/gold.svg" w-7 :class="animate && 'animate-heart-beat'" alt="gold" />
      {{ number }}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        role="img"
        w-7
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

  <div ref="FleeEl" relative overflow-hidden max-w-150 ma>
    <img
      absolute
      src="/img/fire.svg"
      :style="{ width: w + 'px', left: imgLeft + 'px', top: imgTop + 'px' }"
      animate-flash
      animate-duration-2000
      alt="fire"
    />
    <template v-for="(item, index) in goldArray" :key="index">
      <img
        src="/img/gold.svg"
        v-if="item.show"
        animate-zoom-in
        animate-duration-700
        :style="{ width: w + 'px', left: item.x + 'px', top: item.y + 'px' }"
        absolute
        alt="gold"
      />
    </template>

    <template v-for="(item, index) in magnifying" :key="index">
      <img
        v-if="item.show"
        :style="{ width: w + 'px', left: item.x + 'px', top: item.y + 'px' }"
        absolute
        src="/img/wood.svg"
        alt="wood"
      />
    </template>
    <template v-for="(item, index) in gift" :key="index">
      <img
        v-if="item.show"
        :src="item.url"
        animate-shake-y
        animate-duration-2000
        :style="{ width: w + 'px', left: item.x + 'px', top: item.y + 'px' }"
        absolute
        alt="gift"
      />

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

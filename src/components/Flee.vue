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

const animate = $ref(false);
watch(hideMask, (newV) => {
  if (newV) mask.setAttribute("class", "hide");
  else mask.removeAttribute("class", "hide");
});
onMounted(() => {
  FleeEl.value.appendChild(canvas);
  // FleeEl.value.appendChild(mask);
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
  magnifying.value = magnifying.value.map((item) => {
    if (item.x === imgLeft.value && item.y === imgTop.value && item.show) {
      item.show = false;
      widen();
    }
    return item;
  });
  gift.value = gift.value.map((item) => {
    if (item.x === imgLeft.value && item.y === imgTop.value && item.show) {
      item.show = false;
      play();
      item.srcShow = true;
      setTimeout(() => {
        item.srcShow = false;
        pause();
      }, 3000);
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

function widen() {
  rangeScope.value = rangeScope.value * 2;
  updateMask();
}

const audio = document.createElement("audio");
function play() {
  audio.src = "/bgm/bgm.mp3";
  audio.play();
}
function pause() {
  audio.pause();
}
</script>

<template>
  <div
    flex="~ gap-5"
    justify-center
    items-end
    m-b-5
    overflow-hidden
    max-w-150
    ma
    @click="widen"
  >
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

    <template v-for="(item, index) in magnifying" :key="index">
      <svg
        v-if="item.show"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        role="img"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 64 64"
        p-1
        :style="{ width: w + 'px', left: item.x + 'px', top: item.y + 'px' }"
        absolute
      >
        <g fill="#243438">
          <path
            d="M18.354 63.39c1.554.746 3.037.886 3.314.308l15.972-33.1c.277-.577-.753-1.654-2.31-2.405c-1.551-.747-3.041-.889-3.316-.308l-15.969 33.09c-.277.577.758 1.658 2.309 2.408"
          />
          <path
            d="M17.271 21.704c0 11.996 9.724 21.704 21.706 21.704c11.984 0 21.706-9.708 21.706-21.704S50.961 0 38.977 0C26.995 0 17.271 9.708 17.271 21.704"
          />
        </g>
        <path
          fill="#30434a"
          d="M19.476 21.704c0 10.772 8.737 19.497 19.5 19.497c10.766 0 19.498-8.725 19.498-19.497c0-10.776-8.732-19.496-19.498-19.496c-10.763 0-19.5 8.719-19.5 19.496"
        />
        <path
          fill="#1e75bb"
          d="M21.62 21.704c0 9.588 7.773 17.355 17.357 17.355c9.58 0 17.355-7.767 17.355-17.355c0-9.59-7.775-17.355-17.355-17.355c-9.584 0-17.357 7.764-17.357 17.355"
        />
        <g transform="translate(16)">
          <circle cx="22.977" cy="21.704" r="15.214" fill="#57c6e9" />
          <path
            fill="#27a8e0"
            d="M31.34 8.961a15.19 15.19 0 0 1 6.855 12.709c0 8.4-6.811 15.214-15.214 15.214c-.148 0-.297-.021-.445-.024C37.46 29.463 33.774 14.104 31.34 8.961"
          />
        </g>
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

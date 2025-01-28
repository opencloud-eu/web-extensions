<template>
  <div
    v-if="isLoading"
    id="nyan-cat-progress-bar"
    ref="nyanCatContainer"
    class="oc-width-1-1"
    :style="nyanCatContainerVars"
  >
    <div class="wave-a hot rainbow" />
    <div class="wave-a cold rainbow" />
    <div class="wave-b hot rainbow" />
    <div class="wave-b cold rainbow" />

    <div class="nyan-cat" :class="[`frame${currentFrame}`]">
      <div class="tail" />
      <div class="paws" />

      <div class="pop-tarts-body">
        <div class="pop-tarts-body-cream" />
      </div>

      <div class="head">
        <div class="face" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
// Thanks to https://github.com/cristurm/nyan-cat for the nyan cat css+js+html blueprint! (MIT licensed)
import { computed, defineComponent, onBeforeUnmount, onMounted, ref, unref, watch } from 'vue'
import { eventBus, LoadingEventTopics, useLoadingService } from '@opencloud-eu/web-pkg'
import { useElementSize } from '@vueuse/core'

const MAX_POSITION_FRAME = 50
const MAX_CAT_FRAME = 6

export default defineComponent({
  name: 'NyanCat',
  setup() {
    const loadingService = useLoadingService()
    let addLoadingEventToken: string
    let removeLoadingEventToken: string
    let setProgressToken: string
    let catAnimationTimerId: ReturnType<typeof setTimeout>
    let positionTimerId: ReturnType<typeof setTimeout>
    const nyanCatContainer = ref<HTMLElement>(null)

    const currentCatFrame = ref(1)
    const currentPositionFrame = ref(1)

    const isLoading = ref(loadingService.isLoading)
    const currentProgress = ref(loadingService.currentProgress)
    const updateLoadingState = () => {
      currentProgress.value = loadingService.currentProgress
      isLoading.value = loadingService.isLoading
    }
    const setProgress = () => {
      currentProgress.value = loadingService.currentProgress
    }

    const { width: totalWidth } = useElementSize(nyanCatContainer)
    const currentPosition = computed(() => {
      if (unref(currentProgress) === null) {
        return unref(totalWidth) * (unref(currentPositionFrame) / MAX_POSITION_FRAME)
      }
      return unref(totalWidth) * (unref(currentProgress) / 100)
    })

    const clearAnimationTimers = () => {
      if (catAnimationTimerId) {
        clearInterval(catAnimationTimerId)
        catAnimationTimerId = null
      }
      if (positionTimerId) {
        clearInterval(positionTimerId)
        positionTimerId = null
      }
    }
    watch(
      isLoading,
      (loading) => {
        clearAnimationTimers()
        if (loading) {
          currentCatFrame.value = 1
          catAnimationTimerId = setInterval(() => {
            currentCatFrame.value = (unref(currentCatFrame) % MAX_CAT_FRAME) + 1
          }, 350)
          currentPositionFrame.value = 1
          positionTimerId = setInterval(() => {
            currentPositionFrame.value = (unref(currentPositionFrame) % MAX_POSITION_FRAME) + 1
          }, 30)
        }
      },
      { immediate: true }
    )

    onMounted(() => {
      addLoadingEventToken = eventBus.subscribe(LoadingEventTopics.add, updateLoadingState)
      removeLoadingEventToken = eventBus.subscribe(LoadingEventTopics.remove, updateLoadingState)
      setProgressToken = eventBus.subscribe(LoadingEventTopics.setProgress, setProgress)
    })
    onBeforeUnmount(() => {
      eventBus.unsubscribe(LoadingEventTopics.add, addLoadingEventToken)
      eventBus.unsubscribe(LoadingEventTopics.remove, removeLoadingEventToken)
      eventBus.unsubscribe(LoadingEventTopics.setProgress, setProgressToken)
      clearAnimationTimers()
    })

    const nyanCatContainerVars = computed(() => {
      const dotSize = 1
      const catWidth = dotSize * 32
      const catHeight = dotSize * 20
      const pawsWidth = dotSize * 26
      const pawsHeight = dotSize * 5
      const paws1x = dotSize
      const paws2x = dotSize * 6
      const paws3x = dotSize * 16
      const paws4x = dotSize * 21
      const tailWidth = dotSize * 7
      const tailHeight = dotSize * 9
      const headWidth = dotSize * 13
      const headHeight = dotSize * 5
      const popTartWidth = catWidth / 2
      const popTartHeight = catHeight - pawsHeight
      return {
        '--nyan-cat-total-width': `${unref(totalWidth)}px`,
        '--nyan-cat-position': `${Math.floor(unref(currentPosition))}px`,
        '--nyan-cat-offset-y': `52px`,
        '--nyan-cat-rainbow-height': `${catHeight - dotSize * 4}px`,
        '--nyan-cat-wave-block-width': `${dotSize * 16}px`,
        '--nyan-cat-wave-block-height': `${dotSize * 3}px`,
        '--nyan-cat-width': `${catWidth}px`,
        '--nyan-cat-height': `${catHeight}px`,
        '--nyan-cat-dot-size': `${dotSize}px`,
        '--nyan-cat-pop-tart-width': `${popTartWidth}px`,
        '--nyan-cat-pop-tart-height': `${popTartHeight}px`,
        '--nyan-cat-head-width': `${headWidth}px`,
        '--nyan-cat-head-height': `${headHeight}px`,
        '--nyan-cat-paws-width': `${pawsWidth}px`,
        '--nyan-cat-paws-height': `${pawsHeight}px`,
        '--nyan-cat-paws-1x': `${paws1x}px`,
        '--nyan-cat-paws-2x': `${paws2x}px`,
        '--nyan-cat-paws-3x': `${paws3x}px`,
        '--nyan-cat-paws-4x': `${paws4x}px`,
        '--nyan-cat-tail-width': `${tailWidth}px`,
        '--nyan-cat-tail-height': `${tailHeight}px`
      }
    })

    return {
      totalWidth,
      nyanCatContainer,
      nyanCatContainerVars,
      currentFrame: currentCatFrame,
      currentProgress,
      isLoading
    }
  }
})
</script>

<style lang="scss">
#nyan-cat-progress-bar {
  /* nyan cat */
  .nyan-cat {
    position: absolute;
    width: var(--nyan-cat-width);
    height: var(--nyan-cat-height);
    top: var(--nyan-cat-offset-y);
    right: calc(var(--nyan-cat-total-width) - var(--nyan-cat-position));
    margin-top: 0;
    margin-left: calc(var(--nyan-cat-width) * -0.5);
    z-index: 3;
  }
  /* shift down by 1 dot size in frames 1 and 2 */
  .nyan-cat.frame1,
  .nyan-cat.frame2 {
    margin-top: calc(var(--nyan-cat-dot-size) * -1);
  }

  /* pop-tarts body */
  .pop-tarts-body {
    border: solid black;
    border-width: var(--nyan-cat-dot-size) 0;
    width: var(--nyan-cat-pop-tart-width);
    height: var(--nyan-cat-pop-tart-height);
    position: absolute;
    left: calc(var(--nyan-cat-tail-width) + var(--nyan-cat-dot-size) * 2);
    top: 0;
  }

  .pop-tarts-body:after {
    content: '';
    border: solid black;
    border-width: 0 var(--nyan-cat-dot-size);
    width: calc(var(--nyan-cat-pop-tart-width) + var(--nyan-cat-dot-size) * 2);
    height: calc(var(--nyan-cat-pop-tart-height) - var(--nyan-cat-dot-size) * 2);
    position: absolute;
    top: var(--nyan-cat-dot-size);
    left: calc(var(--nyan-cat-dot-size) * -2);
  }

  .pop-tarts-body:before {
    content: '';
    position: absolute;
    left: calc(var(--nyan-cat-dot-size) * -1);
    top: 0;
    width: calc(var(--nyan-cat-pop-tart-width) + var(--nyan-cat-dot-size) * 2);
    height: var(--nyan-cat-pop-tart-height);
    background:
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat;
    background-color: #fc9;
    background-size: var(--nyan-cat-dot-size) var(--nyan-cat-dot-size);
    background-position:
      0 0,
      calc(var(--nyan-cat-pop-tart-width) + var(--nyan-cat-dot-size)) 0,
      0 calc(var(--nyan-cat-pop-tart-height) - var(--nyan-cat-dot-size)),
      calc(var(--nyan-cat-pop-tart-width) + var(--nyan-cat-dot-size))
        calc(var(--nyan-cat-pop-tart-height) - var(--nyan-cat-dot-size));
  }

  .pop-tarts-body-cream {
    position: absolute;
    width: 100%;
    height: calc(var(--nyan-cat-pop-tart-height) - var(--nyan-cat-dot-size) * 2);
    top: var(--nyan-cat-dot-size);
    left: 0;
    background:
      linear-gradient(#f39, #f39) no-repeat,
      linear-gradient(#f39, #f39) no-repeat,
      linear-gradient(#f39, #f39) no-repeat,
      linear-gradient(#f39, #f39) no-repeat,
      linear-gradient(#f39, #f39) no-repeat,
      linear-gradient(#f39, #f39) no-repeat,
      linear-gradient(#f39, #f39) no-repeat,
      linear-gradient(#f39, #f39) no-repeat,
      linear-gradient(#f39, #f39) no-repeat,
      linear-gradient(#f39, #f39) no-repeat;
    background-color: #f9f;
    background-size: var(--nyan-cat-dot-size) var(--nyan-cat-dot-size);
    background-position:
      // random position for the sprinkles
      calc(var(--nyan-cat-dot-size) * 2) calc(var(--nyan-cat-dot-size) * 2),
      calc(var(--nyan-cat-dot-size) * 7) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-dot-size) * 10) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-dot-size) * 6) calc(var(--nyan-cat-dot-size) * 5),
      calc(var(--nyan-cat-dot-size) * 13) calc(var(--nyan-cat-dot-size) * 3),
      calc(var(--nyan-cat-dot-size) * 3) calc(var(--nyan-cat-dot-size) * 7),
      calc(var(--nyan-cat-dot-size) * 6) calc(var(--nyan-cat-dot-size) * 7),
      var(--nyan-cat-dot-size) calc(var(--nyan-cat-dot-size) * 8),
      calc(var(--nyan-cat-dot-size) * 5) calc(var(--nyan-cat-dot-size) * 10);
  }

  /* pixelated pop tart corners */
  .pop-tarts-body-cream:before {
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    left: 0;
    top: 0;
    background:
      linear-gradient(#fc9, #fc9) no-repeat,
      linear-gradient(#fc9, #fc9) no-repeat,
      linear-gradient(#fc9, #fc9) no-repeat,
      linear-gradient(#fc9, #fc9) no-repeat,
      linear-gradient(#fc9, #fc9) no-repeat,
      linear-gradient(#fc9, #fc9) no-repeat,
      linear-gradient(#fc9, #fc9) no-repeat,
      linear-gradient(#fc9, #fc9) no-repeat;
    background-size:
      calc(var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size),
      var(--nyan-cat-dot-size) calc(var(--nyan-cat-dot-size) * 2),
      var(--nyan-cat-dot-size) calc(var(--nyan-cat-dot-size) * 2),
      var(--nyan-cat-dot-size) calc(var(--nyan-cat-dot-size) * 2),
      var(--nyan-cat-dot-size) calc(var(--nyan-cat-dot-size) * 2);
    background-position:
      0 0,
      calc(var(--nyan-cat-pop-tart-width) - var(--nyan-cat-dot-size) * 2) 0,
      0 calc(var(--nyan-cat-pop-tart-width) - var(--nyan-cat-dot-size) * 3),
      calc(var(--nyan-cat-pop-tart-width) - var(--nyan-cat-dot-size) * 2)
        calc(var(--nyan-cat-pop-tart-width) - var(--nyan-cat-dot-size) * 3),
      0 0,
      calc(var(--nyan-cat-pop-tart-width) - var(--nyan-cat-dot-size)) 0,
      0 calc(var(--nyan-cat-pop-tart-width) - var(--nyan-cat-dot-size) * 4),
      calc(var(--nyan-cat-pop-tart-width) - var(--nyan-cat-dot-size) * 1)
        calc(var(--nyan-cat-pop-tart-width) - var(--nyan-cat-dot-size) * 4);
  }

  /* pseudo elems */
  .head:before,
  .head:after,
  .tail:before,
  .nyan-cat:before,
  .paws:before,
  .face:before {
    content: '';
    position: absolute;
  }

  /* rainbow */
  .rainbow {
    background: none;
    height: var(--nyan-cat-rainbow-height);
    width: var(--nyan-cat-position);
    position: absolute;
    top: var(--nyan-cat-offset-y);
    right: calc(var(--nyan-cat-total-width) - var(--nyan-cat-position));
    margin-right: calc(var(--nyan-cat-width) - var(--nyan-cat-tail-width));
    z-index: 2;
  }

  .hot:after,
  .hot:before,
  .cold:after,
  .cold:before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 50%;
  }

  .hot:after,
  .hot:before {
    top: 0;
  }

  .cold:after,
  .cold:before {
    bottom: 0;
  }

  .wave-a {
    margin-top: 0;
    animation: wavy 700ms 0ms steps(2) infinite both;
  }

  .wave-b {
    margin-top: calc(var(--nyan-cat-dot-size) * -1);
    animation: wavy 700ms 350ms steps(2) infinite both;
  }

  @keyframes wavy {
    0% {
      margin-top: 0;
    }
    100% {
      margin-top: calc(var(--nyan-cat-dot-size) * -1);
    }
  }

  /* red */
  .hot {
    background-image: linear-gradient(to right, #f00 52%, transparent 52%);
  }

  /* orange */
  .hot:after {
    background-image: linear-gradient(to right, #f90 52%, transparent 52%);
  }

  /* yellow */
  .hot:before {
    background-image: linear-gradient(to right, #ff0 52%, transparent 52%);
  }

  /* green */
  .cold:after {
    background-image: linear-gradient(to right, #3f0 52%, transparent 52%);
  }

  /* blue */
  .cold:before {
    background-image: linear-gradient(to right, #09f 52%, transparent 52%);
  }

  /* purple */
  .cold {
    background-image: linear-gradient(to right, #63f 52%, transparent 52%);
  }

  .rainbow,
  .hot:after,
  .hot:before,
  .cold:after,
  .cold:before {
    background-size: var(--nyan-cat-wave-block-width) var(--nyan-cat-wave-block-height);
    background-repeat: repeat-x;
  }

  .wave-a.hot,
  .wave-a.cold:after {
    background-position: left top;
  }

  .wave-a.hot:after,
  .wave-a.cold:before {
    background-position: left center;
  }

  .wave-a.hot:before,
  .wave-a.cold {
    background-position: left bottom;
  }

  .wave-b.hot,
  .wave-b.cold:after {
    background-position: calc(var(--nyan-cat-wave-block-width) * 0.5) top;
  }

  .wave-b.hot:after,
  .wave-b.cold:before {
    background-position: calc(var(--nyan-cat-wave-block-width) * 0.5) center;
  }

  .wave-b.hot:before,
  .wave-b.cold {
    background-position: calc(var(--nyan-cat-wave-block-width) * 0.5) bottom;
  }

  /* head */
  .head {
    width: var(--nyan-cat-head-width);
    height: var(--nyan-cat-head-height);
    border: solid black;
    border-width: 0 var(--nyan-cat-dot-size);
    background: #999;
    position: absolute;
  }

  /* .head:before = left ear | .head:after = right ear */
  .head:before,
  .head:after {
    width: calc(var(--nyan-cat-head-width) * 0.5);
    height: var(--nyan-cat-head-height);
    top: calc(var(--nyan-cat-head-height) * -1);
    background:
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(#999, #999) no-repeat,
      linear-gradient(#999, #999) no-repeat,
      linear-gradient(#999, #999) no-repeat,
      linear-gradient(#999, #999) no-repeat;
    background-size:
      // ear outline
      var(--nyan-cat-dot-size) calc(var(--nyan-cat-head-height) - var(--nyan-cat-dot-size)),
      calc(var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size),
      var(--nyan-cat-dot-size) var(--nyan-cat-dot-size),
      var(--nyan-cat-dot-size) var(--nyan-cat-dot-size),
      // ear fill
      calc(var(--nyan-cat-dot-size) * 2) var(--nyan-cat-head-height),
      calc(var(--nyan-cat-dot-size) * 2) calc(var(--nyan-cat-dot-size) * 2),
      calc(var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size),
      var(--nyan-cat-dot-size) var(--nyan-cat-dot-size);
    background-position:
      // ear outline
      0 var(--nyan-cat-dot-size),
      var(--nyan-cat-dot-size) 0,
      calc(var(--nyan-cat-dot-size) * 5) calc(var(--nyan-cat-dot-size) * 3),
      calc(var(--nyan-cat-dot-size) * 3) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-dot-size) * 4) calc(var(--nyan-cat-dot-size) * 2),
      // ear fill
      var(--nyan-cat-dot-size) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-dot-size) * 3) calc(var(--nyan-cat-dot-size) * 3),
      calc(var(--nyan-cat-dot-size) * 5) calc(var(--nyan-cat-dot-size) * 4),
      calc(var(--nyan-cat-dot-size) * 3) calc(var(--nyan-cat-dot-size) * 2);
  }

  /* flip right ear horizontally */
  .head:after {
    right: 0;
    transform: scaleX(-1);
    -webkit-transform: scaleX(-1);
  }

  /* eyes, cheeks, nose and mouth */
  .face {
    width: var(--nyan-cat-head-width);
    height: 100%;
    position: absolute;
    top: var(--nyan-cat-dot-size);
    background:
      linear-gradient(white, white) no-repeat,
      linear-gradient(white, white) no-repeat,
      linear-gradient(#f99, #f99) no-repeat,
      linear-gradient(#f99, #f99) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat;
    background-size:
      // eyes white dot
      var(--nyan-cat-dot-size) var(--nyan-cat-dot-size),
      var(--nyan-cat-dot-size) var(--nyan-cat-dot-size),
      // cheeks
      calc(var(--nyan-cat-dot-size) * 2) calc(var(--nyan-cat-dot-size) * 2),
      calc(var(--nyan-cat-dot-size) * 2) calc(var(--nyan-cat-dot-size) * 2),
      // eyes
      calc(var(--nyan-cat-dot-size) * 2) calc(var(--nyan-cat-dot-size) * 2),
      calc(var(--nyan-cat-dot-size) * 2) calc(var(--nyan-cat-dot-size) * 2),
      // nose
      var(--nyan-cat-dot-size) var(--nyan-cat-dot-size),
      // mouth
      var(--nyan-cat-dot-size) var(--nyan-cat-dot-size),
      var(--nyan-cat-dot-size) var(--nyan-cat-dot-size),
      var(--nyan-cat-dot-size) var(--nyan-cat-dot-size);
    background-position:
      // eyes white dot
      calc(var(--nyan-cat-head-width) * 0.25 - var(--nyan-cat-dot-size) * 0.5) 0,
      calc(var(--nyan-cat-head-width) * 0.75 - var(--nyan-cat-dot-size) * 0.5) 0,
      // cheeks
      var(--nyan-cat-dot-size) calc(var(--nyan-cat-head-height) * 0.4),
      calc(var(--nyan-cat-head-width) - var(--nyan-cat-dot-size) * 2)
        calc(var(--nyan-cat-head-height) * 0.4),
      // eyes
      calc(var(--nyan-cat-head-width) * 0.25 - var(--nyan-cat-dot-size) * 0.5) 0,
      calc(var(--nyan-cat-head-width) * 0.75 - var(--nyan-cat-dot-size) * 0.5) 0,
      // nose
      calc(var(--nyan-cat-head-width) * 0.5) var(--nyan-cat-dot-size),
      // mouth
      calc(var(--nyan-cat-head-width) * 0.25 + var(--nyan-cat-dot-size) * 0.5)
        calc(var(--nyan-cat-head-height) * 0.6),
      calc(var(--nyan-cat-head-width) * 0.5) calc(var(--nyan-cat-head-height) * 0.6),
      calc(var(--nyan-cat-head-width) * 0.75 - var(--nyan-cat-dot-size) * 0.5)
        calc(var(--nyan-cat-head-height) * 0.6);
  }

  /* chin area */
  .face:before {
    bottom: calc(var(--nyan-cat-dot-size) * -2);
    width: 100%;
    height: calc(var(--nyan-cat-dot-size) * 3);
    background:
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(#999, #999) no-repeat,
      linear-gradient(#999, #999) no-repeat;
    background-size:
      // chin border
      var(--nyan-cat-dot-size) var(--nyan-cat-dot-size),
      var(--nyan-cat-dot-size) var(--nyan-cat-dot-size),
      var(--nyan-cat-dot-size) var(--nyan-cat-dot-size),
      var(--nyan-cat-dot-size) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-head-width) - var(--nyan-cat-dot-size) * 4) var(--nyan-cat-dot-size),
      // mouth horizontal line
      calc(var(--nyan-cat-head-width) * 0.5) var(--nyan-cat-dot-size),
      // chin fill
      calc(var(--nyan-cat-head-width) - var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-head-width) - var(--nyan-cat-dot-size) * 4) var(--nyan-cat-dot-size);
    background-position:
      // chin border
      0 0,
      var(--nyan-cat-dot-size) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-head-width) - var(--nyan-cat-dot-size)) 0,
      calc(var(--nyan-cat-head-width) - var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-dot-size) * 2) calc(var(--nyan-cat-dot-size) * 2),
      // mouth horizontal line
      calc(var(--nyan-cat-head-width) * 0.25 + var(--nyan-cat-dot-size) * 0.5) 0,
      // chin fill
      var(--nyan-cat-dot-size) 0,
      calc(var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size);
  }

  /* head position */
  .frame1 .head,
  .frame5 .head {
    bottom: calc(var(--nyan-cat-paws-height) + var(--nyan-cat-dot-size));
    right: 0;
  }
  .frame2 .head,
  .frame3 .head,
  .frame4 .head {
    bottom: calc(var(--nyan-cat-paws-height) + var(--nyan-cat-dot-size));
    right: calc(var(--nyan-cat-dot-size) * -1);
  }
  .frame6 .head {
    bottom: calc(var(--nyan-cat-paws-height) + var(--nyan-cat-dot-size) * 2);
    right: 0;
  }

  /* paws */
  .paws {
    width: var(--nyan-cat-paws-width);
    height: var(--nyan-cat-paws-height);
    position: absolute;
    bottom: 0;
    left: calc(var(--nyan-cat-tail-width) - var(--nyan-cat-dot-size));
    background:
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat;
    background-size: calc(var(--nyan-cat-dot-size) * 3) calc(var(--nyan-cat-dot-size) * 3);
  }
  .frame1 .paws,
  .frame5 .paws {
    background-position:
      var(--nyan-cat-paws-1x) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-paws-1x) + var(--nyan-cat-dot-size)) 0,
      var(--nyan-cat-paws-2x) 0,
      calc(var(--nyan-cat-paws-2x) + var(--nyan-cat-dot-size)) var(--nyan-cat-dot-size),
      var(--nyan-cat-paws-3x) 0,
      calc(var(--nyan-cat-paws-3x) + var(--nyan-cat-dot-size)) var(--nyan-cat-dot-size),
      var(--nyan-cat-paws-4x) 0,
      calc(var(--nyan-cat-paws-4x) + var(--nyan-cat-dot-size)) var(--nyan-cat-dot-size);
  }
  .frame2 .paws,
  .frame4 .paws {
    background-position:
      calc(var(--nyan-cat-paws-1x) + var(--nyan-cat-dot-size)) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-paws-1x) + var(--nyan-cat-dot-size) * 2) 0,
      calc(var(--nyan-cat-paws-2x) + var(--nyan-cat-dot-size)) 0,
      calc(var(--nyan-cat-paws-2x) + var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size),
      var(--nyan-cat-paws-3x) 0,
      calc(var(--nyan-cat-paws-3x) + var(--nyan-cat-dot-size)) var(--nyan-cat-dot-size),
      var(--nyan-cat-paws-4x) 0,
      calc(var(--nyan-cat-paws-4x) + var(--nyan-cat-dot-size)) var(--nyan-cat-dot-size);
  }
  .frame3 .paws {
    background-position:
      calc(var(--nyan-cat-paws-1x) + var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-paws-1x) + var(--nyan-cat-dot-size) * 3) 0,
      calc(var(--nyan-cat-paws-2x) + var(--nyan-cat-dot-size) * 2) 0,
      calc(var(--nyan-cat-paws-2x) + var(--nyan-cat-dot-size) * 3) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-paws-3x) + var(--nyan-cat-dot-size)) 0,
      calc(var(--nyan-cat-paws-3x) + var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-paws-4x) + var(--nyan-cat-dot-size)) 0,
      calc(var(--nyan-cat-paws-4x) + var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size);
  }
  .frame6 .paws {
    background-position:
      var(--nyan-cat-paws-1x) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-paws-1x) + var(--nyan-cat-dot-size)) 0,
      calc(var(--nyan-cat-paws-2x) + var(--nyan-cat-dot-size)) 0,
      var(--nyan-cat-paws-2x) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-paws-3x) + var(--nyan-cat-dot-size)) 0,
      var(--nyan-cat-paws-3x) var(--nyan-cat-dot-size),
      var(--nyan-cat-paws-4x) 0,
      calc(var(--nyan-cat-paws-4x) + var(--nyan-cat-dot-size)) var(--nyan-cat-dot-size);
  }

  .paws:before {
    width: 100%;
    height: 100%;
    background:
      linear-gradient(#999, #999) no-repeat,
      linear-gradient(#999, #999) no-repeat,
      linear-gradient(#999, #999) no-repeat,
      linear-gradient(#999, #999) no-repeat;
    background-size: calc(var(--nyan-cat-dot-size) * 2) calc(var(--nyan-cat-dot-size) * 2);
  }
  .frame1 .paws:before,
  .frame5 .paws:before,
  .frame6 .paws:before {
    background-position:
      calc(var(--nyan-cat-paws-1x) + var(--nyan-cat-dot-size)) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-paws-2x) + var(--nyan-cat-dot-size)) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-paws-3x) + var(--nyan-cat-dot-size)) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-paws-4x) + var(--nyan-cat-dot-size)) var(--nyan-cat-dot-size);
  }
  .frame3 .paws:before {
    background-position:
      calc(var(--nyan-cat-paws-1x) + var(--nyan-cat-dot-size) * 3) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-paws-2x) + var(--nyan-cat-dot-size) * 3) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-paws-3x) + var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-paws-4x) + var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size);
  }
  .frame2 .paws:before,
  .frame4 .paws:before {
    background-position:
      calc(var(--nyan-cat-paws-1x) + var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-paws-2x) + var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-paws-3x) + var(--nyan-cat-dot-size)) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-paws-4x) + var(--nyan-cat-dot-size)) var(--nyan-cat-dot-size);
  }

  /* tail */
  .tail {
    width: var(--nyan-cat-tail-width);
    height: var(--nyan-cat-tail-height);
    position: absolute;
    left: 0;
    bottom: var(--nyan-cat-paws-height);
  }

  /* FRAME 1 */
  .frame1 .tail {
    background:
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat;
    background-size: calc(var(--nyan-cat-dot-size) * 4) calc(var(--nyan-cat-dot-size) * 3);
    background-position:
      var(--nyan-cat-dot-size) 0,
      calc(var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-dot-size) * 3) calc(var(--nyan-cat-dot-size) * 2),
      calc(var(--nyan-cat-dot-size) * 4) calc(var(--nyan-cat-dot-size) * 3),
      calc(var(--nyan-cat-dot-size) * 5) calc(var(--nyan-cat-dot-size) * 4);
  }

  .frame1 .tail:before {
    width: calc(var(--nyan-cat-tail-width) - var(--nyan-cat-dot-size) * 2);
    height: calc(var(--nyan-cat-dot-size) * 5);
    right: 0;
    top: var(--nyan-cat-dot-size);
    background:
      linear-gradient(#999, #999) no-repeat,
      linear-gradient(#999, #999) no-repeat,
      linear-gradient(#999, #999) no-repeat,
      linear-gradient(#999, #999) no-repeat,
      linear-gradient(#999, #999) no-repeat;
    background-size: calc(var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size);
    background-position:
      0 0,
      var(--nyan-cat-dot-size) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-dot-size) * 2) calc(var(--nyan-cat-dot-size) * 2),
      calc(var(--nyan-cat-dot-size) * 3) calc(var(--nyan-cat-dot-size) * 3),
      calc(var(--nyan-cat-dot-size) * 4) calc(var(--nyan-cat-dot-size) * 4);
  }

  /* FRAMES 2 AND 6 */
  .frame2 .tail,
  .frame6 .tail {
    background:
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat;
    background-size:
      calc(var(--nyan-cat-dot-size) * 2) calc(var(--nyan-cat-dot-size) * 4),
      calc(var(--nyan-cat-dot-size) * 2) calc(var(--nyan-cat-dot-size) * 4),
      calc(var(--nyan-cat-dot-size) * 2) calc(var(--nyan-cat-dot-size) * 4),
      var(--nyan-cat-dot-size) calc(var(--nyan-cat-dot-size) * 2);
    background-position:
      calc(var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-dot-size) * 3) calc(var(--nyan-cat-dot-size) * 2),
      calc(var(--nyan-cat-dot-size) * 5) calc(var(--nyan-cat-dot-size) * 3),
      var(--nyan-cat-dot-size) calc(var(--nyan-cat-dot-size) * 2);
  }

  .frame2 .tail:before,
  .frame6 .tail:before {
    width: calc(var(--nyan-cat-dot-size) * 5);
    height: calc(var(--nyan-cat-dot-size) * 4);
    left: calc(var(--nyan-cat-dot-size) * 2);
    top: calc(var(--nyan-cat-dot-size) * 2);
    background:
      linear-gradient(#999, #999) no-repeat,
      linear-gradient(#999, #999) no-repeat,
      linear-gradient(#999, #999) no-repeat,
      linear-gradient(#999, #999) no-repeat,
      linear-gradient(#999, #999) no-repeat;
    background-size: calc(var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size);
    background-position:
      0 0,
      0 var(--nyan-cat-dot-size),
      var(--nyan-cat-dot-size) calc(var(--nyan-cat-dot-size) * 2),
      calc(var(--nyan-cat-dot-size) * 3) calc(var(--nyan-cat-dot-size) * 2),
      calc(var(--nyan-cat-dot-size) * 3) calc(var(--nyan-cat-dot-size) * 3);
  }

  /* FRAME 3 */
  .frame3 .tail {
    background:
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat;
    background-size:
      calc(var(--nyan-cat-dot-size) * 4) calc(var(--nyan-cat-dot-size) * 2),
      calc(var(--nyan-cat-dot-size) * 4) calc(var(--nyan-cat-dot-size) * 2),
      calc(var(--nyan-cat-dot-size) * 4) calc(var(--nyan-cat-dot-size) * 2),
      var(--nyan-cat-dot-size) calc(var(--nyan-cat-dot-size) * 4);
    background-position:
      calc(var(--nyan-cat-dot-size) * 3) calc(var(--nyan-cat-dot-size) * 4),
      var(--nyan-cat-dot-size) calc(var(--nyan-cat-dot-size) * 5),
      calc(var(--nyan-cat-dot-size) * 2) calc(var(--nyan-cat-dot-size) * 6),
      calc(var(--nyan-cat-dot-size) * 6) calc(var(--nyan-cat-dot-size) * 3);
  }

  .frame3 .tail:before {
    width: calc(var(--nyan-cat-dot-size) * 5);
    height: calc(var(--nyan-cat-dot-size) * 2);
    top: calc(var(--nyan-cat-dot-size) * 5);
    right: 0;
    background:
      linear-gradient(#999, #999) no-repeat,
      linear-gradient(#999, #999) no-repeat;
    background-size:
      calc(var(--nyan-cat-dot-size) * 4) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-dot-size) * 3) var(--nyan-cat-dot-size);
    background-position:
      var(--nyan-cat-dot-size) 0,
      0 var(--nyan-cat-dot-size);
  }

  /* FRAME 4 */
  .frame4 .tail {
    background:
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat;
    background-size:
      calc(var(--nyan-cat-dot-size) * 2) calc(var(--nyan-cat-dot-size) * 4),
      calc(var(--nyan-cat-dot-size) * 2) calc(var(--nyan-cat-dot-size) * 4),
      calc(var(--nyan-cat-dot-size) * 2) calc(var(--nyan-cat-dot-size) * 4),
      var(--nyan-cat-dot-size) calc(var(--nyan-cat-dot-size) * 2);
    background-position:
      calc(var(--nyan-cat-dot-size) * 5) calc(var(--nyan-cat-dot-size) * 3),
      calc(var(--nyan-cat-dot-size) * 3) calc(var(--nyan-cat-dot-size) * 4),
      calc(var(--nyan-cat-dot-size) * 2) calc(var(--nyan-cat-dot-size) * 5),
      var(--nyan-cat-dot-size) calc(var(--nyan-cat-dot-size) * 6);
  }

  .frame4 .tail:before {
    width: calc(var(--nyan-cat-dot-size) * 5);
    height: calc(var(--nyan-cat-dot-size) * 4);
    top: calc(var(--nyan-cat-dot-size) * 4);
    right: 0;
    background:
      linear-gradient(#999, #999) no-repeat,
      linear-gradient(#999, #999) no-repeat,
      linear-gradient(#999, #999) no-repeat;
    background-size:
      calc(var(--nyan-cat-dot-size) * 2) calc(var(--nyan-cat-dot-size) * 2),
      calc(var(--nyan-cat-dot-size) * 2) calc(var(--nyan-cat-dot-size) * 2),
      calc(var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size);
    background-position:
      calc(var(--nyan-cat-dot-size) * 3) 0,
      0 calc(var(--nyan-cat-dot-size) * 2),
      var(--nyan-cat-dot-size) var(--nyan-cat-dot-size);
  }

  /* FRAME 5 */
  .frame5 .tail {
    background:
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat,
      linear-gradient(black, black) no-repeat;
    background-size:
      calc(var(--nyan-cat-dot-size) * 4) calc(var(--nyan-cat-dot-size) * 3),
      calc(var(--nyan-cat-dot-size) * 4) calc(var(--nyan-cat-dot-size) * 3),
      var(--nyan-cat-dot-size) calc(var(--nyan-cat-dot-size) * 2),
      var(--nyan-cat-dot-size) calc(var(--nyan-cat-dot-size) * 2),
      calc(var(--nyan-cat-dot-size) * 2) var(--nyan-cat-dot-size);
    background-position:
      var(--nyan-cat-dot-size) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-dot-size) * 2) calc(var(--nyan-cat-dot-size) * 2),
      0 calc(var(--nyan-cat-dot-size) * 2),
      calc(var(--nyan-cat-dot-size) * 6) calc(var(--nyan-cat-dot-size) * 2),
      calc(var(--nyan-cat-dot-size) * 5) calc(var(--nyan-cat-dot-size) * 5);
  }

  .frame5 .tail:before {
    width: calc(var(--nyan-cat-dot-size) * 6);
    height: calc(var(--nyan-cat-dot-size) * 3);
    top: calc(var(--nyan-cat-dot-size) * 2);
    right: 0;
    background:
      linear-gradient(#999, #999) no-repeat,
      linear-gradient(#999, #999) no-repeat,
      linear-gradient(#999, #999) no-repeat;
    background-size:
      calc(var(--nyan-cat-dot-size) * 3) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-dot-size) * 4) var(--nyan-cat-dot-size),
      var(--nyan-cat-dot-size) var(--nyan-cat-dot-size);
    background-position:
      0 0,
      var(--nyan-cat-dot-size) var(--nyan-cat-dot-size),
      calc(var(--nyan-cat-dot-size) * 5) calc(var(--nyan-cat-dot-size) * 2);
  }
}
</style>

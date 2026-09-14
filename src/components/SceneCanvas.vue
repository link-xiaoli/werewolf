<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ThreeManager } from '../three/three-manager'
import { useGameStore } from '../store/game-store'

const game = useGameStore()
const cv = ref<HTMLCanvasElement | null>(null)
let manager: ThreeManager | null = null

onMounted(() => {
  if (!cv.value || !game.state) return
  manager = new ThreeManager(cv.value, () => game.state!)
})

onUnmounted(() => {
  manager?.dispose()
  manager = null
})
</script>

<template>
  <div class="scene-wrap">
    <canvas ref="cv" />
  </div>
</template>

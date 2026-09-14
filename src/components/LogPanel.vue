<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useGameStore } from '../store/game-store'

const game = useGameStore()
const listEl = ref<HTMLDivElement | null>(null)

watch(
  () => game.state?.log.length,
  async () => {
    await nextTick()
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
  },
)
</script>

<template>
  <div class="log-panel card" v-if="game.state">
    <div class="log-title">对 局 记 录</div>
    <div class="ornament">·</div>
    <div class="log-list" ref="listEl">
      <div v-for="(l, i) in game.state.log" :key="i" class="log-line" :class="l.kind">
        <span class="log-time">{{ l.time }}</span>
        <span>{{ l.text }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../store/game-store'

const game = useGameStore()
const req = computed(() => game.state?.pendingHumanAction ?? null)
const gs = computed(() => game.state)

function name(id: number): string {
  return gs.value?.players[id]?.name ?? `${id + 1}号`
}
</script>

<template>
  <div v-if="req?.type === 'vote'" class="modal-mask">
    <div class="modal">
      <h3>投票 · 选择放逐目标</h3>
      <div class="ornament">·</div>
      <div class="target-grid">
        <button v-for="id in req.targets" :key="id" class="target-btn" @click="game.submitVote(id)">
          {{ name(id) }}
        </button>
      </div>
      <div class="modal-actions">
        <button class="ghost" @click="game.submitVote(null)">弃权</button>
      </div>
    </div>
  </div>
</template>

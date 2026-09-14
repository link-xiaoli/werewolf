<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../store/game-store'
import { Camp, Phase, ROLE_INFO } from '../types/game'

const game = useGameStore()
const gs = computed(() => game.state)

const winText = computed(() =>
  gs.value?.winner === Camp.Good ? '好人阵营获胜' : gs.value?.winner === Camp.Wolf ? '狼人阵营获胜' : '',
)
</script>

<template>
  <div v-if="gs?.phase === Phase.GameOver" class="modal-mask">
    <div class="modal result">
      <h3 class="display-title">{{ winText }}</h3>
      <div class="ornament">◆</div>
      <p class="sub">共 {{ gs.round }} 轮 · {{ gs.history.length }} 条发言</p>
      <div class="player-grid">
        <div v-for="p in gs.players" :key="p.id" class="player-cell" :class="p.role === 'werewolf' ? 'wolf' : 'good'">
          <span class="p-name">{{ p.name }}{{ p.isHuman ? '(你)' : '' }}</span>
          <span class="p-role">{{ ROLE_INFO[p.role].name }}</span>
        </div>
      </div>
      <div class="modal-actions">
        <button class="ghost" @click="game.quitGame()">返回设置</button>
        <button class="primary" @click="game.restart()">再来一局</button>
      </div>
    </div>
  </div>
</template>

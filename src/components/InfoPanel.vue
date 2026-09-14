<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../store/game-store'
import { ROLE_INFO, Role, type Player } from '../types/game'

const game = useGameStore()

type PanelData = {
  me: Player
  partners: string
  aliveText: string
  revealedText: string
}

const data = computed<PanelData | null>(() => {
  const gs = game.state
  const me = game.ownPlayer
  if (!gs || !me) return null
  const partners = gs.players
    .filter((p) => p.role === Role.Werewolf && p.id !== me.id)
    .map((p) => p.name)
    .join('、')
  const aliveText = gs.players.filter((p) => p.alive).map((p) => p.name).join('、')
  const revealedText = gs.players
    .filter((p) => !p.alive && p.revealed)
    .map((p) => `${p.name}(${ROLE_INFO[p.role].name})`)
    .join('、')
  return { me, partners, aliveText, revealedText }
})
</script>

<template>
  <div class="info-panel card" v-if="data">
    <div class="my-role" :class="data.me.role === Role.Werewolf ? 'wolf' : 'good'">
      <div class="role-stamp">{{ ROLE_INFO[data.me.role].name }}</div>
      <div class="role-desc">{{ ROLE_INFO[data.me.role].desc }}</div>
      <div v-if="data.me.role === Role.Werewolf" class="partners">狼队友:{{ data.partners }}</div>
      <div v-if="data.me.role === Role.Witch" class="skills">
        解药 {{ data.me.healLeft }} 瓶 · 毒药 {{ data.me.poisonLeft }} 瓶
      </div>
    </div>
    <div class="alive-line">存活:{{ data.aliveText }}</div>
    <div class="revealed-line" v-if="data.revealedText">已亮身份:{{ data.revealedText }}</div>
  </div>
</template>

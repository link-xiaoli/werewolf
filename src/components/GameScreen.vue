<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../store/game-store'
import { Phase } from '../types/game'
import SceneCanvas from './SceneCanvas.vue'
import InfoPanel from './InfoPanel.vue'
import LogPanel from './LogPanel.vue'
import SpeechPanel from './SpeechPanel.vue'
import NightActionPanel from './NightActionPanel.vue'
import VotePanel from './VotePanel.vue'
import ResultModal from './ResultModal.vue'

const game = useGameStore()

const PHASE_TEXT: Record<Phase, string> = {
  [Phase.Setup]: '配置',
  [Phase.Night]: '夜 晚',
  [Phase.Dawn]: '天 亮',
  [Phase.Discussion]: '发 言',
  [Phase.Vote]: '投 票',
  [Phase.Exile]: '放 逐',
  [Phase.Dusk]: '黄 昏',
  [Phase.GameOver]: '终 局',
}

const phaseText = computed(() => (game.state ? PHASE_TEXT[game.state.phase] : ''))
</script>

<template>
  <div class="game-screen" v-if="game.state">
    <SceneCanvas :key="game.gameId" />

    <div class="top-bar">
      <span class="phase-plaque">{{ phaseText }}</span>
      <span class="round-plaque">第 {{ game.state.round }} 天</span>
      <div class="spacer" />
      <button class="ghost small" @click="game.skipSpeech()">跳过语音</button>
      <button class="ghost small" @click="game.quitGame()">退出</button>
    </div>

    <InfoPanel />
    <LogPanel />
    <SpeechPanel />
    <NightActionPanel />
    <VotePanel />
    <ResultModal />
  </div>
</template>

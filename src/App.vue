<script setup lang="ts">
import { useGameStore } from './store/game-store'
import SetupScreen from './components/SetupScreen.vue'
import GameScreen from './components/GameScreen.vue'

const game = useGameStore()
</script>

<template>
  <SetupScreen v-if="!game.state" />
  <GameScreen v-else />
</template>

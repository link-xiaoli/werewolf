<script setup lang="ts">
import { ref } from 'vue'
import { useGameStore } from '../store/game-store'

const game = useGameStore()
const text = ref('')
const speakIt = ref(true)

function submit(skip: boolean): void {
  game.submitSpeech(text.value, skip, speakIt.value)
  text.value = ''
}
</script>

<template>
  <div class="speech-panel card" v-if="game.state?.pendingHumanAction?.type === 'speech'">
    <div class="speech-title">轮到你发言</div>
    <div class="ornament">·</div>
    <textarea v-model="text" rows="2" maxlength="300" placeholder="写下你的发言…"></textarea>
    <div class="speech-actions">
      <label class="speak-toggle"><input v-model="speakIt" type="checkbox" /> 朗读我的发言</label>
      <div class="spacer" />
      <button class="ghost" @click="submit(true)">跳过</button>
      <button class="primary" :disabled="!text.trim()" @click="submit(false)">发言</button>
    </div>
  </div>
</template>

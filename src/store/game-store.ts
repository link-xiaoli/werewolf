/** 对局 store:唯一状态源。组件只调 action,对局走向由 flow/runner 决定。 */

import { computed, reactive, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { PRESETS } from '../config/presets'
import { createInitialState } from '../game/engine'
import { runGame } from '../game/flow/runner'
import { CancelToken } from '../game/flow/flow-utils'
import { Secrets } from '../game/secrets'
import type { AppSettings } from '../services/settings'
import { IflytekTts } from '../services/speech/iflytek-tts'
import { SilentTts } from '../services/speech/silent-tts'
import { SpeechQueue } from '../services/speech/speech-queue'
import { Role, type GameConfig, type GameState, type HumanActionPayload } from '../types/game'
import { emit } from '../utils/emitter'
import { useSettingsStore } from './settings-store'

function buildSpeechService(s: AppSettings): IflytekTts | SilentTts {
  // 关闭语音 = 快进模式(文字版/调试)
  if (!s.tts.enabled) return new SilentTts(true)
  // 讯飞配置齐全 → 真语音;缺配置 → 正常节奏静音(文字版兜底)
  if (s.tts.provider === 'iflytek' && s.tts.appId && s.tts.apiKey && s.tts.apiSecret) {
    return new IflytekTts({
      appId: s.tts.appId,
      apiKey: s.tts.apiKey,
      apiSecret: s.tts.apiSecret,
      speed: s.tts.speed,
    })
  }
  return new SilentTts(false)
}

export const useGameStore = defineStore('game', () => {
  /** 对局状态(reactive 深层代理,flow 直接修改它,组件自动重绘) */
  const state = shallowRef<GameState | null>(null)
  const speechQueue = shallowRef<SpeechQueue | null>(null)
  /** 局号:每开局 +1,组件用它做 key 强制重建 3D 场景 */
  const gameId = ref(0)

  // 非响应式内部字段
  let token: CancelToken | null = null
  let config: GameConfig | null = null

  const ownPlayer = computed(() => state.value?.players.find((p) => p.isHuman) ?? null)
  const isSpectator = computed(() => state.value !== null && !state.value.players.some((p) => p.isHuman))

  function abortCurrent(): void {
    token?.cancel()
    speechQueue.value?.clear()
    token = null
    speechQueue.value = null
  }

  /** 开局:创建状态与流程依赖,后台跑对局主循环 */
  function startGame(cfg: GameConfig): void {
    abortCurrent()
    config = cfg
    const settings = useSettingsStore().s
    const gs = reactive(createInitialState(cfg))
    const secrets = new Secrets()
    secrets.setWolfPartners(gs.players.filter((p) => p.role === Role.Werewolf).map((p) => p.id))
    const tk = new CancelToken()
    // 整局共享同一个 TTS 实例:stop() 才能停掉真正在播放的音频
    const queue = new SpeechQueue(buildSpeechService(settings))
    state.value = gs
    speechQueue.value = queue
    token = tk
    gameId.value += 1
    void runGame({ state: gs, secrets, settings, config: cfg, speechQueue: queue, token: tk })
  }

  /** 退出对局:取消流程并回到设置页 */
  function quitGame(): void {
    abortCurrent()
    state.value = null
  }

  /** 再来一局:用相同配置重开 */
  function restart(): void {
    if (config) startGame({ ...config })
  }

  // —— 玩家交互(组件 → 事件总线 → flow 醒来)—— //

  function submitSpeech(text: string, skip: boolean, speakIt: boolean): void {
    if (state.value?.pendingHumanAction?.type !== 'speech') return
    emit('player:speech-submitted', { text, skip, speakIt })
  }

  function submitVote(targetId: number | null): void {
    if (state.value?.pendingHumanAction?.type !== 'vote') return
    emit('player:vote-submitted', { targetId })
  }

  function submitNightAction(payload: HumanActionPayload): void {
    if (!state.value?.pendingHumanAction) return
    emit('player:night-action', payload)
  }

  /** 跳过当前语音播放 */
  function skipSpeech(): void {
    emit('skip-speech', undefined)
    speechQueue.value?.skipCurrent()
  }

  /** 调试:连续自动跑 n 局(全 AI、随机决策、静音快进),验收 M2"20 局不死锁" */
  async function debugAutoRun(count: number): Promise<void> {
    const settings = useSettingsStore().s
    const base: GameConfig = {
      roles: PRESETS[0].roles,
      playerName: '',
      playerSeat: 0,
      spectator: true,
      lastWordsEnabled: true,
      interjectEnabled: false,
      witchSelfHeal: true,
      humanManual: false,
    }
    for (let i = 1; i <= count; i++) {
      const gs = createInitialState(base)
      const secrets = new Secrets()
      secrets.setWolfPartners(gs.players.filter((p) => p.role === Role.Werewolf).map((p) => p.id))
      const tk = new CancelToken()
      const queue = new SpeechQueue(new SilentTts(true))
      const t0 = performance.now()
      await runGame({ state: gs, secrets, settings, config: base, speechQueue: queue, token: tk })
      const secs = ((performance.now() - t0) / 1000).toFixed(1)
      console.log(
        `[debug] 第 ${i}/${count} 局完成:胜者=${gs.winner},共 ${gs.round} 轮,用时 ${secs}s,发言 ${gs.history.length} 条`,
      )
    }
  }

  return {
    state,
    speechQueue,
    gameId,
    ownPlayer,
    isSpectator,
    startGame,
    quitGame,
    restart,
    submitSpeech,
    submitVote,
    submitNightAction,
    skipSpeech,
    debugAutoRun,
  }
})

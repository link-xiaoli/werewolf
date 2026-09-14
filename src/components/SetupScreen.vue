<script setup lang="ts">
import { computed, ref } from 'vue'
import { PRESETS, ROLE_COUNT_OPTIONS, validateRoles } from '../config/presets'
import { chatJson } from '../services/llm/llm-service'
import { IflytekTts } from '../services/speech/iflytek-tts'
import { useGameStore } from '../store/game-store'
import { useSettingsStore } from '../store/settings-store'
import { Role, type GameConfig } from '../types/game'

const game = useGameStore()
const settings = useSettingsStore()
const s = computed(() => settings.s)

const playerName = ref(s.value.game.playerName)
const playerSeat = ref(0)
const spectator = ref(false)
const error = ref('')

// 自定义角色数量(用索引访问避免 ref 解包问题)
const counts = ref(ROLE_COUNT_OPTIONS.map((o) => o.defaultCount))

function applyPreset(roles: Role[]): void {
  counts.value = ROLE_COUNT_OPTIONS.map((o) => roles.filter((r) => r === o.role).length)
}

function bump(i: number, d: number): void {
  const opt = ROLE_COUNT_OPTIONS[i]
  const next = Math.min(opt.max, Math.max(opt.min, counts.value[i] + d))
  counts.value[i] = next
}

const total = computed(() => counts.value.reduce((a, b) => a + b, 0))
const roles = computed<Role[]>(() =>
  ROLE_COUNT_OPTIONS.flatMap((o, i) => Array(counts.value[i]).fill(o.role) as Role[]),
)

const seats = computed(() => Array.from({ length: Math.max(total.value, 5) }, (_, i) => i + 1))

function start(): void {
  const v = validateRoles(roles.value)
  if (v) {
    error.value = v
    return
  }
  error.value = ''
  settings.updateGame({ playerName: playerName.value || '我' })
  const cfg: GameConfig = {
    roles: roles.value,
    playerName: playerName.value || '我',
    playerSeat: spectator.value ? 0 : Math.min(playerSeat.value - 1, total.value - 1),
    spectator: spectator.value,
    lastWordsEnabled: s.value.game.lastWordsEnabled,
    interjectEnabled: s.value.game.interjectEnabled,
    witchSelfHeal: s.value.game.witchSelfHeal,
    humanManual: true,
  }
  game.startGame(cfg)
}

// —— API 连通性测试 ——
const testStatus = ref('')
const testing = ref(false)

async function testLlm(): Promise<void> {
  const c = s.value.llm
  if (!c.apiKey) {
    testStatus.value = '请先填写 DeepSeek Key'
    return
  }
  testing.value = true
  testStatus.value = '正在测试 DeepSeek 连接…'
  try {
    const reply = await chatJson(
      [
        { role: 'system', content: '你是一个连通性测试,只输出 JSON 格式:{"result":"成功"}' },
        { role: 'user', content: '测试连接' },
      ],
      { baseUrl: c.baseUrl, apiKey: c.apiKey, model: c.model, temperature: 0, maxTokens: 30 },
    )
    testStatus.value = `DeepSeek 连接成功(模型回复:${reply.slice(0, 20)})`
  } catch (e) {
    testStatus.value = `连接失败:${e instanceof Error ? e.message : String(e)}`
  } finally {
    testing.value = false
  }
}

async function testTts(): Promise<void> {
  const c = s.value.tts
  if (!c.appId || !c.apiKey || !c.apiSecret) {
    testStatus.value = '请先填写讯飞三件套(AppId/ApiKey/ApiSecret)'
    return
  }
  testing.value = true
  testStatus.value = '正在测试讯飞发音…'
  const tts = new IflytekTts({ appId: c.appId, apiKey: c.apiKey, apiSecret: c.apiSecret, speed: c.speed })
  try {
    await tts.speak('你好,这是AI狼人杀的语音测试。')
    testStatus.value = '讯飞发音成功(若没有听到声音请检查扬声器)'
  } catch (e) {
    testStatus.value = `发音失败:${e instanceof Error ? e.message : String(e)}`
  } finally {
    tts.dispose()
    testing.value = false
  }
}
</script>

<template>
  <div class="setup">
    <h1 class="setup-title display-title">AI 狼人杀</h1>
    <p class="sub">你与 AI 玩家围坐圆桌 · 大模型驱动 · 语音朗读</p>
    <div class="ornament">◆</div>

    <section class="card">
      <h2 class="card-title">对局设置</h2>
      <div class="ornament">·</div>

      <div class="row">
        <label>你的昵称</label>
        <input v-model="playerName" type="text" maxlength="12" placeholder="我" />
      </div>
      <div class="row">
        <label>你的座位</label>
        <select v-model="playerSeat" :disabled="spectator">
          <option v-for="n in seats" :key="n" :value="n">{{ n }} 号位</option>
        </select>
      </div>

      <div class="row wrap">
        <label>人数预设</label>
        <button v-for="p in PRESETS" :key="p.key" class="chip" @click="applyPreset(p.roles)">
          {{ p.label }}
        </button>
      </div>

      <div class="role-grid">
        <div v-for="(o, i) in ROLE_COUNT_OPTIONS" :key="o.role" class="role-item">
          <span>{{ o.label }}</span>
          <button class="stepper" @click="bump(i, -1)">−</button>
          <b>{{ counts[i] }}</b>
          <button class="stepper" @click="bump(i, 1)">＋</button>
        </div>
      </div>
      <p class="total-line">共 <b>{{ total }}</b> 人</p>

      <div class="checks">
        <label><input v-model="spectator" type="checkbox" /> 观战模式(全 AI 自动玩)</label>
        <label><input :checked="!s.tts.enabled" type="checkbox" @change="settings.updateTts({ enabled: !($event.target as HTMLInputElement).checked })" /> 快速模式(不朗读语音)</label>
        <label><input :checked="s.game.lastWordsEnabled" type="checkbox" @change="settings.updateGame({ lastWordsEnabled: ($event.target as HTMLInputElement).checked })" /> 死者遗言</label>
        <label><input :checked="s.game.interjectEnabled" type="checkbox" @change="settings.updateGame({ interjectEnabled: ($event.target as HTMLInputElement).checked })" /> AI 自由插话(发言中举手打断)</label>
      </div>
    </section>

    <section class="card">
      <h2 class="card-title">API 设置</h2>
      <div class="ornament">·</div>

      <div class="row">
        <label>DeepSeek Key</label>
        <input :value="s.llm.apiKey" type="password" placeholder="sk-..." @input="settings.updateLlm({ apiKey: ($event.target as HTMLInputElement).value })" />
      </div>
      <div class="row">
        <label>模型</label>
        <input :value="s.llm.model" type="text" placeholder="deepseek-flash" @input="settings.updateLlm({ model: ($event.target as HTMLInputElement).value })" />
      </div>
      <div class="row">
        <label>Base URL</label>
        <input :value="s.llm.baseUrl" type="text" @input="settings.updateLlm({ baseUrl: ($event.target as HTMLInputElement).value })" />
      </div>
      <div class="row">
        <label>重试 · 并发</label>
        <input
          :value="s.llm.retryAttempts"
          type="number"
          min="1"
          max="6"
          style="width: 70px"
          @input="settings.updateLlm({ retryAttempts: parseInt(($event.target as HTMLInputElement).value) || 3 })"
        />
        <span style="font-size: 13px; color: var(--ink-soft)">次</span>
        <input
          :value="s.llm.maxConcurrency"
          type="number"
          min="1"
          max="10"
          style="width: 70px"
          @input="settings.updateLlm({ maxConcurrency: parseInt(($event.target as HTMLInputElement).value) || 4 })"
        />
        <span style="font-size: 13px; color: var(--ink-soft)">路并发</span>
      </div>
      <div class="row">
        <label>讯飞 AppId</label>
        <input :value="s.tts.appId" type="text" placeholder="语音合成应用 appid" @input="settings.updateTts({ appId: ($event.target as HTMLInputElement).value })" />
      </div>
      <div class="row">
        <label>讯飞 ApiKey</label>
        <input :value="s.tts.apiKey" type="password" @input="settings.updateTts({ apiKey: ($event.target as HTMLInputElement).value })" />
      </div>
      <div class="row">
        <label>讯飞 ApiSecret</label>
        <input :value="s.tts.apiSecret" type="password" @input="settings.updateTts({ apiSecret: ($event.target as HTMLInputElement).value })" />
      </div>

      <div class="row">
        <label>连通测试</label>
        <button class="chip" :disabled="testing" @click="testLlm">测试 DeepSeek</button>
        <button class="chip" :disabled="testing" @click="testTts">测试讯飞发音</button>
      </div>
      <p class="test-status">{{ testStatus }}</p>

      <p class="hint">
        未配置 DeepSeek Key 时 AI 用随机决策(可玩但很笨);未配置讯飞则无声(文字版)。
        注册:platform.deepseek.com(充值几元即可)、www.xfyun.cn 控制台创建"语音合成"应用。
        Key 只存在你的浏览器里,请勿在公共电脑使用。
      </p>
      <p class="hint" v-if="s.stats.llmCalls > 0">已累计调用 DeepSeek {{ s.stats.llmCalls }} 次。</p>
    </section>

    <p class="error" v-if="error">{{ error }}</p>
    <button class="primary" @click="start">开 始 游 戏</button>
  </div>
</template>

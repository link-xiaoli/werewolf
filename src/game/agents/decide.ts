/** JSON 决策解析:重试 1 次 → 结构校验 → 按 kind 降级。流程永不崩。 */

import type { AIDecision, DecisionKind } from '../../types/ai'
import type { GameState, Player } from '../../types/game'
import { pick } from '../../utils/random'
import { defaultDelay, withRetry } from '../../utils/retry'
import { chatJson, LlmError } from '../../services/llm/llm-service'
import type { AppSettings } from '../../services/settings'

interface RawJson {
  content?: unknown
  target_id?: unknown
  heal?: unknown
  poison_id?: unknown
  shoot?: unknown
  want?: unknown
  reason?: unknown
}

/** 调用 LLM 拿 JSON 决策;失败重试 1 次;再失败降级。 */
export async function requestDecision(params: {
  kind: DecisionKind
  player: Player
  state: GameState
  messages: { system: string; user: string }
  settings: AppSettings
  temperature: number
  maxTokens: number
  timeoutMs: number
}): Promise<AIDecision> {
  const { kind, player, state, messages, settings, temperature, maxTokens, timeoutMs } = params

  if (!settings.llm.apiKey) {
    return fallbackDecision(kind, player, state, '未配置 LLM')
  }

  /** 永久性错误(改了配置才有用)不浪费重试 */
  const isPermanent = (e: unknown): boolean =>
    e instanceof LlmError && e.status !== undefined && [400, 401, 402, 404].includes(e.status)
  /** 限流错误退避翻倍,给服务端喘息时间 */
  const isRateLimit = (e: unknown): boolean => e instanceof LlmError && e.status === 429

  /** 一次 LLM 调用:指数退避 + 抖动重试,每尝试次独立 30s 超时 */
  const call = (user: string): Promise<string> =>
    withRetry(
      () =>
        withTimeout(
          chatJson(
            [
              { role: 'system', content: messages.system },
              { role: 'user', content: user },
            ],
            {
              baseUrl: settings.llm.baseUrl,
              apiKey: settings.llm.apiKey,
              model: settings.llm.model,
              temperature,
              maxTokens,
            },
          ),
          timeoutMs,
        ),
      {
        attempts: settings.llm.retryAttempts,
        shouldRetry: (e) => !isPermanent(e),
        delayMsFor: (attempt, e) => defaultDelay(attempt) * (isRateLimit(e) ? 2 : 1),
      },
    )

  // 第 1 次
  try {
    const raw = await call(messages.user)
    const parsed = parseAndValidate(kind, raw, player, state)
    if (parsed.ok) return toDecision(kind, player, parsed.json as RawJson)
    // 校验失败:重试 1 次,带纠错消息
    const retryUser = `${messages.user}\n\n你上次的输出不合法(${parsed.error}),请严格按照格式只输出一个 JSON 对象。`
    const raw2 = await call(retryUser)
    const parsed2 = parseAndValidate(kind, raw2, player, state)
    if (parsed2.ok) return toDecision(kind, player, parsed2.json as RawJson)
    return fallbackDecision(kind, player, state, `AI 输出不合法:${parsed2.error}`)
  } catch (e) {
    return fallbackDecision(kind, player, state, `LLM 调用失败:${String(e)}`)
  }
}

function parseAndValidate(
  kind: DecisionKind,
  raw: string,
  player: Player,
  state: GameState,
): { ok: true; json: RawJson } | { ok: false; error: string } {
  let json: RawJson
  try {
    // 容错:截掉可能包裹在代码块里的内容
    const cleaned = raw.replace(/```json|```/g, '').trim()
    json = JSON.parse(cleaned)
  } catch {
    return { ok: false, error: '不是合法 JSON' }
  }

  const aliveIds = state.players.filter((p) => p.alive).map((p) => p.id)
  const aliveAndNotSelf = aliveIds.filter((id) => id !== player.id)
  const isAliveTarget = (v: unknown): v is number => typeof v === 'number' && aliveIds.includes(v)

  switch (kind) {
    case 'speech':
    case 'last_word':
      return typeof json.content === 'string' && json.content.trim().length > 0
        ? { ok: true, json }
        : { ok: false, error: 'content 为空' }
    case 'vote':
      if (json.target_id !== null && !isAliveTarget(json.target_id)) return { ok: false, error: 'target_id 非法' }
      return { ok: true, json }
    case 'wolf_kill':
      if (!isAliveTarget(json.target_id)) return { ok: false, error: 'target_id 非法' }
      return { ok: true, json }
    case 'seer_check':
      if (typeof json.target_id !== 'number' || !aliveAndNotSelf.includes(json.target_id))
        return { ok: false, error: 'target_id 非法(不能查验自己)' }
      return { ok: true, json }
    case 'witch':
      if (typeof json.heal !== 'boolean') return { ok: false, error: 'heal 不是布尔值' }
      if (json.poison_id !== null && !isAliveTarget(json.poison_id)) return { ok: false, error: 'poison_id 非法' }
      return { ok: true, json }
    case 'guard_protect':
      if (!isAliveTarget(json.target_id)) return { ok: false, error: 'target_id 非法' }
      return { ok: true, json }
    case 'hunter_shoot':
      if (typeof json.shoot !== 'boolean') return { ok: false, error: 'shoot 不是布尔值' }
      if (json.shoot && !isAliveTarget(json.target_id)) return { ok: false, error: 'target_id 非法' }
      return { ok: true, json }
    case 'interject':
      if (typeof json.want !== 'boolean') return { ok: false, error: 'want 不是布尔值' }
      if (json.want && (typeof json.content !== 'string' || json.content.trim().length === 0))
        return { ok: false, error: 'want=true 但 content 为空' }
      return { ok: true, json }
  }
}

function toDecision(kind: DecisionKind, player: Player, json: RawJson): AIDecision {
  const base: AIDecision = { kind, playerId: player.id, fallback: false }
  switch (kind) {
    case 'speech':
    case 'last_word':
      return { ...base, content: String(json.content).trim() }
    case 'vote':
    case 'wolf_kill':
    case 'seer_check':
    case 'guard_protect':
      return { ...base, targetId: json.target_id as number | null, reason: typeof json.reason === 'string' ? json.reason : undefined }
    case 'witch':
      return { ...base, heal: json.heal as boolean, poisonId: json.poison_id as number | null }
    case 'hunter_shoot':
      return { ...base, shoot: json.shoot as boolean, targetId: (json.shoot ? json.target_id : null) as number | null }
    case 'interject':
      return { ...base, want: json.want as boolean, content: json.want ? String(json.content).trim() : '' }
  }
}

/** 降级决策:随机/弃权/固定话术。 */
export function fallbackDecision(kind: DecisionKind, player: Player, state: GameState, reason: string): AIDecision {
  const alive = state.players.filter((p) => p.alive)
  const aliveIds = alive.map((p) => p.id)
  const others = aliveIds.filter((id) => id !== player.id)
  const base: AIDecision = { kind, playerId: player.id, fallback: true, reason }

  switch (kind) {
    case 'speech':
      return {
        ...base,
        content: pick([
          '我暂时没有更多信息,先过。',
          '我觉得大家可以多听听前面的发言,我再观察一下。',
          '目前局势还不太明朗,我会仔细想想再判断。',
        ]),
      }
    case 'last_word':
      return { ...base, content: '我没有更多的信息了,希望好人阵营加油。' }
    case 'vote':
      return { ...base, targetId: Math.random() < 0.4 ? null : pick(others) }
    case 'wolf_kill':
    case 'seer_check':
    case 'guard_protect':
      return { ...base, targetId: pick(others) }
    case 'witch':
      return { ...base, heal: false, poisonId: null }
    case 'hunter_shoot':
      return { ...base, shoot: false, targetId: null }
    case 'interject':
      return { ...base, want: false, content: '' }
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`超时(${ms / 1000}s)`)), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

/** 参数分档:决策类稳定,发言类有性格 */
export function llmParamsFor(kind: DecisionKind): { temperature: number; maxTokens: number } {
  switch (kind) {
    case 'speech':
    case 'last_word':
      return { temperature: 0.9, maxTokens: 600 }
    case 'interject':
      return { temperature: 0.95, maxTokens: 150 }
    default:
      return { temperature: 0.3, maxTokens: 200 }
  }
}

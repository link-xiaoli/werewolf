/** 流程上下文与公共辅助:法官播报、人类/AI 决策分发。 */

import type { AIDecision, DecisionRequest } from '../../types/ai'
import {
  Role,
  type GameConfig,
  type GameState,
  type HumanActionPayload,
  type HumanActionRequest,
} from '../../types/game'
import type { AppSettings } from '../../services/settings'
import { voiceForSeat } from '../../services/settings'
import type { SpeechQueue } from '../../services/speech/speech-queue'
import { once } from '../../utils/emitter'
import { decideAction } from '../agents/agent'
import { addLog, alivePlayers } from '../engine'
import type { Secrets } from '../secrets'
import { CancelToken, withCancel } from './flow-utils'

export interface FlowContext {
  state: GameState
  secrets: Secrets
  settings: AppSettings
  config: GameConfig
  speechQueue: SpeechQueue
  token: CancelToken
}

/** 法官播报:写日志 + 排队朗读(法官无人张嘴,speakerId=null) */
export async function judgeSpeak(ctx: FlowContext, text: string): Promise<void> {
  addLog(ctx.state, `【法官】${text}`, 'system')
  await ctx.speechQueue.enqueue(text, { voice: ctx.settings.tts.judgeVoiceId, speakerId: null })
}

/** 某类行动的可选目标(人类玩家 UI 用) */
export function humanTargets(state: GameState, kind: HumanActionRequest['type'], selfId: number): number[] {
  const alive = alivePlayers(state).map((p) => p.id)
  switch (kind) {
    case 'wolf_kill':
      return alive.filter((id) => state.players[id].role !== Role.Werewolf)
    case 'seer_check':
    case 'hunter_shoot':
      return alive.filter((id) => id !== selfId)
    case 'guard_protect':
    case 'witch':
    case 'vote':
      return alive
    default:
      return alive
  }
}

/** 把玩家 UI 提交的 payload 转成统一决策结构 */
export function payloadToDecision(kind: AIDecision['kind'], playerId: number, payload: HumanActionPayload): AIDecision {
  const base: AIDecision = { kind, playerId, fallback: false }
  switch (payload.type) {
    case 'wolf_kill':
    case 'seer_check':
    case 'guard_protect':
      return { ...base, targetId: payload.targetId }
    case 'witch':
      return { ...base, heal: payload.heal, poisonId: payload.poisonId }
    case 'hunter_shoot':
      return { ...base, shoot: payload.shoot, targetId: payload.targetId }
    case 'vote':
      return { ...base, targetId: payload.targetId }
    case 'speech':
      return { ...base, content: payload.text }
  }
}

/** 决策分发:人类玩家走 UI 等待(emit 事件),AI 走 LLM/降级 */
export async function decideOrHuman(
  ctx: FlowContext,
  req: DecisionRequest,
  humanRequest: HumanActionRequest | null,
): Promise<AIDecision> {
  const p = ctx.state.players[req.playerId]
  if (p.isHuman && ctx.config.humanManual) {
    if (!humanRequest) throw new Error('人类玩家决策缺少 UI 请求描述')
    ctx.state.pendingHumanAction = humanRequest
    const payload = await withCancel(once('player:night-action'), ctx.token)
    ctx.state.pendingHumanAction = null
    return payloadToDecision(req.kind, p.id, payload)
  }
  return decideAction(req, { state: ctx.state, secrets: ctx.secrets, settings: ctx.settings })
}

/** 记录发言:写入历史 + 日志 */
export function recordSpeech(
  ctx: FlowContext,
  speakerId: number,
  text: string,
  opts: { isInterjection?: boolean; isLastWord?: boolean },
): void {
  const p = ctx.state.players[speakerId]
  ctx.state.history.push({
    round: ctx.state.round,
    speakerId,
    text,
    isInterjection: opts.isInterjection ?? false,
    isLastWord: opts.isLastWord ?? false,
  })
  addLog(ctx.state, `${p.name}${opts.isLastWord ? '(遗言)' : opts.isInterjection ? '(插话)' : ''}:${text}`, 'speech')
}

/** 说话(带朗读):记录历史 + 日志 + 排队朗读,返回朗读完成 */
export async function recordAndSpeak(
  ctx: FlowContext,
  speakerId: number,
  text: string,
  opts: { isInterjection?: boolean; isLastWord?: boolean },
): Promise<void> {
  recordSpeech(ctx, speakerId, text, opts)
  await ctx.speechQueue.enqueue(text, { voice: voiceForSeat(ctx.settings, speakerId), speakerId })
}

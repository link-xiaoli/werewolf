/** AI 决策统一入口:组装可见信息 → 选模板 → 调 LLM → 解析。 */

import type { AIDecision, DecisionRequest } from '../../types/ai'
import type { GameState } from '../../types/game'
import type { AppSettings } from '../../services/settings'
import type { Secrets } from '../secrets'
import { buildPrivateLines } from './context'
import { llmParamsFor, requestDecision } from './decide'
import { buildSpeechPrompt } from './prompts/speech'
import { buildVotePrompt } from './prompts/vote'
import { buildWolfKillPrompt, buildSeerCheckPrompt, buildWitchPrompt, buildGuardPrompt, buildHunterShootPrompt } from './prompts/night'
import { buildInterjectPrompt } from './prompts/interject'

export interface DecideContext {
  state: GameState
  secrets: Secrets
  settings: AppSettings
  /** 发言顺序信息(speech 用) */
  speechPos?: { order: number; total: number }
}

export async function decideAction(req: DecisionRequest, ctx: DecideContext): Promise<AIDecision> {
  const { state, secrets, settings } = ctx
  const player = state.players[req.playerId]
  const privateLines = buildPrivateLines(player, state, secrets)
  const timeoutMs = 30_000

  switch (req.kind) {
    case 'speech': {
      const { system, user } = buildSpeechPrompt({
        player,
        state,
        privateLines,
        order: ctx.speechPos?.order ?? 1,
        total: ctx.speechPos?.total ?? 1,
        isLastWord: false,
      })
      const p = llmParamsFor('speech')
      return requestDecision({ kind: 'speech', player, state, messages: { system, user }, settings, timeoutMs, ...p })
    }
    case 'last_word': {
      const { system, user } = buildSpeechPrompt({
        player,
        state,
        privateLines,
        order: 0,
        total: 0,
        isLastWord: true,
      })
      const p = llmParamsFor('last_word')
      return requestDecision({ kind: 'last_word', player, state, messages: { system, user }, settings, timeoutMs, ...p })
    }
    case 'vote': {
      const { system, user } = buildVotePrompt({ player, state, privateLines })
      const p = llmParamsFor('vote')
      return requestDecision({ kind: 'vote', player, state, messages: { system, user }, settings, timeoutMs, ...p })
    }
    case 'wolf_kill': {
      const { system, user } = buildWolfKillPrompt({ player, state, privateLines })
      const p = llmParamsFor('wolf_kill')
      return requestDecision({ kind: 'wolf_kill', player, state, messages: { system, user }, settings, timeoutMs, ...p })
    }
    case 'seer_check': {
      const { system, user } = buildSeerCheckPrompt({ player, state, privateLines })
      const p = llmParamsFor('seer_check')
      return requestDecision({ kind: 'seer_check', player, state, messages: { system, user }, settings, timeoutMs, ...p })
    }
    case 'witch': {
      const { system, user } = buildWitchPrompt({
        player,
        state,
        privateLines,
        wolfVictimId: req.extra?.wolfVictimId ?? null,
      })
      const p = llmParamsFor('witch')
      return requestDecision({ kind: 'witch', player, state, messages: { system, user }, settings, timeoutMs, ...p })
    }
    case 'guard_protect': {
      const { system, user } = buildGuardPrompt({ player, state, privateLines })
      const p = llmParamsFor('guard_protect')
      return requestDecision({ kind: 'guard_protect', player, state, messages: { system, user }, settings, timeoutMs, ...p })
    }
    case 'hunter_shoot': {
      const { system, user } = buildHunterShootPrompt({
        player,
        state,
        privateLines,
        deathReason: req.extra?.deathReason === 'exile' ? 'exile' : 'wolf',
      })
      const p = llmParamsFor('hunter_shoot')
      return requestDecision({ kind: 'hunter_shoot', player, state, messages: { system, user }, settings, timeoutMs, ...p })
    }
    case 'interject': {
      const { system, user } = buildInterjectPrompt({
        player,
        state,
        privateLines,
        currentSpeakerId: req.extra?.currentSpeakerId ?? state.currentSpeakerId ?? 0,
        currentSpeechText: req.extra?.currentSpeechText ?? '',
      })
      const p = llmParamsFor('interject')
      return requestDecision({ kind: 'interject', player, state, messages: { system, user }, settings, timeoutMs, ...p })
    }
  }
}

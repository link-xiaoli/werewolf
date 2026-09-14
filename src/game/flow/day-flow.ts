/** 白天流程:天亮死讯 → 顺序发言(含插话)→ 投票放逐 → 猎人开枪 → 黄昏遗言。 */

import type { AIDecision } from '../../types/ai'
import { Phase, Role } from '../../types/game'
import { once } from '../../utils/emitter'
import { shuffle } from '../../utils/random'
import { addLog, alivePlayers } from '../engine'
import { dawnLine, discussionStart, duskLine, exileLine, voteStart } from '../judge-script'
import { checkWinner, computeSpeechOrder, countVotes } from '../rules'
import { decideOrHuman, judgeSpeak, recordAndSpeak, recordSpeech, type FlowContext } from './context'
import { withCancel } from './flow-utils'

/** 白天完整一天:天亮→发言→投票→放逐→遗言。若分出胜负,置 state.winner。 */
export async function runDay(ctx: FlowContext): Promise<void> {
  const { state } = ctx
  const players = state.players

  // —— 天亮:结算昨夜死亡 ——
  state.phase = Phase.Dawn
  const deadThisRound: number[] = [...state.deathsLastNight]
  for (const id of deadThisRound) {
    players[id].alive = false
    players[id].speaking = false
  }
  await judgeSpeak(ctx, dawnLine(state))

  // 夜里被狼杀的猎人,天亮后可以开枪
  const nightHunterId = deadThisRound.find((id) => players[id].role === Role.Hunter)
  if (nightHunterId !== undefined) {
    const poisoned = state.nightEvents.some((e) => e.type === 'witch_poison' && e.targetId === nightHunterId)
    if (!poisoned) await hunterShoots(ctx, nightHunterId, 'wolf', deadThisRound)
  }
  if (applyWinnerCheck(ctx)) return

  // —— 白天发言:顺序发言 ——
  state.phase = Phase.Discussion
  const order = computeSpeechOrder(state)
  state.speechOrder = order
  state.speechIndex = 0
  state.currentSpeakerId = null
  await judgeSpeak(ctx, discussionStart(state.round, players[order[0]].name))

  // 插话限额(每轮):每人最多判定 1 次,每轮判定总数 ≤ 6
  const interjectChecked = new Set<number>()
  const interjectBudget = { left: 6 }

  for (let i = 0; i < order.length; i++) {
    ctx.token.throwIfCancelled()
    const pid = order[i]
    if (!players[pid].alive) continue
    state.speechIndex = i
    state.currentSpeakerId = pid
    const p = players[pid]

    let text = ''
    let skipped = false
    let speakIt = true
    if (p.isHuman && ctx.config.humanManual) {
      state.pendingHumanAction = { type: 'speech' }
      const payload = await withCancel(once('player:speech-submitted'), ctx.token)
      state.pendingHumanAction = null
      text = payload.text.trim()
      skipped = payload.skip || text === ''
      speakIt = payload.speakIt
    } else {
      const dec = await decideOrHuman(ctx, { kind: 'speech', playerId: pid }, null)
      text = (dec.content ?? '').trim()
      if (dec.fallback && dec.reason) {
        addLog(state, `[${p.name} 发言降级:${dec.reason}]`, 'system')
      }
    }

    if (skipped || text === '') {
      addLog(state, `${p.name} 选择跳过发言。`, 'speech')
      continue
    }

    if (speakIt) {
      const play = recordAndSpeak(ctx, pid, text, {})
      // 插话:发言播放的同时后台并发判定(LLM 延迟被语音播放掩盖),命中则播放完插队
      let interjections: AIDecision[] = []
      if (ctx.config.interjectEnabled && !p.isHuman && text.length >= 20) {
        interjections = await collectInterjections(ctx, pid, text, play, interjectChecked, interjectBudget)
      }
      await play
      for (const inj of interjections) {
        ctx.token.throwIfCancelled()
        players[inj.playerId].raisingHand = false
        await recordAndSpeak(ctx, inj.playerId, inj.content ?? '', { isInterjection: true })
      }
    } else {
      recordSpeech(ctx, pid, text, {})
    }
  }
  state.currentSpeakerId = null

  // —— 投票 ——
  state.phase = Phase.Vote
  await judgeSpeak(ctx, voteStart())
  const voters = alivePlayers(state)
  const votes = await withCancel(
    Promise.all(
      voters.map(async (p) => {
        if (p.isHuman && ctx.config.humanManual) {
          state.pendingHumanAction = { type: 'vote', targets: voters.map((v) => v.id) }
          const payload = await withCancel(once('player:vote-submitted'), ctx.token)
          state.pendingHumanAction = null
          return { voterId: p.id, targetId: payload.targetId }
        }
        const dec = await decideOrHuman(ctx, { kind: 'vote', playerId: p.id }, null)
        return { voterId: p.id, targetId: dec.targetId ?? null }
      }),
    ),
    ctx.token,
  )
  state.votes = votes
  for (const v of votes) {
    const target = v.targetId !== null ? players[v.targetId].name : '弃权'
    addLog(state, `${players[v.voterId].name} 投给 ${target}`, 'vote')
  }

  // —— 放逐 ——
  state.phase = Phase.Exile
  const exiledId = countVotes(votes, voters.map((v) => v.id))
  state.voteRounds.push({ round: state.round, votes, exiledId })
  if (exiledId !== null) {
    players[exiledId].alive = false
    players[exiledId].revealed = true
    deadThisRound.push(exiledId)
  }
  state.exiledLastRound = exiledId
  await judgeSpeak(ctx, exileLine(state, exiledId))

  // 被放逐的猎人可以开枪
  if (exiledId !== null && players[exiledId].role === Role.Hunter) {
    await hunterShoots(ctx, exiledId, 'exile', deadThisRound)
  }
  if (applyWinnerCheck(ctx)) return

  // —— 黄昏:遗言 ——
  state.phase = Phase.Dusk
  if (ctx.config.lastWordsEnabled && deadThisRound.length > 0) {
    await judgeSpeak(ctx, duskLine())
    for (const id of deadThisRound) {
      ctx.token.throwIfCancelled()
      const p = players[id]
      state.currentSpeakerId = id
      let text = ''
      if (p.isHuman && ctx.config.humanManual) {
        state.pendingHumanAction = { type: 'speech' }
        const payload = await withCancel(once('player:speech-submitted'), ctx.token)
        state.pendingHumanAction = null
        text = payload.text.trim()
      } else {
        const dec = await decideOrHuman(ctx, { kind: 'last_word', playerId: id }, null)
        text = (dec.content ?? '').trim()
      }
      if (text) await recordAndSpeak(ctx, id, text, { isLastWord: true })
    }
  }
  state.currentSpeakerId = null
}

/** 猎人开枪:询问目标(人类走 UI,AI 走 LLM),开枪后更新死亡名单 */
async function hunterShoots(
  ctx: FlowContext,
  hunterId: number,
  cause: 'wolf' | 'exile',
  deadThisRound: number[],
): Promise<void> {
  const { state } = ctx
  const hunter = state.players[hunterId]
  const targets = alivePlayers(state)
    .filter((p) => p.id !== hunterId)
    .map((p) => p.id)
  if (targets.length === 0) return

  const dec = await decideOrHuman(
    ctx,
    { kind: 'hunter_shoot', playerId: hunterId, extra: { deathReason: cause } },
    { type: 'hunter_shoot', targets },
  )
  if (dec.shoot && dec.targetId != null && targets.includes(dec.targetId)) {
    const t = state.players[dec.targetId]
    t.alive = false
    deadThisRound.push(dec.targetId)
    addLog(state, `${hunter.name} 开枪带走了 ${t.name}!`, 'night')
    await judgeSpeak(ctx, `${hunter.name} 发动了猎人技能,开枪带走了 ${t.name}。`)
  } else {
    addLog(state, `${hunter.name} 选择不开枪。`, 'night')
    await judgeSpeak(ctx, `${hunter.name} 选择不开枪。`)
  }
}

function applyWinnerCheck(ctx: FlowContext): boolean {
  const winner = checkWinner(ctx.state.players)
  if (winner !== null) {
    ctx.state.winner = winner
    return true
  }
  return false
}

/** 插话收集:对少数候选 AI 并发发起判定,与当前发言播放竞速;
 *  只有"判定先于播放结束返回且 want=true"的才插队。播放结束后返回可插话列表。 */
async function collectInterjections(
  ctx: FlowContext,
  speakerId: number,
  text: string,
  play: Promise<void>,
  checked: Set<number>,
  budget: { left: number },
): Promise<AIDecision[]> {
  const { state } = ctx
  const alive = alivePlayers(state)
  const candidates = shuffle(
    alive.filter((p) => p.id !== speakerId && !p.isHuman && !checked.has(p.id)),
  ).slice(0, Math.min(3, budget.left))
  if (candidates.length === 0) return []
  for (const c of candidates) checked.add(c.id)
  budget.left -= candidates.length

  // 每个候选独立竞速:判定先完成且想插话 → 举手等待;播放先结束 → 丢弃
  const results = await Promise.all(
    candidates.map(async (c) => {
      const check = decideOrHuman(
        ctx,
        { kind: 'interject', playerId: c.id, extra: { currentSpeakerId: speakerId, currentSpeechText: text } },
        null,
      )
      const winner = await Promise.race([
        check.then((d) => (d.want && d.content ? d : null)),
        play.then(() => null),
      ])
      if (winner) {
        state.players[c.id].raisingHand = true
      }
      return winner
    }),
  )
  return results.filter((d): d is AIDecision => d !== null)
}

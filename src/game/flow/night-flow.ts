/** 夜晚流程:狼人/预言家/守卫并行决策 → 女巫串行 → 结算。 */

import { NightStep, Phase, Role } from '../../types/game'
import { pick } from '../../utils/random'
import { addLog, alivePlayers } from '../engine'
import { nightStart } from '../judge-script'
import { decideWolfTarget, resolveNight } from '../rules'
import { decideOrHuman, humanTargets, judgeSpeak, type FlowContext } from './context'
import { withCancel } from './flow-utils'

export async function runNight(ctx: FlowContext): Promise<void> {
  const { state } = ctx
  state.phase = Phase.Night
  state.nightEvents = []
  state.deathsLastNight = []
  ctx.token.throwIfCancelled()

  await judgeSpeak(ctx, nightStart(state.round))

  const alive = alivePlayers(state)
  const wolves = alive.filter((p) => p.role === Role.Werewolf)
  const seer = alive.find((p) => p.role === Role.Seer) ?? null
  const guard = alive.find((p) => p.role === Role.Guard) ?? null
  const witch = alive.find((p) => p.role === Role.Witch) ?? null

  // —— 并行:狼人提名、预言家查验、守卫守护(互不依赖)——
  state.nightStep = NightStep.Wolves
  const [wolfNoms, seerDec, guardDec] = await withCancel(
    Promise.all([
      wolves.length > 0
        ? Promise.all(
            wolves.map((w) =>
              decideOrHuman(
                ctx,
                { kind: 'wolf_kill', playerId: w.id },
                { type: 'wolf_kill', targets: humanTargets(state, 'wolf_kill', w.id) },
              ),
            ),
          )
        : Promise.resolve([]),
      seer
        ? decideOrHuman(
            ctx,
            { kind: 'seer_check', playerId: seer.id },
            { type: 'seer_check', targets: humanTargets(state, 'seer_check', seer.id) },
          )
        : Promise.resolve(null),
      guard
        ? decideOrHuman(
            ctx,
            { kind: 'guard_protect', playerId: guard.id },
            { type: 'guard_protect', targets: humanTargets(state, 'guard_protect', guard.id) },
          )
        : Promise.resolve(null),
    ]),
    ctx.token,
  )

  // 狼刀:多数票定刀口,平票随机
  const wolfTargetId = wolves.length > 0 ? decideWolfTarget(wolfNoms.map((n) => n.targetId ?? null)) : null
  if (wolfTargetId !== null) {
    state.nightEvents.push({ type: 'wolf_kill', actorId: wolves[0].id, targetId: wolfTargetId })
  }

  // 预言家查验结算(结果只进 secrets 与预言家本人可见)
  if (seer && seerDec?.targetId != null) {
    const targetId = seerDec.targetId
    const isWolf = state.players[targetId].role === Role.Werewolf
    ctx.secrets.recordCheck(seer.id, targetId, isWolf, state.round)
    state.nightEvents.push({ type: 'seer_check', actorId: seer.id, targetId })
    if (seer.isHuman) {
      addLog(state, `你查验了 ${state.players[targetId].name}:${isWolf ? '狼人!' : '好人'}`, 'night')
    }
  }

  // 守卫守护(违反"不能连续守同一人"时换一个)
  let guardTargetId: number | null = null
  if (guard && guardDec?.targetId != null) {
    let t = guardDec.targetId
    if (t === guard.lastProtectId) {
      const others = alive.filter((p) => p.id !== t).map((p) => p.id)
      t = pick(others)
      addLog(state, `[守卫违规连守,已改为守护 ${state.players[t].name}]`, 'system')
    }
    guard.lastProtectId = t
    guardTargetId = t
    state.nightEvents.push({ type: 'guard_protect', actorId: guard.id, targetId: t })
  }

  // —— 女巫(串行,必须等刀口)——
  let witchHeal = false
  let witchPoisonId: number | null = null
  if (witch && (witch.healLeft > 0 || witch.poisonLeft > 0)) {
    state.nightStep = NightStep.Witch
    const dec = await decideOrHuman(
      ctx,
      { kind: 'witch', playerId: witch.id, extra: { wolfVictimId: wolfTargetId } },
      {
        type: 'witch',
        targets: humanTargets(state, 'witch', witch.id),
        wolfVictimId: wolfTargetId,
        healAvailable: witch.healLeft > 0,
        poisonAvailable: witch.poisonLeft > 0,
      },
    )
    const wantHeal = dec.heal === true && witch.healLeft > 0 && wolfTargetId !== null
    const selfHealOk = ctx.config.witchSelfHeal || wolfTargetId !== witch.id
    witchHeal = wantHeal && selfHealOk
    if (witchHeal) {
      witch.healLeft--
      state.nightEvents.push({ type: 'witch_heal', actorId: witch.id, targetId: wolfTargetId! })
      if (witch.isHuman) addLog(state, '你使用了救药。', 'night')
    }
    // 同晚限用一瓶:用了救药就不能再用毒
    if (!witchHeal && dec.poisonId != null && witch.poisonLeft > 0) {
      witch.poisonLeft--
      witchPoisonId = dec.poisonId
      state.nightEvents.push({ type: 'witch_poison', actorId: witch.id, targetId: dec.poisonId })
      if (witch.isHuman) addLog(state, `你毒杀了 ${state.players[dec.poisonId].name}。`, 'night')
    }
  }

  // —— 结算 ——
  state.nightStep = NightStep.Sleep
  const res = resolveNight({
    wolfTargetId,
    guardTargetId,
    witchHeal,
    witchPoisonId,
    players: state.players,
  })
  state.deathsLastNight = res.deaths
  await judgeSpeak(ctx, '夜深了,请各位闭上眼睛。')
}

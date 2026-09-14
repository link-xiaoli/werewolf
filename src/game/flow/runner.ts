/** 对局主循环:夜晚 → 白天 → 夜晚……直到分出胜负。 */

import { Phase } from '../../types/game'
import { addLog } from '../engine'
import { gameOverLine } from '../judge-script'
import { judgeSpeak, type FlowContext } from './context'
import { runDay } from './day-flow'
import { isCancelError } from './flow-utils'
import { runNight } from './night-flow'

export async function runGame(ctx: FlowContext): Promise<void> {
  const { state, token } = ctx
  try {
    while (state.winner === null) {
      token.throwIfCancelled()
      await runNight(ctx)
      if (state.winner !== null) break
      await runDay(ctx)
      if (state.winner === null) state.round++
    }

    // —— 结算 ——
    state.phase = Phase.GameOver
    state.currentSpeakerId = null
    state.pendingHumanAction = null
    await judgeSpeak(ctx, gameOverLine(state.winner!))
    addLog(state, gameOverLine(state.winner!), 'system')
    // 亮明所有身份
    for (const p of state.players) p.revealed = true
  } catch (e) {
    if (isCancelError(e)) return
    console.error('[game] 异常终止', e)
    addLog(state, `游戏异常终止:${e instanceof Error ? e.message : String(e)}`, 'system')
    state.phase = Phase.GameOver
  }
}

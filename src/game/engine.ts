/** 引擎:初始状态创建、日志、死亡/放逐等基础状态操作。 */

import { Phase, Role, type GameConfig, type GameState, type LogEntry, type Player } from '../types/game'
import { dealRoles } from './rules'

/** AI 玩家的默认中文昵称池(12 人以内每人一个) */
export const AI_NAME_POOL = [
  '阿强', '小美', '老王', '莉莉', '大壮', '思思',
  '老陈', '晓芸', '阿豪', '小雪', '铁柱', '慧敏',
]

export function createInitialState(config: GameConfig): GameState {
  const dealt = dealRoles(config.roles)
  const players: Player[] = dealt.map((role, i) => {
    const isHuman = !config.spectator && i === config.playerSeat
    return {
      id: i,
      name: isHuman ? config.playerName : AI_NAME_POOL[i % AI_NAME_POOL.length],
      isHuman,
      role,
      alive: true,
      revealed: false,
      speaking: false,
      raisingHand: false,
      healLeft: role === Role.Witch ? 1 : 0,
      poisonLeft: role === Role.Witch ? 1 : 0,
      lastProtectId: null,
    }
  })
  return {
    phase: Phase.Night,
    nightStep: null,
    round: 1,
    players,
    nightEvents: [],
    deathsLastNight: [],
    exiledLastRound: null,
    votes: [],
    voteRounds: [],
    speechOrder: [],
    speechIndex: 0,
    currentSpeakerId: null,
    history: [],
    winner: null,
    log: [],
    pendingHumanAction: null,
  }
}

export function addLog(state: GameState, text: string, kind: LogEntry['kind']): void {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  state.log.push({ time, text, kind })
  // 日志上限,防止无限增长
  if (state.log.length > 500) state.log.splice(0, state.log.length - 500)
}

export function alivePlayers(state: GameState): Player[] {
  return state.players.filter((p) => p.alive)
}

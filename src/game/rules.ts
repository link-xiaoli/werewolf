/** 游戏规则:发牌、发言顺序、计票、夜晚结算、胜负判定。纯函数,无副作用。
 *
 * 简化房规(首版):
 * - 狼人互知队友;每晚各自提名,多数票定刀口,平票随机
 * - 女巫解药毒药各 1 瓶;同一晚限用 1 瓶;可自救(可配)
 * - 守卫不能连续两晚守同一人;可守自己;被守者免疫狼刀
 * - 猎人被狼刀/放逐可开枪,被毒死不可;可不开枪
 * - 平票无人出局
 * - 放逐者亮身份,夜间死者不亮
 * - 发言顺序:第 1 轮从 0 号位顺时针;此后从上轮起言位的下一位开始
 */

import { Camp, Role, type GameState, type Player, type VoteRecord } from '../types/game'
import { pick, shuffle } from '../utils/random'

/** 胜负判定:狼全灭=好人胜;存活狼数 ≥ 存活好人数=狼胜。null=未分胜负。 */
export function checkWinner(players: Player[]): Camp | null {
  const alive = players.filter((p) => p.alive)
  const aliveWolves = alive.filter((p) => p.role === Role.Werewolf).length
  const aliveGood = alive.length - aliveWolves
  if (aliveWolves === 0) return Camp.Good
  if (aliveWolves >= aliveGood) return Camp.Wolf
  return null
}

/** 从 0 号位开始的顺时针座位序列(座位 id 递增) */
function clockwiseSeats(n: number, start: number): number[] {
  const arr: number[] = []
  for (let i = 0; i < n; i++) arr.push((start + i) % n)
  return arr
}

/** 计算本轮发言顺序:第 1 轮从 0 号位起;此后从上轮起言位下一位开始。跳过死者。 */
export function computeSpeechOrder(state: GameState): number[] {
  const n = state.players.length
  const start = state.round === 1 ? 0 : (state.speechOrder[0] ?? 0) + 1
  return clockwiseSeats(n, start).filter((id) => state.players[id].alive)
}

/** 计票:得票最高且唯一者出局;平票/无人投票返回 null */
export function countVotes(votes: VoteRecord[], aliveIds: number[]): number | null {
  const tally = new Map<number, number>()
  for (const v of votes) {
    if (v.targetId === null) continue
    if (!aliveIds.includes(v.targetId)) continue
    tally.set(v.targetId, (tally.get(v.targetId) ?? 0) + 1)
  }
  let max = 0
  let top: number[] = []
  for (const [id, cnt] of tally) {
    if (cnt > max) {
      max = cnt
      top = [id]
    } else if (cnt === max) {
      top.push(id)
    }
  }
  if (max === 0 || top.length !== 1) return null
  return top[0]
}

export interface NightResolution {
  /** 最终死亡名单(被刀且未被救/未被守护、被毒) */
  deaths: number[]
  /** 刀口是否被化解(救或守),给日志用 */
  wolfKillBlocked: boolean
}

/** 结算夜晚:按"守护/狼刀/救药/毒药"综合计算死亡。 */
export function resolveNight(params: {
  wolfTargetId: number | null
  guardTargetId: number | null
  witchHeal: boolean
  witchPoisonId: number | null
  players: Player[]
}): NightResolution {
  const { wolfTargetId, guardTargetId, witchHeal, witchPoisonId, players } = params
  const deaths: number[] = []
  let wolfKillBlocked = false

  // 狼刀结算:被守护或被解药 → 化解(解药只能作用于刀口)
  if (wolfTargetId !== null) {
    const protected_ = wolfTargetId === guardTargetId
    if (protected_ || witchHeal) {
      wolfKillBlocked = true
    } else {
      deaths.push(wolfTargetId)
    }
  }

  // 毒药:无视守护,直接死亡
  if (witchPoisonId !== null && players[witchPoisonId]?.alive) {
    deaths.push(witchPoisonId)
  }

  return { deaths: [...new Set(deaths)], wolfKillBlocked }
}

/** 狼人提名汇总:多数票定刀口,平票随机。返回刀人目标。 */
export function decideWolfTarget(nominations: (number | null)[]): number | null {
  const valid = nominations.filter((t): t is number => t !== null)
  if (valid.length === 0) return null
  const tally = new Map<number, number>()
  for (const t of valid) tally.set(t, (tally.get(t) ?? 0) + 1)
  const max = Math.max(...tally.values())
  const top = [...tally.entries()].filter(([, c]) => c === max).map(([id]) => id)
  return pick(top)
}

/** 发牌:角色列表洗牌后分配给座位。座位 0..n-1。 */
export function dealRoles(roles: readonly Role[]): Role[] {
  return shuffle([...roles])
}

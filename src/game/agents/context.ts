/** 可见信息过滤:按角色组装"这个 AI 本该知道"的私密信息。
 *  全项目最需要小心的一处 —— 绝不可把别的角色的私密信息注入。 */

import { Role, type GameState, type Player } from '../../types/game'
import type { Secrets } from '../secrets'

export function buildPrivateLines(player: Player, state: GameState, secrets: Secrets): string[] {
  const lines: string[] = []
  switch (player.role) {
    case Role.Werewolf: {
      const partners = secrets.getPartners(player.id)
      if (partners.length > 0) {
        const names = partners.map((id) => state.players[id].name).join('、')
        lines.push(`你是狼人,你的狼队友是:${names}。绝不能暴露他们。`)
      }
      break
    }
    case Role.Seer: {
      const checks = secrets.getChecks(player.id)
      if (checks.length > 0) {
        const desc = checks
          .map((c) => `第 ${c.round} 晚查验 ${state.players[c.targetId].name}:${c.isWolf ? '狼人' : '好人'}`)
          .join(';')
        lines.push(`你的历史查验结果:${desc}。`)
      }
      break
    }
    default:
      break
  }
  return lines
}

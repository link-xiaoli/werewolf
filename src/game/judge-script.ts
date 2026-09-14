/** 法官台词:固定文案 + 占位符,不走 LLM(省 token、节奏稳)。 */

import { Camp, type GameState, type Player } from '../types/game'

export function nameOf(players: Player[], id: number | null): string {
  if (id === null) return ''
  return players[id]?.name ?? `${id + 1}号`
}

export function aliveNames(players: Player[]): string {
  return players.filter((p) => p.alive).map((p) => p.name).join('、')
}

/** 夜晚降临 */
export function nightStart(round: number): string {
  return round === 1
    ? '天黑请闭眼。游戏开始,请大家查看自己的身份。'
    : `第 ${round} 天结束,天黑请闭眼。`
}

/** 夜晚各步骤的提示(给夜晚流程渲染,不朗读也行) */
export function nightStepLine(step: string): string {
  const map: Record<string, string> = {
    wolves: '狼人请睁眼,请选择今晚要袭击的玩家。',
    seer: '预言家请睁眼,请选择要查验的玩家。',
    guard: '守卫请睁眼,请选择要守护的玩家。',
    witch: '女巫请睁眼,请决定是否使用药品。',
  }
  return map[step] ?? ''
}

/** 天亮:宣布死讯 */
export function dawnLine(state: GameState): string {
  const deaths = state.deathsLastNight
  if (deaths.length === 0) return '天亮了,昨夜是平安夜,没有人死亡。'
  const names = deaths.map((id) => nameOf(state.players, id)).join('、')
  return `天亮了。昨夜死亡的是:${names}。`
}

/** 白天发言开始 */
export function discussionStart(round: number, firstSpeaker: string): string {
  return `现在是第 ${round} 天白天,进入自由发言环节,从 ${firstSpeaker} 开始,按顺序发言。`
}

export function voteStart(): string {
  return '发言结束,进入投票环节,请各位玩家投票放逐一名你最怀疑的玩家。'
}

/** 放逐宣布 */
export function exileLine(state: GameState, exiledId: number | null): string {
  if (exiledId === null) return '投票结果出现平票,今天没有人被放逐。'
  const p = state.players[exiledId]
  const role = p.revealed ? `,其身份是${p.role === 'werewolf' ? '狼人' : '好人'}` : ''
  return `投票结果,${p.name} 被放逐${role}。`
}

export function duskLine(): string {
  return '黄昏降临,请被放逐和死亡的玩家留下遗言。'
}

export function gameOverLine(winner: Camp): string {
  return winner === Camp.Good ? '游戏结束,狼人全部出局,好人阵营获胜!' : '游戏结束,狼人数量占优,狼人阵营获胜!'
}

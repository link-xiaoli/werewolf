/** 白天投票提示词。 */

import { Role, type GameState, type Player } from '../../../types/game'
import { aliveListLine, commonUserPrompt, SYSTEM_BASE } from './shared'

export function buildVotePrompt(params: {
  player: Player
  state: GameState
  privateLines: string[]
}): { system: string; user: string } {
  const { player, state, privateLines } = params
  let hint = ''
  if (player.role === Role.Werewolf) {
    const wolves = state.players.filter((p) => p.role === Role.Werewolf)
    hint = `你是狼人,绝不能投你的狼队友。${wolves.length > 1 ? '你的狼队友是:' + wolves.filter((w) => w.id !== player.id).map((w) => w.name).join('、') + '。' : ''}`
  }
  const task = [
    `现在是投票环节,请投票放逐一名你最怀疑的存活玩家。存活玩家:${aliveListLine(state.players)}。`,
    hint,
    '你可以弃权。',
    '【输出格式】{"target_id":2,"reason":"怀疑理由(20字内)"},target_id 填座位 id,弃权则 target_id 为 null。',
  ].join('')
  const user = commonUserPrompt({ player, state, privateLines }) + '\n【任务】' + task
  return { system: SYSTEM_BASE, user }
}

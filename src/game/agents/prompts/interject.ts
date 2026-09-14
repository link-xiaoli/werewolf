/** 插话判定提示词:低成本判定"是否想插话"。 */

import type { GameState, Player } from '../../../types/game'
import { commonUserPrompt, SYSTEM_BASE } from './shared'

export function buildInterjectPrompt(params: {
  player: Player
  state: GameState
  privateLines: string[]
  currentSpeakerId: number
  currentSpeechText: string
}): { system: string; user: string } {
  const { player, state, privateLines, currentSpeakerId, currentSpeechText } = params
  const speaker = state.players[currentSpeakerId]
  const task = [
    `${speaker.name} 正在发言:"${currentSpeechText}"`,
    '判断你是否想立刻插话反驳或补充。大多数情况下你不需要插话,只有在对方明显怀疑你、说谎,或你有重要信息要立刻指出时才插话。',
    '插话要符合你的人设和说话风格,不要套话。',
    '【输出格式】不想插话:{"want":false,"content":""};想插话:{"want":true,"content":"不超过40字的插话"}',
  ].join('\n')
  const user =
    commonUserPrompt({ player, state, privateLines, historyLimit: 8, personaSeatId: player.id }) +
    '\n【任务】' +
    task
  return { system: SYSTEM_BASE, user }
}

/** 白天发言 / 遗言提示词。人设 + 反套路 + 引导式任务,避免千人一面。 */

import { Role, type GameState, type Player } from '../../../types/game'
import { commonUserPrompt, SYSTEM_BASE } from './shared'

function roleGuidance(p: Player): string {
  switch (p.role) {
    case Role.Werewolf:
      return '你是狼人。以好人的视角发言,隐藏自己,可以合理地伪装村民,必要时可以攻击别人转移怀疑,为狼队利益服务。'
    case Role.Seer:
      return '你是预言家。谨慎暗示你的查验信息,不要过早暴露身份,除非局势危急。'
    case Role.Witch:
      return '你是女巫。根据你的用药情况发言,隐藏身份。'
    case Role.Hunter:
      return '你是猎人。正常发言即可,隐藏身份。'
    case Role.Guard:
      return '你是守卫。正常发言即可,隐藏身份。'
    default:
      return '你是村民。如实发表你的看法即可。'
  }
}

export function buildSpeechPrompt(params: {
  player: Player
  state: GameState
  privateLines: string[]
  order: number
  total: number
  isLastWord: boolean
}): { system: string; user: string } {
  const { player, state, privateLines, order, total, isLastWord } = params

  let task: string
  if (isLastWord) {
    task = [
      '你刚刚死亡,这是你的遗言。',
      '说 30~100 字,不套格式:可以甩出最后结论、指名怀疑对象、',
      player.role === Role.Werewolf ? '搅乱好人的视线,' : '为好人阵营尽最后一份力,',
      '也可以只是表达情绪。用你自己的说话方式。',
      '【输出格式】{"content":"你的遗言"}',
    ].join('')
  } else {
    task = [
      `现在轮到你发言(第 ${order}/${total} 位)。`,
      '说你当下最想说的话,30~120 字:你的怀疑对象、你信任的人、对局势的一个判断、一个打比方、甚至一句情绪宣泄——',
      '选一两个重点说透即可,不必面面俱到。',
      '不要按"点评前人+列名单+表态"的固定顺序来,换个别的角度切入。',
      roleGuidance(player),
      '【输出格式】{"content":"你的发言"}',
    ].join('')
  }

  const user =
    commonUserPrompt({ player, state, privateLines, personaSeatId: player.id }) + '\n【任务】' + task
  return { system: SYSTEM_BASE, user }
}

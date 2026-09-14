/** 公共提示词骨架:规则铁律 + 局势描述 + 历史格式化。 */

import { Role, ROLE_INFO, type GameState, type Player } from '../../../types/game'
import { personaForSeat } from '../personas'

/** 系统提示词:所有请求共用 */
export const SYSTEM_BASE = [
  '你是狼人杀游戏中的一名玩家,正在和真人一起玩一局中文狼人杀。',
  '你必须时刻扮演你的角色,以第一人称发言,使用自然的中文口语,绝不能说"我是AI"、"我是语言模型"之类的话。',
  '你绝不能直接暴露你的真实身份(除非你判断在遗言中坦白对阵营有利,且你的身份已被公开)。',
  '也不能随意编造你是预言家、女巫等具体身份,除非你判断游戏需要(狼人可以伪装身份)。',
  '禁止辱骂和人身攻击。',
  '发言时禁止使用人人都会说的套话,如"先记个问号""别急着站边""第一天稳一点""等预言家跳"这类。',
  '禁止复读前面玩家的原话和用词,必须用自己的语言和视角表达。',
  '禁止每次都先说"我是X号"来开场,开场方式要自然多变。',
  '【输出铁律】你必须只输出一个 JSON 对象,不要输出任何解释或多余文字。',
].join('\n')

/** 人设块(发言类提示词注入,让每个角色风格稳定有区分度) */
export function personaLine(seatId: number): string {
  const p = personaForSeat(seatId)
  const cp = p.catchphrase ? `你的口头禅是"${p.catchphrase}"(偶尔用,不要每句都用)。` : ''
  return `你的性格:${p.character}。说话风格:${p.style}。${cp}你的发言长度倾向:${p.verbosity}。`
}

/** 角色中文名 */
export function roleName(r: Role): string {
  return ROLE_INFO[r].name
}

/** 存活名单描述 */
export function aliveListLine(players: Player[]): string {
  const alive = players.filter((p) => p.alive)
  return alive.map((p) => `${p.name}(${p.id + 1}号)`).join('、')
}

/** 公开信息:死讯/放逐/轮次 */
export function situationLines(state: GameState): string[] {
  const lines: string[] = []
  lines.push(`现在是第 ${state.round} 天。`)
  lines.push(`存活玩家:${aliveListLine(state.players)}。`)
  if (state.deathsLastNight.length > 0) {
    lines.push(`昨夜死亡:${state.deathsLastNight.map((id) => state.players[id].name).join('、')}。`)
  } else if (state.round > 1) {
    lines.push('昨夜是平安夜,无人死亡。')
  }
  if (state.exiledLastRound !== null) {
    lines.push(`上一轮被放逐:${state.players[state.exiledLastRound].name}。`)
  }
  // 已亮身份的死者和被放逐者
  const revealed = state.players.filter((p) => !p.alive && p.revealed)
  if (revealed.length > 0) {
    lines.push(`已亮身份:${revealed.map((p) => `${p.name}是${roleName(p.role)}`).join('、')}。`)
  }
  return lines
}

/** 发言历史(最近 n 条),格式:"名字:内容" */
export function speechHistoryLines(state: GameState, n = 15): string[] {
  return state.history.slice(-n).map((s) => {
    const speaker = state.players[s.speakerId]
    const tag = s.isLastWord ? '遗言' : s.isInterjection ? '插话' : ''
    return `${speaker.name}${tag ? `(${tag})` : ''}:${s.text}`
  })
}

/** 往届投票摘要 */
export function pastVoteLines(state: GameState): string[] {
  return state.voteRounds.map((vr) => {
    const byTarget = new Map<number, number>()
    let abstain = 0
    for (const v of vr.votes) {
      if (v.targetId === null) abstain++
      else byTarget.set(v.targetId, (byTarget.get(v.targetId) ?? 0) + 1)
    }
    const parts = [...byTarget.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, cnt]) => `${state.players[id].name} ${cnt} 票`)
    const exile = vr.exiledId !== null ? `,结果:${state.players[vr.exiledId].name} 被放逐` : ',结果:平票'
    return `第 ${vr.round} 天投票:${parts.length ? parts.join('、') : '无人投票'}${abstain ? `,${abstain} 人弃权` : ''}${exile}`
  })
}

/** 组装公共 user 消息头部:身份+私密区+人设+局势+历史 */
export function commonUserPrompt(params: {
  player: Player
  state: GameState
  privateLines: string[]
  historyLimit?: number
  /** 注入人设块(发言类提示词用) */
  personaSeatId?: number
}): string {
  const { player, state, privateLines, historyLimit, personaSeatId } = params
  const lines: string[] = []
  lines.push(`【你的身份】你叫${player.name},坐在 ${player.id + 1} 号位。你的身份是${roleName(player.role)}。`)
  if (privateLines.length > 0) {
    lines.push(`【你的秘密信息】${privateLines.join('')}`)
  }
  if (personaSeatId !== undefined) {
    lines.push(`【你的人设】${personaLine(personaSeatId)}保持这个风格,让每一轮发言都有你的个人印记。`)
  }
  lines.push(`【当前局势】${situationLines(state).join('')}`)
  const hist = speechHistoryLines(state, historyLimit ?? 15)
  lines.push(`【发言历史】${hist.length ? hist.join('\n') : '(还没有人发过言)'}`)
  const pv = pastVoteLines(state)
  if (pv.length) lines.push(`【往届投票】${pv.join('\n')}`)
  return lines.join('\n')
}

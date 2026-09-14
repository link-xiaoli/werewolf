/** 夜晚行动提示词:狼刀 / 查验 / 女巫 / 守护 / 猎人开枪。 */

import type { GameState, Player } from '../../../types/game'
import { aliveListLine, commonUserPrompt, SYSTEM_BASE } from './shared'

export function buildWolfKillPrompt(params: {
  player: Player
  state: GameState
  privateLines: string[]
}): { system: string; user: string } {
  const { player, state, privateLines } = params
  const task = [
    `现在是夜晚,狼人行动时间。请在存活玩家中选择今晚要袭击的目标:${aliveListLine(state.players)}。`,
    '你和狼队友各自提名,最终由多数票决定。请给出你的提名和简短理由。',
    '【输出格式】{"target_id":3,"reason":"理由(20字内)"}',
  ].join('')
  const user = commonUserPrompt({ player, state, privateLines }) + '\n【任务】' + task
  return { system: SYSTEM_BASE, user }
}

export function buildSeerCheckPrompt(params: {
  player: Player
  state: GameState
  privateLines: string[]
}): { system: string; user: string } {
  const { player, state, privateLines } = params
  const task = [
    '现在是夜晚,预言家查验时间。',
    `请选择要查验的存活玩家(不能查验自己):${aliveListLine(state.players)}。`,
    '【输出格式】{"target_id":3}',
  ].join('')
  const user = commonUserPrompt({ player, state, privateLines }) + '\n【任务】' + task
  return { system: SYSTEM_BASE, user }
}

export function buildWitchPrompt(params: {
  player: Player
  state: GameState
  privateLines: string[]
  wolfVictimId: number | null
}): { system: string; user: string } {
  const { player, state, privateLines, wolfVictimId } = params
  const healable = player.healLeft > 0
  const poisonable = player.poisonLeft > 0
  const victimLine = wolfVictimId !== null ? `昨夜狼人袭击了 ${state.players[wolfVictimId].name}。` : '昨夜无人被袭击。'
  const task = [
    '现在是夜晚,女巫行动时间。',
    victimLine,
    `你的解药剩余 ${player.healLeft} 瓶,毒药剩余 ${player.poisonLeft} 瓶。同一晚只能使用一瓶。`,
    healable ? '你可以选择用解药救他,也可以不用。' : '',
    poisonable ? `你也可以选择对一名存活玩家用毒(可选):${aliveListLine(state.players)}。` : '',
    '【输出格式】{"heal":true,"poison_id":null},heal 表示是否用解药,poison_id 表示毒谁(不用毒则为 null)。',
  ].join('')
  const user = commonUserPrompt({ player, state, privateLines }) + '\n【任务】' + task
  return { system: SYSTEM_BASE, user }
}

export function buildGuardPrompt(params: {
  player: Player
  state: GameState
  privateLines: string[]
}): { system: string; user: string } {
  const { player, state, privateLines } = params
  const lastLine =
    player.lastProtectId !== null
      ? `你昨晚守护了 ${state.players[player.lastProtectId].name},不能连续两晚守护同一人。`
      : ''
  const task = [
    '现在是夜晚,守卫行动时间。',
    `请选择今晚要守护的玩家(可守护自己):${aliveListLine(state.players)}。`,
    lastLine,
    '【输出格式】{"target_id":3}',
  ].join('')
  const user = commonUserPrompt({ player, state, privateLines }) + '\n【任务】' + task
  return { system: SYSTEM_BASE, user }
}

export function buildHunterShootPrompt(params: {
  player: Player
  state: GameState
  privateLines: string[]
  deathReason: 'wolf' | 'exile'
}): { system: string; user: string } {
  const { player, state, privateLines, deathReason } = params
  const task = [
    deathReason === 'exile' ? '你被投票放逐了。' : '你在昨夜被狼人杀害了。',
    '作为猎人,你可以选择开枪带走一名存活玩家,也可以选择不开枪。',
    `存活玩家:${aliveListLine(state.players)}。`,
    '【输出格式】{"shoot":true,"target_id":3},不开枪则 {"shoot":false,"target_id":null}。',
  ].join('')
  const user = commonUserPrompt({ player, state, privateLines }) + '\n【任务】' + task
  return { system: SYSTEM_BASE, user }
}

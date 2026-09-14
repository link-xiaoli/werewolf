/** M2 质量闸门:规则单元测试 + 20 局全流程不死锁验收。 */

import { describe, expect, it } from 'vitest'
import { PRESETS } from '../src/config/presets'
import { createInitialState } from '../src/game/engine'
import { runGame } from '../src/game/flow/runner'
import { CancelToken } from '../src/game/flow/flow-utils'
import { checkWinner, countVotes, resolveNight } from '../src/game/rules'
import { Secrets } from '../src/game/secrets'
import { defaultSettings } from '../src/services/settings'
import { SilentTts } from '../src/services/speech/silent-tts'
import { SpeechQueue } from '../src/services/speech/speech-queue'
import { Camp, Role, type GameConfig, type GameState, type Player } from '../src/types/game'

function makePlayer(id: number, role: Role, alive = true): Player {
  return {
    id,
    name: `${id + 1}号`,
    isHuman: false,
    role,
    alive,
    revealed: false,
    speaking: false,
    raisingHand: false,
    healLeft: role === Role.Witch ? 1 : 0,
    poisonLeft: role === Role.Witch ? 1 : 0,
    lastProtectId: null,
  }
}

describe('checkWinner 胜负判定', () => {
  it('狼全灭 → 好人胜', () => {
    const ps = [makePlayer(0, Role.Villager), makePlayer(1, Role.Werewolf, false), makePlayer(2, Role.Seer)]
    expect(checkWinner(ps)).toBe(Camp.Good)
  })
  it('狼数 ≥ 好人数 → 狼胜(屠边)', () => {
    const ps = [makePlayer(0, Role.Werewolf), makePlayer(1, Role.Werewolf), makePlayer(2, Role.Seer)]
    expect(checkWinner(ps)).toBe(Camp.Wolf)
  })
  it('狼好人 1:1 → 狼胜(屠边规则:狼数 ≥ 好人数)', () => {
    const ps = [makePlayer(0, Role.Werewolf), makePlayer(1, Role.Villager), makePlayer(2, Role.Seer, false)]
    expect(checkWinner(ps)).toBe(Camp.Wolf)
  })
  it('狼 1 好人 2 未分胜负', () => {
    const ps = [makePlayer(0, Role.Werewolf), makePlayer(1, Role.Villager), makePlayer(2, Role.Villager)]
    expect(checkWinner(ps)).toBeNull()
  })
})

describe('resolveNight 夜晚结算', () => {
  const players = [makePlayer(0, Role.Villager), makePlayer(1, Role.Villager), makePlayer(2, Role.Werewolf)]
  it('无人守护无人救 → 刀口死亡', () => {
    const r = resolveNight({ wolfTargetId: 0, guardTargetId: null, witchHeal: false, witchPoisonId: null, players })
    expect(r.deaths).toEqual([0])
    expect(r.wolfKillBlocked).toBe(false)
  })
  it('守卫守护刀口 → 平安', () => {
    const r = resolveNight({ wolfTargetId: 0, guardTargetId: 0, witchHeal: false, witchPoisonId: null, players })
    expect(r.deaths).toEqual([])
    expect(r.wolfKillBlocked).toBe(true)
  })
  it('解药救刀口 → 平安', () => {
    const r = resolveNight({ wolfTargetId: 0, guardTargetId: null, witchHeal: true, witchPoisonId: null, players })
    expect(r.deaths).toEqual([])
    expect(r.wolfKillBlocked).toBe(true)
  })
  it('毒药无视守护 → 中毒者死亡', () => {
    const r = resolveNight({ wolfTargetId: 0, guardTargetId: 0, witchHeal: false, witchPoisonId: 1, players })
    expect(r.deaths).toEqual([1])
  })
})

describe('countVotes 计票', () => {
  const alive = [0, 1, 2, 3]
  it('多数票 → 唯一最高者', () => {
    const votes = [
      { voterId: 0, targetId: 1 },
      { voterId: 1, targetId: 1 },
      { voterId: 2, targetId: 2 },
      { voterId: 3, targetId: null },
    ]
    expect(countVotes(votes, alive)).toBe(1)
  })
  it('平票 → 无人出局', () => {
    const votes = [
      { voterId: 0, targetId: 1 },
      { voterId: 1, targetId: 2 },
    ]
    expect(countVotes(votes, alive)).toBeNull()
  })
  it('全弃权 → 无人出局', () => {
    const votes = [
      { voterId: 0, targetId: null },
      { voterId: 1, targetId: null },
    ]
    expect(countVotes(votes, alive)).toBeNull()
  })
})

function makeConfig(roles: Role[]): GameConfig {
  return {
    roles,
    playerName: '',
    playerSeat: 0,
    spectator: true,
    lastWordsEnabled: true,
    interjectEnabled: false,
    witchSelfHeal: true,
    humanManual: false,
  }
}

async function runOneGame(roles: Role[]): Promise<GameState> {
  const config = makeConfig(roles)
  const gs = createInitialState(config)
  const secrets = new Secrets()
  secrets.setWolfPartners(gs.players.filter((p) => p.role === Role.Werewolf).map((p) => p.id))
  const token = new CancelToken()
  const queue = new SpeechQueue(new SilentTts(true, 10)) // 瞬时静音,专注测流程
  await runGame({ state: gs, secrets, settings: defaultSettings(), config, speechQueue: queue, token })
  return gs
}

describe('全流程不死锁(随机决策,无 LLM 无语音)', () => {
  it('6 人局连跑 20 局:全部正常结束,胜负与状态一致', async () => {
    for (let i = 1; i <= 20; i++) {
      const gs = await runOneGame(PRESETS[0].roles)
      expect(gs.winner, `第 ${i} 局应有胜者`).not.toBeNull()
      expect(checkWinner(gs.players), `第 ${i} 局胜负复核`).toBe(gs.winner)
      expect(gs.phase).toBe('game_over')
    }
  }, 120_000)

  it('12 人完整局(含守卫)连跑 5 局不死锁', async () => {
    for (let i = 1; i <= 5; i++) {
      const gs = await runOneGame(PRESETS[2].roles)
      expect(gs.winner, `第 ${i} 局应有胜者`).not.toBeNull()
      expect(checkWinner(gs.players)).toBe(gs.winner)
    }
  }, 120_000)

  it('5 人最小局(1狼1预1女2民)不死锁', async () => {
    const gs = await runOneGame([Role.Werewolf, Role.Seer, Role.Witch, Role.Villager, Role.Villager])
    expect(gs.winner).not.toBeNull()
    expect(checkWinner(gs.players)).toBe(gs.winner)
  }, 60_000)
})

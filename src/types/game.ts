/** 全项目游戏模型的类型契约。相当于 Java 的 model 包,只有 interface/enum。 */

export enum Camp {
  Good = 'good',
  Wolf = 'wolf',
}

export enum Role {
  Villager = 'villager', // 村民
  Seer = 'seer', // 预言家
  Witch = 'witch', // 女巫
  Hunter = 'hunter', // 猎人
  Guard = 'guard', // 守卫(可选)
  Werewolf = 'werewolf', // 狼人
}

export interface RoleInfo {
  name: string
  camp: Camp
  desc: string // 给玩家看的能力说明
}

export const ROLE_INFO: Record<Role, RoleInfo> = {
  [Role.Villager]: { name: '村民', camp: Camp.Good, desc: '没有特殊能力,白天投票放逐狼人' },
  [Role.Seer]: { name: '预言家', camp: Camp.Good, desc: '每晚可以查验一名玩家是好人还是狼人' },
  [Role.Witch]: { name: '女巫', camp: Camp.Good, desc: '有一瓶解药和一瓶毒药,同晚只能用一瓶' },
  [Role.Hunter]: { name: '猎人', camp: Camp.Good, desc: '被狼杀或被放逐时可以开枪带走一人(被毒死不能开枪)' },
  [Role.Guard]: { name: '守卫', camp: Camp.Good, desc: '每晚守护一人,不能连续两晚守护同一人' },
  [Role.Werewolf]: { name: '狼人', camp: Camp.Wolf, desc: '每晚与狼队友共同袭击一人,知道其他狼人是谁' },
}

export enum Phase {
  Setup = 'setup', // 配置界面
  Night = 'night', // 夜晚(内部细分见 NightStep)
  Dawn = 'dawn', // 天亮:法官宣布死讯
  Discussion = 'discussion', // 白天轮流发言
  Vote = 'vote', // 投票
  Exile = 'exile', // 放逐宣布(+猎人开枪处理)
  Dusk = 'dusk', // 黄昏:遗言
  GameOver = 'game_over',
}

export enum NightStep {
  Wolves = 'wolves', // 狼人睁眼(并行决策)
  Seer = 'seer', // 预言家查验(与狼人并行)
  Guard = 'guard', // 守卫守护(与狼人并行)
  Witch = 'witch', // 女巫救/毒(串行,必须等刀口)
  Sleep = 'sleep', // 等待天亮(玩家是无能力角色时的等待段)
}

export interface Player {
  id: number // 座位号 0..n-1,也是 3D 圆周上的位置
  name: string
  isHuman: boolean
  role: Role
  alive: boolean
  revealed: boolean // 死后亮身份(放逐亮、夜间死不亮)
  // —— 表现状态(只供渲染/动画,不参与胜负)——
  speaking: boolean
  raisingHand: boolean
  // —— 技能状态(只有对应角色使用)——
  healLeft: number // 女巫解药
  poisonLeft: number // 女巫毒药
  lastProtectId: number | null // 守卫上晚守护的人(不能连续守)
}

export type NightEventType = 'wolf_kill' | 'witch_heal' | 'witch_poison' | 'guard_protect' | 'seer_check'

export interface NightEvent {
  type: NightEventType
  actorId: number
  targetId: number
}

export interface VoteRecord {
  voterId: number
  targetId: number | null // null=弃权
}

export interface VoteRound {
  round: number
  votes: VoteRecord[]
  exiledId: number | null // 本轮放逐者,null=平票无人出局
}

export interface SpeechRecord {
  round: number
  speakerId: number
  text: string
  isInterjection: boolean
  isLastWord: boolean // 是否遗言
}

export interface LogEntry {
  time: string
  text: string
  kind: 'system' | 'speech' | 'vote' | 'night'
}

export interface GameState {
  phase: Phase
  nightStep: NightStep | null // 只有 phase==Night 时非空
  round: number // 第几轮(第几天),从 1 开始
  players: Player[]
  nightEvents: NightEvent[] // 当夜动作流水(结算用)
  deathsLastNight: number[] // 昨夜死亡名单(法官 Dawn 播报用)
  exiledLastRound: number | null
  votes: VoteRecord[] // 本轮投票
  voteRounds: VoteRound[] // 历史投票
  speechOrder: number[] // 本轮发言顺序(座位号序列)
  speechIndex: number // 进行到第几位
  currentSpeakerId: number | null
  history: SpeechRecord[] // 全部公开发言(AI 上下文数据源)
  winner: Camp | null
  log: LogEntry[]
  pendingHumanAction: HumanActionRequest | null // 需要玩家输入时的请求描述(M5 弹窗渲染依据)
}

/** 玩家需要做决定时,flow 发出的请求,UI 据此渲染弹窗 */
export type HumanActionRequest =
  | { type: 'wolf_kill'; targets: number[] }
  | { type: 'seer_check'; targets: number[] }
  | { type: 'guard_protect'; targets: number[] }
  | { type: 'witch'; targets: number[]; wolfVictimId: number | null; healAvailable: boolean; poisonAvailable: boolean }
  | { type: 'hunter_shoot'; targets: number[] }
  | { type: 'vote'; targets: number[] }
  | { type: 'speech' }

/** 玩家提交的决定 */
export type HumanActionPayload =
  | { type: 'wolf_kill'; targetId: number }
  | { type: 'seer_check'; targetId: number }
  | { type: 'guard_protect'; targetId: number }
  | { type: 'witch'; heal: boolean; poisonId: number | null }
  | { type: 'hunter_shoot'; shoot: boolean; targetId: number | null }
  | { type: 'vote'; targetId: number | null }
  | { type: 'speech'; text: string; skip: boolean }

/** 每局对局的可变配置(settings 里的静态配置之外) */
export interface GameConfig {
  roles: Role[] // 本局所有角色(长度=人数)
  playerName: string
  playerSeat: number // 人类玩家坐几号位
  spectator: boolean // 观战模式:全 AI,无人类玩家
  lastWordsEnabled: boolean // 死者是否有遗言
  interjectEnabled: boolean // 是否开启插话
  witchSelfHeal: boolean // 女巫是否可自救
  /** 人类玩家手动操作(弹窗/输入框);false 时人类座位也自动托管(调试用) */
  humanManual: boolean
}

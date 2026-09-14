/** AI 决策相关的类型契约。 */

export type DecisionKind =
  | 'speech' // 白天发言
  | 'last_word' // 遗言
  | 'vote' // 白天投票
  | 'wolf_kill' // 狼人夜晚刀人提名
  | 'seer_check' // 预言家查验
  | 'witch' // 女巫救/毒
  | 'guard_protect' // 守卫守护
  | 'hunter_shoot' // 猎人开枪
  | 'interject' // 插话判定

export interface DecisionRequest {
  kind: DecisionKind
  playerId: number
  /** 附加输入,由 flow 提供(如女巫的刀口、猎人的死因) */
  extra?: {
    wolfVictimId?: number | null
    deathReason?: 'wolf' | 'poison' | 'exile'
    currentSpeakerId?: number // 插话判定:正在发言的人
    currentSpeechText?: string // 插话判定:正在播放的发言内容
  }
}

/** 各类决策的统一返回结构(AI 返回 JSON 或随机降级后都归一到这个形状) */
export interface AIDecision {
  kind: DecisionKind
  playerId: number
  /** 发言文本(speech/last_word/interject 有值) */
  content?: string
  /** 目标玩家(投票/刀人/查验/守护有值) */
  targetId?: number | null
  /** 女巫 */
  heal?: boolean
  poisonId?: number | null
  /** 猎人 */
  shoot?: boolean
  /** 插话 */
  want?: boolean
  /** 投票/行动理由(AI 输出,写日志) */
  reason?: string
  /** 是否走了降级路径(随机/固定话术) */
  fallback: boolean
}

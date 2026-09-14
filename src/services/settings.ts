/** 全局设置:localStorage 读写。API Key 存 localStorage 是纯前端 BYOK 项目的通行做法,
 *  key 视为"用户自己填、自己用",设置页提示用户控制消费。 */

export interface AppSettings {
  llm: {
    baseUrl: string // 默认 https://api.deepseek.com;将来 CORS 收紧可改成 /llm 走 Vite 代理
    apiKey: string
    model: string
    /** 每次决策最多尝试次数(瞬态错误会重试),默认 3 */
    retryAttempts: number
    /** 全局并发调用上限(防限流),默认 4 */
    maxConcurrency: number
  }
  tts: {
    provider: 'iflytek' | 'silent'
    enabled: boolean // 关闭时用静音模式(文字版/调试)
    appId: string
    apiKey: string
    apiSecret: string
    /** 每个座位号 → 讯飞音色 ID(vcn) */
    voiceIds: Record<number, string>
    /** 法官音色 */
    judgeVoiceId: string
    speed: number // 语速 50~200(%)
  }
  game: {
    playerName: string
    lastWordsEnabled: boolean
    interjectEnabled: boolean
    witchSelfHeal: boolean
  }
  /** 本局累计 LLM 调用次数(运行期统计,不持久化也可以,这里顺手存了) */
  stats: {
    llmCalls: number
  }
}

const STORAGE_KEY = 'werewolf-settings'

export const DEFAULT_VOICES = [
  'xiaoyan', // 讯飞发音人示例(用户可在设置页替换)
  'aisjiuxu',
  'aisxping',
  'aisjinger',
  'aisbabyxu',
  'x4_lingfeizhe_oral',
  'x4_yeting',
  'x4_yezi',
  'x4_zhangjiafu',
  'x4_zongrenxiangshu',
  'x4_laotie',
  'x4_chengfeng',
]

export const DEFAULT_JUDGE_VOICE = 'aisjiuxu'

export function defaultSettings(): AppSettings {
  return {
    llm: {
      baseUrl: 'https://api.deepseek.com',
      apiKey: '',
      model: 'deepseek-flash',
      retryAttempts: 3,
      maxConcurrency: 4,
    },
    tts: {
      provider: 'iflytek',
      enabled: true,
      appId: '',
      apiKey: '',
      apiSecret: '',
      voiceIds: {},
      judgeVoiceId: DEFAULT_JUDGE_VOICE,
      speed: 100,
    },
    game: {
      playerName: '我',
      lastWordsEnabled: true,
      interjectEnabled: false,
      witchSelfHeal: true,
    },
    stats: {
      llmCalls: 0,
    },
  }
}

export function loadSettings(): AppSettings {
  const def = defaultSettings()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return def
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      ...def,
      ...parsed,
      llm: { ...def.llm, ...parsed.llm },
      tts: { ...def.tts, ...parsed.tts },
      game: { ...def.game, ...parsed.game },
      stats: { ...def.stats, ...parsed.stats },
    }
  } catch {
    return def
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

/** 取某座位的音色;没配置过就按座位号轮询默认音色表 */
export function voiceForSeat(s: AppSettings, seat: number): string {
  return s.tts.voiceIds[seat] ?? DEFAULT_VOICES[seat % DEFAULT_VOICES.length]
}

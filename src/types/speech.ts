/** TTS 服务抽象。一期实现讯飞(iflytek-tts),降级实现 silent-tts,二期实现 Azure。 */

export interface VisemeWeights {
  a: number
  i: number
  u: number
  e: number
  o: number
}

export interface SpeechEvents {
  /** 开始播放(驱动 3D 嘴部动画) */
  onStart?: () => void
  /** 结束播放 */
  onEnd?: () => void
  /** 口型权重。一期(讯飞)不触发,二期 Azure 用 viseme 事件做精准唇形 */
  onViseme?: (v: VisemeWeights) => void
}

export interface SpeakOptions {
  /** 音色 ID(讯飞 vcn 或 Azure voice name),silent 实现忽略 */
  voice?: string
  events?: SpeechEvents
}

export interface ISpeechService {
  /** 合成并播放一段文本,播放完 resolve;失败时由调用方决定降级 */
  speak(text: string, opts?: SpeakOptions): Promise<void>
  /** 立即停止当前播放。实现必须保证:挂起的 speak() promise 会被立即结束(resolve),否则队列会卡死 */
  stop(): void
  dispose(): void
}

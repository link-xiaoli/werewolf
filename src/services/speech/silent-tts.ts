/** 静音降级实现:不发声,按字数估算时长,照常触发 start/end 事件 —— 音频挂了游戏也不卡。
 *  在"调试/文字版"模式下时长极短,方便快速对局。 */

import type { ISpeechService, SpeakOptions } from '../../types/speech'

export class SilentTts implements ISpeechService {
  /** 快进模式:文字版/调试时用,每段固定 0.6s;测试可传入 durationMs 覆盖(如 10ms 瞬时) */
  constructor(
    private fastMode = false,
    private durationMs?: number,
  ) {}

  private timer: ReturnType<typeof setTimeout> | null = null
  private finish: (() => void) | null = null

  speak(text: string, opts?: SpeakOptions): Promise<void> {
    return new Promise((resolve) => {
      // 估算时长:中文约 4 字/秒
      const duration =
        this.durationMs !== undefined
          ? this.durationMs / 1000
          : this.fastMode
            ? 0.6
            : Math.min(Math.max(text.length / 4, 0.8), 15)
      const done = () => {
        if (this.finish !== resolve) return
        this.finish = null
        this.timer = null
        opts?.events?.onEnd?.()
        resolve()
      }
      this.finish = resolve
      opts?.events?.onStart?.()
      this.timer = setTimeout(done, duration * 1000)
    })
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    // 立即结束挂起的 speak promise(可能还没触发 onEnd)
    this.finish?.()
  }

  dispose(): void {
    this.stop()
  }
}

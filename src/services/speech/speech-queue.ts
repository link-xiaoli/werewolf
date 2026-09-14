/** 语音队列:FIFO 串行播放、跳过、事件转发(驱动 3D 嘴型)。
 *  speakerId=null 表示法官台词(有声无人张嘴)。
 *  防卡死设计:每项播放与 abort 信号 Promise.race,不依赖底层服务的 stop 行为。
 *  ★ 整个队列共享同一个 TTS 实例:stop() 才能停掉真正在播放的音频,保证"读完再读下一个"。 */

import type { ISpeechService } from '../../types/speech'
import { createDeferred } from '../../utils/deferred'
import { emit } from '../../utils/emitter'

interface QueueItem {
  text: string
  voice: string
  speakerId: number | null
  resolve: () => void
  abort: () => void
}

export class SpeechQueue {
  private queue: QueueItem[] = []
  private playing: QueueItem | null = null
  private running = false

  constructor(private service: ISpeechService) {}

  /** 入队并等待播放完成。speakerId=null → 法官台词 */
  enqueue(text: string, opts: { voice: string; speakerId: number | null }): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push({
        text,
        voice: opts.voice,
        speakerId: opts.speakerId,
        resolve,
        abort: () => {}, // pump 取出时会被真正的 abort 覆盖
      })
      void this.pump()
    })
  }

  private async pump(): Promise<void> {
    if (this.running) return
    this.running = true
    while (this.queue.length > 0) {
      const item = this.queue.shift()!
      this.playing = item
      const abortDeferred = createDeferred<void>()
      item.abort = () => abortDeferred.resolve()
      // 播放前先停掉一切残留音频(上一段失败/被跳过后可能还有声音)
      this.service.stop()
      emit('speech:start', { speakerId: item.speakerId })
      try {
        await Promise.race([
          this.service.speak(item.text, { voice: item.voice }),
          abortDeferred.promise,
        ])
      } catch {
        // 语音失败不影响流程,字幕/日志兜底
      } finally {
        this.playing = null
        emit('speech:end', { speakerId: item.speakerId })
        item.resolve()
      }
    }
    this.running = false
  }

  /** 跳过当前语音:标记中止 + 停止底层播放,继续下一条 */
  skipCurrent(): void {
    this.playing?.abort()
    this.service.stop()
  }

  clear(): void {
    for (const item of this.queue) {
      item.abort()
      item.resolve()
    }
    this.queue = []
    this.playing?.abort()
    this.service.stop()
  }

  dispose(): void {
    this.clear()
  }
}

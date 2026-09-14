/** 语音队列回归测试:严格串行播放,一段播完才播下一段。 */

import { describe, expect, it } from 'vitest'
import { SpeechQueue } from '../src/services/speech/speech-queue'
import type { ISpeechService } from '../src/types/speech'

/** 记录"同时活跃"数量的假服务;实现 ISpeechService 契约:stop() 立即结束挂起的 speak */
function fakeService(ms: number): ISpeechService & { maxActive: number; active: number; stopCount: number } {
  const s = {
    active: 0,
    maxActive: 0,
    stopCount: 0,
    pending: [] as (() => void)[],
    speak(): Promise<void> {
      s.active++
      s.maxActive = Math.max(s.maxActive, s.active)
      return new Promise((resolve) => {
        let settled = false
        const finish = () => {
          if (settled) return
          settled = true
          s.active--
          resolve()
        }
        const timer = setTimeout(finish, ms)
        s.pending.push(() => {
          clearTimeout(timer)
          finish()
        })
      })
    },
    stop(): void {
      s.stopCount++
      for (const f of s.pending.splice(0)) f()
    },
    dispose(): void {},
  }
  return s
}

describe('SpeechQueue 串行保证', () => {
  it('三段连续入队:任意时刻最多只有一段在播', async () => {
    const svc = fakeService(20)
    const q = new SpeechQueue(svc)
    await Promise.all([
      q.enqueue('a', { voice: 'v', speakerId: 1 }),
      q.enqueue('b', { voice: 'v', speakerId: 2 }),
      q.enqueue('c', { voice: 'v', speakerId: 3 }),
    ])
    expect(svc.maxActive).toBe(1)
  })

  it('skipCurrent 立即结束当前段并继续队列,且调用底层 stop', async () => {
    const svc = fakeService(5000) // 很长,靠 skip 打断
    const q = new SpeechQueue(svc)
    const p1 = q.enqueue('a', { voice: 'v', speakerId: 1 })
    const p2 = q.enqueue('b', { voice: 'v', speakerId: 2 })
    // 等第一段真正开始
    await new Promise((r) => setTimeout(r, 30))
    q.skipCurrent() // 打断 A
    await p1
    q.skipCurrent() // 打断 B
    await p2
    expect(svc.stopCount).toBeGreaterThan(0)
    expect(svc.maxActive).toBe(1)
  })
})

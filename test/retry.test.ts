/** 重试机制单元测试:指数退避重试、永久错误不重试、退避封顶。 */

import { describe, expect, it } from 'vitest'
import { defaultDelay, withRetry } from '../src/utils/retry'

const noDelay = () => 0

describe('withRetry', () => {
  it('失败后重试直到成功', async () => {
    let n = 0
    const result = await withRetry(
      async () => {
        n++
        if (n < 3) throw new Error('瞬时故障')
        return 'ok'
      },
      { attempts: 5, delayMsFor: noDelay },
    )
    expect(result).toBe('ok')
    expect(n).toBe(3)
  })

  it('全部失败后抛出最后一次错误', async () => {
    let n = 0
    await expect(
      withRetry(
        async () => {
          n++
          throw new Error('x')
        },
        { attempts: 3, delayMsFor: noDelay },
      ),
    ).rejects.toThrow('x')
    expect(n).toBe(3)
  })

  it('shouldRetry=false 立即抛出,不浪费重试', async () => {
    let n = 0
    await expect(
      withRetry(
        async () => {
          n++
          throw new Error('永久错误')
        },
        { attempts: 3, delayMsFor: noDelay, shouldRetry: () => false },
      ),
    ).rejects.toThrow('永久错误')
    expect(n).toBe(1)
  })

  it('delayMsFor 依次收到 1、2(第 1、2 次失败后的退避)', async () => {
    const delays: number[] = []
    await expect(
      withRetry(
        async () => {
          throw new Error('x')
        },
        {
          attempts: 3,
          delayMsFor: (attempt) => {
            delays.push(attempt)
            return 0
          },
        },
      ),
    ).rejects.toThrow('x')
    expect(delays).toEqual([1, 2])
  })
})

describe('defaultDelay 指数退避', () => {
  it('第一次退避约 1.2s(±30% 抖动)', () => {
    const d = defaultDelay(1)
    expect(d).toBeGreaterThanOrEqual(1200 * 0.7)
    expect(d).toBeLessThanOrEqual(1200 * 1.3)
  })
  it('退避封顶 8s', () => {
    const d = defaultDelay(6)
    expect(d).toBeLessThanOrEqual(8000 * 1.3)
  })
})

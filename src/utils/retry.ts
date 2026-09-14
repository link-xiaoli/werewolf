/** 通用重试:指数退避 + 随机抖动。attempts 为总尝试次数。 */

export interface RetryOptions {
  /** 总尝试次数,默认 3 */
  attempts?: number
  /** 每次重试前的等待毫秒数(attempt 从 1 开始 = 第 1 次失败后) */
  delayMsFor?: (attempt: number, error: unknown) => number
  /** 哪些错误值得重试,默认全部重试 */
  shouldRetry?: (error: unknown) => boolean
}

/** 默认退避:1.2s → 2.4s → 4.8s(上限 8s),±30% 抖动避免同刻重试风暴 */
export function defaultDelay(attempt: number): number {
  return Math.min(1200 * 2 ** (attempt - 1), 8000) * (0.7 + Math.random() * 0.6)
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 3
  const delayMsFor = opts.delayMsFor ?? defaultDelay
  const shouldRetry = opts.shouldRetry ?? (() => true)
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e
      if (attempt >= attempts || !shouldRetry(e)) throw e
      const delay = Math.round(delayMsFor(attempt, e))
      console.warn(
        `[retry] 第 ${attempt} 次尝试失败(${e instanceof Error ? e.message : e}),${delay}ms 后重试(${attempt + 1}/${attempts})`,
      )
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastError
}

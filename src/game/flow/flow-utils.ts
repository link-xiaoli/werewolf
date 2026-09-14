/** 流程工具:取消令牌、超时、睡眠。三个防卡死护栏的基础。 */

import { createDeferred } from '../../utils/deferred'

export class CancelError extends Error {
  constructor() {
    super('游戏已取消')
    this.name = 'CancelError'
  }
}

export class CancelToken {
  private deferred = createDeferred<void>()
  private isCancelled = false

  get cancelled(): boolean {
    return this.isCancelled
  }

  cancel(): void {
    if (this.isCancelled) return
    this.isCancelled = true
    this.deferred.resolve()
  }

  /** 取消时 resolve 的 promise,可与任何等待 race */
  get promise(): Promise<void> {
    return this.deferred.promise
  }

  throwIfCancelled(): void {
    if (this.isCancelled) throw new CancelError()
  }
}

/** 与取消信号竞速:取消则抛 CancelError */
export async function withCancel<T>(p: Promise<T>, token: CancelToken): Promise<T> {
  return Promise.race([
    p,
    token.promise.then(() => {
      throw new CancelError()
    }),
  ])
}

/** 超时包装:超时抛 Error */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`超时(${ms / 1000}s)`)), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export function isCancelError(e: unknown): boolean {
  return e instanceof CancelError || (e instanceof Error && e.name === 'CancelError')
}

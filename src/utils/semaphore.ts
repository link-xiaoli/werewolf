/** 并发信号量:限制同时进行的异步任务数,防止打爆 API 限流。 */

export class Semaphore {
  private active = 0
  private waiters: (() => void)[] = []

  constructor(public limit: number) {}

  /** 占用一个名额,返回释放函数(用完后必须调用) */
  async acquire(): Promise<() => void> {
    if (this.active < this.limit) {
      this.active++
      return () => this.release()
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve))
    this.active++
    return () => this.release()
  }

  private release(): void {
    this.active--
    const next = this.waiters.shift()
    if (next) next()
  }
}

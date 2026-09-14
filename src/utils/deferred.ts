/** "手摇 Promise":把"等玩家操作"变成可 await 的 Promise。 */

export interface Deferred<T> {
  promise: Promise<T>
  resolve: (v: T) => void
  reject: (e: unknown) => void
  settled: boolean
}

export function createDeferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  let settled = false
  const promise = new Promise<T>((res, rej) => {
    resolve = (v) => {
      settled = true
      res(v)
    }
    reject = (e) => {
      settled = true
      rej(e)
    }
  })
  return { promise, resolve, reject, settled }
}

/** 随机工具:整数、抽样、加权选择。 */

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)]
}

/** 洗牌(原地),返回原数组 */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(0, i)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** 从 arr 中不放回抽取 n 个 */
export function sample<T>(arr: T[], n: number): T[] {
  return shuffle([...arr]).slice(0, n)
}

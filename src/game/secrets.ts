/** 私密信息容器:每个玩家的隐藏信息(查验记录等)。
 *  只进 AI 上下文,绝不放 store、绝不给组件 —— 组件连这个模块都不 import。 */

export interface SeerCheckRecord {
  targetId: number
  isWolf: boolean
  round: number
}

export class Secrets {
  /** 预言家查验记录,key = 预言家座位号 */
  seerChecks = new Map<number, SeerCheckRecord[]>()

  /** 狼队友名单,key = 狼人座位号 */
  wolfPartners = new Map<number, number[]>()

  recordCheck(seerId: number, targetId: number, isWolf: boolean, round: number): void {
    const list = this.seerChecks.get(seerId) ?? []
    list.push({ targetId, isWolf, round })
    this.seerChecks.set(seerId, list)
  }

  setWolfPartners(wolfIds: number[]): void {
    for (const id of wolfIds) {
      this.wolfPartners.set(id, wolfIds.filter((w) => w !== id))
    }
  }

  getChecks(seerId: number): SeerCheckRecord[] {
    return this.seerChecks.get(seerId) ?? []
  }

  getPartners(wolfId: number): number[] {
    return this.wolfPartners.get(wolfId) ?? []
  }
}

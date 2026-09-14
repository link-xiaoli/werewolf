/** 角色外观抽象:一期程序化小人,二期 VRM 模型(动态 import,失败自动回退)。 */

import type * as THREE from 'three'

export interface IAvatar {
  group: THREE.Group
  /** 说话开关(驱动嘴部/头部动画) */
  setSpeaking(speaking: boolean): void
  /** 死亡/放逐状态(触发一次性动画) */
  setDead(kind: 'exiled' | 'killed'): void
  /** 举手(插话/投票时用) */
  setRaisingHand(raising: boolean): void
  /** 每帧更新 */
  update(dt: number): void
  dispose(): void
}

export interface AvatarOptions {
  name: string
  color: string
}

export type AvatarFactory = (opts: AvatarOptions) => IAvatar

/** 默认工厂:程序化小人 */
export function createAvatar(opts: AvatarOptions): IAvatar {
  // 二期:检测 public/models/{seat}.vrm 存在则尝试 three-vrm 加载,失败回退
  return createProceduralAvatar(opts)
}

// 循环依赖规避:运行时 require 程序化实现
import { createProceduralAvatar } from './avatar-procedural'

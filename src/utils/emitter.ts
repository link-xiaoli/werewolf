/** 类型安全事件总线。组件→store action→emitter.emit;flow 侧用 once() 包成 Promise 来 await。 */

import type { HumanActionPayload } from '../types/game'
import { createDeferred } from './deferred'

export interface EventMap {
  /** 玩家提交了发言(speakIt: 是否朗读玩家自己的发言) */
  'player:speech-submitted': { text: string; skip: boolean; speakIt: boolean }
  /** 玩家提交了投票 */
  'player:vote-submitted': { targetId: number | null }
  /** 玩家提交了夜晚行动/猎人开枪 */
  'player:night-action': HumanActionPayload
  /** 一段语音开始播放(speakerId=null 表示法官) */
  'speech:start': { speakerId: number | null }
  /** 一段语音结束播放 */
  'speech:end': { speakerId: number | null }
  /** 玩家点了"跳过语音" */
  'skip-speech': void
}

type EventName = keyof EventMap

type Handler<T> = (payload: T) => void

const handlers = new Map<EventName, Set<Handler<never>>>()

export function on<K extends EventName>(event: K, handler: Handler<EventMap[K]>): () => void {
  const set = (handlers.get(event) ?? new Set()) as Set<Handler<never>>
  set.add(handler as Handler<never>)
  handlers.set(event, set)
  return () => set.delete(handler as Handler<never>)
}

export function emit<K extends EventName>(event: K, payload: EventMap[K]): void {
  const set = handlers.get(event)
  if (!set) return
  for (const h of [...set]) (h as Handler<EventMap[K]>)(payload)
}

/** 等待某个事件发生一次,返回它的 payload。多等者并存时按注册顺序依次 resolve。 */
export function once<K extends EventName>(event: K): Promise<EventMap[K]> {
  const deferred = createDeferred<EventMap[K]>()
  const off = on(event, (payload) => {
    off()
    deferred.resolve(payload)
  })
  return deferred.promise
}

/** 清空所有监听(对局结束时调用,防止残留) */
export function clearAllHandlers(): void {
  handlers.clear()
}

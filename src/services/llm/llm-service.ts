/** DeepSeek / OpenAI 兼容 chat completions 客户端。
 *  baseURL 可配:默认 https://api.deepseek.com;若 CORS 收紧改 /llm 走 Vite 代理。
 *  2026 年模型名:deepseek-flash(deepseek-chat 已于 2026-07 停用)。
 *  内置全局并发信号量,防止并行调用触发限流。 */

import { defaultSettings, loadSettings, saveSettings, type AppSettings } from '../settings'
import { Semaphore } from '../../utils/semaphore'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
}

/** 带 HTTP 状态码的错误,便于调用方区分"值得重试"与"永久失败" */
export class LlmError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message)
    this.name = 'LlmError'
  }
}

/** 全局 LLM 并发闸门(所有调用共用,限额来自设置,可运行时调整) */
const llmSemaphore = new Semaphore(4)

function safeSettings(): AppSettings {
  try {
    return loadSettings()
  } catch {
    return defaultSettings() // 测试等无 localStorage 环境
  }
}

/** DeepSeek 要求:使用 response_format=json_object 时,提示词必须包含 "json" 字样,否则 400。
 *  这里兜底:检测不到就自动在最后一条消息后补一句。 */
function ensureJsonMention(messages: ChatMessage[]): ChatMessage[] {
  const hasJson = messages.some((m) => /json/i.test(m.content))
  if (hasJson) return messages
  const copy = [...messages]
  const last = copy[copy.length - 1]
  copy[copy.length - 1] = { ...last, content: `${last.content}\n\n请以 JSON 格式输出。` }
  return copy
}

/** 非流式调用,返回纯文本内容。JSON 模式由 response_format 保证。
 *  本函数只负责"这一次"请求:超时/重试由调用方(withRetry)控制。 */
export async function chatJson(messages: ChatMessage[], opts: ChatOptions): Promise<string> {
  // 动态同步并发上限(可在设置页调整)
  llmSemaphore.limit = safeSettings().llm.maxConcurrency
  const release = await llmSemaphore.acquire()
  try {
    const baseUrl = opts.baseUrl.replace(/\/+$/, '')
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: ensureJsonMention(messages),
        response_format: { type: 'json_object' },
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        stream: false,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      if (res.status === 401) throw new LlmError('API Key 无效,请检查设置', 401)
      if (res.status === 402) throw new LlmError('账户余额不足', 402)
      if (res.status === 429) throw new LlmError('请求过于频繁(限流)', 429)
      if (res.status === 404) throw new LlmError('模型不存在,请检查模型名(如 deepseek-flash)', 404)
      throw new LlmError(`HTTP ${res.status}: ${body.slice(0, 200)}`, res.status)
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string; reasoning_content?: string }; finish_reason?: string }[]
    }
    const choice = data.choices?.[0]
    if (!choice?.message?.content) {
      // 区分两种空响应:思考模式只回了 reasoning_content / 服务端偶发空内容
      if (choice?.message?.reasoning_content) {
        throw new LlmError('模型只输出了思考过程,未输出内容(可尝试调大 max_tokens)', 200)
      }
      throw new LlmError(`响应为空(finish_reason=${choice?.finish_reason ?? '无'},可能是服务端瞬时故障)`, 200)
    }
    if (choice.finish_reason === 'length') {
      // 被截断也先尝试返回,交给上层校验
      console.warn('[llm] finish_reason=length,输出可能被截断')
    }

    // 统计调用次数(辅助功能,失败绝不能影响主流程;测试环境无 localStorage)
    try {
      const s = loadSettings()
      s.stats.llmCalls += 1
      saveSettings(s)
    } catch {
      /* 忽略 */
    }

    return choice.message.content
  } finally {
    release()
  }
}

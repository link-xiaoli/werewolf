/** LLM 客户端回归测试:json_object 模式下提示词必须含 "json" 字样(DeepSeek 400 防护)。 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { chatJson, type ChatMessage } from '../src/services/llm/llm-service'

function mockFetch(): { body: () => string } {
  let captured = ''
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      captured = String(init?.body)
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"result":"成功"}' }, finish_reason: 'stop' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }),
  )
  return { body: () => captured }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const OPTS = { baseUrl: 'https://api.example.com', apiKey: 'k', model: 'm', temperature: 0, maxTokens: 30 }

describe('chatJson', () => {
  it('提示词含 JSON 字样时原样发送', async () => {
    const { body } = mockFetch()
    const messages: ChatMessage[] = [{ role: 'user', content: '请只输出 JSON 对象' }]
    await chatJson(messages, OPTS)
    const sent = JSON.parse(body()) as { messages: ChatMessage[] }
    expect(sent.messages[0].content).toBe('请只输出 JSON 对象')
    expect(sent.messages).toHaveLength(1)
  })

  it('提示词不含 json 字样时自动补齐,避免 DeepSeek 400', async () => {
    const { body } = mockFetch()
    await chatJson([{ role: 'user', content: '测试' }], OPTS)
    const sent = JSON.parse(body()) as { messages: ChatMessage[] }
    expect(JSON.stringify(sent.messages)).toMatch(/json/i)
    expect(sent.messages).toHaveLength(1)
  })

  it('HTTP 401 抛出友好错误', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 401 })),
    )
    await expect(chatJson([{ role: 'user', content: 'x' }], OPTS)).rejects.toThrow('API Key 无效')
  })
})

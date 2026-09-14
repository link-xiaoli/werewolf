/** 讯飞在线语音合成(WebSocket 流式):
 *  浏览器端 HMAC-SHA256 签名(Web Crypto,零依赖)→ WebSocket 拉取 PCM → 拼 WAV → <audio> 播放。
 *  官方 WebSocket API 支持跨域(鉴权走 URL query)。
 *  注意:讯飞会校验请求时间,电脑时钟偏差 >300s 会被 401 拒绝。 */

import type { ISpeechService, SpeakOptions } from '../../types/speech'

const HOST = 'tts-api.xfyun.cn'
const PATH = '/v2/tts'

// —— base64 / 字节工具 ——

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function utf8ToBase64(s: string): string {
  return toBase64(new TextEncoder().encode(s))
}

/** 16kHz 16bit 单声道 PCM → WAV(44 字节头) */
function buildWav(pcm: Uint8Array<ArrayBuffer>, sampleRate = 16000): Blob {
  const header = new Uint8Array(44)
  const dv = new DataView(header.buffer)
  const writeStr = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) dv.setUint8(offset + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  dv.setUint32(4, 36 + pcm.length, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  dv.setUint32(16, 16, true)
  dv.setUint16(20, 1, true) // PCM
  dv.setUint16(22, 1, true) // 单声道
  dv.setUint32(24, sampleRate, true)
  dv.setUint32(28, sampleRate * 2, true) // byteRate
  dv.setUint16(32, 2, true) // blockAlign
  dv.setUint16(34, 16, true) // 位深
  writeStr(36, 'data')
  dv.setUint32(40, pcm.length, true)
  return new Blob([header, pcm], { type: 'audio/wav' })
}

/** 组装鉴权 URL:authorization/date/host 三件套放 query */
async function buildAuthUrl(apiKey: string, apiSecret: string): Promise<string> {
  const date = new Date().toUTCString() // RFC1123 GMT
  const signatureOrigin = `host: ${HOST}\ndate: ${date}\nGET ${PATH} HTTP/1.1`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signatureOrigin))
  const signature = toBase64(new Uint8Array(sig))
  const authorization = toBase64(
    new TextEncoder().encode(
      `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`,
    ),
  )
  const params = new URLSearchParams({ authorization, date, host: HOST })
  return `wss://${HOST}${PATH}?${params}`
}

export interface IflytekConfig {
  appId: string
  apiKey: string
  apiSecret: string
  /** 语速 0~100,默认 50 */
  speed: number
}

export class IflytekTts implements ISpeechService {
  private ws: WebSocket | null = null
  private audio: HTMLAudioElement | null = null
  private finishCurrent: (() => void) | null = null

  constructor(private cfg: IflytekConfig) {}

  speak(text: string, opts?: SpeakOptions): Promise<void> {
    return this.attempt(text, opts, 0)
  }

  /** 拉取+播放一次;失败自动重试 1 次,再失败 reject(由队列兜底,不影响流程) */
  private attempt(text: string, opts: SpeakOptions | undefined, retry: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stop()
      let settled = false
      const finish = (err?: Error): void => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        this.finishCurrent = null
        this.ws = null
        if (err) reject(err)
        else {
          opts?.events?.onEnd?.()
          resolve()
        }
      }
      const retryOnce = (err: Error): void => {
        if (retry < 1) {
          console.warn('[iflytek] 重试一次:', err.message)
          resolve(this.attempt(text, opts, retry + 1)) // 只重试 1 次
        } else {
          finish(err)
        }
      }

      // 15s 无响应超时
      const timeout = setTimeout(() => retryOnce(new Error('讯飞响应超时(15s)')), 15000)

      buildAuthUrl(this.cfg.apiKey, this.cfg.apiSecret)
        .then((url) => {
          const ws = new WebSocket(url)
          this.ws = ws
          const chunks: Uint8Array[] = []
          let finished = false

          ws.onopen = () => {
            const frame = {
              common: { app_id: this.cfg.appId },
              business: {
                aue: 'raw',
                auf: 'audio/L16;rate=16000',
                vcn: opts?.voice ?? 'xiaoyan',
                tte: 'UTF8',
                speed: Math.min(100, Math.max(0, this.cfg.speed)),
              },
              data: { status: 2, text: utf8ToBase64(text) },
            }
            ws.send(JSON.stringify(frame))
          }

          ws.onmessage = (ev: MessageEvent) => {
            try {
              const msg = JSON.parse(String(ev.data)) as {
                code: number
                message?: string
                data?: { audio?: string; status?: number }
              }
              if (msg.code !== 0) {
                retryOnce(new Error(`讯飞错误 ${msg.code}: ${msg.message ?? ''}`))
                return
              }
              if (msg.data?.audio) chunks.push(base64ToBytes(msg.data.audio))
              if (msg.data?.status === 2) {
                finished = true
                ws.close()
                this.playWav(chunks, finish)
              }
            } catch (e) {
              retryOnce(new Error('讯飞响应解析失败'))
            }
          }

          ws.onerror = () => retryOnce(new Error('讯飞连接失败'))
          ws.onclose = () => {
            if (!finished && !settled) retryOnce(new Error('讯飞连接提前关闭'))
          }
        })
        .catch((e) => retryOnce(e instanceof Error ? e : new Error(String(e))))

      this.finishCurrent = () => finish(new Error('已停止'))
    })
  }

  /** 合并 PCM 帧 → WAV → 播放 */
  private playWav(chunks: Uint8Array[], onEnd: (err?: Error) => void): void {
    const total = chunks.reduce((a, c) => a + c.length, 0)
    if (total === 0) {
      onEnd(new Error('讯飞返回空音频'))
      return
    }
    const pcm = new Uint8Array(total)
    let off = 0
    for (const c of chunks) {
      pcm.set(c, off)
      off += c.length
    }
    const url = URL.createObjectURL(buildWav(pcm))
    const audio = new Audio(url)
    this.audio = audio
    audio.onended = () => {
      URL.revokeObjectURL(url)
      this.audio = null
      onEnd()
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      this.audio = null
      onEnd(new Error('音频播放失败'))
    }
    void audio.play().catch(() => {
      // 浏览器自动播放策略:用户没点过页面时可能被拦,兜底结束
      audio.onended = null
      URL.revokeObjectURL(url)
      this.audio = null
      onEnd(new Error('音频播放被浏览器拦截'))
    })
  }

  stop(): void {
    // 契约:立即结束挂起的 speak promise
    this.finishCurrent?.()
    try {
      this.ws?.close()
    } catch {
      /* ignore */
    }
    this.ws = null
    if (this.audio) {
      this.audio.pause()
      this.audio = null
    }
  }

  dispose(): void {
    this.stop()
  }
}

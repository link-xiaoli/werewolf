# AI 狼人杀 — 项目说明(给 AI 开发会话)

纯前端狼人杀:人类玩家 + DeepSeek AI 角色,讯飞 TTS 朗读,Three.js 3D 圆桌。

## 命令

- `npm run dev` — 开发服务器(5173 被占用会顺延,注意看实际端口)
- `npm test` — vitest 引擎测试(含 20 局不死锁验收,改动 game/ 后必跑)
- `npm run build` — vue-tsc 类型检查 + 生产构建(改动后必跑)

## 架构铁律(改动前必读)

1. **game/ 目录不 import Vue、不碰 DOM** —— 纯 TS,可单测
2. **组件永远不直接改对局数据**,只调 store action;对局走向由 `game/flow/runner.ts` 决定
3. **提示词全部在 `src/game/agents/prompts/`**,调 prompt 不用动代码
4. 数据流:组件 → store action → flow(async/await 线性编排)→ services;three/ 只订阅事件总线(speech:start/end)+ 读 state 做表现
5. **角色保密**:每个 AI 的可见信息由 `game/agents/context.ts` 按角色过滤;验人记录等私密信息只放 `game/secrets.ts`,组件禁止接触
6. 玩家输入桥接:`flow 侧 await once('player:xxx')` ↔ `store action emit` ↔ 组件弹窗;人类行动请求渲染依据是 `state.pendingHumanAction`
7. 防卡死:所有 LLM 调用 30s 超时、TTS 15s 超时;"跳过语音"按钮;CancelToken 每步检查
8. 语音服务契约:`ISpeechService.stop()` 必须立即结束挂起的 speak promise;SpeechQueue 用 abort 竞速兜底

## 关键文件

| 文件 | 职责 |
|---|---|
| `src/types/game.ts` | 全部游戏模型契约(先读这个) |
| `src/game/rules.ts` | 发牌/计票/夜晚结算/胜负判定(纯函数,有单测) |
| `src/game/flow/runner.ts` / `night-flow.ts` / `day-flow.ts` | 对局主循环与各阶段编排 |
| `src/game/agents/` | AI 决策入口(agent.ts)、可见信息(context.ts)、JSON 容错(decide.ts) |
| `src/services/llm/llm-service.ts` | DeepSeek/OpenAI 兼容客户端(2026 模型名:`deepseek-flash`) |
| `src/services/speech/` | 讯飞 TTS(iflytek-tts.ts)、队列(speech-queue.ts)、静音降级(silent-tts.ts) |
| `src/three/` | 3D 表现层:three-manager(RAF+联动)、avatar-procedural(几何体小人)、scene(圆桌) |
| `src/store/game-store.ts` | 唯一状态源;`__ww.debug(n)` 控制台自动跑 n 局 |

## 已确认的技术事实(不要推翻)

- DeepSeek 浏览器直连 CORS 实测可行(2026-09);baseURL 可配,`/llm` 走 Vite 代理是 CORS 收紧时的兜底
- 模型名 `deepseek-flash`(`deepseek-chat` 已停用);JSON 模式必须 prompt 内嵌 JSON 示例
- 讯飞 TTS:WebSocket + URL 鉴权(host/date/authorization 三件套,HMAC-SHA256),PCM→WAV→audio 播放;时钟不准会 401
- Ready Player Me 已关停(2026-01);二期人物升级用 VRoid .vrm + @pixiv/three-vrm(IAvatar 接口已预留)
- 二期 TTS 升级:Azure Speech SDK(viseme 事件走 `SpeechEvents.onViseme` 回调,3D 侧接口已预留)

## 二期待办

- [ ] Azure TTS 适配器 + viseme 精准唇形
- [ ] VRoid 模型加载(avatar-factory 里检测 public/models/*.vrm,动态 import three-vrm,失败回退小人;注意与 three 版本匹配)
- [ ] 相机跟随发言者;座位音色设置面板;上警环节;代码分包(three 单独 chunk)

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './styles.css'
import App from './App.vue'
import { useGameStore } from './store/game-store'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')

// 调试入口:浏览器控制台执行 __ww.debug(20) 连续自动跑 20 局(验收 M2 不死锁)
declare global {
  interface Window {
    __ww?: { debug: (n: number) => Promise<void> }
  }
}
window.__ww = {
  debug: (n: number) => useGameStore().debugAutoRun(n),
}

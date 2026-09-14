/** 设置 store:响应式副本 + 持久化。 */

import { defineStore } from 'pinia'
import { loadSettings, saveSettings, type AppSettings } from '../services/settings'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    s: loadSettings() as AppSettings,
  }),
  actions: {
    /** 局部更新并持久化 */
    update(patch: Partial<AppSettings>): void {
      this.s = { ...this.s, ...patch }
      saveSettings(this.s)
    },
    updateLlm(patch: Partial<AppSettings['llm']>): void {
      this.s.llm = { ...this.s.llm, ...patch }
      saveSettings(this.s)
    },
    updateTts(patch: Partial<AppSettings['tts']>): void {
      this.s.tts = { ...this.s.tts, ...patch }
      saveSettings(this.s)
    },
    updateGame(patch: Partial<AppSettings['game']>): void {
      this.s.game = { ...this.s.game, ...patch }
      saveSettings(this.s)
    },
  },
})

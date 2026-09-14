<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGameStore } from '../store/game-store'
import { Phase } from '../types/game'

const game = useGameStore()
const req = computed(() => game.state?.pendingHumanAction ?? null)
const gs = computed(() => game.state)

const TITLES: Record<string, string> = {
  wolf_kill: '狼人行动 · 选择今晚要袭击的玩家',
  seer_check: '预言家查验 · 选择要查验的玩家',
  guard_protect: '守卫守护 · 选择要守护的玩家',
  witch: '女巫行动 · 决定是否用药',
  hunter_shoot: '猎人开枪 · 选择是否开枪',
}

function name(id: number): string {
  return gs.value?.players[id]?.name ?? `${id + 1}号`
}

const isNightAction = computed(
  () =>
    req.value !== null &&
    ['wolf_kill', 'seer_check', 'guard_protect', 'witch', 'hunter_shoot'].includes(req.value.type),
)

// —— 女巫本地状态 ——
const witchHeal = ref(false)
const witchPoison = ref<number | null>(null)
watch(req, (r) => {
  if (r?.type === 'witch') {
    witchHeal.value = false
    witchPoison.value = null
  }
})

function submitWitch(): void {
  game.submitNightAction({ type: 'witch', heal: witchHeal.value, poisonId: witchHeal.value ? null : witchPoison.value })
}

// —— 猎人本地状态 ——
const hunterShoot = ref(false)
const hunterTarget = ref<number | null>(null)
watch(req, (r) => {
  if (r?.type === 'hunter_shoot') {
    hunterShoot.value = false
    hunterTarget.value = null
  }
})

function submitHunter(): void {
  game.submitNightAction({
    type: 'hunter_shoot',
    shoot: hunterShoot.value,
    targetId: hunterShoot.value ? hunterTarget.value : null,
  })
}
</script>

<template>
  <!-- 夜晚进行中(无待办行动)-->
  <div v-if="!isNightAction && gs?.phase === Phase.Night" class="night-wait">
    <template v-if="gs.pendingHumanAction === null">
      夜晚进行中,请闭眼等待…
    </template>
  </div>

  <div v-if="isNightAction" class="modal-mask">
    <div class="modal">
      <h3>{{ TITLES[req!.type] }}</h3>
      <div class="ornament">·</div>

      <!-- 普通单选目标:狼刀/查验/守护 -->
      <template v-if="req!.type === 'wolf_kill' || req!.type === 'seer_check' || req!.type === 'guard_protect'">
        <div class="target-grid">
          <button
            v-for="id in req!.targets"
            :key="id"
            class="target-btn"
            @click="game.submitNightAction({ type: req!.type, targetId: id } as never)"
          >
            {{ name(id) }}
          </button>
        </div>
      </template>

      <!-- 女巫 -->
      <template v-else-if="req!.type === 'witch'">
        <p class="witch-victim">
          <template v-if="req!.wolfVictimId !== null">昨夜 <b>{{ name(req!.wolfVictimId) }}</b> 被袭击</template>
          <template v-else>昨夜是平安夜(无人被袭击)</template>
        </p>
        <div class="witch-actions" v-if="req!.healAvailable">
          <button class="target-btn heal" @click="witchHeal = !witchHeal" :class="{ on: witchHeal }">
            使用解药{{ witchHeal ? '(救)' : '' }}
          </button>
        </div>
        <div class="witch-poison" v-if="req!.poisonAvailable && !witchHeal">
          <p class="sub">用毒(可选):</p>
          <div class="target-grid">
            <button
              v-for="id in req!.targets"
              :key="id"
              class="target-btn poison"
              :class="{ on: witchPoison === id }"
              @click="witchPoison = witchPoison === id ? null : id"
            >
              {{ name(id) }}
            </button>
          </div>
        </div>
        <div class="modal-actions">
          <button class="ghost" @click="submitWitch">不用药</button>
          <button class="primary" :disabled="!witchHeal && witchPoison === null" @click="submitWitch">确定</button>
        </div>
      </template>

      <!-- 猎人 -->
      <template v-else-if="req!.type === 'hunter_shoot'">
        <div class="hunter-actions">
          <button class="target-btn" :class="{ on: hunterShoot }" @click="hunterShoot = !hunterShoot">
            开枪
          </button>
        </div>
        <div class="target-grid" v-if="hunterShoot">
          <button
            v-for="id in req!.targets"
            :key="id"
            class="target-btn poison"
            :class="{ on: hunterTarget === id }"
            @click="hunterTarget = hunterTarget === id ? null : id"
          >
            {{ name(id) }}
          </button>
        </div>
        <div class="modal-actions">
          <button class="ghost" @click="game.submitNightAction({ type: 'hunter_shoot', shoot: false, targetId: null })">
            不开枪
          </button>
          <button class="primary" :disabled="hunterShoot && hunterTarget === null" @click="submitHunter">确定</button>
        </div>
      </template>
    </div>
  </div>
</template>

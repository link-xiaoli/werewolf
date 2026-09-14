/** Three.js 表现层总管:渲染器、相机、RAF 循环、角色与游戏状态的联动。
 *  只订阅事件总线和读 store 状态,不写游戏规则。 */

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { GameState } from '../types/game'
import { on } from '../utils/emitter'
import { createAvatar, type IAvatar } from './avatar-factory'
import { AVATAR_COLORS, buildRoom, computeSeatPose } from './scene'

export class ThreeManager {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private clock = new THREE.Clock()
  private raf = 0
  private avatars = new Map<number, IAvatar>()
  private wasAlive = new Map<number, boolean>()
  private offs: (() => void)[] = []
  private getState: () => GameState
  private disposed = false

  constructor(canvas: HTMLCanvasElement, getState: () => GameState) {
    this.getState = getState
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    this.camera.position.set(0, 3.6, 7.5)

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.target.set(0, 1.1, 0)
    this.controls.minDistance = 2.5
    this.controls.maxDistance = 14
    this.controls.maxPolarAngle = 1.5
    this.controls.enablePan = false
    this.controls.enableDamping = true

    this.buildWorld()
    this.bindEvents()
    this.resize()
    window.addEventListener('resize', this.resize)

    this.clock.start()
    this.loop()
  }

  /** 按当前玩家列表搭建座位与角色 */
  private buildWorld(): void {
    const players = this.getState().players
    const n = players.length
    buildRoom(this.scene, n)
    for (const p of players) {
      const pose = computeSeatPose(p.id, n)
      const avatar = createAvatar({ name: p.name, color: AVATAR_COLORS[p.id % AVATAR_COLORS.length] })
      avatar.group.position.copy(pose.position)
      avatar.group.rotation.y = pose.rotationY
      this.scene.add(avatar.group)
      this.avatars.set(p.id, avatar)
      this.wasAlive.set(p.id, true)
    }
  }

  /** 语音事件 → 嘴部动画 */
  private bindEvents(): void {
    this.offs.push(
      on('speech:start', ({ speakerId }) => {
        if (speakerId !== null) this.avatars.get(speakerId)?.setSpeaking(true)
      }),
    )
    this.offs.push(
      on('speech:end', ({ speakerId }) => {
        if (speakerId !== null) this.avatars.get(speakerId)?.setSpeaking(false)
      }),
    )
  }

  private resize = (): void => {
    const el = this.renderer.domElement.parentElement
    if (!el) return
    const w = el.clientWidth || 1
    const h = el.clientHeight || 1
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private loop = (): void => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(this.clock.getDelta(), 0.1)

    // 同步游戏状态 → 表现:死亡/放逐动画、举手
    const players = this.getState().players
    for (const p of players) {
      const avatar = this.avatars.get(p.id)
      if (!avatar) continue
      const was = this.wasAlive.get(p.id)
      if (was && !p.alive) {
        avatar.setDead(p.revealed ? 'exiled' : 'killed')
        avatar.setSpeaking(false)
      }
      this.wasAlive.set(p.id, p.alive)
      avatar.setRaisingHand(p.raisingHand && p.alive)
      avatar.update(dt)
    }

    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.resize)
    for (const off of this.offs) off()
    this.offs = []
    for (const a of this.avatars.values()) a.dispose()
    this.avatars.clear()
    this.controls.dispose()
    this.renderer.dispose()
  }
}

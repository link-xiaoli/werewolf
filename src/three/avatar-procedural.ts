/** 程序化几何体卡通小人:球头+眼睛+嘴+帽子+身体,坐姿。
 *  说话时嘴部周期开合(简版唇形同步);死亡向后倒;放逐下沉出桌。 */

import * as THREE from 'three'
import type { AvatarOptions, IAvatar } from './avatar-factory'

const SKIN = '#f2c9a0'
const DARK = '#3a3a42'
const WHITE = '#ffffff'

function makeNameSprite(name: string): { sprite: THREE.Sprite; mat: THREE.SpriteMaterial } {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const g = canvas.getContext('2d')!
  // 圆角底
  g.fillStyle = 'rgba(20,20,30,0.75)'
  g.beginPath()
  g.roundRect(8, 8, 240, 48, 16)
  g.fill()
  // 名字
  g.fillStyle = '#ffffff'
  g.font = 'bold 32px "Microsoft YaHei", sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(name, 128, 34)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false })
  const sprite = new THREE.Sprite(mat)
  return { sprite, mat }
}

export function createProceduralAvatar(opts: AvatarOptions): IAvatar {
  const group = new THREE.Group()
  const color = new THREE.Color(opts.color)

  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.75 })
  const skinMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.6 })
  const darkMat = new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.85 })
  const whiteMat = new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.5 })
  const accentMat = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.75), roughness: 0.7 })
  const allMats = [bodyMat, skinMat, darkMat, whiteMat, accentMat]

  // 腿(坐姿,向前伸)
  const legGeo = new THREE.CapsuleGeometry(0.055, 0.28)
  const legL = new THREE.Mesh(legGeo, darkMat)
  legL.position.set(-0.09, 0.42, 0.22)
  legL.rotation.x = -0.45
  const legR = legL.clone()
  legR.position.x = 0.09
  const footGeo = new THREE.SphereGeometry(0.06)
  const footL = new THREE.Mesh(footGeo, darkMat)
  footL.position.set(-0.09, 0.2, 0.48)
  const footR = footL.clone()
  footR.position.x = 0.09

  // 身体
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.3), bodyMat)
  torso.position.y = 0.66

  // 头
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 18), skinMat)
  head.position.y = 1.08
  const eyeGeo = new THREE.SphereGeometry(0.028, 10, 8)
  const eyeL = new THREE.Mesh(eyeGeo, darkMat)
  eyeL.position.set(-0.065, 1.13, 0.145)
  const eyeR = eyeL.clone()
  eyeR.position.x = 0.065

  // 嘴(说话时 scale.y 振荡)
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), darkMat)
  mouth.position.set(0, 1.0, 0.15)
  mouth.scale.set(1, 0.3, 0.5)

  // 帽子(配色=该玩家专属色)
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.24, 20), accentMat)
  hat.position.y = 1.38
  const hatBall = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), whiteMat)
  hatBall.position.y = 1.52

  // 右臂(绕肩关节旋转实现举手)
  const armPivot = new THREE.Group()
  armPivot.position.set(0.23, 0.88, 0)
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.22), accentMat)
  arm.position.y = -0.17
  armPivot.add(arm)

  // 名牌(永远面向相机)
  const { sprite: nameSprite, mat: nameMat } = makeNameSprite(opts.name)
  nameSprite.position.y = 1.7
  nameSprite.scale.set(0.75, 0.19, 1)

  group.add(legL, legR, footL, footR, torso, head, eyeL, eyeR, mouth, hat, hatBall, armPivot, nameSprite)

  // —— 动画状态 ——
  let speaking = false
  let raising = false
  let deadKind: 'exiled' | 'killed' | null = null
  let deadAnim = 0
  let t = Math.random() * 10 // 相位随机,呼吸不同步
  const idleTorsoY = torso.position.y
  const idleArmX = armPivot.rotation.x
  const idleHeadX = head.rotation.x

  function update(dt: number): void {
    t += dt
    const k = 1 - Math.exp(-dt * 8) // 平滑系数

    if (deadKind === null) {
      // 呼吸
      torso.position.y += (idleTorsoY + Math.sin(t * 2) * 0.012 - torso.position.y) * k
    }

    if (speaking) {
      mouth.scale.y = 0.3 + Math.abs(Math.sin(t * 13)) * 2.2
      head.rotation.x += (Math.sin(t * 7) * 0.06 - head.rotation.x) * k
      nameMat.color.lerp(new THREE.Color('#ffd76e'), k)
    } else {
      mouth.scale.y += (0.3 - mouth.scale.y) * k
      head.rotation.x += (idleHeadX - head.rotation.x) * k
      nameMat.color.lerp(new THREE.Color('#ffffff'), k)
    }

    // 举手
    armPivot.rotation.x += ((raising ? -2.4 : idleArmX) - armPivot.rotation.x) * k

    // 死亡动画
    if (deadKind === 'killed' && deadAnim < 1) {
      deadAnim = Math.min(1, deadAnim + dt * 1.1)
      group.rotation.x = -deadAnim * 1.35 // 向后倒
      for (const m of allMats) {
        m.transparent = true
        m.opacity = 1 - deadAnim * 0.4
      }
    } else if (deadKind === 'exiled' && deadAnim < 1) {
      deadAnim = Math.min(1, deadAnim + dt * 0.7)
      group.position.y = -deadAnim * 1.8 // 下沉出桌
    }
  }

  return {
    group,
    setSpeaking(v: boolean) {
      speaking = v
    },
    setRaisingHand(v: boolean) {
      raising = v
    },
    setDead(kind: 'exiled' | 'killed') {
      if (deadKind === null) deadKind = kind
    },
    update,
    dispose() {
      for (const m of allMats) m.dispose()
      nameMat.map?.dispose()
      nameMat.dispose()
    },
  }
}

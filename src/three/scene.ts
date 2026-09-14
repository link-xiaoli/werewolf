/** 场景搭建:地板、圆桌、椅子、灯光。返回座位位置表。 */

import * as THREE from 'three'

/** 12 名玩家专属配色(帽子/衣服),复古柔和色调 */
export const AVATAR_COLORS = [
  '#b04a3a', '#3f6d9e', '#5f8a4a', '#c08a2d', '#8a5a8f', '#4f8f86',
  '#c06a3a', '#b05070', '#3f7a5f', '#a03a30', '#4a6a9e', '#7a9a3f',
]

export interface SeatPose {
  position: THREE.Vector3
  /** 面朝圆心的旋转角 */
  rotationY: number
}

/** 座位 i 的圆周角度:0 号位在相机正对面(最远处) */
export function seatAngle(i: number, n: number): number {
  return -Math.PI / 2 + (i * 2 * Math.PI) / n
}

export const TABLE_RADIUS = 1.7
export const SEAT_RADIUS = 2.7

export function computeSeatPose(i: number, n: number): SeatPose {
  const a = seatAngle(i, n)
  const position = new THREE.Vector3(Math.cos(a) * SEAT_RADIUS, 0, Math.sin(a) * SEAT_RADIUS)
  // 本地 +Z 朝向圆心(圆心的方向角是 a+PI)
  return { position, rotationY: a + Math.PI }
}

export function buildRoom(scene: THREE.Scene, n: number): void {
  // 复古桌游夜色:暖褐背景 + 烛光色调
  scene.background = new THREE.Color('#1f150b')
  scene.fog = new THREE.FogExp2('#1f150b', 0.016)

  // 灯光:烛光暖色
  scene.add(new THREE.HemisphereLight('#f7e8cd', '#33241a', 1.0))
  const dir = new THREE.DirectionalLight('#ffd9a0', 1.7)
  dir.position.set(4, 8, 3)
  scene.add(dir)

  // 地板:深木色
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(9, 48),
    new THREE.MeshStandardMaterial({ color: '#2e2113', roughness: 0.92 }),
  )
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)

  // 圆桌:深红绒布桌面
  const tableMat = new THREE.MeshStandardMaterial({ color: '#4a3423', roughness: 0.7 })
  const feltMat = new THREE.MeshStandardMaterial({ color: '#6e1f1f', roughness: 0.9 })
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, 0.1, 40), tableMat)
  tableTop.position.y = 0.8
  scene.add(tableTop)
  const felt = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_RADIUS - 0.15, TABLE_RADIUS - 0.15, 0.03, 40), feltMat)
  felt.position.y = 0.85
  scene.add(felt)
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.8, 20), tableMat)
  leg.position.y = 0.4
  scene.add(leg)
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.08, 24), tableMat)
  base.position.y = 0.04
  scene.add(base)

  // 椅子 × n
  for (let i = 0; i < n; i++) {
    scene.add(buildChair(computeSeatPose(i, n)))
  }
}

function buildChair(pose: SeatPose): THREE.Group {
  const mat = new THREE.MeshStandardMaterial({ color: '#5b3d24', roughness: 0.75 })
  const g = new THREE.Group()
  // 座面
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.28, 0.08, 20), mat)
  seat.position.y = 0.46
  g.add(seat)
  // 靠背(本地 -Z 方向,即朝外)
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.55, 0.08), mat)
  back.position.set(0, 0.75, -0.28)
  back.rotation.x = -0.15
  g.add(back)
  // 椅腿
  const legGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.46, 10)
  for (const [x, z] of [[-0.22, 0.2], [0.22, 0.2], [-0.22, -0.2], [0.22, -0.2]]) {
    const leg = new THREE.Mesh(legGeo, mat)
    leg.position.set(x, 0.23, z)
    g.add(leg)
  }
  g.position.copy(pose.position)
  g.rotation.y = pose.rotationY
  return g
}

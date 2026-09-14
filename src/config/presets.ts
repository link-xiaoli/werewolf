/** 人数预设与配比校验。 */

import { Role } from '../types/game'

export interface Preset {
  key: string
  label: string
  roles: Role[]
}

export const PRESETS: Preset[] = [
  {
    key: 'six',
    label: '6 人新手局',
    roles: [Role.Werewolf, Role.Werewolf, Role.Seer, Role.Witch, Role.Villager, Role.Villager],
  },
  {
    key: 'nine',
    label: '9 人标准局',
    roles: [
      Role.Werewolf, Role.Werewolf, Role.Werewolf,
      Role.Seer, Role.Witch, Role.Hunter,
      Role.Villager, Role.Villager, Role.Villager,
    ],
  },
  {
    key: 'twelve',
    label: '12 人完整局',
    roles: [
      Role.Werewolf, Role.Werewolf, Role.Werewolf, Role.Werewolf,
      Role.Seer, Role.Witch, Role.Hunter, Role.Guard,
      Role.Villager, Role.Villager, Role.Villager, Role.Villager,
    ],
  },
]

/** 校验自定义配比,返回错误信息或 null */
export function validateRoles(roles: Role[]): string | null {
  if (roles.length < 5) return '至少需要 5 名玩家'
  if (roles.length > 12) return '最多支持 12 名玩家'
  const wolves = roles.filter((r) => r === Role.Werewolf).length
  const goods = roles.length - wolves
  if (wolves === 0) return '至少需要 1 名狼人'
  if (wolves >= goods) return '狼人数量必须少于好人数量'
  return null
}

/** 把任意角色列表展开成"数量可调"的形式,供自定义配置 UI 使用 */
export interface RoleCountOption {
  role: Role
  label: string
  min: number
  max: number
  defaultCount: number
}

export const ROLE_COUNT_OPTIONS: RoleCountOption[] = [
  { role: Role.Werewolf, label: '狼人', min: 1, max: 4, defaultCount: 2 },
  { role: Role.Seer, label: '预言家', min: 0, max: 1, defaultCount: 1 },
  { role: Role.Witch, label: '女巫', min: 0, max: 1, defaultCount: 1 },
  { role: Role.Hunter, label: '猎人', min: 0, max: 1, defaultCount: 0 },
  { role: Role.Guard, label: '守卫', min: 0, max: 1, defaultCount: 0 },
  { role: Role.Villager, label: '村民', min: 0, max: 8, defaultCount: 2 },
]

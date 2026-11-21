import { AIArchetype, ArtifactDefinition, ArtifactId, MatchConfig, SpellDefinition, SpellId } from './types';

export const ARENA_INITIAL_RADIUS = 520;
export const ARENA_MIN_RADIUS = 135;
export const ARENA_WORLD_BOUND = 840;

export const SHRINK_INTERVAL = 11.5; // seconds between arena ring collapses
export const SHRINK_WARNING_DURATION = 3.2; // seconds outer ring glows red before collapsing
export const SHRINK_STEP_RADIUS = 68;

export const LAVA_BASE_DPS = 26;
export const LAVA_FRICTION = 2.4;
export const STONE_FRICTION = 5.4;
export const BASE_MOVE_SPEED = 232;
export const BASE_MAX_HP = 150;
export const WARLOCK_RADIUS = 20;

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  totalRounds: 5,
  botCount: 5,
  difficulty: 'normal',
};

export const SPELL_ORDER: SpellId[] = ['fireball', 'repel', 'teleport', 'meteor', 'gravity', 'swap'];

export const SPELLS: Record<SpellId, SpellDefinition> = {
  fireball: {
    id: 'fireball',
    key: 'Q',
    name: '火球术',
    enName: 'Fireball',
    role: '远程爆裂击退',
    description: '发射高速爆裂火球，命中敌人或石柱时引爆并造成强力击退。',
    accentColor: '#f97316',
    unlockedByDefault: true,
    unlockCost: 0,
    upgradeCosts: [10, 15, 22, 30],
    maxLevel: 5,
    baseCooldown: 2.8,
    cooldownPerLevel: -0.22,
    baseDamage: 24,
    damagePerLevel: 5,
    baseKnockback: 450,
    knockbackPerLevel: 55,
    baseRange: 560,
    rangePerLevel: 40,
    baseRadius: 52,
    radiusPerLevel: 6,
    projectileSpeed: 640,
    windup: 0.14,
  },
  repel: {
    id: 'repel',
    key: 'W',
    name: '斥力护盾',
    enName: 'Scourge Repel',
    role: '近身震退 · 反弹法术',
    description: '释放环形斥力冲击波，击退附近敌人并将来袭敌方弹道原路反弹。',
    accentColor: '#38bdf8',
    unlockedByDefault: true,
    unlockCost: 0,
    upgradeCosts: [10, 15, 22, 30],
    maxLevel: 5,
    baseCooldown: 5.5,
    cooldownPerLevel: -0.5,
    baseDamage: 14,
    damagePerLevel: 4,
    baseKnockback: 560,
    knockbackPerLevel: 70,
    baseRange: 130,
    rangePerLevel: 14,
    baseRadius: 130,
    radiusPerLevel: 14,
    windup: 0.06,
  },
  teleport: {
    id: 'teleport',
    key: 'E',
    name: '暗影闪烁',
    enName: 'Teleport',
    role: '瞬间位移 · 脱离岩浆',
    description: '瞬间传送到指定位置并清除击退动量，是脱离岩浆与躲避陨石的核心神技。',
    accentColor: '#a855f7',
    unlockedByDefault: true,
    unlockCost: 0,
    upgradeCosts: [12, 18, 25, 34],
    maxLevel: 5,
    baseCooldown: 8.0,
    cooldownPerLevel: -0.85,
    baseDamage: 0,
    damagePerLevel: 0,
    baseKnockback: 0,
    knockbackPerLevel: 0,
    baseRange: 270,
    rangePerLevel: 38,
    baseRadius: 40,
    radiusPerLevel: 0,
    windup: 0.05,
  },
  meteor: {
    id: 'meteor',
    key: 'R',
    name: '熔岩陨石',
    enName: 'Meteor',
    role: '延迟天降 · 大范围击飞',
    description: '召唤燃烧陨石坠落目标区域，短暂预警后造成巨额伤害与大范围击飞。',
    accentColor: '#ef4444',
    unlockedByDefault: true,
    unlockCost: 0,
    upgradeCosts: [12, 18, 26, 36],
    maxLevel: 5,
    baseCooldown: 9.0,
    cooldownPerLevel: -0.7,
    baseDamage: 38,
    damagePerLevel: 8,
    baseKnockback: 600,
    knockbackPerLevel: 65,
    baseRange: 480,
    rangePerLevel: 35,
    baseRadius: 108,
    radiusPerLevel: 12,
    windup: 0.18,
  },
  gravity: {
    id: 'gravity',
    key: 'D',
    name: '引力漩涡',
    enName: 'Gravity Well',
    role: '持续牵引 · 控场连招',
    description: '在目标区域制造持续2.6秒的虚空黑洞，不断牵引敌人并造成暗影灼烧。',
    accentColor: '#818cf8',
    unlockedByDefault: false,
    unlockCost: 14,
    upgradeCosts: [12, 18, 24, 32],
    maxLevel: 5,
    baseCooldown: 10.5,
    cooldownPerLevel: -0.8,
    baseDamage: 12, // DPS
    damagePerLevel: 4,
    baseKnockback: 310, // Pull force
    knockbackPerLevel: 45,
    baseRange: 460,
    rangePerLevel: 35,
    baseRadius: 145,
    radiusPerLevel: 14,
    windup: 0.16,
  },
  swap: {
    id: 'swap',
    key: 'F',
    name: '灵魂钩链',
    enName: 'Soul Swap',
    role: '远程换位 · 绝境反杀',
    description: '射出暗影锁链，命中敌方术士时强制双方互换位置并附带眩晕震荡。',
    accentColor: '#10b981',
    unlockedByDefault: false,
    unlockCost: 16,
    upgradeCosts: [12, 18, 26, 34],
    maxLevel: 5,
    baseCooldown: 9.5,
    cooldownPerLevel: -0.8,
    baseDamage: 18,
    damagePerLevel: 5,
    baseKnockback: 220,
    knockbackPerLevel: 30,
    baseRange: 540,
    rangePerLevel: 45,
    baseRadius: 24,
    radiusPerLevel: 2,
    projectileSpeed: 760,
    windup: 0.12,
  },
};

export const ARTIFACT_ORDER: ArtifactId[] = [
  'boots',
  'lava_charm',
  'arcane_cloak',
  'titan_sigil',
  'vampiric_tome',
  'thorns_mail',
];

export const ARTIFACTS: Record<ArtifactId, ArtifactDefinition> = {
  boots: {
    id: 'boots',
    name: '疾风之靴',
    enName: 'Boots of Speed',
    description: '每层 +12% 移动速度，走位与逃离岩浆更迅捷。',
    cost: 12,
    accentColor: '#38bdf8',
    maxStacks: 3,
  },
  lava_charm: {
    id: 'lava_charm',
    name: '熔岩护符',
    enName: 'Magma Talisman',
    description: '每层 +25 最大生命值，并降低 22% 岩浆灼烧伤害。',
    cost: 14,
    accentColor: '#f97316',
    maxStacks: 3,
  },
  arcane_cloak: {
    id: 'arcane_cloak',
    name: '秘法披风',
    enName: 'Cloak of Haste',
    description: '每层减少 12% 全法术冷却时间。',
    cost: 16,
    accentColor: '#a855f7',
    maxStacks: 3,
  },
  titan_sigil: {
    id: 'titan_sigil',
    name: '泰坦徽记',
    enName: 'Titan Crest',
    description: '每层降低 18% 所受击退距离，稳守战场中央。',
    cost: 15,
    accentColor: '#eab308',
    maxStacks: 3,
  },
  vampiric_tome: {
    id: 'vampiric_tome',
    name: '鲜血魔典',
    enName: 'Blood Grimoire',
    description: '每层提供 16% 法术吸血，命中敌人回复生命。',
    cost: 16,
    accentColor: '#ef4444',
    maxStacks: 3,
  },
  thorns_mail: {
    id: 'thorns_mail',
    name: '斥力魔甲',
    enName: 'Runic Carapace',
    description: '每层 +12% 法术伤害，近身碰撞额外弹开敌人。',
    cost: 15,
    accentColor: '#10b981',
    maxStacks: 3,
  },
};

export interface BotRosterEntry {
  name: string;
  title: string;
  archetype: AIArchetype;
  color: string;
  trimColor: string;
}

export const BOT_ROSTER: BotRosterEntry[] = [
  { name: '卡尔·炎魔', title: '烈焰狂徒', archetype: 'pyromancer', color: '#dc2626', trimColor: '#fbbf24' },
  { name: '玛尔加尼斯', title: '虚空行者', archetype: 'voidwalker', color: '#7c3aed', trimColor: '#c4b5fd' },
  { name: '古尔丹之影', title: '铁壁术士', archetype: 'bastion', color: '#15803d', trimColor: '#86efac' },
  { name: '艾萨拉秘使', title: '游击魔导', archetype: 'skirmisher', color: '#0284c7', trimColor: '#7dd3fc' },
  { name: '萨格拉斯卫', title: '烈焰狂徒', archetype: 'pyromancer', color: '#d97706', trimColor: '#fde68a' },
  { name: '基尔加丹徒', title: '虚空行者', archetype: 'voidwalker', color: '#be185d', trimColor: '#fbcfe8' },
  { name: '克尔苏加德', title: '游击魔导', archetype: 'skirmisher', color: '#0f766e', trimColor: '#99f6e4' },
];

export const PLAYER_APPEARANCE = {
  name: '大术士 (你)',
  title: '暗影议会',
  color: '#e5a93c',
  trimColor: '#fff3c4',
};

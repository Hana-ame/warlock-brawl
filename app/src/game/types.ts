export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover';
export type GamePhase = 'title' | 'intro' | 'combat' | 'round_end' | 'shop' | 'paused' | 'victory' | 'defeat';

export type SpellId = 'fireball' | 'repel' | 'teleport' | 'meteor' | 'gravity' | 'swap';
export type SpellKey = 'Q' | 'W' | 'E' | 'R' | 'D' | 'F';

export type ArtifactId = 'boots' | 'lava_charm' | 'arcane_cloak' | 'titan_sigil' | 'vampiric_tome' | 'thorns_mail';

export type AIArchetype = 'pyromancer' | 'voidwalker' | 'bastion' | 'skirmisher';

export interface Vec2 {
  x: number;
  y: number;
}

export interface SpellDefinition {
  id: SpellId;
  key: SpellKey;
  name: string;
  enName: string;
  role: string;
  description: string;
  accentColor: string;
  unlockedByDefault: boolean;
  unlockCost: number;
  upgradeCosts: number[]; // index 0 = Lv1->Lv2, 1 = Lv2->Lv3, 2 = Lv3->Lv4, 3 = Lv4->Lv5
  maxLevel: number;
  baseCooldown: number;
  cooldownPerLevel: number;
  baseDamage: number;
  damagePerLevel: number;
  baseKnockback: number;
  knockbackPerLevel: number;
  baseRange: number;
  rangePerLevel: number;
  baseRadius: number;
  radiusPerLevel: number;
  projectileSpeed?: number;
  windup: number;
}

export interface ArtifactDefinition {
  id: ArtifactId;
  name: string;
  enName: string;
  description: string;
  cost: number;
  accentColor: string;
  maxStacks: number;
}

export interface MatchConfig {
  totalRounds: 3 | 5 | 7;
  botCount: 3 | 5 | 7;
  difficulty: 'normal' | 'hard';
}

export interface WarlockEntity {
  id: string;
  name: string;
  title: string;
  isPlayer: boolean;
  archetype: AIArchetype;
  color: string;
  trimColor: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  knockVx: number;
  knockVy: number;
  facing: number;
  radius: number;
  hp: number;
  maxHp: number;
  ghostHp: number; // delayed trailing damage bar
  alive: boolean;
  koTimer: number; // > 0 during KO dissolve/arc animation
  inLava: boolean;
  lavaTickAccum: number;
  hitFlash: number;
  squashX: number;
  squashY: number;
  walkPhase: number;
  // Move target (for right-click RTS movement)
  moveTarget: Vec2 | null;
  // Cast windup state
  castingSpell: SpellId | null;
  castWindup: number;
  castWindupTotal: number;
  castTarget: Vec2 | null;
  // Spells & progression
  spellLevels: Record<SpellId, number>; // 0 = locked, 1..5 = unlocked level
  cooldowns: Record<SpellId, number>;
  artifacts: Record<ArtifactId, number>;
  // Economy & tournament stats
  gold: number;
  roundWins: number;
  totalKills: number;
  roundKills: number;
  totalDamage: number;
  roundDamage: number;
  lastDamagedBy: string | null;
  lastDamagedTime: number;
  // Active buff VFX
  repelFlash: number;
  blinkFlash: number;
  // AI memory
  aiThinkTimer: number;
  aiStrafeDir: number;
  aiTargetId: string | null;
  aiAnchorAngle: number;
}

export interface ProjectileEntity {
  id: string;
  spellId: 'fireball' | 'swap';
  ownerId: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  knockback: number;
  blastRadius: number;
  traveled: number;
  maxRange: number;
  reflected: boolean;
  age: number;
}

export interface MeteorEntity {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  radius: number;
  damage: number;
  knockback: number;
  delay: number;
  elapsed: number;
  color: string;
}

export interface GravityWellEntity {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  radius: number;
  pullForce: number;
  dps: number;
  duration: number;
  elapsed: number;
}

export interface PillarEntity {
  id: string;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  hitFlash: number;
}

export interface CrumbledTile {
  x: number;
  y: number;
  size: number;
  angle: number;
  rotSpeed: number;
  alpha: number;
  age: number;
}

export interface KillFeedItem {
  id: string;
  killerName: string;
  killerColor: string;
  victimName: string;
  victimColor: string;
  cause: 'spell' | 'lava' | 'reflect';
  timestamp: number;
}

export interface RoundSummary {
  roundNumber: number;
  winnerId: string | null;
  winnerName: string;
  winnerColor: string;
  playerRank: number;
  totalCombatants: number;
  playerGoldEarned: number;
  playerKills: number;
  playerDamage: number;
  standings: Array<{
    id: string;
    name: string;
    color: string;
    isPlayer: boolean;
    roundWins: number;
    totalKills: number;
    totalDamage: number;
    alive: boolean;
    gold: number;
  }>;
}

export interface HudSnapshot {
  screen: GameScreenState;
  phase: GamePhase;
  round: number;
  totalRounds: number;
  roundTimer: number;
  introCountdown: number;
  arenaRadius: number;
  maxArenaRadius: number;
  shrinkStage: number;
  nextShrinkIn: number;
  aliveCount: number;
  totalCombatants: number;
  muted: boolean;
  player: {
    hp: number;
    maxHp: number;
    ghostHp: number;
    inLava: boolean;
    alive: boolean;
    gold: number;
    roundWins: number;
    totalKills: number;
    totalDamage: number;
    spellLevels: Record<SpellId, number>;
    cooldowns: Record<SpellId, number>;
    maxCooldowns: Record<SpellId, number>;
    artifacts: Record<ArtifactId, number>;
    selectedSpell: SpellId | null;
  };
  killFeed: KillFeedItem[];
  roundSummary: RoundSummary | null;
  finalSummary: RoundSummary | null;
  shopTimer: number;
}

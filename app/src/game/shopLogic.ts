import {
  ARTIFACTS,
  BASE_MAX_HP,
  BASE_MOVE_SPEED,
  SPELLS,
} from './constants';
import { ArtifactId, SpellId, WarlockEntity } from './types';

export interface DerivedStats {
  maxHp: number;
  moveSpeed: number;
  cooldownScale: number;
  lavaDamageScale: number;
  knockbackTakenScale: number;
  lifestealRatio: number;
  spellDamageScale: number;
  collisionBounceBonus: number;
}

export function getDerivedStats(artifacts: Record<ArtifactId, number>): DerivedStats {
  const boots = artifacts.boots || 0;
  const lava = artifacts.lava_charm || 0;
  const cloak = artifacts.arcane_cloak || 0;
  const titan = artifacts.titan_sigil || 0;
  const vamp = artifacts.vampiric_tome || 0;
  const thorns = artifacts.thorns_mail || 0;

  return {
    maxHp: BASE_MAX_HP + lava * 25,
    moveSpeed: BASE_MOVE_SPEED * (1 + boots * 0.12),
    cooldownScale: Math.max(0.45, Math.pow(0.88, cloak)),
    lavaDamageScale: Math.max(0.32, Math.pow(0.78, lava)),
    knockbackTakenScale: Math.max(0.42, Math.pow(0.82, titan)),
    lifestealRatio: vamp * 0.16,
    spellDamageScale: 1 + thorns * 0.12,
    collisionBounceBonus: thorns * 110,
  };
}

export interface SpellComputedStats {
  level: number;
  cooldown: number;
  damage: number;
  knockback: number;
  range: number;
  radius: number;
}

export function getSpellStats(
  spellId: SpellId,
  level: number,
  artifacts: Record<ArtifactId, number>
): SpellComputedStats {
  const def = SPELLS[spellId];
  const effectiveLevel = Math.max(1, Math.min(def.maxLevel, level));
  const delta = effectiveLevel - 1;
  const derived = getDerivedStats(artifacts);

  return {
    level: effectiveLevel,
    cooldown: Math.max(0.9, (def.baseCooldown + def.cooldownPerLevel * delta) * derived.cooldownScale),
    damage: Math.round((def.baseDamage + def.damagePerLevel * delta) * derived.spellDamageScale),
    knockback: Math.round(def.baseKnockback + def.knockbackPerLevel * delta),
    range: Math.round(def.baseRange + def.rangePerLevel * delta),
    radius: Math.round(def.baseRadius + def.radiusPerLevel * delta),
  };
}

export function getSpellNextCost(spellId: SpellId, currentLevel: number): number | null {
  const def = SPELLS[spellId];
  if (currentLevel === 0) {
    return def.unlockCost;
  }
  if (currentLevel >= def.maxLevel) {
    return null;
  }
  return def.upgradeCosts[currentLevel - 1] ?? null;
}

export function buyOrUpgradeSpell(warlock: WarlockEntity, spellId: SpellId): { ok: boolean; cost: number; newLevel: number } {
  const current = warlock.spellLevels[spellId] || 0;
  const cost = getSpellNextCost(spellId, current);
  if (cost === null || warlock.gold < cost) {
    return { ok: false, cost: cost ?? 0, newLevel: current };
  }
  warlock.gold -= cost;
  warlock.spellLevels[spellId] = current + 1;
  return { ok: true, cost, newLevel: current + 1 };
}

export function buyArtifact(warlock: WarlockEntity, artifactId: ArtifactId): { ok: boolean; cost: number; newStacks: number } {
  const def = ARTIFACTS[artifactId];
  const current = warlock.artifacts[artifactId] || 0;
  if (current >= def.maxStacks || warlock.gold < def.cost) {
    return { ok: false, cost: def.cost, newStacks: current };
  }
  warlock.gold -= def.cost;
  warlock.artifacts[artifactId] = current + 1;
  const derived = getDerivedStats(warlock.artifacts);
  warlock.maxHp = derived.maxHp;
  warlock.hp = derived.maxHp;
  warlock.ghostHp = derived.maxHp;
  return { ok: true, cost: def.cost, newStacks: current + 1 };
}

export function calculateRoundGoldReward(params: {
  survived: boolean;
  roundKills: number;
  roundDamage: number;
  placementRank: number; // 1 = winner
  totalCombatants: number;
}): number {
  const baseGold = 12;
  const winBonus = params.survived || params.placementRank === 1 ? 10 : 0;
  const placementBonus = Math.max(0, Math.round((params.totalCombatants - params.placementRank) * 2));
  const killBonus = params.roundKills * 6;
  const damageBonus = Math.min(12, Math.floor(params.roundDamage / 35));
  return baseGold + winBonus + placementBonus + killBonus + damageBonus;
}

export function aiAutoShop(warlock: WarlockEntity): void {
  // Bots spend gold intelligently based on their archetype
  const preferredSpells: Record<WarlockEntity['archetype'], SpellId[]> = {
    pyromancer: ['fireball', 'meteor', 'repel', 'teleport'],
    voidwalker: ['gravity', 'swap', 'teleport', 'fireball'],
    bastion: ['repel', 'meteor', 'fireball', 'gravity'],
    skirmisher: ['teleport', 'fireball', 'swap', 'repel'],
  };
  const preferredArtifacts: Record<WarlockEntity['archetype'], ArtifactId[]> = {
    pyromancer: ['thorns_mail', 'arcane_cloak', 'vampiric_tome', 'boots'],
    voidwalker: ['arcane_cloak', 'boots', 'lava_charm', 'vampiric_tome'],
    bastion: ['titan_sigil', 'lava_charm', 'thorns_mail', 'vampiric_tome'],
    skirmisher: ['boots', 'arcane_cloak', 'lava_charm', 'thorns_mail'],
  };

  let guard = 0;
  while (warlock.gold >= 10 && guard < 8) {
    guard++;
    let bought = false;

    // 55% chance try spell upgrade/unlock first
    const trySpellFirst = guard % 2 === 1;
    if (trySpellFirst) {
      for (const sid of preferredSpells[warlock.archetype]) {
        const res = buyOrUpgradeSpell(warlock, sid);
        if (res.ok) {
          bought = true;
          break;
        }
      }
    }
    if (!bought) {
      for (const aid of preferredArtifacts[warlock.archetype]) {
        const res = buyArtifact(warlock, aid);
        if (res.ok) {
          bought = true;
          break;
        }
      }
    }
    if (!bought && !trySpellFirst) {
      for (const sid of preferredSpells[warlock.archetype]) {
        const res = buyOrUpgradeSpell(warlock, sid);
        if (res.ok) {
          bought = true;
          break;
        }
      }
    }
    if (!bought) break;
  }
}

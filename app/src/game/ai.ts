import { SPELLS } from './constants';
import { distanceBetween } from './physics';
import { getSpellStats } from './shopLogic';
import {
  GravityWellEntity,
  MeteorEntity,
  ProjectileEntity,
  SpellId,
  Vec2,
  WarlockEntity,
} from './types';

export interface AIDecision {
  moveDir: Vec2;
  castSpell: SpellId | null;
  castTarget: Vec2 | null;
}

export interface AIWorldView {
  warlocks: WarlockEntity[];
  projectiles: ProjectileEntity[];
  meteors: MeteorEntity[];
  gravityWells: GravityWellEntity[];
  arenaRadius: number;
  difficulty: 'normal' | 'hard';
  attackTokensAvailable: number;
}

export function decideAIAction(bot: WarlockEntity, world: AIWorldView, dt: number): AIDecision {
  const decision: AIDecision = {
    moveDir: { x: 0, y: 0 },
    castSpell: null,
    castTarget: null,
  };

  if (!bot.alive || bot.castingSpell) {
    return decision;
  }

  bot.aiThinkTimer -= dt;
  const distFromCenter = Math.hypot(bot.x, bot.y);
  const safeMargin = Math.max(45, world.arenaRadius - 42);

  // 1. EMERGENCY LAVA RECOVERY (All archetypes prioritize surviving lava!)
  if (distFromCenter > world.arenaRadius - 8) {
    const toCenterX = -bot.x / Math.max(1, distFromCenter);
    const toCenterY = -bot.y / Math.max(1, distFromCenter);
    decision.moveDir.x = toCenterX;
    decision.moveDir.y = toCenterY;

    // Blink back to safety immediately if deep in lava and Teleport is ready
    if (
      distFromCenter > world.arenaRadius + 16 &&
      bot.spellLevels.teleport > 0 &&
      bot.cooldowns.teleport <= 0
    ) {
      const tpStats = getSpellStats('teleport', bot.spellLevels.teleport, bot.artifacts);
      const jumpDist = Math.min(tpStats.range * 0.9, distFromCenter * 0.85);
      decision.castSpell = 'teleport';
      decision.castTarget = {
        x: bot.x + toCenterX * jumpDist,
        y: bot.y + toCenterY * jumpDist,
      };
      return decision;
    }

    // Voidwalker trickster special: if in lava and enemy is safe on stone, try Soul Swap!
    if (
      bot.archetype === 'voidwalker' &&
      distFromCenter > world.arenaRadius + 10 &&
      bot.spellLevels.swap > 0 &&
      bot.cooldowns.swap <= 0
    ) {
      const victim = findClosestEnemy(bot, world.warlocks, (e) => Math.hypot(e.x, e.y) < world.arenaRadius - 25);
      if (victim && distanceBetween(bot.x, bot.y, victim.x, victim.y) < 460) {
        decision.castSpell = 'swap';
        decision.castTarget = { x: victim.x, y: victim.y };
        return decision;
      }
    }

    return decision;
  }

  // 2. DODGE INCOMING METEOR TELEGRAPHS
  for (const m of world.meteors) {
    const d = distanceBetween(bot.x, bot.y, m.x, m.y);
    if (d < m.radius + 36) {
      const awayX = bot.x - m.x;
      const awayY = bot.y - m.y;
      const len = Math.hypot(awayX, awayY) || 1;
      decision.moveDir.x = awayX / len;
      decision.moveDir.y = awayY / len;
      // If meteor is nearly landing and we're deep inside, teleport out
      if (m.elapsed > m.delay * 0.55 && d < m.radius * 0.72 && bot.cooldowns.teleport <= 0) {
        decision.castSpell = 'teleport';
        decision.castTarget = {
          x: bot.x + (awayX / len) * 160,
          y: bot.y + (awayY / len) * 160,
        };
      }
      return decision;
    }
  }

  // 3. DEFENSIVE REPEL / PROJECTILE REFLECTION (Bastion reacts fastest, others react on close shots)
  if (bot.spellLevels.repel > 0 && bot.cooldowns.repel <= 0) {
    const repelStats = getSpellStats('repel', bot.spellLevels.repel, bot.artifacts);
    const reactDist = bot.archetype === 'bastion' ? repelStats.radius + 35 : repelStats.radius + 10;
    for (const p of world.projectiles) {
      if (p.ownerId === bot.id) continue;
      const dx = bot.x - p.x;
      const dy = bot.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < reactDist) {
        // Check if projectile is heading toward bot
        const dot = dx * p.vx + dy * p.vy;
        if (dot > 0) {
          const reflectChance = bot.archetype === 'bastion' ? 0.9 : world.difficulty === 'hard' ? 0.7 : 0.48;
          if (Math.random() < reflectChance) {
            decision.castSpell = 'repel';
            decision.castTarget = { x: p.x, y: p.y };
            return decision;
          }
        }
      }
    }
  }

  // 4. TARGET SELECTION (Archetype-specific!)
  const enemies = world.warlocks.filter((w) => w.alive && w.id !== bot.id);
  if (enemies.length === 0) {
    // Move calmly to center
    if (distFromCenter > 40) {
      decision.moveDir.x = -bot.x / distFromCenter;
      decision.moveDir.y = -bot.y / distFromCenter;
    }
    return decision;
  }

  const target = pickTargetByArchetype(bot, enemies, world.arenaRadius);
  const dx = target.x - bot.x;
  const dy = target.y - bot.y;
  const distToTarget = Math.hypot(dx, dy) || 1;
  const nx = dx / distToTarget;
  const ny = dy / distToTarget;

  // Flip strafe direction periodically
  if (bot.aiThinkTimer <= 0) {
    bot.aiThinkTimer = 0.75 + Math.random() * 0.9;
    if (Math.random() < 0.45) bot.aiStrafeDir *= -1;
  }

  // 5. ARCHETYPE-SPECIFIC MOVEMENT POLICIES (4 genuinely distinct movement behaviors!)
  let moveX = 0;
  let moveY = 0;

  if (bot.archetype === 'pyromancer') {
    // Aggressive mid-range duelist: keeps 190-260px distance and strafes perpendicular
    const desiredDist = 225;
    if (distToTarget > desiredDist + 45) {
      moveX += nx * 0.85;
      moveY += ny * 0.85;
    } else if (distToTarget < desiredDist - 50) {
      moveX -= nx * 0.7;
      moveY -= ny * 0.7;
    }
    moveX += -ny * bot.aiStrafeDir * 0.75;
    moveY += nx * bot.aiStrafeDir * 0.75;
  } else if (bot.archetype === 'bastion') {
    // Center-king controller: claims the heart of the obsidian arena and holds ground
    const centerPull = distFromCenter > world.arenaRadius * 0.28 ? 1.1 : 0.35;
    moveX += (-bot.x / Math.max(1, distFromCenter)) * centerPull;
    moveY += (-bot.y / Math.max(1, distFromCenter)) * centerPull;
    // Slight advance toward nearby intruders
    if (distToTarget < 190) {
      moveX += nx * 0.45;
      moveY += ny * 0.45;
    }
  } else if (bot.archetype === 'voidwalker') {
    // Edge-baiter & trickster: holds a tactical ring at ~55-72% arena radius trying to angle enemies toward lava
    const desiredRadius = Math.max(60, world.arenaRadius * 0.58);
    const radialErr = distFromCenter - desiredRadius;
    const radX = bot.x / Math.max(1, distFromCenter);
    const radY = bot.y / Math.max(1, distFromCenter);
    moveX += -radX * Math.max(-1, Math.min(1, radialErr / 80));
    moveY += -radY * Math.max(-1, Math.min(1, radialErr / 80));
    // Orbit around the ring
    moveX += -radY * bot.aiStrafeDir * 0.85;
    moveY += radX * bot.aiStrafeDir * 0.85;
  } else {
    // Skirmisher: high-mobility kiter, maintains 290-360px range and weaves away from crowds
    const desiredDist = 310;
    if (distToTarget < desiredDist) {
      moveX -= nx * 0.9;
      moveY -= ny * 0.9;
    } else {
      moveX += nx * 0.4;
      moveY += ny * 0.4;
    }
    moveX += -ny * bot.aiStrafeDir * 0.9;
    moveY += nx * bot.aiStrafeDir * 0.9;
  }

  // Soft pull inward when approaching the lava lip
  if (distFromCenter > safeMargin * 0.82) {
    const urgency = (distFromCenter - safeMargin * 0.82) / Math.max(25, safeMargin * 0.2);
    moveX += (-bot.x / Math.max(1, distFromCenter)) * urgency * 1.4;
    moveY += (-bot.y / Math.max(1, distFromCenter)) * urgency * 1.4;
  }

  // Pull away from enemy gravity wells
  for (const gw of world.gravityWells) {
    if (gw.ownerId === bot.id) continue;
    const gDist = distanceBetween(bot.x, bot.y, gw.x, gw.y);
    if (gDist < gw.radius + 35) {
      moveX += ((bot.x - gw.x) / Math.max(1, gDist)) * 1.3;
      moveY += ((bot.y - gw.y) / Math.max(1, gDist)) * 1.3;
    }
  }

  decision.moveDir.x = moveX;
  decision.moveDir.y = moveY;

  // 6. OFFENSIVE SPELL DECISION (Respecting crowd attack token fairness)
  if (world.attackTokensAvailable <= 0) {
    return decision;
  }

  // Predict target position for skillshots
  const aimLead = (projSpeed: number): Vec2 => {
    const travelTime = Math.min(0.65, distToTarget / projSpeed);
    const jitterAngle = (world.difficulty === 'hard' ? 0.05 : 0.11) * (Math.random() * 2 - 1);
    const leadX = target.x + (target.vx + target.knockVx * 0.35) * travelTime;
    const leadY = target.y + (target.vy + target.knockVy * 0.35) * travelTime;
    const ang = Math.atan2(leadY - bot.y, leadX - bot.x) + jitterAngle;
    return {
      x: bot.x + Math.cos(ang) * distToTarget,
      y: bot.y + Math.sin(ang) * distToTarget,
    };
  };

  // Close-range Repel slam
  if (bot.cooldowns.repel <= 0 && distToTarget < getSpellStats('repel', bot.spellLevels.repel, bot.artifacts).radius * 0.85) {
    decision.castSpell = 'repel';
    decision.castTarget = { x: target.x, y: target.y };
    return decision;
  }

  // Gravity Well (Voidwalker or Bastion combo starter)
  if (
    bot.spellLevels.gravity > 0 &&
    bot.cooldowns.gravity <= 0 &&
    distToTarget < getSpellStats('gravity', bot.spellLevels.gravity, bot.artifacts).range
  ) {
    // Prefer placing gravity slightly outside target toward lava!
    const tDistCenter = Math.hypot(target.x, target.y) || 1;
    const pushOutX = (target.x / tDistCenter) * 48;
    const pushOutY = (target.y / tDistCenter) * 48;
    decision.castSpell = 'gravity';
    decision.castTarget = { x: target.x + pushOutX, y: target.y + pushOutY };
    return decision;
  }

  // Meteor on clustered / slowed / edge target
  if (
    bot.spellLevels.meteor > 0 &&
    bot.cooldowns.meteor <= 0 &&
    distToTarget < getSpellStats('meteor', bot.spellLevels.meteor, bot.artifacts).range &&
    Math.random() < (bot.archetype === 'pyromancer' ? 0.16 : 0.08)
  ) {
    decision.castSpell = 'meteor';
    decision.castTarget = {
      x: target.x + target.vx * 0.45,
      y: target.y + target.vy * 0.45,
    };
    return decision;
  }

  // Soul Swap if target is low HP or bot wants chaos
  if (
    bot.spellLevels.swap > 0 &&
    bot.cooldowns.swap <= 0 &&
    distToTarget > 140 &&
    distToTarget < getSpellStats('swap', bot.spellLevels.swap, bot.artifacts).range &&
    Math.random() < 0.07
  ) {
    decision.castSpell = 'swap';
    decision.castTarget = aimLead(SPELLS.swap.projectileSpeed || 760);
    return decision;
  }

  // Primary Fireball
  if (
    bot.spellLevels.fireball > 0 &&
    bot.cooldowns.fireball <= 0 &&
    distToTarget < getSpellStats('fireball', bot.spellLevels.fireball, bot.artifacts).range
  ) {
    const fireProb = world.difficulty === 'hard' ? 0.2 : 0.12;
    if (Math.random() < fireProb) {
      decision.castSpell = 'fireball';
      decision.castTarget = aimLead(SPELLS.fireball.projectileSpeed || 640);
      return decision;
    }
  }

  return decision;
}

function findClosestEnemy(
  bot: WarlockEntity,
  warlocks: WarlockEntity[],
  predicate?: (w: WarlockEntity) => boolean
): WarlockEntity | null {
  let best: WarlockEntity | null = null;
  let bestD = Infinity;
  for (const w of warlocks) {
    if (!w.alive || w.id === bot.id) continue;
    if (predicate && !predicate(w)) continue;
    const d = distanceBetween(bot.x, bot.y, w.x, w.y);
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  return best;
}

function pickTargetByArchetype(
  bot: WarlockEntity,
  enemies: WarlockEntity[],
  arenaRadius: number
): WarlockEntity {
  let best = enemies[0];
  let bestScore = -Infinity;

  for (const e of enemies) {
    const dist = distanceBetween(bot.x, bot.y, e.x, e.y);
    const eFromCenter = Math.hypot(e.x, e.y);
    const edgeFactor = eFromCenter / Math.max(1, arenaRadius);
    const lowHpFactor = 1 - e.hp / Math.max(1, e.maxHp);

    let score = -dist * 0.002;
    if (bot.archetype === 'skirmisher') {
      // Snipes wounded or edge-exposed warlocks
      score += lowHpFactor * 2.2 + edgeFactor * 1.4;
    } else if (bot.archetype === 'voidwalker') {
      // Targets anyone near the edge to push/pull them into lava
      score += edgeFactor * 2.5;
    } else if (bot.archetype === 'bastion') {
      // Targets whoever is closest to the center / itself
      score += -dist * 0.004 - edgeFactor * 0.6;
    } else {
      // Pyromancer seeks duels with nearby threats
      score += -dist * 0.003 + lowHpFactor * 0.8;
    }

    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

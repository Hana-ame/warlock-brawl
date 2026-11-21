import {
  ARENA_MIN_RADIUS,
  ARENA_WORLD_BOUND,
  LAVA_BASE_DPS,
  LAVA_FRICTION,
  SHRINK_STEP_RADIUS,
  STONE_FRICTION,
} from './constants';
import { getDerivedStats } from './shopLogic';
import { PillarEntity, ProjectileEntity, Vec2, WarlockEntity } from './types';

export function distanceBetween(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export function isPointInLava(x: number, y: number, arenaRadius: number): boolean {
  return Math.hypot(x, y) > arenaRadius;
}

export function computeNextArenaRadius(currentRadius: number): number {
  return Math.max(ARENA_MIN_RADIUS, currentRadius - SHRINK_STEP_RADIUS);
}

export function applyKnockbackImpulse(
  target: WarlockEntity,
  dirX: number,
  dirY: number,
  impulseMagnitude: number
): { appliedX: number; appliedY: number } {
  const len = Math.hypot(dirX, dirY);
  const nx = len > 0.0001 ? dirX / len : 1;
  const ny = len > 0.0001 ? dirY / len : 0;

  const derived = getDerivedStats(target.artifacts);
  // Lower HP makes warlocks slightly easier to knock back (classic Warlock Brawl feel!)
  const hpRatio = Math.max(0, Math.min(1, target.hp / Math.max(1, target.maxHp)));
  const lowHpAmplifier = 1 + (1 - hpRatio) * 0.35;

  const finalMag = impulseMagnitude * derived.knockbackTakenScale * lowHpAmplifier;
  const appliedX = nx * finalMag;
  const appliedY = ny * finalMag;

  target.knockVx += appliedX;
  target.knockVy += appliedY;
  target.squashX = 1.24;
  target.squashY = 0.78;

  return { appliedX, appliedY };
}

export function applyDamageToWarlock(
  target: WarlockEntity,
  amount: number,
  attacker: WarlockEntity | null,
  currentTime: number
): { dealt: number; killed: boolean } {
  if (!target.alive || amount <= 0) {
    return { dealt: 0, killed: false };
  }
  const actualDamage = Math.min(target.hp, amount);
  target.hp = Math.max(0, target.hp - actualDamage);
  target.hitFlash = 0.09;

  if (attacker && attacker.id !== target.id) {
    target.lastDamagedBy = attacker.id;
    target.lastDamagedTime = currentTime;
    attacker.roundDamage += actualDamage;
    attacker.totalDamage += actualDamage;

    // Lifesteal from Blood Grimoire
    const atkStats = getDerivedStats(attacker.artifacts);
    if (atkStats.lifestealRatio > 0 && attacker.alive) {
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + actualDamage * atkStats.lifestealRatio);
    }
  }

  if (target.hp <= 0) {
    target.alive = false;
    target.koTimer = 0.45;
    return { dealt: actualDamage, killed: true };
  }

  return { dealt: actualDamage, killed: false };
}

export function computeLavaDamage(dt: number, warlock: WarlockEntity, shrinkStage: number): number {
  const derived = getDerivedStats(warlock.artifacts);
  // Lava gets slightly hotter in later shrink stages to prevent endless stalling
  const stageHeat = 1 + shrinkStage * 0.12;
  return LAVA_BASE_DPS * stageHeat * derived.lavaDamageScale * dt;
}

export function stepWarlockKinematics(
  w: WarlockEntity,
  inputDir: Vec2,
  arenaRadius: number,
  dt: number
): void {
  const derived = getDerivedStats(w.artifacts);
  const inLava = isPointInLava(w.x, w.y, arenaRadius);
  w.inLava = inLava;

  // Lava slows intentional walking slightly while knockback slides further
  const speedScale = inLava ? 0.84 : 1.0;
  const moveSpeed = derived.moveSpeed * speedScale;

  // Cast windup slows movement slightly for weighty War3 casting feel
  const castSlow = w.castingSpell ? 0.55 : 1.0;

  const inputLen = Math.hypot(inputDir.x, inputDir.y);
  if (inputLen > 0.01) {
    const nx = inputDir.x / inputLen;
    const ny = inputDir.y / inputLen;
    w.vx = nx * moveSpeed * castSlow;
    w.vy = ny * moveSpeed * castSlow;
    if (!w.castingSpell) {
      w.facing = Math.atan2(ny, nx);
    }
  } else {
    w.vx = 0;
    w.vy = 0;
  }

  // Apply friction decay to knockback velocity
  const friction = inLava ? LAVA_FRICTION : STONE_FRICTION;
  const decay = Math.exp(-friction * dt);
  w.knockVx *= decay;
  w.knockVy *= decay;
  if (Math.hypot(w.knockVx, w.knockVy) < 4) {
    w.knockVx = 0;
    w.knockVy = 0;
  }

  const dx = (w.vx + w.knockVx) * dt;
  const dy = (w.vy + w.knockVy) * dt;
  w.x += dx;
  w.y += dy;

  // Sync walk cycle to actual distance traveled
  const distMoved = Math.hypot(w.vx * dt, w.vy * dt);
  if (distMoved > 0.1) {
    w.walkPhase += distMoved * 0.085;
  }

  // Clamp inside outer volcanic rim
  const distFromCenter = Math.hypot(w.x, w.y);
  if (distFromCenter > ARENA_WORLD_BOUND) {
    const scale = ARENA_WORLD_BOUND / distFromCenter;
    w.x *= scale;
    w.y *= scale;
    // Reflect outward knockback off outer caldera wall
    const nx = w.x / ARENA_WORLD_BOUND;
    const ny = w.y / ARENA_WORLD_BOUND;
    const dot = w.knockVx * nx + w.knockVy * ny;
    if (dot > 0) {
      w.knockVx -= 1.5 * dot * nx;
      w.knockVy -= 1.5 * dot * ny;
    }
  }

  // Recover squash & stretch smoothly
  const squashDecay = Math.exp(-12 * dt);
  w.squashX = 1 + (w.squashX - 1) * squashDecay;
  w.squashY = 1 + (w.squashY - 1) * squashDecay;

  // Trailing ghost HP bar smoothly chases current HP
  if (w.ghostHp > w.hp) {
    w.ghostHp = Math.max(w.hp, w.ghostHp - Math.max(28, (w.ghostHp - w.hp) * 3.8) * dt);
  } else {
    w.ghostHp = w.hp;
  }
}

export function resolveWarlockPillarCollision(w: WarlockEntity, pillar: PillarEntity): boolean {
  const dx = w.x - pillar.x;
  const dy = w.y - pillar.y;
  const dist = Math.hypot(dx, dy);
  const minDist = w.radius + pillar.radius;
  if (dist < minDist && dist > 0.0001) {
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    w.x += nx * overlap;
    w.y += ny * overlap;

    // Bounce knockback off obsidian pillar
    const dot = w.knockVx * nx + w.knockVy * ny;
    if (dot < 0) {
      w.knockVx -= 1.65 * dot * nx;
      w.knockVy -= 1.65 * dot * ny;
    }
    return true;
  }
  return false;
}

export function resolveWarlockPairCollision(a: WarlockEntity, b: WarlockEntity): boolean {
  if (!a.alive || !b.alive) return false;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const minDist = a.radius + b.radius;
  if (dist < minDist && dist > 0.0001) {
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = (minDist - dist) * 0.5;
    a.x -= nx * overlap;
    a.y -= ny * overlap;
    b.x += nx * overlap;
    b.y += ny * overlap;

    // Elastic momentum transfer + thorns carapace bounce
    const statsA = getDerivedStats(a.artifacts);
    const statsB = getDerivedStats(b.artifacts);
    const relVx = b.knockVx - a.knockVx;
    const relVy = b.knockVy - a.knockVy;
    const sepVel = relVx * nx + relVy * ny;
    if (sepVel < 0) {
      const impulse = -sepVel * 0.72;
      a.knockVx -= nx * impulse;
      a.knockVy -= ny * impulse;
      b.knockVx += nx * impulse;
      b.knockVy += ny * impulse;
    }
    if (statsA.collisionBounceBonus > 0) {
      b.knockVx += nx * statsA.collisionBounceBonus;
      b.knockVy += ny * statsA.collisionBounceBonus;
    }
    if (statsB.collisionBounceBonus > 0) {
      a.knockVx -= nx * statsB.collisionBounceBonus;
      a.knockVy -= ny * statsB.collisionBounceBonus;
    }
    return true;
  }
  return false;
}

export function reflectProjectile(proj: ProjectileEntity, reflector: WarlockEntity): boolean {
  if (proj.ownerId === reflector.id) return false;
  const dx = proj.x - reflector.x;
  const dy = proj.y - reflector.y;
  const speed = Math.hypot(proj.vx, proj.vy);
  // Send projectile directly away from reflector or reversed along incoming vector
  const dist = Math.hypot(dx, dy);
  const nx = dist > 0.01 ? dx / dist : -proj.vx / Math.max(1, speed);
  const ny = dist > 0.01 ? dy / dist : -proj.vy / Math.max(1, speed);

  const boostedSpeed = speed * 1.18;
  proj.vx = nx * boostedSpeed;
  proj.vy = ny * boostedSpeed;
  proj.ownerId = reflector.id;
  proj.color = reflector.color;
  proj.traveled = 0;
  proj.reflected = true;
  proj.damage = Math.round(proj.damage * 1.2);
  proj.knockback = Math.round(proj.knockback * 1.15);
  return true;
}

export function checkRoundWinner(warlocks: WarlockEntity[]): {
  ended: boolean;
  winner: WarlockEntity | null;
} {
  const alive = warlocks.filter((w) => w.alive);
  if (alive.length <= 1) {
    return {
      ended: true,
      winner: alive[0] ?? null,
    };
  }
  return { ended: false, winner: null };
}

export function checkTournamentComplete(currentRound: number, totalRounds: number): boolean {
  return currentRound >= totalRounds;
}

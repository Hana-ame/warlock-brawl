import test from 'node:test';
import assert from 'node:assert/strict';
import { ARENA_INITIAL_RADIUS, ARENA_MIN_RADIUS, BASE_MAX_HP, SHRINK_STEP_RADIUS, SPELLS } from './constants';
import {
  applyDamageToWarlock,
  applyKnockbackImpulse,
  checkRoundWinner,
  checkTournamentComplete,
  computeLavaDamage,
  computeNextArenaRadius,
  isPointInLava,
  reflectProjectile,
  resolveWarlockPillarCollision,
  stepWarlockKinematics,
} from './physics';
import {
  buyArtifact,
  buyOrUpgradeSpell,
  calculateRoundGoldReward,
  getDerivedStats,
  getSpellStats,
} from './shopLogic';
import { PillarEntity, ProjectileEntity, WarlockEntity } from './types';

function createTestWarlock(id: string, overrides: Partial<WarlockEntity> = {}): WarlockEntity {
  return {
    id,
    name: id,
    title: 'Test',
    isPlayer: id === 'player',
    archetype: 'pyromancer',
    color: '#e5a93c',
    trimColor: '#fff',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    knockVx: 0,
    knockVy: 0,
    facing: 0,
    radius: 20,
    hp: BASE_MAX_HP,
    maxHp: BASE_MAX_HP,
    ghostHp: BASE_MAX_HP,
    alive: true,
    koTimer: 0,
    inLava: false,
    lavaTickAccum: 0,
    hitFlash: 0,
    squashX: 1,
    squashY: 1,
    walkPhase: 0,
    moveTarget: null,
    castingSpell: null,
    castWindup: 0,
    castWindupTotal: 0,
    castTarget: null,
    spellLevels: { fireball: 1, repel: 1, teleport: 1, meteor: 1, gravity: 0, swap: 0 },
    cooldowns: { fireball: 0, repel: 0, teleport: 0, meteor: 0, gravity: 0, swap: 0 },
    artifacts: { boots: 0, lava_charm: 0, arcane_cloak: 0, titan_sigil: 0, vampiric_tome: 0, thorns_mail: 0 },
    gold: 40,
    roundWins: 0,
    totalKills: 0,
    roundKills: 0,
    totalDamage: 0,
    roundDamage: 0,
    lastDamagedBy: null,
    lastDamagedTime: -100,
    repelFlash: 0,
    blinkFlash: 0,
    aiThinkTimer: 0,
    aiStrafeDir: 1,
    aiTargetId: null,
    aiAnchorAngle: 0,
    ...overrides,
  };
}

test('lava boundary and shrinking arena radius clamp properly', () => {
  assert.equal(isPointInLava(0, 0, 500), false);
  assert.equal(isPointInLava(499, 0, 500), false);
  assert.equal(isPointInLava(501, 0, 500), true);

  assert.equal(computeNextArenaRadius(ARENA_INITIAL_RADIUS), ARENA_INITIAL_RADIUS - SHRINK_STEP_RADIUS);
  assert.equal(computeNextArenaRadius(ARENA_MIN_RADIUS + 10), ARENA_MIN_RADIUS);
});

test('knockback impulse scales with low HP and Titan Crest resistance', () => {
  const fullHp = createTestWarlock('a', { hp: BASE_MAX_HP, maxHp: BASE_MAX_HP });
  const lowHp = createTestWarlock('b', { hp: 30, maxHp: BASE_MAX_HP });
  const armored = createTestWarlock('c', {
    hp: BASE_MAX_HP,
    maxHp: BASE_MAX_HP,
    artifacts: { boots: 0, lava_charm: 0, arcane_cloak: 0, titan_sigil: 2, vampiric_tome: 0, thorns_mail: 0 },
  });

  const kFull = applyKnockbackImpulse(fullHp, 1, 0, 400);
  const kLow = applyKnockbackImpulse(lowHp, 1, 0, 400);
  const kArmored = applyKnockbackImpulse(armored, 1, 0, 400);

  assert.ok(kLow.appliedX > kFull.appliedX, 'Low HP warlock should suffer stronger knockback');
  assert.ok(kArmored.appliedX < kFull.appliedX, 'Titan Crest should reduce knockback impulse');
});

test('lava damage decreases with Magma Talisman and increases with shrink stage', () => {
  const baseW = createTestWarlock('base');
  const charmedW = createTestWarlock('charmed', {
    artifacts: { boots: 0, lava_charm: 2, arcane_cloak: 0, titan_sigil: 0, vampiric_tome: 0, thorns_mail: 0 },
  });

  const dmgStage0 = computeLavaDamage(1, baseW, 0);
  const dmgStage3 = computeLavaDamage(1, baseW, 3);
  const dmgCharmed = computeLavaDamage(1, charmedW, 0);

  assert.ok(dmgStage3 > dmgStage0);
  assert.ok(dmgCharmed < dmgStage0);
});

test('repel projectile reflection flips ownership, boosts damage, and sends projectile outward', () => {
  const reflector = createTestWarlock('player', { x: 0, y: 0 });
  const proj: ProjectileEntity = {
    id: 'p1',
    spellId: 'fireball',
    ownerId: 'bot_0',
    color: '#dc2626',
    x: 40,
    y: 0,
    vx: -600,
    vy: 0,
    radius: 11,
    damage: 24,
    knockback: 450,
    blastRadius: 52,
    traveled: 120,
    maxRange: 560,
    reflected: false,
    age: 0.2,
  };

  const ok = reflectProjectile(proj, reflector);
  assert.equal(ok, true);
  assert.equal(proj.ownerId, 'player');
  assert.equal(proj.reflected, true);
  assert.ok(proj.vx > 0, 'Reflected projectile should reverse direction away from reflector');
  assert.ok(proj.damage > 24);
  assert.equal(proj.traveled, 0);
});

test('shop unlock, upgrade, and artifact purchases enforce gold balance and update derived stats', () => {
  const w = createTestWarlock('player', { gold: 30 });

  // Unlock Gravity Well (costs 14)
  const unlock = buyOrUpgradeSpell(w, 'gravity');
  assert.equal(unlock.ok, true);
  assert.equal(unlock.newLevel, 1);
  assert.equal(w.gold, 16);

  // Upgrade Fireball Lv1 -> Lv2 (costs 10)
  const upg = buyOrUpgradeSpell(w, 'fireball');
  assert.equal(upg.ok, true);
  assert.equal(upg.newLevel, 2);
  assert.equal(w.gold, 6);

  // Cannot afford Boots of Speed (costs 12) with 6 gold
  const failBuy = buyArtifact(w, 'boots');
  assert.equal(failBuy.ok, false);
  assert.equal(w.gold, 6);

  // Add gold and purchase Magma Talisman (+25 Max HP)
  w.gold = 20;
  const charmBuy = buyArtifact(w, 'lava_charm');
  assert.equal(charmBuy.ok, true);
  assert.equal(w.maxHp, BASE_MAX_HP + 25);
  assert.equal(getDerivedStats(w.artifacts).maxHp, BASE_MAX_HP + 25);

  // Spell stats scale with level
  const lv1 = getSpellStats('fireball', 1, w.artifacts);
  const lv2 = getSpellStats('fireball', 2, w.artifacts);
  assert.ok(lv2.damage > lv1.damage);
  assert.ok(lv2.cooldown < lv1.cooldown);
  assert.equal(SPELLS.fireball.maxLevel, 5);
});

test('damage, lifesteal, KO, pillar collision, round winner, and tournament completion', () => {
  const attacker = createTestWarlock('player', {
    hp: 100,
    maxHp: 150,
    artifacts: { boots: 0, lava_charm: 0, arcane_cloak: 0, titan_sigil: 0, vampiric_tome: 1, thorns_mail: 0 },
  });
  const victim = createTestWarlock('bot_0', { hp: 30, maxHp: 150 });

  const res = applyDamageToWarlock(victim, 50, attacker, 10);
  assert.equal(res.killed, true);
  assert.equal(victim.alive, false);
  assert.ok(attacker.hp > 100, 'Blood Grimoire should heal attacker on damage');

  const roundCheck = checkRoundWinner([attacker, victim]);
  assert.equal(roundCheck.ended, true);
  assert.equal(roundCheck.winner?.id, 'player');

  assert.equal(checkTournamentComplete(3, 5), false);
  assert.equal(checkTournamentComplete(5, 5), true);

  // Gold payout rewards kills and survival
  const winGold = calculateRoundGoldReward({ survived: true, roundKills: 2, roundDamage: 140, placementRank: 1, totalCombatants: 6 });
  const loseGold = calculateRoundGoldReward({ survived: false, roundKills: 0, roundDamage: 0, placementRank: 6, totalCombatants: 6 });
  assert.ok(winGold > loseGold);

  // Pillar collision separates overlapping warlock
  const mover = createTestWarlock('m', { x: 20, y: 0 });
  const pillar: PillarEntity = { id: 'pil', x: 0, y: 0, radius: 26, hp: 100, maxHp: 100, hitFlash: 0 };
  const collided = resolveWarlockPillarCollision(mover, pillar);
  assert.equal(collided, true);
  assert.ok(Math.hypot(mover.x - pillar.x, mover.y - pillar.y) >= mover.radius + pillar.radius - 0.01);

  // Kinematics advances position and walkPhase
  stepWarlockKinematics(mover, { x: 1, y: 0 }, 500, 0.05);
  assert.ok(mover.walkPhase > 0);
});

import { ARENA_INITIAL_RADIUS, SHRINK_WARNING_DURATION, SPELLS } from './constants';
import { EffectsPool } from './particles';
import {
  CrumbledTile,
  GravityWellEntity,
  MeteorEntity,
  PillarEntity,
  ProjectileEntity,
  SpellId,
  Vec2,
  WarlockEntity,
} from './types';

export interface RenderState {
  time: number;
  arenaRadius: number;
  nextArenaRadius: number;
  nextShrinkIn: number;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  shakeX: number;
  shakeY: number;
  warlocks: WarlockEntity[];
  projectiles: ProjectileEntity[];
  meteors: MeteorEntity[];
  gravityWells: GravityWellEntity[];
  pillars: PillarEntity[];
  crumbledTiles: CrumbledTile[];
  effects: EffectsPool;
  mouseWorld: Vec2;
  aimPreviewSpell: SpellId | null;
  player: WarlockEntity | null;
  isTitleDemo: boolean;
  introCountdown: number;
}

// Offscreen caches for heavy static stone & magma textures (huge perf win!)
let cachedStoneCanvas: HTMLCanvasElement | null = null;
let cachedStoneRadius = 0;

let cachedBackdropCanvas: HTMLCanvasElement | null = null;
let cachedBackdropW = 0;
let cachedBackdropH = 0;

const nameplateCache = new Map<string, HTMLCanvasElement>();

function getNameplateCanvas(name: string, isPlayer: boolean): HTMLCanvasElement {
  const key = `${isPlayer ? 'P' : 'B'}:${name}`;
  const existing = nameplateCache.get(key);
  if (existing) return existing;

  const off = document.createElement('canvas');
  off.width = 140;
  off.height = 24;
  const octx = off.getContext('2d');
  if (octx) {
    octx.font = isPlayer
      ? '700 11px "Noto Sans SC", system-ui, sans-serif'
      : '600 10.5px "Noto Sans SC", system-ui, sans-serif';
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    octx.lineWidth = 3;
    octx.strokeStyle = 'rgba(0, 0, 0, 0.92)';
    octx.strokeText(name, 70, 12);
    octx.fillStyle = isPlayer ? '#fde68a' : '#e7ded2';
    octx.fillText(name, 70, 12);
  }
  nameplateCache.set(key, off);
  return off;
}

function getStoneDiskCanvas(radius: number): HTMLCanvasElement {
  const rInt = Math.round(radius);
  if (cachedStoneCanvas && cachedStoneRadius === rInt) {
    return cachedStoneCanvas;
  }
  const pad = 22;
  const size = (rInt + pad) * 2;
  const off = document.createElement('canvas');
  off.width = size;
  off.height = size;
  const octx = off.getContext('2d');
  if (!octx) return off;

  const cx = size * 0.5;
  const cy = size * 0.5;

  // 2.5D volcanic cliff shadow beneath platform
  octx.beginPath();
  octx.arc(cx, cy + 12, rInt + 5, 0, Math.PI * 2);
  octx.fillStyle = 'rgba(12, 4, 2, 0.88)';
  octx.fill();

  // Outer molten rim glow
  octx.beginPath();
  octx.arc(cx, cy, rInt + 4, 0, Math.PI * 2);
  octx.strokeStyle = 'rgba(255, 110, 26, 0.52)';
  octx.lineWidth = 7;
  octx.stroke();

  // Main carved obsidian stone platform
  const stoneGrad = octx.createRadialGradient(cx, cy - rInt * 0.14, rInt * 0.08, cx, cy, rInt);
  stoneGrad.addColorStop(0, '#382f2a');
  stoneGrad.addColorStop(0.6, '#28211e');
  stoneGrad.addColorStop(0.92, '#1d1715');
  stoneGrad.addColorStop(1, '#140f0e');

  octx.beginPath();
  octx.arc(cx, cy, rInt, 0, Math.PI * 2);
  octx.fillStyle = stoneGrad;
  octx.fill();

  // Clip interior architectural masonry & carved War3 runes
  octx.save();
  octx.beginPath();
  octx.arc(cx, cy, rInt, 0, Math.PI * 2);
  octx.clip();

  // Concentric stone rings & mortar joints
  octx.strokeStyle = 'rgba(10, 7, 6, 0.55)';
  octx.lineWidth = 2;
  const ringStep = 68;
  for (let rr = ringStep; rr <= ARENA_INITIAL_RADIUS; rr += ringStep) {
    octx.beginPath();
    octx.arc(cx, cy, rr, 0, Math.PI * 2);
    octx.stroke();
    const spokes = Math.max(8, Math.round(rr / 28));
    for (let s = 0; s < spokes; s++) {
      const ang = (s / spokes) * Math.PI * 2 + (rr % 136 === 0 ? 0.15 : 0);
      octx.beginPath();
      octx.moveTo(cx + Math.cos(ang) * (rr - ringStep), cy + Math.sin(ang) * (rr - ringStep));
      octx.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
      octx.stroke();
    }
  }

  // Carved glowing bronze-amber arcane sigil in center
  octx.strokeStyle = 'rgba(218, 152, 68, 0.28)';
  octx.lineWidth = 2.2;
  octx.beginPath();
  octx.arc(cx, cy, 128, 0, Math.PI * 2);
  octx.stroke();
  octx.beginPath();
  octx.arc(cx, cy, 86, 0, Math.PI * 2);
  octx.stroke();

  octx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a1 = (i / 8) * Math.PI * 2;
    const a2 = ((i + 3) / 8) * Math.PI * 2;
    octx.moveTo(cx + Math.cos(a1) * 124, cy + Math.sin(a1) * 124);
    octx.lineTo(cx + Math.cos(a2) * 124, cy + Math.sin(a2) * 124);
  }
  octx.strokeStyle = 'rgba(218, 152, 68, 0.2)';
  octx.lineWidth = 1.5;
  octx.stroke();

  octx.restore();

  // Beveled obsidian edge rim
  octx.beginPath();
  octx.arc(cx, cy, rInt, 0, Math.PI * 2);
  octx.strokeStyle = '#6e523a';
  octx.lineWidth = 3.5;
  octx.stroke();

  cachedStoneCanvas = off;
  cachedStoneRadius = rInt;
  return off;
}

function getLavaBackdropCanvas(width: number, height: number): HTMLCanvasElement {
  const wInt = Math.max(1, Math.round(width));
  const hInt = Math.max(1, Math.round(height));
  if (cachedBackdropCanvas && cachedBackdropW === wInt && cachedBackdropH === hInt) {
    return cachedBackdropCanvas;
  }
  const off = document.createElement('canvas');
  off.width = wInt;
  off.height = hInt;
  const octx = off.getContext('2d');
  if (octx) {
    const grad = octx.createRadialGradient(
      wInt * 0.5,
      hInt * 0.5,
      60,
      wInt * 0.5,
      hInt * 0.5,
      Math.max(wInt, hInt) * 0.78
    );
    grad.addColorStop(0, '#5f1809');
    grad.addColorStop(0.55, '#3b0c05');
    grad.addColorStop(1, '#180503');
    octx.fillStyle = grad;
    octx.fillRect(0, 0, wInt, hInt);
  }
  cachedBackdropCanvas = off;
  cachedBackdropW = wInt;
  cachedBackdropH = hInt;
  return off;
}

export function renderArenaScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: RenderState
): void {
  // 1. Cached Volcanic Lava Backdrop + lightweight animated convection veins
  const bg = getLavaBackdropCanvas(width, height);
  ctx.drawImage(bg, 0, 0, width, height);

  ctx.save();
  // Apply Camera Transform
  ctx.translate(width * 0.5 + state.shakeX, height * 0.5 + state.shakeY);
  ctx.scale(state.cameraZoom, state.cameraZoom);
  ctx.translate(-state.cameraX, -state.cameraY);

  drawLavaCurrents(ctx, state);

  // 2. Crumbled outer basalt tiles sinking into magma
  drawCrumbledTiles(ctx, state.crumbledTiles);

  // 3. Cached Obsidian Runic Arena Platform + Live Warning Shrink Ring
  drawObsidianArena(ctx, state);

  // 4. Gravity Wells (Ground layer)
  drawGravityWells(ctx, state.gravityWells, state.time);

  // 5. Meteor Landing Telegraphs (Ground layer)
  drawMeteorTelegraphs(ctx, state.meteors, state.time);

  // 6. Player RTS Move Marker & Spell Aim Reticle
  if (!state.isTitleDemo && state.player && state.player.alive) {
    drawPlayerGuides(ctx, state.player, state.mouseWorld, state.aimPreviewSpell, state.time);
  }

  // 7. Shockwave Rings
  drawShockwaveRings(ctx, state.effects);

  // 8. Obsidian Pillars (2.5D with ground shadow)
  drawPillars(ctx, state.pillars);

  // 9. Soul Swap Chain Beams
  drawChainBeams(ctx, state.effects);

  // 10. Warlock Actors (sorted by Y for clean 2.5D overlap)
  const sortedWarlocks = [...state.warlocks].sort((a, b) => a.y - b.y);
  for (let i = 0; i < sortedWarlocks.length; i++) {
    const w = sortedWarlocks[i];
    if (!w.alive && w.koTimer <= 0) continue;
    drawWarlock(ctx, w, state.time, !state.isTitleDemo);
  }

  // 11. Projectiles & Descending Meteors
  drawProjectiles(ctx, state.projectiles, state.time);
  drawDescendingMeteors(ctx, state.meteors);

  // 12. Pooled Particles (zero ctx.save/restore overhead)
  drawParticles(ctx, state.effects);

  // 13. Floating Damage / Status Numbers
  if (!state.isTitleDemo) {
    drawFloatingTexts(ctx, state.effects);
  }

  ctx.restore();

  // 14. Peripheral Low-HP / Lava Danger Vignette (screen-space, subtle)
  if (!state.isTitleDemo && state.player && state.player.alive) {
    const hpRatio = state.player.hp / Math.max(1, state.player.maxHp);
    if (state.player.inLava || hpRatio < 0.32) {
      const intensity = state.player.inLava
        ? 0.24 + Math.sin(state.time * 9) * 0.05
        : (0.32 - hpRatio) * 0.65;
      ctx.strokeStyle = `rgba(185, 28, 12, ${Math.min(0.48, intensity)})`;
      ctx.lineWidth = 44;
      ctx.strokeRect(0, 0, width, height);
    }
  }
}

function drawLavaCurrents(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const t = state.time;
  ctx.lineCap = 'round';
  const rInner = Math.max(160, state.arenaRadius - 10);
  const rOuter = 880;

  // 10 smooth molten veins
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 + Math.sin(t * 0.16 + i) * 0.07;
    const pulse = 0.18 + 0.12 * Math.sin(t * 1.3 + i * 1.7);
    ctx.strokeStyle = i % 2 === 0
      ? `rgba(255, 118, 24, ${pulse})`
      : `rgba(234, 62, 16, ${pulse * 0.85})`;
    ctx.lineWidth = 11 + (i % 3) * 5;
    ctx.beginPath();
    const midAngle = angle + Math.sin(t * 0.5 + i * 2.1) * 0.14;
    const midR = (rInner + rOuter) * 0.52;
    ctx.moveTo(Math.cos(angle) * rInner, Math.sin(angle) * rInner);
    ctx.quadraticCurveTo(
      Math.cos(midAngle) * midR,
      Math.sin(midAngle) * midR,
      Math.cos(angle + 0.05) * rOuter,
      Math.sin(angle + 0.05) * rOuter
    );
    ctx.stroke();
  }

  // 2 concentric magma ripples expanding from island cliff
  for (let ring = 0; ring < 2; ring++) {
    const phase = (t * 0.34 + ring * 0.5) % 1;
    const rr = state.arenaRadius + 14 + phase * 110;
    ctx.strokeStyle = `rgba(255, 138, 42, ${(1 - phase) * 0.24})`;
    ctx.lineWidth = 3 * (1 - phase) + 1;
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Cooled dark basalt plates floating in outer caldera
  ctx.fillStyle = 'rgba(26, 12, 10, 0.52)';
  for (let i = 0; i < 8; i++) {
    const a = i * 0.785 + t * 0.014 * (i % 2 === 0 ? 1 : -1);
    const dist = 630 + (i % 3) * 70;
    ctx.beginPath();
    ctx.ellipse(
      Math.cos(a) * dist,
      Math.sin(a) * dist,
      46 + (i % 3) * 12,
      24 + (i % 2) * 8,
      a,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

function drawCrumbledTiles(ctx: CanvasRenderingContext2D, tiles: CrumbledTile[]): void {
  if (tiles.length === 0) return;
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    ctx.save();
    ctx.translate(tile.x, tile.y);
    ctx.rotate(tile.angle);
    ctx.globalAlpha = tile.alpha;
    ctx.fillStyle = '#2d2320';
    ctx.strokeStyle = '#ff6b1a';
    ctx.lineWidth = 2;
    const s = tile.size * (0.65 + 0.35 * tile.alpha);
    ctx.fillRect(-s * 0.5, -s * 0.5, s, s);
    ctx.strokeRect(-s * 0.5, -s * 0.5, s, s);
    ctx.restore();
  }
}

function drawObsidianArena(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const r = state.arenaRadius;
  const stoneCanvas = getStoneDiskCanvas(r);
  ctx.drawImage(stoneCanvas, -stoneCanvas.width * 0.5, -stoneCanvas.height * 0.5);

  // Subtle animated center rune shimmer
  const runeGlow = 0.08 + 0.06 * Math.sin(state.time * 2.1);
  ctx.strokeStyle = `rgba(245, 184, 86, ${runeGlow})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 86, 0, Math.PI * 2);
  ctx.stroke();

  // SHRINK WARNING ZONE: outer ring glows incandescent red-orange before crumbling!
  const isWarning = state.nextShrinkIn <= SHRINK_WARNING_DURATION && r > state.nextArenaRadius;
  if (isWarning) {
    const warnPulse = 0.28 + 0.22 * Math.sin(state.time * 14);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.arc(0, 0, state.nextArenaRadius, 0, Math.PI * 2, true);
    ctx.fillStyle = `rgba(239, 68, 22, ${warnPulse})`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, state.nextArenaRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 200, 110, ${0.58 + warnPulse * 0.6})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#ff7b29';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
}

function drawGravityWells(ctx: CanvasRenderingContext2D, wells: GravityWellEntity[], time: number): void {
  for (let i = 0; i < wells.length; i++) {
    const gw = wells[i];
    const remainRatio = Math.max(0, 1 - gw.elapsed / gw.duration);
    const alpha = Math.min(1, gw.elapsed * 5) * Math.min(1, remainRatio * 3.5);
    ctx.save();
    ctx.translate(gw.x, gw.y);
    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(79, 70, 229, 0.24)';
    ctx.beginPath();
    ctx.arc(0, 0, gw.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(20, 8, 48, 0.68)';
    ctx.beginPath();
    ctx.arc(0, 0, gw.radius * 0.48, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(165, 180, 252, 0.72)';
    ctx.lineWidth = 2.2;
    for (let j = 0; j < 4; j++) {
      const a = time * 4.5 + (j * Math.PI) / 2;
      ctx.beginPath();
      ctx.arc(0, 0, gw.radius * 0.68, a, a + 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, gw.radius * 0.34, -a * 1.4, -a * 1.4 + 1.1);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(0, 0, 13 + Math.sin(time * 12) * 2, 0, Math.PI * 2);
    ctx.fillStyle = '#090418';
    ctx.fill();
    ctx.strokeStyle = '#c7d2fe';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }
}

function drawMeteorTelegraphs(ctx: CanvasRenderingContext2D, meteors: MeteorEntity[], time: number): void {
  for (let i = 0; i < meteors.length; i++) {
    const m = meteors[i];
    const progress = Math.min(1, m.elapsed / m.delay);
    ctx.save();
    ctx.translate(m.x, m.y);

    ctx.beginPath();
    ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(239, 68, 68, ${0.12 + progress * 0.24})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(251, 146, 60, ${0.65 + Math.sin(time * 24) * 0.25})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, m.radius * progress, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(254, 215, 170, 0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(254, 202, 202, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(14, 0);
    ctx.moveTo(0, -14);
    ctx.lineTo(0, 14);
    ctx.stroke();

    ctx.restore();
  }
}

function drawDescendingMeteors(ctx: CanvasRenderingContext2D, meteors: MeteorEntity[]): void {
  for (let i = 0; i < meteors.length; i++) {
    const m = meteors[i];
    const progress = Math.min(1, m.elapsed / m.delay);
    const heightOffset = (1 - progress) * 420;
    const xOffset = (1 - progress) * 140;
    const mx = m.x + xOffset;
    const my = m.y - heightOffset;

    ctx.strokeStyle = 'rgba(251, 146, 60, 0.78)';
    ctx.lineWidth = 24 * (0.5 + 0.5 * progress);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + 56, my - 118);
    ctx.stroke();

    const rockR = 16 + progress * 12;
    ctx.beginPath();
    ctx.arc(mx, my, rockR, 0, Math.PI * 2);
    ctx.fillStyle = '#3b1510';
    ctx.fill();
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(mx - 3, my + 2, rockR * 0.52, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a';
    ctx.fill();
  }
}

function drawPillars(ctx: CanvasRenderingContext2D, pillars: PillarEntity[]): void {
  for (let i = 0; i < pillars.length; i++) {
    const p = pillars[i];
    const hpRatio = p.hp / p.maxHp;
    ctx.save();
    ctx.translate(p.x, p.y);

    ctx.beginPath();
    ctx.ellipse(6, 10, p.radius * 1.05, p.radius * 0.85, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.hitFlash > 0 ? '#fca5a5' : '#231b18';
    ctx.fill();
    ctx.strokeStyle = '#4e3c31';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -10, p.radius * 0.86, 0, Math.PI * 2);
    ctx.fillStyle = p.hitFlash > 0 ? '#fef08a' : '#3a2d27';
    ctx.fill();
    ctx.strokeStyle = hpRatio < 0.5 ? '#f97316' : '#856549';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -10, p.radius * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = hpRatio < 0.5 ? 'rgba(249, 115, 22, 0.85)' : 'rgba(217, 154, 78, 0.55)';
    ctx.fill();

    if (hpRatio < 0.75) {
      ctx.strokeStyle = '#ff7b29';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-p.radius * 0.5, -14);
      ctx.lineTo(0, -8);
      ctx.lineTo(p.radius * 0.45, -4);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawPlayerGuides(
  ctx: CanvasRenderingContext2D,
  player: WarlockEntity,
  mouseWorld: Vec2,
  aimPreviewSpell: SpellId | null,
  time: number
): void {
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius + 7, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(245, 194, 86, 0.68)';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (player.moveTarget) {
    const pulse = 0.65 + 0.35 * Math.sin(time * 10);
    ctx.strokeStyle = `rgba(110, 231, 183, ${pulse * 0.85})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.moveTarget.x, player.moveTarget.y, 8 + (1 - pulse) * 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  const dx = mouseWorld.x - player.x;
  const dy = mouseWorld.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 14) {
    const nx = dx / dist;
    const ny = dy / dist;
    ctx.strokeStyle = 'rgba(255, 226, 170, 0.16)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(player.x + nx * 28, player.y + ny * 28);
    ctx.lineTo(player.x + nx * Math.min(dist, 240), player.y + ny * Math.min(dist, 240));
    ctx.stroke();
    ctx.setLineDash([]);

    const reticleColor = aimPreviewSpell ? SPELLS[aimPreviewSpell].accentColor : '#f5c256';
    ctx.save();
    ctx.translate(mouseWorld.x, mouseWorld.y);
    ctx.strokeStyle = reticleColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(-5, 0);
    ctx.moveTo(5, 0);
    ctx.lineTo(14, 0);
    ctx.moveTo(0, -14);
    ctx.lineTo(0, -5);
    ctx.moveTo(0, 5);
    ctx.lineTo(0, 14);
    ctx.stroke();
    ctx.restore();
  }
}

function drawWarlock(
  ctx: CanvasRenderingContext2D,
  w: WarlockEntity,
  time: number,
  showNameplate: boolean
): void {
  ctx.save();
  ctx.translate(w.x, w.y);

  if (!w.alive) {
    const alpha = Math.max(0, w.koTimer / 0.45);
    ctx.globalAlpha = alpha;
    const scale = 0.65 + 0.35 * alpha;
    ctx.scale(scale, scale);
    ctx.rotate((1 - alpha) * 1.4);
  }

  const walkBob = Math.sin(w.walkPhase) * 2.2;

  // Ground shadow
  ctx.beginPath();
  ctx.ellipse(0, 8, w.radius * 0.96, w.radius * 0.62, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fill();

  if (w.repelFlash > 0) {
    ctx.beginPath();
    ctx.arc(0, 0, w.radius + 14 + (1 - w.repelFlash / 0.28) * 18, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(56, 189, 248, ${w.repelFlash * 3.5})`;
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  ctx.save();
  ctx.scale(w.squashX, w.squashY);
  ctx.translate(0, walkBob);
  ctx.rotate(w.facing);

  // Billowing Warlock Cloak
  ctx.beginPath();
  ctx.ellipse(-2, 0, w.radius * 0.94, w.radius * 1.05, 0, 0, Math.PI * 2);
  ctx.fillStyle = w.hitFlash > 0 ? '#ffffff' : w.color;
  ctx.fill();
  ctx.strokeStyle = '#120d0b';
  ctx.lineWidth = 2.6;
  ctx.stroke();

  // Mantle Trim
  ctx.beginPath();
  ctx.arc(-1, 0, w.radius * 0.72, -Math.PI * 0.72, Math.PI * 0.72);
  ctx.strokeStyle = w.hitFlash > 0 ? '#fef08a' : w.trimColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Warlock Staff & Orb
  const staffThrust = w.castingSpell ? 7 : 0;
  ctx.strokeStyle = '#5c402c';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(2, 13);
  ctx.lineTo(20 + staffThrust, 15);
  ctx.stroke();

  const orbColor = w.castingSpell ? SPELLS[w.castingSpell].accentColor : w.trimColor;
  ctx.beginPath();
  ctx.arc(21 + staffThrust, 15, 5.2 + (w.castingSpell ? 1.8 : 0), 0, Math.PI * 2);
  ctx.fillStyle = orbColor;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Pointed Hood & Shadowed Face
  ctx.beginPath();
  ctx.arc(2, 0, w.radius * 0.56, 0, Math.PI * 2);
  ctx.fillStyle = w.hitFlash > 0 ? '#ffffff' : '#1b1412';
  ctx.fill();
  ctx.strokeStyle = w.trimColor;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Glowing Eyes
  ctx.fillStyle = w.isPlayer ? '#fde047' : '#ff944d';
  ctx.beginPath();
  ctx.arc(8, -3.5, 2.1, 0, Math.PI * 2);
  ctx.arc(8, 3.5, 2.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Cast windup arc telegraph
  if (w.alive && w.castingSpell && w.castWindupTotal > 0) {
    const frac = 1 - w.castWindup / w.castWindupTotal;
    ctx.beginPath();
    ctx.arc(0, 0, w.radius + 9, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * frac);
    ctx.strokeStyle = SPELLS[w.castingSpell].accentColor;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Lava sizzle ring under feet
  if (w.alive && w.inLava) {
    ctx.beginPath();
    ctx.arc(0, 4, w.radius + 3 + Math.sin(time * 18) * 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 110, 20, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  if (w.alive && showNameplate) {
    const barW = 46;
    const barH = 5.5;
    const barY = -w.radius - 17;

    const plate = getNameplateCanvas(w.name, w.isPlayer);
    ctx.drawImage(plate, -70, barY - 20);

    ctx.fillStyle = 'rgba(12, 9, 8, 0.88)';
    ctx.fillRect(-barW * 0.5 - 1, barY - 1, barW + 2, barH + 2);

    const ghostFrac = Math.max(0, Math.min(1, w.ghostHp / w.maxHp));
    ctx.fillStyle = '#fca5a5';
    ctx.fillRect(-barW * 0.5, barY, barW * ghostFrac, barH);

    const hpFrac = Math.max(0, Math.min(1, w.hp / w.maxHp));
    ctx.fillStyle = w.isPlayer ? (hpFrac > 0.35 ? '#22c55e' : '#ef4444') : w.color;
    ctx.fillRect(-barW * 0.5, barY, barW * hpFrac, barH);

    ctx.strokeStyle = w.isPlayer ? 'rgba(245, 194, 86, 0.75)' : 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-barW * 0.5 - 1, barY - 1, barW + 2, barH + 2);
  }

  ctx.restore();
}

function drawProjectiles(ctx: CanvasRenderingContext2D, projectiles: ProjectileEntity[], time: number): void {
  for (let i = 0; i < projectiles.length; i++) {
    const p = projectiles[i];
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.vy, p.vx));

    if (p.spellId === 'fireball') {
      ctx.fillStyle = p.reflected ? 'rgba(56, 189, 248, 0.72)' : 'rgba(249, 115, 22, 0.72)';
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-28, -p.radius * 0.85);
      ctx.lineTo(-20, 0);
      ctx.lineTo(-28, p.radius * 0.85);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.reflected ? '#38bdf8' : '#f97316';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(2, 0, p.radius * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = '#fffbeb';
      ctx.fill();
    } else {
      const pulse = 1 + Math.sin(time * 25) * 0.14;
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-26, 0);
      ctx.lineTo(10, 0);
      ctx.stroke();

      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.moveTo(14 * pulse, 0);
      ctx.lineTo(-4, -9);
      ctx.lineTo(0, 0);
      ctx.lineTo(-4, 9);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#d1fae5';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawShockwaveRings(ctx: CanvasRenderingContext2D, effects: EffectsPool): void {
  const rings = effects.rings;
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    if (!r.active) continue;
    const alpha = Math.max(0, r.life / r.maxLife);
    ctx.globalAlpha = alpha * 0.85;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.lineWidth * alpha + 1;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawChainBeams(ctx: CanvasRenderingContext2D, effects: EffectsPool): void {
  const beams = effects.beams;
  for (let i = 0; i < beams.length; i++) {
    const b = beams[i];
    if (!b.active) continue;
    const alpha = Math.max(0, b.life / b.maxLife);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 4.5 * alpha + 1;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    const midX = (b.x1 + b.x2) * 0.5 + (Math.random() - 0.5) * 14;
    const midY = (b.y1 + b.y2) * 0.5 + (Math.random() - 0.5) * 14;
    ctx.quadraticCurveTo(midX, midY, b.x2, b.y2);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 * alpha;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawParticles(ctx: CanvasRenderingContext2D, effects: EffectsPool): void {
  const particles = effects.particles;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (!p.active) continue;
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * alpha), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloatingTexts(ctx: CanvasRenderingContext2D, effects: EffectsPool): void {
  const texts = effects.texts;
  ctx.textAlign = 'center';
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (!t.active) continue;
    const alpha = Math.min(1, (t.life / t.maxLife) * 1.4);
    ctx.globalAlpha = alpha;
    ctx.font = `700 ${Math.round(14 * t.scale)}px "JetBrains Mono", "Noto Sans SC", sans-serif`;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillText(t.text, t.x + 1.5, t.y + 1.5);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

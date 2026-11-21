import { decideAIAction } from './ai';
import { soundEngine } from './audio';
import {
  ARENA_INITIAL_RADIUS,
  BASE_MAX_HP,
  BOT_ROSTER,
  DEFAULT_MATCH_CONFIG,
  PLAYER_APPEARANCE,
  SHRINK_INTERVAL,
  SPELLS,
  WARLOCK_RADIUS,
} from './constants';
import { EffectsPool } from './particles';
import {
  applyDamageToWarlock,
  applyKnockbackImpulse,
  checkRoundWinner,
  checkTournamentComplete,
  computeLavaDamage,
  computeNextArenaRadius,
  distanceBetween,
  isPointInLava,
  reflectProjectile,
  resolveWarlockPairCollision,
  resolveWarlockPillarCollision,
  stepWarlockKinematics,
} from './physics';
import { renderArenaScene } from './renderer';
import { aiAutoShop, buyArtifact, buyOrUpgradeSpell, calculateRoundGoldReward, getDerivedStats, getSpellStats } from './shopLogic';
import {
  ArtifactId,
  CrumbledTile,
  GamePhase,
  GameScreenState,
  GravityWellEntity,
  HudSnapshot,
  KillFeedItem,
  MatchConfig,
  MeteorEntity,
  PillarEntity,
  ProjectileEntity,
  RoundSummary,
  SpellId,
  Vec2,
  WarlockEntity,
} from './types';

export class WarlockGameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onHudUpdate: (snapshot: HudSnapshot) => void;

  private rafId: number | null = null;
  private frameTimerId: number | null = null;
  private lastTimestamp = 0;
  private resizeObserver: ResizeObserver | null = null;
  private viewWidth = 1280;
  private viewHeight = 720;
  private dpr = 1;

  // Game State Machine
  private screen: GameScreenState = 'title';
  private phase: GamePhase = 'title';
  private config: MatchConfig = { ...DEFAULT_MATCH_CONFIG };

  // Match / Round State
  private round = 1;
  private roundTimer = 0;
  private introCountdown = 0;
  private roundEndDelay = 0;
  private shopTimer = 0;
  private simTime = 0;

  // Arena State
  private arenaRadius = ARENA_INITIAL_RADIUS;
  private nextShrinkIn = SHRINK_INTERVAL;
  private shrinkStage = 0;

  // Entities
  private warlocks: WarlockEntity[] = [];
  private projectiles: ProjectileEntity[] = [];
  private meteors: MeteorEntity[] = [];
  private gravityWells: GravityWellEntity[] = [];
  private pillars: PillarEntity[] = [];
  private crumbledTiles: CrumbledTile[] = [];
  private effects = new EffectsPool();
  private killFeed: KillFeedItem[] = [];
  private deathOrder: string[] = [];

  private roundSummary: RoundSummary | null = null;
  private finalSummary: RoundSummary | null = null;

  // Juice: Hitstop & Camera Shake
  private hitstopTimer = 0;
  private cameraTrauma = 0;
  private cameraX = 0;
  private cameraY = 0;
  private cameraZoom = 0.85;

  // Input State
  private keysHeld = new Set<string>();
  private mouseScreen: Vec2 = { x: 640, y: 360 };
  private mouseWorld: Vec2 = { x: 0, y: 0 };
  private bufferedSpell: SpellId | null = null;
  private bufferedSpellTimer = 0;
  private hoveredSpell: SpellId | null = null;

  // HUD throttle
  private hudEmitAccum = 0;
  private idCounter = 1;

  constructor(canvas: HTMLCanvasElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not acquire 2D canvas context');
    }
    this.ctx = context;
    this.onHudUpdate = onHudUpdate;

    this.setupResize();
    this.setupInputListeners();
    this.initTitleDemo();
    this.syncBodyAttributes();
    this.emitHud(true);

    this.lastTimestamp = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private nextId(prefix: string): string {
    return `${prefix}_${this.idCounter++}`;
  }

  private setupResize(): void {
    const updateSize = () => {
      const rect = this.canvas.getBoundingClientRect();
      this.viewWidth = Math.max(320, rect.width || window.innerWidth);
      this.viewHeight = Math.max(240, rect.height || window.innerHeight);
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.floor(this.viewWidth * this.dpr);
      this.canvas.height = Math.floor(this.viewHeight * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      // Fit full initial arena comfortably with breathing room for lava ring & HUD
      const minDim = Math.min(this.viewWidth, this.viewHeight);
      this.cameraZoom = Math.max(0.42, Math.min(0.95, minDim / 1220));
    };

    updateSize();
    this.resizeObserver = new ResizeObserver(updateSize);
    this.resizeObserver.observe(this.canvas);
    window.addEventListener('resize', updateSize);
    this.cleanupFns.push(() => {
      this.resizeObserver?.disconnect();
      window.removeEventListener('resize', updateSize);
    });
  }

  private cleanupFns: Array<() => void> = [];

  private screenToWorld(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const wx = (sx - this.viewWidth * 0.5) / this.cameraZoom + this.cameraX;
    const wy = (sy - this.viewHeight * 0.5) / this.cameraZoom + this.cameraY;
    return { x: wx, y: wy };
  }

  private setupInputListeners(): void {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;

      // Global Mute [M]
      if (code === 'KeyM' && !e.repeat) {
        this.toggleMute();
        return;
      }

      // Title screen Enter/Space start handshake
      if (this.screen === 'title' && (code === 'Enter' || code === 'Space') && !e.repeat) {
        e.preventDefault();
        this.startNewMatch(this.config);
        return;
      }

      // Shop Enter starts next round
      if (this.phase === 'shop' && code === 'Enter' && !e.repeat) {
        e.preventDefault();
        this.proceedToNextRound();
        return;
      }

      // Pause / Resume [Escape] or [P]
      if ((code === 'Escape' || code === 'KeyP') && !e.repeat) {
        if (this.screen === 'playing' && (this.phase === 'combat' || this.phase === 'intro')) {
          this.setPaused(true);
          return;
        }
        if (this.screen === 'paused') {
          this.setPaused(false);
          return;
        }
      }

      if (this.screen !== 'playing' || (this.phase !== 'combat' && this.phase !== 'intro')) {
        return;
      }

      soundEngine.unlock();
      this.keysHeld.add(code);

      // Clear RTS move target when using WASD/Arrows
      if (
        code === 'KeyW' && false // W is Repel in Warlock Brawl! Wait — let's handle WASD vs QWER cleanly!
      ) {
        // See keybinding note below
      }

      if (!e.repeat) {
        // Warlock Brawl Hybrid Controls:
        // Movement: Right-Click (classic War3 RTS) OR Arrow Keys OR WASD?
        // WAIT: In War3 Warlock Brawl, Q/W/E/R/D/F are iconic spell hotkeys, and W conflicts with WASD!
        // Let's make it super intuitive and conflict-free:
        // - Movement: Arrow Keys + Right-Click Move + Middle/Left-drag? Wait: what if a web player presses WASD?
        //   Let's check! In War3 Warlock Brawl, spell keys are Q/W/E/R/D/F (or 1-6). If W casts Repel AND moves up, that's messy.
        //   Wait: many web players expect WASD to move OR Right-Click to move. How do top MOBA/Warlock web games solve this?
        //   Let's check standard controls:
        //   - Classic War3 Mode (default & natural for War3 RPG):
        //     * Right-Click (or Hold Right-Click) = Move toward cursor (classic War3!)
        //     * Arrow Keys = Also move smoothly!
        //     * Q / W / E / R / D / F (and 1 / 2 / 3 / 4 / 5 / 6) = Cast Spells toward mouse!
        //     * Left-Click on Arena = Quick-cast Fireball (Q) toward mouse!
        //     * Space = Quick-cast Teleport (E) toward mouse (huge QoL for lava escapes!)
        //   Let's ALSO check: what if someone in browser test presses ArrowRight or WASD?
        //   Arrow keys work immediately for directional movement, Right-Click works for classic War3 RTS movement, Left-Click casts Fireball, Q/W/E/R/D/F + 1-6 cast all 6 spells, Space casts Blink!
        //   Wait: let's make sure the Title Screen control hint states this clearly:
        //   "右键 / 方向键 移动 · 左键 / Q W E R D F 施法 · Space 闪烁 · P / Esc 暂停"
        const spellKeyMap: Record<string, SpellId> = {
          KeyQ: 'fireball',
          Digit1: 'fireball',
          KeyW: 'repel',
          Digit2: 'repel',
          KeyE: 'teleport',
          Digit3: 'teleport',
          Space: 'teleport',
          KeyR: 'meteor',
          Digit4: 'meteor',
          KeyD: 'gravity',
          Digit5: 'gravity',
          KeyF: 'swap',
          Digit6: 'swap',
        };
        const mappedSpell = spellKeyMap[code];
        if (mappedSpell) {
          e.preventDefault();
          this.requestPlayerSpell(mappedSpell);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keysHeld.delete(e.code);
    };

    const onMouseMove = (e: MouseEvent) => {
      this.mouseScreen.x = e.clientX;
      this.mouseScreen.y = e.clientY;
      this.mouseWorld = this.screenToWorld(e.clientX, e.clientY);

      // Hold right mouse button to continuously steer Warlock (classic War3 fluid feel!)
      if ((e.buttons & 2) === 2 && this.screen === 'playing' && (this.phase === 'combat' || this.phase === 'intro')) {
        const player = this.getPlayer();
        if (player && player.alive) {
          player.moveTarget = { ...this.mouseWorld };
        }
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.target !== this.canvas) return;
      soundEngine.unlock();
      this.mouseScreen.x = e.clientX;
      this.mouseScreen.y = e.clientY;
      this.mouseWorld = this.screenToWorld(e.clientX, e.clientY);

      if (this.screen !== 'playing' || (this.phase !== 'combat' && this.phase !== 'intro')) {
        return;
      }
      const player = this.getPlayer();
      if (!player || !player.alive) return;

      if (e.button === 2) {
        // Right click = Move (classic War3 RTS)
        player.moveTarget = { ...this.mouseWorld };
        this.effects.spawnRing(this.mouseWorld.x, this.mouseWorld.y, 20, '#34d399', 0.22, 2);
      } else if (e.button === 0) {
        // Left click = Quick cast Fireball toward cursor
        this.requestPlayerSpell('fireball');
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      if (e.target === this.canvas) {
        e.preventDefault();
      }
    };

    const onBlurOrHide = () => {
      this.keysHeld.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', onBlurOrHide);
    document.addEventListener('visibilitychange', onBlurOrHide);

    this.cleanupFns.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', onBlurOrHide);
      document.removeEventListener('visibilitychange', onBlurOrHide);
    });
  }

  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.frameTimerId !== null) {
      window.clearTimeout(this.frameTimerId);
      this.frameTimerId = null;
    }
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
  }

  // --- Public UI Controls ---

  public updateMatchConfig(partial: Partial<MatchConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  public getMatchConfig(): MatchConfig {
    return { ...this.config };
  }

  public toggleMute(): void {
    soundEngine.setMuted(!soundEngine.isMuted());
    this.emitHud(true);
  }

  public setHoveredSpell(spellId: SpellId | null): void {
    this.hoveredSpell = spellId;
  }

  public castSpellFromUi(spellId: SpellId): void {
    soundEngine.unlock();
    if (this.screen !== 'playing' || this.phase !== 'combat') return;
    this.requestPlayerSpell(spellId);
  }

  public setPaused(paused: boolean): void {
    if (paused && this.screen === 'playing') {
      this.screen = 'paused';
      this.keysHeld.clear();
      this.syncBodyAttributes();
      this.emitHud(true);
    } else if (!paused && this.screen === 'paused') {
      this.screen = 'playing';
      this.keysHeld.clear();
      this.canvas.focus();
      this.syncBodyAttributes();
      this.emitHud(true);
    }
  }

  public returnToTitle(): void {
    this.screen = 'title';
    this.phase = 'title';
    this.keysHeld.clear();
    this.roundSummary = null;
    this.finalSummary = null;
    this.initTitleDemo();
    this.syncBodyAttributes();
    this.emitHud(true);
  }

  public startNewMatch(config?: MatchConfig, fromUserGesture = true): void {
    if (fromUserGesture) {
      soundEngine.unlock();
    }
    if (config) {
      this.config = { ...config };
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.keysHeld.clear();
    this.round = 1;
    this.roundSummary = null;
    this.finalSummary = null;
    this.killFeed = [];
    this.createTournamentRoster();
    this.setupRoundArena();
    this.screen = 'playing';
    this.phase = 'intro';
    this.introCountdown = 2.0;
    this.syncBodyAttributes();
    soundEngine.playRoundHorn();
    this.emitHud(true);
  }

  public playerBuySpell(spellId: SpellId): boolean {
    const player = this.getPlayer();
    if (!player || this.phase !== 'shop') return false;
    const res = buyOrUpgradeSpell(player, spellId);
    if (res.ok) {
      soundEngine.playPurchase();
      this.emitHud(true);
    }
    return res.ok;
  }

  public playerBuyArtifact(artifactId: ArtifactId): boolean {
    const player = this.getPlayer();
    if (!player || this.phase !== 'shop') return false;
    const res = buyArtifact(player, artifactId);
    if (res.ok) {
      soundEngine.playPurchase();
      this.emitHud(true);
    }
    return res.ok;
  }

  public proceedToNextRound(): void {
    if (this.phase !== 'shop') return;
    soundEngine.unlock();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.keysHeld.clear();
    this.round += 1;
    this.roundSummary = null;
    this.setupRoundArena();
    this.screen = 'playing';
    this.phase = 'intro';
    this.introCountdown = 1.8;
    this.syncBodyAttributes();
    soundEngine.playRoundHorn();
    this.emitHud(true);
  }

  // --- Initialization & Round Setup ---

  private initTitleDemo(): void {
    this.warlocks = [];
    this.projectiles = [];
    this.meteors = [];
    this.gravityWells = [];
    this.crumbledTiles = [];
    this.effects.clear();
    this.arenaRadius = ARENA_INITIAL_RADIUS;
    this.nextShrinkIn = SHRINK_INTERVAL;
    this.shrinkStage = 0;

    // Spawn 5 AI warlocks dueling live in the background!
    const count = 5;
    for (let i = 0; i < count; i++) {
      const entry = BOT_ROSTER[i];
      const ang = (i / count) * Math.PI * 2;
      const dist = 250;
      const w = this.makeWarlock({
        id: `demo_${i}`,
        name: entry.name,
        title: entry.title,
        isPlayer: false,
        archetype: entry.archetype,
        color: entry.color,
        trimColor: entry.trimColor,
        x: Math.cos(ang) * dist,
        y: Math.sin(ang) * dist,
      });
      w.spellLevels.gravity = 1;
      w.spellLevels.swap = 1;
      this.warlocks.push(w);
    }
    this.spawnArenaPillars();
  }

  private createTournamentRoster(): void {
    this.warlocks = [];
    const total = this.config.botCount + 1;

    // Create Player
    const player = this.makeWarlock({
      id: 'player',
      name: PLAYER_APPEARANCE.name,
      title: PLAYER_APPEARANCE.title,
      isPlayer: true,
      archetype: 'pyromancer',
      color: PLAYER_APPEARANCE.color,
      trimColor: PLAYER_APPEARANCE.trimColor,
      x: 0,
      y: 230,
    });
    // Starting gold to feel rewarding right after Round 1 (and 0 at R1 start or small starting pouch of 10g? In War3 Warlock Brawl, you start R1 with base kit & earn gold from R1 to shop before R2!)
    player.gold = 10;
    this.warlocks.push(player);

    // Create AI Bots
    for (let i = 0; i < this.config.botCount; i++) {
      const entry = BOT_ROSTER[i % BOT_ROSTER.length];
      const ang = ((i + 1) / total) * Math.PI * 2;
      const bot = this.makeWarlock({
        id: `bot_${i}`,
        name: entry.name,
        title: entry.title,
        isPlayer: false,
        archetype: entry.archetype,
        color: entry.color,
        trimColor: entry.trimColor,
        x: Math.cos(ang) * 260,
        y: Math.sin(ang) * 260,
      });
      bot.gold = 10;
      this.warlocks.push(bot);
    }
  }

  private makeWarlock(params: {
    id: string;
    name: string;
    title: string;
    isPlayer: boolean;
    archetype: WarlockEntity['archetype'];
    color: string;
    trimColor: string;
    x: number;
    y: number;
  }): WarlockEntity {
    return {
      ...params,
      vx: 0,
      vy: 0,
      knockVx: 0,
      knockVy: 0,
      facing: Math.atan2(-params.y, -params.x),
      radius: WARLOCK_RADIUS,
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
      spellLevels: {
        fireball: 1,
        repel: 1,
        teleport: 1,
        meteor: 1,
        gravity: 0,
        swap: 0,
      },
      cooldowns: {
        fireball: 0,
        repel: 0,
        teleport: 0,
        meteor: 0,
        gravity: 0,
        swap: 0,
      },
      artifacts: {
        boots: 0,
        lava_charm: 0,
        arcane_cloak: 0,
        titan_sigil: 0,
        vampiric_tome: 0,
        thorns_mail: 0,
      },
      gold: 0,
      roundWins: 0,
      totalKills: 0,
      roundKills: 0,
      totalDamage: 0,
      roundDamage: 0,
      lastDamagedBy: null,
      lastDamagedTime: -100,
      repelFlash: 0,
      blinkFlash: 0,
      aiThinkTimer: Math.random() * 0.6,
      aiStrafeDir: Math.random() < 0.5 ? 1 : -1,
      aiTargetId: null,
      aiAnchorAngle: Math.random() * Math.PI * 2,
    };
  }

  private setupRoundArena(): void {
    this.arenaRadius = ARENA_INITIAL_RADIUS;
    this.nextShrinkIn = SHRINK_INTERVAL;
    this.shrinkStage = 0;
    this.roundTimer = 0;
    this.roundEndDelay = 0;
    this.projectiles = [];
    this.meteors = [];
    this.gravityWells = [];
    this.crumbledTiles = [];
    this.deathOrder = [];
    this.killFeed = [];
    this.effects.clear();
    this.hitstopTimer = 0;
    this.cameraTrauma = 0;
    this.cameraX = 0;
    this.cameraY = 0;

    // Position all warlocks evenly on an open inner stone ring (radius 275, wide clear path!)
    const total = this.warlocks.length;
    const spawnRing = 275;
    for (let i = 0; i < total; i++) {
      const w = this.warlocks[i];
      // Put player at bottom-center (angle = PI/2) so player always has clear orientation
      const angle = Math.PI * 0.5 + (i / total) * Math.PI * 2;
      const derived = getDerivedStats(w.artifacts);
      w.x = Math.cos(angle) * spawnRing;
      w.y = Math.sin(angle) * spawnRing;
      w.vx = 0;
      w.vy = 0;
      w.knockVx = 0;
      w.knockVy = 0;
      w.facing = Math.atan2(-w.y, -w.x);
      w.maxHp = derived.maxHp;
      w.hp = derived.maxHp;
      w.ghostHp = derived.maxHp;
      w.alive = true;
      w.koTimer = 0;
      w.inLava = false;
      w.hitFlash = 0;
      w.squashX = 1;
      w.squashY = 1;
      w.moveTarget = null;
      w.castingSpell = null;
      w.castWindup = 0;
      w.castTarget = null;
      w.roundKills = 0;
      w.roundDamage = 0;
      w.lastDamagedBy = null;
      w.repelFlash = 0;
      w.blinkFlash = 0;
      for (const sid of Object.keys(w.cooldowns) as SpellId[]) {
        w.cooldowns[sid] = 0;
      }
    }

    this.spawnArenaPillars();
  }

  private spawnArenaPillars(): void {
    this.pillars = [];
    const pillarRing = 175;
    const count = 4;
    const baseAngle = Math.PI * 0.25;
    for (let i = 0; i < count; i++) {
      const a = baseAngle + (i / count) * Math.PI * 2;
      this.pillars.push({
        id: this.nextId('pillar'),
        x: Math.cos(a) * pillarRing,
        y: Math.sin(a) * pillarRing,
        radius: 26,
        hp: 100,
        maxHp: 100,
        hitFlash: 0,
      });
    }
  }

  private getPlayer(): WarlockEntity | null {
    return this.warlocks.find((w) => w.isPlayer) ?? null;
  }

  private requestPlayerSpell(spellId: SpellId): void {
    const player = this.getPlayer();
    if (!player || !player.alive) return;
    if (this.phase !== 'combat') {
      // Allow brief buffering at the end of intro countdown
      this.bufferedSpell = spellId;
      this.bufferedSpellTimer = 0.2;
      return;
    }
    if (!this.tryStartSpellCast(player, spellId, { ...this.mouseWorld })) {
      // Input buffer for 0.14s if spell is almost off cooldown or finishing windup
      this.bufferedSpell = spellId;
      this.bufferedSpellTimer = 0.14;
    }
  }

  private tryStartSpellCast(caster: WarlockEntity, spellId: SpellId, target: Vec2): boolean {
    if (!caster.alive) return false;
    if (caster.castingSpell) return false;
    const level = caster.spellLevels[spellId];
    if (!level || level <= 0) return false;
    if (caster.cooldowns[spellId] > 0) return false;

    const def = SPELLS[spellId];
    caster.castingSpell = spellId;
    caster.castWindup = def.windup;
    caster.castWindupTotal = def.windup;
    caster.castTarget = { ...target };
    caster.facing = Math.atan2(target.y - caster.y, target.x - caster.x);
    // Cancel click-to-move when casting an aimed spell (War3 feel)
    if (caster.isPlayer && spellId !== 'repel') {
      caster.moveTarget = null;
    }
    return true;
  }

  private executeSpellCast(caster: WarlockEntity, spellId: SpellId, target: Vec2): void {
    const level = caster.spellLevels[spellId];
    const stats = getSpellStats(spellId, level, caster.artifacts);
    caster.cooldowns[spellId] = stats.cooldown;
    caster.squashX = 1.18;
    caster.squashY = 0.86;

    const dx = target.x - caster.x;
    const dy = target.y - caster.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    if (spellId === 'fireball') {
      const speed = SPELLS.fireball.projectileSpeed || 640;
      this.projectiles.push({
        id: this.nextId('proj'),
        spellId: 'fireball',
        ownerId: caster.id,
        color: caster.color,
        x: caster.x + nx * (caster.radius + 10),
        y: caster.y + ny * (caster.radius + 10),
        vx: nx * speed,
        vy: ny * speed,
        radius: 11,
        damage: stats.damage,
        knockback: stats.knockback,
        blastRadius: stats.radius,
        traveled: 0,
        maxRange: stats.range,
        reflected: false,
        age: 0,
      });
      this.effects.spawnBurst(caster.x + nx * 24, caster.y + ny * 24, 6, ['#fef08a', '#f97316'], 40, 140, 2, 4.5, 0.14, 0.28);
      if (this.screen === 'playing') soundEngine.playFireballCast();
    } else if (spellId === 'repel') {
      caster.repelFlash = 0.28;
      this.effects.spawnRing(caster.x, caster.y, stats.radius, '#38bdf8', 0.3, 4);
      this.effects.spawnBurst(caster.x, caster.y, 14, ['#bae6fd', '#38bdf8', '#ffffff'], 90, 240, 2.5, 5, 0.18, 0.36);

      let reflectedAny = false;
      // Reflect incoming enemy projectiles within Repel radius!
      for (const proj of this.projectiles) {
        if (proj.ownerId === caster.id) continue;
        if (distanceBetween(caster.x, caster.y, proj.x, proj.y) <= stats.radius + proj.radius) {
          if (reflectProjectile(proj, caster)) {
            reflectedAny = true;
            this.effects.spawnRing(proj.x, proj.y, 38, '#7dd3fc', 0.22, 3);
            if (this.screen === 'playing') {
              this.effects.spawnText(proj.x, proj.y - 16, '反弹!', '#7dd3fc', 1.1);
            }
          }
        }
      }

      // Knock back nearby enemy warlocks
      for (const targetW of this.warlocks) {
        if (!targetW.alive || targetW.id === caster.id) continue;
        const d = distanceBetween(caster.x, caster.y, targetW.x, targetW.y);
        if (d <= stats.radius + targetW.radius) {
          const rx = targetW.x - caster.x;
          const ry = targetW.y - caster.y;
          applyKnockbackImpulse(targetW, rx, ry, stats.knockback);
          const dmgRes = applyDamageToWarlock(targetW, stats.damage, caster, this.simTime);
          if (this.screen === 'playing' && dmgRes.dealt > 0) {
            this.effects.spawnText(targetW.x, targetW.y - 26, `-${Math.round(dmgRes.dealt)}`, '#7dd3fc');
          }
          if (dmgRes.killed) {
            this.handleWarlockDeath(targetW, caster, 'spell');
          }
        }
      }

      if (reflectedAny) {
        this.triggerJuice(0.045, 0.32);
      } else {
        this.triggerJuice(0.02, 0.18);
      }
      if (this.screen === 'playing') soundEngine.playRepel(reflectedAny);
    } else if (spellId === 'teleport') {
      const jumpDist = Math.min(dist, stats.range);
      const destX = caster.x + nx * jumpDist;
      const destY = caster.y + ny * jumpDist;

      this.effects.spawnRing(caster.x, caster.y, 44, '#c084fc', 0.26, 3);
      this.effects.spawnBurst(caster.x, caster.y, 12, ['#e9d5ff', '#a855f7'], 40, 150, 2.5, 5, 0.2, 0.42);
      this.effects.spawnBeam(caster.x, caster.y, destX, destY, '#a855f7', 0.22);

      caster.x = destX;
      caster.y = destY;
      // Classic Warlock Blink clears knockback momentum!
      caster.knockVx *= 0.15;
      caster.knockVy *= 0.15;
      caster.blinkFlash = 0.25;
      caster.squashX = 0.82;
      caster.squashY = 1.24;

      this.effects.spawnRing(destX, destY, 48, '#a855f7', 0.28, 3);
      this.effects.spawnBurst(destX, destY, 12, ['#f3e8ff', '#a855f7'], 50, 170, 2.5, 5, 0.2, 0.4);
      if (this.screen === 'playing') soundEngine.playBlink();
    } else if (spellId === 'meteor') {
      const clampedDist = Math.min(dist, stats.range);
      const mx = caster.x + nx * clampedDist;
      const my = caster.y + ny * clampedDist;
      this.meteors.push({
        id: this.nextId('meteor'),
        ownerId: caster.id,
        x: mx,
        y: my,
        radius: stats.radius,
        damage: stats.damage,
        knockback: stats.knockback,
        delay: 0.82,
        elapsed: 0,
        color: caster.color,
      });
      if (this.screen === 'playing') soundEngine.playMeteorWarn();
    } else if (spellId === 'gravity') {
      const clampedDist = Math.min(dist, stats.range);
      const gx = caster.x + nx * clampedDist;
      const gy = caster.y + ny * clampedDist;
      this.gravityWells.push({
        id: this.nextId('grav'),
        ownerId: caster.id,
        x: gx,
        y: gy,
        radius: stats.radius,
        pullForce: stats.knockback,
        dps: stats.damage,
        duration: 2.6,
        elapsed: 0,
      });
      this.effects.spawnRing(gx, gy, stats.radius, '#818cf8', 0.35, 2.5);
      if (this.screen === 'playing') soundEngine.playGravity();
    } else if (spellId === 'swap') {
      const speed = SPELLS.swap.projectileSpeed || 760;
      this.projectiles.push({
        id: this.nextId('swap'),
        spellId: 'swap',
        ownerId: caster.id,
        color: '#10b981',
        x: caster.x + nx * (caster.radius + 10),
        y: caster.y + ny * (caster.radius + 10),
        vx: nx * speed,
        vy: ny * speed,
        radius: 12,
        damage: stats.damage,
        knockback: stats.knockback,
        blastRadius: 24,
        traveled: 0,
        maxRange: stats.range,
        reflected: false,
        age: 0,
      });
      if (this.screen === 'playing') soundEngine.playSwap(false);
    }

    if (caster.isPlayer && this.screen === 'playing') {
      this.emitHud(true);
    }
  }

  private triggerJuice(hitstop: number, trauma: number): void {
    if (this.screen !== 'playing') return;
    this.hitstopTimer = Math.max(this.hitstopTimer, hitstop);
    this.cameraTrauma = Math.min(1, this.cameraTrauma + trauma);
  }

  private handleWarlockDeath(victim: WarlockEntity, killer: WarlockEntity | null, cause: 'spell' | 'lava' | 'reflect'): void {
    // Credit recent attacker if victim burned to death in lava
    let actualKiller = killer;
    if (!actualKiller && victim.lastDamagedBy && this.simTime - victim.lastDamagedTime < 6.5) {
      actualKiller = this.warlocks.find((w) => w.id === victim.lastDamagedBy) ?? null;
    }

    if (actualKiller && actualKiller.id !== victim.id) {
      actualKiller.roundKills += 1;
      actualKiller.totalKills += 1;
    }

    this.deathOrder.push(victim.id);
    this.effects.spawnBurst(victim.x, victim.y, 26, [victim.color, '#fb923c', '#fef08a', '#ffffff'], 70, 320, 3, 7, 0.3, 0.7);
    this.effects.spawnRing(victim.x, victim.y, 88, victim.color, 0.42, 4);

    if (this.screen === 'playing') {
      this.triggerJuice(0.065, 0.48);
      soundEngine.playKill();
      this.killFeed.unshift({
        id: this.nextId('kf'),
        killerName: actualKiller ? actualKiller.name : '熔岩炼狱',
        killerColor: actualKiller ? actualKiller.color : '#f97316',
        victimName: victim.name,
        victimColor: victim.color,
        cause,
        timestamp: this.simTime,
      });
      if (this.killFeed.length > 4) {
        this.killFeed.length = 4;
      }
      this.emitHud(true);
    }
  }

  // --- Main 60fps Loop ---

  private scheduleNextFrame(delayMs: number): void {
    if (delayMs > 0) {
      this.frameTimerId = window.setTimeout(() => {
        this.frameTimerId = null;
        this.rafId = requestAnimationFrame(this.loop);
      }, delayMs);
    } else {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  private loop = (timestamp: number): void => {
    this.rafId = null;
    const rawDt = Math.max(0, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;
    const dt = Math.min(rawDt, 0.05); // Clamped dt <= 0.05s

    if (this.screen === 'paused') {
      this.scheduleNextFrame(80);
      return;
    }

    const frameStart = performance.now();
    this.update(dt);
    this.render();
    const frameCost = performance.now() - frameStart;

    // On hardware GPUs frameCost is ~1-3ms -> 0ms delay (full native 60fps+).
    // On software CPU renderers (frameCost > 10ms), yield briefly so the compositor never starves.
    this.scheduleNextFrame(frameCost > 10 ? 18 : 0);
  };

  private update(dt: number): void {
    // Decay hitstop & camera shake in real time
    if (this.cameraTrauma > 0) {
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.9);
    }
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      // Visuals (hit flashes & particles) still tick softly during hitstop
      this.effects.update(dt * 0.35);
      return;
    }

    this.simTime += dt;

    // Ambient lava embers rising around the arena
    if (Math.random() < 0.38) {
      const ang = Math.random() * Math.PI * 2;
      const rr = this.arenaRadius + 30 + Math.random() * 240;
      this.effects.spawnParticle(
        Math.cos(ang) * rr,
        Math.sin(ang) * rr,
        (Math.random() - 0.5) * 28,
        -22 - Math.random() * 40,
        2 + Math.random() * 3,
        0.9 + Math.random() * 1.1,
        Math.random() < 0.5 ? '#fb923c' : '#fde047',
        0.5,
        true
      );
    }

    // Update crumbled basalt debris
    for (let i = this.crumbledTiles.length - 1; i >= 0; i--) {
      const tile = this.crumbledTiles[i];
      tile.age += dt;
      tile.angle += tile.rotSpeed * dt;
      tile.alpha = Math.max(0, 1 - tile.age / 1.4);
      if (tile.alpha <= 0) {
        this.crumbledTiles.splice(i, 1);
      }
    }

    // Handle Title Screen Live Attract Mode
    if (this.screen === 'title') {
      this.updateTitleDemo(dt);
      this.effects.update(dt);
      return;
    }

    // Handle Shop State
    if (this.phase === 'shop') {
      this.effects.update(dt);
      return;
    }

    // Handle Game Over background settle
    if (this.screen === 'gameover') {
      this.effects.update(dt);
      return;
    }

    // Handle Intro Countdown (player can move/position freely, no damage taken for 1.8s so zero-input survival is guaranteed!)
    if (this.phase === 'intro') {
      this.introCountdown -= dt;
      this.stepCombatEntities(dt, true);
      if (this.introCountdown <= 0) {
        this.introCountdown = 0;
        this.phase = 'combat';
        this.syncBodyAttributes();
        this.emitHud(true);
      }
      this.effects.update(dt);
      this.hudEmitAccum += dt;
      if (this.hudEmitAccum >= 0.16) {
        this.hudEmitAccum = 0;
        this.emitHud(false);
      }
      return;
    }

    // Active Combat or Round End Beat
    if (this.phase === 'combat' || this.phase === 'round_end') {
      const player = this.getPlayer();
      // Gently speed up spectator phase if player is already eliminated in this round
      const simDt = player && !player.alive && this.phase === 'combat' ? Math.min(0.075, dt * 1.5) : dt;
      this.roundTimer += simDt;
      this.stepArenaShrink(simDt);
      this.stepCombatEntities(simDt, false);
      this.effects.update(simDt);

      if (this.phase === 'combat') {
        const result = checkRoundWinner(this.warlocks);
        if (result.ended) {
          this.phase = 'round_end';
          this.roundEndDelay = 0.95;
          if (result.winner) {
            result.winner.roundWins += 1;
            this.effects.spawnText(result.winner.x, result.winner.y - 44, '回合胜利!', '#fde047', 1.4, 1.3);
          }
          this.syncBodyAttributes();
          this.emitHud(true);
        }
      } else if (this.phase === 'round_end') {
        this.roundEndDelay -= dt;
        if (this.roundEndDelay <= 0) {
          this.concludeRound();
        }
      }

      // Prune stale killfeed entries (> 7s)
      this.killFeed = this.killFeed.filter((k) => this.simTime - k.timestamp < 7);

      this.hudEmitAccum += dt;
      if (this.hudEmitAccum >= 0.16) {
        this.hudEmitAccum = 0;
        this.emitHud(false);
      }
    }
  }

  private updateTitleDemo(dt: number): void {
    // Gentle orbital camera pan over the live volcanic arena
    this.cameraX = Math.cos(this.simTime * 0.22) * 34;
    this.cameraY = Math.sin(this.simTime * 0.17) * 26;

    this.stepCombatEntities(dt, false);

    // Respawn demo bots seamlessly if only <= 1 left so the background arena stays lively forever
    const aliveCount = this.warlocks.filter((w) => w.alive).length;
    if (aliveCount <= 1) {
      this.initTitleDemo();
    }
  }

  private stepArenaShrink(dt: number): void {
    const nextRadius = computeNextArenaRadius(this.arenaRadius);
    if (nextRadius >= this.arenaRadius) {
      this.nextShrinkIn = 999;
      return;
    }

    this.nextShrinkIn -= dt;
    if (this.nextShrinkIn <= 0) {
      const oldRadius = this.arenaRadius;
      this.arenaRadius = nextRadius;
      this.shrinkStage += 1;
      this.nextShrinkIn = SHRINK_INTERVAL;

      // Spawn crumbling basalt stone chunks along the collapsed ring
      const chunks = 26;
      for (let i = 0; i < chunks; i++) {
        const ang = (i / chunks) * Math.PI * 2 + Math.random() * 0.18;
        const rr = this.arenaRadius + (oldRadius - this.arenaRadius) * (0.25 + Math.random() * 0.65);
        this.crumbledTiles.push({
          x: Math.cos(ang) * rr,
          y: Math.sin(ang) * rr,
          size: 20 + Math.random() * 18,
          angle: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 3.5,
          alpha: 1,
          age: 0,
        });
      }
      this.effects.spawnRing(0, 0, oldRadius, '#f97316', 0.55, 5);
      this.triggerJuice(0.03, 0.35);
      if (this.screen === 'playing') soundEngine.playExplosion(true);

      // Destroy outer pillars if they fall into lava
      this.pillars = this.pillars.filter((p) => Math.hypot(p.x, p.y) < this.arenaRadius - 10);
    }
  }

  private stepCombatEntities(dt: number, introSafe: boolean): void {
    // Update mouseWorld continuously with camera
    this.mouseWorld = this.screenToWorld(this.mouseScreen.x, this.mouseScreen.y);

    // Buffered player spell input
    if (this.bufferedSpell && !introSafe) {
      this.bufferedSpellTimer -= dt;
      const player = this.getPlayer();
      if (player && this.tryStartSpellCast(player, this.bufferedSpell, { ...this.mouseWorld })) {
        this.bufferedSpell = null;
      } else if (this.bufferedSpellTimer <= 0) {
        this.bufferedSpell = null;
      }
    }

    // Crowd fairness token pool: at most 2-3 AIs initiate offensive casts on the same tick
    let aiAttackTokens = this.config.difficulty === 'hard' ? 3 : 2;

    // 1. Update Warlocks
    for (const w of this.warlocks) {
      if (!w.alive) {
        if (w.koTimer > 0) w.koTimer = Math.max(0, w.koTimer - dt);
        continue;
      }

      // Tick cooldowns & visual flashes
      for (const sid of Object.keys(w.cooldowns) as SpellId[]) {
        if (w.cooldowns[sid] > 0) {
          w.cooldowns[sid] = Math.max(0, w.cooldowns[sid] - dt);
        }
      }
      if (w.hitFlash > 0) w.hitFlash = Math.max(0, w.hitFlash - dt);
      if (w.repelFlash > 0) w.repelFlash = Math.max(0, w.repelFlash - dt);
      if (w.blinkFlash > 0) w.blinkFlash = Math.max(0, w.blinkFlash - dt);

      // Cast windup resolution
      if (w.castingSpell) {
        w.castWindup -= dt;
        if (w.castWindup <= 0) {
          const castId = w.castingSpell;
          const castPos = w.castTarget || { x: w.x + Math.cos(w.facing) * 100, y: w.y + Math.sin(w.facing) * 100 };
          w.castingSpell = null;
          w.castTarget = null;
          this.executeSpellCast(w, castId, castPos);
        }
      }

      // Determine movement input
      const moveDir: Vec2 = { x: 0, y: 0 };
      if (w.isPlayer) {
        // Keyboard Arrow movement
        if (this.keysHeld.has('ArrowUp')) moveDir.y -= 1;
        if (this.keysHeld.has('ArrowDown')) moveDir.y += 1;
        if (this.keysHeld.has('ArrowLeft')) moveDir.x -= 1;
        if (this.keysHeld.has('ArrowRight')) moveDir.x += 1;

        if (moveDir.x !== 0 || moveDir.y !== 0) {
          w.moveTarget = null;
        } else if (w.moveTarget) {
          const dx = w.moveTarget.x - w.x;
          const dy = w.moveTarget.y - w.y;
          const d = Math.hypot(dx, dy);
          if (d > 8) {
            moveDir.x = dx / d;
            moveDir.y = dy / d;
          } else {
            w.moveTarget = null;
          }
        }
      } else if (!introSafe) {
        const ai = decideAIAction(
          w,
          {
            warlocks: this.warlocks,
            projectiles: this.projectiles,
            meteors: this.meteors,
            gravityWells: this.gravityWells,
            arenaRadius: this.arenaRadius,
            difficulty: this.config.difficulty,
            attackTokensAvailable: aiAttackTokens,
          },
          dt
        );
        moveDir.x = ai.moveDir.x;
        moveDir.y = ai.moveDir.y;

        if (ai.castSpell && ai.castTarget) {
          if (this.tryStartSpellCast(w, ai.castSpell, ai.castTarget)) {
            if (ai.castSpell !== 'teleport' && ai.castSpell !== 'repel') {
              aiAttackTokens = Math.max(0, aiAttackTokens - 1);
            }
          }
        }
      }

      // Step physics kinematics
      stepWarlockKinematics(w, moveDir, this.arenaRadius, dt);

      // Lava burn damage
      if (!introSafe && isPointInLava(w.x, w.y, this.arenaRadius)) {
        const lavaDmg = computeLavaDamage(dt, w, this.shrinkStage);
        w.lavaTickAccum += dt;
        const dmgRes = applyDamageToWarlock(w, lavaDmg, null, this.simTime);
        if (w.lavaTickAccum >= 0.25) {
          w.lavaTickAccum = 0;
          this.effects.spawnBurst(w.x, w.y + 6, 4, ['#fb923c', '#ef4444', '#fef08a'], 25, 95, 2, 4.5, 0.18, 0.35);
          if (w.isPlayer && this.screen === 'playing') {
            soundEngine.playLavaSizzle();
          }
        }
        if (dmgRes.killed) {
          this.handleWarlockDeath(w, null, 'lava');
        }
      }

      // Resolve pillar collisions
      for (const pillar of this.pillars) {
        resolveWarlockPillarCollision(w, pillar);
      }
    }

    // 2. Resolve Warlock-to-Warlock elastic collisions
    for (let i = 0; i < this.warlocks.length; i++) {
      for (let j = i + 1; j < this.warlocks.length; j++) {
        resolveWarlockPairCollision(this.warlocks[i], this.warlocks[j]);
      }
    }

    // 3. Update Gravity Wells
    for (let i = this.gravityWells.length - 1; i >= 0; i--) {
      const gw = this.gravityWells[i];
      gw.elapsed += dt;
      if (gw.elapsed >= gw.duration) {
        this.gravityWells.splice(i, 1);
        continue;
      }
      const owner = this.warlocks.find((w) => w.id === gw.ownerId) ?? null;
      for (const target of this.warlocks) {
        if (!target.alive || target.id === gw.ownerId) continue;
        const d = distanceBetween(gw.x, gw.y, target.x, target.y);
        if (d < gw.radius && d > 10) {
          const pullStrength = gw.pullForce * (1 - d / (gw.radius * 1.25));
          target.knockVx += ((gw.x - target.x) / d) * pullStrength * dt * 2.2;
          target.knockVy += ((gw.y - target.y) / d) * pullStrength * dt * 2.2;
          const res = applyDamageToWarlock(target, gw.dps * dt, owner, this.simTime);
          if (res.killed) {
            this.handleWarlockDeath(target, owner, 'spell');
          }
        }
      }
    }

    // 4. Update Meteors
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.elapsed += dt;
      if (m.elapsed >= m.delay) {
        this.detonateMeteor(m);
        this.meteors.splice(i, 1);
      }
    }

    // 5. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += dt;
      const stepX = p.vx * dt;
      const stepY = p.vy * dt;
      p.x += stepX;
      p.y += stepY;
      p.traveled += Math.hypot(stepX, stepY);

      // Trail embers
      if (Math.random() < 0.65) {
        this.effects.spawnParticle(
          p.x,
          p.y,
          -p.vx * 0.08 + (Math.random() - 0.5) * 40,
          -p.vy * 0.08 + (Math.random() - 0.5) * 40,
          p.spellId === 'fireball' ? 4 : 3,
          0.22,
          p.spellId === 'fireball' ? (p.reflected ? '#38bdf8' : '#fb923c') : '#34d399',
          4
        );
      }

      let hit = false;

      // Check pillar hit
      for (let pi = this.pillars.length - 1; pi >= 0; pi--) {
        const pillar = this.pillars[pi];
        if (distanceBetween(p.x, p.y, pillar.x, pillar.y) <= p.radius + pillar.radius) {
          pillar.hp -= p.damage;
          pillar.hitFlash = 0.1;
          this.effects.spawnBurst(p.x, p.y, 10, ['#a8a29e', '#f97316'], 60, 210, 2.5, 5, 0.2, 0.4);
          if (pillar.hp <= 0) {
            this.effects.spawnBurst(pillar.x, pillar.y, 20, ['#57534e', '#f97316', '#fbbf24'], 80, 260, 3, 7, 0.3, 0.6);
            this.pillars.splice(pi, 1);
          }
          if (p.spellId === 'fireball') {
            this.detonateFireball(p);
          }
          hit = true;
          break;
        }
      }

      // Check warlock hit
      if (!hit) {
        for (const target of this.warlocks) {
          if (!target.alive || target.id === p.ownerId) continue;
          if (distanceBetween(p.x, p.y, target.x, target.y) <= p.radius + target.radius) {
            if (p.spellId === 'fireball') {
              this.detonateFireball(p);
            } else {
              this.resolveSoulSwapHit(p, target);
            }
            hit = true;
            break;
          }
        }
      }

      if (hit || p.traveled >= p.maxRange) {
        if (!hit && p.spellId === 'fireball') {
          this.detonateFireball(p);
        }
        this.projectiles.splice(i, 1);
      }
    }

    // Update pillar flashes
    for (const pillar of this.pillars) {
      if (pillar.hitFlash > 0) pillar.hitFlash = Math.max(0, pillar.hitFlash - dt);
    }
  }

  private detonateFireball(p: ProjectileEntity): void {
    const owner = this.warlocks.find((w) => w.id === p.ownerId) ?? null;
    this.effects.spawnRing(p.x, p.y, p.blastRadius, p.reflected ? '#38bdf8' : '#f97316', 0.28, 3.5);
    this.effects.spawnBurst(
      p.x,
      p.y,
      16,
      p.reflected ? ['#bae6fd', '#38bdf8', '#ffffff'] : ['#fef08a', '#fb923c', '#ef4444'],
      70,
      270,
      2.5,
      6,
      0.2,
      0.48
    );

    let hitSomeone = false;
    for (const target of this.warlocks) {
      if (!target.alive || target.id === p.ownerId) continue;
      const d = distanceBetween(p.x, p.y, target.x, target.y);
      if (d <= p.blastRadius + target.radius) {
        hitSomeone = true;
        const falloff = Math.max(0.55, 1 - d / (p.blastRadius + target.radius + 20));
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        // Blend radial blast direction with fireball flight momentum for crisp knockback control
        const dirX = dx * 0.65 + p.vx * 0.08;
        const dirY = dy * 0.65 + p.vy * 0.08;
        applyKnockbackImpulse(target, dirX, dirY, p.knockback * falloff);

        const dmgRes = applyDamageToWarlock(target, Math.round(p.damage * falloff), owner, this.simTime);
        if (this.screen === 'playing' && dmgRes.dealt > 0) {
          this.effects.spawnText(target.x, target.y - 26, `-${Math.round(dmgRes.dealt)}`, p.reflected ? '#7dd3fc' : '#fdba74');
        }
        if (dmgRes.killed) {
          this.handleWarlockDeath(target, owner, p.reflected ? 'reflect' : 'spell');
        }
      }
    }

    if (hitSomeone) {
      this.triggerJuice(0.04, 0.3);
    }
    if (this.screen === 'playing') soundEngine.playExplosion(false);
  }

  private resolveSoulSwapHit(p: ProjectileEntity, target: WarlockEntity): void {
    const owner = this.warlocks.find((w) => w.id === p.ownerId) ?? null;
    if (!owner || !owner.alive) return;

    const oldOwnerX = owner.x;
    const oldOwnerY = owner.y;
    const oldTargetX = target.x;
    const oldTargetY = target.y;

    owner.x = oldTargetX;
    owner.y = oldTargetY;
    owner.knockVx *= 0.2;
    owner.knockVy *= 0.2;

    target.x = oldOwnerX;
    target.y = oldOwnerY;
    // Slight nudge outward if owner was near edge
    applyKnockbackImpulse(target, oldOwnerX, oldOwnerY, p.knockback);

    const dmgRes = applyDamageToWarlock(target, p.damage, owner, this.simTime);
    this.effects.spawnBeam(oldOwnerX, oldOwnerY, oldTargetX, oldTargetY, '#10b981', 0.42);
    this.effects.spawnRing(oldOwnerX, oldOwnerY, 55, '#34d399', 0.32, 3.5);
    this.effects.spawnRing(oldTargetX, oldTargetY, 55, '#34d399', 0.32, 3.5);
    this.effects.spawnBurst(oldOwnerX, oldOwnerY, 14, ['#6ee7b7', '#10b981', '#ffffff'], 60, 210);
    if (this.screen === 'playing') {
      this.effects.spawnText(target.x, target.y - 30, '灵魂置换!', '#6ee7b7', 1.15);
      soundEngine.playSwap(true);
    }
    this.triggerJuice(0.05, 0.36);

    if (dmgRes.killed) {
      this.handleWarlockDeath(target, owner, 'spell');
    }
  }

  private detonateMeteor(m: MeteorEntity): void {
    const owner = this.warlocks.find((w) => w.id === m.ownerId) ?? null;
    this.effects.spawnRing(m.x, m.y, m.radius, '#ef4444', 0.42, 5);
    this.effects.spawnRing(m.x, m.y, m.radius * 0.65, '#fde047', 0.32, 3.5);
    this.effects.spawnBurst(m.x, m.y, 28, ['#fef08a', '#fb923c', '#ef4444', '#7f1d1d'], 90, 360, 3, 8, 0.28, 0.65);

    // Damage pillars caught in meteor blast
    for (let pi = this.pillars.length - 1; pi >= 0; pi--) {
      const pillar = this.pillars[pi];
      if (distanceBetween(m.x, m.y, pillar.x, pillar.y) <= m.radius + pillar.radius) {
        pillar.hp -= m.damage * 1.4;
        pillar.hitFlash = 0.14;
        if (pillar.hp <= 0) {
          this.pillars.splice(pi, 1);
        }
      }
    }

    for (const target of this.warlocks) {
      if (!target.alive) continue;
      const d = distanceBetween(m.x, m.y, target.x, target.y);
      if (d <= m.radius + target.radius) {
        // Caster takes 40% self-damage if standing inside own meteor
        const isSelf = target.id === m.ownerId;
        const mult = isSelf ? 0.4 : Math.max(0.55, 1 - d / (m.radius + target.radius + 30));
        applyKnockbackImpulse(target, target.x - m.x, target.y - m.y, m.knockback * mult);
        const dmgRes = applyDamageToWarlock(target, Math.round(m.damage * mult), isSelf ? null : owner, this.simTime);
        if (this.screen === 'playing' && dmgRes.dealt > 0) {
          this.effects.spawnText(target.x, target.y - 30, `-${Math.round(dmgRes.dealt)}`, '#fca5a5', 1.15);
        }
        if (dmgRes.killed) {
          this.handleWarlockDeath(target, isSelf ? null : owner, 'spell');
        }
      }
    }

    this.triggerJuice(0.055, 0.52);
    if (this.screen === 'playing') soundEngine.playExplosion(true);
  }

  private concludeRound(): void {
    const alive = this.warlocks.filter((w) => w.alive);
    const winner = alive[0] ?? null;
    const total = this.warlocks.length;

    // Award gold to every warlock based on placement, kills, and damage
    let playerGoldEarned = 0;
    let playerRank = total;

    for (const w of this.warlocks) {
      let rank: number;
      if (w.alive) {
        rank = 1;
      } else {
        const deathIdx = this.deathOrder.indexOf(w.id);
        rank = deathIdx >= 0 ? total - deathIdx : total;
      }
      const reward = calculateRoundGoldReward({
        survived: w.alive,
        roundKills: w.roundKills,
        roundDamage: w.roundDamage,
        placementRank: rank,
        totalCombatants: total,
      });
      w.gold += reward;

      if (w.isPlayer) {
        playerGoldEarned = reward;
        playerRank = rank;
      } else {
        // Bots shop between rounds!
        aiAutoShop(w);
      }
    }

    const standings = [...this.warlocks]
      .sort((a, b) => b.roundWins - a.roundWins || b.totalKills - a.totalKills || b.totalDamage - a.totalDamage)
      .map((w) => ({
        id: w.id,
        name: w.name,
        color: w.color,
        isPlayer: w.isPlayer,
        roundWins: w.roundWins,
        totalKills: w.totalKills,
        totalDamage: Math.round(w.totalDamage),
        alive: w.alive,
        gold: w.gold,
      }));

    const player = this.getPlayer();
    const summary: RoundSummary = {
      roundNumber: this.round,
      winnerId: winner?.id ?? null,
      winnerName: winner?.name ?? '同归于尽',
      winnerColor: winner?.color ?? '#f97316',
      playerRank,
      totalCombatants: total,
      playerGoldEarned,
      playerKills: player?.roundKills ?? 0,
      playerDamage: Math.round(player?.roundDamage ?? 0),
      standings,
    };

    if (checkTournamentComplete(this.round, this.config.totalRounds)) {
      this.finalSummary = summary;
      const playerWon = standings[0]?.isPlayer ?? false;
      this.screen = 'gameover';
      this.phase = playerWon ? 'victory' : 'defeat';
      soundEngine.playVictory(playerWon);
    } else {
      this.roundSummary = summary;
      this.phase = 'shop';
      this.shopTimer = 0;
    }

    this.keysHeld.clear();
    this.syncBodyAttributes();
    this.emitHud(true);
  }

  private render(): void {
    const shakeMag = this.cameraTrauma * this.cameraTrauma * 14;
    const shakeX = (Math.random() * 2 - 1) * shakeMag;
    const shakeY = (Math.random() * 2 - 1) * shakeMag;

    renderArenaScene(this.ctx, this.viewWidth, this.viewHeight, {
      time: this.simTime,
      arenaRadius: this.arenaRadius,
      nextArenaRadius: computeNextArenaRadius(this.arenaRadius),
      nextShrinkIn: this.nextShrinkIn,
      cameraX: this.cameraX,
      cameraY: this.cameraY,
      cameraZoom: this.cameraZoom,
      shakeX,
      shakeY,
      warlocks: this.warlocks,
      projectiles: this.projectiles,
      meteors: this.meteors,
      gravityWells: this.gravityWells,
      pillars: this.pillars,
      crumbledTiles: this.crumbledTiles,
      effects: this.effects,
      mouseWorld: this.mouseWorld,
      aimPreviewSpell: this.hoveredSpell,
      player: this.getPlayer(),
      isTitleDemo: this.screen === 'title',
      introCountdown: this.introCountdown,
    });
  }

  private syncBodyAttributes(): void {
    document.body.dataset.state = this.screen;
    document.body.dataset.phase = this.phase;
  }

  private emitHud(force: boolean): void {
    void force;
    const player = this.getPlayer();
    const maxCooldowns: Record<SpellId, number> = {
      fireball: 3,
      repel: 5.5,
      teleport: 8,
      meteor: 9,
      gravity: 10.5,
      swap: 9.5,
    };
    if (player) {
      for (const sid of Object.keys(maxCooldowns) as SpellId[]) {
        maxCooldowns[sid] = getSpellStats(sid, Math.max(1, player.spellLevels[sid]), player.artifacts).cooldown;
      }
    }

    const aliveCount = this.warlocks.filter((w) => w.alive).length;

    this.onHudUpdate({
      screen: this.screen,
      phase: this.phase,
      round: this.round,
      totalRounds: this.config.totalRounds,
      roundTimer: this.roundTimer,
      introCountdown: this.introCountdown,
      arenaRadius: Math.round(this.arenaRadius),
      maxArenaRadius: ARENA_INITIAL_RADIUS,
      shrinkStage: this.shrinkStage,
      nextShrinkIn: this.nextShrinkIn,
      aliveCount,
      totalCombatants: this.warlocks.length,
      muted: soundEngine.isMuted(),
      player: player
        ? {
            hp: Math.ceil(player.hp),
            maxHp: Math.round(player.maxHp),
            ghostHp: Math.ceil(player.ghostHp),
            inLava: player.inLava,
            alive: player.alive,
            gold: player.gold,
            roundWins: player.roundWins,
            totalKills: player.totalKills,
            totalDamage: Math.round(player.totalDamage),
            spellLevels: { ...player.spellLevels },
            cooldowns: { ...player.cooldowns },
            maxCooldowns,
            artifacts: { ...player.artifacts },
            selectedSpell: this.hoveredSpell,
          }
        : {
            hp: BASE_MAX_HP,
            maxHp: BASE_MAX_HP,
            ghostHp: BASE_MAX_HP,
            inLava: false,
            alive: false,
            gold: 0,
            roundWins: 0,
            totalKills: 0,
            totalDamage: 0,
            spellLevels: { fireball: 1, repel: 1, teleport: 1, meteor: 1, gravity: 0, swap: 0 },
            cooldowns: { fireball: 0, repel: 0, teleport: 0, meteor: 0, gravity: 0, swap: 0 },
            maxCooldowns,
            artifacts: { boots: 0, lava_charm: 0, arcane_cloak: 0, titan_sigil: 0, vampiric_tome: 0, thorns_mail: 0 },
            selectedSpell: null,
          },
      killFeed: [...this.killFeed],
      roundSummary: this.roundSummary,
      finalSummary: this.finalSummary,
      shopTimer: this.shopTimer,
    });
  }
}

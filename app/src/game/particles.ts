export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  drag: number;
  glow: boolean;
}

export interface ShockwaveRing {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
  lineWidth: number;
}

export interface FloatingText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface ChainBeam {
  active: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  life: number;
  maxLife: number;
}

const MAX_PARTICLES = 640;
const MAX_RINGS = 48;
const MAX_TEXTS = 48;
const MAX_BEAMS = 16;

export class EffectsPool {
  public readonly particles: Particle[] = [];
  public readonly rings: ShockwaveRing[] = [];
  public readonly texts: FloatingText[] = [];
  public readonly beams: ChainBeam[] = [];

  private particleCursor = 0;
  private ringCursor = 0;
  private textCursor = 0;
  private beamCursor = 0;

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 3,
        life: 0,
        maxLife: 1,
        color: '#f97316',
        drag: 3,
        glow: false,
      });
    }
    for (let i = 0; i < MAX_RINGS; i++) {
      this.rings.push({
        active: false,
        x: 0,
        y: 0,
        radius: 10,
        maxRadius: 80,
        life: 0,
        maxLife: 0.4,
        color: '#f97316',
        lineWidth: 3,
      });
    }
    for (let i = 0; i < MAX_TEXTS; i++) {
      this.texts.push({
        active: false,
        x: 0,
        y: 0,
        vy: -40,
        text: '',
        color: '#ffffff',
        life: 0,
        maxLife: 0.8,
        scale: 1,
      });
    }
    for (let i = 0; i < MAX_BEAMS; i++) {
      this.beams.push({
        active: false,
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
        color: '#10b981',
        life: 0,
        maxLife: 0.35,
      });
    }
  }

  public clear(): void {
    for (let i = 0; i < MAX_PARTICLES; i++) this.particles[i].active = false;
    for (let i = 0; i < MAX_RINGS; i++) this.rings[i].active = false;
    for (let i = 0; i < MAX_TEXTS; i++) this.texts[i].active = false;
    for (let i = 0; i < MAX_BEAMS; i++) this.beams[i].active = false;
  }

  public spawnParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    size: number,
    life: number,
    color: string,
    drag = 3.2,
    glow = true
  ): void {
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.size = size;
    p.life = life;
    p.maxLife = life;
    p.color = color;
    p.drag = drag;
    p.glow = glow;
  }

  public spawnBurst(
    x: number,
    y: number,
    count: number,
    colors: string[],
    speedMin: number,
    speedMax: number,
    sizeMin = 2.5,
    sizeMax = 6,
    lifeMin = 0.22,
    lifeMax = 0.55
  ): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = speedMin + Math.random() * (speedMax - speedMin);
      const sz = sizeMin + Math.random() * (sizeMax - sizeMin);
      const life = lifeMin + Math.random() * (lifeMax - lifeMin);
      const col = colors[i % colors.length];
      this.spawnParticle(x, y, Math.cos(ang) * spd, Math.sin(ang) * spd, sz, life, col);
    }
  }

  public spawnRing(
    x: number,
    y: number,
    maxRadius: number,
    color: string,
    maxLife = 0.32,
    lineWidth = 3.5
  ): void {
    const r = this.rings[this.ringCursor];
    this.ringCursor = (this.ringCursor + 1) % MAX_RINGS;
    r.active = true;
    r.x = x;
    r.y = y;
    r.radius = 8;
    r.maxRadius = maxRadius;
    r.life = maxLife;
    r.maxLife = maxLife;
    r.color = color;
    r.lineWidth = lineWidth;
  }

  public spawnText(
    x: number,
    y: number,
    text: string,
    color: string,
    scale = 1,
    life = 0.85
  ): void {
    const t = this.texts[this.textCursor];
    this.textCursor = (this.textCursor + 1) % MAX_TEXTS;
    t.active = true;
    t.x = x + (Math.random() - 0.5) * 16;
    t.y = y;
    t.vy = -44;
    t.text = text;
    t.color = color;
    t.life = life;
    t.maxLife = life;
    t.scale = scale;
  }

  public spawnBeam(x1: number, y1: number, x2: number, y2: number, color: string, life = 0.35): void {
    const b = this.beams[this.beamCursor];
    this.beamCursor = (this.beamCursor + 1) % MAX_BEAMS;
    b.active = true;
    b.x1 = x1;
    b.y1 = y1;
    b.x2 = x2;
    b.y2 = y2;
    b.color = color;
    b.life = life;
    b.maxLife = life;
  }

  public update(dt: number): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      const decay = Math.exp(-p.drag * dt);
      p.vx *= decay;
      p.vy *= decay;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    for (let i = 0; i < MAX_RINGS; i++) {
      const r = this.rings[i];
      if (!r.active) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.active = false;
        continue;
      }
      const t = 1 - r.life / r.maxLife;
      const eased = 1 - Math.pow(1 - t, 3);
      r.radius = 8 + (r.maxRadius - 8) * eased;
    }

    for (let i = 0; i < MAX_TEXTS; i++) {
      const t = this.texts[i];
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
        continue;
      }
      t.y += t.vy * dt;
      t.vy *= Math.exp(-2.8 * dt);
    }

    for (let i = 0; i < MAX_BEAMS; i++) {
      const b = this.beams[i];
      if (!b.active) continue;
      b.life -= dt;
      if (b.life <= 0) b.active = false;
    }
  }
}

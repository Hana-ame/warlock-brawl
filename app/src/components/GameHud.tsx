import React, { useState } from 'react';
import { ARTIFACTS, ARTIFACT_ORDER, SHRINK_WARNING_DURATION, SPELLS, SPELL_ORDER } from '../game/constants';
import { getSpellStats } from '../game/shopLogic';
import { HudSnapshot, SpellId } from '../game/types';
import {
  ArtifactIconSvg,
  GoldCoinIcon,
  PauseIcon,
  RestartIcon,
  SoundIcon,
  SpellIconSvg,
} from './SpellIcons';

interface GameHudProps {
  hud: HudSnapshot;
  onCastSpell: (spellId: SpellId) => void;
  onHoverSpell: (spellId: SpellId | null) => void;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
}

export function GameHud({
  hud,
  onCastSpell,
  onHoverSpell,
  onToggleMute,
  onPause,
  onRestart,
}: GameHudProps) {
  const [tooltipSpell, setTooltipSpell] = useState<SpellId | null>(null);

  const { player } = hud;
  const hpPct = Math.max(0, Math.min(100, (player.hp / Math.max(1, player.maxHp)) * 100));
  const ghostPct = Math.max(0, Math.min(100, (player.ghostHp / Math.max(1, player.maxHp)) * 100));
  const shrinkWarning = hud.nextShrinkIn <= SHRINK_WARNING_DURATION && hud.nextShrinkIn < 100;

  const ownedArtifacts = ARTIFACT_ORDER.filter((aid) => (player.artifacts[aid] || 0) > 0);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-4">
      {/* Top Perimeter Row */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left Compact Telemetry Cluster */}
        <div className="war3-frame rounded-md px-3.5 py-2 flex items-center gap-4 text-xs">
          <div>
            <div className="text-[10px] tracking-wider text-[#b59c80] uppercase">回合</div>
            <div className="font-mono-num text-lg font-bold text-[#f7e7cb] leading-tight">
              {hud.round}<span className="text-xs text-[#9c846a]">/{hud.totalRounds}</span>
            </div>
          </div>

          <div className="w-px h-7 bg-[#4d3929]" aria-hidden="true" />

          <div>
            <div className="text-[10px] tracking-wider text-[#b59c80] uppercase">存活</div>
            <div className="font-mono-num text-lg font-bold text-[#f7e7cb] leading-tight">
              {hud.aliveCount}<span className="text-xs text-[#9c846a]">/{hud.totalCombatants}</span>
            </div>
          </div>

          <div className="w-px h-7 bg-[#4d3929]" aria-hidden="true" />

          <div>
            <div className="text-[10px] tracking-wider text-[#b59c80] uppercase">
              {hud.nextShrinkIn > 100 ? '终局缩圈' : '缩圈倒计时'}
            </div>
            <div
              className={`font-mono-num text-lg font-bold leading-tight ${
                shrinkWarning ? 'text-[#fb923c]' : 'text-[#e8d6bc]'
              }`}
            >
              {hud.nextShrinkIn > 100 ? '最小' : `${Math.ceil(hud.nextShrinkIn)}s`}
            </div>
          </div>

          <div className="w-px h-7 bg-[#4d3929]" aria-hidden="true" />

          <div>
            <div className="text-[10px] tracking-wider text-[#b59c80] uppercase">金币</div>
            <div className="font-mono-num text-lg font-bold text-[#f5c256] leading-tight flex items-center gap-1">
              <GoldCoinIcon className="w-4 h-4 shrink-0" />
              <span>{player.gold}</span>
            </div>
          </div>
        </div>

        {/* Top-Right Utility Controls + Kill Feed */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              tabIndex={-1}
              aria-label={hud.muted ? '开启音效 (M)' : '静音 (M)'}
              title={hud.muted ? '开启音效 [M]' : '静音 [M]'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="war3-btn-secondary w-9 h-9 rounded flex items-center justify-center cursor-pointer"
            >
              <SoundIcon muted={hud.muted} className="w-4 h-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="暂停游戏 (P)"
              title="暂停 [P / Esc]"
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              className="war3-btn-secondary w-9 h-9 rounded flex items-center justify-center cursor-pointer"
            >
              <PauseIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="重新开始整场对局"
              title="重新开始对局"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="war3-btn-secondary w-9 h-9 rounded flex items-center justify-center cursor-pointer"
            >
              <RestartIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Transient Kill Feed (max 3 entries, clean text with dark scrim) */}
          {hud.killFeed.length > 0 && (
            <div className="flex flex-col items-end gap-1 mt-1">
              {hud.killFeed.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="bg-[#120d0b]/85 border border-[#573e2b]/60 px-2.5 py-1 rounded text-xs flex items-center gap-1.5"
                >
                  <span style={{ color: item.killerColor }} className="font-semibold">
                    {item.killerName}
                  </span>
                  <span className="text-[#9e8974]">
                    {item.cause === 'lava' ? '逼入岩浆击杀' : item.cause === 'reflect' ? '反弹击杀' : '击败了'}
                  </span>
                  <span style={{ color: item.victimColor }} className="font-semibold">
                    {item.victimName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transient Center Announcements (Intro Countdown or Eliminated Spectator Notice) */}
      <div className="flex flex-col items-center justify-center">
        {hud.phase === 'intro' && (
          <div className="text-center war3-text-shadow">
            <div className="font-display text-2xl sm:text-3xl font-bold tracking-[0.18em] text-[#f5c26b]">
              第 {hud.round} 回合
            </div>
            <div className="mt-1 text-sm font-medium text-[#efe5d5]">
              准备战斗 · {Math.max(1, Math.ceil(hud.introCountdown))}
            </div>
          </div>
        )}
        {hud.phase === 'combat' && !player.alive && (
          <div className="war3-frame px-5 py-2 rounded-md text-center">
            <span className="text-sm font-semibold text-[#fca5a5]">本回合已阵亡</span>
            <span className="mx-2 text-[#735b47]">·</span>
            <span className="text-xs text-[#cbb8a1]">观战剩余术士决出胜负</span>
          </div>
        )}
      </div>

      {/* Bottom-Center Classic War3 Spell Dock & Vitality Bar */}
      <div className="flex flex-col items-center gap-2">
        {/* Hover Tooltip for Spell Socket */}
        {tooltipSpell && (
          <div className="war3-frame rounded-md px-3.5 py-2 max-w-xs text-left">
            {(() => {
              const def = SPELLS[tooltipSpell];
              const lvl = player.spellLevels[tooltipSpell] || 0;
              const stats = getSpellStats(tooltipSpell, Math.max(1, lvl), player.artifacts);
              return (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-[#f7e7cb]">
                      [{def.key}] {def.name}
                    </span>
                    <span className="text-xs font-mono-num text-[#d59d52]">
                      {lvl > 0 ? `Lv.${lvl}` : `未解锁 (${def.unlockCost} 金币)`}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#c7b39d] mt-0.5">{def.role}</div>
                  <p className="text-xs text-[#e3d5c3] mt-1 leading-relaxed">{def.description}</p>
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] font-mono-num text-[#b8a18a]">
                    <span>冷却 {stats.cooldown.toFixed(1)}s</span>
                    {stats.damage > 0 && <span>伤害 {stats.damage}</span>}
                    {stats.knockback > 0 && <span>击退 {stats.knockback}</span>}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        <div className="war3-frame rounded-lg px-3 py-2.5 flex flex-col gap-2 pointer-events-auto">
          {/* Player Vitality Bar + Status */}
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-[220px] sm:min-w-[300px]">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="font-semibold text-[#e8d8c3] flex items-center gap-2">
                  <span>生命值</span>
                  <span
                    className={`font-medium ${
                      !player.alive
                        ? 'text-[#f87171]'
                        : player.inLava
                          ? 'text-[#fb923c]'
                          : 'text-[#86efac]'
                    }`}
                  >
                    {!player.alive ? '已阵亡' : player.inLava ? '岩浆灼烧!' : '安全区'}
                  </span>
                </span>
                <span className="font-mono-num font-bold text-[#f7e7cb]">
                  {player.hp} / {player.maxHp}
                </span>
              </div>
              <div className="relative h-3.5 bg-[#120d0b] border border-[#523c2a] rounded-sm overflow-hidden">
                {/* Delayed Ghost Damage Bar (compositor scaleX only) */}
                <div
                  className="absolute inset-0 origin-left bg-[#fca5a5]/75"
                  style={{ transform: `scaleX(${ghostPct / 100})` }}
                />
                {/* Current HP Fill (compositor scaleX only) */}
                <div
                  className="absolute inset-0 origin-left"
                  style={{
                    transform: `scaleX(${hpPct / 100})`,
                    background:
                      player.inLava || hpPct < 30
                        ? 'linear-gradient(90deg, #b91c1c, #ef4444)'
                        : 'linear-gradient(90deg, #15803d, #22c55e)',
                  }}
                />
              </div>
            </div>

            {/* Compact Owned Artifacts Strip */}
            {ownedArtifacts.length > 0 && (
              <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-[#473425]">
                {ownedArtifacts.map((aid) => {
                  const stacks = player.artifacts[aid];
                  return (
                    <div
                      key={aid}
                      title={`${ARTIFACTS[aid].name} x${stacks}`}
                      className="relative w-8 h-8 rounded bg-[#18120f] border border-[#6e5034] flex items-center justify-center"
                    >
                      <ArtifactIconSvg artifactId={aid} className="w-5 h-5" />
                      {stacks > 1 && (
                        <span className="absolute -bottom-0.5 -right-0.5 bg-[#120d0b] px-1 text-[10px] font-mono-num font-bold text-[#f5c256]">
                          {stacks}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 6 War3 Forged Spell Sockets */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2">
            {SPELL_ORDER.map((sid) => {
              const def = SPELLS[sid];
              const level = player.spellLevels[sid] || 0;
              const unlocked = level > 0;
              const cd = player.cooldowns[sid] || 0;
              const maxCd = player.maxCooldowns[sid] || 1;
              const cdRatio = unlocked ? Math.max(0, Math.min(1, cd / maxCd)) : 1;
              const ready = unlocked && cd <= 0.05 && player.alive;

              return (
                <button
                  key={sid}
                  type="button"
                  tabIndex={-1}
                  disabled={!unlocked || !player.alive}
                  aria-label={`${def.name} (${def.key}) ${unlocked ? `等级 ${level}` : '未解锁'}`}
                  onMouseEnter={() => {
                    setTooltipSpell(sid);
                    if (unlocked) onHoverSpell(sid);
                  }}
                  onMouseLeave={() => {
                    setTooltipSpell(null);
                    onHoverSpell(null);
                  }}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onCastSpell(sid);
                  }}
                  className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-md border flex flex-col items-center justify-center overflow-hidden transition-transform cursor-pointer ${
                    !unlocked
                      ? 'bg-[#14100e] border-[#3a2b20] opacity-55 cursor-not-allowed'
                      : ready
                        ? 'bg-[#211814] border-[#b8874b] hover:border-[#f5c26b] active:scale-95'
                        : 'bg-[#181210] border-[#523d2c]'
                  }`}
                >
                  <SpellIconSvg spellId={sid} className={`w-7 h-7 ${!unlocked ? 'grayscale opacity-50' : ''}`} />

                  {/* Cooldown vertical curtain (compositor scaleY only) */}
                  {unlocked && cd > 0.05 && (
                    <div
                      className="absolute inset-0 origin-bottom bg-black/72 pointer-events-none"
                      style={{ transform: `scaleY(${cdRatio})` }}
                    />
                  )}

                  {/* Cooldown seconds label */}
                  {unlocked && cd > 0.05 && (
                    <span className="absolute inset-0 flex items-center justify-center font-mono-num text-sm font-bold text-[#fff4e0] war3-text-shadow">
                      {cd < 1 ? cd.toFixed(1) : Math.ceil(cd)}
                    </span>
                  )}

                  {/* Locked label */}
                  {!unlocked && (
                    <span className="absolute bottom-1 text-[9px] font-medium text-[#b59c80]">商店解锁</span>
                  )}

                  {/* Keybind badge top-left */}
                  <span className="absolute top-0.5 left-1 font-mono-num text-[10px] font-bold text-[#f5c26b] war3-text-shadow">
                    {def.key}
                  </span>

                  {/* Level indicator top-right */}
                  {unlocked && (
                    <span className="absolute top-0.5 right-1 font-mono-num text-[9px] font-bold text-[#d4bfa6]">
                      {level}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { MatchConfig } from '../game/types';
import { WarlockCrestSvg } from './SpellIcons';

interface TitleScreenProps {
  config: MatchConfig;
  onChangeConfig: (partial: Partial<MatchConfig>) => void;
  onStart: () => void;
}

export function TitleScreen({ config, onChangeConfig, onStart }: TitleScreenProps) {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none">
      {/* Measured calm radial scrim over live volcanic arena */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 62% 68% at 50% 48%, rgba(12, 8, 7, 0.80) 0%, rgba(12, 8, 7, 0.44) 56%, rgba(12, 8, 7, 0.62) 100%)',
        }}
      />

      {/* Top spacer */}
      <div className="relative h-8 shrink-0" />

      {/* Center Focal Lockup */}
      <div className="relative flex flex-col items-center justify-center px-6 text-center pointer-events-auto">
        <WarlockCrestSvg className="w-20 h-20 mb-3 drop-shadow-[0_6px_18px_rgba(0,0,0,0.85)]" />

        <h1
          className="font-display text-5xl sm:text-6xl md:text-7xl font-black tracking-[0.14em] text-[#f7e7cb] war3-text-shadow"
          style={{ textWrap: 'balance' }}
        >
          术士之战
        </h1>
        <p className="mt-1.5 font-display text-sm sm:text-base tracking-[0.34em] text-[#d59d52] uppercase war3-text-shadow">
          WARLOCK BRAWL
        </p>
        <div className="mt-3 w-36 h-px bg-gradient-to-r from-transparent via-[#c88a42] to-transparent" aria-hidden="true" />

        {/* Compact Match Setup Strip */}
        <div className="mt-8 war3-frame px-5 py-4 rounded-lg w-full max-w-md flex flex-col gap-3.5">
          {/* Rounds */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-[#bda992] whitespace-nowrap shrink-0">赛制回合</span>
            <div className="flex items-center gap-1.5">
              {([3, 5, 7] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onChangeConfig({ totalRounds: r })}
                  className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    config.totalRounds === r
                      ? 'bg-[#b84a1b] text-[#fff6e8] border border-[#e0914f]'
                      : 'bg-[#1c1512] text-[#bfa992] border border-[#4a3728] hover:border-[#8f6843]'
                  }`}
                >
                  {r} 回合
                </button>
              ))}
            </div>
          </div>

          {/* Combatants */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-[#bda992] whitespace-nowrap shrink-0">参战术士</span>
            <div className="flex items-center gap-1.5">
              {([3, 5, 7] as const).map((bots) => (
                <button
                  key={bots}
                  type="button"
                  onClick={() => onChangeConfig({ botCount: bots })}
                  className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    config.botCount === bots
                      ? 'bg-[#b84a1b] text-[#fff6e8] border border-[#e0914f]'
                      : 'bg-[#1c1512] text-[#bfa992] border border-[#4a3728] hover:border-[#8f6843]'
                  }`}
                >
                  {bots + 1} 人混战
                </button>
              ))}
            </div>
          </div>

          {/* AI Difficulty */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-[#bda992] whitespace-nowrap shrink-0">对手强度</span>
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'normal', label: '经典难度' },
                  { id: 'hard', label: '炼狱大师' },
                ] as const
              ).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onChangeConfig({ difficulty: d.id })}
                  className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    config.difficulty === d.id
                      ? 'bg-[#b84a1b] text-[#fff6e8] border border-[#e0914f]'
                      : 'bg-[#1c1512] text-[#bfa992] border border-[#4a3728] hover:border-[#8f6843]'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Single Dominant Primary CTA */}
        <button
          type="button"
          data-start="true"
          onClick={onStart}
          className="mt-6 war3-btn-primary px-10 py-3.5 rounded-md font-display text-lg font-bold tracking-[0.16em] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#f5c26b] focus-visible:outline-offset-2"
        >
          开始对战
        </button>
      </div>

      {/* Bottom Flat Borderless Control Hint Line */}
      <div className="relative pb-5 px-4 text-center">
        <p className="text-xs text-[#c9b7a2]/85 tracking-wide war3-text-shadow">
          右键 / 方向键 移动 · 左键 / Q W E R D F 施法 · Space 闪烁 · P / Esc 暂停
        </p>
      </div>
    </div>
  );
}

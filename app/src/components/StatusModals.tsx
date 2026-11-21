import React from 'react';
import { HudSnapshot } from '../game/types';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export function PauseModal({ onResume, onRestart, onReturnTitle }: PauseModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/72">
      <div className="war3-panel rounded-lg w-full max-w-sm p-6 text-center">
        <h2 className="font-display text-2xl font-bold text-[#f7e7cb] tracking-wider">战斗暂停</h2>
        <p className="mt-1.5 text-xs text-[#b59e85]">按 Esc 或 P 可随时返回战场</p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="war3-btn-primary w-full py-2.5 rounded-md font-display text-sm font-bold tracking-wider cursor-pointer"
          >
            继续战斗
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="war3-btn-secondary w-full py-2.5 rounded-md text-sm font-medium cursor-pointer"
          >
            重新开始对局
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="war3-btn-secondary w-full py-2.5 rounded-md text-sm font-medium cursor-pointer"
          >
            返回主菜单
          </button>
        </div>
      </div>
    </div>
  );
}

interface GameOverModalProps {
  hud: HudSnapshot;
  onPlayAgain: () => void;
  onReturnTitle: () => void;
}

export function GameOverModal({ hud, onPlayAgain, onReturnTitle }: GameOverModalProps) {
  const isVictory = hud.phase === 'victory';
  const summary = hud.finalSummary;
  const playerRankIdx = summary ? summary.standings.findIndex((s) => s.isPlayer) + 1 : 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/78">
      <div className="war3-panel rounded-lg w-full max-w-lg p-6">
        <div className="text-center">
          <h2
            className={`font-display text-3xl font-black tracking-[0.12em] ${
              isVictory ? 'text-[#f5c256]' : 'text-[#f87171]'
            }`}
          >
            {isVictory ? '大术士登顶' : '锦标赛落幕'}
          </h2>
          <p className="mt-1.5 text-sm text-[#cbb8a1]">
            {isVictory
              ? `历经 ${hud.totalRounds} 回合激战，你以压倒性实力征服了熔岩竞技场。`
              : `你在本次 ${hud.totalRounds} 回合锦标赛中获得第 ${playerRankIdx || hud.totalCombatants} 名。`}
          </p>
        </div>

        {/* 3 Frozen Tabular Mastery Stat Tiles */}
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <div className="bg-[#16100d] border border-[#473425] rounded p-3 text-center">
            <div className="text-[11px] text-[#a9937d]">回合胜场</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-[#f5c256]">
              {hud.player.roundWins}/{hud.totalRounds}
            </div>
          </div>
          <div className="bg-[#16100d] border border-[#473425] rounded p-3 text-center">
            <div className="text-[11px] text-[#a9937d]">总击杀</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-[#f7e7cb]">
              {hud.player.totalKills}
            </div>
          </div>
          <div className="bg-[#16100d] border border-[#473425] rounded p-3 text-center">
            <div className="text-[11px] text-[#a9937d]">总输出伤害</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-[#fb923c]">
              {hud.player.totalDamage}
            </div>
          </div>
        </div>

        {/* Final Standings Table */}
        {summary && (
          <div className="mt-4 bg-[#140f0d] border border-[#3d2d20] rounded p-3 max-h-48 overflow-y-auto">
            <div className="flex flex-col divide-y divide-[#291e16]">
              {summary.standings.map((row, idx) => (
                <div
                  key={row.id}
                  className={`py-1.5 flex items-center justify-between text-xs ${
                    row.isPlayer ? 'text-[#fde68a] font-bold' : 'text-[#d4c3ae]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num w-6 text-[#9c846a]">#{idx + 1}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-sm border border-black/60"
                      style={{ backgroundColor: row.color }}
                      aria-hidden="true"
                    />
                    <span>{row.name}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono-num">
                    <span>{row.roundWins}胜</span>
                    <span className="text-[#a9937d]">{row.totalKills}杀</span>
                    <span className="text-[#9c846a]">{row.totalDamage}伤</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            data-start="true"
            onClick={onPlayAgain}
            className="war3-btn-primary px-7 py-2.5 rounded-md font-display text-sm font-bold tracking-wider whitespace-nowrap shrink-0 cursor-pointer"
          >
            再来一局
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="war3-btn-secondary px-6 py-2.5 rounded-md text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer"
          >
            返回主菜单
          </button>
        </div>
      </div>
    </div>
  );
}

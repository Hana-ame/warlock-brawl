import React, { useState } from 'react';
import { ARTIFACTS, ARTIFACT_ORDER, SPELLS, SPELL_ORDER } from '../game/constants';
import { getSpellNextCost, getSpellStats } from '../game/shopLogic';
import { ArtifactId, HudSnapshot, SpellId } from '../game/types';
import { ArtifactIconSvg, GoldCoinIcon, SpellIconSvg } from './SpellIcons';

interface ShopOverlayProps {
  hud: HudSnapshot;
  onBuySpell: (spellId: SpellId) => void;
  onBuyArtifact: (artifactId: ArtifactId) => void;
  onNextRound: () => void;
}

export function ShopOverlay({ hud, onBuySpell, onBuyArtifact, onNextRound }: ShopOverlayProps) {
  const [activeTab, setActiveTab] = useState<'spells' | 'artifacts'>('spells');
  const summary = hud.roundSummary;
  const { player } = hud;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-black/72">
      <div className="war3-panel rounded-lg w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header: Round Outcome & Gold Balance */}
        <div className="px-5 py-4 border-b border-[#4d3828] flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-display text-2xl font-bold text-[#f7e7cb]">
                第 {hud.round} 回合结束 · 术士商店
              </h2>
              {summary && (
                <span className="text-xs text-[#cbb8a1]">
                  胜者：<strong style={{ color: summary.winnerColor }}>{summary.winnerName}</strong>
                </span>
              )}
            </div>
            {summary && (
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#b59f88] font-mono-num">
                <span>本回合排名 #{summary.playerRank}/{summary.totalCombatants}</span>
                <span aria-hidden="true">·</span>
                <span>击杀 {summary.playerKills}</span>
                <span aria-hidden="true">·</span>
                <span>伤害 {summary.playerDamage}</span>
                <span aria-hidden="true">·</span>
                <span className="text-[#f5c256]">获得 +{summary.playerGoldEarned} 金币</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-[#16100d] border border-[#6e5034] px-3.5 py-2 rounded-md">
              <GoldCoinIcon className="w-5 h-5" />
              <div>
                <div className="text-[10px] text-[#a89076] leading-none">当前金币</div>
                <div className="font-mono-num text-xl font-bold text-[#f5c256] leading-tight" data-testid="shop-gold">
                  {player.gold}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onNextRound}
              className="war3-btn-primary px-6 py-2.5 rounded-md font-display text-sm font-bold tracking-wider whitespace-nowrap shrink-0 cursor-pointer"
            >
              开始第 {hud.round + 1} 回合
            </button>
          </div>
        </div>

        {/* Body Split: Shop Tabs (Left) + Tournament Standings (Right) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#423022]">
          {/* Shop Section */}
          <div className="lg:col-span-8 p-4 sm:p-5 flex flex-col gap-4">
            {/* Segmented Tab Controls */}
            <div className="flex items-center gap-2 border-b border-[#3a2a1e] pb-3">
              <button
                type="button"
                onClick={() => setActiveTab('spells')}
                className={`px-4 py-1.5 text-sm font-semibold rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'spells'
                    ? 'bg-[#b84a1b] text-[#fff6e8] border border-[#e0914f]'
                    : 'bg-[#1a1310] text-[#baa48e] border border-[#423123] hover:text-[#f7e7cb]'
                }`}
              >
                法术研习 (6)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('artifacts')}
                className={`px-4 py-1.5 text-sm font-semibold rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'artifacts'
                    ? 'bg-[#b84a1b] text-[#fff6e8] border border-[#e0914f]'
                    : 'bg-[#1a1310] text-[#baa48e] border border-[#423123] hover:text-[#f7e7cb]'
                }`}
              >
                秘宝装备 (6)
              </button>
            </div>

            {activeTab === 'spells' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SPELL_ORDER.map((sid) => {
                  const def = SPELLS[sid];
                  const level = player.spellLevels[sid] || 0;
                  const nextCost = getSpellNextCost(sid, level);
                  const canAfford = nextCost !== null && player.gold >= nextCost;
                  const currentStats = getSpellStats(sid, Math.max(1, level), player.artifacts);
                  const nextStats = level < def.maxLevel
                    ? getSpellStats(sid, Math.max(1, level + 1), player.artifacts)
                    : null;

                  return (
                    <div
                      key={sid}
                      className="bg-[#18120f] border border-[#473425] rounded-md p-3.5 flex flex-col justify-between gap-2.5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded bg-[#231a15] border border-[#735438] flex items-center justify-center shrink-0 relative">
                          <SpellIconSvg spellId={sid} className="w-7 h-7" />
                          <span className="absolute -top-1.5 -left-1.5 bg-[#120d0b] border border-[#735438] px-1 text-[10px] font-mono-num font-bold text-[#f5c26b]">
                            {def.key}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-[#f7e7cb] truncate">{def.name}</span>
                            <span className="font-mono-num text-xs text-[#d59d52] shrink-0">
                              {level === 0 ? '未学习' : `Lv.${level}/${def.maxLevel}`}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#a9937d] mt-0.5">{def.role}</div>
                          <p className="text-xs text-[#cbb9a5] mt-1 leading-snug">{def.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#2e2219]">
                        <div className="text-[11px] font-mono-num text-[#b59f88]">
                          {level === 0 ? (
                            <span>冷却 {currentStats.cooldown.toFixed(1)}s</span>
                          ) : nextStats ? (
                            <span>
                              冷却 {currentStats.cooldown.toFixed(1)}s → {nextStats.cooldown.toFixed(1)}s
                              {nextStats.damage > 0 && ` · 伤 ${currentStats.damage}→${nextStats.damage}`}
                            </span>
                          ) : (
                            <span className="text-[#86efac]">已满级</span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => onBuySpell(sid)}
                          className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer ${
                            nextCost === null
                              ? 'bg-[#1f2922] text-[#86efac] border border-[#2f4f38] cursor-default'
                              : canAfford
                                ? 'war3-btn-primary'
                                : 'bg-[#1e1714] text-[#7a6858] border border-[#382a20] cursor-not-allowed'
                          }`}
                        >
                          {nextCost === null ? (
                            '满级'
                          ) : (
                            <>
                              <span>{level === 0 ? '学习' : '升级'}</span>
                              <span className="font-mono-num">{nextCost}G</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ARTIFACT_ORDER.map((aid) => {
                  const def = ARTIFACTS[aid];
                  const stacks = player.artifacts[aid] || 0;
                  const maxed = stacks >= def.maxStacks;
                  const canAfford = !maxed && player.gold >= def.cost;

                  return (
                    <div
                      key={aid}
                      className="bg-[#18120f] border border-[#473425] rounded-md p-3.5 flex flex-col justify-between gap-2.5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded bg-[#231a15] border border-[#735438] flex items-center justify-center shrink-0">
                          <ArtifactIconSvg artifactId={aid} className="w-6 h-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-[#f7e7cb] truncate">{def.name}</span>
                            <span className="font-mono-num text-xs text-[#d59d52] shrink-0">
                              {stacks}/{def.maxStacks}
                            </span>
                          </div>
                          <p className="text-xs text-[#cbb9a5] mt-1 leading-snug">{def.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end pt-2 border-t border-[#2e2219]">
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => onBuyArtifact(aid)}
                          className={`px-3.5 py-1.5 rounded text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer ${
                            maxed
                              ? 'bg-[#1f2922] text-[#86efac] border border-[#2f4f38] cursor-default'
                              : canAfford
                                ? 'war3-btn-primary'
                                : 'bg-[#1e1714] text-[#7a6858] border border-[#382a20] cursor-not-allowed'
                          }`}
                        >
                          {maxed ? (
                            '已满层'
                          ) : (
                            <>
                              <span>购买</span>
                              <span className="font-mono-num">{def.cost}G</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Tournament Standings */}
          <div className="lg:col-span-4 p-4 sm:p-5 bg-[#140f0d] flex flex-col gap-3">
            <h3 className="font-display text-base font-bold text-[#e8d5bb]">
              锦标赛积分榜
            </h3>
            <div className="flex flex-col divide-y divide-[#2d2118]">
              {summary?.standings.map((row, idx) => (
                <div
                  key={row.id}
                  className={`py-2.5 flex items-center justify-between gap-2 text-xs ${
                    row.isPlayer ? 'text-[#fde68a] font-semibold' : 'text-[#d4c3ae]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono-num w-5 text-[#9c846a]">#{idx + 1}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0 border border-black/60"
                      style={{ backgroundColor: row.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{row.name}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono-num shrink-0">
                    <span title="回合胜场">{row.roundWins}胜</span>
                    <span className="text-[#a9937d]" title="总击杀">{row.totalKills}杀</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-auto pt-3 text-[11px] text-[#9b846d] leading-relaxed border-t border-[#2d2118]">
              提示：AI 术士同样会在回合间使用金币升级法术与购买秘宝。合理升级瞬移与斥力护盾可大幅提升后期缩圈生存率。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

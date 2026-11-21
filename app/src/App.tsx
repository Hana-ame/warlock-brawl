/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { ShopOverlay } from './components/ShopOverlay';
import { GameOverModal, PauseModal } from './components/StatusModals';
import { TitleScreen } from './components/TitleScreen';
import { DEFAULT_MATCH_CONFIG } from './game/constants';
import { WarlockGameEngine } from './game/engine';
import { ArtifactId, HudSnapshot, MatchConfig, SpellId } from './game/types';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<WarlockGameEngine | null>(null);

  const [matchConfig, setMatchConfig] = useState<MatchConfig>({ ...DEFAULT_MATCH_CONFIG });
  const [hud, setHud] = useState<HudSnapshot | null>(null);

  // Mount Canvas & Simulation Engine ONCE; HUD updates never tear down the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new WarlockGameEngine(canvas, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.startNewMatch(DEFAULT_MATCH_CONFIG, false);
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handleChangeConfig = useCallback((partial: Partial<MatchConfig>) => {
    setMatchConfig((prev) => {
      const next = { ...prev, ...partial };
      engineRef.current?.updateMatchConfig(next);
      return next;
    });
  }, []);

  const handleStart = useCallback(() => {
    engineRef.current?.startNewMatch(matchConfig);
  }, [matchConfig]);

  const handleCastSpell = useCallback((spellId: SpellId) => {
    engineRef.current?.castSpellFromUi(spellId);
  }, []);

  const handleHoverSpell = useCallback((spellId: SpellId | null) => {
    engineRef.current?.setHoveredSpell(spellId);
  }, []);

  const handleToggleMute = useCallback(() => {
    engineRef.current?.toggleMute();
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.setPaused(true);
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.setPaused(false);
  }, []);

  const handleRestart = useCallback(() => {
    engineRef.current?.startNewMatch(matchConfig);
  }, [matchConfig]);

  const handleReturnTitle = useCallback(() => {
    engineRef.current?.returnToTitle();
  }, []);

  const handleBuySpell = useCallback((spellId: SpellId) => {
    engineRef.current?.playerBuySpell(spellId);
  }, []);

  const handleBuyArtifact = useCallback((artifactId: ArtifactId) => {
    engineRef.current?.playerBuyArtifact(artifactId);
  }, []);

  const handleNextRound = useCallback(() => {
    engineRef.current?.proceedToNextRound();
  }, []);

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#0c0908]">
      {/* Isolated Live Game Viewport */}
      <canvas
        ref={canvasRef}
        data-testid="arena-canvas"
        tabIndex={0}
        className="block w-full h-full outline-none cursor-crosshair"
      />

      {/* Title Screen */}
      {(!hud || hud.screen === 'title') && (
        <TitleScreen
          config={matchConfig}
          onChangeConfig={handleChangeConfig}
          onStart={handleStart}
        />
      )}

      {/* Active Gameplay HUD */}
      {hud && hud.screen !== 'title' && hud.phase !== 'shop' && (
        <GameHud
          hud={hud}
          onCastSpell={handleCastSpell}
          onHoverSpell={handleHoverSpell}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onRestart={handleRestart}
        />
      )}

      {/* Between-Round Warlock Shop */}
      {hud && hud.screen === 'playing' && hud.phase === 'shop' && (
        <ShopOverlay
          hud={hud}
          onBuySpell={handleBuySpell}
          onBuyArtifact={handleBuyArtifact}
          onNextRound={handleNextRound}
        />
      )}

      {/* Pause Modal */}
      {hud && hud.screen === 'paused' && (
        <PauseModal
          onResume={handleResume}
          onRestart={handleRestart}
          onReturnTitle={handleReturnTitle}
        />
      )}

      {/* Victory / Defeat Modal */}
      {hud && hud.screen === 'gameover' && (
        <GameOverModal
          hud={hud}
          onPlayAgain={handleRestart}
          onReturnTitle={handleReturnTitle}
        />
      )}
    </main>
  );
}

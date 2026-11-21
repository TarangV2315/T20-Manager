import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AndroidAppModal } from './components/AndroidAppModal';
import { MatchCenter } from './components/MatchCenter';
import { MobileBottomNav } from './components/MobileBottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PlayerModal } from './components/PlayerModal';
import { SquadManager } from './components/SquadManager';
import { TitleScreen } from './components/TitleScreen';
import { TopNav, AppTab } from './components/TopNav';
import { TournamentView } from './components/TournamentView';
import { usePWAInstall } from './hooks/usePWAInstall';
import { CITY_LIST } from './engine/cities';
import {
  applyManagerTacticalPlan,
  BallEventLabel,
  beginMatchStartCheckpoint,
  createMatchState,
  getBallEventLabel,
  selectBestXI,
  SIM_KEY_EVENT_PAUSE_MS,
  simulateNextBall,
  validateMatchdayXI,
} from './engine/matchEngine';
import { generatePlayerPool } from './engine/playerGenerator';
import { assignInitialSeasonSquads } from './engine/squadSetup';
import {
  SaveGameSummary,
  clearSavedGame,
  getSaveGameSummary,
  loadGameState,
  saveGameState,
} from './engine/storage';
import {
  advancePlayoffFixtures,
  applyCompletedMatchToFixture,
  applyRoundFitnessAndInjuries,
  computeStandings,
  extractMatchPerformances,
  generateLeagueSchedule,
  mergeMatchPerformancesIntoPlayers,
  simulateAiRoundFixtures,
} from './engine/tournament';
import { getAllowedTabsForPhase, getProgressAction } from './engine/seasonPhase';
import {
  CityId,
  Fixture,
  FranchiseTeam,
  MatchState,
  Player,
  SeasonPhase,
  TradeLogEntry,
} from './engine/types';

function createFreshSeasonData(cityId: CityId): {
  players: Player[];
  teams: FranchiseTeam[];
  fixtures: Fixture[];
} {
  const pool = generatePlayerPool(202611);
  const { teams, players } = assignInitialSeasonSquads(cityId, pool);
  const fixtures = generateLeagueSchedule(CITY_LIST.map((c) => c.id));
  return { players, teams, fixtures };
}

export default function App() {
  const [screenMode, setScreenMode] = useState<'title' | 'playing'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'playing';
    }
    return 'title';
  });

  const [selectedCityId, setSelectedCityId] = useState<CityId>('mumbai');
  const [seasonPhase, setSeasonPhase] = useState<SeasonPhase>('SEASON_PREP');
  const [activeTab, setActiveTab] = useState<AppTab>('SQUAD');

  const initialSeason = useMemo(() => createFreshSeasonData('mumbai'), []);
  const [players, setPlayers] = useState<Player[]>(initialSeason.players);
  const [teams, setTeams] = useState<FranchiseTeam[]>(initialSeason.teams);
  const [fixtures, setFixtures] = useState<Fixture[]>(initialSeason.fixtures);
  const [activeMatch, setActiveMatch] = useState<MatchState | null>(null);
  const [championId, setChampionId] = useState<CityId | null>(null);
  const [inspectedPlayerId, setInspectedPlayerId] = useState<string | null>(null);
  const [tradeHistory, setTradeHistory] = useState<TradeLogEntry[]>([]);

  const [savedGameSummary, setSavedGameSummary] = useState<SaveGameSummary | null>(() =>
    getSaveGameSummary()
  );
  const [justSaved, setJustSaved] = useState(false);
  const [showAndroidModal, setShowAndroidModal] = useState(false);
  const { canNativeInstall, isInstalled, isPrompting, triggerNativeInstall } = usePWAInstall();

  const [simMode, setSimMode] = useState<'IDLE' | 'OVER' | 'CHECKPOINT'>('IDLE');
  const [simPauseEvent, setSimPauseEvent] = useState<{
    eventLabel: BallEventLabel;
    commentary: string;
  } | null>(null);

  const simTimerRef = useRef<number | null>(null);
  const simModeRef = useRef<'IDLE' | 'OVER' | 'CHECKPOINT'>('IDLE');
  const simOverStartRef = useRef<number>(0);
  const activeMatchRef = useRef<MatchState | null>(activeMatch);
  activeMatchRef.current = activeMatch;

  useEffect(() => {
    document.body.dataset.state = championId
      ? 'gameover'
      : screenMode === 'title'
      ? 'title'
      : 'playing';
  }, [screenMode, championId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [screenMode, activeTab]);

  useEffect(() => {
    if (!justSaved) return;
    const timer = window.setTimeout(() => setJustSaved(false), 2500);
    return () => window.clearTimeout(timer);
  }, [justSaved]);

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const inspectedPlayer = useMemo(
    () => (inspectedPlayerId ? playerMap.get(inspectedPlayerId) ?? null : null),
    [inspectedPlayerId, playerMap]
  );
  const userTeam = useMemo(
    () => teams.find((t) => t.isUser) ?? teams[0],
    [teams]
  );

  const standings = useMemo(
    () => computeStandings(teams, fixtures),
    [teams, fixtures]
  );

  const nextUserFixture = useMemo(() => {
    return (
      fixtures.find(
        (f) => !f.completed && (f.homeTeamId === userTeam.id || f.awayTeamId === userTeam.id)
      ) ?? null
    );
  }, [fixtures, userTeam.id]);

  const teamsMap = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  );

  const teamsMapRef = useRef(teamsMap);
  teamsMapRef.current = teamsMap;
  const playerMapRef = useRef(playerMap);
  playerMapRef.current = playerMap;

  const stopActiveSim = useCallback(() => {
    if (simTimerRef.current !== null) {
      window.clearTimeout(simTimerRef.current);
      simTimerRef.current = null;
    }
    simModeRef.current = 'IDLE';
    setSimMode('IDLE');
    setSimPauseEvent(null);
  }, []);

  useEffect(() => {
    return () => {
      if (simTimerRef.current !== null) {
        window.clearTimeout(simTimerRef.current);
        simTimerRef.current = null;
      }
    };
  }, []);

  const handleStartNewGame = useCallback(() => {
    stopActiveSim();
    const fresh = createFreshSeasonData(selectedCityId);
    setPlayers(fresh.players);
    setTeams(fresh.teams);
    setFixtures(fresh.fixtures);
    setActiveMatch(null);
    setChampionId(null);
    setInspectedPlayerId(null);
    setTradeHistory([]);
    setSeasonPhase('SEASON_PREP');
    setActiveTab('SQUAD');
    setJustSaved(false);
    setScreenMode('playing');
  }, [selectedCityId, stopActiveSim]);

  const handleSaveGame = useCallback(() => {
    const res = saveGameState({
      selectedCityId,
      seasonPhase,
      activeTab,
      players,
      teams,
      fixtures,
      activeMatch,
      championId,
      tradeHistory,
    });
    if (res.ok) {
      setSavedGameSummary(res.summary);
      setJustSaved(true);
    }
  }, [
    selectedCityId,
    seasonPhase,
    activeTab,
    players,
    teams,
    fixtures,
    activeMatch,
    championId,
    tradeHistory,
  ]);

  const handleResumeSavedGame = useCallback(() => {
    stopActiveSim();
    const saved = loadGameState();
    if (!saved) {
      setSavedGameSummary(null);
      return;
    }
    setSelectedCityId(saved.selectedCityId);
    setSeasonPhase(saved.seasonPhase);
    setActiveTab(saved.activeTab === 'TRADE' ? 'SQUAD' : saved.activeTab);
    setPlayers(saved.players);
    setTeams(saved.teams);
    setFixtures(saved.fixtures);
    setActiveMatch(saved.activeMatch);
    setChampionId(saved.championId);
    setTradeHistory(saved.tradeHistory);
    setInspectedPlayerId(null);
    setJustSaved(false);
    setScreenMode('playing');
  }, [stopActiveSim]);

  const handleDeleteSavedGame = useCallback(() => {
    clearSavedGame();
    setSavedGameSummary(null);
  }, []);

  const handleReturnToWelcome = useCallback(() => {
    stopActiveSim();
    setSavedGameSummary(getSaveGameSummary());
    setInspectedPlayerId(null);
    setScreenMode('title');
  }, [stopActiveSim]);

  const handleTogglePlayerInXI = (playerId: string) => {
    const targetPlayer = playerMap.get(playerId);
    setTeams((prev) =>
      prev.map((t) => {
        if (!t.isUser) return t;
        const exists = t.selectedXIIds.includes(playerId);
        if (!exists && targetPlayer && targetPlayer.injuredMatchesRemaining > 0) {
          return t;
        }
        const nextXI = exists
          ? t.selectedXIIds.filter((id) => id !== playerId)
          : t.selectedXIIds.length < 11
          ? [...t.selectedXIIds, playerId]
          : t.selectedXIIds;
        return {
          ...t,
          selectedXIIds: nextXI,
          captainId: nextXI.includes(t.captainId ?? '') ? t.captainId : nextXI[0] ?? null,
          wicketkeeperId: nextXI.includes(t.wicketkeeperId ?? '')
            ? t.wicketkeeperId
            : nextXI[0] ?? null,
        };
      })
    );
  };

  const handleSetCaptain = (playerId: string) => {
    setTeams((prev) => prev.map((t) => (t.isUser ? { ...t, captainId: playerId } : t)));
  };

  const handleSetWicketkeeper = (playerId: string) => {
    setTeams((prev) => prev.map((t) => (t.isUser ? { ...t, wicketkeeperId: playerId } : t)));
  };

  const handleAutoPickXI = () => {
    const venue = nextUserFixture?.venueCityId ?? userTeam.id;
    setTeams((prev) =>
      prev.map((t) => {
        if (!t.isUser) return t;
        const best = selectBestXI(t, playerMap, venue);
        return {
          ...t,
          selectedXIIds: best.xiIds,
          captainId: best.captainId,
          wicketkeeperId: best.wicketkeeperId,
        };
      })
    );
  };

  const handleStartNextMatch = (fixture: Fixture) => {
    if (seasonPhase !== 'PRE_GAMEWEEK') return;
    const val = validateMatchdayXI(userTeam.selectedXIIds, playerMap);
    let currentTeams = teams;
    if (!val.isValid) {
      const best = selectBestXI(userTeam, playerMap, fixture.venueCityId);
      currentTeams = teams.map((t) =>
        t.isUser
          ? {
              ...t,
              selectedXIIds: best.xiIds,
              captainId: best.captainId,
              wicketkeeperId: best.wicketkeeperId,
            }
          : t
      );
      setTeams(currentTeams);
    }

    const readyHome = currentTeams.find((t) => t.id === fixture.homeTeamId)!;
    const readyAway = currentTeams.find((t) => t.id === fixture.awayTeamId)!;
    const homeReadyWithXI = readyHome.isUser
      ? readyHome
      : {
          ...readyHome,
          ...(() => {
            const b = selectBestXI(readyHome, playerMap, fixture.venueCityId);
            return { selectedXIIds: b.xiIds, captainId: b.captainId, wicketkeeperId: b.wicketkeeperId };
          })(),
        };
    const awayReadyWithXI = readyAway.isUser
      ? readyAway
      : {
          ...readyAway,
          ...(() => {
            const b = selectBestXI(readyAway, playerMap, fixture.venueCityId);
            return { selectedXIIds: b.xiIds, captainId: b.captainId, wicketkeeperId: b.wicketkeeperId };
          })(),
        };

    const newMatch = createMatchState(
      fixture,
      homeReadyWithXI,
      awayReadyWithXI,
      playerMap,
      Math.random,
      fixtures
    );
    setActiveMatch(newMatch);
    setSeasonPhase('MATCH_LIVE');
    setActiveTab('MATCH');
  };

  const handleBeginMatchCheckpoint = () => {
    stopActiveSim();
    setActiveMatch((prev) => (prev ? beginMatchStartCheckpoint(prev) : null));
  };

  const handleSubmitTacticalPlan = (planText: string) => {
    stopActiveSim();
    setActiveMatch((prev) =>
      prev ? applyManagerTacticalPlan(prev, planText, userTeam, playerMap) : null
    );
  };

  const runNextSimStep = useCallback(() => {
    if (simModeRef.current === 'IDLE') return;
    const prev = activeMatchRef.current;
    if (!prev || prev.phase !== 'LIVE') {
      stopActiveSim();
      return;
    }

    const next = simulateNextBall(prev, teamsMapRef.current, playerMapRef.current);
    activeMatchRef.current = next;
    setActiveMatch(next);

    if (next.phase === 'COMPLETED') {
      stopActiveSim();
      return;
    }

    const latestBall = next.commentaryFeed[0];
    const eventLabel = latestBall ? getBallEventLabel(latestBall) : null;
    const nextInn = next.currentInnings === 1 ? next.innings1 : next.innings2;
    const finishedOver =
      simModeRef.current === 'OVER' &&
      Boolean(nextInn && Math.floor(nextInn.ballsCompleted / 6) > simOverStartRef.current);
    const reachedStopState = next.phase !== 'LIVE' || finishedOver;

    if (eventLabel && latestBall) {
      setSimPauseEvent({
        eventLabel,
        commentary: latestBall.commentary,
      });
      simTimerRef.current = window.setTimeout(() => {
        simTimerRef.current = null;
        setSimPauseEvent(null);
        if (reachedStopState) {
          stopActiveSim();
        } else {
          runNextSimStep();
        }
      }, SIM_KEY_EVENT_PAUSE_MS);
      return;
    }

    setSimPauseEvent(null);
    if (reachedStopState) {
      stopActiveSim();
      return;
    }

    simTimerRef.current = window.setTimeout(() => {
      simTimerRef.current = null;
      runNextSimStep();
    }, 45);
  }, [stopActiveSim]);

  const handlePlayBall = () => {
    stopActiveSim();
    setActiveMatch((prev) => (prev ? simulateNextBall(prev, teamsMap, playerMap) : null));
  };

  const handleSimOver = () => {
    stopActiveSim();
    const cur = activeMatchRef.current;
    if (!cur || cur.phase !== 'LIVE') return;
    const inn = cur.currentInnings === 1 ? cur.innings1 : cur.innings2;
    simOverStartRef.current = inn ? Math.floor(inn.ballsCompleted / 6) : 0;
    simModeRef.current = 'OVER';
    setSimMode('OVER');
    runNextSimStep();
  };

  const handleSimToCheckpoint = () => {
    stopActiveSim();
    const cur = activeMatchRef.current;
    if (!cur || cur.phase !== 'LIVE') return;
    simOverStartRef.current = 0;
    simModeRef.current = 'CHECKPOINT';
    setSimMode('CHECKPOINT');
    runNextSimStep();
  };

  const handleCompleteMatchReturn = () => {
    stopActiveSim();
    if (!activeMatch || activeMatch.phase !== 'COMPLETED') return;
    const playedFixture = fixtures.find((f) => f.id === activeMatch.fixtureId);
    if (!playedFixture) return;

    const perfBatches = [extractMatchPerformances(playedFixture, activeMatch)];

    let updatedFixtures = fixtures.map((f) =>
      f.id === activeMatch.fixtureId ? applyCompletedMatchToFixture(f, activeMatch) : f
    );

    if (playedFixture.stage === 'LEAGUE') {
      const aiRound = simulateAiRoundFixtures(
        updatedFixtures,
        playedFixture.roundNumber,
        userTeam.id,
        teams,
        playerMap
      );
      updatedFixtures = aiRound.fixtures;
      perfBatches.push(...aiRound.perfBatches);
    }

    const updatedStandings = computeStandings(teams, updatedFixtures);
    const playoffAdvance = advancePlayoffFixtures(
      updatedFixtures,
      updatedStandings,
      teams,
      userTeam.id,
      playerMap
    );
    perfBatches.push(...playoffAdvance.perfBatches);

    const updatedPlayers = applyRoundFitnessAndInjuries(
      mergeMatchPerformancesIntoPlayers(players, perfBatches),
      perfBatches
    );
    const updatedPlayerMap = new Map(updatedPlayers.map((p) => [p.id, p]));

    setPlayers(updatedPlayers);
    setTeams((prevTeams) =>
      prevTeams.map((t) => {
        const fitXI = t.selectedXIIds.filter(
          (id) => (updatedPlayerMap.get(id)?.injuredMatchesRemaining ?? 0) === 0
        );
        if (fitXI.length === t.selectedXIIds.length) return t;
        return {
          ...t,
          selectedXIIds: fitXI,
          captainId: fitXI.includes(t.captainId ?? '') ? t.captainId : fitXI[0] ?? null,
          wicketkeeperId: fitXI.includes(t.wicketkeeperId ?? '')
            ? t.wicketkeeperId
            : fitXI[0] ?? null,
        };
      })
    );
    setFixtures(playoffAdvance.fixtures);
    if (playoffAdvance.championId) {
      setChampionId(playoffAdvance.championId);
    }
    setActiveMatch(null);
    setSeasonPhase('POST_GAME');
    setActiveTab('STANDINGS');
  };

  const resolveRemainingPlayoffs = () => {
    let curFixtures = fixtures;
    let curChampion = championId;
    const allBatches: ReturnType<typeof extractMatchPerformances>[] = [];
    for (let step = 0; step < 4 && !curChampion; step++) {
      const curStandings = computeStandings(teams, curFixtures);
      const res = advancePlayoffFixtures(
        curFixtures,
        curStandings,
        teams,
        userTeam.id,
        playerMap
      );
      curFixtures = res.fixtures;
      allBatches.push(...res.perfBatches);
      if (res.championId) {
        curChampion = res.championId;
      }
    }
    if (allBatches.length > 0) {
      setPlayers((prev) =>
        applyRoundFitnessAndInjuries(mergeMatchPerformancesIntoPlayers(prev, allBatches), allBatches)
      );
    }
    setFixtures(curFixtures);
    if (curChampion) {
      setChampionId(curChampion);
    }
    setSeasonPhase('SEASON_END');
    setActiveTab('STANDINGS');
  };

  const progressAction = getProgressAction(seasonPhase, {
    matchCompleted: activeMatch?.phase === 'COMPLETED',
    nextUserFixture,
    championId,
  });

  const handleProgress = () => {
    if (progressAction.disabled) return;
    switch (seasonPhase) {
      case 'SEASON_PREP': {
        setSeasonPhase('PRE_GAMEWEEK');
        setActiveTab('STANDINGS');
        break;
      }
      case 'PRE_GAMEWEEK': {
        if (nextUserFixture) {
          handleStartNextMatch(nextUserFixture);
        } else {
          resolveRemainingPlayoffs();
        }
        break;
      }
      case 'MATCH_LIVE': {
        if (activeMatch?.phase === 'COMPLETED') {
          handleCompleteMatchReturn();
        }
        break;
      }
      case 'POST_GAME': {
        if (championId) {
          setSeasonPhase('SEASON_END');
          setActiveTab('STANDINGS');
        } else if (nextUserFixture) {
          setSeasonPhase('PRE_GAMEWEEK');
          setActiveTab('STANDINGS');
        } else {
          resolveRemainingPlayoffs();
        }
        break;
      }
      case 'SEASON_END': {
        handleStartNewGame();
        break;
      }
    }
  };

  const handleSelectTab = (tab: AppTab) => {
    const allowed = getAllowedTabsForPhase(seasonPhase);
    if (!allowed[tab]) return;
    setActiveTab(tab);
  };

  if (screenMode === 'title') {
    return (
      <>
        <TitleScreen
          selectedCityId={selectedCityId}
          savedGameSummary={savedGameSummary}
          onSelectCity={setSelectedCityId}
          onStartNewGame={handleStartNewGame}
          onResumeSavedGame={handleResumeSavedGame}
          onDeleteSavedGame={handleDeleteSavedGame}
          showInstallButton={!isInstalled}
          onOpenInstall={() => setShowAndroidModal(true)}
        />
        <OfflineIndicator />
        <AndroidAppModal
          isOpen={showAndroidModal}
          isInstalled={isInstalled}
          canNativeInstall={canNativeInstall}
          isPrompting={isPrompting}
          onNativeInstall={triggerNativeInstall}
          onClose={() => setShowAndroidModal(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        seasonPhase={seasonPhase}
        progressAction={progressAction}
        onProgress={handleProgress}
        userTeam={userTeam}
        justSaved={justSaved}
        onSaveGame={handleSaveGame}
        onReturnToWelcome={handleReturnToWelcome}
        showInstallButton={!isInstalled}
        onOpenInstall={() => setShowAndroidModal(true)}
      />

      <main className="pb-24 md:pb-8">
        {activeTab === 'SQUAD' && (
          <SquadManager
            userTeam={userTeam}
            players={players}
            nextVenueCityId={nextUserFixture?.venueCityId ?? userTeam.id}
            canEnterMatchCenter={seasonPhase === 'PRE_GAMEWEEK' && Boolean(nextUserFixture)}
            onTogglePlayerInXI={handleTogglePlayerInXI}
            onSetCaptain={handleSetCaptain}
            onSetWicketkeeper={handleSetWicketkeeper}
            onAutoPickXI={handleAutoPickXI}
            onInspectPlayer={(p) => setInspectedPlayerId(p.id)}
            onProceedToMatch={() => {
              if (seasonPhase === 'PRE_GAMEWEEK' && nextUserFixture) {
                handleStartNextMatch(nextUserFixture);
              }
            }}
          />
        )}

        {activeTab === 'STANDINGS' && (
          <TournamentView
            teams={teams}
            players={players}
            standings={standings}
            fixtures={fixtures}
            userTeamId={userTeam.id}
            nextUserFixture={nextUserFixture}
            championId={championId}
            canLaunchMatch={seasonPhase === 'PRE_GAMEWEEK'}
            onStartNextMatch={handleStartNextMatch}
            onInspectPlayer={(p) => setInspectedPlayerId(p.id)}
          />
        )}

        {activeTab === 'MATCH' && (
          <MatchCenter
            match={activeMatch}
            teams={teams}
            players={players}
            userTeam={userTeam}
            simMode={simMode}
            simPauseEvent={simPauseEvent}
            onStopSim={stopActiveSim}
            onBeginMatchCheckpoint={handleBeginMatchCheckpoint}
            onSubmitTacticalPlan={handleSubmitTacticalPlan}
            onPlayBall={handlePlayBall}
            onSimOver={handleSimOver}
            onSimToCheckpoint={handleSimToCheckpoint}
            onCompleteMatchReturn={handleCompleteMatchReturn}
            onInspectPlayer={(p) => setInspectedPlayerId(p.id)}
          />
        )}
      </main>

      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        seasonPhase={seasonPhase}
        progressAction={progressAction}
        onProgress={handleProgress}
      />

      <OfflineIndicator />

      <AndroidAppModal
        isOpen={showAndroidModal}
        isInstalled={isInstalled}
        canNativeInstall={canNativeInstall}
        isPrompting={isPrompting}
        onNativeInstall={triggerNativeInstall}
        onClose={() => setShowAndroidModal(false)}
      />

      <PlayerModal
        player={inspectedPlayer}
        isScouted={true}
        onClose={() => setInspectedPlayerId(null)}
      />
    </div>
  );
}

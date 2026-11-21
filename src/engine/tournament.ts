import { pickMatchWeather, PITCH_PROFILES } from './cities';
import { formatOvers, selectBestXI, simulateQuickMatch } from './matchEngine';
import {
  CityId,
  Fixture,
  FranchiseTeam,
  MatchState,
  Player,
  PlayerMatchPerformance,
  StandingsRow,
} from './types';

export interface BattingLeaderRow {
  playerId: string;
  playerName: string;
  teamId: CityId | null;
  teamShortCode: string;
  isUserTeam: boolean;
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  notOuts: number;
  highScore: number;
  highScoreNotOut: boolean;
  average: number | null;
  strikeRate: number;
  fifties: number;
  hundreds: number;
  fours: number;
  sixes: number;
}

export interface BowlingLeaderRow {
  playerId: string;
  playerName: string;
  teamId: CityId | null;
  teamShortCode: string;
  isUserTeam: boolean;
  matches: number;
  innings: number;
  wickets: number;
  ballsBowled: number;
  oversText: string;
  runsConceded: number;
  economy: number;
  average: number | null;
  bestWickets: number;
  bestRunsConceded: number;
  bestFigures: string;
  fourPlusWickets: number;
}

export function computeSeasonLeaderboards(
  players: Player[],
  teams: FranchiseTeam[],
  limit = 10
): {
  topRunScorers: BattingLeaderRow[];
  topWicketTakers: BowlingLeaderRow[];
} {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const battingRows: BattingLeaderRow[] = [];
  const bowlingRows: BowlingLeaderRow[] = [];

  for (const player of players) {
    if (!player.careerHistory || player.careerHistory.length === 0) continue;

    const team = player.soldToTeamId ? teamMap.get(player.soldToTeamId) : undefined;
    const teamId = player.soldToTeamId;
    const teamShortCode = team?.shortCode ?? 'FA';
    const isUserTeam = Boolean(team?.isUser);
    const matches = player.careerHistory.length;

    let batInnings = 0;
    let totalRuns = 0;
    let totalBalls = 0;
    let notOuts = 0;
    let dismissals = 0;
    let highScore = 0;
    let highScoreNotOut = false;
    let fifties = 0;
    let hundreds = 0;
    let fours = 0;
    let sixes = 0;

    let bowlInnings = 0;
    let totalWickets = 0;
    let totalBallsBowled = 0;
    let totalRunsConceded = 0;
    let bestWickets = -1;
    let bestRunsConceded = Infinity;
    let fourPlusWickets = 0;

    for (const perf of player.careerHistory) {
      if (perf.batting.didBat) {
        batInnings += 1;
        totalRuns += perf.batting.runs;
        totalBalls += perf.batting.balls;
        fours += perf.batting.fours;
        sixes += perf.batting.sixes;
        if (perf.batting.isOut) {
          dismissals += 1;
        } else {
          notOuts += 1;
        }
        if (
          perf.batting.runs > highScore ||
          (perf.batting.runs === highScore && !perf.batting.isOut && !highScoreNotOut)
        ) {
          highScore = perf.batting.runs;
          highScoreNotOut = !perf.batting.isOut;
        }
        if (perf.batting.runs >= 100) {
          hundreds += 1;
        } else if (perf.batting.runs >= 50) {
          fifties += 1;
        }
      }

      if (perf.bowling.ballsBowled > 0) {
        bowlInnings += 1;
        totalWickets += perf.bowling.wickets;
        totalBallsBowled += perf.bowling.ballsBowled;
        totalRunsConceded += perf.bowling.runsConceded;
        if (perf.bowling.wickets >= 4) {
          fourPlusWickets += 1;
        }
        if (
          perf.bowling.wickets > bestWickets ||
          (perf.bowling.wickets === bestWickets && perf.bowling.runsConceded < bestRunsConceded)
        ) {
          bestWickets = perf.bowling.wickets;
          bestRunsConceded = perf.bowling.runsConceded;
        }
      }
    }

    if (batInnings > 0) {
      battingRows.push({
        playerId: player.id,
        playerName: player.name,
        teamId,
        teamShortCode,
        isUserTeam,
        matches,
        innings: batInnings,
        runs: totalRuns,
        balls: totalBalls,
        notOuts,
        highScore,
        highScoreNotOut,
        average: dismissals > 0 ? Number((totalRuns / dismissals).toFixed(2)) : null,
        strikeRate: totalBalls > 0 ? Number(((totalRuns / totalBalls) * 100).toFixed(1)) : 0,
        fifties,
        hundreds,
        fours,
        sixes,
      });
    }

    if (bowlInnings > 0) {
      const safeBestWickets = Math.max(0, bestWickets);
      const safeBestRuns = bestRunsConceded === Infinity ? 0 : bestRunsConceded;
      bowlingRows.push({
        playerId: player.id,
        playerName: player.name,
        teamId,
        teamShortCode,
        isUserTeam,
        matches,
        innings: bowlInnings,
        wickets: totalWickets,
        ballsBowled: totalBallsBowled,
        oversText: formatOvers(totalBallsBowled),
        runsConceded: totalRunsConceded,
        economy:
          totalBallsBowled > 0
            ? Number((totalRunsConceded / (totalBallsBowled / 6)).toFixed(2))
            : 0,
        average: totalWickets > 0 ? Number((totalRunsConceded / totalWickets).toFixed(2)) : null,
        bestWickets: safeBestWickets,
        bestRunsConceded: safeBestRuns,
        bestFigures: `${safeBestWickets}/${safeBestRuns}`,
        fourPlusWickets,
      });
    }
  }

  battingRows.sort(
    (a, b) =>
      b.runs - a.runs ||
      b.strikeRate - a.strikeRate ||
      b.highScore - a.highScore ||
      a.playerName.localeCompare(b.playerName)
  );

  bowlingRows.sort(
    (a, b) =>
      b.wickets - a.wickets ||
      a.economy - b.economy ||
      a.runsConceded - b.runsConceded ||
      a.playerName.localeCompare(b.playerName)
  );

  return {
    topRunScorers: limit > 0 ? battingRows.slice(0, limit) : battingRows,
    topWicketTakers: limit > 0 ? bowlingRows.slice(0, limit) : bowlingRows,
  };
}

export function generateLeagueSchedule(teamIds: CityId[]): Fixture[] {
  // Circle method single round-robin for 8 teams = 7 rounds, 4 matches per round = 28 matches
  const ids = [...teamIds];
  const n = ids.length;
  const fixtures: Fixture[] = [];

  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const t1 = ids[i];
      const t2 = ids[n - 1 - i];
      const homeTeamId = (round + i) % 2 === 0 ? t1 : t2;
      const awayTeamId = homeTeamId === t1 ? t2 : t1;
      fixtures.push({
        id: `league-r${round + 1}-m${i + 1}`,
        roundNumber: round + 1,
        stage: 'LEAGUE',
        homeTeamId,
        awayTeamId,
        venueCityId: homeTeamId,
        weather: pickMatchWeather(homeTeamId, round + 1, i),
        completed: false,
        winnerId: null,
        resultText: '',
      });
    }
    // Rotate all except index 0
    const last = ids.pop()!;
    ids.splice(1, 0, last);
  }

  return fixtures;
}

export function computeStandings(
  teams: FranchiseTeam[],
  fixtures: Fixture[]
): StandingsRow[] {
  const map = new Map<CityId, StandingsRow>();
  for (const t of teams) {
    map.set(t.id, {
      teamId: t.id,
      played: 0,
      won: 0,
      lost: 0,
      points: 0,
      runsFor: 0,
      oversFacedDecimal: 0,
      runsAgainst: 0,
      oversBowledDecimal: 0,
      nrr: 0,
    });
  }

  for (const f of fixtures) {
    if (!f.completed || f.stage !== 'LEAGUE' || !f.winnerId) continue;
    const home = map.get(f.homeTeamId);
    const away = map.get(f.awayTeamId);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;

    if (f.winnerId === f.homeTeamId) {
      home.won += 1;
      home.points += 2;
      away.lost += 1;
    } else {
      away.won += 1;
      away.points += 2;
      home.lost += 1;
    }

    const homeRuns = f.homeRuns ?? 0;
    const awayRuns = f.awayRuns ?? 0;
    const homeOv = (f.homeBallsFaced ?? 120) / 6;
    const awayOv = (f.awayBallsFaced ?? 120) / 6;

    home.runsFor += homeRuns;
    home.oversFacedDecimal += homeOv;
    home.runsAgainst += awayRuns;
    home.oversBowledDecimal += awayOv;

    away.runsFor += awayRuns;
    away.oversFacedDecimal += awayOv;
    away.runsAgainst += homeRuns;
    away.oversBowledDecimal += homeOv;
  }

  const rows = Array.from(map.values()).map((r) => {
    const forRate = r.oversFacedDecimal > 0 ? r.runsFor / r.oversFacedDecimal : 0;
    const againstRate = r.oversBowledDecimal > 0 ? r.runsAgainst / r.oversBowledDecimal : 0;
    return {
      ...r,
      nrr: Number((forRate - againstRate).toFixed(3)),
    };
  });

  rows.sort((a, b) => b.points - a.points || b.nrr - a.nrr || b.won - a.won);
  return rows;
}

export function applyCompletedMatchToFixture(
  fixture: Fixture,
  matchState: MatchState
): Fixture {
  const inn1 = matchState.innings1;
  const inn2 = matchState.innings2;
  const homeBattedFirst = inn1.battingTeamId === fixture.homeTeamId;

  const homeInn = homeBattedFirst ? inn1 : inn2;
  const awayInn = homeBattedFirst ? inn2 : inn1;

  // For NRR, all-out teams count as full 20 overs (120 balls)
  const effectiveBalls = (inn: typeof inn1 | null) => {
    if (!inn) return 120;
    return inn.wickets >= 10 ? 120 : Math.max(1, inn.ballsCompleted);
  };

  const fmtScore = (inn: typeof inn1 | null) =>
    inn ? `${inn.runs}/${inn.wickets} (${formatOvers(inn.ballsCompleted)})` : '-';

  return {
    ...fixture,
    completed: true,
    winnerId: matchState.winnerId,
    resultText: matchState.resultText,
    homeScoreText: fmtScore(homeInn),
    awayScoreText: fmtScore(awayInn),
    homeRuns: homeInn?.runs ?? 0,
    homeBallsFaced: effectiveBalls(homeInn),
    awayRuns: awayInn?.runs ?? 0,
    awayBallsFaced: effectiveBalls(awayInn),
  };
}

export function extractMatchPerformances(
  fixture: Fixture,
  matchState: MatchState
): Record<string, PlayerMatchPerformance> {
  const perfMap: Record<string, PlayerMatchPerformance> = {};
  const inningsList = [matchState.innings1, matchState.innings2].filter(
    (inn): inn is NonNullable<typeof inn> => Boolean(inn)
  );

  for (const inn of inningsList) {
    // Batting side performances
    for (const pid of inn.battingOrderIds) {
      const bat = inn.batterStats[pid];
      const oppId = inn.bowlingTeamId;
      const didBat = Boolean(
        bat &&
          (bat.balls > 0 ||
            bat.isOut ||
            inn.strikerId === pid ||
            inn.nonStrikerId === pid)
      );
      const existing = perfMap[pid];
      perfMap[pid] = {
        fixtureId: fixture.id,
        roundNumber: fixture.roundNumber,
        stage: fixture.stage,
        opponentTeamId: oppId,
        opponentShortCode: PITCH_PROFILES[oppId].shortCode,
        venueCityId: fixture.venueCityId,
        won: matchState.winnerId === inn.battingTeamId,
        batting: {
          didBat,
          runs: bat?.runs ?? 0,
          balls: bat?.balls ?? 0,
          fours: bat?.fours ?? 0,
          sixes: bat?.sixes ?? 0,
          isOut: bat?.isOut ?? false,
          dismissalText: bat?.dismissalText ?? 'not out',
        },
        bowling: existing?.bowling ?? {
          ballsBowled: 0,
          runsConceded: 0,
          wickets: 0,
          dots: 0,
        },
      };
    }

    // Bowling side performances
    for (const [pid, bowl] of Object.entries(inn.bowlerStats)) {
      const oppId = inn.battingTeamId;
      const existing = perfMap[pid];
      perfMap[pid] = {
        fixtureId: fixture.id,
        roundNumber: fixture.roundNumber,
        stage: fixture.stage,
        opponentTeamId: oppId,
        opponentShortCode: PITCH_PROFILES[oppId].shortCode,
        venueCityId: fixture.venueCityId,
        won: matchState.winnerId === inn.bowlingTeamId,
        batting: existing?.batting ?? {
          didBat: false,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          isOut: false,
          dismissalText: 'did not bat',
        },
        bowling: {
          ballsBowled: bowl.ballsBowled,
          runsConceded: bowl.runsConceded,
          wickets: bowl.wickets,
          dots: bowl.dots,
        },
      };
    }
  }

  return perfMap;
}

export function mergeMatchPerformancesIntoPlayers(
  players: Player[],
  perfBatches: Record<string, PlayerMatchPerformance>[]
): Player[] {
  if (perfBatches.length === 0) return players;

  const updatesByPlayer = new Map<string, PlayerMatchPerformance[]>();
  for (const batch of perfBatches) {
    for (const [pid, perf] of Object.entries(batch)) {
      const list = updatesByPlayer.get(pid) ?? [];
      list.push(perf);
      updatesByPlayer.set(pid, list);
    }
  }

  return players.map((p) => {
    const additions = updatesByPlayer.get(p.id);
    if (!additions || additions.length === 0) return p;
    const seen = new Set(p.careerHistory.map((h) => h.fixtureId));
    const uniqueNew = additions.filter((a) => !seen.has(a.fixtureId));
    if (uniqueNew.length === 0) return p;
    return {
      ...p,
      careerHistory: [...p.careerHistory, ...uniqueNew],
    };
  });
}

export function applyRoundFitnessAndInjuries(
  players: Player[],
  perfBatches: Record<string, PlayerMatchPerformance>[],
  rng: () => number = Math.random
): Player[] {
  const perfByPlayer = new Map<string, PlayerMatchPerformance[]>();
  for (const batch of perfBatches) {
    for (const [pid, perf] of Object.entries(batch)) {
      const list = perfByPlayer.get(pid) ?? [];
      list.push(perf);
      perfByPlayer.set(pid, list);
    }
  }

  // First pass: handle existing injury recovery and rested recovery, and track healthy depth per team
  const fitCountByTeam = new Map<CityId, number>();
  const fitU19CountByTeam = new Map<CityId, number>();

  const interim = players.map((p) => {
    if (p.injuredMatchesRemaining > 0) {
      const nextInj = p.injuredMatchesRemaining - 1;
      const nextFatigue = Math.max(0, p.fatigue - 25);
      return { ...p, injuredMatchesRemaining: nextInj, fatigue: nextFatigue };
    }

    const perfs = perfByPlayer.get(p.id);
    if (!perfs || perfs.length === 0) {
      // Rested player recovers fatigue if signed to a franchise
      if (p.soldToTeamId !== null && p.fatigue > 0) {
        const recovery = Math.round(18 + p.physical.stamina * 0.14);
        return { ...p, fatigue: Math.max(0, p.fatigue - recovery) };
      }
      return p;
    }

    // Active player accumulates fatigue from batting & bowling workload
    let totalGain = 0;
    const staminaFactor = 1.25 - p.physical.stamina / 120;
    for (const perf of perfs) {
      const batLoad = Math.min(18, Math.round(perf.batting.balls * 0.35));
      const bowlLoad = Math.min(20, Math.round(perf.bowling.ballsBowled * 0.8));
      totalGain += Math.max(8, Math.round((14 + batLoad + bowlLoad) * staminaFactor));
    }

    return {
      ...p,
      fatigue: Math.min(100, p.fatigue + totalGain),
    };
  });

  for (const p of interim) {
    if (p.soldToTeamId && p.injuredMatchesRemaining === 0) {
      fitCountByTeam.set(p.soldToTeamId, (fitCountByTeam.get(p.soldToTeamId) ?? 0) + 1);
      if (p.category === 'INDIAN_U19') {
        fitU19CountByTeam.set(p.soldToTeamId, (fitU19CountByTeam.get(p.soldToTeamId) ?? 0) + 1);
      }
    }
  }

  // Second pass: evaluate new match injuries while protecting minimum playable XI depth (11 fit, >=1 U19)
  return interim.map((p) => {
    if (p.injuredMatchesRemaining > 0 || !p.soldToTeamId) return p;
    const perfs = perfByPlayer.get(p.id);
    if (!perfs || perfs.length === 0) return p;

    const teamFit = fitCountByTeam.get(p.soldToTeamId) ?? 0;
    const teamFitU19 = fitU19CountByTeam.get(p.soldToTeamId) ?? 0;
    if (teamFit <= 11) return p;
    if (p.category === 'INDIAN_U19' && teamFitU19 <= 1) return p;

    const fatigueFactor = p.fatigue >= 60 ? (p.fatigue - 55) * 0.0025 : 0;
    const injuryProb = Math.max(
      0.008,
      ((p.physical.injuryProneness - 20) / 100) * 0.045 + fatigueFactor
    );

    if (rng() < injuryProb) {
      fitCountByTeam.set(p.soldToTeamId, teamFit - 1);
      if (p.category === 'INDIAN_U19') {
        fitU19CountByTeam.set(p.soldToTeamId, teamFitU19 - 1);
      }
      const duration = p.fatigue >= 75 || p.physical.injuryProneness >= 75 ? 2 : 1;
      return {
        ...p,
        injuredMatchesRemaining: duration,
      };
    }

    return p;
  });
}

export function simulateAiRoundFixtures(
  fixtures: Fixture[],
  roundNumber: number,
  userTeamId: CityId,
  teams: FranchiseTeam[],
  playerMap: Map<string, Player>
): { fixtures: Fixture[]; perfBatches: Record<string, PlayerMatchPerformance>[] } {
  const perfBatches: Record<string, PlayerMatchPerformance>[] = [];
  const nextFixtures = fixtures.map((f) => {
    if (f.completed || f.roundNumber !== roundNumber) return f;
    if (f.homeTeamId === userTeamId || f.awayTeamId === userTeamId) return f;

    const rawHome = teams.find((t) => t.id === f.homeTeamId)!;
    const rawAway = teams.find((t) => t.id === f.awayTeamId)!;

    const homeBest = selectBestXI(rawHome, playerMap, f.venueCityId);
    const awayBest = selectBestXI(rawAway, playerMap, f.venueCityId);

    const homeReady: FranchiseTeam = {
      ...rawHome,
      selectedXIIds: homeBest.xiIds,
      captainId: homeBest.captainId,
      wicketkeeperId: homeBest.wicketkeeperId,
    };
    const awayReady: FranchiseTeam = {
      ...rawAway,
      selectedXIIds: awayBest.xiIds,
      captainId: awayBest.captainId,
      wicketkeeperId: awayBest.wicketkeeperId,
    };

    const completedMatch = simulateQuickMatch(
      f,
      homeReady,
      awayReady,
      playerMap,
      Math.random,
      fixtures
    );
    perfBatches.push(extractMatchPerformances(f, completedMatch));
    return applyCompletedMatchToFixture(f, completedMatch);
  });

  return { fixtures: nextFixtures, perfBatches };
}

export function advancePlayoffFixtures(
  fixtures: Fixture[],
  standings: StandingsRow[],
  teams: FranchiseTeam[],
  userTeamId: CityId,
  playerMap: Map<string, Player>
): {
  fixtures: Fixture[];
  championId: CityId | null;
  perfBatches: Record<string, PlayerMatchPerformance>[];
} {
  const leagueDone = fixtures.filter((f) => f.stage === 'LEAGUE').every((f) => f.completed);
  if (!leagueDone) return { fixtures, championId: null, perfBatches: [] };

  let next = [...fixtures];
  const perfBatches: Record<string, PlayerMatchPerformance>[] = [];

  // Create Qualifier 1 and Eliminator once league finishes
  const hasQ1 = next.some((f) => f.stage === 'QUALIFIER_1');
  if (!hasQ1 && standings.length >= 4) {
    const [p1, p2, p3, p4] = standings;
    next.push(
      {
        id: 'playoff-q1',
        roundNumber: 8,
        stage: 'QUALIFIER_1',
        homeTeamId: p1.teamId,
        awayTeamId: p2.teamId,
        venueCityId: p1.teamId,
        weather: pickMatchWeather(p1.teamId, 8, 0),
        completed: false,
        winnerId: null,
        resultText: '',
      },
      {
        id: 'playoff-elim',
        roundNumber: 8,
        stage: 'ELIMINATOR',
        homeTeamId: p3.teamId,
        awayTeamId: p4.teamId,
        venueCityId: p3.teamId,
        weather: pickMatchWeather(p3.teamId, 8, 1),
        completed: false,
        winnerId: null,
        resultText: '',
      }
    );
  }

  // Simulate AI playoff games that don't involve user
  next = next.map((f) => {
    if (f.completed || f.stage === 'LEAGUE') return f;
    if (f.homeTeamId === userTeamId || f.awayTeamId === userTeamId) return f;

    const rawHome = teams.find((t) => t.id === f.homeTeamId)!;
    const rawAway = teams.find((t) => t.id === f.awayTeamId)!;
    const homeBest = selectBestXI(rawHome, playerMap, f.venueCityId);
    const awayBest = selectBestXI(rawAway, playerMap, f.venueCityId);
    const match = simulateQuickMatch(
      f,
      { ...rawHome, selectedXIIds: homeBest.xiIds, captainId: homeBest.captainId, wicketkeeperId: homeBest.wicketkeeperId },
      { ...rawAway, selectedXIIds: awayBest.xiIds, captainId: awayBest.captainId, wicketkeeperId: awayBest.wicketkeeperId },
      playerMap,
      Math.random,
      next
    );
    perfBatches.push(extractMatchPerformances(f, match));
    return applyCompletedMatchToFixture(f, match);
  });

  // Create Qualifier 2 if Q1 and Eliminator are complete
  const q1 = next.find((f) => f.stage === 'QUALIFIER_1');
  const elim = next.find((f) => f.stage === 'ELIMINATOR');
  const hasQ2 = next.some((f) => f.stage === 'QUALIFIER_2');
  if (q1?.completed && elim?.completed && !hasQ2 && q1.winnerId && elim.winnerId) {
    const q1Loser = q1.winnerId === q1.homeTeamId ? q1.awayTeamId : q1.homeTeamId;
    next.push({
      id: 'playoff-q2',
      roundNumber: 9,
      stage: 'QUALIFIER_2',
      homeTeamId: q1Loser,
      awayTeamId: elim.winnerId,
      venueCityId: 'mumbai',
      weather: pickMatchWeather('mumbai', 9, 0),
      completed: false,
      winnerId: null,
      resultText: '',
    });
  }

  // Re-sim Q2 if AI vs AI
  next = next.map((f) => {
    if (f.completed || f.stage !== 'QUALIFIER_2') return f;
    if (f.homeTeamId === userTeamId || f.awayTeamId === userTeamId) return f;
    const rawHome = teams.find((t) => t.id === f.homeTeamId)!;
    const rawAway = teams.find((t) => t.id === f.awayTeamId)!;
    const homeBest = selectBestXI(rawHome, playerMap, f.venueCityId);
    const awayBest = selectBestXI(rawAway, playerMap, f.venueCityId);
    const match = simulateQuickMatch(
      f,
      { ...rawHome, selectedXIIds: homeBest.xiIds, captainId: homeBest.captainId, wicketkeeperId: homeBest.wicketkeeperId },
      { ...rawAway, selectedXIIds: awayBest.xiIds, captainId: awayBest.captainId, wicketkeeperId: awayBest.wicketkeeperId },
      playerMap,
      Math.random,
      next
    );
    perfBatches.push(extractMatchPerformances(f, match));
    return applyCompletedMatchToFixture(f, match);
  });

  // Create Final if Q1 and Q2 are complete
  const q2 = next.find((f) => f.stage === 'QUALIFIER_2');
  const hasFinal = next.some((f) => f.stage === 'FINAL');
  if (q1?.completed && q2?.completed && !hasFinal && q1.winnerId && q2.winnerId) {
    next.push({
      id: 'playoff-final',
      roundNumber: 10,
      stage: 'FINAL',
      homeTeamId: q1.winnerId,
      awayTeamId: q2.winnerId,
      venueCityId: 'ahmedabad',
      weather: pickMatchWeather('ahmedabad', 10, 0),
      completed: false,
      winnerId: null,
      resultText: '',
    });
  }

  // Re-sim Final if AI vs AI
  next = next.map((f) => {
    if (f.completed || f.stage !== 'FINAL') return f;
    if (f.homeTeamId === userTeamId || f.awayTeamId === userTeamId) return f;
    const rawHome = teams.find((t) => t.id === f.homeTeamId)!;
    const rawAway = teams.find((t) => t.id === f.awayTeamId)!;
    const homeBest = selectBestXI(rawHome, playerMap, f.venueCityId);
    const awayBest = selectBestXI(rawAway, playerMap, f.venueCityId);
    const match = simulateQuickMatch(
      f,
      { ...rawHome, selectedXIIds: homeBest.xiIds, captainId: homeBest.captainId, wicketkeeperId: homeBest.wicketkeeperId },
      { ...rawAway, selectedXIIds: awayBest.xiIds, captainId: awayBest.captainId, wicketkeeperId: awayBest.wicketkeeperId },
      playerMap,
      Math.random,
      next
    );
    perfBatches.push(extractMatchPerformances(f, match));
    return applyCompletedMatchToFixture(f, match);
  });

  const finalMatch = next.find((f) => f.stage === 'FINAL');
  const championId = finalMatch?.completed ? finalMatch.winnerId : null;

  return { fixtures: next, championId, perfBatches };
}

export function getVenueLabel(cityId: CityId): string {
  const p = PITCH_PROFILES[cityId];
  return `${p.stadium}, ${p.city}`;
}

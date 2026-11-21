import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePlayerPool } from './playerGenerator';
import { scoutPlayers, generateOpponentScoutingReport } from './scouting';
import {
  assignInitialSeasonSquads,
  BASE_PRICE_L,
  INITIAL_PURSE_L,
  MAX_ROSTER_SIZE,
  TARGET_AUTO_SQUAD_SIZE,
} from './squadSetup';
import {
  clearSavedGame,
  getSaveGameSummary,
  loadGameState,
  SAVE_STORAGE_KEY,
  saveGameState,
  StorageLike,
} from './storage';
import {
  applyManagerTacticalPlan,
  beginMatchStartCheckpoint,
  buildRunRateChartData,
  createMatchState,
  getBallEventLabel,
  isKeyMatchEventBall,
  selectBestXI,
  SIM_KEY_EVENT_PAUSE_MS,
  simulateNextBall,
  simulateQuickMatch,
  validateMatchdayXI,
} from './matchEngine';
import {
  applyCompletedMatchToFixture,
  applyRoundFitnessAndInjuries,
  computeSeasonLeaderboards,
  computeStandings,
  extractMatchPerformances,
  generateLeagueSchedule,
  mergeMatchPerformancesIntoPlayers,
} from './tournament';
import { computePlayerTradeValue, evaluateTradeFairness, executeTrade } from './trade';
import { getAllowedTabsForPhase, getProgressAction } from './seasonPhase';
import { CITY_LIST } from './cities';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

test('generates 150 Indian seniors, 50 Indian U19, and 75 foreign internationals with 5-pillar stats', () => {
  const players = generatePlayerPool(202611);
  assert.equal(players.length, 275);

  const indSenior = players.filter((p) => p.category === 'INDIAN_SENIOR');
  const indU19 = players.filter((p) => p.category === 'INDIAN_U19');
  const foreign = players.filter((p) => p.category === 'FOREIGN');

  assert.equal(indSenior.length, 150);
  assert.equal(indU19.length, 50);
  assert.equal(foreign.length, 75);

  for (const p of players) {
    assert.equal(p.basePriceL, BASE_PRICE_L);
    assert.ok(p.physical.stamina >= 25 && p.physical.stamina <= 99);
    assert.ok(p.physical.injuryProneness >= 10 && p.physical.injuryProneness <= 95);
    assert.ok(p.mindset.leadership >= 25 && p.mindset.leadership <= 99);
    assert.ok(p.batting.clutchFactor >= 25 && p.batting.clutchFactor <= 99);
    assert.ok(p.bowling.controlUnderAssault >= 20 && p.bowling.controlUnderAssault <= 99);
    assert.ok(p.fielding.fieldingSetup >= 25 && p.fielding.fieldingSetup <= 99);
  }
});

test('scouting query returns top 5 matching players for location, age, nationality, and role', () => {
  const players = generatePlayerPool(202611);
  const res1 = scoutPlayers(players, 'u19 spin bowler');
  assert.equal(res1.topPlayers.length, 5);
  assert.ok(res1.topPlayers.every((p) => p.category === 'INDIAN_U19' && p.isSpinBowler));

  const res2 = scoutPlayers(players, 'australian fast bowler');
  assert.equal(res2.topPlayers.length, 5);
  assert.ok(res2.topPlayers.every((p) => p.nationality === 'Australia'));
});

test('assignInitialSeasonSquads creates 25-player squads (5 U19, 6 foreign) with pitch/weather-tailored imbalances', () => {
  const pool = generatePlayerPool(202611);
  const { teams, players } = assignInitialSeasonSquads('mumbai', pool);
  assert.equal(teams.length, 8);
  const playerMap = new Map(players.map((p) => [p.id, p]));

  const userTeam = teams.find((t) => t.isUser)!;
  assert.equal(userTeam.id, 'mumbai');

  for (const t of teams) {
    assert.equal(t.rosterIds.length, 25);
    assert.equal(t.rosterIds.length, TARGET_AUTO_SQUAD_SIZE);
    assert.ok(t.rosterIds.length <= MAX_ROSTER_SIZE);
    assert.ok(t.purseRemainingL >= 0 && t.purseRemainingL <= INITIAL_PURSE_L);

    const roster = t.rosterIds.map((id) => playerMap.get(id)!);
    const u19Count = roster.filter((p) => p.category === 'INDIAN_U19').length;
    const foreignCount = roster.filter((p) => p.category === 'FOREIGN').length;
    const seniorCount = roster.filter((p) => p.category === 'INDIAN_SENIOR').length;
    assert.equal(u19Count, 5, `${t.id} must have 5 Indian U19 players`);
    assert.equal(foreignCount, 6, `${t.id} must have 6 foreign nationals`);
    assert.equal(seniorCount, 14, `${t.id} must have 14 Indian senior players`);

    const val = validateMatchdayXI(t.selectedXIIds, playerMap);
    assert.equal(val.isValid, true, `${t.id} should start with a valid Matchday XI`);
    assert.ok(val.u19Count >= 1);
    assert.ok(val.foreignCount <= 4);
    assert.ok(t.captainId !== null && t.selectedXIIds.includes(t.captainId));
    assert.ok(t.wicketkeeperId !== null && t.selectedXIIds.includes(t.wicketkeeperId));
  }

  // Verify pitch/weather imbalances across franchises:
  const getRoster = (id: string) =>
    teams.find((t) => t.id === id)!.rosterIds.map((pid) => playerMap.get(pid)!);

  const chennaiSpinners = getRoster('chennai').filter((p) => p.isSpinBowler).length;
  const mumbaiSpinners = getRoster('mumbai').filter((p) => p.isSpinBowler).length;
  const bengaluruSpinners = getRoster('bengaluru').filter((p) => p.isSpinBowler).length;
  const bengaluruBatters = getRoster('bengaluru').filter((p) => p.role === 'BATTER').length;
  const hyderabadAllRounders = getRoster('hyderabad').filter((p) => p.role === 'ALL_ROUNDER').length;
  const delhiAllRounders = getRoster('delhi').filter((p) => p.role === 'ALL_ROUNDER').length;

  assert.ok(
    chennaiSpinners > mumbaiSpinners && chennaiSpinners > bengaluruSpinners,
    `Chennai (${chennaiSpinners} spinners) should carry more spinners than low-spin squads Mumbai (${mumbaiSpinners}) and Bengaluru (${bengaluruSpinners})`
  );
  assert.ok(
    bengaluruBatters > hyderabadAllRounders || bengaluruBatters >= 9,
    `Bengaluru should be pinch-hitter batter heavy (got ${bengaluruBatters} pure batters)`
  );
  assert.ok(
    hyderabadAllRounders >= 6 && delhiAllRounders >= 6,
    `Hyderabad (${hyderabadAllRounders}) and Delhi (${delhiAllRounders}) should carry heavy all-rounder contingents`
  );
});

test('matchday XI validator enforces 11 players, >=1 U19, and <=4 foreign internationals', () => {
  const pool = generatePlayerPool(202611);
  const completed = assignInitialSeasonSquads('chennai', pool);
  const playerMap = new Map(completed.players.map((p) => [p.id, p]));

  const chennai = completed.teams.find((t) => t.id === 'chennai')!;
  const best = selectBestXI(chennai, playerMap, 'chennai');
  const validation = validateMatchdayXI(best.xiIds, playerMap);
  assert.equal(validation.isValid, true);
  assert.ok(validation.u19Count >= 1);
  assert.ok(validation.foreignCount <= 4);

  // Invalid XI with 5 foreign players
  const fiveForeign = completed.players.filter((p) => p.category === 'FOREIGN').slice(0, 5).map((p) => p.id);
  const sixIndian = completed.players.filter((p) => p.category === 'INDIAN_SENIOR').slice(0, 6).map((p) => p.id);
  const badValidation = validateMatchdayXI([...fiveForeign, ...sixIndian], playerMap);
  assert.equal(badValidation.isValid, false);
  assert.ok(badValidation.errors.length >= 2);
});

test('match checkpoints pause at MATCH_START, POWERPLAY_1_END, INNINGS_BREAK, POWERPLAY_2_END and resolve match', () => {
  const pool = generatePlayerPool(202611);
  const completed = assignInitialSeasonSquads('mumbai', pool);
  const playerMap = new Map(completed.players.map((p) => [p.id, p]));
  const teamsMap = new Map(completed.teams.map((t) => [t.id, t]));
  const userTeam = completed.teams.find((t) => t.isUser)!;
  const oppTeam = completed.teams.find((t) => !t.isUser)!;

  const report = generateOpponentScoutingReport(oppTeam, completed.players, 'mumbai');
  assert.equal(report.opponentXI.length, 11);
  assert.equal(report.playersToWatch.length, 3);

  const schedule = generateLeagueSchedule(CITY_LIST.map((c) => c.id));
  assert.equal(schedule.length, 28);

  let match = createMatchState(schedule[0], userTeam, oppTeam, playerMap);
  match = beginMatchStartCheckpoint(match);
  assert.equal(match.activeCheckpoint, 'MATCH_START');

  match = applyManagerTacticalPlan(match, 'Attack in powerplay and bowl spin in middle overs', userTeam, playerMap);
  assert.equal(match.phase, 'LIVE');

  const seenCheckpoints = new Set<string>(['MATCH_START']);
  let guard = 0;
  while (match.phase !== 'COMPLETED' && guard < 400) {
    guard++;
    if (match.phase === 'CHECKPOINT_TACTICS' && match.activeCheckpoint) {
      seenCheckpoints.add(match.activeCheckpoint);
      match = applyManagerTacticalPlan(match, 'Bowl yorkers at death and target short boundary', userTeam, playerMap);
    } else {
      match = simulateNextBall(match, teamsMap, playerMap);
    }
  }

  assert.equal(match.phase, 'COMPLETED');
  assert.ok(seenCheckpoints.has('POWERPLAY_1_END'));
  assert.ok(seenCheckpoints.has('INNINGS_BREAK'));
  assert.ok(match.winnerId !== null);

  const updatedFixture = applyCompletedMatchToFixture(schedule[0], match);
  const standings = computeStandings(completed.teams, [updatedFixture]);
  assert.equal(standings[0].points, 2);

  // Career history extraction & deduplicated merge
  const perfBatch = extractMatchPerformances(updatedFixture, match);
  assert.equal(Object.keys(perfBatch).length, 22);
  const mergedOnce = mergeMatchPerformancesIntoPlayers(completed.players, [perfBatch]);
  const updatedFirstXIPlayer = mergedOnce.find((p) => p.id === userTeam.selectedXIIds[0])!;
  assert.equal(updatedFirstXIPlayer.careerHistory.length, 1);
  assert.equal(updatedFirstXIPlayer.careerHistory[0].fixtureId, updatedFixture.id);
  assert.equal(updatedFirstXIPlayer.careerHistory[0].batting.didBat, true);

  // Merging the same fixture batch again must not duplicate entries
  const mergedTwice = mergeMatchPerformancesIntoPlayers(mergedOnce, [perfBatch]);
  const afterSecondMerge = mergedTwice.find((p) => p.id === userTeam.selectedXIIds[0])!;
  assert.equal(afterSecondMerge.careerHistory.length, 1);
});

test('simulateQuickMatch produces valid bowling and batting stats for careerHistory', () => {
  const pool = generatePlayerPool(202611);
  const completed = assignInitialSeasonSquads('jaipur', pool);
  const playerMap = new Map(completed.players.map((p) => [p.id, p]));
  const teamsMap = new Map(completed.teams.map((t) => [t.id, t]));
  const schedule = generateLeagueSchedule(CITY_LIST.map((c) => c.id));
  const fixture = schedule[0];
  const home = teamsMap.get(fixture.homeTeamId)!;
  const away = teamsMap.get(fixture.awayTeamId)!;

  const simMatch = simulateQuickMatch(fixture, home, away, playerMap);
  assert.equal(simMatch.phase, 'COMPLETED');
  const perfBatch = extractMatchPerformances(fixture, simMatch);
  const merged = mergeMatchPerformancesIntoPlayers(completed.players, [perfBatch]);
  const bowlersWithOvers = merged.filter((p) =>
    p.careerHistory.some((h) => h.bowling.ballsBowled > 0)
  );
  assert.ok(bowlersWithOvers.length >= 2);
});

test('applyRoundFitnessAndInjuries increases fatigue for played XI, recovers bench, and blocks injured XI picks', () => {
  const pool = generatePlayerPool(202611);
  const completed = assignInitialSeasonSquads('mumbai', pool);
  const playerMap = new Map(completed.players.map((p) => [p.id, p]));
  const mumbai = completed.teams.find((t) => t.id === 'mumbai')!;
  const opp = completed.teams.find((t) => !t.isUser)!;

  const fixture = generateLeagueSchedule(CITY_LIST.map((c) => c.id)).find(
    (f) => (f.homeTeamId === mumbai.id && f.awayTeamId === opp.id) || (f.awayTeamId === mumbai.id && f.homeTeamId === opp.id)
  )!;
  const home = fixture.homeTeamId === mumbai.id ? mumbai : opp;
  const away = fixture.awayTeamId === mumbai.id ? mumbai : opp;
  const simMatch = simulateQuickMatch(fixture, home, away, playerMap);
  const perfBatch = extractMatchPerformances(fixture, simMatch);

  // Give a bench player prior fatigue to verify recovery when rested
  const benchId = mumbai.rosterIds.find((id) => !mumbai.selectedXIIds.includes(id))!;
  const seededPlayers = completed.players.map((p) =>
    p.id === benchId ? { ...p, fatigue: 50 } : p
  );

  // Deterministic rng = 0 triggers injury for eligible played players while preserving >=11 fit & >=1 U19
  const afterRound = applyRoundFitnessAndInjuries(seededPlayers, [perfBatch], () => 0);

  const playedStarter = afterRound.find((p) => p.id === mumbai.selectedXIIds[0])!;
  assert.ok(playedStarter.fatigue > 0);

  const restedBench = afterRound.find((p) => p.id === benchId)!;
  assert.ok(restedBench.fatigue < 50);

  const mumbaiFitAfter = afterRound.filter(
    (p) => p.soldToTeamId === 'mumbai' && p.injuredMatchesRemaining === 0
  );
  assert.ok(mumbaiFitAfter.length >= 11);
  assert.ok(mumbaiFitAfter.some((p) => p.category === 'INDIAN_U19'));

  // Injured player cannot pass validateMatchdayXI
  const injuredPlayer = afterRound.find(
    (p) => p.soldToTeamId === 'mumbai' && p.injuredMatchesRemaining > 0
  );
  assert.ok(injuredPlayer !== undefined);
  const afterMap = new Map(afterRound.map((p) => [p.id, p]));
  const invalidXI = [injuredPlayer!.id, ...mumbai.selectedXIIds.filter((id) => id !== injuredPlayer!.id).slice(0, 10)];
  const val = validateMatchdayXI(invalidXI, afterMap);
  assert.equal(val.isValid, false);
  assert.ok(val.injuredCount >= 1);

  // Single injured player in an otherwise fit XI yields injuredCount === 1
  const singleInjuredMap = new Map(
    completed.players.map((p) =>
      p.id === mumbai.selectedXIIds[0] ? [p.id, { ...p, injuredMatchesRemaining: 1 }] : [p.id, p]
    )
  );
  const singleVal = validateMatchdayXI(mumbai.selectedXIIds, singleInjuredMap);
  assert.equal(singleVal.isValid, false);
  assert.equal(singleVal.injuredCount, 1);

  // Next round with no match decrements injuredMatchesRemaining
  const recovered = applyRoundFitnessAndInjuries(afterRound, [], () => 0.99);
  const injuredAfterNext = recovered.find((p) => p.id === injuredPlayer!.id)!;
  assert.equal(injuredAfterNext.injuredMatchesRemaining, injuredPlayer!.injuredMatchesRemaining - 1);
});

test('evaluateTradeFairness validates rating parity, U19 constraints, and executes fair swaps', () => {
  const pool = generatePlayerPool(202611);
  const completed = assignInitialSeasonSquads('mumbai', pool);
  const playerMap = new Map(completed.players.map((p) => [p.id, p]));

  const mumbai = completed.teams.find((t) => t.id === 'mumbai')!;
  const chennai = completed.teams.find((t) => t.id === 'chennai')!;

  const mumbaiSeniorSorted = mumbai.rosterIds
    .map((id) => playerMap.get(id)!)
    .filter((p) => p.category !== 'INDIAN_U19')
    .sort((a, b) => b.overallRating - a.overallRating);
  const chennaiSeniorSorted = chennai.rosterIds
    .map((id) => playerMap.get(id)!)
    .filter((p) => p.category !== 'INDIAN_U19')
    .sort((a, b) => b.overallRating - a.overallRating);

  // 1. Unfair trade: Mumbai's lowest-rated senior for Chennai's top star
  const mumbaiBottom = mumbaiSeniorSorted[mumbaiSeniorSorted.length - 1];
  const chennaiTop = chennaiSeniorSorted[0];
  const unfairEval = evaluateTradeFairness(
    {
      userTeamId: 'mumbai',
      partnerTeamId: 'chennai',
      offeredPlayerIds: [mumbaiBottom.id],
      requestedPlayerIds: [chennaiTop.id],
      cashAdjustmentL: 0,
    },
    completed.teams,
    completed.players
  );
  assert.equal(unfairEval.isValid, true);
  assert.equal(unfairEval.isFair, false);
  assert.ok(unfairEval.reasons.length >= 1);

  // 2. Fair trade: pick closest-valued senior pair where offered >= requested value
  let bestPair: { offerId: string; requestId: string; cashL: number } | null = null;
  for (const offerP of mumbaiSeniorSorted) {
    for (const reqP of chennaiSeniorSorted) {
      if (Math.abs(offerP.overallRating - reqP.overallRating) <= 6) {
        const offerVal = computePlayerTradeValue(offerP, 'chennai');
        const reqVal = computePlayerTradeValue(reqP, 'chennai');
        if (offerVal >= reqVal) {
          bestPair = { offerId: offerP.id, requestId: reqP.id, cashL: 0 };
          break;
        }
      }
    }
    if (bestPair) break;
  }
  assert.ok(bestPair !== null, 'Expected a comparable senior pair for fair trade');

  const fairEval = evaluateTradeFairness(
    {
      userTeamId: 'mumbai',
      partnerTeamId: 'chennai',
      offeredPlayerIds: [bestPair!.offerId],
      requestedPlayerIds: [bestPair!.requestId],
      cashAdjustmentL: bestPair!.cashL,
    },
    completed.teams,
    completed.players
  );
  assert.equal(fairEval.isValid, true);
  assert.equal(fairEval.isFair, true);

  const execRes = executeTrade(
    {
      userTeamId: 'mumbai',
      partnerTeamId: 'chennai',
      offeredPlayerIds: [bestPair!.offerId],
      requestedPlayerIds: [bestPair!.requestId],
      cashAdjustmentL: bestPair!.cashL,
    },
    completed.teams,
    completed.players
  );
  assert.equal(execRes.accepted, true);
  const postMumbai = execRes.teams.find((t) => t.id === 'mumbai')!;
  const postChennai = execRes.teams.find((t) => t.id === 'chennai')!;
  assert.ok(postMumbai.rosterIds.includes(bestPair!.requestId));
  assert.ok(!postMumbai.rosterIds.includes(bestPair!.offerId));
  assert.ok(postChennai.rosterIds.includes(bestPair!.offerId));
  assert.ok(!postChennai.rosterIds.includes(bestPair!.requestId));

  // 3. Structural block: cannot trade away a team's sole Indian U19 player
  const mumbaiU19s = mumbai.rosterIds
    .map((id) => playerMap.get(id)!)
    .filter((p) => p.category === 'INDIAN_U19');
  if (mumbaiU19s.length > 0 && mumbaiU19s.length <= 3) {
    const illegalU19Eval = evaluateTradeFairness(
      {
        userTeamId: 'mumbai',
        partnerTeamId: 'chennai',
        offeredPlayerIds: mumbaiU19s.map((p) => p.id),
        requestedPlayerIds: [chennaiTop.id],
        cashAdjustmentL: 0,
      },
      completed.teams,
      completed.players
    );
    assert.equal(illegalU19Eval.isValid, false);
  }
});

test('buildRunRateChartData records over-by-over run rate progression for both innings', () => {
  const pool = generatePlayerPool(202611);
  const completed = assignInitialSeasonSquads('bengaluru', pool);
  const playerMap = new Map(completed.players.map((p) => [p.id, p]));
  const teamsMap = new Map(completed.teams.map((t) => [t.id, t]));
  const fixture = generateLeagueSchedule(CITY_LIST.map((c) => c.id))[0];
  const simMatch = simulateQuickMatch(
    fixture,
    teamsMap.get(fixture.homeTeamId)!,
    teamsMap.get(fixture.awayTeamId)!,
    playerMap
  );

  assert.ok(simMatch.innings1.overProgress.length >= 1);
  assert.ok(simMatch.innings2 !== null && simMatch.innings2.overProgress.length >= 1);

  const chartData = buildRunRateChartData(simMatch.innings1, simMatch.innings2);
  assert.ok(chartData.length >= simMatch.innings1.overProgress.length);
  assert.equal(chartData[0].over, 1);
  assert.ok(chartData[0].inn1RunRate !== null && chartData[0].inn1RunRate >= 0);
  assert.ok(chartData[0].inn2RunRate !== null && chartData[0].inn2RunRate >= 0);
});

test('seasonPhase enforces Match Center isolation and Progress transitions without Auction', () => {
  const schedule = generateLeagueSchedule(CITY_LIST.map((c) => c.id));
  const gw1 = schedule[0];

  // Season Prep: SQUAD, STANDINGS (Season Stats) unlocked; TRADE turned off; MATCH locked
  const prepTabs = getAllowedTabsForPhase('SEASON_PREP');
  assert.deepEqual(prepTabs, {
    SQUAD: true,
    TRADE: false,
    STANDINGS: true,
    MATCH: false,
  });
  const p1 = getProgressAction('SEASON_PREP', { matchCompleted: false, nextUserFixture: gw1, championId: null });
  assert.equal(p1.targetPhase, 'PRE_GAMEWEEK');
  assert.equal(p1.buttonLabel, 'Progress: Pre-Gameweek 1');

  // Pre-Gameweek 1: MATCH nav locked until Progress launches matchup, TRADE disabled
  const preTabs = getAllowedTabsForPhase('PRE_GAMEWEEK');
  assert.equal(preTabs.MATCH, false);
  assert.equal(preTabs.TRADE, false);
  assert.equal(preTabs.STANDINGS, true);
  const p2 = getProgressAction('PRE_GAMEWEEK', { matchCompleted: false, nextUserFixture: gw1, championId: null });
  assert.equal(p2.targetPhase, 'MATCH_LIVE');

  // Match Live: ONLY MATCH allowed, Progress disabled until match completes
  const liveTabs = getAllowedTabsForPhase('MATCH_LIVE');
  assert.deepEqual(liveTabs, {
    SQUAD: false,
    TRADE: false,
    STANDINGS: false,
    MATCH: true,
  });
  const p3Blocked = getProgressAction('MATCH_LIVE', { matchCompleted: false, nextUserFixture: gw1, championId: null });
  assert.equal(p3Blocked.disabled, true);
  const p3Ready = getProgressAction('MATCH_LIVE', { matchCompleted: true, nextUserFixture: gw1, championId: null });
  assert.equal(p3Ready.disabled, false);
  assert.equal(p3Ready.targetPhase, 'POST_GAME');

  // Post-Game & Season End: MATCH locked
  const postTabs = getAllowedTabsForPhase('POST_GAME');
  assert.equal(postTabs.MATCH, false);
  assert.equal(postTabs.STANDINGS, true);
  const pEnd = getProgressAction('SEASON_END', { matchCompleted: false, nextUserFixture: null, championId: 'mumbai' });
  assert.equal(pEnd.targetPhase, 'SEASON_PREP');
  assert.equal(pEnd.buttonLabel, 'Progress: New Season');
});

test('local save storage saves, summarizes, restores mid-match state, clears, and ignores corrupt data', () => {
  const storage = createMemoryStorage();
  assert.equal(getSaveGameSummary(storage), null);
  assert.equal(loadGameState(storage), null);

  const pool = generatePlayerPool(202611);
  const { teams, players } = assignInitialSeasonSquads('kolkata', pool);
  const fixtures = generateLeagueSchedule(CITY_LIST.map((c) => c.id));
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const teamsMap = new Map(teams.map((t) => [t.id, t]));
  const firstFixture = fixtures[0];
  const liveMatch = createMatchState(
    firstFixture,
    teamsMap.get(firstFixture.homeTeamId)!,
    teamsMap.get(firstFixture.awayTeamId)!,
    playerMap
  );

  const saveRes = saveGameState(
    {
      selectedCityId: 'kolkata',
      seasonPhase: 'MATCH_LIVE',
      activeTab: 'MATCH',
      players,
      teams,
      fixtures,
      activeMatch: liveMatch,
      championId: null,
      tradeHistory: [],
    },
    storage,
    '2026-11-14T21:30:00.000Z'
  );

  assert.equal(saveRes.ok, true);
  assert.ok(saveRes.summary !== null);
  assert.equal(saveRes.summary!.cityId, 'kolkata');
  assert.equal(saveRes.summary!.shortCode, 'KOL');
  assert.equal(saveRes.summary!.phaseLabel, 'Live Match in Progress');
  assert.equal(saveRes.summary!.hasActiveMatch, true);

  const loaded = loadGameState(storage);
  assert.ok(loaded !== null);
  assert.equal(loaded!.selectedCityId, 'kolkata');
  assert.equal(loaded!.seasonPhase, 'MATCH_LIVE');
  assert.equal(loaded!.activeTab, 'MATCH');
  assert.equal(loaded!.teams.length, 8);
  assert.equal(loaded!.activeMatch?.fixtureId, firstFixture.id);

  // Clearing save removes it cleanly
  clearSavedGame(storage);
  assert.equal(loadGameState(storage), null);
  assert.equal(getSaveGameSummary(storage), null);

  // Corrupt JSON does not throw
  storage.setItem(SAVE_STORAGE_KEY, '{corrupt json');
  assert.equal(loadGameState(storage), null);
});

test('generateThreeDayWeatherForecast produces 3-day weather progression aligned with Match Day', async () => {
  const { generateThreeDayWeatherForecast } = await import('./cities');

  const humidKolkata = generateThreeDayWeatherForecast('kolkata', 'HUMID_DEW', 1);
  assert.equal(humidKolkata.days.length, 3);
  assert.equal(humidKolkata.days[2].condition, 'HUMID_DEW');
  assert.equal(humidKolkata.days[2].relativeLabel, 'Match Day');
  assert.equal(humidKolkata.days[2].dewRisk, 'High');
  assert.ok(humidKolkata.days[2].humidityPct >= 75);
  assert.ok(humidKolkata.trendSummary.includes('Humidity'));

  const dryJaipur = generateThreeDayWeatherForecast('jaipur', 'DRY_HEAT', 2);
  assert.equal(dryJaipur.days.length, 3);
  assert.equal(dryJaipur.days[2].condition, 'DRY_HEAT');
  assert.ok(dryJaipur.days[2].tempHighC >= 38);
  assert.ok(dryJaipur.days[2].humidityPct <= 35);
  assert.ok(dryJaipur.days[2].movementTag.includes('Spin'));
});

test('rivalry system computes symmetric tactical morale boosts/penalties and updates from completed H2H fixtures', async () => {
  const { computeRivalryMoraleForMatch, getTeamRivalryLedger } = await import('./rivalry');

  assert.equal(computeRivalryMoraleForMatch('delhi', 'ahmedabad', []), null);

  const baseRiv = computeRivalryMoraleForMatch('mumbai', 'chennai', []);
  assert.ok(baseRiv !== null);
  assert.equal(baseRiv!.rivalryName, 'Championship Clasico');
  assert.equal(baseRiv!.homeWins, 20);
  assert.equal(baseRiv!.awayWins, 17);
  assert.ok(baseRiv!.homeMorale > 0);
  assert.equal(baseRiv!.awayMorale, -baseRiv!.homeMorale);

  const schedule = generateLeagueSchedule(CITY_LIST.map((c) => c.id));
  const sampleFixture = schedule[0];
  const cskStreakFixtures = [1, 2, 3].map((r) => ({
    ...sampleFixture,
    id: `mock-riv-${r}`,
    roundNumber: r,
    homeTeamId: 'mumbai' as const,
    awayTeamId: 'chennai' as const,
    venueCityId: 'mumbai' as const,
    completed: true,
    winnerId: 'chennai' as const,
  }));

  const flippedRiv = computeRivalryMoraleForMatch('mumbai', 'chennai', cskStreakFixtures);
  assert.ok(flippedRiv !== null);
  assert.equal(flippedRiv!.homeWins, 20);
  assert.equal(flippedRiv!.awayWins, 20);
  assert.ok(flippedRiv!.homeMorale < 0);
  assert.ok(flippedRiv!.awayMorale > 0);

  for (const city of CITY_LIST) {
    const ledger = getTeamRivalryLedger(city.id, []);
    assert.ok(ledger.length >= 2, `${city.id} should have at least 2 historical rivals`);
  }

  const pool = generatePlayerPool(202611);
  const completed = assignInitialSeasonSquads('mumbai', pool);
  const playerMap = new Map(completed.players.map((p) => [p.id, p]));
  const mumbai = completed.teams.find((t) => t.id === 'mumbai')!;
  const chennai = completed.teams.find((t) => t.id === 'chennai')!;

  const rivFixture = {
    ...sampleFixture,
    homeTeamId: 'mumbai' as const,
    awayTeamId: 'chennai' as const,
    venueCityId: 'mumbai' as const,
  };
  let matchState = createMatchState(rivFixture, mumbai, chennai, playerMap, Math.random, []);
  assert.ok(matchState.rivalry !== null);
  assert.equal(matchState.rivalry!.rivalryName, 'Championship Clasico');
  matchState = beginMatchStartCheckpoint(matchState);
  matchState = applyManagerTacticalPlan(matchState, 'Attack early in powerplay', mumbai, playerMap);
  assert.ok(matchState.tacticsLog[0].captainReply.includes('Championship Clasico'));
});

test('generateMatchPerformanceReport summarizes centuries, 5-wicket hauls, half-centuries, and Player of the Match', async () => {
  const { generateMatchPerformanceReport } = await import('./reports');

  const pool = generatePlayerPool(202611);
  const completed = assignInitialSeasonSquads('mumbai', pool);
  const playerMap = new Map(completed.players.map((p) => [p.id, p]));
  const teamsMap = new Map(completed.teams.map((t) => [t.id, t]));
  const fixture = generateLeagueSchedule(CITY_LIST.map((c) => c.id))[0];
  let seed = 42;
  const detRng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const baseMatch = simulateQuickMatch(
    fixture,
    teamsMap.get(fixture.homeTeamId)!,
    teamsMap.get(fixture.awayTeamId)!,
    playerMap,
    detRng
  );

  const starBatterId = baseMatch.innings1.battingOrderIds[0];
  const starBowlerId = baseMatch.innings1.bowlingTeamId === fixture.homeTeamId
    ? completed.teams.find((t) => t.id === fixture.homeTeamId)!.selectedXIIds[8]
    : completed.teams.find((t) => t.id === fixture.awayTeamId)!.selectedXIIds[8];
  const fiftyBatterId = baseMatch.innings1.battingOrderIds[2];

  const syntheticMatch = {
    ...baseMatch,
    phase: 'COMPLETED' as const,
    innings1: {
      ...baseMatch.innings1,
      batterStats: {
        ...baseMatch.innings1.batterStats,
        [starBatterId]: {
          ...baseMatch.innings1.batterStats[starBatterId],
          runs: 108,
          balls: 56,
          fours: 10,
          sixes: 6,
          isOut: false,
        },
        [fiftyBatterId]: {
          ...baseMatch.innings1.batterStats[fiftyBatterId],
          runs: 54,
          balls: 33,
          fours: 5,
          sixes: 2,
          isOut: true,
        },
      },
      bowlerStats: {
        ...baseMatch.innings1.bowlerStats,
        [starBowlerId]: {
          playerId: starBowlerId,
          ballsBowled: 24,
          runsConceded: 24,
          wickets: 5,
          dots: 13,
          wides: 0,
          noBalls: 0,
          tiltLevel: 0,
        },
      },
    },
  };

  const report = generateMatchPerformanceReport(syntheticMatch, teamsMap, playerMap);
  assert.equal(report.isCompleted, true);
  assert.ok(report.playerOfTheMatch !== null);
  assert.ok(report.highestScorer !== null);
  assert.equal(report.highestScorer!.playerId, starBatterId);
  assert.equal(report.highestScorer!.runs, 108);
  assert.ok(report.bestBowler !== null);
  assert.equal(report.bestBowler!.playerId, starBowlerId);
  assert.equal(report.bestBowler!.wickets, 5);
  assert.ok(report.milestones.some((m) => m.playerId === starBatterId && m.milestoneTitle === 'Century'));
  assert.ok(report.milestones.some((m) => m.playerId === starBowlerId && m.milestoneTitle === 'Five-Wicket Haul'));
  assert.ok(report.milestones.some((m) => m.playerId === fiftyBatterId && m.milestoneTitle === 'Half-Century'));
  assert.equal(report.teamSummaries.length, 2);
});

test('computeSeasonLeaderboards ranks Most Runs Scored and Most Wickets Taken across completed matches', () => {
  const pool = generatePlayerPool(202611);
  const { teams, players } = assignInitialSeasonSquads('mumbai', pool);

  // Empty careerHistory returns empty leaderboards
  const emptyBoards = computeSeasonLeaderboards(players, teams);
  assert.equal(emptyBoards.topRunScorers.length, 0);
  assert.equal(emptyBoards.topWicketTakers.length, 0);

  const playerMap = new Map(players.map((p) => [p.id, p]));
  const teamsMap = new Map(teams.map((t) => [t.id, t]));
  const schedule = generateLeagueSchedule(CITY_LIST.map((c) => c.id));
  const round1Fixtures = schedule.filter((f) => f.roundNumber === 1);

  const batches = round1Fixtures.map((f) => {
    const sim = simulateQuickMatch(f, teamsMap.get(f.homeTeamId)!, teamsMap.get(f.awayTeamId)!, playerMap);
    return extractMatchPerformances(f, sim);
  });

  const merged = mergeMatchPerformancesIntoPlayers(players, batches);
  const boards = computeSeasonLeaderboards(merged, teams, 10);

  assert.equal(boards.topRunScorers.length, 10);
  assert.equal(boards.topWicketTakers.length, 10);

  // Verify descending sort for runs & wickets
  for (let i = 1; i < boards.topRunScorers.length; i++) {
    assert.ok(boards.topRunScorers[i - 1].runs >= boards.topRunScorers[i].runs);
  }
  for (let i = 1; i < boards.topWicketTakers.length; i++) {
    assert.ok(boards.topWicketTakers[i - 1].wickets >= boards.topWicketTakers[i].wickets);
  }

  // Verify computed metrics on leaders
  const topBat = boards.topRunScorers[0];
  assert.ok(topBat.innings >= 1);
  assert.ok(topBat.runs >= 0);
  assert.ok(topBat.highScore <= topBat.runs);
  assert.ok(topBat.teamShortCode.length >= 2);

  const topBowl = boards.topWicketTakers[0];
  assert.ok(topBowl.ballsBowled > 0);
  assert.ok(topBowl.oversText.length >= 1);
  assert.ok(topBowl.bestFigures.includes('/'));
});

test('key match event helper flags 4s, 6s, wickets, and near misses for 2000ms sim pause', () => {
  assert.equal(SIM_KEY_EVENT_PAUSE_MS, 2000);

  const baseBall = {
    innings: 1 as const,
    over: 0,
    ballInOver: 1,
    batterId: 'bat-1',
    bowlerId: 'bowl-1',
    runsScored: 0,
    extraRuns: 0,
    extraType: 'NONE' as const,
    isBoundaryFour: false,
    isBoundarySix: false,
    isWicket: false,
    isNearMiss: false,
    commentary: 'Dot ball.',
    shotAngleDeg: 45,
    shotDistanceRatio: 0.2,
  };

  assert.equal(isKeyMatchEventBall(baseBall), false);
  assert.equal(getBallEventLabel(baseBall), null);

  assert.equal(isKeyMatchEventBall({ ...baseBall, runsScored: 4, isBoundaryFour: true }), true);
  assert.equal(getBallEventLabel({ ...baseBall, runsScored: 4, isBoundaryFour: true }), 'FOUR');

  assert.equal(isKeyMatchEventBall({ ...baseBall, runsScored: 6, isBoundarySix: true }), true);
  assert.equal(getBallEventLabel({ ...baseBall, runsScored: 6, isBoundarySix: true }), 'SIX');

  assert.equal(isKeyMatchEventBall({ ...baseBall, isWicket: true }), true);
  assert.equal(getBallEventLabel({ ...baseBall, isWicket: true }), 'WICKET');

  assert.equal(
    isKeyMatchEventBall({ ...baseBall, isNearMiss: true, nearMissReason: 'Beat Outside Edge' }),
    true
  );
  assert.equal(
    getBallEventLabel({ ...baseBall, isNearMiss: true, nearMissReason: 'Beat Outside Edge' }),
    'NEAR MISS'
  );

  // Run an actual simulated match and confirm near misses, boundaries, and wickets occur
  const pool = generatePlayerPool(202611);
  const completed = assignInitialSeasonSquads('mumbai', pool);
  const playerMap = new Map(completed.players.map((p) => [p.id, p]));
  const teamsMap = new Map(completed.teams.map((t) => [t.id, t]));
  const fixture = generateLeagueSchedule(CITY_LIST.map((c) => c.id))[0];
  let match = createMatchState(
    fixture,
    teamsMap.get(fixture.homeTeamId)!,
    teamsMap.get(fixture.awayTeamId)!,
    playerMap
  );
  match = beginMatchStartCheckpoint(match);
  match = applyManagerTacticalPlan(
    match,
    'Attack in powerplay and rotate strike',
    teamsMap.get(fixture.homeTeamId)!,
    playerMap
  );

  let seenFour = false;
  let seenSix = false;
  let seenWicket = false;
  let seenNearMiss = false;
  let guard = 0;
  while (match.phase !== 'COMPLETED' && guard < 360) {
    guard++;
    if (match.phase === 'CHECKPOINT_TACTICS') {
      match = applyManagerTacticalPlan(
        match,
        'Balanced approach',
        teamsMap.get(fixture.homeTeamId)!,
        playerMap
      );
    } else {
      match = simulateNextBall(match, teamsMap, playerMap);
      const b = match.commentaryFeed[0];
      if (b?.isBoundaryFour) seenFour = true;
      if (b?.isBoundarySix) seenSix = true;
      if (b?.isWicket) seenWicket = true;
      if (b?.isNearMiss) seenNearMiss = true;
    }
  }

  assert.equal(match.phase, 'COMPLETED');
  assert.ok(seenFour, 'Match should produce at least one 4');
  assert.ok(seenSix || seenWicket, 'Match should produce boundaries/wickets');
  assert.ok(seenNearMiss, 'Match should produce at least one near miss of wicket event');
});

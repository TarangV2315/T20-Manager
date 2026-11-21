import { applyWeatherToPitch, PITCH_PROFILES, WEATHER_PROFILES } from './cities';
import { computeRivalryMoraleForMatch } from './rivalry';
import { NEUTRAL_DIRECTIVES, parseTacticalPlan } from './tactics';
import {
  BallOutcome,
  BatterMatchStats,
  BowlerMatchStats,
  CityId,
  Fixture,
  FranchiseTeam,
  InningsState,
  MatchState,
  OverProgressPoint,
  Player,
  TacticalCheckpoint,
  TacticalDirectives,
} from './types';

export interface XIValidationResult {
  isValid: boolean;
  errors: string[];
  u19Count: number;
  foreignCount: number;
  bowlerOptionCount: number;
  hasWicketkeeper: boolean;
  injuredCount: number;
}

export function validateMatchdayXI(
  selectedIds: string[],
  playerMap: Map<string, Player>
): XIValidationResult {
  const players = selectedIds
    .map((id) => playerMap.get(id))
    .filter((p): p is Player => Boolean(p));

  const u19Count = players.filter((p) => p.category === 'INDIAN_U19').length;
  const foreignCount = players.filter((p) => p.category === 'FOREIGN').length;
  const bowlerOptionCount = players.filter(
    (p) => p.role === 'BOWLER' || p.role === 'ALL_ROUNDER'
  ).length;
  const hasWicketkeeper = players.some((p) => p.role === 'WICKETKEEPER');
  const injuredPlayers = players.filter((p) => p.injuredMatchesRemaining > 0);
  const injuredCount = injuredPlayers.length;

  const errors: string[] = [];
  if (players.length !== 11) {
    errors.push(`Must select exactly 11 players (currently ${players.length}).`);
  }
  if (u19Count < 1) {
    errors.push('Must include at least 1 Indian U19 player.');
  }
  if (foreignCount > 4) {
    errors.push(`Maximum 4 foreign internationals allowed (currently ${foreignCount}).`);
  }
  if (injuredCount > 0) {
    errors.push(
      `${injuredCount} injured player(s) in XI (${injuredPlayers.map((p) => p.name).join(', ')}).`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    u19Count,
    foreignCount,
    bowlerOptionCount,
    hasWicketkeeper,
    injuredCount,
  };
}

export function selectBestXI(
  team: FranchiseTeam,
  playerMap: Map<string, Player>,
  venueCityId: CityId
): { xiIds: string[]; captainId: string | null; wicketkeeperId: string | null } {
  const pitch = PITCH_PROFILES[venueCityId];
  const roster = team.rosterIds
    .map((id) => playerMap.get(id))
    .filter((p): p is Player => Boolean(p))
    .filter((p) => p.injuredMatchesRemaining === 0);

  const scoreForPitch = (p: Player) => {
    let score = p.overallRating - p.fatigue * 0.12;
    if (pitch.spinFactor > 1.1 && p.isSpinBowler) score += 8;
    if (pitch.spinFactor > 1.1 && p.batting.techniqueVsSpin >= 75) score += 5;
    if (pitch.paceFactor > 1.1 && p.isPaceBowler) score += 8;
    if (pitch.boundarySize === 'small' && (p.batting.powerHitting >= 76 || p.bowling.variations >= 76)) {
      score += 5;
    }
    if (pitch.boundarySize === 'large' && (p.physical.sprintSpeed >= 75 || p.batting.timingPlacement >= 75)) {
      score += 5;
    }
    if (pitch.variableBounce > 0.35 && (p.bowlingStyle.includes('Wrist-Spin') || p.heightCm >= 184)) {
      score += 5;
    }
    return score;
  };

  const sorted = [...roster].sort((a, b) => scoreForPitch(b) - scoreForPitch(a));
  const picked: Player[] = [];
  let foreignCount = 0;

  const tryPick = (p: Player | undefined) => {
    if (!p || picked.some((x) => x.id === p.id)) return false;
    if (picked.length >= 11) return false;
    if (p.category === 'FOREIGN' && foreignCount >= 4) return false;
    picked.push(p);
    if (p.category === 'FOREIGN') foreignCount++;
    return true;
  };

  // 1. Mandatory U19 player (highest pitch-fit U19)
  tryPick(sorted.find((p) => p.category === 'INDIAN_U19'));

  // 2. Best Wicketkeeper
  tryPick(sorted.find((p) => p.role === 'WICKETKEEPER'));

  // 3. Ensure at least 5 bowling options (Bowlers / All-Rounders)
  for (const p of sorted) {
    const bowlingCount = picked.filter((x) => x.role === 'BOWLER' || x.role === 'ALL_ROUNDER').length;
    if (bowlingCount >= 5) break;
    if (p.role === 'BOWLER' || p.role === 'ALL_ROUNDER') {
      tryPick(p);
    }
  }

  // 4. Fill remaining slots with best pitch-fit batters / all-rounders / bowlers
  for (const p of sorted) {
    if (picked.length >= 11) break;
    tryPick(p);
  }

  // Order batting lineup logically: Batters/WK -> All-Rounders -> Bowlers
  const roleWeight = (p: Player) => {
    if (p.role === 'BATTER') return 0;
    if (p.role === 'WICKETKEEPER') return 1;
    if (p.role === 'ALL_ROUNDER') return 2;
    return 3;
  };
  picked.sort((a, b) => roleWeight(a) - roleWeight(b) || b.batRating - a.batRating);

  const captain = [...picked].sort((a, b) => b.mindset.leadership - a.mindset.leadership)[0] ?? null;
  const keeper = [...picked].sort((a, b) => b.fielding.wicketkeeping - a.fielding.wicketkeeping)[0] ?? null;

  return {
    xiIds: picked.map((p) => p.id),
    captainId: captain?.id ?? null,
    wicketkeeperId: keeper?.id ?? null,
  };
}

function initInnings(
  battingTeam: FranchiseTeam,
  bowlingTeam: FranchiseTeam,
  playerMap: Map<string, Player>
): InningsState {
  const batOrder = [...battingTeam.selectedXIIds];
  const batterStats: Record<string, BatterMatchStats> = {};
  batOrder.forEach((id, idx) => {
    batterStats[id] = {
      playerId: id,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      isOut: false,
      dismissalText: 'not out',
      battingOrder: idx + 1,
    };
  });

  const bowlerStats: Record<string, BowlerMatchStats> = {};
  bowlingTeam.selectedXIIds.forEach((id) => {
    bowlerStats[id] = {
      playerId: id,
      ballsBowled: 0,
      runsConceded: 0,
      wickets: 0,
      dots: 0,
      wides: 0,
      noBalls: 0,
      tiltLevel: 0,
    };
  });

  const openingBowler = chooseNextBowler(
    bowlingTeam.selectedXIIds,
    bowlerStats,
    null,
    0,
    playerMap,
    NEUTRAL_DIRECTIVES,
    battingTeam.city
  );

  return {
    battingTeamId: battingTeam.id,
    bowlingTeamId: bowlingTeam.id,
    runs: 0,
    wickets: 0,
    ballsCompleted: 0,
    extras: 0,
    strikerId: batOrder[0],
    nonStrikerId: batOrder[1],
    nextBatterIndex: 2,
    battingOrderIds: batOrder,
    currentBowlerId: openingBowler,
    lastBowlerId: null,
    batterStats,
    bowlerStats,
    recentBalls: [],
    overProgress: [],
  };
}

function chooseNextBowler(
  xiIds: string[],
  bowlerStats: Record<string, BowlerMatchStats>,
  lastBowlerId: string | null,
  overNumber: number,
  playerMap: Map<string, Player>,
  directives: TacticalDirectives,
  _venueCityName: string
): string {
  const candidates = xiIds.filter((id) => {
    if (id === lastBowlerId) return false;
    const stats = bowlerStats[id];
    return !stats || stats.ballsBowled < 24; // Max 4 overs (24 balls)
  });

  const pool = candidates.length > 0 ? candidates : xiIds.filter((id) => id !== lastBowlerId);
  const scored = pool.map((id) => {
    const p = playerMap.get(id);
    if (!p) return { id, score: 0 };
    let score = p.bowlRating;
    if (p.role === 'BATTER' || p.role === 'WICKETKEEPER') score -= 35;
    if (overNumber < 6) {
      // Powerplay favors pace/movement
      if (p.isPaceBowler) score += 10 + p.bowling.movement * 0.2 + directives.paceFocus;
      if (p.isSpinBowler) score += directives.spinFocus * 0.7;
    } else if (overNumber < 15) {
      // Middle overs favor spin/variations
      if (p.isSpinBowler) score += 12 + directives.spinFocus;
      if (p.isPaceBowler) score += directives.paceFocus * 0.7;
    } else {
      // Death overs favor variations + controlUnderAssault
      score += p.bowling.variations * 0.35 + p.bowling.controlUnderAssault * 0.25 + directives.deathYorkerFocus;
      if (p.isPaceBowler) score += 6;
    }
    return { id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.id ?? xiIds[xiIds.length - 1];
}

export function createMatchState(
  fixture: Fixture,
  homeTeam: FranchiseTeam,
  awayTeam: FranchiseTeam,
  playerMap: Map<string, Player>,
  rng: () => number = Math.random,
  completedFixtures: Fixture[] = []
): MatchState {
  const pitch = applyWeatherToPitch(PITCH_PROFILES[fixture.venueCityId], fixture.weather);
  const rivalry = computeRivalryMoraleForMatch(
    homeTeam.id,
    awayTeam.id,
    completedFixtures
  );
  const tossWinnerId = rng() < 0.5 ? homeTeam.id : awayTeam.id;
  // Dew-heavy conditions prefer chasing (BOWL first); batting paradises or dry pitches lean accordingly
  const preferBowlProb = pitch.dewFactor > 0.65 ? 0.8 : 0.55;
  const tossDecision: 'BAT' | 'BOWL' = rng() < preferBowlProb ? 'BOWL' : 'BAT';

  const firstBatTeam =
    (tossWinnerId === homeTeam.id && tossDecision === 'BAT') ||
    (tossWinnerId === awayTeam.id && tossDecision === 'BOWL')
      ? homeTeam
      : awayTeam;
  const firstBowlTeam = firstBatTeam.id === homeTeam.id ? awayTeam : homeTeam;

  const innings1 = initInnings(firstBatTeam, firstBowlTeam, playerMap);

  return {
    fixtureId: fixture.id,
    roundNumber: fixture.roundNumber,
    stage: fixture.stage,
    venueCityId: fixture.venueCityId,
    weather: fixture.weather,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    tossWinnerId,
    tossDecision,
    currentInnings: 1,
    innings1,
    innings2: null,
    targetRuns: null,
    phase: 'PRE_MATCH_SCOUTING',
    activeCheckpoint: null,
    tacticsLog: [],
    userDirectives: { ...NEUTRAL_DIRECTIVES },
    aiDirectives: { ...NEUTRAL_DIRECTIVES },
    rivalry,
    commentaryFeed: [],
    winnerId: null,
    resultText: '',
  };
}

export function beginMatchStartCheckpoint(state: MatchState): MatchState {
  return {
    ...state,
    phase: 'CHECKPOINT_TACTICS',
    activeCheckpoint: 'MATCH_START',
  };
}

export function applyManagerTacticalPlan(
  state: MatchState,
  planText: string,
  userTeam: FranchiseTeam,
  playerMap: Map<string, Player>
): MatchState {
  const checkpoint = state.activeCheckpoint ?? 'MATCH_START';
  const userXI = userTeam.selectedXIIds
    .map((id) => playerMap.get(id))
    .filter((p): p is Player => Boolean(p));
  const captain = userTeam.captainId ? playerMap.get(userTeam.captainId) ?? null : null;

  const userRivalryCtx = state.rivalry
    ? {
        rivalryName: state.rivalry.rivalryName,
        morale:
          userTeam.id === state.rivalry.homeTeamId
            ? state.rivalry.homeMorale
            : state.rivalry.awayMorale,
      }
    : null;
  const { directives, captainReply } = parseTacticalPlan(
    planText,
    checkpoint,
    userXI,
    captain,
    userRivalryCtx
  );
  const activeInnings = state.currentInnings === 1 ? state.innings1 : state.innings2;
  const overNumber = activeInnings ? Math.floor(activeInnings.ballsCompleted / 6) : 0;

  let nextState: MatchState = {
    ...state,
    phase: 'LIVE',
    activeCheckpoint: null,
    userDirectives: directives,
    tacticsLog: [
      ...state.tacticsLog,
      {
        checkpoint,
        innings: state.currentInnings,
        overNumber,
        managerPlanText: planText.trim() || 'Play smart, disciplined cricket.',
        directives,
        captainReply,
      },
    ],
  };

  // If leaving INNINGS_BREAK, start innings 2
  if (checkpoint === 'INNINGS_BREAK' && state.innings2) {
    nextState.currentInnings = 2;
  }

  return nextState;
}

export function simulateNextBall(
  state: MatchState,
  teamsMap: Map<CityId, FranchiseTeam>,
  playerMap: Map<string, Player>,
  rng: () => number = Math.random
): MatchState {
  if (state.phase !== 'LIVE') return state;

  const weatherProfile = WEATHER_PROFILES[state.weather ?? 'CLEAR'];
  const pitch = applyWeatherToPitch(PITCH_PROFILES[state.venueCityId], state.weather ?? 'CLEAR');
  const isInn1 = state.currentInnings === 1;
  const rawInnings = isInn1 ? state.innings1 : state.innings2;
  if (!rawInnings) return state;

  // Deep clone active innings cleanly
  const inn: InningsState = {
    ...rawInnings,
    batterStats: { ...rawInnings.batterStats },
    bowlerStats: { ...rawInnings.bowlerStats },
    recentBalls: [...rawInnings.recentBalls],
    overProgress: [...rawInnings.overProgress],
  };

  const batTeam = teamsMap.get(inn.battingTeamId)!;
  const bowlTeam = teamsMap.get(inn.bowlingTeamId)!;
  const userIsBatting = batTeam.isUser;
  const batDir = userIsBatting ? state.userDirectives : state.aiDirectives;
  const bowlDir = !userIsBatting ? state.userDirectives : state.aiDirectives;

  const striker = playerMap.get(inn.strikerId)!;
  const nonStriker = playerMap.get(inn.nonStrikerId)!;
  const bowler = playerMap.get(inn.currentBowlerId)!;
  const keeper =
    (bowlTeam.wicketkeeperId ? playerMap.get(bowlTeam.wicketkeeperId) : undefined) ??
    playerMap.get(bowlTeam.selectedXIIds[0])!;
  const batCaptain = batTeam.captainId ? playerMap.get(batTeam.captainId) : undefined;
  const bowlCaptain = bowlTeam.captainId ? playerMap.get(bowlTeam.captainId) : undefined;

  const overIndex = Math.floor(inn.ballsCompleted / 6); // 0..19
  const ballInOver = (inn.ballsCompleted % 6) + 1;
  const isPowerplay = overIndex < 6;
  const isMiddle = overIndex >= 6 && overIndex < 15;
  const isDeath = overIndex >= 15;
  const isKnockout = state.stage !== 'LEAGUE';
  const isTightChase =
    !isInn1 &&
    state.targetRuns !== null &&
    (state.targetRuns - inn.runs) / Math.max(1, 120 - inn.ballsCompleted) >= 1.55;

  // 1. Physical Stamina & Fatigue drop in late overs
  const strikerStaminaDrop =
    striker.physical.stamina < 55 && (overIndex >= 14 || striker.fatigue > 45) ? 7 : 0;
  const bowlerStaminaDrop =
    bowler.physical.stamina < 55 && (overIndex >= 14 || bowler.fatigue > 45) ? 8 : 0;

  // 2. Mindset Adaptability for away conditions
  const batAdaptPenalty =
    batTeam.id !== state.venueCityId ? Math.max(0, (75 - striker.mindset.adaptability) * 0.16) : 0;
  const bowlAdaptPenalty =
    bowlTeam.id !== state.venueCityId ? Math.max(0, (75 - bowler.mindset.adaptability) * 0.16) : 0;

  // 3. Batting Effective Skill
  const techScore = bowler.isSpinBowler
    ? striker.batting.techniqueVsSpin
    : striker.batting.techniqueVsPace;
  const situationalBonus = isPowerplay
    ? striker.batting.situational.powerplaySpecialist * 0.55
    : isMiddle
    ? striker.batting.situational.middleOversAnchor * 0.55
    : striker.batting.situational.finisher * 0.65;
  const clutchBonus =
    isDeath || isTightChase || isKnockout ? (striker.batting.clutchFactor - 60) * 0.25 : 0;
  const captainBatBoost = batCaptain ? (batCaptain.mindset.leadership - 60) * 0.12 : 0;
  const consistencySwing = ((100 - striker.mindset.consistency) / 100) * (rng() * 14 - 7);

  const batRivalryMorale = state.rivalry
    ? batTeam.id === state.rivalry.homeTeamId
      ? state.rivalry.homeMorale
      : state.rivalry.awayMorale
    : 0;
  const bowlRivalryMorale = state.rivalry
    ? bowlTeam.id === state.rivalry.homeTeamId
      ? state.rivalry.homeMorale
      : state.rivalry.awayMorale
    : 0;

  const batBounceAdj = (pitch.battingBounce - 1) * 14;
  const batSkill =
    striker.batting.timingPlacement * 0.34 +
    striker.batting.powerHitting * 0.28 +
    techScore * 0.38 +
    situationalBonus +
    clutchBonus +
    captainBatBoost +
    batDir.composureBoost * 0.3 +
    batRivalryMorale * 0.45 +
    batBounceAdj +
    consistencySwing -
    strikerStaminaDrop -
    batAdaptPenalty;

  // 4. Bowling Effective Skill
  const curBowlerStats = { ...inn.bowlerStats[bowler.id] };
  const tiltPenalty =
    curBowlerStats.tiltLevel >= 2
      ? Math.max(0, (82 - bowler.bowling.controlUnderAssault) * 0.22)
      : 0;
  const pitchBowlFactor = bowler.isSpinBowler
    ? pitch.spinFactor * (1 + pitch.wearRate * (overIndex / 40))
    : pitch.paceFactor * (isPowerplay ? 1.06 : 0.98);
  const dewPenalty = !isInn1 && pitch.dewFactor > 0.5 ? pitch.dewFactor * 7 : 0;
  const tallBounceBonus =
    pitch.variableBounce > 0.35 && bowler.isPaceBowler && bowler.heightCm >= 184 ? 5 : 0;
  const fieldSetupBonus = bowlCaptain ? (bowlCaptain.fielding.fieldingSetup - 60) * 0.14 : 0;

  // Weather swing bonus: Overcast / Breeze directly boosts swing & seam movement bowlers
  const isSwingSpecialist =
    bowler.bowlingStyle === 'Right-Arm Swing' ||
    bowler.bowlingStyle === 'Left-Arm Pace' ||
    bowler.bowlingStyle === 'Right-Arm Express Pace';
  const weatherSwingBonus = bowler.isPaceBowler
    ? weatherProfile.swingBonus *
      (bowler.bowlingStyle === 'Right-Arm Swing' ? 0.55 : isSwingSpecialist ? 0.4 : 0.25) *
      (bowler.bowling.movement / 80)
    : 0;

  const bowlSkill =
    (bowler.bowling.paceOrRevolution * 0.28 +
      bowler.bowling.lineLengthAccuracy * 0.28 +
      bowler.bowling.movement * (isPowerplay ? 0.26 : 0.16) +
      bowler.bowling.variations * (isDeath || pitch.variableBounce > 0.3 ? 0.28 : 0.18) +
      fieldSetupBonus +
      tallBounceBonus +
      weatherSwingBonus +
      bowlDir.composureBoost * 0.3 +
      bowlRivalryMorale * 0.45 +
      (isDeath ? bowlDir.deathYorkerFocus * 0.45 : 0) +
      (bowler.isSpinBowler ? bowlDir.spinFocus * 0.35 : bowlDir.paceFocus * 0.35)) *
      pitchBowlFactor -
    tiltPenalty -
    dewPenalty -
    bowlerStaminaDrop -
    bowlAdaptPenalty;

  // 5. Extras (Wide / No-ball)
  const extraProb = Math.max(0.015, 0.068 - bowler.bowling.lineLengthAccuracy * 0.00055 + (dewPenalty > 0 ? 0.012 : 0));
  if (rng() < extraProb) {
    const isWide = rng() < 0.8;
    const extraType = isWide ? 'WIDE' : 'NOBALL';
    inn.runs += 1;
    inn.extras += 1;
    curBowlerStats.runsConceded += 1;
    if (isWide) curBowlerStats.wides += 1;
    else curBowlerStats.noBalls += 1;
    inn.bowlerStats[bowler.id] = curBowlerStats;

    const outcome: BallOutcome = {
      innings: state.currentInnings,
      over: overIndex,
      ballInOver,
      batterId: striker.id,
      bowlerId: bowler.id,
      runsScored: 0,
      extraRuns: 1,
      extraType,
      isBoundaryFour: false,
      isBoundarySix: false,
      isWicket: false,
      commentary: `${overIndex}.${ballInOver}: ${bowler.name} strays—${isWide ? 'Wide called' : 'No-ball overstepping'}. 1 extra.`,
      shotAngleDeg: 0,
      shotDistanceRatio: 0.1,
    };
    inn.recentBalls = [outcome, ...inn.recentBalls].slice(0, 18);
    return finalizeBallState(state, inn, outcome);
  }

  // Legal delivery
  inn.ballsCompleted += 1;
  const curStrikerStats = { ...inn.batterStats[striker.id] };
  curStrikerStats.balls += 1;
  curBowlerStats.ballsBowled += 1;

  // Fielding average for ground saves & catches
  const bowlXI = bowlTeam.selectedXIIds
    .map((id) => playerMap.get(id))
    .filter((p): p is Player => Boolean(p));
  const avgGroundField =
    bowlXI.reduce((s, p) => s + p.fielding.groundFielding + p.physical.sprintSpeed * 0.3, 0) /
    Math.max(1, bowlXI.length);
  const avgOutfieldCatch =
    bowlXI.reduce((s, p) => s + p.fielding.catchingOutfield, 0) / Math.max(1, bowlXI.length);
  const avgCloseCatch =
    bowlXI.reduce((s, p) => s + p.fielding.catchingCloseIn + p.physical.agilityReflexes * 0.25, 0) /
    Math.max(1, bowlXI.length);

  // Matchup differential
  const skillEdge = (batSkill - bowlSkill) / 100; // typically -0.30 to +0.30
  const aggFactor = (striker.mindset.aggression - 60) / 220 + (batDir.battingTempoBoost + batDir.boundaryAggression) / 220;
  const boundarySizeMod =
    pitch.boundarySize === 'small' ? 0.055 : pitch.boundarySize === 'large' ? -0.04 : 0;

  // Wicket Probability
  const wicketBase =
    0.044 -
    skillEdge * 0.045 +
    Math.max(0, aggFactor) * 0.028 +
    (bowler.mindset.aggression - 60) * 0.00025 -
    (batDir.rotateStrikeFocus > 4 ? 0.008 : 0);
  const wicketProb = Math.max(0.018, Math.min(0.11, wicketBase));

  const roll = rng();
  const shotAngleDeg = Math.round(rng() * 360);

  if (roll < wicketProb) {
    // Check if fielding catch drops!
    const kindRoll = rng();
    let wicketKind: BallOutcome['wicketKind'] = 'CAUGHT';
    let fielderId: string | undefined;

    if (kindRoll < 0.22) {
      wicketKind = 'BOWLED';
    } else if (kindRoll < 0.34) {
      wicketKind = 'LBW';
    } else if (kindRoll < 0.42 && bowler.isSpinBowler && keeper.fielding.wicketkeeping > 65) {
      wicketKind = 'STUMPED';
      fielderId = keeper.id;
    } else if (kindRoll < 0.48) {
      wicketKind = 'RUN_OUT';
      const fielder = bowlXI[Math.floor(rng() * bowlXI.length)];
      fielderId = fielder?.id;
    } else {
      wicketKind = 'CAUGHT';
      const isClose = rng() < 0.38;
      const catchChance = (isClose ? avgCloseCatch : avgOutfieldCatch) / 100;
      if (rng() > Math.min(0.95, catchChance + 0.14)) {
        // Dropped catch! Single scored
        curStrikerStats.runs += 1;
        inn.runs += 1;
        curBowlerStats.runsConceded += 1;
        curBowlerStats.tiltLevel = 0;
        inn.batterStats[striker.id] = curStrikerStats;
        inn.bowlerStats[bowler.id] = curBowlerStats;
        const temp = inn.strikerId;
        inn.strikerId = inn.nonStrikerId;
        inn.nonStrikerId = temp;

        const outcome: BallOutcome = {
          innings: state.currentInnings,
          over: overIndex,
          ballInOver,
          batterId: striker.id,
          bowlerId: bowler.id,
          runsScored: 1,
          extraRuns: 0,
          extraType: 'NONE',
          isBoundaryFour: false,
          isBoundarySix: false,
          isWicket: false,
          isNearMiss: true,
          nearMissReason: 'Dropped Catch',
          commentary: `${overIndex}.${ballInOver}: NEAR MISS! Put down! Tough chance off ${bowler.name}, ${striker.name} scampers a single.`,
          shotAngleDeg,
          shotDistanceRatio: 0.65,
        };
        inn.recentBalls = [outcome, ...inn.recentBalls].slice(0, 18);
        return checkCheckpointsAndRotateOver(state, inn, outcome, teamsMap, playerMap);
      }
      const fielder = bowlXI[Math.floor(rng() * bowlXI.length)];
      fielderId = fielder?.id;
    }

    // Wicket confirmed
    inn.wickets += 1;
    curStrikerStats.isOut = true;
    const fielderName = fielderId ? playerMap.get(fielderId)?.name ?? 'fielder' : '';
    curStrikerStats.dismissalText =
      wicketKind === 'BOWLED'
        ? `b ${bowler.name}`
        : wicketKind === 'LBW'
        ? `lbw b ${bowler.name}`
        : wicketKind === 'STUMPED'
        ? `st ${fielderName} b ${bowler.name}`
        : wicketKind === 'RUN_OUT'
        ? `run out (${fielderName})`
        : fielderId === bowler.id
        ? `c & b ${bowler.name}`
        : `c ${fielderName} b ${bowler.name}`;

    if (wicketKind !== 'RUN_OUT') {
      curBowlerStats.wickets += 1;
    }
    curBowlerStats.dots += 1;
    curBowlerStats.tiltLevel = 0;
    inn.batterStats[striker.id] = curStrikerStats;
    inn.bowlerStats[bowler.id] = curBowlerStats;

    if (inn.nextBatterIndex < inn.battingOrderIds.length && inn.wickets < 10) {
      inn.strikerId = inn.battingOrderIds[inn.nextBatterIndex];
      inn.nextBatterIndex += 1;
    }

    const outcome: BallOutcome = {
      innings: state.currentInnings,
      over: overIndex,
      ballInOver,
      batterId: striker.id,
      bowlerId: bowler.id,
      runsScored: 0,
      extraRuns: 0,
      extraType: 'NONE',
      isBoundaryFour: false,
      isBoundarySix: false,
      isWicket: true,
      wicketKind,
      fielderId,
      commentary: `${overIndex}.${ballInOver}: WICKET! ${striker.name} ${curStrikerStats.dismissalText}!`,
      shotAngleDeg,
      shotDistanceRatio: 0.55,
    };
    inn.recentBalls = [outcome, ...inn.recentBalls].slice(0, 18);
    return checkCheckpointsAndRotateOver(state, inn, outcome, teamsMap, playerMap);
  }

  // Non-wicket outcome distribution: Dot, 1, 2, 3, 4, 6
  const powerBoost =
    (striker.batting.powerHitting + striker.physical.strength * 0.35 - 92) / 550 +
    (batDir.targetShortBoundary ? 0.015 : 0);
  const pSix = Math.max(
    0.015,
    Math.min(0.085, 0.036 + skillEdge * 0.06 + powerBoost + aggFactor * 0.04 + boundarySizeMod * 0.7)
  );
  const pFour = Math.max(
    0.075,
    Math.min(0.20, 0.115 + skillEdge * 0.085 + aggFactor * 0.04 + boundarySizeMod * 0.8 - (avgGroundField - 65) * 0.0007)
  );
  const pTwo =
    0.08 +
    (striker.batting.runningBetweenWickets + striker.physical.sprintSpeed - 120) * 0.0008 +
    (pitch.boundarySize === 'large' ? 0.035 : 0);
  const pOne = Math.max(0.24, 0.33 + batDir.rotateStrikeFocus * 0.006);
  const pDot = Math.max(0.20, 1 - (pSix + pFour + pTwo + pOne));

  const r2 = rng();
  let runsScored = 0;
  let isFour = false;
  let isSix = false;
  let shotDistanceRatio = 0.2;
  let commentary = '';
  let isNearMiss = false;
  let nearMissReason: string | undefined;

  if (r2 < pSix) {
    runsScored = 6;
    isSix = true;
    shotDistanceRatio = 1.0;
    curStrikerStats.sixes += 1;
    curBowlerStats.tiltLevel += 1;
    commentary = `${overIndex}.${ballInOver}: SIX! ${striker.name} launches ${bowler.name} deep over the ropes!`;
  } else if (r2 < pSix + pFour) {
    runsScored = 4;
    isFour = true;
    shotDistanceRatio = 0.94;
    curStrikerStats.fours += 1;
    curBowlerStats.tiltLevel += 1;
    commentary = `${overIndex}.${ballInOver}: FOUR! Crisp placement by ${striker.name} splits the fielders.`;
  } else if (r2 < pSix + pFour + pTwo) {
    runsScored = rng() < 0.12 && pitch.boundarySize === 'large' ? 3 : 2;
    shotDistanceRatio = 0.68;
    curBowlerStats.tiltLevel = 0;
    commentary = `${overIndex}.${ballInOver}: Sharp running! ${striker.name} & ${nonStriker.name} convert ${runsScored} runs.`;
  } else if (r2 < pSix + pFour + pTwo + pOne) {
    runsScored = 1;
    shotDistanceRatio = 0.48;
    curBowlerStats.tiltLevel = 0;
    commentary = `${overIndex}.${ballInOver}: Worked into the gap for a quick single.`;
  } else {
    runsScored = 0;
    shotDistanceRatio = 0.15;
    curBowlerStats.dots += 1;
    curBowlerStats.tiltLevel = 0;
    if (rng() < 0.24) {
      isNearMiss = true;
      const missRoll = rng();
      if (missRoll < 0.34) {
        nearMissReason = 'Close LBW Appeal';
        commentary = `${overIndex}.${ballInOver}: NEAR MISS! Loud LBW appeal against ${striker.name}—sliding just down leg!`;
      } else if (missRoll < 0.68 || !bowler.isSpinBowler) {
        nearMissReason = 'Beat Outside Edge';
        commentary = `${overIndex}.${ballInOver}: NEAR MISS! Beats ${striker.name}'s outside edge—whistling a whisker past off-stump!`;
      } else {
        nearMissReason = 'Shaved the Stumps';
        commentary = `${overIndex}.${ballInOver}: NEAR MISS! ${bowler.name} beats the inside edge—ball shaves past the bails!`;
      }
    } else {
      commentary = `${overIndex}.${ballInOver}: Dot ball. Tight line from ${bowler.name}.`;
    }
  }

  inn.runs += runsScored;
  curStrikerStats.runs += runsScored;
  curBowlerStats.runsConceded += runsScored;
  inn.batterStats[striker.id] = curStrikerStats;
  inn.bowlerStats[bowler.id] = curBowlerStats;

  if (runsScored % 2 === 1) {
    const temp = inn.strikerId;
    inn.strikerId = inn.nonStrikerId;
    inn.nonStrikerId = temp;
  }

  const outcome: BallOutcome = {
    innings: state.currentInnings,
    over: overIndex,
    ballInOver,
    batterId: striker.id,
    bowlerId: bowler.id,
    runsScored,
    extraRuns: 0,
    extraType: 'NONE',
    isBoundaryFour: isFour,
    isBoundarySix: isSix,
    isWicket: false,
    isNearMiss,
    nearMissReason,
    commentary,
    shotAngleDeg,
    shotDistanceRatio,
  };
  inn.recentBalls = [outcome, ...inn.recentBalls].slice(0, 18);

  return checkCheckpointsAndRotateOver(state, inn, outcome, teamsMap, playerMap);
}

export const SIM_KEY_EVENT_PAUSE_MS = 2000;

export type BallEventLabel = 'WICKET' | 'SIX' | 'FOUR' | 'NEAR MISS';

export function getBallEventLabel(ball: BallOutcome | null | undefined): BallEventLabel | null {
  if (!ball) return null;
  if (ball.isWicket) return 'WICKET';
  if (ball.isBoundarySix) return 'SIX';
  if (ball.isBoundaryFour) return 'FOUR';
  if (ball.isNearMiss) return 'NEAR MISS';
  return null;
}

export function isKeyMatchEventBall(ball: BallOutcome | null | undefined): boolean {
  return getBallEventLabel(ball) !== null;
}

function recordOverProgress(inn: InningsState): void {
  const overNum = Math.max(1, Math.min(20, Math.ceil(Math.max(1, inn.ballsCompleted) / 6)));
  const effectiveOvers = inn.ballsCompleted > 0 ? inn.ballsCompleted / 6 : 1 / 6;
  const runRate = Number((inn.runs / effectiveOvers).toFixed(2));
  const point: OverProgressPoint = {
    over: overNum,
    runs: inn.runs,
    wickets: inn.wickets,
    balls: inn.ballsCompleted,
    runRate,
  };
  const idx = inn.overProgress.findIndex((p) => p.over === overNum);
  if (idx >= 0) {
    inn.overProgress[idx] = point;
  } else {
    inn.overProgress.push(point);
  }
}

function finalizeBallState(state: MatchState, inn: InningsState, outcome: BallOutcome): MatchState {
  recordOverProgress(inn);
  const isInn1 = state.currentInnings === 1;
  const commentaryFeed = [outcome, ...state.commentaryFeed].slice(0, 60);

  // Check if chasing team passed target on an extra!
  if (!isInn1 && state.targetRuns !== null && inn.runs >= state.targetRuns) {
    return concludeMatch(
      { ...state, innings2: inn, commentaryFeed },
      inn.battingTeamId,
      `${inn.battingTeamId.toUpperCase()} won by ${10 - inn.wickets} wickets`
    );
  }

  return {
    ...state,
    innings1: isInn1 ? inn : state.innings1,
    innings2: isInn1 ? state.innings2 : inn,
    commentaryFeed,
  };
}

function checkCheckpointsAndRotateOver(
  state: MatchState,
  inn: InningsState,
  outcome: BallOutcome,
  teamsMap: Map<CityId, FranchiseTeam>,
  playerMap: Map<string, Player>
): MatchState {
  recordOverProgress(inn);
  const isInn1 = state.currentInnings === 1;
  const commentaryFeed = [outcome, ...state.commentaryFeed].slice(0, 60);
  const bowlTeam = teamsMap.get(inn.bowlingTeamId)!;
  const batTeam = teamsMap.get(inn.battingTeamId)!;

  // Check chase victory mid-over
  if (!isInn1 && state.targetRuns !== null && inn.runs >= state.targetRuns) {
    return concludeMatch(
      { ...state, innings2: inn, commentaryFeed },
      batTeam.id,
      `${batTeam.name} won by ${10 - inn.wickets} wickets`
    );
  }

  const inningsEnded = inn.ballsCompleted >= 120 || inn.wickets >= 10;

  if (inningsEnded) {
    if (isInn1) {
      const targetRuns = inn.runs + 1;
      const innings2 = initInnings(bowlTeam, batTeam, playerMap);
      return {
        ...state,
        innings1: inn,
        innings2,
        targetRuns,
        phase: 'CHECKPOINT_TACTICS',
        activeCheckpoint: 'INNINGS_BREAK',
        commentaryFeed,
      };
    }

    // End of 2nd innings
    if (state.targetRuns !== null) {
      if (inn.runs >= state.targetRuns) {
        return concludeMatch(
          { ...state, innings2: inn, commentaryFeed },
          batTeam.id,
          `${batTeam.name} won by ${10 - inn.wickets} wickets`
        );
      }
      if (inn.runs === state.targetRuns - 1) {
        // Super over tie-breaker resolved cleanly by higher Clutch & Boundary count
        const tieWinner = state.innings1.runs > inn.runs ? state.innings1.battingTeamId : batTeam.id;
        return concludeMatch(
          { ...state, innings2: inn, commentaryFeed },
          tieWinner,
          `${teamsMap.get(tieWinner)?.name ?? tieWinner} won via Super Over tie-breaker`
        );
      }
      const margin = state.targetRuns - 1 - inn.runs;
      return concludeMatch(
        { ...state, innings2: inn, commentaryFeed },
        bowlTeam.id,
        `${bowlTeam.name} won by ${margin} runs`
      );
    }
  }

  // Over rotation every 6 legal balls
  let nextPhase: MatchState['phase'] = state.phase;
  let nextCheckpoint: TacticalCheckpoint | null = state.activeCheckpoint;

  if (inn.ballsCompleted % 6 === 0 && inn.ballsCompleted > 0) {
    const temp = inn.strikerId;
    inn.strikerId = inn.nonStrikerId;
    inn.nonStrikerId = temp;
    inn.lastBowlerId = inn.currentBowlerId;

    const nextOverNum = Math.floor(inn.ballsCompleted / 6);
    const bowlDir = !batTeam.isUser ? state.userDirectives : state.aiDirectives;
    inn.currentBowlerId = chooseNextBowler(
      bowlTeam.selectedXIIds,
      inn.bowlerStats,
      inn.lastBowlerId,
      nextOverNum,
      playerMap,
      bowlDir,
      batTeam.city
    );

    // Powerplay checkpoint after Over 6 (36 balls)
    if (inn.ballsCompleted === 36) {
      nextPhase = 'CHECKPOINT_TACTICS';
      nextCheckpoint = isInn1 ? 'POWERPLAY_1_END' : 'POWERPLAY_2_END';
    }
  }

  return {
    ...state,
    innings1: isInn1 ? inn : state.innings1,
    innings2: isInn1 ? state.innings2 : inn,
    phase: nextPhase,
    activeCheckpoint: nextCheckpoint,
    commentaryFeed,
  };
}

function concludeMatch(state: MatchState, winnerId: CityId, resultText: string): MatchState {
  return {
    ...state,
    phase: 'COMPLETED',
    activeCheckpoint: null,
    winnerId,
    resultText,
  };
}

export function simulateQuickMatch(
  fixture: Fixture,
  homeTeam: FranchiseTeam,
  awayTeam: FranchiseTeam,
  playerMap: Map<string, Player>,
  rng: () => number = Math.random,
  completedFixtures: Fixture[] = []
): MatchState {
  const teamsMap = new Map<CityId, FranchiseTeam>([
    [homeTeam.id, homeTeam],
    [awayTeam.id, awayTeam],
  ]);

  let state = createMatchState(fixture, homeTeam, awayTeam, playerMap, rng, completedFixtures);
  state = { ...state, phase: 'LIVE', activeCheckpoint: null };

  let safety = 0;
  while (state.phase !== 'COMPLETED' && safety < 400) {
    safety++;
    if (state.phase === 'CHECKPOINT_TACTICS') {
      if (state.activeCheckpoint === 'INNINGS_BREAK' && state.innings2) {
        state = { ...state, currentInnings: 2, phase: 'LIVE', activeCheckpoint: null };
      } else {
        state = { ...state, phase: 'LIVE', activeCheckpoint: null };
      }
      continue;
    }
    state = simulateNextBall(state, teamsMap, playerMap, rng);
  }
  return state;
}

export function formatOvers(balls: number): string {
  const ov = Math.floor(balls / 6);
  const rem = balls % 6;
  return `${ov}.${rem}`;
}

export interface RunRateChartPoint {
  over: number;
  overLabel: string;
  inn1RunRate: number | null;
  inn1Score: string | null;
  inn2RunRate: number | null;
  inn2Score: string | null;
}

export function buildRunRateChartData(
  innings1: InningsState,
  innings2: InningsState | null
): RunRateChartPoint[] {
  const map1 = new Map(innings1.overProgress.map((p) => [p.over, p]));
  const map2 = new Map((innings2?.overProgress ?? []).map((p) => [p.over, p]));
  const maxOver = Math.max(
    innings1.overProgress.length > 0 ? Math.max(...innings1.overProgress.map((p) => p.over)) : 0,
    innings2 && innings2.overProgress.length > 0
      ? Math.max(...innings2.overProgress.map((p) => p.over))
      : 0
  );

  if (maxOver === 0) return [];

  const points: RunRateChartPoint[] = [];
  for (let ov = 1; ov <= maxOver; ov++) {
    const p1 = map1.get(ov);
    const p2 = map2.get(ov);
    points.push({
      over: ov,
      overLabel: `Ov ${ov}`,
      inn1RunRate: p1 ? p1.runRate : null,
      inn1Score: p1 ? `${p1.runs}/${p1.wickets}` : null,
      inn2RunRate: p2 ? p2.runRate : null,
      inn2Score: p2 ? `${p2.runs}/${p2.wickets}` : null,
    });
  }
  return points;
}


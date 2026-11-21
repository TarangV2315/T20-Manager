import { PITCH_PROFILES, pickMatchWeather } from './cities';
import { selectBestXI } from './matchEngine';
import { CityId, FranchiseTeam, Player } from './types';

export const INITIAL_PURSE_L = 100; // INR 1 Cr = 100 Lakhs
export const BASE_PRICE_L = 1; // INR 1L
export const MAX_ROSTER_SIZE = 25;
export const TARGET_AUTO_SQUAD_SIZE = 25;
export const SQUAD_U19_QUOTA = 5;
export const SQUAD_FOREIGN_QUOTA = 6;
export const SQUAD_INDIAN_SENIOR_QUOTA = 14;

export type SquadImbalanceProfile =
  | 'PINCH_HITTERS_LOW_SPIN'
  | 'SPIN_HEAVY'
  | 'PINCH_HITTERS_DEATH_PACE'
  | 'SWING_DEW_ALL_ROUNDERS'
  | 'ALL_ROUNDER_HEAVY'
  | 'ATHLETIC_PACE_LOW_SPIN'
  | 'WRIST_SPIN_TALL_PACE';

export interface FranchiseSquadBlueprint {
  profile: SquadImbalanceProfile;
  targetBatters: number;
  targetAllRounders: number;
  targetSpinners: number;
  maxSpinners: number;
  targetPacers: number;
}

export const FRANCHISE_ROSTER_BLUEPRINTS: Record<CityId, FranchiseSquadBlueprint> = {
  // Mumbai: True bounce + humid/overcast coast -> heavy pinch hitters & pace, intentionally short on spinners
  mumbai: {
    profile: 'PINCH_HITTERS_LOW_SPIN',
    targetBatters: 10,
    targetAllRounders: 4,
    targetSpinners: 1,
    maxSpinners: 2,
    targetPacers: 7,
  },
  // Chennai: Slow turning track + dry heat -> spin-heavy squad, light on express pace
  chennai: {
    profile: 'SPIN_HEAVY',
    targetBatters: 7,
    targetAllRounders: 5,
    targetSpinners: 7,
    maxSpinners: 9,
    targetPacers: 3,
  },
  // Bengaluru: Flat deck, small boundaries -> overloaded with pinch hitters/finishers, thin on spinners
  bengaluru: {
    profile: 'PINCH_HITTERS_DEATH_PACE',
    targetBatters: 11,
    targetAllRounders: 4,
    targetSpinners: 1,
    maxSpinners: 2,
    targetPacers: 6,
  },
  // Kolkata: Balanced deck + heavy evening dew & overcast -> swing bowlers & chasing all-rounders
  kolkata: {
    profile: 'SWING_DEW_ALL_ROUNDERS',
    targetBatters: 7,
    targetAllRounders: 7,
    targetSpinners: 3,
    maxSpinners: 4,
    targetPacers: 6,
  },
  // Delhi: Two-paced, tacky surface + dry heat -> cutter/variation all-rounder heavy
  delhi: {
    profile: 'ALL_ROUNDER_HEAVY',
    targetBatters: 6,
    targetAllRounders: 8,
    targetSpinners: 4,
    maxSpinners: 5,
    targetPacers: 5,
  },
  // Hyderabad: Good track that slows later + dry heat -> excess of dual-role all-rounders, fewer pure batters
  hyderabad: {
    profile: 'ALL_ROUNDER_HEAVY',
    targetBatters: 5,
    targetAllRounders: 9,
    targetSpinners: 4,
    maxSpinners: 6,
    targetPacers: 5,
  },
  // Ahmedabad: Large boundaries, true bounce + heat -> athletic gap-hitters & pace, intentionally not enough spinners
  ahmedabad: {
    profile: 'ATHLETIC_PACE_LOW_SPIN',
    targetBatters: 9,
    targetAllRounders: 5,
    targetSpinners: 1,
    maxSpinners: 2,
    targetPacers: 7,
  },
  // Jaipur: Dry surface, variable bounce + dry heat -> wrist-spin & tall pace heavy, fewer pure pinch hitters
  jaipur: {
    profile: 'WRIST_SPIN_TALL_PACE',
    targetBatters: 6,
    targetAllRounders: 5,
    targetSpinners: 6,
    maxSpinners: 8,
    targetPacers: 5,
  },
};

export function createInitialTeams(userCityId: CityId): FranchiseTeam[] {
  return (Object.keys(PITCH_PROFILES) as CityId[]).map((id) => {
    const profile = PITCH_PROFILES[id];
    return {
      id,
      city: profile.city,
      name: profile.franchiseName,
      shortCode: profile.shortCode,
      isUser: id === userCityId,
      purseRemainingL: INITIAL_PURSE_L,
      rosterIds: [],
      selectedXIIds: [],
      captainId: null,
      wicketkeeperId: null,
    };
  });
}

function getTeamRosterPlayers(team: FranchiseTeam, playerMap: Map<string, Player>): Player[] {
  return team.rosterIds
    .map((id) => playerMap.get(id))
    .filter((p): p is Player => Boolean(p));
}

function getMinReserveNeeded(team: FranchiseTeam, minTarget = TARGET_AUTO_SQUAD_SIZE): number {
  const slotsLeftToMin = Math.max(0, minTarget - team.rosterIds.length - 1);
  return slotsLeftToMin * BASE_PRICE_L;
}

/**
 * Evaluates a player's franchise valuation (in INR Lakhs) based on city pitch, typical weather,
 * and squad archetype needs.
 */
export function evaluatePlayerValueForTeam(
  team: FranchiseTeam,
  player: Player,
  playerMap: Map<string, Player>
): number {
  const pitch = PITCH_PROFILES[team.id];
  const dominantWeather = pickMatchWeather(team.id, 1, 0);
  const roster = getTeamRosterPlayers(team, playerMap);
  const blueprint = FRANCHISE_ROSTER_BLUEPRINTS[team.id];

  const batterCount = roster.filter((p) => p.role === 'BATTER').length;
  const allRounderCount = roster.filter((p) => p.role === 'ALL_ROUNDER').length;
  const spinCount = roster.filter((p) => p.isSpinBowler).length;
  const paceCount = roster.filter((p) => p.isPaceBowler).length;
  const wkCount = roster.filter((p) => p.role === 'WICKETKEEPER').length;

  let fitBonus = 0;

  // Pitch & dominant weather affinity (tapered if already abundant in role)
  if (pitch.spinFactor > 1.1 && player.isSpinBowler && spinCount < blueprint.maxSpinners) fitBonus += 7;
  if ((pitch.spinFactor > 1.1 || dominantWeather === 'DRY_HEAT') && player.batting.techniqueVsSpin >= 74) {
    fitBonus += 4;
  }
  if ((pitch.paceFactor > 1.1 || dominantWeather === 'OVERCAST') && player.isPaceBowler && paceCount < blueprint.targetPacers + 2) {
    fitBonus += 6;
  }
  if (dominantWeather === 'OVERCAST' && (player.bowlingStyle === 'Right-Arm Swing' || player.bowling.movement >= 72) && paceCount < blueprint.targetPacers + 2) {
    fitBonus += 5;
  }
  if (dominantWeather === 'HUMID_DEW' && (player.batting.powerHitting >= 74 || player.bowling.variations >= 72)) {
    fitBonus += 4;
  }
  if (pitch.boundarySize === 'small' && (player.batting.powerHitting >= 74 || player.batting.situational.finisher >= 10)) {
    fitBonus += 6;
  }
  if (pitch.boundarySize === 'large' && (player.physical.sprintSpeed >= 74 || player.batting.timingPlacement >= 74)) {
    fitBonus += 5;
  }
  if (pitch.variableBounce > 0.35 && (player.bowlingStyle.includes('Wrist-Spin') || (player.isPaceBowler && player.heightCm >= 184))) {
    fitBonus += 7;
  }

  // Deliberate franchise roster imbalance steering
  if (blueprint.profile === 'PINCH_HITTERS_LOW_SPIN' || blueprint.profile === 'PINCH_HITTERS_DEATH_PACE') {
    if ((player.role === 'BATTER' || player.batting.powerHitting >= 74) && batterCount < blueprint.targetBatters + 2) {
      fitBonus += 15;
    }
    if (player.batting.powerHitting >= 76 || player.mindset.aggression >= 72) {
      fitBonus += 7;
    }
    if (player.isSpinBowler && spinCount >= blueprint.maxSpinners) {
      fitBonus -= 32;
    }
  } else if (blueprint.profile === 'ALL_ROUNDER_HEAVY') {
    if (player.role === 'ALL_ROUNDER' && allRounderCount < blueprint.targetAllRounders) {
      fitBonus += 20;
    } else if (player.role === 'BATTER' && batterCount >= blueprint.targetBatters) {
      fitBonus -= 8;
    }
  } else if (blueprint.profile === 'SPIN_HEAVY') {
    if (player.isSpinBowler && spinCount < blueprint.targetSpinners + 2) {
      fitBonus += 18;
    } else if (player.isPaceBowler && paceCount >= blueprint.targetPacers + 1) {
      fitBonus -= 10;
    } else if (player.isPaceBowler && paceCount < 2) {
      fitBonus += 8;
    }
  } else if (blueprint.profile === 'ATHLETIC_PACE_LOW_SPIN') {
    if (player.isSpinBowler && spinCount >= blueprint.maxSpinners) {
      fitBonus -= 30;
    }
    if (player.isPaceBowler && paceCount < blueprint.targetPacers + 1) {
      fitBonus += 10;
    }
  } else if (blueprint.profile === 'SWING_DEW_ALL_ROUNDERS') {
    if (player.role === 'ALL_ROUNDER' && allRounderCount < blueprint.targetAllRounders) {
      fitBonus += 15;
    }
    if (player.isSpinBowler && spinCount >= blueprint.maxSpinners) {
      fitBonus -= 16;
    }
    if (player.role === 'BATTER' && batterCount < blueprint.targetBatters) {
      fitBonus += 10;
    }
  } else if (blueprint.profile === 'WRIST_SPIN_TALL_PACE') {
    if (player.isSpinBowler && spinCount < blueprint.targetSpinners + 1) {
      fitBonus += 14;
    }
  }

  if (wkCount === 0 && player.role === 'WICKETKEEPER') fitBonus += 18;
  if (wkCount >= 3 && player.role === 'WICKETKEEPER') fitBonus -= 10;

  const rawRating = player.overallRating + fitBonus;
  let value = 1;
  if (rawRating >= 92) value = 9;
  else if (rawRating >= 85) value = 7;
  else if (rawRating >= 78) value = 5;
  else if (rawRating >= 70) value = 3;
  else if (rawRating >= 62) value = 2;
  else value = 1;

  const hardCap = team.purseRemainingL - getMinReserveNeeded(team, TARGET_AUTO_SQUAD_SIZE);
  return Math.max(0, Math.min(value, hardCap));
}

function buildCategoryDraftSchedule(): ('INDIAN_SENIOR' | 'INDIAN_U19' | 'FOREIGN')[] {
  // 25 picks total: 6 FOREIGN, 5 INDIAN_U19, 14 INDIAN_SENIOR — interleaved for fair star distribution
  return [
    'FOREIGN',
    'INDIAN_SENIOR',
    'FOREIGN',
    'INDIAN_SENIOR',
    'INDIAN_U19',
    'FOREIGN',
    'INDIAN_SENIOR',
    'INDIAN_SENIOR',
    'INDIAN_U19',
    'FOREIGN',
    'INDIAN_SENIOR',
    'INDIAN_SENIOR',
    'INDIAN_U19',
    'FOREIGN',
    'INDIAN_SENIOR',
    'INDIAN_SENIOR',
    'INDIAN_U19',
    'FOREIGN',
    'INDIAN_SENIOR',
    'INDIAN_SENIOR',
    'INDIAN_SENIOR',
    'INDIAN_U19',
    'INDIAN_SENIOR',
    'INDIAN_SENIOR',
    'INDIAN_SENIOR',
  ];
}

/**
 * Generates 25-player pitch/weather-varied squads for all 8 franchises directly without an auction.
 * Exact per-team composition:
 * - 25 total players
 * - 5 Indian U19 players
 * - 6 Foreign internationals
 * - 14 Indian Senior players
 * Intentional roster imbalances reflect franchise pitch & weather profiles (pinch-hitter heavy,
 * all-rounder excess, spin-heavy, or thin on spinners).
 */
export function assignInitialSeasonSquads(
  userCityId: CityId,
  players: Player[]
): { teams: FranchiseTeam[]; players: Player[] } {
  const nextPlayers = players.map((p) => ({
    ...p,
    soldToTeamId: null as CityId | null,
    soldPriceL: null as number | null,
  }));
  const nextTeams = createInitialTeams(userCityId);
  const playerMap = new Map(nextPlayers.map((p) => [p.id, p]));
  const available = [...nextPlayers].sort((a, b) => b.overallRating - a.overallRating);

  const schedule = buildCategoryDraftSchedule();

  for (let roundIdx = 0; roundIdx < schedule.length; roundIdx++) {
    const roundCategory = schedule[roundIdx];
    const orderedTeams = roundIdx % 2 === 0 ? nextTeams : [...nextTeams].reverse();

    for (const team of orderedTeams) {
      if (team.rosterIds.length >= TARGET_AUTO_SQUAD_SIZE) continue;

      const roster = getTeamRosterPlayers(team, playerMap);
      const blueprint = FRANCHISE_ROSTER_BLUEPRINTS[team.id];
      const wkCount = roster.filter((p) => p.role === 'WICKETKEEPER').length;
      const bowlerCount = roster.filter(
        (p) => p.role === 'BOWLER' || p.role === 'ALL_ROUNDER'
      ).length;
      const spinCount = roster.filter((p) => p.isSpinBowler).length;
      const allRounderCount = roster.filter((p) => p.role === 'ALL_ROUNDER').length;
      const batterCount = roster.filter((p) => p.role === 'BATTER').length;

      // Guarantee each team locks in >=1 wicketkeeper and >=5 bowling options before late rounds
      const mustPickWK = wkCount === 0 && roundIdx >= 14;
      const mustPickBowler = bowlerCount < 5 && roundIdx >= 18;

      let bestPick: Player | null = null;
      let bestScore = -Infinity;

      for (const p of available) {
        if (p.soldToTeamId !== null || p.category !== roundCategory) continue;
        if (mustPickWK && p.role !== 'WICKETKEEPER') continue;
        if (mustPickBowler && p.role !== 'BOWLER' && p.role !== 'ALL_ROUNDER') continue;

        let score = p.overallRating + evaluatePlayerValueForTeam(team, p, playerMap) * 2.2;

        // Extra imbalance weighting to distinguish squads cleanly across 25 spots
        if (
          (blueprint.profile === 'PINCH_HITTERS_LOW_SPIN' ||
            blueprint.profile === 'PINCH_HITTERS_DEATH_PACE') &&
          p.isSpinBowler &&
          spinCount >= blueprint.maxSpinners
        ) {
          score -= 48;
        }
        if (
          blueprint.profile === 'ATHLETIC_PACE_LOW_SPIN' &&
          p.isSpinBowler &&
          spinCount >= blueprint.maxSpinners
        ) {
          score -= 45;
        }
        if (blueprint.profile === 'ALL_ROUNDER_HEAVY') {
          if (p.role === 'ALL_ROUNDER' && allRounderCount < blueprint.targetAllRounders) {
            score += 34;
          } else if (p.role === 'BATTER' && batterCount >= blueprint.targetBatters) {
            score -= 14;
          }
        }
        if (blueprint.profile === 'SPIN_HEAVY' && p.isSpinBowler && spinCount < blueprint.targetSpinners) {
          score += 36;
        }
        if (
          (blueprint.profile === 'PINCH_HITTERS_LOW_SPIN' ||
            blueprint.profile === 'PINCH_HITTERS_DEATH_PACE') &&
          p.role === 'BATTER' &&
          batterCount < blueprint.targetBatters
        ) {
          score += 24 + (p.batting.powerHitting >= 72 ? 12 : 0);
        }

        if (score > bestScore) {
          bestScore = score;
          bestPick = p;
        }
      }

      // Fallback if strict role filter found nothing in category
      const pick =
        bestPick ??
        available.find((p) => p.soldToTeamId === null && p.category === roundCategory);
      if (!pick) continue;

      const slotsRemainingAfter = Math.max(0, TARGET_AUTO_SQUAD_SIZE - team.rosterIds.length - 1);
      const minTradeReserve = 15;
      const maxAffordableWithReserve = Math.max(
        BASE_PRICE_L,
        team.purseRemainingL - slotsRemainingAfter - minTradeReserve
      );
      const rawVal = Math.max(BASE_PRICE_L, Math.round(evaluatePlayerValueForTeam(team, pick, playerMap) * 0.55));
      const contractCost = Math.max(
        BASE_PRICE_L,
        Math.min(team.purseRemainingL - slotsRemainingAfter, Math.min(rawVal, maxAffordableWithReserve))
      );

      pick.soldToTeamId = team.id;
      pick.soldPriceL = contractCost;
      team.purseRemainingL -= contractCost;
      team.rosterIds.push(pick.id);
    }
  }

  const readyTeams = nextTeams.map((t) => {
    const best = selectBestXI(t, playerMap, t.id);
    return {
      ...t,
      selectedXIIds: best.xiIds,
      captainId: best.captainId,
      wicketkeeperId: best.wicketkeeperId,
    };
  });

  return { teams: readyTeams, players: nextPlayers };
}

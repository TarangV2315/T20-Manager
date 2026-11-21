import { PITCH_PROFILES } from './cities';
import {
  CityId,
  Fixture,
  HeadToHeadSummary,
  MatchRivalryContext,
  RivalryDefinition,
  TeamRivalryLedgerEntry,
} from './types';

export const RIVALRY_PAIRS: RivalryDefinition[] = [
  {
    id: 'riv-mum-che',
    teamA: 'mumbai',
    teamB: 'chennai',
    name: 'Championship Clasico',
    narrative: 'Heavyweight title rivals with decades of high-stakes playoff battles.',
    baseWinsA: 20,
    baseWinsB: 17,
    lastWinnerId: 'mumbai',
    streakTeamId: 'mumbai',
    streakCount: 1,
  },
  {
    id: 'riv-mum-blr',
    teamA: 'mumbai',
    teamB: 'bengaluru',
    name: 'Coastal-Plateau Slugfest',
    narrative: 'Explosive batting orders clash across two premier boundary-hitting hubs.',
    baseWinsA: 19,
    baseWinsB: 15,
    lastWinnerId: 'mumbai',
    streakTeamId: 'mumbai',
    streakCount: 2,
  },
  {
    id: 'riv-mum-amd',
    teamA: 'mumbai',
    teamB: 'ahmedabad',
    name: 'Western Express Derby',
    narrative: 'Modern western corridor rivalry fueled by contrasting pace and power philosophies.',
    baseWinsA: 4,
    baseWinsB: 7,
    lastWinnerId: 'ahmedabad',
    streakTeamId: 'ahmedabad',
    streakCount: 2,
  },
  {
    id: 'riv-che-blr',
    teamA: 'chennai',
    teamB: 'bengaluru',
    name: 'Kaveri Clash',
    narrative: 'Spin control meets raw boundary firepower in a fiercely contested southern derby.',
    baseWinsA: 21,
    baseWinsB: 11,
    lastWinnerId: 'chennai',
    streakTeamId: 'chennai',
    streakCount: 2,
  },
  {
    id: 'riv-che-hyd',
    teamA: 'chennai',
    teamB: 'hyderabad',
    name: 'Coromandel-Deccan Duel',
    narrative: 'Tactical bowling attacks duel on gripping surfaces across the southern coast.',
    baseWinsA: 15,
    baseWinsB: 6,
    lastWinnerId: 'chennai',
    streakTeamId: 'chennai',
    streakCount: 1,
  },
  {
    id: 'riv-kol-blr',
    teamA: 'kolkata',
    teamB: 'bengaluru',
    name: 'Knights vs Blasters',
    narrative: 'High-drama rivalry rooted in historic opening-night fireworks.',
    baseWinsA: 20,
    baseWinsB: 14,
    lastWinnerId: 'kolkata',
    streakTeamId: 'kolkata',
    streakCount: 2,
  },
  {
    id: 'riv-kol-mum',
    teamA: 'kolkata',
    teamB: 'mumbai',
    name: 'Harbour-Riverfront Rivalry',
    narrative: 'Mumbai holds a long historical edge, putting added pressure on Kolkata.',
    baseWinsA: 11,
    baseWinsB: 23,
    lastWinnerId: 'mumbai',
    streakTeamId: 'mumbai',
    streakCount: 2,
  },
  {
    id: 'riv-kol-del',
    teamA: 'kolkata',
    teamB: 'delhi',
    name: 'Eden-Kotla Heritage',
    narrative: 'Two founding franchises battling for tactical supremacy.',
    baseWinsA: 18,
    baseWinsB: 15,
    lastWinnerId: 'kolkata',
    streakTeamId: 'kolkata',
    streakCount: 1,
  },
  {
    id: 'riv-del-jai',
    teamA: 'delhi',
    teamB: 'jaipur',
    name: 'North-West Fort Derby',
    narrative: 'Tightly matched regional rivals separated by razor-thin historical margins.',
    baseWinsA: 14,
    baseWinsB: 16,
    lastWinnerId: 'jaipur',
    streakTeamId: 'jaipur',
    streakCount: 1,
  },
  {
    id: 'riv-hyd-blr',
    teamA: 'hyderabad',
    teamB: 'bengaluru',
    name: 'Deccan-Garden Derby',
    narrative: 'Neighbouring franchises with a long history of last-over thrillers.',
    baseWinsA: 13,
    baseWinsB: 11,
    lastWinnerId: 'hyderabad',
    streakTeamId: 'hyderabad',
    streakCount: 1,
  },
  {
    id: 'riv-hyd-del',
    teamA: 'hyderabad',
    teamB: 'delhi',
    name: 'Deccan-Capital Clash',
    narrative: 'Fast-bowling units go head-to-head in gritty middle-overs contests.',
    baseWinsA: 13,
    baseWinsB: 12,
    lastWinnerId: 'delhi',
    streakTeamId: 'delhi',
    streakCount: 1,
  },
  {
    id: 'riv-amd-jai',
    teamA: 'ahmedabad',
    teamB: 'jaipur',
    name: 'Sabarmati-Aravalli Derby',
    narrative: 'Western frontier showdown defined by large boundaries and sharp bounce.',
    baseWinsA: 6,
    baseWinsB: 2,
    lastWinnerId: 'ahmedabad',
    streakTeamId: 'ahmedabad',
    streakCount: 2,
  },
];

export function getRivalryDefinition(
  teamA: CityId,
  teamB: CityId
): RivalryDefinition | null {
  return (
    RIVALRY_PAIRS.find(
      (r) =>
        (r.teamA === teamA && r.teamB === teamB) ||
        (r.teamA === teamB && r.teamB === teamA)
    ) ?? null
  );
}

export function getHeadToHeadRecord(
  teamA: CityId,
  teamB: CityId,
  completedFixtures: Fixture[] = []
): HeadToHeadSummary {
  const def = getRivalryDefinition(teamA, teamB);

  let teamAWins = 0;
  let teamBWins = 0;
  let lastWinnerId: CityId | null = null;
  let currentStreakTeamId: CityId | null = null;
  let currentStreakCount = 0;

  if (def) {
    const isDirect = def.teamA === teamA;
    teamAWins = isDirect ? def.baseWinsA : def.baseWinsB;
    teamBWins = isDirect ? def.baseWinsB : def.baseWinsA;
    lastWinnerId = def.lastWinnerId;
    currentStreakTeamId = def.streakTeamId;
    currentStreakCount = def.streakCount;
  }

  const seasonMatches = completedFixtures
    .filter(
      (f) =>
        f.completed &&
        f.winnerId !== null &&
        ((f.homeTeamId === teamA && f.awayTeamId === teamB) ||
          (f.homeTeamId === teamB && f.awayTeamId === teamA))
    )
    .sort((a, b) => a.roundNumber - b.roundNumber);

  for (const f of seasonMatches) {
    if (!f.winnerId) continue;
    if (f.winnerId === teamA) teamAWins += 1;
    else if (f.winnerId === teamB) teamBWins += 1;

    if (currentStreakTeamId === f.winnerId) {
      currentStreakCount += 1;
    } else {
      currentStreakTeamId = f.winnerId;
      currentStreakCount = 1;
    }
    lastWinnerId = f.winnerId;
  }

  return {
    teamA,
    teamB,
    teamAWins,
    teamBWins,
    totalPlayed: teamAWins + teamBWins,
    seasonMatchesPlayed: seasonMatches.length,
    lastWinnerId,
    currentStreakTeamId,
    currentStreakCount,
  };
}

function buildMoraleSummary(
  teamId: CityId,
  oppId: CityId,
  wins: number,
  oppWins: number,
  lastWinnerId: CityId | null,
  streakCount: number,
  morale: number
): string {
  const teamCode = PITCH_PROFILES[teamId].shortCode;
  const oppCode = PITCH_PROFILES[oppId].shortCode;
  const lastText =
    lastWinnerId === teamId
      ? streakCount >= 2
        ? `${streakCount}-match winning streak vs ${oppCode}`
        : `won last meeting vs ${oppCode}`
      : lastWinnerId === oppId
      ? streakCount >= 2
        ? `${streakCount}-match skid vs ${oppCode}`
        : `lost last meeting to ${oppCode}`
      : 'even recent meetings';

  if (morale > 0) {
    return `${teamCode} leads H2H ${wins}–${oppWins} (${lastText}) → +${morale} Tactical Morale Boost`;
  }
  if (morale < 0) {
    return `${teamCode} trails H2H ${wins}–${oppWins} (${lastText}) → ${morale} Tactical Morale Penalty`;
  }
  return `Balanced H2H ${wins}–${oppWins} (${lastText}) → Even Tactical Morale (0)`;
}

export function computeRivalryMoraleForMatch(
  homeTeamId: CityId,
  awayTeamId: CityId,
  completedFixtures: Fixture[] = []
): MatchRivalryContext | null {
  const def = getRivalryDefinition(homeTeamId, awayTeamId);
  if (!def) return null;

  const h2h = getHeadToHeadRecord(homeTeamId, awayTeamId, completedFixtures);
  const diff = h2h.teamAWins - h2h.teamBWins; // positive = homeTeamId leads

  let baseBoost = 0;
  if (diff >= 5) baseBoost = 3;
  else if (diff >= 1) baseBoost = 2;
  else if (diff <= -5) baseBoost = -3;
  else if (diff <= -1) baseBoost = -2;

  let formBoost = 0;
  if (h2h.lastWinnerId === homeTeamId) {
    formBoost = h2h.currentStreakCount >= 2 ? 2 : 1;
  } else if (h2h.lastWinnerId === awayTeamId) {
    formBoost = h2h.currentStreakCount >= 2 ? -2 : -1;
  }

  const homeMorale = Math.max(-5, Math.min(5, baseBoost + formBoost));
  const awayMorale = -homeMorale;

  return {
    rivalryId: def.id,
    rivalryName: def.name,
    narrative: def.narrative,
    homeTeamId,
    awayTeamId,
    homeWins: h2h.teamAWins,
    awayWins: h2h.teamBWins,
    seasonMatchesPlayed: h2h.seasonMatchesPlayed,
    lastWinnerId: h2h.lastWinnerId,
    currentStreakTeamId: h2h.currentStreakTeamId,
    currentStreakCount: h2h.currentStreakCount,
    homeMorale,
    awayMorale,
    homeSummary: buildMoraleSummary(
      homeTeamId,
      awayTeamId,
      h2h.teamAWins,
      h2h.teamBWins,
      h2h.lastWinnerId,
      h2h.currentStreakCount,
      homeMorale
    ),
    awaySummary: buildMoraleSummary(
      awayTeamId,
      homeTeamId,
      h2h.teamBWins,
      h2h.teamAWins,
      h2h.lastWinnerId,
      h2h.currentStreakCount,
      awayMorale
    ),
  };
}

export function getTeamRivalryLedger(
  teamId: CityId,
  completedFixtures: Fixture[] = []
): TeamRivalryLedgerEntry[] {
  const entries: TeamRivalryLedgerEntry[] = [];
  for (const def of RIVALRY_PAIRS) {
    if (def.teamA !== teamId && def.teamB !== teamId) continue;
    const opponentId = def.teamA === teamId ? def.teamB : def.teamA;
    const ctx = computeRivalryMoraleForMatch(teamId, opponentId, completedFixtures);
    if (!ctx) continue;
    const userMorale = ctx.homeMorale;
    const moraleLabel =
      userMorale > 0
        ? `+${userMorale} Boost`
        : userMorale < 0
        ? `${userMorale} Penalty`
        : 'Even (0)';
    entries.push({
      rivalryId: def.id,
      rivalryName: def.name,
      opponentId,
      userWins: ctx.homeWins,
      opponentWins: ctx.awayWins,
      lastWinnerId: ctx.lastWinnerId,
      userMorale,
      moraleLabel,
    });
  }
  return entries;
}

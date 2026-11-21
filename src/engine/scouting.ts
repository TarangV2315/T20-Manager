import { applyWeatherToPitch, PITCH_PROFILES, WEATHER_PROFILES } from './cities';
import {
  CityId,
  FranchiseTeam,
  OpponentScoutingReport,
  Player,
  PlayerRole,
  WeatherCondition,
} from './types';

export interface ScoutResult {
  parsedSummary: string;
  topPlayers: Player[];
}

const LOCATION_ALIASES: Record<string, string[]> = {
  mumbai: ['mumbai', 'bombay', 'maharashtra'],
  chennai: ['chennai', 'madras', 'tamil nadu', 'chepauk'],
  delhi: ['delhi', 'ncr', 'kotla'],
  bengaluru: ['bengaluru', 'bangalore', 'karnataka'],
  kolkata: ['kolkata', 'calcutta', 'bengal', 'eden'],
  hyderabad: ['hyderabad', 'telangana', 'deccan'],
  ahmedabad: ['ahmedabad', 'gujarat', 'baroda', 'rajkot', 'motera'],
  jaipur: ['jaipur', 'rajasthan'],
  pune: ['pune'],
  chandigarh: ['chandigarh', 'punjab'],
  lucknow: ['lucknow', 'up', 'uttar pradesh'],
  nagpur: ['nagpur'],
  indore: ['indore', 'mp'],
  kochi: ['kochi', 'kerala'],
  ranchi: ['ranchi', 'jharkhand'],
  kanpur: ['kanpur'],
  sydney: ['sydney'],
  melbourne: ['melbourne'],
  perth: ['perth'],
  london: ['london'],
  auckland: ['auckland'],
  johannesburg: ['johannesburg'],
  colombo: ['colombo'],
  kabul: ['kabul'],
};

const NATIONALITY_ALIASES: Record<string, string[]> = {
  India: ['india', 'indian', 'domestic', 'local'],
  Australia: ['australia', 'australian', 'aussie'],
  England: ['england', 'english', 'british', 'uk'],
  'South Africa': ['south africa', 'south african', 'proteas', 'sa'],
  'New Zealand': ['new zealand', 'kiwi', 'kiwis', 'nz'],
  'West Indies': ['west indies', 'windies', 'caribbean', 'wi'],
  Afghanistan: ['afghanistan', 'afghan'],
  'Sri Lanka': ['sri lanka', 'sri lankan', 'lankan'],
};

export function scoutPlayers(players: Player[], rawQuery: string): ScoutResult {
  const q = rawQuery.trim().toLowerCase();
  const tokens = q.split(/[\s,;/]+/).filter(Boolean);

  // Filters extracted from query
  let wantU19 = /\bu19\b|under[- ]?19|youngster|teen|youth/.test(q);
  let wantForeign: boolean | null = null;
  if (/\bforeign\b|\boverseas\b|\binternational\b/.test(q)) wantForeign = true;
  if (/\bindian\b|\bdomestic\b|\blocal\b/.test(q)) wantForeign = false;

  let maxAge: number | null = null;
  let minAge: number | null = null;
  const underAgeMatch = q.match(/(?:under|below|<|<=)\s*(\d{2})/);
  if (underAgeMatch) {
    maxAge = parseInt(underAgeMatch[1], 10);
    if (maxAge <= 19) wantU19 = true;
  }
  const overAgeMatch = q.match(/(?:over|above|senior|>|>=)\s*(\d{2})/);
  if (overAgeMatch) {
    minAge = parseInt(overAgeMatch[1], 10);
  }
  const rangeMatch = q.match(/(\d{2})\s*[-to]+\s*(\d{2})/);
  if (rangeMatch) {
    minAge = parseInt(rangeMatch[1], 10);
    maxAge = parseInt(rangeMatch[2], 10);
  }
  if (/\byoung\b/.test(q) && maxAge === null) maxAge = 23;
  if (/\bveteran\b|\bexperienced\b/.test(q) && minAge === null) minAge = 28;

  // Location detection
  const matchedLocations: string[] = [];
  for (const [loc, aliases] of Object.entries(LOCATION_ALIASES)) {
    if (aliases.some((a) => q.includes(a))) {
      matchedLocations.push(loc);
    }
  }

  // Nationality detection
  const matchedNationalities: string[] = [];
  for (const [nat, aliases] of Object.entries(NATIONALITY_ALIASES)) {
    if (aliases.some((a) => q.includes(a))) {
      matchedNationalities.push(nat);
    }
  }

  // Role detection
  const matchedRoles: PlayerRole[] = [];
  if (/\bbatter\b|\bbatsman\b|\bbatsmen\b|\bbatting\b|\bopener\b/.test(q)) matchedRoles.push('BATTER');
  if (/\bbowler\b|\bbowlers\b|\bbowling\b/.test(q)) matchedRoles.push('BOWLER');
  if (/\ball[- ]?rounder\b|\ballrounder\b/.test(q)) matchedRoles.push('ALL_ROUNDER');
  if (/\bwicket[- ]?keeper\b|\bkeeper\b|\bwk\b/.test(q)) matchedRoles.push('WICKETKEEPER');

  // Specialized skill emphasis
  const wantSpin = /\bspin\b|\bspinner\b|\boff[- ]?spin\b|\borthodox\b|\bwrist\b|\bleg[- ]?spin\b|\bgoogly\b/.test(q);
  const wantWristSpin = /\bwrist\b|\bleg[- ]?spin\b|\bchinaman\b/.test(q);
  const wantPace = /\bpace\b|\bfast\b|\bexpress\b|\bswing\b|\bseam\b|\bpacer\b/.test(q);
  const wantDeath = /\bdeath\b|\byorker\b|\bvariations\b|\bslower\b/.test(q);
  const wantPowerplay = /\bpowerplay\b|\bpp\b|\bopener\b|\bnew ball\b/.test(q);
  const wantAnchor = /\banchor\b|\bmiddle\b|\bconsistent\b|\bconsistency\b/.test(q);
  const wantFinisher = /\bfinisher\b|\bpower\b|\bsix\b|\bslogger\b|\bbig hitter\b|\bhitter\b/.test(q);
  const wantLeader = /\bcaptain\b|\bleader\b|\bleadership\b/.test(q);
  const wantClutch = /\bclutch\b|\bpressure\b/.test(q);
  const wantSpeed = /\bspeed\b|\bfast runner\b|\bsprint\b|\bfielding\b|\bfielder\b|\bathletic\b/.test(q);
  const wantLeft = /\bleft\b|\blhb\b/.test(q);

  const summaryParts: string[] = [];
  if (wantU19) summaryParts.push('U19');
  if (wantForeign === true) summaryParts.push('Foreign');
  if (wantForeign === false) summaryParts.push('Indian');
  if (matchedNationalities.length) summaryParts.push(matchedNationalities.join('/'));
  if (matchedLocations.length) summaryParts.push(`Location: ${matchedLocations.map((l) => l[0].toUpperCase() + l.slice(1)).join(', ')}`);
  if (maxAge) summaryParts.push(`Age <= ${maxAge}`);
  if (minAge) summaryParts.push(`Age >= ${minAge}`);
  if (matchedRoles.length) summaryParts.push(matchedRoles.join(' / '));
  if (wantSpin) summaryParts.push('Spin');
  if (wantPace) summaryParts.push('Pace');
  if (wantDeath) summaryParts.push('Death/Variations');
  if (wantFinisher) summaryParts.push('Power/Finisher');
  if (wantPowerplay) summaryParts.push('Powerplay');
  if (wantAnchor) summaryParts.push('Anchor');
  if (wantLeader) summaryParts.push('Leadership');

  // Filter unsold players first; if too few, consider all players
  const unsoldPool = players.filter((p) => p.soldToTeamId === null);
  const pool = unsoldPool.length >= 5 ? unsoldPool : players;

  const scored = pool.map((p) => {
    let matchScore = 0;
    let hardMismatch = false;

    if (wantU19) {
      if (p.category === 'INDIAN_U19') matchScore += 35;
      else hardMismatch = true;
    }
    if (wantForeign === true) {
      if (p.category === 'FOREIGN') matchScore += 28;
      else hardMismatch = true;
    } else if (wantForeign === false) {
      if (p.category !== 'FOREIGN') matchScore += 22;
      else hardMismatch = true;
    }

    if (matchedNationalities.length > 0) {
      if (matchedNationalities.includes(p.nationality)) matchScore += 35;
      else hardMismatch = true;
    }

    if (maxAge !== null) {
      if (p.age <= maxAge) matchScore += 18;
      else hardMismatch = true;
    }
    if (minAge !== null) {
      if (p.age >= minAge) matchScore += 18;
      else hardMismatch = true;
    }

    if (matchedLocations.length > 0) {
      const pLoc = p.homeLocation.toLowerCase();
      if (matchedLocations.some((loc) => pLoc.includes(loc))) {
        matchScore += 32;
      } else {
        matchScore -= 18;
      }
    }

    if (matchedRoles.length > 0) {
      if (matchedRoles.includes(p.role)) {
        matchScore += 25;
      } else if (p.role === 'ALL_ROUNDER' && (matchedRoles.includes('BATTER') || matchedRoles.includes('BOWLER'))) {
        matchScore += 10;
      } else {
        matchScore -= 24;
      }
    }

    if (wantSpin) {
      if (p.isSpinBowler) matchScore += 28;
      else matchScore -= 25;
      if (wantWristSpin && p.bowlingStyle.includes('Wrist-Spin')) matchScore += 16;
    }
    if (wantPace) {
      if (p.isPaceBowler) matchScore += 28;
      else matchScore -= 25;
    }
    if (wantLeft) {
      if (p.battingHand === 'LHB' || p.bowlingStyle.includes('Left-Arm')) matchScore += 18;
    }

    // Skill-based ranking contribution
    let skillBonus = p.overallRating * 0.65;
    if (wantDeath) {
      skillBonus += p.bowling.variations * 0.45 + p.bowling.controlUnderAssault * 0.25 + p.batting.situational.finisher * 0.6;
    }
    if (wantFinisher) {
      skillBonus += p.batting.powerHitting * 0.45 + p.batting.situational.finisher * 0.9 + p.physical.strength * 0.2;
    }
    if (wantPowerplay) {
      skillBonus += p.batting.situational.powerplaySpecialist * 0.9 + p.bowling.movement * 0.35;
    }
    if (wantAnchor) {
      skillBonus += p.batting.timingPlacement * 0.4 + p.batting.situational.middleOversAnchor * 0.9 + p.mindset.consistency * 0.25;
    }
    if (wantLeader) {
      skillBonus += p.mindset.leadership * 0.65 + p.mindset.tacticalAwareness * 0.35;
    }
    if (wantClutch) {
      skillBonus += p.batting.clutchFactor * 0.55 + p.bowling.controlUnderAssault * 0.3;
    }
    if (wantSpeed) {
      skillBonus += p.physical.sprintSpeed * 0.4 + p.fielding.groundFielding * 0.4 + p.physical.agilityReflexes * 0.25;
    }

    // Free-text token bonus on player name and location (avoid double-counting generic 'spin'/'pace' words)
    const ignoredStyleTokens = new Set(['spin', 'pace', 'arm', 'bowler', 'batter', 'u19']);
    for (const t of tokens) {
      if (t.length >= 3) {
        if (p.name.toLowerCase().includes(t)) matchScore += 45;
        if (p.homeLocation.toLowerCase().includes(t)) matchScore += 22;
        if (!ignoredStyleTokens.has(t) && p.bowlingStyle.toLowerCase().includes(t)) {
          matchScore += 16;
        }
      }
    }

    const totalScore = (hardMismatch ? -200 : 0) + matchScore + skillBonus;
    return { player: p, totalScore };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);
  const topPlayers = scored.slice(0, 5).map((s) => s.player);

  return {
    parsedSummary:
      summaryParts.length > 0
        ? summaryParts.join(' · ')
        : `General Top Prospects ("${rawQuery.trim() || 'Best Available'}")`,
    topPlayers,
  };
}

export function generateOpponentScoutingReport(
  opponentTeam: FranchiseTeam,
  allPlayers: Player[],
  venueCityId: CityId,
  weather: WeatherCondition = 'CLEAR'
): OpponentScoutingReport {
  const weatherProfile = WEATHER_PROFILES[weather];
  const venueCity = applyWeatherToPitch(PITCH_PROFILES[venueCityId], weather);
  const playerMap = new Map(allPlayers.map((p) => [p.id, p]));
  const opponentXI = opponentTeam.selectedXIIds
    .map((id) => playerMap.get(id))
    .filter((p): p is Player => Boolean(p));

  // Identify top 3 players to watch based on venue pitch profile & peak skills
  const rankedThreats = opponentXI
    .map((p) => {
      let score = p.overallRating;
      let threatLabel = 'Key Match-Winner';
      let scoutingAdvice = `Strong all-round metrics (${p.overallRating} OVR). Avoid feeding easy scoring zones.`;

      if (venueCity.spinFactor > 1.1 && p.isSpinBowler) {
        score += 18;
        threatLabel = 'Pitch-Suited Spin Threat';
        scoutingAdvice = `${p.bowlingStyle} (${p.bowling.paceOrRevolution} Rev / ${p.bowling.variations} Var) will extract sharp turn on ${venueCity.city}'s deck.`;
      } else if (venueCity.paceFactor > 1.1 && p.isPaceBowler) {
        score += 16;
        threatLabel =
          weather === 'OVERCAST' ? 'Overcast Swing & Pace Speartip' : 'Pace & Bounce Speartip';
        scoutingAdvice = `${p.bowlingStyle} with ${p.bowling.movement} Movement & ${p.bowling.paceOrRevolution} Pace will test top-order footwork.`;
      } else if (p.batting.powerHitting >= 78 || p.batting.situational.finisher >= 14) {
        score += 14;
        threatLabel = 'Explosive Boundary Hitter';
        scoutingAdvice = `Power Hitting ${p.batting.powerHitting}, Clutch ${p.batting.clutchFactor}. Deprive pace on the ball with cutters and wide yorkers.`;
      } else if (p.batting.timingPlacement >= 80) {
        score += 12;
        threatLabel = 'Precision Anchor';
        scoutingAdvice = `Timing ${p.batting.timingPlacement} & vs Spin ${p.batting.techniqueVsSpin}. Cut off singles with tight ring fielding.`;
      } else if (p.bowling.variations >= 78) {
        score += 13;
        threatLabel = 'Death Overs Specialist';
        scoutingAdvice = `${p.bowling.variations} Variations and ${p.bowling.controlUnderAssault} Control Under Assault. Attack early before death overs.`;
      }

      return { player: p, score, threatLabel, scoutingAdvice };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const pitchSummary = `${venueCity.stadium} (${venueCity.city}): ${venueCity.surfaceSummary}. Weather: ${weatherProfile.label} (${weatherProfile.summary}) Boundaries: ${venueCity.boundarySize.toUpperCase()} · Dew Probability: ${Math.round(
    venueCity.dewFactor * 100
  )}%.`;

  return {
    venueCity,
    weather: weatherProfile,
    opponentTeam,
    opponentXI,
    pitchSummary,
    playersToWatch: rankedThreats.map(({ player, threatLabel, scoutingAdvice }) => ({
      player,
      threatLabel,
      scoutingAdvice,
    })),
  };
}

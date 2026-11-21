import { formatOvers } from './matchEngine';
import {
  CityId,
  FranchiseTeam,
  InningsState,
  MatchState,
  Player,
} from './types';

export type MilestoneTier = 'GOLD' | 'SILVER' | 'NOTABLE';

export interface PlayerMilestoneItem {
  id: string;
  playerId: string;
  playerName: string;
  teamId: CityId;
  teamShortCode: string;
  category: 'BATTING' | 'BOWLING' | 'ALL_ROUND';
  milestoneTitle: string;
  tier: MilestoneTier;
  statLine: string;
  detail: string;
}

export interface PlayerOfMatchSummary {
  playerId: string;
  playerName: string;
  teamId: CityId;
  teamShortCode: string;
  impactScore: number;
  summaryLine: string;
}

export interface TeamReportLeader {
  teamId: CityId;
  teamShortCode: string;
  teamName: string;
  scoreText: string;
  fours: number;
  sixes: number;
  topBatterLine: string;
  topBowlerLine: string;
}

export interface MatchBattingHighlight {
  playerId: string;
  playerName: string;
  teamId: CityId;
  teamShortCode: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  strikeRate: number;
  statLine: string;
}

export interface MatchBowlingHighlight {
  playerId: string;
  playerName: string;
  teamId: CityId;
  teamShortCode: string;
  wickets: number;
  runsConceded: number;
  ballsBowled: number;
  oversText: string;
  economy: number;
  dots: number;
  statLine: string;
}

export interface MatchPerformanceReport {
  fixtureId: string;
  resultText: string;
  isCompleted: boolean;
  playerOfTheMatch: PlayerOfMatchSummary | null;
  highestScorer: MatchBattingHighlight | null;
  bestBowler: MatchBowlingHighlight | null;
  milestones: PlayerMilestoneItem[];
  teamSummaries: TeamReportLeader[];
  totals: {
    runs: number;
    wickets: number;
    fours: number;
    sixes: number;
  };
}

interface CombinedPlayerContribution {
  player: Player;
  teamId: CityId;
  teamShortCode: string;
  batRuns: number;
  batBalls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  didBat: boolean;
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  dots: number;
}

const TIER_WEIGHT: Record<MilestoneTier, number> = {
  GOLD: 3,
  SILVER: 2,
  NOTABLE: 1,
};

function collectContributions(
  match: MatchState,
  teamsMap: Map<CityId, FranchiseTeam>,
  playerMap: Map<string, Player>
): Map<string, CombinedPlayerContribution> {
  const map = new Map<string, CombinedPlayerContribution>();
  const inningsList = [match.innings1, match.innings2].filter(
    (inn): inn is InningsState => Boolean(inn)
  );

  const ensureEntry = (playerId: string, teamId: CityId): CombinedPlayerContribution | null => {
    const existing = map.get(playerId);
    if (existing) return existing;
    const player = playerMap.get(playerId);
    if (!player) return null;
    const team = teamsMap.get(teamId);
    const created: CombinedPlayerContribution = {
      player,
      teamId,
      teamShortCode: team?.shortCode ?? teamId.toUpperCase(),
      batRuns: 0,
      batBalls: 0,
      fours: 0,
      sixes: 0,
      isOut: false,
      didBat: false,
      ballsBowled: 0,
      runsConceded: 0,
      wickets: 0,
      dots: 0,
    };
    map.set(playerId, created);
    return created;
  };

  for (const inn of inningsList) {
    for (const [pid, bat] of Object.entries(inn.batterStats)) {
      const entry = ensureEntry(pid, inn.battingTeamId);
      if (!entry) continue;
      entry.batRuns += bat.runs;
      entry.batBalls += bat.balls;
      entry.fours += bat.fours;
      entry.sixes += bat.sixes;
      entry.isOut = entry.isOut || bat.isOut;
      if (
        bat.balls > 0 ||
        bat.isOut ||
        inn.strikerId === pid ||
        inn.nonStrikerId === pid
      ) {
        entry.didBat = true;
      }
    }

    for (const [pid, bowl] of Object.entries(inn.bowlerStats)) {
      if (bowl.ballsBowled === 0 && bowl.runsConceded === 0 && bowl.wickets === 0) continue;
      const entry = ensureEntry(pid, inn.bowlingTeamId);
      if (!entry) continue;
      entry.ballsBowled += bowl.ballsBowled;
      entry.runsConceded += bowl.runsConceded;
      entry.wickets += bowl.wickets;
      entry.dots += bowl.dots;
    }
  }

  return map;
}

export function generateMatchPerformanceReport(
  match: MatchState,
  teamsMap: Map<CityId, FranchiseTeam>,
  playerMap: Map<string, Player>
): MatchPerformanceReport {
  const contributions = collectContributions(match, teamsMap, playerMap);
  const milestones: PlayerMilestoneItem[] = [];

  let bestMvp: PlayerOfMatchSummary | null = null;
  let bestBatEntry: CombinedPlayerContribution | null = null;
  let bestBowlEntry: CombinedPlayerContribution | null = null;

  for (const c of contributions.values()) {
    const sr = c.batBalls > 0 ? Number(((c.batRuns / c.batBalls) * 100).toFixed(1)) : 0;
    const econ =
      c.ballsBowled > 0 ? Number((c.runsConceded / (c.ballsBowled / 6)).toFixed(2)) : 0;

    if (c.didBat && (c.batRuns > 0 || c.batBalls > 0)) {
      if (
        !bestBatEntry ||
        c.batRuns > bestBatEntry.batRuns ||
        (c.batRuns === bestBatEntry.batRuns && c.batBalls < bestBatEntry.batBalls) ||
        (c.batRuns === bestBatEntry.batRuns &&
          c.batBalls === bestBatEntry.batBalls &&
          !c.isOut &&
          bestBatEntry.isOut)
      ) {
        bestBatEntry = c;
      }
    }

    if (c.ballsBowled > 0) {
      const bestBowlEcon =
        bestBowlEntry && bestBowlEntry.ballsBowled > 0
          ? bestBowlEntry.runsConceded / (bestBowlEntry.ballsBowled / 6)
          : Infinity;
      const curBowlEcon = c.runsConceded / (c.ballsBowled / 6);
      if (
        !bestBowlEntry ||
        c.wickets > bestBowlEntry.wickets ||
        (c.wickets === bestBowlEntry.wickets && c.runsConceded < bestBowlEntry.runsConceded) ||
        (c.wickets === bestBowlEntry.wickets &&
          c.runsConceded === bestBowlEntry.runsConceded &&
          curBowlEcon < bestBowlEcon) ||
        (c.wickets === bestBowlEntry.wickets &&
          c.runsConceded === bestBowlEntry.runsConceded &&
          curBowlEcon === bestBowlEcon &&
          c.dots > bestBowlEntry.dots)
      ) {
        bestBowlEntry = c;
      }
    }

    // 1. Batting Milestones
    if (c.batRuns >= 100) {
      milestones.push({
        id: `${c.player.id}-century`,
        playerId: c.player.id,
        playerName: c.player.name,
        teamId: c.teamId,
        teamShortCode: c.teamShortCode,
        category: 'BATTING',
        milestoneTitle: 'Century',
        tier: 'GOLD',
        statLine: `${c.batRuns}${c.isOut ? '' : '*'} (${c.batBalls}) · ${c.fours}x4 ${c.sixes}x6`,
        detail: `Commanding ton at ${sr.toFixed(1)} SR, anchoring the innings.`,
      });
    } else if (c.batRuns >= 50) {
      milestones.push({
        id: `${c.player.id}-fifty`,
        playerId: c.player.id,
        playerName: c.player.name,
        teamId: c.teamId,
        teamShortCode: c.teamShortCode,
        category: 'BATTING',
        milestoneTitle: 'Half-Century',
        tier: 'SILVER',
        statLine: `${c.batRuns}${c.isOut ? '' : '*'} (${c.batBalls}) · ${c.fours}x4 ${c.sixes}x6`,
        detail: `Composed fifty at ${sr.toFixed(1)} SR with ${c.fours + c.sixes} boundaries.`,
      });
    } else if (c.batRuns >= 30 && c.batBalls >= 10 && sr >= 165) {
      milestones.push({
        id: `${c.player.id}-blitz`,
        playerId: c.player.id,
        playerName: c.player.name,
        teamId: c.teamId,
        teamShortCode: c.teamShortCode,
        category: 'BATTING',
        milestoneTitle: 'Impact Cameo',
        tier: 'NOTABLE',
        statLine: `${c.batRuns}${c.isOut ? '' : '*'} (${c.batBalls}) · SR ${sr.toFixed(1)}`,
        detail: `High-tempo strike rate burst shifted scoring momentum.`,
      });
    }

    if (c.sixes >= 4) {
      milestones.push({
        id: `${c.player.id}-sixes`,
        playerId: c.player.id,
        playerName: c.player.name,
        teamId: c.teamId,
        teamShortCode: c.teamShortCode,
        category: 'BATTING',
        milestoneTitle: 'Maximums Barrage',
        tier: 'NOTABLE',
        statLine: `${c.sixes} Sixes · ${c.batRuns} (${c.batBalls})`,
        detail: `Cleared the ropes ${c.sixes} times to pressure the fielding ring.`,
      });
    }

    // 2. Bowling Milestones
    if (c.wickets >= 5) {
      milestones.push({
        id: `${c.player.id}-5w`,
        playerId: c.player.id,
        playerName: c.player.name,
        teamId: c.teamId,
        teamShortCode: c.teamShortCode,
        category: 'BOWLING',
        milestoneTitle: 'Five-Wicket Haul',
        tier: 'GOLD',
        statLine: `${c.wickets}/${c.runsConceded} (${formatOvers(c.ballsBowled)} ov) · Econ ${econ.toFixed(2)}`,
        detail: `Match-defining 5-for with ${c.dots} dot balls.`,
      });
    } else if (c.wickets === 4) {
      milestones.push({
        id: `${c.player.id}-4w`,
        playerId: c.player.id,
        playerName: c.player.name,
        teamId: c.teamId,
        teamShortCode: c.teamShortCode,
        category: 'BOWLING',
        milestoneTitle: 'Four-Wicket Haul',
        tier: 'SILVER',
        statLine: `${c.wickets}/${c.runsConceded} (${formatOvers(c.ballsBowled)} ov) · Econ ${econ.toFixed(2)}`,
        detail: `Relentless breakthrough spell dismantled the batting lineup.`,
      });
    } else if (c.wickets === 3) {
      milestones.push({
        id: `${c.player.id}-3w`,
        playerId: c.player.id,
        playerName: c.player.name,
        teamId: c.teamId,
        teamShortCode: c.teamShortCode,
        category: 'BOWLING',
        milestoneTitle: 'Three-Wicket Spell',
        tier: 'SILVER',
        statLine: `${c.wickets}/${c.runsConceded} (${formatOvers(c.ballsBowled)} ov) · Econ ${econ.toFixed(2)}`,
        detail: `Triple strike paired with ${c.dots} dot deliveries.`,
      });
    } else if (c.ballsBowled >= 18 && econ <= 6.0) {
      milestones.push({
        id: `${c.player.id}-econ`,
        playerId: c.player.id,
        playerName: c.player.name,
        teamId: c.teamId,
        teamShortCode: c.teamShortCode,
        category: 'BOWLING',
        milestoneTitle: 'Tight Lockdown Spell',
        tier: 'NOTABLE',
        statLine: `${c.wickets}/${c.runsConceded} (${formatOvers(c.ballsBowled)} ov) · Econ ${econ.toFixed(2)}`,
        detail: `Conceded ${econ.toFixed(2)} RPO across ${formatOvers(c.ballsBowled)} overs (${c.dots} dots).`,
      });
    }

    // 3. All-Round Milestone
    if (c.batRuns >= 30 && c.wickets >= 2) {
      milestones.push({
        id: `${c.player.id}-allround`,
        playerId: c.player.id,
        playerName: c.player.name,
        teamId: c.teamId,
        teamShortCode: c.teamShortCode,
        category: 'ALL_ROUND',
        milestoneTitle: 'All-Round Double',
        tier: 'GOLD',
        statLine: `${c.batRuns} (${c.batBalls}) & ${c.wickets}/${c.runsConceded}`,
        detail: `Delivered with both bat and ball across both innings.`,
      });
    }

    // 4. MVP / Impact Score calculation
    const onWinningSide = match.winnerId === c.teamId ? 12 : 0;
    const impactScore = Number(
      (
        c.batRuns +
        c.sixes * 2 +
        c.fours +
        (c.batRuns >= 50 ? 15 : 0) +
        (c.batRuns >= 100 ? 25 : 0) +
        c.wickets * 22 +
        (c.wickets >= 3 ? 12 : 0) +
        (c.wickets >= 5 ? 25 : 0) +
        (c.ballsBowled >= 12 && econ <= 6.5 ? 10 : 0) +
        onWinningSide
      ).toFixed(1)
    );

    if (
      (c.didBat || c.ballsBowled > 0) &&
      (!bestMvp || impactScore > bestMvp.impactScore)
    ) {
      const parts: string[] = [];
      if (c.batRuns > 0 || c.batBalls > 0) {
        parts.push(`${c.batRuns}${c.isOut ? '' : '*'} (${c.batBalls})`);
      }
      if (c.ballsBowled > 0) {
        parts.push(`${c.wickets}/${c.runsConceded} (${formatOvers(c.ballsBowled)} ov)`);
      }
      bestMvp = {
        playerId: c.player.id,
        playerName: c.player.name,
        teamId: c.teamId,
        teamShortCode: c.teamShortCode,
        impactScore,
        summaryLine: parts.join(' · ') || 'Match contributor',
      };
    }
  }

  milestones.sort(
    (a, b) =>
      TIER_WEIGHT[b.tier] - TIER_WEIGHT[a.tier] ||
      a.category.localeCompare(b.category) ||
      a.playerName.localeCompare(b.playerName)
  );

  // Team summaries
  const inningsList = [match.innings1, match.innings2].filter(
    (inn): inn is InningsState => Boolean(inn)
  );

  const teamSummaries: TeamReportLeader[] = inningsList.map((inn) => {
    const batTeam = teamsMap.get(inn.battingTeamId);
    const batStats = Object.values(inn.batterStats);
    const bowlStats = Object.values(inn.bowlerStats).filter((b) => b.ballsBowled > 0);

    const fours = batStats.reduce((s, b) => s + b.fours, 0);
    const sixes = batStats.reduce((s, b) => s + b.sixes, 0);

    const topBat = [...batStats].sort(
      (a, b) => b.runs - a.runs || a.balls - b.balls
    )[0];
    const topBatPlayer = topBat ? playerMap.get(topBat.playerId) : undefined;
    const topBatterLine =
      topBat && topBatPlayer && topBat.balls > 0
        ? `${topBatPlayer.name} ${topBat.runs}${topBat.isOut ? '' : '*'} (${topBat.balls})`
        : '—';

    // Top bowler for this team is found in the OTHER innings where they bowled, or fallback
    const otherInn = inningsList.find((x) => x.bowlingTeamId === inn.battingTeamId);
    const teamBowlStats = otherInn
      ? Object.values(otherInn.bowlerStats).filter((b) => b.ballsBowled > 0)
      : [];
    const topBowl = [...teamBowlStats].sort(
      (a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded
    )[0];
    const topBowlPlayer = topBowl ? playerMap.get(topBowl.playerId) : undefined;
    const topBowlerLine =
      topBowl && topBowlPlayer
        ? `${topBowlPlayer.name} ${topBowl.wickets}/${topBowl.runsConceded} (${formatOvers(
            topBowl.ballsBowled
          )})`
        : bowlStats.length > 0
        ? 'Bowled in opposite innings'
        : 'Yet to bowl';

    return {
      teamId: inn.battingTeamId,
      teamShortCode: batTeam?.shortCode ?? inn.battingTeamId.toUpperCase(),
      teamName: batTeam?.name ?? inn.battingTeamId,
      scoreText: `${inn.runs}/${inn.wickets} (${formatOvers(inn.ballsCompleted)} ov)`,
      fours,
      sixes,
      topBatterLine,
      topBowlerLine,
    };
  });

  const totals = inningsList.reduce(
    (acc, inn) => {
      const batStats = Object.values(inn.batterStats);
      acc.runs += inn.runs;
      acc.wickets += inn.wickets;
      acc.fours += batStats.reduce((s, b) => s + b.fours, 0);
      acc.sixes += batStats.reduce((s, b) => s + b.sixes, 0);
      return acc;
    },
    { runs: 0, wickets: 0, fours: 0, sixes: 0 }
  );

  const highestScorer: MatchBattingHighlight | null = bestBatEntry
    ? (() => {
        const sr =
          bestBatEntry.batBalls > 0
            ? Number(((bestBatEntry.batRuns / bestBatEntry.batBalls) * 100).toFixed(1))
            : 0;
        return {
          playerId: bestBatEntry.player.id,
          playerName: bestBatEntry.player.name,
          teamId: bestBatEntry.teamId,
          teamShortCode: bestBatEntry.teamShortCode,
          runs: bestBatEntry.batRuns,
          balls: bestBatEntry.batBalls,
          fours: bestBatEntry.fours,
          sixes: bestBatEntry.sixes,
          isOut: bestBatEntry.isOut,
          strikeRate: sr,
          statLine: `${bestBatEntry.batRuns}${bestBatEntry.isOut ? '' : '*'} (${bestBatEntry.batBalls}b) · ${bestBatEntry.fours}x4 ${bestBatEntry.sixes}x6 · SR ${sr.toFixed(1)}`,
        };
      })()
    : null;

  const bestBowler: MatchBowlingHighlight | null = bestBowlEntry
    ? (() => {
        const oversText = formatOvers(bestBowlEntry.ballsBowled);
        const econ =
          bestBowlEntry.ballsBowled > 0
            ? Number((bestBowlEntry.runsConceded / (bestBowlEntry.ballsBowled / 6)).toFixed(2))
            : 0;
        return {
          playerId: bestBowlEntry.player.id,
          playerName: bestBowlEntry.player.name,
          teamId: bestBowlEntry.teamId,
          teamShortCode: bestBowlEntry.teamShortCode,
          wickets: bestBowlEntry.wickets,
          runsConceded: bestBowlEntry.runsConceded,
          ballsBowled: bestBowlEntry.ballsBowled,
          oversText,
          economy: econ,
          dots: bestBowlEntry.dots,
          statLine: `${bestBowlEntry.wickets}/${bestBowlEntry.runsConceded} (${oversText} ov) · Econ ${econ.toFixed(2)}`,
        };
      })()
    : null;

  return {
    fixtureId: match.fixtureId,
    resultText: match.resultText,
    isCompleted: match.phase === 'COMPLETED',
    playerOfTheMatch: bestMvp,
    highestScorer,
    bestBowler,
    milestones,
    teamSummaries,
    totals,
  };
}

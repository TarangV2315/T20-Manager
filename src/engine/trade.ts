import { MAX_ROSTER_SIZE } from './squadSetup';
import { PITCH_PROFILES } from './cities';
import { selectBestXI } from './matchEngine';
import {
  CityId,
  FranchiseTeam,
  Player,
  TradeEvaluationResult,
  TradeProposal,
} from './types';

export const MAX_PLAYERS_PER_TRADE_SIDE = 3;
export const MIN_ROSTER_AFTER_TRADE = 11;
export const CASH_VALUE_PER_LAKH = 1.8;
export const MAX_CASH_ADJUSTMENT_L = 25;
export const FAIRNESS_RATIO_THRESHOLD = 0.94;
export const MAX_STAR_OVR_GAP = 12;

/**
 * Computes a player's trade value from the perspective of a target franchise's pitch profile,
 * overall rating, U19 scarcity, and current fitness/injury status.
 */
export function computePlayerTradeValue(player: Player, evaluatingTeamId: CityId): number {
  const pitch = PITCH_PROFILES[evaluatingTeamId];

  // Non-linear rating curve so 85–99 stars carry meaningful trade premium
  const starPremium = Math.max(0, player.overallRating - 80) * 1.15;
  let value = player.overallRating + starPremium;

  // Pitch fit adjustment for the evaluating franchise
  if (pitch.spinFactor > 1.1 && player.isSpinBowler) value += 5;
  if (pitch.spinFactor > 1.1 && player.batting.techniqueVsSpin >= 75) value += 3;
  if (pitch.paceFactor > 1.1 && player.isPaceBowler) value += 5;
  if (
    pitch.boundarySize === 'small' &&
    (player.batting.powerHitting >= 76 || player.bowling.variations >= 76)
  ) {
    value += 4;
  }
  if (
    pitch.boundarySize === 'large' &&
    (player.physical.sprintSpeed >= 75 || player.batting.timingPlacement >= 75)
  ) {
    value += 4;
  }
  if (
    pitch.variableBounce > 0.35 &&
    (player.bowlingStyle.includes('Wrist-Spin') || player.heightCm >= 184)
  ) {
    value += 4;
  }

  // Indian U19 scarcity value (mandatory >=1 U19 in every Matchday XI)
  if (player.category === 'INDIAN_U19') {
    value += 4;
  }

  // Injury & severe fatigue depreciation
  if (player.injuredMatchesRemaining > 0) {
    value -= 6 * player.injuredMatchesRemaining;
  }
  if (player.fatigue >= 65) {
    value -= 3;
  }

  return Math.max(15, Math.round(value));
}

export function evaluateTradeFairness(
  proposal: TradeProposal,
  teams: FranchiseTeam[],
  players: Player[]
): TradeEvaluationResult {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const userTeam = teams.find((t) => t.id === proposal.userTeamId);
  const partnerTeam = teams.find((t) => t.id === proposal.partnerTeamId);

  const reasons: string[] = [];

  if (!userTeam || !partnerTeam || userTeam.id === partnerTeam.id) {
    return {
      isValid: false,
      isFair: false,
      offeredValue: 0,
      requestedValue: 0,
      valueDelta: 0,
      fairnessRatio: 0,
      verdictSummary: 'Invalid Trade — Select a valid partner franchise.',
      reasons: ['Both franchises must exist and be distinct.'],
    };
  }

  const offeredIds = Array.from(new Set(proposal.offeredPlayerIds));
  const requestedIds = Array.from(new Set(proposal.requestedPlayerIds));

  if (offeredIds.length === 0 || requestedIds.length === 0) {
    return {
      isValid: false,
      isFair: false,
      offeredValue: 0,
      requestedValue: 0,
      valueDelta: 0,
      fairnessRatio: 0,
      verdictSummary: 'Select Players — Both sides must include at least 1 player.',
      reasons: ['Select at least 1 player from your roster and 1 player from the partner roster.'],
    };
  }

  if (
    offeredIds.length > MAX_PLAYERS_PER_TRADE_SIDE ||
    requestedIds.length > MAX_PLAYERS_PER_TRADE_SIDE
  ) {
    reasons.push(`Maximum ${MAX_PLAYERS_PER_TRADE_SIDE} players allowed per side in a single trade.`);
  }

  const offeredPlayers = offeredIds
    .map((id) => playerMap.get(id))
    .filter((p): p is Player => Boolean(p));
  const requestedPlayers = requestedIds
    .map((id) => playerMap.get(id))
    .filter((p): p is Player => Boolean(p));

  if (
    offeredPlayers.length !== offeredIds.length ||
    requestedPlayers.length !== requestedIds.length
  ) {
    reasons.push('One or more selected players could not be found.');
  }

  if (offeredPlayers.some((p) => !userTeam.rosterIds.includes(p.id))) {
    reasons.push(`All offered players must belong to ${userTeam.name}.`);
  }
  if (requestedPlayers.some((p) => !partnerTeam.rosterIds.includes(p.id))) {
    reasons.push(`All requested players must belong to ${partnerTeam.name}.`);
  }

  // Cash legality check
  const cash = Math.round(proposal.cashAdjustmentL);
  if (Math.abs(cash) > MAX_CASH_ADJUSTMENT_L) {
    reasons.push(`Cash adjustment cannot exceed INR ${MAX_CASH_ADJUSTMENT_L}L.`);
  }
  if (cash > 0 && userTeam.purseRemainingL < cash) {
    reasons.push(
      `Insufficient purse: ${userTeam.shortCode} has INR ${userTeam.purseRemainingL}L remaining (offered INR ${cash}L).`
    );
  }
  if (cash < 0 && partnerTeam.purseRemainingL < Math.abs(cash)) {
    reasons.push(
      `${partnerTeam.shortCode} only has INR ${partnerTeam.purseRemainingL}L remaining (cannot pay INR ${Math.abs(cash)}L).`
    );
  }

  // Post-trade squad size, U19 quota & healthy XI depth checks
  const postUserIds = [
    ...userTeam.rosterIds.filter((id) => !offeredIds.includes(id)),
    ...requestedIds,
  ];
  const postPartnerIds = [
    ...partnerTeam.rosterIds.filter((id) => !requestedIds.includes(id)),
    ...offeredIds,
  ];

  const checkPostSquad = (teamName: string, ids: string[]) => {
    if (ids.length < MIN_ROSTER_AFTER_TRADE) {
      reasons.push(`${teamName} would drop below minimum ${MIN_ROSTER_AFTER_TRADE} players.`);
    }
    if (ids.length > MAX_ROSTER_SIZE) {
      reasons.push(`${teamName} would exceed max roster limit of ${MAX_ROSTER_SIZE} players.`);
    }
    const squad = ids
      .map((id) => playerMap.get(id))
      .filter((p): p is Player => Boolean(p));
    const u19Count = squad.filter((p) => p.category === 'INDIAN_U19').length;
    const fitCount = squad.filter((p) => p.injuredMatchesRemaining === 0).length;
    const fitU19Count = squad.filter(
      (p) => p.category === 'INDIAN_U19' && p.injuredMatchesRemaining === 0
    ).length;

    if (u19Count < 1) {
      reasons.push(`${teamName} must retain at least 1 Indian U19 player.`);
    } else if (fitU19Count < 1) {
      reasons.push(`${teamName} must retain at least 1 fit Indian U19 player.`);
    }
    if (fitCount < 11) {
      reasons.push(`${teamName} must keep at least 11 fit players to field a Matchday XI.`);
    }
  };

  checkPostSquad(userTeam.shortCode, postUserIds);
  checkPostSquad(partnerTeam.shortCode, postPartnerIds);

  // Evaluate trade value from partner franchise perspective
  const playersInValue = offeredPlayers.reduce(
    (sum, p) => sum + computePlayerTradeValue(p, partnerTeam.id),
    0
  );
  const playersOutValue = requestedPlayers.reduce(
    (sum, p) => sum + computePlayerTradeValue(p, partnerTeam.id),
    0
  );

  // Cash adjustment (positive = user pays partner) adds/subtracts value for partner
  const cashValueAdjustment = Math.round(cash * CASH_VALUE_PER_LAKH);
  const offeredValue = Math.max(0, playersInValue + cashValueAdjustment);
  const requestedValue = Math.max(1, playersOutValue);
  const valueDelta = offeredValue - requestedValue;
  const fairnessRatio = Number((offeredValue / requestedValue).toFixed(2));

  const isStructurallyValid = reasons.length === 0;
  if (!isStructurallyValid) {
    return {
      isValid: false,
      isFair: false,
      offeredValue,
      requestedValue,
      valueDelta,
      fairnessRatio,
      verdictSummary: 'Illegal Trade — Roster or purse rule violation.',
      reasons,
    };
  }

  // Fairness checks: overall package value ratio + star OVR ceiling parity
  const maxOfferedOvr = Math.max(...offeredPlayers.map((p) => p.overallRating));
  const maxRequestedOvr = Math.max(...requestedPlayers.map((p) => p.overallRating));
  const starGap = maxRequestedOvr - maxOfferedOvr;

  const fairReasons: string[] = [];
  if (fairnessRatio < FAIRNESS_RATIO_THRESHOLD) {
    const deficit = Math.ceil(requestedValue * FAIRNESS_RATIO_THRESHOLD - offeredValue);
    fairReasons.push(
      `Package value (${offeredValue} pts) trails ${partnerTeam.shortCode}'s valuation (${requestedValue} pts) by ${Math.max(1, deficit)} pts.`
    );
  }

  if (starGap > MAX_STAR_OVR_GAP) {
    fairReasons.push(
      `Star rating gap too wide: top offered OVR (${maxOfferedOvr}) trails requested star (${maxRequestedOvr}) by ${starGap} pts (max ${MAX_STAR_OVR_GAP} allowed).`
    );
  }

  // Partner won't accept giving up a healthy starter purely for an injured player of similar OVR unless compensated
  const injuredOffered = offeredPlayers.filter((p) => p.injuredMatchesRemaining > 0);
  const healthyRequested = requestedPlayers.filter((p) => p.injuredMatchesRemaining === 0);
  if (injuredOffered.length > 0 && healthyRequested.length > 0 && fairnessRatio < 1.05) {
    fairReasons.push(
      `${partnerTeam.shortCode} requires at least 105% value compensation to absorb an injured player.`
    );
  }

  const isFair = fairReasons.length === 0;
  if (isFair) {
    return {
      isValid: true,
      isFair: true,
      offeredValue,
      requestedValue,
      valueDelta,
      fairnessRatio,
      verdictSummary: `Fair Trade — ${partnerTeam.shortCode} ready to accept (${Math.round(
        fairnessRatio * 100
      )}% value match).`,
      reasons: [
        `Value check passed (${offeredValue} offered vs ${requestedValue} requested for ${partnerTeam.city} conditions).`,
        `Top OVR parity within ${MAX_STAR_OVR_GAP} pts (${maxOfferedOvr} vs ${maxRequestedOvr}).`,
      ],
    };
  }

  return {
    isValid: true,
    isFair: false,
    offeredValue,
    requestedValue,
    valueDelta,
    fairnessRatio,
    verdictSummary: `Unfair Offer — ${partnerTeam.shortCode} declines this proposal.`,
    reasons: fairReasons,
  };
}

export function executeTrade(
  proposal: TradeProposal,
  teams: FranchiseTeam[],
  players: Player[]
): {
  accepted: boolean;
  evaluation: TradeEvaluationResult;
  teams: FranchiseTeam[];
  players: Player[];
} {
  const evaluation = evaluateTradeFairness(proposal, teams, players);
  if (!evaluation.isValid || !evaluation.isFair) {
    return { accepted: false, evaluation, teams, players };
  }

  const offeredSet = new Set(proposal.offeredPlayerIds);
  const requestedSet = new Set(proposal.requestedPlayerIds);
  const cash = Math.round(proposal.cashAdjustmentL);

  const nextPlayers = players.map((p) => {
    if (offeredSet.has(p.id)) {
      return { ...p, soldToTeamId: proposal.partnerTeamId };
    }
    if (requestedSet.has(p.id)) {
      return { ...p, soldToTeamId: proposal.userTeamId };
    }
    return p;
  });

  const nextPlayerMap = new Map(nextPlayers.map((p) => [p.id, p]));

  const nextTeams = teams.map((team) => {
    if (team.id === proposal.userTeamId) {
      const nextRoster = [
        ...team.rosterIds.filter((id) => !offeredSet.has(id)),
        ...proposal.requestedPlayerIds,
      ];
      const remainingXI = team.selectedXIIds.filter((id) => !offeredSet.has(id));
      return {
        ...team,
        purseRemainingL: team.purseRemainingL - cash,
        rosterIds: nextRoster,
        selectedXIIds: remainingXI,
        captainId: remainingXI.includes(team.captainId ?? '')
          ? team.captainId
          : remainingXI[0] ?? null,
        wicketkeeperId: remainingXI.includes(team.wicketkeeperId ?? '')
          ? team.wicketkeeperId
          : remainingXI[0] ?? null,
      };
    }

    if (team.id === proposal.partnerTeamId) {
      const nextRoster = [
        ...team.rosterIds.filter((id) => !requestedSet.has(id)),
        ...proposal.offeredPlayerIds,
      ];
      const updatedPartner: FranchiseTeam = {
        ...team,
        purseRemainingL: team.purseRemainingL + cash,
        rosterIds: nextRoster,
      };
      const bestXI = selectBestXI(updatedPartner, nextPlayerMap, team.id);
      return {
        ...updatedPartner,
        selectedXIIds: bestXI.xiIds,
        captainId: bestXI.captainId,
        wicketkeeperId: bestXI.wicketkeeperId,
      };
    }

    return team;
  });

  return {
    accepted: true,
    evaluation,
    teams: nextTeams,
    players: nextPlayers,
  };
}

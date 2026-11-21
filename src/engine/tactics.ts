import {
  Player,
  TacticalCheckpoint,
  TacticalDirectives,
} from './types';

export const NEUTRAL_DIRECTIVES: TacticalDirectives = {
  battingTempoBoost: 0,
  boundaryAggression: 0,
  rotateStrikeFocus: 0,
  spinFocus: 0,
  paceFocus: 0,
  deathYorkerFocus: 0,
  targetShortBoundary: false,
  composureBoost: 0,
  summaryTags: ['Balanced Plan'],
};

export function parseTacticalPlan(
  planText: string,
  checkpoint: TacticalCheckpoint,
  teamXI: Player[],
  captain: Player | null,
  rivalryContext?: { rivalryName: string; morale: number } | null
): { directives: TacticalDirectives; captainReply: string } {
  const q = planText.trim().toLowerCase();
  const directives: TacticalDirectives = {
    battingTempoBoost: 0,
    boundaryAggression: 0,
    rotateStrikeFocus: 0,
    spinFocus: 0,
    paceFocus: 0,
    deathYorkerFocus: 0,
    targetShortBoundary: false,
    composureBoost: 0,
    summaryTags: [],
  };

  if (!q) {
    directives.summaryTags = ['Standard Gameplan'];
    return {
      directives,
      captainReply: `${captain?.name ?? 'Captain'}: "Understood coach, we will play our natural percentages and react to the pitch."`,
    };
  }

  // Batting tempo & aggression
  if (/\battack\b|\baggress|\bslog\b|\bcharge\b|\bfast\b|\bgo hard\b|\baccelerate\b|\bboundaries\b|\bsixes\b|\bpower\b/.test(q)) {
    directives.battingTempoBoost += 10;
    directives.boundaryAggression += 10;
    directives.summaryTags.push('Aggressive Tempo');
  }
  if (/\banchor\b|\brotate\b|\bsingles\b|\bconsolidate\b|\bsteady\b|\bcalm\b|\bno wickets\b|\bpreserve\b|\bbuild\b|\bcareful\b/.test(q)) {
    directives.battingTempoBoost -= 6;
    directives.rotateStrikeFocus += 12;
    directives.composureBoost += 6;
    directives.summaryTags.push('Strike Rotation & Consolidation');
  }
  if (/\bshort boundary\b|\btarget boundary\b|\bsquare\b|\bleg side\b|\bloft\b/.test(q)) {
    directives.targetShortBoundary = true;
    directives.boundaryAggression += 6;
    directives.summaryTags.push('Target Short Boundary');
  }

  // Bowling plans
  if (/\bspin\b|\bspinner\b|\bslow\b|\btake pace off\b|\bchoke\b|\bturn\b/.test(q)) {
    directives.spinFocus += 12;
    directives.summaryTags.push('Spin Priority');
  }
  if (/\bpace\b|\bfast\b|\bbounce\b|\bbouncer\b|\bswing\b|\bnew ball\b|\battacking lines\b/.test(q)) {
    directives.paceFocus += 12;
    directives.summaryTags.push('Pace Priority');
  }
  if (/\byorker\b|\bdeath\b|\bwide\b|\bcutters\b|\bslower\b|\bvariation\b/.test(q)) {
    directives.deathYorkerFocus += 13;
    directives.summaryTags.push('Variations & Yorker Focus');
  }
  if (/\bdefend\b|\bcontain\b|\bdot\b|\btight\b|\bfielding\b|\bring\b|\bpressure\b/.test(q)) {
    directives.composureBoost += 8;
    directives.deathYorkerFocus += 6;
    directives.summaryTags.push('Containment & Field Pressure');
  }

  if (directives.summaryTags.length === 0) {
    directives.composureBoost += 4;
    directives.summaryTags.push('Tactical Clarity');
  }

  // Squad tactical execution quality depends on Captain Leadership & Squad Tactical Awareness
  const avgTactical =
    teamXI.length > 0
      ? teamXI.reduce((acc, p) => acc + p.mindset.tacticalAwareness, 0) / teamXI.length
      : 65;
  const leadership = captain?.mindset.leadership ?? 65;
  const executionMultiplier = 0.75 + ((leadership + avgTactical) / 200) * 0.5;

  directives.battingTempoBoost = Math.round(directives.battingTempoBoost * executionMultiplier);
  directives.boundaryAggression = Math.round(directives.boundaryAggression * executionMultiplier);
  directives.rotateStrikeFocus = Math.round(directives.rotateStrikeFocus * executionMultiplier);
  directives.spinFocus = Math.round(directives.spinFocus * executionMultiplier);
  directives.paceFocus = Math.round(directives.paceFocus * executionMultiplier);
  directives.deathYorkerFocus = Math.round(directives.deathYorkerFocus * executionMultiplier);
  directives.composureBoost = Math.round(directives.composureBoost * executionMultiplier);

  const phaseLabel =
    checkpoint === 'MATCH_START'
      ? 'from ball one'
      : checkpoint === 'POWERPLAY_1_END'
      ? 'through the middle overs'
      : checkpoint === 'INNINGS_BREAK'
      ? 'for the second innings'
      : 'in the back 14 overs';

  const captainName = captain?.name ?? 'Squad Captain';
  const rivalryLine =
    rivalryContext && checkpoint === 'MATCH_START'
      ? rivalryContext.morale > 0
        ? ` The ${rivalryContext.rivalryName} H2H edge gives us a +${rivalryContext.morale} morale lift.`
        : rivalryContext.morale < 0
        ? ` Facing a ${rivalryContext.morale} morale dip in the ${rivalryContext.rivalryName}—let's flip the H2H script.`
        : ` Stakes are level in the ${rivalryContext.rivalryName}.`
      : '';
  const captainReply =
    leadership >= 75
      ? `${captainName} (Leadership ${leadership}): "Message received loud and clear, Boss. Executing [${directives.summaryTags.join(
          ', '
        )}] ${phaseLabel}—the dressing room is locked in.${rivalryLine}"`
      : `${captainName} (Leadership ${leadership}): "Got it, Coach. Passing [${directives.summaryTags.join(
          ', '
        )}] onto the bowlers and batters ${phaseLabel}.${rivalryLine}"`;

  return { directives, captainReply };
}

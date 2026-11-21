import React from 'react';
import { X } from 'lucide-react';
import { Fixture, Player } from '../engine/types';
import { formatOvers } from '../engine/matchEngine';
import { PITCH_PROFILES } from '../engine/cities';

interface PlayerModalProps {
  player: Player | null;
  isScouted: boolean;
  onClose: () => void;
}

function formatStageLabel(stage: Fixture['stage'], roundNumber: number): string {
  switch (stage) {
    case 'LEAGUE':
      return `Round ${roundNumber}`;
    case 'QUALIFIER_1':
      return 'Qualifier 1';
    case 'ELIMINATOR':
      return 'Eliminator';
    case 'QUALIFIER_2':
      return 'Qualifier 2';
    case 'FINAL':
      return 'Final';
  }
}

const StatBar: React.FC<{ label: string; value: number | null; hiddenHint?: string }> = ({
  label,
  value,
  hiddenHint,
}) => {
  if (value === null) {
    return (
      <div className="flex items-center justify-between py-1 text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-mono text-amber-700">{hiddenHint ?? 'Unscouted (?)'}</span>
      </div>
    );
  }
  const barColor =
    value >= 80 ? 'bg-emerald-600' : value >= 65 ? 'bg-slate-700' : 'bg-amber-600';
  return (
    <div className="space-y-1 py-0.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-700">{label}</span>
        <span className="font-mono font-semibold text-slate-900 tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-sm bg-slate-100">
        <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
};

export const PlayerModal: React.FC<PlayerModalProps> = ({ player, isScouted, onClose }) => {
  if (!player) return null;

  const showHidden = isScouted || player.soldToTeamId !== null;
  const catLabel =
    player.category === 'INDIAN_U19'
      ? 'Indian U19'
      : player.category === 'FOREIGN'
      ? `${player.nationality} (Overseas)`
      : 'India Senior';

  const history = player.careerHistory ?? [];
  const matchesPlayed = history.length;
  const battingInnings = history.filter((h) => h.batting.didBat);
  const totalRuns = history.reduce((acc, h) => acc + h.batting.runs, 0);
  const totalBallsFaced = history.reduce((acc, h) => acc + h.batting.balls, 0);
  const totalFours = history.reduce((acc, h) => acc + h.batting.fours, 0);
  const totalSixes = history.reduce((acc, h) => acc + h.batting.sixes, 0);

  let highScoreDisplay = '—';
  if (battingInnings.length > 0) {
    const best = [...battingInnings].sort((a, b) => {
      if (b.batting.runs !== a.batting.runs) return b.batting.runs - a.batting.runs;
      return Number(a.batting.isOut) - Number(b.batting.isOut);
    })[0];
    highScoreDisplay = `${best.batting.runs}${best.batting.isOut ? '' : '*'}`;
  }

  const strikeRateDisplay =
    totalBallsFaced > 0 ? ((totalRuns / totalBallsFaced) * 100).toFixed(1) : '—';

  const totalBallsBowled = history.reduce((acc, h) => acc + h.bowling.ballsBowled, 0);
  const totalRunsConceded = history.reduce((acc, h) => acc + h.bowling.runsConceded, 0);
  const totalWickets = history.reduce((acc, h) => acc + h.bowling.wickets, 0);
  const economyDisplay =
    totalBallsBowled > 0 ? (totalRunsConceded / (totalBallsBowled / 6)).toFixed(2) : '—';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Player scouting profile for ${player.name}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4"
    >
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-xl sm:max-h-[90vh] sm:rounded-xl sm:p-6">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2
              className="text-2xl font-bold tracking-tight text-slate-900"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {player.name}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {catLabel} · {player.homeLocation} · Age {player.age} · {player.role.replace('_', ' ')} ·{' '}
              {player.battingHand} · {player.bowlingStyle} · {player.heightCm} cm
            </p>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="text-right tabular-nums">
              <div className="text-xs text-slate-500">Overall</div>
              <div className="font-mono text-2xl font-bold text-emerald-700">
                {player.overallRating}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close player profile"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 5-Pillar Grid */}
        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* 1. Physical */}
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">1. Physical Attributes</h3>
            <StatBar label="Stamina" value={player.physical.stamina} />
            <StatBar label="Sprint Speed" value={player.physical.sprintSpeed} />
            <StatBar label="Strength" value={player.physical.strength} />
            <StatBar label="Agility & Reflexes" value={player.physical.agilityReflexes} />
            <StatBar
              label="Injury Proneness (Lower Safer)"
              value={showHidden ? player.physical.injuryProneness : null}
              hiddenHint="Scout to reveal"
            />
          </div>

          {/* 2. Mindset */}
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">2. Mindset Attributes</h3>
            <StatBar label="Aggression" value={player.mindset.aggression} />
            <StatBar label="Adaptability" value={player.mindset.adaptability} />
            <StatBar label="Consistency" value={player.mindset.consistency} />
            <StatBar label="Leadership" value={player.mindset.leadership} />
            <StatBar label="Tactical Awareness" value={player.mindset.tacticalAwareness} />
          </div>

          {/* 3. Batting */}
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">3. Batting Attributes</h3>
            <StatBar label="Timing & Placement" value={player.batting.timingPlacement} />
            <StatBar label="Power Hitting (Lofted)" value={player.batting.powerHitting} />
            <StatBar label="Technique (vs. Spin)" value={player.batting.techniqueVsSpin} />
            <StatBar label="Technique (vs. Pace)" value={player.batting.techniqueVsPace} />
            <StatBar label="Running Between Wickets" value={player.batting.runningBetweenWickets} />
            <StatBar
              label="Clutch Factor"
              value={showHidden ? player.batting.clutchFactor : null}
              hiddenHint="Scout to reveal"
            />
            <div className="mt-3 border-t border-slate-100 pt-2.5 text-xs text-slate-600 tabular-nums">
              <div className="font-medium text-slate-800">Situational Roles</div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <span>Powerplay: +{player.batting.situational.powerplaySpecialist}</span>
                <span>Anchor: +{player.batting.situational.middleOversAnchor}</span>
                <span>Finisher: +{player.batting.situational.finisher}</span>
              </div>
            </div>
          </div>

          {/* 4. Bowling */}
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">4. Bowling Attributes</h3>
            <StatBar label="Pace / Revolution Speed" value={player.bowling.paceOrRevolution} />
            <StatBar label="Line & Length Accuracy" value={player.bowling.lineLengthAccuracy} />
            <StatBar label="Movement (Swing / Seam / Drift)" value={player.bowling.movement} />
            <StatBar label="Variations" value={player.bowling.variations} />
            <StatBar
              label="Control Under Assault"
              value={showHidden ? player.bowling.controlUnderAssault : null}
              hiddenHint="Scout to reveal"
            />
          </div>

          {/* 5. Fielding */}
          <div className="rounded-lg border border-slate-200 p-4 md:col-span-2 lg:col-span-2">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">5. Fielding Attributes</h3>
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              <StatBar label="Catching (Outfield)" value={player.fielding.catchingOutfield} />
              <StatBar label="Catching (Close-In / Slip)" value={player.fielding.catchingCloseIn} />
              <StatBar label="Ground Fielding" value={player.fielding.groundFielding} />
              <StatBar label="Throwing Accuracy & Arm" value={player.fielding.throwingAccuracyArm} />
              <StatBar label="Wicketkeeping" value={player.fielding.wicketkeeping} />
              <StatBar
                label="Fielding Setup"
                value={showHidden ? player.fielding.fieldingSetup : null}
                hiddenHint="Scout to reveal"
              />
            </div>
          </div>
        </div>

        {/* Career History */}
        <section
          aria-label="Career History"
          className="mt-6 rounded-lg border border-slate-200 p-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Career History</h3>
              <p className="text-xs text-slate-500">
                Current tournament batting and bowling match log
              </p>
            </div>
            {matchesPlayed > 0 && (
              <span className="font-mono text-xs text-slate-600 tabular-nums">
                {matchesPlayed} {matchesPlayed === 1 ? 'Match' : 'Matches'} Logged
              </span>
            )}
          </div>

          {matchesPlayed === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              No matches played in the current tournament yet. Performance stats appear here once
              this player features in a completed matchday XI.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {/* Tournament Aggregate Strip */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7 tabular-nums">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-500">Matches</div>
                  <div className="font-mono text-base font-bold text-slate-900">{matchesPlayed}</div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-500">Innings</div>
                  <div className="font-mono text-base font-bold text-slate-900">
                    {battingInnings.length}
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-500">Runs</div>
                  <div className="font-mono text-base font-bold text-slate-900">{totalRuns}</div>
                  <div className="font-mono text-[10px] text-slate-500">
                    {totalFours}x4 · {totalSixes}x6
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-500">High Score</div>
                  <div className="font-mono text-base font-bold text-slate-900">
                    {highScoreDisplay}
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-500">Strike Rate</div>
                  <div className="font-mono text-base font-bold text-slate-900">
                    {strikeRateDisplay}
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-500">Wickets</div>
                  <div className="font-mono text-base font-bold text-slate-900">{totalWickets}</div>
                  <div className="font-mono text-[10px] text-slate-500">
                    {formatOvers(totalBallsBowled)} ov
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-500">Economy</div>
                  <div className="font-mono text-base font-bold text-slate-900">
                    {economyDisplay}
                  </div>
                </div>
              </div>

              {/* Match-by-Match Breakdown */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3 font-medium">Match</th>
                      <th className="py-2 pr-3 font-medium">Opponent</th>
                      <th className="py-2 pr-3 font-medium">Venue</th>
                      <th className="py-2 pr-3 font-medium">Batting</th>
                      <th className="py-2 pr-3 font-medium">Bowling</th>
                      <th className="py-2 text-right font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {history.map((entry) => (
                      <tr key={entry.fixtureId} className="align-top text-slate-700">
                        <td className="py-2 pr-3 font-medium text-slate-900 whitespace-nowrap">
                          {formatStageLabel(entry.stage, entry.roundNumber)}
                        </td>
                        <td className="py-2 pr-3 font-mono whitespace-nowrap">
                          vs {entry.opponentShortCode}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {PITCH_PROFILES[entry.venueCityId].city}
                        </td>
                        <td className="py-2 pr-3">
                          {entry.batting.didBat ? (
                            <div>
                              <span className="font-mono font-semibold text-slate-900">
                                {entry.batting.runs}
                                {entry.batting.isOut ? '' : '*'} ({entry.batting.balls})
                              </span>
                              <div className="text-[11px] text-slate-500">
                                {entry.batting.fours}x4 · {entry.batting.sixes}x6 ·{' '}
                                {entry.batting.dismissalText}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">DNB</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {entry.bowling.ballsBowled > 0 ? (
                            <div>
                              <span className="font-mono font-semibold text-slate-900">
                                {entry.bowling.wickets}/{entry.bowling.runsConceded}
                              </span>{' '}
                              <span className="font-mono text-slate-600">
                                ({formatOvers(entry.bowling.ballsBowled)} ov)
                              </span>
                              <div className="text-[11px] text-slate-500">
                                {entry.bowling.dots} dots
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">Did not bowl</span>
                          )}
                        </td>
                        <td className="py-2 text-right whitespace-nowrap">
                          <span
                            className={
                              entry.won
                                ? 'font-semibold text-emerald-700'
                                : 'font-medium text-slate-600'
                            }
                          >
                            {entry.won ? 'Won' : 'Lost'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};


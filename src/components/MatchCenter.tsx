import React, { useEffect, useState } from 'react';
import {
  Award,
  Cloud,
  Droplets,
  FastForward,
  Flame,
  MessageSquare,
  Pause,
  Play,
  ShieldAlert,
  SkipForward,
  Square,
  Sun,
  Wind,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  applyWeatherToPitch,
  generateThreeDayWeatherForecast,
  PITCH_PROFILES,
  WEATHER_PROFILES,
} from '../engine/cities';
import {
  BallEventLabel,
  buildRunRateChartData,
  formatOvers,
  getBallEventLabel,
} from '../engine/matchEngine';
import { generateMatchPerformanceReport } from '../engine/reports';
import { generateOpponentScoutingReport } from '../engine/scouting';
import {
  BallOutcome,
  CityId,
  FranchiseTeam,
  InningsState,
  MatchState,
  Player,
  TacticalCheckpoint,
  WeatherCondition,
} from '../engine/types';

interface MatchCenterProps {
  match: MatchState | null;
  teams: FranchiseTeam[];
  players: Player[];
  userTeam: FranchiseTeam;
  simMode?: 'IDLE' | 'OVER' | 'CHECKPOINT';
  simPauseEvent?: { eventLabel: BallEventLabel; commentary: string } | null;
  onStopSim?: () => void;
  onBeginMatchCheckpoint: () => void;
  onSubmitTacticalPlan: (planText: string) => void;
  onPlayBall: () => void;
  onSimOver: () => void;
  onSimToCheckpoint: () => void;
  onCompleteMatchReturn: () => void;
  onInspectPlayer: (player: Player) => void;
}

const CHECKPOINT_TITLES: Record<TacticalCheckpoint, string> = {
  MATCH_START: 'Start-of-Match Team Talk',
  POWERPLAY_1_END: 'End of Powerplay 1 (Over 6) — Tactical Huddle',
  INNINGS_BREAK: 'Innings Break — Mid-Match Briefing',
  POWERPLAY_2_END: 'End of Powerplay 2 (Over 6) — Tactical Huddle',
};

const QUICK_PLAN_EXAMPLES = [
  'Attack early, target the short boundary, and rotate strike against spin',
  'Consolidate wickets, rotate singles, and save power hitters for death overs',
  'Bowl spin through middle overs and execute wide yorkers at the death',
  'Aggressive pace lines with new ball and tight ring fielding pressure',
];

const WagonWheelSvg: React.FC<{ recentBalls: BallOutcome[]; boundarySize: string }> = ({
  recentBalls,
  boundarySize,
}) => {
  const cx = 150;
  const cy = 150;
  const maxR = 128;

  return (
    <svg
      viewBox="0 0 300 300"
      className="mx-auto h-52 w-52 shrink-0 sm:h-64 sm:w-64"
      aria-label="Live cricket ground wagon wheel showing recent shots"
    >
      {/* Outfield */}
      <circle cx={cx} cy={cy} r={140} fill="#064E3B" stroke="#047857" strokeWidth="3" />
      {/* Boundary rope */}
      <circle cx={cx} cy={cy} r={maxR} fill="none" stroke="#F8FAFC" strokeWidth="1.5" strokeDasharray="4 3" />
      {/* 30-yard Powerplay circle */}
      <ellipse cx={cx} cy={cy} rx={68} ry={76} fill="none" stroke="#A7F3D0" strokeWidth="1" strokeOpacity="0.45" />
      {/* Central Pitch */}
      <rect x={cx - 8} y={cy - 26} width={16} height={52} rx={2} fill="#D6C7A9" stroke="#B49F78" strokeWidth="1" />
      <line x1={cx - 11} y1={cy - 18} x2={cx + 11} y2={cy - 18} stroke="#FFFFFF" strokeWidth="1" />
      <line x1={cx - 11} y1={cy + 18} x2={cx + 11} y2={cy + 18} stroke="#FFFFFF" strokeWidth="1" />

      {/* Shot Trajectories */}
      {recentBalls.slice(0, 12).map((b, idx) => {
        const rad = (b.shotAngleDeg * Math.PI) / 180;
        const len = Math.max(12, b.shotDistanceRatio * maxR);
        const x2 = cx + Math.cos(rad) * len;
        const y2 = cy + Math.sin(rad) * len;
        const stroke = b.isWicket
          ? '#EF4444'
          : b.isBoundarySix
          ? '#F59E0B'
          : b.isBoundaryFour
          ? '#34D399'
          : b.isNearMiss
          ? '#38BDF8'
          : '#E2E8F0';
        const opacity = Math.max(0.25, 1 - idx * 0.07);
        return (
          <g key={`${b.innings}-${b.over}-${b.ballInOver}-${idx}`} opacity={opacity}>
            <line
              x1={cx}
              y1={cy - 14}
              x2={x2}
              y2={y2}
              stroke={stroke}
              strokeWidth={b.isBoundaryFour || b.isBoundarySix || b.isWicket || b.isNearMiss ? 2.4 : 1.3}
              strokeLinecap="round"
            />
            <circle cx={x2} cy={y2} r={b.isWicket || b.isNearMiss ? 3.5 : 2.5} fill={stroke} />
          </g>
        );
      })}

      <text x={cx} y={290} textAnchor="middle" fill="#CBD5E1" fontSize="10" fontFamily="monospace">
        {boundarySize.toUpperCase()} BOUNDARY · LAST 12 BALLS
      </text>
    </svg>
  );
};

export const MatchCenter: React.FC<MatchCenterProps> = ({
  match,
  teams,
  players,
  userTeam,
  simMode = 'IDLE',
  simPauseEvent = null,
  onStopSim,
  onBeginMatchCheckpoint,
  onSubmitTacticalPlan,
  onPlayBall,
  onSimOver,
  onSimToCheckpoint,
  onCompleteMatchReturn,
  onInspectPlayer,
}) => {
  const [planInput, setPlanInput] = useState('');
  const [detailTab, setDetailTab] = useState<
    'COMMENTARY' | 'SCORECARD' | 'TACTICS' | 'CONDITIONS' | 'REPORT'
  >('COMMENTARY');

  useEffect(() => {
    setDetailTab('COMMENTARY');
  }, [match?.fixtureId]);

  useEffect(() => {
    if (match?.phase === 'COMPLETED') {
      setDetailTab('REPORT');
    }
  }, [match?.phase]);

  if (!match) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 py-12 text-center">
        <p className="text-sm text-slate-600">
          No active match selected. Head to Season Stats to launch your next scheduled fixture.
        </p>
      </div>
    );
  }

  const teamMap = new Map<CityId, FranchiseTeam>(teams.map((t) => [t.id, t]));
  const playerMap = new Map<string, Player>(players.map((p) => [p.id, p]));
  const basePitch = PITCH_PROFILES[match.venueCityId];
  const matchWeather = match.weather ?? 'CLEAR';
  const weatherProfile = WEATHER_PROFILES[matchWeather];
  const venuePitch = applyWeatherToPitch(basePitch, matchWeather);
  const forecast = generateThreeDayWeatherForecast(
    match.venueCityId,
    matchWeather,
    match.roundNumber ?? 1
  );
  const oppTeamId = match.homeTeamId === userTeam.id ? match.awayTeamId : match.homeTeamId;
  const oppTeam = teamMap.get(oppTeamId)!;

  const renderWeatherIcon = (condition: WeatherCondition) => {
    switch (condition) {
      case 'OVERCAST':
        return <Cloud className="h-4 w-4 text-slate-600" aria-hidden="true" />;
      case 'HUMID_DEW':
        return <Droplets className="h-4 w-4 text-sky-700" aria-hidden="true" />;
      case 'DRY_HEAT':
        return <Flame className="h-4 w-4 text-amber-600" aria-hidden="true" />;
      case 'BREEZY':
        return <Wind className="h-4 w-4 text-teal-700" aria-hidden="true" />;
      default:
        return <Sun className="h-4 w-4 text-amber-500" aria-hidden="true" />;
    }
  };

  const userRivalryMorale = match.rivalry
    ? userTeam.id === match.rivalry.homeTeamId
      ? match.rivalry.homeMorale
      : match.rivalry.awayMorale
    : 0;
  const userRivalrySummary = match.rivalry
    ? userTeam.id === match.rivalry.homeTeamId
      ? match.rivalry.homeSummary
      : match.rivalry.awaySummary
    : null;
  const oppRivalrySummary = match.rivalry
    ? userTeam.id === match.rivalry.homeTeamId
      ? match.rivalry.awaySummary
      : match.rivalry.homeSummary
    : null;

  // 1. Pre-Match Opponent Scouting Report
  if (match.phase === 'PRE_MATCH_SCOUTING') {
    const report = generateOpponentScoutingReport(
      oppTeam,
      players,
      match.venueCityId,
      matchWeather
    );

    return (
      <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6 sm:py-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4 md:flex-nowrap">
          <div className="max-w-4xl">
            <div className="text-xs font-semibold text-emerald-700">
              Pre-Match Scouting Dossier · {match.stage.replace('_', ' ')} · {venuePitch.stadium},{' '}
              {venuePitch.city}
              {match.rivalry ? ` · Rivalry: ${match.rivalry.rivalryName}` : ''}
            </div>
            <h1
              className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {userTeam.name} vs {oppTeam.name}
            </h1>
            <p className="mt-1 text-sm text-slate-600">{report.pitchSummary}</p>
          </div>
          <button
            type="button"
            onClick={onBeginMatchCheckpoint}
            className="min-h-[44px] w-full shrink-0 whitespace-nowrap rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 sm:w-auto"
          >
            Proceed to Toss &amp; Team Talk
          </button>
        </div>

        {match.rivalry && (
          <section
            aria-label="Rivalry head-to-head morale brief"
            className="mb-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-amber-800">
                  Historical Rivalry Fixture · {match.rivalry.rivalryName}
                </div>
                <p className="mt-0.5 text-xs text-slate-700">{match.rivalry.narrative}</p>
              </div>
              <div className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                All-Time H2H: {teamMap.get(match.rivalry.homeTeamId)?.shortCode}{' '}
                {match.rivalry.homeWins} – {match.rivalry.awayWins}{' '}
                {teamMap.get(match.rivalry.awayTeamId)?.shortCode}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-amber-200/80 pt-3 text-xs md:grid-cols-2">
              <div
                className={
                  userRivalryMorale > 0
                    ? 'font-semibold text-emerald-800'
                    : userRivalryMorale < 0
                    ? 'font-semibold text-red-700'
                    : 'font-medium text-slate-700'
                }
              >
                {userTeam.name}: {userRivalrySummary}
              </div>
              <div className="text-slate-700 md:text-right">
                {oppTeam.name}: {oppRivalrySummary}
              </div>
            </div>
          </section>
        )}

        {/* Pitch Profile & 3-Day Weather Forecast Band */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section
            aria-label="Venue pitch profile"
            className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5"
          >
            <h2
              className="mb-2 border-b border-slate-100 pb-2 text-xl font-bold text-slate-900"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Pitch Profile ({venuePitch.city})
            </h2>
            <p className="text-xs leading-relaxed text-slate-600">
              <strong className="text-slate-900">{venuePitch.surfaceSummary}</strong>
              <span className="mx-1.5 text-slate-300" aria-hidden="true">·</span>
              {basePitch.tacticalNote}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-slate-100 pt-3 text-xs tabular-nums">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Pace Assistance</span>
                <strong className="font-mono text-slate-900">{venuePitch.paceFactor.toFixed(2)}x</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Spin Assistance</span>
                <strong className="font-mono text-slate-900">{venuePitch.spinFactor.toFixed(2)}x</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Batting Bounce</span>
                <strong className="font-mono text-slate-900">{venuePitch.battingBounce.toFixed(2)}x</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Evening Dew</span>
                <strong className="font-mono text-slate-900">{Math.round(venuePitch.dewFactor * 100)}%</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Boundary Size</span>
                <strong className="font-mono text-slate-900">{venuePitch.boundarySize.toUpperCase()}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Variable Bounce</span>
                <strong className="font-mono text-slate-900">{Math.round(venuePitch.variableBounce * 100)}%</strong>
              </div>
            </div>
          </section>

          <section
            aria-label="3-day weather forecast"
            className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7"
          >
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-2">
              <h2
                className="text-xl font-bold text-slate-900"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                3-Day Weather Forecast ({venuePitch.city})
              </h2>
              <span className="text-xs text-slate-500">
                Match Window · Humidity, Heat &amp; Ball Movement Outlook
              </span>
            </div>

            <p className="mb-4 text-xs leading-relaxed text-slate-700">{forecast.trendSummary}</p>

            <div className="grid grid-cols-1 divide-y divide-slate-200 border-t border-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {forecast.days.map((day) => {
                const isMatchDay = day.dayOffset === 0;
                return (
                  <div
                    key={day.dayLabel}
                    className={`p-3.5 ${isMatchDay ? 'bg-emerald-50/50' : 'bg-white'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-900">
                        {day.dayLabel}
                        <span className="mx-1 text-slate-300" aria-hidden="true">·</span>
                        <span className={isMatchDay ? 'text-emerald-700' : 'text-slate-500'}>
                          {day.relativeLabel}
                        </span>
                      </div>
                      {renderWeatherIcon(day.condition)}
                    </div>

                    <div className="mt-1.5 text-sm font-bold text-slate-900">
                      {day.conditionLabel}
                    </div>
                    <div className="text-xs font-medium text-emerald-700">{day.movementTag}</div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-slate-100 pt-2.5 text-xs tabular-nums">
                      <div>
                        <dt className="text-[11px] text-slate-500">Temp</dt>
                        <dd className="font-mono font-semibold text-slate-900">{day.tempHighC}°C</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-slate-500">Humidity</dt>
                        <dd className="font-mono font-semibold text-slate-900">{day.humidityPct}%</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-slate-500">Wind</dt>
                        <dd className="font-mono font-semibold text-slate-900">{day.windKmh} km/h</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-slate-500">Dew Risk</dt>
                        <dd
                          className={`font-semibold ${
                            day.dewRisk === 'High'
                              ? 'text-sky-700'
                              : day.dewRisk === 'Moderate'
                              ? 'text-amber-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {day.dewRisk}
                        </dd>
                      </div>
                    </dl>

                    <p className="mt-2.5 text-[11px] leading-snug text-slate-600">
                      {day.ballMovementNote}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Players to Watch Out For */}
          <div className="lg:col-span-5">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2
                className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 text-xl font-bold text-slate-900"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                Players to Watch Out For
              </h2>
              <div className="divide-y divide-slate-100">
                {report.playersToWatch.map(({ player, threatLabel, scoutingAdvice }) => (
                  <div key={player.id} className="py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onInspectPlayer(player)}
                        className="text-sm font-semibold text-slate-900 hover:text-emerald-700 hover:underline"
                      >
                        {player.name}
                      </button>
                      <span className="font-mono text-xs font-semibold text-amber-700">
                        {threatLabel} · OVR {player.overallRating}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {scoutingAdvice}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Opponent Starting XI */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7">
            <h2
              className="mb-3 border-b border-slate-100 pb-2 text-xl font-bold text-slate-900"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {oppTeam.name} — Expected Starting XI
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 font-semibold">#</th>
                    <th className="py-2 font-semibold">Player</th>
                    <th className="py-2 font-semibold">Role &amp; Style</th>
                    <th className="py-2 font-semibold">Tag</th>
                    <th className="py-2 text-right font-semibold">BAT</th>
                    <th className="py-2 text-right font-semibold">BOWL</th>
                    <th className="py-2 text-right font-semibold">OVR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {report.opponentXI.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-2 font-semibold text-slate-900">
                        <button
                          type="button"
                          onClick={() => onInspectPlayer(p)}
                          className="hover:text-emerald-700 hover:underline"
                        >
                          {p.name}
                        </button>
                      </td>
                      <td className="py-2 text-slate-600">
                        {p.role.replace('_', ' ')} · {p.bowlingStyle}
                      </td>
                      <td className="py-2 text-slate-600">
                        {p.category === 'INDIAN_U19'
                          ? 'U19'
                          : p.category === 'FOREIGN'
                          ? p.nationality
                          : 'IND'}
                      </td>
                      <td className="py-2 text-right font-mono">{p.batRating}</td>
                      <td className="py-2 text-right font-mono">{p.bowlRating}</td>
                      <td className="py-2 text-right font-mono font-bold text-slate-900">
                        {p.overallRating}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const activeInn: InningsState =
    match.currentInnings === 1 || !match.innings2 ? match.innings1 : match.innings2;
  const batTeam = teamMap.get(activeInn.battingTeamId)!;
  const bowlTeam = teamMap.get(activeInn.bowlingTeamId)!;
  const striker = playerMap.get(activeInn.strikerId);
  const nonStriker = playerMap.get(activeInn.nonStrikerId);
  const currentBowler = playerMap.get(activeInn.currentBowlerId);

  const crr =
    activeInn.ballsCompleted > 0
      ? ((activeInn.runs / activeInn.ballsCompleted) * 6).toFixed(2)
      : '0.00';
  const ballsLeft = Math.max(0, 120 - activeInn.ballsCompleted);
  const runsNeeded =
    match.targetRuns !== null ? Math.max(0, match.targetRuns - activeInn.runs) : null;
  const rrr =
    runsNeeded !== null && ballsLeft > 0
      ? ((runsNeeded / ballsLeft) * 6).toFixed(2)
      : null;

  const handlePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitTacticalPlan(planInput);
    setPlanInput('');
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6 sm:py-6">
      {/* Broadcast Scorebug */}
      <section
        aria-label="Live match scorebug"
        className="mb-6 rounded-xl border border-slate-800 bg-slate-950 p-4 text-white sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="text-xs text-emerald-400">
              {match.stage.replace('_', ' ')} · {venuePitch.stadium}, {venuePitch.city} · Weather:{' '}
              {weatherProfile.label} · Toss: {teamMap.get(match.tossWinnerId)?.shortCode} chose to{' '}
              {match.tossDecision}
              {match.rivalry
                ? ` · ${match.rivalry.rivalryName} (${userTeam.shortCode} ${
                    userRivalryMorale >= 0 ? `+${userRivalryMorale}` : userRivalryMorale
                  } Morale)`
                : ''}
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-3 sm:gap-4 tabular-nums">
              <span
                className="text-2xl font-bold tracking-tight sm:text-3xl"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {batTeam.shortCode} {activeInn.runs}/{activeInn.wickets}
              </span>
              <span className="font-mono text-base text-slate-300 sm:text-lg">
                ({formatOvers(activeInn.ballsCompleted)} / 20.0 ov)
              </span>
              <span className="font-mono text-xs text-slate-400">CRR {crr}</span>
              {match.targetRuns !== null && match.currentInnings === 2 && (
                <span className="font-mono text-sm font-semibold text-amber-300">
                  Target {match.targetRuns} · Need {runsNeeded} off {ballsLeft} balls
                  {rrr ? ` (RRR ${rrr})` : ''}
                </span>
              )}
              {match.targetRuns !== null && match.currentInnings === 1 && (
                <span className="font-mono text-sm font-semibold text-amber-300">
                  Innings Break · {bowlTeam.shortCode} need {match.targetRuns} to win
                </span>
              )}
            </div>
          </div>

          {/* Match Controls */}
          {match.phase === 'LIVE' && (
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={onPlayBall}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 sm:min-h-0"
              >
                <Play className="h-3.5 w-3.5" />
                Next Ball
              </button>
              <button
                type="button"
                onClick={onSimOver}
                className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors sm:min-h-0 ${
                  simMode === 'OVER'
                    ? 'border-emerald-400 bg-emerald-950/70 text-emerald-200'
                    : 'border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800'
                }`}
              >
                <SkipForward className="h-3.5 w-3.5" />
                {simMode === 'OVER' ? 'Simming Over…' : 'Sim Over'}
              </button>
              <button
                type="button"
                onClick={onSimToCheckpoint}
                className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors sm:min-h-0 ${
                  simMode === 'CHECKPOINT'
                    ? 'border-amber-400 bg-amber-900/70 text-amber-100'
                    : 'border-amber-500/60 bg-amber-950/50 text-amber-200 hover:bg-amber-900/60'
                } ${simMode !== 'IDLE' && onStopSim ? '' : 'col-span-2 sm:col-span-1'}`}
              >
                <FastForward className="h-3.5 w-3.5" />
                {simMode === 'CHECKPOINT' ? 'Simming to Checkpoint…' : 'Sim to Checkpoint'}
              </button>
              {simMode !== 'IDLE' && onStopSim && (
                <button
                  type="button"
                  onClick={onStopSim}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-red-500/60 bg-red-950/50 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-900/60 sm:min-h-0"
                >
                  <Square className="h-3 w-3" />
                  Stop Sim
                </button>
              )}
            </div>
          )}

          {match.phase === 'COMPLETED' && (
            <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-start sm:gap-4">
              <span className="text-sm font-semibold text-amber-300">{match.resultText}</span>
              <button
                type="button"
                onClick={onCompleteMatchReturn}
                className="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 sm:min-h-0"
              >
                Save Result &amp; Post Game
              </button>
            </div>
          )}
        </div>

        {/* Simulation Key-Event 2s Pause Banner */}
        {(simPauseEvent || simMode !== 'IDLE') && (
          <div
            aria-label="Simulation event pause notice"
            className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3.5 py-2 text-xs ${
              simPauseEvent?.eventLabel === 'WICKET'
                ? 'border-red-500/50 bg-red-950/60 text-red-100'
                : simPauseEvent?.eventLabel === 'SIX'
                ? 'border-amber-500/50 bg-amber-950/60 text-amber-100'
                : simPauseEvent?.eventLabel === 'FOUR'
                ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-100'
                : simPauseEvent?.eventLabel === 'NEAR MISS'
                ? 'border-sky-500/50 bg-sky-950/60 text-sky-100'
                : 'border-slate-700 bg-slate-900/80 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              <Pause className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {simPauseEvent ? (
                <span>
                  <strong className="font-mono uppercase tracking-wide">
                    Sim Paused (2.0s) · {simPauseEvent.eventLabel}
                  </strong>{' '}
                  — {simPauseEvent.commentary}
                </span>
              ) : (
                <span>
                  {simMode === 'OVER'
                    ? 'Simulating over ball-by-ball (pauses 2.0s for 4, 6, wicket, or near miss)…'
                    : 'Simulating to next checkpoint (pauses 2.0s for 4, 6, wicket, or near miss)…'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Active Striker / Non-Striker / Bowler Bar */}
        <div className="mt-4 grid grid-cols-1 gap-4 text-xs md:grid-cols-3 tabular-nums">
          <div className="rounded-lg bg-slate-900/80 px-3.5 py-2.5">
            <div className="text-slate-400">On Strike ({batTeam.shortCode})</div>
            <div className="mt-0.5 flex items-baseline justify-between font-medium text-white">
              <span>{striker?.name ?? '-'} *</span>
              <span className="font-mono">
                {striker ? activeInn.batterStats[striker.id]?.runs ?? 0 : 0} (
                {striker ? activeInn.batterStats[striker.id]?.balls ?? 0 : 0})
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-slate-900/80 px-3.5 py-2.5">
            <div className="text-slate-400">Non-Striker</div>
            <div className="mt-0.5 flex items-baseline justify-between font-medium text-slate-200">
              <span>{nonStriker?.name ?? '-'}</span>
              <span className="font-mono">
                {nonStriker ? activeInn.batterStats[nonStriker.id]?.runs ?? 0 : 0} (
                {nonStriker ? activeInn.batterStats[nonStriker.id]?.balls ?? 0 : 0})
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-slate-900/80 px-3.5 py-2.5">
            <div className="text-slate-400">Current Bowler ({bowlTeam.shortCode})</div>
            <div className="mt-0.5 flex items-baseline justify-between font-medium text-white">
              <span>{currentBowler?.name ?? '-'}</span>
              <span className="font-mono">
                {currentBowler
                  ? `${activeInn.bowlerStats[currentBowler.id]?.wickets ?? 0}/${
                      activeInn.bowlerStats[currentBowler.id]?.runsConceded ?? 0
                    } (${formatOvers(activeInn.bowlerStats[currentBowler.id]?.ballsBowled ?? 0)})`
                  : '-'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Post-Match Summary Card shown immediately when match concludes */}
      {match.phase === 'COMPLETED' &&
        (() => {
          const summaryReport = generateMatchPerformanceReport(match, teamMap, playerMap);
          const inn1Team = teamMap.get(match.innings1.battingTeamId);
          const inn2Team = match.innings2
            ? teamMap.get(match.innings2.battingTeamId)
            : teamMap.get(match.innings1.bowlingTeamId);
          const { highestScorer, bestBowler, playerOfTheMatch, milestones, totals } =
            summaryReport;

          return (
            <section
              aria-label="Post-match summary card"
              className="mb-6 rounded-xl border border-slate-200 bg-white p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Post-Match Summary · {match.stage.replace('_', ' ')} · {venuePitch.stadium},{' '}
                    {venuePitch.city}
                  </div>
                  <h2
                    className="mt-1 text-2xl font-bold tracking-tight text-slate-900"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {match.resultText}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-xs text-slate-800 tabular-nums">
                    <span>
                      <strong className="text-slate-900">{inn1Team?.shortCode}</strong>{' '}
                      {match.innings1.runs}/{match.innings1.wickets} (
                      {formatOvers(match.innings1.ballsCompleted)})
                    </span>
                    <span className="text-slate-300" aria-hidden="true">
                      vs
                    </span>
                    {match.innings2 && (
                      <span>
                        <strong className="text-slate-900">{inn2Team?.shortCode}</strong>{' '}
                        {match.innings2.runs}/{match.innings2.wickets} (
                        {formatOvers(match.innings2.ballsCompleted)})
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onCompleteMatchReturn}
                    className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-600"
                  >
                    Save Result &amp; Post Game
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 divide-y divide-slate-200 border-t border-slate-200 pt-4 md:grid-cols-3 md:divide-x md:divide-y-0">
                {/* Highest Scorer */}
                <div className="py-3 md:py-0 md:pr-5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                    Highest Scorer
                  </div>
                  {highestScorer ? (
                    <>
                      <div className="mt-1.5 flex items-baseline justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const p = playerMap.get(highestScorer.playerId);
                            if (p) onInspectPlayer(p);
                          }}
                          className="text-base font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                        >
                          {highestScorer.playerName}
                        </button>
                        <span className="font-mono text-xs font-semibold text-slate-500">
                          {highestScorer.teamShortCode}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                        {highestScorer.runs}
                        {highestScorer.isOut ? '' : '*'}{' '}
                        <span className="text-sm font-medium text-slate-500">
                          ({highestScorer.balls} balls)
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-xs text-slate-600 tabular-nums">
                        {highestScorer.fours}x4 · {highestScorer.sixes}x6 · SR{' '}
                        {highestScorer.strikeRate.toFixed(1)}
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">No batting innings recorded.</p>
                  )}
                </div>

                {/* Best Bowler */}
                <div className="py-3 md:px-5 md:py-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                    Best Bowler
                  </div>
                  {bestBowler ? (
                    <>
                      <div className="mt-1.5 flex items-baseline justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const p = playerMap.get(bestBowler.playerId);
                            if (p) onInspectPlayer(p);
                          }}
                          className="text-base font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                        >
                          {bestBowler.playerName}
                        </button>
                        <span className="font-mono text-xs font-semibold text-slate-500">
                          {bestBowler.teamShortCode}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                        {bestBowler.wickets}/{bestBowler.runsConceded}{' '}
                        <span className="text-sm font-medium text-slate-500">
                          ({bestBowler.oversText} ov)
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-xs text-slate-600 tabular-nums">
                        Econ {bestBowler.economy.toFixed(2)} · {bestBowler.dots} dot balls
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">No bowling spells recorded.</p>
                  )}
                </div>

                {/* Player of the Match & Match Highlights */}
                <div className="py-3 md:py-0 md:pl-5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                    <Award className="h-3.5 w-3.5" aria-hidden="true" />
                    Player of the Match
                  </div>
                  {playerOfTheMatch ? (
                    <>
                      <div className="mt-1.5 flex items-baseline justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const p = playerMap.get(playerOfTheMatch.playerId);
                            if (p) onInspectPlayer(p);
                          }}
                          className="text-base font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                        >
                          {playerOfTheMatch.playerName}
                        </button>
                        <span className="font-mono text-xs font-semibold text-slate-500">
                          {playerOfTheMatch.teamShortCode}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                        {playerOfTheMatch.summaryLine}
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">Standout performer pending.</p>
                  )}
                  <div className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-600 tabular-nums">
                    <div className="font-mono text-[11px]">
                      Totals: {totals.runs} runs · {totals.wickets} wkts · {totals.fours}x4 ·{' '}
                      {totals.sixes}x6
                    </div>
                    {milestones.length > 0 && (
                      <div className="mt-1 truncate text-[11px] text-slate-700">
                        Milestones:{' '}
                        <strong className="text-slate-900">
                          {milestones
                            .slice(0, 2)
                            .map((m) => `${m.milestoneTitle} (${m.playerName})`)
                            .join(', ')}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })()}

      {/* Checkpoint Tactical Briefing Panel (Start of Match, PP1 End, Innings Break, PP2 End) */}
      {match.phase === 'CHECKPOINT_TACTICS' && match.activeCheckpoint && (
        <section
          aria-label="Manager tactical briefing"
          className="mb-5 rounded-xl border border-amber-300 bg-amber-50/70 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <MessageSquare className="h-3.5 w-3.5" />
                Manager Tactical Checkpoint
              </div>
              <h2
                className="mt-0.5 text-xl font-bold text-slate-900"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {CHECKPOINT_TITLES[match.activeCheckpoint]}
              </h2>
              <p className="mt-0.5 text-xs text-slate-700">
                {match.activeCheckpoint === 'INNINGS_BREAK'
                  ? `First innings concluded at ${match.innings1.runs}/${match.innings1.wickets}. Target set: ${match.targetRuns} runs. Issue your second-innings plan to the squad.`
                  : `Pitch: ${venuePitch.surfaceSummary}. Type your instructions below to shape batting tempo, strike rotation, spin/pace usage, and death-over execution.`}
              </p>
            </div>
          </div>

          <form onSubmit={handlePlanSubmit} className="mt-3 space-y-2.5">
            <label htmlFor="tactical-plan-textarea" className="block text-xs font-semibold text-slate-800">
              Your Plan to the Team
            </label>
            <textarea
              id="tactical-plan-textarea"
              rows={2}
              value={planInput}
              onChange={(e) => setPlanInput(e.target.value)}
              placeholder="e.g. Target the short square boundary against their spinners, rotate singles in middle overs, and hold our best variations bowler for overs 17-20..."
              className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PLAN_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setPlanInput(ex)}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
              >
                Communicate Plan &amp; Resume
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Main Match Content: Ground Radar + Commentary / Scorecard */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4">
          <h3
            className="mb-3 border-b border-slate-100 pb-2 text-lg font-bold text-slate-900"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Ground &amp; Shot Radar
          </h3>
          <WagonWheelSvg
            recentBalls={activeInn.recentBalls}
            boundarySize={venuePitch.boundarySize}
          />
          <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600">
            <div>
              Active Plan:{' '}
              <strong className="text-slate-900">
                {match.userDirectives.summaryTags.join(' · ')}
              </strong>
            </div>
            <div>
              Innings 1:{' '}
              <strong className="font-mono text-slate-900 tabular-nums">
                {teamMap.get(match.innings1.battingTeamId)?.shortCode} {match.innings1.runs}/
                {match.innings1.wickets} ({formatOvers(match.innings1.ballsCompleted)})
              </strong>
            </div>
            {match.innings2 && (
              <div>
                Innings 2:{' '}
                <strong className="font-mono text-slate-900 tabular-nums">
                  {teamMap.get(match.innings2.battingTeamId)?.shortCode} {match.innings2.runs}/
                  {match.innings2.wickets} ({formatOvers(match.innings2.ballsCompleted)})
                </strong>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 lg:col-span-8">
          <div className="mb-4 border-b border-slate-100 pb-3">
            <div className="flex flex-nowrap items-center gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setDetailTab('COMMENTARY')}
                className={`min-h-[38px] shrink-0 whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold sm:min-h-0 ${
                  detailTab === 'COMMENTARY'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ball-by-Ball Commentary
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('SCORECARD')}
                className={`min-h-[38px] shrink-0 whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold sm:min-h-0 ${
                  detailTab === 'SCORECARD'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Scorecard
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('TACTICS')}
                className={`min-h-[38px] shrink-0 whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold sm:min-h-0 ${
                  detailTab === 'TACTICS'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Team Talk Log ({match.tacticsLog.length})
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('CONDITIONS')}
                className={`min-h-[38px] shrink-0 whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold sm:min-h-0 ${
                  detailTab === 'CONDITIONS'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pitch &amp; Forecast
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('REPORT')}
                className={`min-h-[38px] shrink-0 whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold sm:min-h-0 ${
                  detailTab === 'REPORT'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Performance Reports
              </button>
            </div>
          </div>

          {detailTab === 'COMMENTARY' && (
            <div className="max-h-[380px] space-y-1 overflow-y-auto pr-1 text-xs">
              {match.commentaryFeed.length === 0 ? (
                <p className="py-8 text-center text-slate-500">
                  Submit your start-of-match tactical plan to bowl the first delivery.
                </p>
              ) : (
                match.commentaryFeed.map((ball, i) => {
                  const eventLabel = getBallEventLabel(ball);
                  const isActivePauseBall = i === 0 && Boolean(simPauseEvent);
                  const rowTone =
                    eventLabel === 'WICKET'
                      ? 'rounded-lg border border-red-200 bg-red-50/90 px-3 py-2.5'
                      : eventLabel === 'SIX'
                      ? 'rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2.5'
                      : eventLabel === 'FOUR'
                      ? 'rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2.5'
                      : eventLabel === 'NEAR MISS'
                      ? 'rounded-lg border border-sky-200 bg-sky-50/90 px-3 py-2.5'
                      : 'border-b border-slate-100 px-2 py-2.5';

                  const tagStyle =
                    eventLabel === 'WICKET'
                      ? 'bg-red-700 text-white'
                      : eventLabel === 'SIX'
                      ? 'bg-amber-600 text-white'
                      : eventLabel === 'FOUR'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-sky-700 text-white';

                  const textTone =
                    eventLabel === 'WICKET'
                      ? 'font-semibold text-red-950'
                      : eventLabel === 'SIX'
                      ? 'font-semibold text-amber-950'
                      : eventLabel === 'FOUR'
                      ? 'font-semibold text-emerald-950'
                      : eventLabel === 'NEAR MISS'
                      ? 'font-semibold text-sky-950'
                      : 'text-slate-700';

                  return (
                    <div
                      key={`${ball.innings}-${ball.over}-${ball.ballInOver}-${i}`}
                      data-ball-event={eventLabel ?? 'NORMAL'}
                      className={`flex items-baseline justify-between gap-4 ${rowTone} ${
                        isActivePauseBall ? 'ring-1 ring-slate-900/30' : ''
                      }`}
                    >
                      <div className="flex flex-wrap items-baseline gap-2">
                        {eventLabel && (
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${tagStyle}`}
                          >
                            {eventLabel}
                          </span>
                        )}
                        <span className={textTone}>{ball.commentary}</span>
                      </div>
                      <span
                        className={`shrink-0 font-mono text-[11px] font-semibold tabular-nums ${
                          eventLabel === 'WICKET'
                            ? 'text-red-700'
                            : eventLabel === 'SIX'
                            ? 'text-amber-700'
                            : eventLabel === 'FOUR'
                            ? 'text-emerald-700'
                            : eventLabel === 'NEAR MISS'
                            ? 'text-sky-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {ball.isWicket
                          ? 'W'
                          : ball.isNearMiss && ball.runsScored === 0
                          ? '!'
                          : ball.extraType !== 'NONE'
                          ? `+${ball.extraRuns}`
                          : ball.runsScored}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {detailTab === 'SCORECARD' && (
            <div className="max-h-[380px] space-y-6 overflow-y-auto pr-1 text-xs">
              <div>
                <h4 className="mb-2 font-semibold text-slate-900">
                  {batTeam.name} Batting ({activeInn.runs}/{activeInn.wickets})
                </h4>
                <table className="w-full text-left">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-1.5 font-medium">Batter</th>
                      <th className="py-1.5 font-medium">Status</th>
                      <th className="py-1.5 text-right font-medium">R</th>
                      <th className="py-1.5 text-right font-medium">B</th>
                      <th className="py-1.5 text-right font-medium">4s</th>
                      <th className="py-1.5 text-right font-medium">6s</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {activeInn.battingOrderIds.map((pid) => {
                      const st = activeInn.batterStats[pid];
                      const p = playerMap.get(pid);
                      if (!st || !p) return null;
                      return (
                        <tr key={pid}>
                          <td className="py-1.5 font-medium text-slate-900">{p.name}</td>
                          <td className="py-1.5 text-slate-500">
                            {st.balls === 0 && !st.isOut && pid !== activeInn.strikerId && pid !== activeInn.nonStrikerId
                              ? 'did not bat'
                              : st.dismissalText}
                          </td>
                          <td className="py-1.5 text-right font-mono font-semibold">{st.runs}</td>
                          <td className="py-1.5 text-right font-mono">{st.balls}</td>
                          <td className="py-1.5 text-right font-mono">{st.fours}</td>
                          <td className="py-1.5 text-right font-mono">{st.sixes}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div>
                <h4 className="mb-2 font-semibold text-slate-900">{bowlTeam.name} Bowling</h4>
                <table className="w-full text-left">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-1.5 font-medium">Bowler</th>
                      <th className="py-1.5 text-right font-medium">O</th>
                      <th className="py-1.5 text-right font-medium">R</th>
                      <th className="py-1.5 text-right font-medium">W</th>
                      <th className="py-1.5 text-right font-medium">Dots</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {Object.values(activeInn.bowlerStats)
                      .filter((b) => b.ballsBowled > 0)
                      .map((b) => {
                        const p = playerMap.get(b.playerId);
                        return (
                          <tr key={b.playerId}>
                            <td className="py-1.5 font-medium text-slate-900">{p?.name}</td>
                            <td className="py-1.5 text-right font-mono">{formatOvers(b.ballsBowled)}</td>
                            <td className="py-1.5 text-right font-mono">{b.runsConceded}</td>
                            <td className="py-1.5 text-right font-mono font-semibold">{b.wickets}</td>
                            <td className="py-1.5 text-right font-mono">{b.dots}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {detailTab === 'TACTICS' && (
            <div className="max-h-[380px] space-y-3 overflow-y-auto pr-1 text-xs">
              {match.tacticsLog.length === 0 ? (
                <p className="py-8 text-center text-slate-500">
                  No tactical briefings issued yet.
                </p>
              ) : (
                match.tacticsLog.map((entry, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 p-3.5">
                    <div className="font-semibold text-slate-900">
                      {CHECKPOINT_TITLES[entry.checkpoint]} · {entry.directives.summaryTags.join(', ')}
                    </div>
                    <p className="mt-1 text-slate-700">&ldquo;{entry.managerPlanText}&rdquo;</p>
                    <p className="mt-1.5 text-emerald-800">{entry.captainReply}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {detailTab === 'CONDITIONS' && (
            <div className="max-h-[380px] space-y-4 overflow-y-auto pr-1 text-xs">
              <div className="border-b border-slate-100 pb-3">
                <div className="font-semibold text-slate-900">
                  {venuePitch.stadium}, {venuePitch.city} · {venuePitch.surfaceSummary}
                </div>
                <p className="mt-1 text-slate-600">{forecast.trendSummary}</p>
                <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 tabular-nums">
                  <div>Pace Assist: <strong className="font-mono">{venuePitch.paceFactor.toFixed(2)}x</strong></div>
                  <div>Spin Assist: <strong className="font-mono">{venuePitch.spinFactor.toFixed(2)}x</strong></div>
                  <div>Dew Probability: <strong className="font-mono">{Math.round(venuePitch.dewFactor * 100)}%</strong></div>
                </div>
              </div>

              <div className="grid grid-cols-1 divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {forecast.days.map((day) => (
                  <div
                    key={day.dayLabel}
                    className={`p-3 ${day.dayOffset === 0 ? 'bg-emerald-50/50' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">
                        {day.dayLabel} · {day.relativeLabel}
                      </span>
                      {renderWeatherIcon(day.condition)}
                    </div>
                    <div className="mt-1 font-semibold text-slate-800">{day.conditionLabel}</div>
                    <div className="text-[11px] font-medium text-emerald-700">{day.movementTag}</div>
                    <div className="mt-2 grid grid-cols-3 gap-1 font-mono text-[11px] text-slate-700 tabular-nums">
                      <span>{day.tempHighC}°C</span>
                      <span>{day.humidityPct}% RH</span>
                      <span>{day.windKmh} km/h</span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-600">{day.ballMovementNote}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detailTab === 'REPORT' &&
            (() => {
              const report = generateMatchPerformanceReport(match, teamMap, playerMap);
              return (
                <div
                  aria-label="Match performance report"
                  className="space-y-5 text-xs"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="text-xs font-semibold text-emerald-700">
                        {report.isCompleted
                          ? 'Post-Match Performance Report'
                          : 'Live Performance Tracker (Provisional)'}
                      </div>
                      <h4 className="mt-0.5 text-sm font-bold text-slate-900">
                        {report.isCompleted
                          ? report.resultText
                          : 'Final milestones lock once the match concludes'}
                      </h4>
                    </div>
                    <div className="font-mono text-[11px] text-slate-600 tabular-nums">
                      Match Totals: {report.totals.runs} runs · {report.totals.wickets} wkts ·{' '}
                      {report.totals.fours}x4 · {report.totals.sixes}x6
                    </div>
                  </div>

                  {/* Player of the Match Spotlight */}
                  {report.playerOfTheMatch && (
                    <div className="border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800">
                        <Award className="h-3.5 w-3.5" aria-hidden="true" />
                        {report.isCompleted ? 'Player of the Match' : 'Current Match MVP Leader'}
                      </div>
                      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                        <div className="text-sm font-bold text-slate-900">
                          <button
                            type="button"
                            onClick={() => {
                              const p = playerMap.get(report.playerOfTheMatch!.playerId);
                              if (p) onInspectPlayer(p);
                            }}
                            className="hover:text-emerald-700 hover:underline"
                          >
                            {report.playerOfTheMatch.playerName}
                          </button>{' '}
                          <span className="font-mono text-xs font-medium text-slate-500">
                            ({report.playerOfTheMatch.teamShortCode})
                          </span>
                        </div>
                        <div className="font-mono text-xs font-semibold text-slate-800 tabular-nums">
                          {report.playerOfTheMatch.summaryLine}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Key Player Milestones */}
                  <div>
                    <div className="mb-2 flex items-baseline justify-between">
                      <h5 className="font-semibold text-slate-900">
                        Key Player Milestones ({report.milestones.length})
                      </h5>
                      <span className="text-[11px] text-slate-500">
                        Centuries, 50s, 3W–5W hauls, economical spells &amp; blitzes
                      </span>
                    </div>

                    {report.milestones.length === 0 ? (
                      <p className="border-t border-slate-100 py-5 text-center text-slate-500">
                        {report.isCompleted
                          ? 'No major batting (50+/100+) or bowling (3W–5W) milestones were recorded in this contest.'
                          : 'No major player milestones reached yet—milestones update live as innings progress.'}
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 border-t border-slate-100">
                        {report.milestones.map((m) => {
                          const playerObj = playerMap.get(m.playerId);
                          return (
                            <div
                              key={m.id}
                              className="flex flex-wrap items-start justify-between gap-3 py-2.5"
                            >
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`font-semibold ${
                                      m.tier === 'GOLD'
                                        ? 'text-amber-700'
                                        : m.tier === 'SILVER'
                                        ? 'text-emerald-700'
                                        : 'text-slate-700'
                                    }`}
                                  >
                                    {m.milestoneTitle}
                                  </span>
                                  <span className="text-slate-300" aria-hidden="true">·</span>
                                  {playerObj ? (
                                    <button
                                      type="button"
                                      onClick={() => onInspectPlayer(playerObj)}
                                      className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline"
                                    >
                                      {m.playerName}
                                    </button>
                                  ) : (
                                    <span className="font-semibold text-slate-900">
                                      {m.playerName}
                                    </span>
                                  )}
                                  <span className="font-mono text-[11px] text-slate-500">
                                    {m.teamShortCode}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[11px] text-slate-600">{m.detail}</p>
                              </div>
                              <div className="shrink-0 font-mono text-xs font-semibold text-slate-900 tabular-nums">
                                {m.statLine}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Franchise Innings Leaders */}
                  <div className="border-t border-slate-200 pt-3">
                    <h5 className="mb-2 font-semibold text-slate-900">
                      Team Innings Leaders
                    </h5>
                    <div className="grid grid-cols-1 divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                      {report.teamSummaries.map((ts) => (
                        <div key={ts.teamId} className="py-2 sm:px-3 sm:first:pl-0 sm:last:pr-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-semibold text-slate-900">{ts.teamName}</span>
                            <span className="font-mono font-semibold text-slate-800 tabular-nums">
                              {ts.scoreText}
                            </span>
                          </div>
                          <div className="mt-1.5 space-y-1 text-[11px] text-slate-600 tabular-nums">
                            <div>
                              Top Batter: <strong className="text-slate-800">{ts.topBatterLine}</strong>
                            </div>
                            <div>
                              Top Bowler: <strong className="text-slate-800">{ts.topBowlerLine}</strong>
                            </div>
                            <div>
                              Boundaries: <span className="font-mono">{ts.fours} fours · {ts.sixes} sixes</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>
      </div>

      {/* Recharts Dual-Innings Run Rate Progression Graph */}
      {(() => {
        const inn1Team = teamMap.get(match.innings1.battingTeamId);
        const inn2Team = match.innings2
          ? teamMap.get(match.innings2.battingTeamId)
          : teamMap.get(match.innings1.bowlingTeamId);
        const chartData = buildRunRateChartData(match.innings1, match.innings2);
        const inn1Code = inn1Team?.shortCode ?? 'INN1';
        const inn2Code = inn2Team?.shortCode ?? 'INN2';
        const targetRR =
          match.targetRuns !== null ? Number((match.targetRuns / 20).toFixed(2)) : null;

        return (
          <section
            aria-label="Run Rate progression chart"
            className="mt-5 rounded-xl border border-slate-200 bg-white p-5"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3
                  className="text-base font-bold text-slate-900"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Run Rate Progression (Overs 1–20)
                </h3>
                <p className="text-xs text-slate-500">
                  Cumulative scoring rate across both innings
                  {targetRR !== null ? ` · Target pace: ${targetRR.toFixed(2)} RPO` : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs tabular-nums">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-700" aria-hidden="true" />
                  {inn1Code} (1st Inn)
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                  <span className="h-2.5 w-2.5 rounded-sm bg-blue-700" aria-hidden="true" />
                  {inn2Code} (2nd Inn)
                </span>
                {targetRR !== null && (
                  <span className="inline-flex items-center gap-1.5 font-mono text-slate-600">
                    <span className="inline-block w-3 border-t-2 border-dashed border-amber-600" aria-hidden="true" />
                    Par {targetRR.toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 text-xs text-slate-500">
                Bowl the opening delivery to plot the over-by-over run rate progression for both innings.
              </div>
            ) : (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="overLabel"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 'auto']}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#CBD5E1',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(value, name, item) => {
                        const payload = item?.payload as
                          | { inn1Score?: string | null; inn2Score?: string | null }
                          | undefined;
                        const numVal = typeof value === 'number' ? value.toFixed(2) : String(value ?? '');
                        if (String(name).includes('1st Inn') && payload?.inn1Score) {
                          return [`${numVal} RPO (${payload.inn1Score})`, name];
                        }
                        if (String(name).includes('2nd Inn') && payload?.inn2Score) {
                          return [`${numVal} RPO (${payload.inn2Score})`, name];
                        }
                        return [`${numVal} RPO`, name];
                      }}
                    />
                    {targetRR !== null && (
                      <ReferenceLine
                        y={targetRR}
                        stroke="#D97706"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="inn1RunRate"
                      name={`${inn1Code} (1st Inn)`}
                      stroke="#047857"
                      strokeWidth={2.5}
                      dot={{ r: 2.5, fill: '#047857' }}
                      activeDot={{ r: 4.5 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="inn2RunRate"
                      name={`${inn2Code} (2nd Inn)`}
                      stroke="#1D4ED8"
                      strokeWidth={2.5}
                      dot={{ r: 2.5, fill: '#1D4ED8' }}
                      activeDot={{ r: 4.5 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        );
      })()}
    </div>
  );
};


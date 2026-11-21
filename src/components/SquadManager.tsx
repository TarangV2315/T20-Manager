import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, HeartPulse, Sparkles } from 'lucide-react';
import { PITCH_PROFILES } from '../engine/cities';
import { validateMatchdayXI } from '../engine/matchEngine';
import { CityId, FranchiseTeam, Player } from '../engine/types';

interface SquadManagerProps {
  userTeam: FranchiseTeam;
  players: Player[];
  nextVenueCityId: CityId;
  canEnterMatchCenter: boolean;
  onTogglePlayerInXI: (playerId: string) => void;
  onSetCaptain: (playerId: string) => void;
  onSetWicketkeeper: (playerId: string) => void;
  onAutoPickXI: () => void;
  onInspectPlayer: (player: Player) => void;
  onProceedToMatch: () => void;
}

type SquadFilter = 'ALL' | 'XI' | 'BENCH' | 'FATIGUE_INJURY';
type SquadSort =
  | 'OVERALL'
  | 'XI_FIRST'
  | 'FATIGUE_DESC'
  | 'FATIGUE_ASC'
  | 'BATTING'
  | 'BOWLING'
  | 'LEADERSHIP'
  | 'WICKETKEEPING';

function getFatigueTier(fatigue: number): {
  label: string;
  textColor: string;
  barColor: string;
} {
  if (fatigue >= 75) {
    return {
      label: 'Exhausted',
      textColor: 'text-red-700',
      barColor: 'bg-red-600',
    };
  }
  if (fatigue >= 55) {
    return {
      label: 'High Fatigue',
      textColor: 'text-orange-700',
      barColor: 'bg-orange-500',
    };
  }
  if (fatigue >= 30) {
    return {
      label: 'Moderate',
      textColor: 'text-amber-700',
      barColor: 'bg-amber-500',
    };
  }
  return {
    label: 'Fresh',
    textColor: 'text-emerald-700',
    barColor: 'bg-emerald-600',
  };
}

function formatRoleLabel(role: Player['role']): string {
  switch (role) {
    case 'BATTER':
      return 'Batter';
    case 'BOWLER':
      return 'Bowler';
    case 'ALL_ROUNDER':
      return 'All-Rounder';
    case 'WICKETKEEPER':
      return 'Keeper';
  }
}

export const SquadManager: React.FC<SquadManagerProps> = ({
  userTeam,
  players,
  nextVenueCityId,
  canEnterMatchCenter,
  onTogglePlayerInXI,
  onSetCaptain,
  onSetWicketkeeper,
  onAutoPickXI,
  onInspectPlayer,
  onProceedToMatch,
}) => {
  const [filter, setFilter] = useState<SquadFilter>('ALL');
  const [sortBy, setSortBy] = useState<SquadSort>('OVERALL');

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const roster = useMemo(
    () =>
      userTeam.rosterIds
        .map((id) => playerMap.get(id))
        .filter((p): p is Player => Boolean(p)),
    [userTeam.rosterIds, playerMap]
  );

  const validation = validateMatchdayXI(userTeam.selectedXIIds, playerMap);
  const nextPitch = PITCH_PROFILES[nextVenueCityId];

  const injuredCount = roster.filter((p) => p.injuredMatchesRemaining > 0).length;
  const highFatigueCount = roster.filter(
    (p) => p.injuredMatchesRemaining === 0 && p.fatigue >= 55
  ).length;
  const xiPlayers = roster.filter((p) => userTeam.selectedXIIds.includes(p.id));
  const avgXiFatigue =
    xiPlayers.length > 0
      ? Math.round(xiPlayers.reduce((sum, p) => sum + p.fatigue, 0) / xiPlayers.length)
      : 0;

  const captainPlayer = userTeam.captainId ? playerMap.get(userTeam.captainId) : null;
  const keeperPlayer = userTeam.wicketkeeperId ? playerMap.get(userTeam.wicketkeeperId) : null;

  const visibleRoster = useMemo(() => {
    const filtered = roster.filter((p) => {
      const inXI = userTeam.selectedXIIds.includes(p.id);
      if (filter === 'XI') return inXI;
      if (filter === 'BENCH') return !inXI;
      if (filter === 'FATIGUE_INJURY') {
        return p.injuredMatchesRemaining > 0 || p.fatigue >= 45;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'XI_FIRST') {
        const aIn = userTeam.selectedXIIds.includes(a.id) ? 1 : 0;
        const bIn = userTeam.selectedXIIds.includes(b.id) ? 1 : 0;
        if (bIn !== aIn) return bIn - aIn;
        return b.overallRating - a.overallRating;
      }
      if (sortBy === 'FATIGUE_DESC') return b.fatigue - a.fatigue || b.overallRating - a.overallRating;
      if (sortBy === 'FATIGUE_ASC') return a.fatigue - b.fatigue || b.overallRating - a.overallRating;
      if (sortBy === 'BATTING') return b.batRating - a.batRating || b.overallRating - a.overallRating;
      if (sortBy === 'BOWLING') return b.bowlRating - a.bowlRating || b.overallRating - a.overallRating;
      if (sortBy === 'LEADERSHIP')
        return b.mindset.leadership - a.mindset.leadership || b.overallRating - a.overallRating;
      if (sortBy === 'WICKETKEEPING')
        return (
          b.fielding.wicketkeeping - a.fielding.wicketkeeping || b.overallRating - a.overallRating
        );
      return b.overallRating - a.overallRating;
    });
  }, [roster, userTeam.selectedXIIds, filter, sortBy]);

  const catLabel = (p: Player) =>
    p.category === 'INDIAN_U19'
      ? 'U19 India'
      : p.category === 'FOREIGN'
      ? `${p.nationality} (FOR)`
      : 'India Sr';

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6 sm:py-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4 sm:mb-6">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-slate-900"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {userTeam.name} — Squad &amp; Matchday XI
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Next Venue: {nextPitch.stadium}, {nextPitch.city} ({nextPitch.surfaceSummary}). Select
            your XI, Captain (C), and Wicketkeeper (WK) directly in the squad table.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto sm:gap-3">
          <button
            type="button"
            onClick={onAutoPickXI}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 sm:min-h-0 sm:flex-initial"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
            Auto-Pick Best XI for {nextPitch.city}
          </button>
          <button
            type="button"
            disabled={!validation.isValid || !canEnterMatchCenter}
            onClick={onProceedToMatch}
            title={
              !canEnterMatchCenter
                ? 'Use the Progress button in the top bar to reach Pre-Gameweek before entering Match Center'
                : 'Enter Match Center for upcoming matchup'
            }
            className="min-h-[44px] flex-1 whitespace-nowrap rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300 sm:min-h-0 sm:flex-initial"
          >
            {canEnterMatchCenter ? 'Go to Match Center' : 'Match Center (Pre-Gameweek Only)'}
          </button>
        </div>
      </div>

      {/* Live XI Rule, Leadership & Squad Fitness Bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs tabular-nums">
          <div>
            <span className="text-slate-500">Selected XI:</span>{' '}
            <strong className="font-mono text-sm text-slate-900">
              {userTeam.selectedXIIds.length} / 11
            </strong>
          </div>
          <div>
            <span className="text-slate-500">Indian U19 (Min 1):</span>{' '}
            <strong
              className={`font-mono text-sm ${
                validation.u19Count >= 1 ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {validation.u19Count}
            </strong>
          </div>
          <div>
            <span className="text-slate-500">Overseas (Max 4):</span>{' '}
            <strong
              className={`font-mono text-sm ${
                validation.foreignCount <= 4 ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {validation.foreignCount} / 4
            </strong>
          </div>
          <div>
            <span className="text-slate-500">Bowling Options:</span>{' '}
            <strong className="font-mono text-sm text-slate-900">
              {validation.bowlerOptionCount}
            </strong>
          </div>
          <div>
            <span className="text-slate-500">Avg XI Fatigue:</span>{' '}
            <strong
              className={`font-mono text-sm ${
                avgXiFatigue >= 55
                  ? 'text-orange-700'
                  : avgXiFatigue >= 30
                  ? 'text-amber-700'
                  : 'text-emerald-700'
              }`}
            >
              {avgXiFatigue}%
            </strong>
          </div>
          <div>
            <span className="text-slate-500">Injured Out:</span>{' '}
            <strong
              className={`font-mono text-sm ${
                injuredCount > 0 ? 'text-red-700' : 'text-slate-900'
              }`}
            >
              {injuredCount}
            </strong>
          </div>
          <div>
            <span className="text-slate-500">C / WK:</span>{' '}
            <strong className="text-xs font-semibold text-slate-900">
              {captainPlayer?.name ?? 'Unassigned'} / {keeperPlayer?.name ?? 'Unassigned'}
            </strong>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium">
          {validation.isValid ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Matchday XI Validated
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-red-700">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              {validation.errors[0]}
            </span>
          )}
        </div>
      </div>

      {/* Rotation Filter & Sort Controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Squad filters">
          {(
            [
              { id: 'ALL', label: `All Squad (${roster.length})` },
              { id: 'XI', label: `Selected XI (${xiPlayers.length})` },
              { id: 'BENCH', label: `Bench / Rest (${roster.length - xiPlayers.length})` },
              {
                id: 'FATIGUE_INJURY',
                label: `Tired / Injured (${injuredCount + highFatigueCount})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`min-h-[40px] whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors sm:min-h-0 ${
                filter === tab.id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="squad-sort" className="font-medium text-slate-500">
            Sort by
          </label>
          <select
            id="squad-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SquadSort)}
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-emerald-700 focus:outline-none sm:min-h-0"
          >
            <option value="OVERALL">Overall Rating</option>
            <option value="XI_FIRST">Selected XI First</option>
            <option value="FATIGUE_DESC">Fatigue (Highest First)</option>
            <option value="FATIGUE_ASC">Fatigue (Freshest First)</option>
            <option value="BATTING">Batting Rating</option>
            <option value="BOWLING">Bowling Rating</option>
            <option value="LEADERSHIP">Leadership (LDR)</option>
            <option value="WICKETKEEPING">Wicketkeeping (WK)</option>
          </select>
        </div>
      </div>

      {/* Squad Player Data Table */}
      {visibleRoster.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No players match this rotation filter.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-3 text-center font-semibold" title="Select in Matchday XI">
                    XI
                  </th>
                  <th className="px-2 py-3 text-center font-semibold" title="Assign Captain">
                    C
                  </th>
                  <th className="px-2 py-3 text-center font-semibold" title="Assign Wicketkeeper">
                    WK
                  </th>
                  <th className="px-3 py-3 font-semibold">Player</th>
                  <th className="px-3 py-3 font-semibold">Origin</th>
                  <th className="px-3 py-3 font-semibold">Role</th>
                  <th className="px-3 py-3 font-semibold">Fitness &amp; Fatigue</th>
                  <th className="px-2.5 py-3 text-right font-semibold">
                    <button
                      type="button"
                      onClick={() => setSortBy('OVERALL')}
                      className={`font-semibold hover:text-slate-900 ${
                        sortBy === 'OVERALL' ? 'text-emerald-700 underline' : ''
                      }`}
                    >
                      OVR
                    </button>
                  </th>
                  <th className="px-2.5 py-3 text-right font-semibold">
                    <button
                      type="button"
                      onClick={() => setSortBy('BATTING')}
                      className={`font-semibold hover:text-slate-900 ${
                        sortBy === 'BATTING' ? 'text-emerald-700 underline' : ''
                      }`}
                    >
                      BAT
                    </button>
                  </th>
                  <th className="px-2.5 py-3 text-right font-semibold">
                    <button
                      type="button"
                      onClick={() => setSortBy('BOWLING')}
                      className={`font-semibold hover:text-slate-900 ${
                        sortBy === 'BOWLING' ? 'text-emerald-700 underline' : ''
                      }`}
                    >
                      BOWL
                    </button>
                  </th>
                  <th className="px-2.5 py-3 text-right font-semibold">FLD</th>
                  <th className="px-2.5 py-3 text-right font-semibold">
                    <button
                      type="button"
                      onClick={() => setSortBy('LEADERSHIP')}
                      className={`font-semibold hover:text-slate-900 ${
                        sortBy === 'LEADERSHIP' ? 'text-emerald-700 underline' : ''
                      }`}
                    >
                      LDR
                    </button>
                  </th>
                  <th className="px-2.5 py-3 text-right font-semibold" title="Wicketkeeping rating">
                    <button
                      type="button"
                      onClick={() => setSortBy('WICKETKEEPING')}
                      className={`font-semibold hover:text-slate-900 ${
                        sortBy === 'WICKETKEEPING' ? 'text-emerald-700 underline' : ''
                      }`}
                    >
                      Keep
                    </button>
                  </th>
                  <th className="px-3 py-3 text-right font-semibold">Season Form</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {visibleRoster.map((p) => {
                  const inXI = userTeam.selectedXIIds.includes(p.id);
                  const isCap = userTeam.captainId === p.id;
                  const isKeeper = userTeam.wicketkeeperId === p.id;
                  const isInjured = p.injuredMatchesRemaining > 0;
                  const xiFull = userTeam.selectedXIIds.length >= 11;
                  const fatigueTier = getFatigueTier(p.fatigue);

                  const totalRuns = p.careerHistory.reduce((s, h) => s + h.batting.runs, 0);
                  const totalWickets = p.careerHistory.reduce((s, h) => s + h.bowling.wickets, 0);

                  const rowClass = isInjured
                    ? 'bg-red-50/35 hover:bg-red-50/60'
                    : inXI
                    ? 'bg-emerald-50/35 hover:bg-emerald-50/65'
                    : 'bg-white hover:bg-slate-50';

                  return (
                    <tr key={p.id} className={`transition-colors ${rowClass}`}>
                      {/* XI Selection Checkbox */}
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={inXI}
                          disabled={(isInjured && !inXI) || (!inXI && xiFull)}
                          aria-label={`Select ${p.name} in Matchday XI`}
                          title={
                            isInjured && !inXI
                              ? `Injured (${p.injuredMatchesRemaining} match out)`
                              : !inXI && xiFull
                              ? '11 players already selected — uncheck a starter first'
                              : inXI
                              ? `Remove ${p.name} from Matchday XI`
                              : `Select ${p.name} in Matchday XI`
                          }
                          onChange={() => onTogglePlayerInXI(p.id)}
                          className="h-5 w-5 cursor-pointer rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 sm:h-4 sm:w-4"
                        />
                      </td>

                      {/* Captain Toggle */}
                      <td className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          disabled={!inXI || isInjured}
                          aria-pressed={isCap}
                          aria-label={`Set ${p.name} as Captain`}
                          title={
                            !inXI
                              ? 'Select player in Matchday XI to assign Captain'
                              : isCap
                              ? `${p.name} is Captain`
                              : `Make ${p.name} Captain`
                          }
                          onClick={() => onSetCaptain(p.id)}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded text-[11px] font-bold transition-colors sm:h-6 sm:w-7 ${
                            isCap
                              ? 'bg-slate-900 text-white'
                              : 'border border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35'
                          }`}
                        >
                          C
                        </button>
                      </td>

                      {/* Wicketkeeper Toggle */}
                      <td className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          disabled={!inXI || isInjured}
                          aria-pressed={isKeeper}
                          aria-label={`Set ${p.name} as Wicketkeeper`}
                          title={
                            !inXI
                              ? 'Select player in Matchday XI to assign Wicketkeeper'
                              : isKeeper
                              ? `${p.name} is Wicketkeeper`
                              : `Make ${p.name} Wicketkeeper`
                          }
                          onClick={() => onSetWicketkeeper(p.id)}
                          className={`inline-flex h-8 w-9 items-center justify-center rounded text-[11px] font-bold transition-colors sm:h-6 sm:w-8 ${
                            isKeeper
                              ? 'bg-emerald-700 text-white'
                              : 'border border-slate-200 bg-white text-slate-500 hover:border-emerald-600 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-35'
                          }`}
                        >
                          WK
                        </button>
                      </td>

                      {/* Player Name & Hand/Bowling Style */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-baseline gap-1.5">
                          <button
                            type="button"
                            onClick={() => onInspectPlayer(p)}
                            className="text-left text-sm font-semibold text-slate-900 hover:text-emerald-700 hover:underline"
                          >
                            {p.name}
                          </button>
                          {(isCap || isKeeper) && (
                            <span className="font-mono text-[10px] font-semibold text-emerald-700">
                              {[isCap ? 'C' : null, isKeeper ? 'WK' : null].filter(Boolean).join('/')}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {p.battingHand} · {p.bowlingStyle}
                        </div>
                      </td>

                      {/* Origin / Quota Category */}
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span
                          className={`text-xs font-medium ${
                            p.category === 'INDIAN_U19'
                              ? 'text-amber-700'
                              : p.category === 'FOREIGN'
                              ? 'text-slate-700'
                              : 'text-slate-600'
                          }`}
                        >
                          {catLabel(p)}
                        </span>
                      </td>

                      {/* Role */}
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                        {formatRoleLabel(p.role)}
                      </td>

                      {/* Fitness, Injury Status Flag & Fatigue Bar */}
                      <td className="min-w-[180px] px-3 py-2.5">
                        {isInjured ? (
                          <div className="space-y-1">
                            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-800">
                              <HeartPulse className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span>
                                INJURED · Out {p.injuredMatchesRemaining}M
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Stamina {p.physical.stamina} · Risk {p.physical.injuryProneness}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span
                                className={`inline-flex items-center gap-1 font-semibold ${fatigueTier.textColor}`}
                              >
                                <Activity className="h-3 w-3 shrink-0" aria-hidden="true" />
                                FIT · {fatigueTier.label}
                              </span>
                              <span className="font-mono font-semibold text-slate-700">
                                {p.fatigue}%
                              </span>
                            </div>
                            <div
                              className="h-1.5 w-full overflow-hidden rounded-sm bg-slate-100"
                              role="progressbar"
                              aria-label={`${p.name} fatigue level`}
                              aria-valuenow={p.fatigue}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <div
                                className={`h-full transition-all ${fatigueTier.barColor}`}
                                style={{ width: `${Math.min(100, Math.max(0, p.fatigue))}%` }}
                              />
                            </div>
                            {p.fatigue >= 45 && (
                              <div className="text-[10px] font-medium text-orange-700">
                                Late-over penalty active
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Ratings Columns */}
                      <td className="px-2.5 py-2.5 text-right font-mono text-sm font-bold text-slate-900">
                        {p.overallRating}
                      </td>
                      <td className="px-2.5 py-2.5 text-right font-mono text-slate-800">
                        {p.batRating}
                      </td>
                      <td className="px-2.5 py-2.5 text-right font-mono text-slate-800">
                        {p.bowlRating}
                      </td>
                      <td className="px-2.5 py-2.5 text-right font-mono text-slate-700">
                        {p.fieldRating}
                      </td>
                      <td className="px-2.5 py-2.5 text-right font-mono text-slate-700">
                        {p.mindset.leadership}
                      </td>
                      <td className="px-2.5 py-2.5 text-right font-mono text-slate-700">
                        {p.fielding.wicketkeeping}
                      </td>

                      {/* Season Form & Profile Link */}
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-[11px] text-slate-600">
                        {p.careerHistory.length > 0 ? (
                          <span>
                            {p.careerHistory.length}M · {totalRuns}R · {totalWickets}W
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};


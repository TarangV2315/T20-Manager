import React, { useMemo, useState } from 'react';
import { Trophy, Play } from 'lucide-react';
import { PITCH_PROFILES } from '../engine/cities';
import {
  computeRivalryMoraleForMatch,
  getRivalryDefinition,
  getTeamRivalryLedger,
} from '../engine/rivalry';
import { computeSeasonLeaderboards } from '../engine/tournament';
import { CityId, Fixture, FranchiseTeam, Player, StandingsRow } from '../engine/types';

interface TournamentViewProps {
  teams: FranchiseTeam[];
  players: Player[];
  standings: StandingsRow[];
  fixtures: Fixture[];
  userTeamId: CityId;
  nextUserFixture: Fixture | null;
  championId: CityId | null;
  canLaunchMatch: boolean;
  onStartNextMatch: (fixture: Fixture) => void;
  onInspectPlayer: (player: Player) => void;
}

export const TournamentView: React.FC<TournamentViewProps> = ({
  teams,
  players,
  standings,
  fixtures,
  userTeamId,
  nextUserFixture,
  championId,
  canLaunchMatch,
  onStartNextMatch,
  onInspectPlayer,
}) => {
  const [statsScope, setStatsScope] = useState<'ALL' | 'USER'>('ALL');
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const userTeam = teamMap.get(userTeamId);

  const playoffFixtures = fixtures.filter((f) => f.stage !== 'LEAGUE');
  const leagueFixtures = fixtures.filter((f) => f.stage === 'LEAGUE');
  const completedCount = fixtures.filter((f) => f.completed).length;

  const rivalryLedger = getTeamRivalryLedger(userTeamId, fixtures);
  const nextRivalry = nextUserFixture
    ? computeRivalryMoraleForMatch(
        nextUserFixture.homeTeamId,
        nextUserFixture.awayTeamId,
        fixtures
      )
    : null;
  const nextUserMoraleSummary =
    nextRivalry && nextUserFixture
      ? userTeamId === nextRivalry.homeTeamId
        ? nextRivalry.homeSummary
        : nextRivalry.awaySummary
      : null;

  const { topRunScorers, topWicketTakers } = useMemo(() => {
    const all = computeSeasonLeaderboards(players, teams, 0);
    const filterFn = (teamId: CityId | null) =>
      statsScope === 'ALL' ? true : teamId === userTeamId;
    return {
      topRunScorers: all.topRunScorers.filter((r) => filterFn(r.teamId)).slice(0, 10),
      topWicketTakers: all.topWicketTakers.filter((r) => filterFn(r.teamId)).slice(0, 10),
    };
  }, [players, teams, statsScope, userTeamId]);

  const orangeCapLeader = topRunScorers[0] ?? null;
  const purpleCapLeader = topWicketTakers[0] ?? null;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6 sm:py-6">
      {/* Page Title Row */}
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-slate-900"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Season Stats
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
            Points Table · Individual Batting &amp; Bowling Leaders · Rivalry Ledger ·{' '}
            {completedCount}/{fixtures.length} Matches Completed
          </p>
        </div>
      </div>

      {/* Banner for Champion or Next Match */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
        {championId ? (
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8 text-amber-600" aria-hidden="true" />
            <div>
              <h2
                className="text-2xl font-bold text-slate-900"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {teamMap.get(championId)?.name} Crowned Champions!
              </h2>
              <p className="text-sm text-slate-600">
                {championId === userTeamId
                  ? 'Congratulations! Your tactical management secured the Indian T20 Premier title.'
                  : 'Season complete. Review final season stats or start a New Season from the top bar.'}
              </p>
            </div>
          </div>
        ) : nextUserFixture ? (
          <>
            <div>
              <div className="text-xs font-semibold text-emerald-700">
                Next Matchup · {nextUserFixture.stage.replace('_', ' ')} (Round {nextUserFixture.roundNumber})
                {nextRivalry ? ` · Rivalry: ${nextRivalry.rivalryName}` : ''}
              </div>
              <h2
                className="mt-1 text-2xl font-bold text-slate-900"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {teamMap.get(nextUserFixture.homeTeamId)?.name} vs{' '}
                {teamMap.get(nextUserFixture.awayTeamId)?.name}
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">
                Venue: {PITCH_PROFILES[nextUserFixture.venueCityId].stadium},{' '}
                {PITCH_PROFILES[nextUserFixture.venueCityId].city} ·{' '}
                {PITCH_PROFILES[nextUserFixture.venueCityId].surfaceSummary}
              </p>
              {nextUserMoraleSummary && (
                <p className="mt-1 text-xs font-semibold text-amber-800">
                  {nextUserMoraleSummary}
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={!canLaunchMatch}
              onClick={() => onStartNextMatch(nextUserFixture)}
              title={
                !canLaunchMatch
                  ? 'Use the Progress button in the top bar to advance to Pre-Gameweek'
                  : 'Open Match Center for this matchup'
              }
              className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              {canLaunchMatch ? 'Open Scouting Report & Matchday' : 'Matchday (Progress to Pre-Gameweek)'}
            </button>
          </>
        ) : (
          <div>
            <h2
              className="text-2xl font-bold text-slate-900"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Season Stats &amp; Playoffs
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Your franchise league campaign has concluded.
            </p>
          </div>
        )}
      </div>

      {/* Top Row: League Points Table & Schedule */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Points Table */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6">
          <div className="mb-3 flex items-baseline justify-between border-b border-slate-100 pb-3">
            <h2
              className="text-xl font-bold text-slate-900"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              League Points Table
            </h2>
            <span className="text-xs text-slate-500">Top 4 qualify for Playoffs</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 font-semibold">#</th>
                  <th className="py-2 font-semibold">Franchise</th>
                  <th className="py-2 text-right font-semibold">P</th>
                  <th className="py-2 text-right font-semibold">W</th>
                  <th className="py-2 text-right font-semibold">L</th>
                  <th className="py-2 text-right font-semibold">NRR</th>
                  <th className="py-2 text-right font-semibold">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {standings.map((row, idx) => {
                  const t = teamMap.get(row.teamId)!;
                  const isPlayoffZone = idx < 4;
                  return (
                    <tr
                      key={row.teamId}
                      className={`${t.isUser ? 'bg-emerald-50/70 font-semibold' : ''} ${
                        idx === 3 ? 'border-b-2 border-slate-300' : ''
                      }`}
                    >
                      <td className="py-2.5 font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-2.5 text-slate-900">
                        {t.name}{' '}
                        {t.isUser && <span className="text-emerald-700">(You)</span>}
                        {!t.isUser && isPlayoffZone && (
                          <span className="ml-1 text-[11px] text-slate-400">Q</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right font-mono">{row.played}</td>
                      <td className="py-2.5 text-right font-mono">{row.won}</td>
                      <td className="py-2.5 text-right font-mono">{row.lost}</td>
                      <td className="py-2.5 text-right font-mono">
                        {row.nrr >= 0 ? `+${row.nrr.toFixed(3)}` : row.nrr.toFixed(3)}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                        {row.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4">
            <div className="mb-2.5 flex items-baseline justify-between gap-2">
              <h3
                className="text-base font-bold text-slate-900"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Franchise Rivalry Ledger ({userTeam?.shortCode})
              </h3>
              <span className="text-[11px] text-slate-500">
                Head-to-head drives Matchday tactical morale
              </span>
            </div>
            <div className="divide-y divide-slate-100 text-xs tabular-nums">
              {rivalryLedger.map((entry) => {
                const opp = teamMap.get(entry.opponentId);
                return (
                  <div
                    key={entry.rivalryId}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {entry.rivalryName} · vs {opp?.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        H2H {userTeam?.shortCode} {entry.userWins} –{' '}
                        {entry.opponentWins} {opp?.shortCode} · Last winner:{' '}
                        {entry.lastWinnerId ? teamMap.get(entry.lastWinnerId)?.shortCode : 'None'}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 font-mono text-xs font-semibold ${
                        entry.userMorale > 0
                          ? 'text-emerald-700'
                          : entry.userMorale < 0
                          ? 'text-red-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {entry.moraleLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Playoffs & Schedule */}
        <section className="space-y-6 lg:col-span-6">
          {playoffFixtures.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2
                className="mb-3 border-b border-slate-100 pb-2 text-xl font-bold text-slate-900"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Playoff Bracket
              </h2>
              <div className="divide-y divide-slate-100">
                {playoffFixtures.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                    <div>
                      <div className="font-semibold text-amber-700">
                        {f.stage.replace('_', ' ')}
                      </div>
                      <div className="mt-0.5 font-medium text-slate-900">
                        {teamMap.get(f.homeTeamId)?.shortCode} vs {teamMap.get(f.awayTeamId)?.shortCode}
                      </div>
                      {f.completed && (
                        <div className="mt-0.5 text-slate-600">
                          {f.homeScoreText} · {f.awayScoreText} — {f.resultText}
                        </div>
                      )}
                    </div>
                    {!f.completed && (f.homeTeamId === userTeamId || f.awayTeamId === userTeamId) && (
                      <button
                        type="button"
                        disabled={!canLaunchMatch}
                        onClick={() => onStartNextMatch(f)}
                        className="rounded-lg bg-emerald-700 px-3 py-1.5 font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        Play
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2
              className="mb-3 border-b border-slate-100 pb-2 text-xl font-bold text-slate-900"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              League Fixtures ({leagueFixtures.filter((f) => f.completed).length}/{leagueFixtures.length})
            </h2>
            <div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto pr-1">
              {leagueFixtures.map((f) => {
                const involvesUser = f.homeTeamId === userTeamId || f.awayTeamId === userTeamId;
                const riv = getRivalryDefinition(f.homeTeamId, f.awayTeamId);
                return (
                  <div
                    key={f.id}
                    className={`flex items-center justify-between gap-3 py-2.5 text-xs ${
                      involvesUser ? 'bg-emerald-50/40 px-2' : ''
                    }`}
                  >
                    <div>
                      <div className="text-[11px] text-slate-500">
                        Round {f.roundNumber} · {PITCH_PROFILES[f.venueCityId].city}
                        {riv ? (
                          <span className="font-semibold text-amber-800">
                            {' '}
                            · {riv.name}
                          </span>
                        ) : null}
                      </div>
                      <div className="font-medium text-slate-900">
                        {teamMap.get(f.homeTeamId)?.name} vs {teamMap.get(f.awayTeamId)?.name}
                      </div>
                      {f.completed && (
                        <div className="mt-0.5 text-[11px] text-slate-600 tabular-nums">
                          {teamMap.get(f.homeTeamId)?.shortCode} {f.homeScoreText} ·{' '}
                          {teamMap.get(f.awayTeamId)?.shortCode} {f.awayScoreText} · {f.resultText}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-slate-500">
                      {f.completed ? 'Final' : involvesUser ? 'Your Match' : 'Scheduled'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Individual Season Stats: Most Runs Scored & Most Wickets Taken */}
      <section aria-label="Individual Season Stats" className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              className="text-xl font-bold text-slate-900"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Individual Stats
            </h2>
            <p className="text-xs text-slate-500">
              Season tournament leaders across batting and bowling · Click any player for full profile
            </p>
          </div>

          <div
            role="group"
            aria-label="Filter individual stats by scope"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1"
          >
            <button
              type="button"
              onClick={() => setStatsScope('ALL')}
              className={`min-h-[38px] whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:min-h-0 ${
                statsScope === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Franchises
            </button>
            <button
              type="button"
              onClick={() => setStatsScope('USER')}
              className={`min-h-[38px] whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:min-h-0 ${
                statsScope === 'USER'
                  ? 'bg-emerald-700 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Your Squad ({userTeam?.shortCode})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Most Runs Scored */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3
                  className="text-lg font-bold text-slate-900"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Most Runs Scored
                </h3>
                {orangeCapLeader ? (
                  <p className="mt-0.5 text-xs font-medium text-amber-700 tabular-nums">
                    Leader: {orangeCapLeader.playerName} ({orangeCapLeader.teamShortCode}) ·{' '}
                    {orangeCapLeader.runs} runs · SR {orangeCapLeader.strikeRate.toFixed(1)}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-slate-500">Orange Cap Standings</p>
                )}
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                Top {Math.max(10, topRunScorers.length)} Batters
              </span>
            </div>

            {topRunScorers.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-slate-700">No batting innings recorded yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Complete Gameweek 1 in Match Center to populate the Most Runs Scored leaderboard.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2 font-semibold">#</th>
                      <th className="py-2 font-semibold">Player</th>
                      <th className="py-2 font-semibold">Team</th>
                      <th className="py-2 text-right font-semibold">M</th>
                      <th className="py-2 text-right font-semibold">Inn</th>
                      <th className="py-2 text-right font-semibold">Runs</th>
                      <th className="py-2 text-right font-semibold">HS</th>
                      <th className="py-2 text-right font-semibold">Avg</th>
                      <th className="py-2 text-right font-semibold">SR</th>
                      <th className="py-2 text-right font-semibold">50/100</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {topRunScorers.map((row, idx) => {
                      const playerObj = playerMap.get(row.playerId);
                      return (
                        <tr
                          key={row.playerId}
                          className={row.isUserTeam ? 'bg-emerald-50/60' : 'hover:bg-slate-50/80'}
                        >
                          <td className="py-2.5 font-mono text-slate-500">{idx + 1}</td>
                          <td className="py-2.5 font-medium text-slate-900">
                            {playerObj ? (
                              <button
                                type="button"
                                onClick={() => onInspectPlayer(playerObj)}
                                className="text-left font-medium text-slate-900 hover:text-emerald-700 hover:underline"
                              >
                                {row.playerName}
                              </button>
                            ) : (
                              row.playerName
                            )}
                          </td>
                          <td className="py-2.5 font-mono text-slate-600">
                            {row.teamShortCode}
                          </td>
                          <td className="py-2.5 text-right font-mono">{row.matches}</td>
                          <td className="py-2.5 text-right font-mono">{row.innings}</td>
                          <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                            {row.runs}
                          </td>
                          <td className="py-2.5 text-right font-mono">
                            {row.highScore}
                            {row.highScoreNotOut ? '*' : ''}
                          </td>
                          <td className="py-2.5 text-right font-mono">
                            {row.average !== null ? row.average.toFixed(1) : '-'}
                          </td>
                          <td className="py-2.5 text-right font-mono">
                            {row.strikeRate.toFixed(1)}
                          </td>
                          <td className="py-2.5 text-right font-mono text-slate-600">
                            {row.fifties}/{row.hundreds}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Most Wickets Taken */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3
                  className="text-lg font-bold text-slate-900"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Most Wickets Taken
                </h3>
                {purpleCapLeader ? (
                  <p className="mt-0.5 text-xs font-medium text-emerald-700 tabular-nums">
                    Leader: {purpleCapLeader.playerName} ({purpleCapLeader.teamShortCode}) ·{' '}
                    {purpleCapLeader.wickets} wkts · Econ {purpleCapLeader.economy.toFixed(2)}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-slate-500">Purple Cap Standings</p>
                )}
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                Top {Math.max(10, topWicketTakers.length)} Bowlers
              </span>
            </div>

            {topWicketTakers.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-slate-700">No bowling spells recorded yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Complete Gameweek 1 in Match Center to populate the Most Wickets Taken leaderboard.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2 font-semibold">#</th>
                      <th className="py-2 font-semibold">Player</th>
                      <th className="py-2 font-semibold">Team</th>
                      <th className="py-2 text-right font-semibold">M</th>
                      <th className="py-2 text-right font-semibold">Ov</th>
                      <th className="py-2 text-right font-semibold">Wkts</th>
                      <th className="py-2 text-right font-semibold">Econ</th>
                      <th className="py-2 text-right font-semibold">Avg</th>
                      <th className="py-2 text-right font-semibold">BBI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {topWicketTakers.map((row, idx) => {
                      const playerObj = playerMap.get(row.playerId);
                      return (
                        <tr
                          key={row.playerId}
                          className={row.isUserTeam ? 'bg-emerald-50/60' : 'hover:bg-slate-50/80'}
                        >
                          <td className="py-2.5 font-mono text-slate-500">{idx + 1}</td>
                          <td className="py-2.5 font-medium text-slate-900">
                            {playerObj ? (
                              <button
                                type="button"
                                onClick={() => onInspectPlayer(playerObj)}
                                className="text-left font-medium text-slate-900 hover:text-emerald-700 hover:underline"
                              >
                                {row.playerName}
                              </button>
                            ) : (
                              row.playerName
                            )}
                          </td>
                          <td className="py-2.5 font-mono text-slate-600">
                            {row.teamShortCode}
                          </td>
                          <td className="py-2.5 text-right font-mono">{row.matches}</td>
                          <td className="py-2.5 text-right font-mono">{row.oversText}</td>
                          <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                            {row.wickets}
                          </td>
                          <td className="py-2.5 text-right font-mono">
                            {row.economy.toFixed(2)}
                          </td>
                          <td className="py-2.5 text-right font-mono">
                            {row.average !== null ? row.average.toFixed(1) : '-'}
                          </td>
                          <td className="py-2.5 text-right font-mono text-slate-600">
                            {row.bestFigures}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};


import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, CheckCircle2, Info, Search, XCircle } from 'lucide-react';
import { PITCH_PROFILES } from '../engine/cities';
import {
  CASH_VALUE_PER_LAKH,
  MAX_CASH_ADJUSTMENT_L,
  MAX_PLAYERS_PER_TRADE_SIDE,
  computePlayerTradeValue,
  evaluateTradeFairness,
} from '../engine/trade';
import {
  CityId,
  FranchiseTeam,
  Player,
  PlayerRole,
  TradeLogEntry,
  TradeProposal,
} from '../engine/types';

interface TradeMarketProps {
  teams: FranchiseTeam[];
  players: Player[];
  userTeam: FranchiseTeam;
  tradeHistory: TradeLogEntry[];
  isMatchInProgress: boolean;
  isSeasonComplete: boolean;
  onExecuteTrade: (proposal: TradeProposal) => { accepted: boolean; verdictSummary: string };
  onInspectPlayer: (player: Player) => void;
}

type RoleFilter = 'ALL' | PlayerRole;

export const TradeMarket: React.FC<TradeMarketProps> = ({
  teams,
  players,
  userTeam,
  tradeHistory,
  isMatchInProgress,
  isSeasonComplete,
  onExecuteTrade,
  onInspectPlayer,
}) => {
  const partnerTeams = useMemo(
    () => teams.filter((t) => t.id !== userTeam.id),
    [teams, userTeam.id]
  );

  const [partnerId, setPartnerId] = useState<CityId>(partnerTeams[0]?.id ?? 'chennai');
  const [offeredIds, setOfferedIds] = useState<string[]>([]);
  const [requestedIds, setRequestedIds] = useState<string[]>([]);
  const [cashAdjustmentL, setCashAdjustmentL] = useState<number>(0);
  const [partnerRoleFilter, setPartnerRoleFilter] = useState<RoleFilter>('ALL');
  const [partnerSearch, setPartnerSearch] = useState<string>('');
  const [lastTradeNotice, setLastTradeNotice] = useState<string | null>(null);

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const partnerTeam = useMemo(
    () => partnerTeams.find((t) => t.id === partnerId) ?? partnerTeams[0],
    [partnerTeams, partnerId]
  );

  const userRoster = useMemo(
    () =>
      userTeam.rosterIds
        .map((id) => playerMap.get(id))
        .filter((p): p is Player => Boolean(p))
        .sort((a, b) => b.overallRating - a.overallRating),
    [userTeam.rosterIds, playerMap]
  );

  const partnerRoster = useMemo(() => {
    if (!partnerTeam) return [];
    const q = partnerSearch.trim().toLowerCase();
    return partnerTeam.rosterIds
      .map((id) => playerMap.get(id))
      .filter((p): p is Player => Boolean(p))
      .filter((p) => (partnerRoleFilter === 'ALL' ? true : p.role === partnerRoleFilter))
      .filter((p) =>
        q.length === 0
          ? true
          : p.name.toLowerCase().includes(q) ||
            p.bowlingStyle.toLowerCase().includes(q) ||
            p.nationality.toLowerCase().includes(q)
      )
      .sort((a, b) => b.overallRating - a.overallRating);
  }, [partnerTeam, playerMap, partnerRoleFilter, partnerSearch]);

  const proposal: TradeProposal = {
    userTeamId: userTeam.id,
    partnerTeamId: partnerTeam.id,
    offeredPlayerIds: offeredIds,
    requestedPlayerIds: requestedIds,
    cashAdjustmentL,
  };

  const evaluation = useMemo(
    () => evaluateTradeFairness(proposal, teams, players),
    [proposal, teams, players]
  );

  const handlePartnerChange = (nextPartnerId: CityId) => {
    setPartnerId(nextPartnerId);
    setRequestedIds([]);
    setLastTradeNotice(null);
  };

  const toggleOffered = (id: string) => {
    setLastTradeNotice(null);
    setOfferedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_PLAYERS_PER_TRADE_SIDE) return prev;
      return [...prev, id];
    });
  };

  const toggleRequested = (id: string) => {
    setLastTradeNotice(null);
    setRequestedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_PLAYERS_PER_TRADE_SIDE) return prev;
      return [...prev, id];
    });
  };

  const handleSubmitTrade = () => {
    const res = onExecuteTrade(proposal);
    if (res.accepted) {
      setOfferedIds([]);
      setRequestedIds([]);
      setCashAdjustmentL(0);
    }
    setLastTradeNotice(res.verdictSummary);
  };

  const tradeLockedReason = isSeasonComplete
    ? 'Season has concluded. Start a new season to trade.'
    : isMatchInProgress
    ? 'Finish the active match in Match Center before proposing trades.'
    : null;

  const canSubmit =
    !tradeLockedReason &&
    evaluation.isValid &&
    evaluation.isFair &&
    offeredIds.length > 0 &&
    requestedIds.length > 0;

  const catTag = (p: Player) =>
    p.category === 'INDIAN_U19'
      ? 'U19'
      : p.category === 'FOREIGN'
      ? `${p.nationality.slice(0, 3).toUpperCase()} · FOR`
      : 'IND';

  const partnerPitch = PITCH_PROFILES[partnerTeam.id];

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-slate-900"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Franchise Trade Market
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Propose player swaps (up to {MAX_PLAYERS_PER_TRADE_SIDE} per side) with rival franchises.
            Partner GMs evaluate overall ratings, pitch fit, U19 scarcity, and fitness fairness.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs tabular-nums">
          <div>
            <span className="text-slate-500">{userTeam.shortCode} Purse:</span>{' '}
            <strong className="font-mono text-sm text-slate-900">
              INR {userTeam.purseRemainingL}L
            </strong>
          </div>
          <div>
            <span className="text-slate-500">Roster Size:</span>{' '}
            <strong className="font-mono text-sm text-slate-900">
              {userTeam.rosterIds.length} / 25
            </strong>
          </div>
          <div>
            <span className="text-slate-500">Trades Done:</span>{' '}
            <strong className="font-mono text-sm text-slate-900">{tradeHistory.length}</strong>
          </div>
        </div>
      </div>

      {/* Partner Franchise Selector */}
      <div className="mb-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Select Trade Partner Franchise
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
          {partnerTeams.map((t) => {
            const active = t.id === partnerTeam.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handlePartnerChange(t.id)}
                className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  active
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold tabular-nums">
                  <span>{t.shortCode}</span>
                  <span className={`font-mono ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                    {t.rosterIds.length}/25
                  </span>
                </div>
                <div
                  className={`mt-0.5 truncate text-[11px] ${
                    active ? 'text-slate-200' : 'text-slate-600'
                  }`}
                >
                  {t.city}
                </div>
                <div
                  className={`mt-1 font-mono text-[10px] tabular-nums ${
                    active ? 'text-emerald-300' : 'text-slate-500'
                  }`}
                >
                  INR {t.purseRemainingL}L
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Trade Proposal & Fairness Assessment Card */}
      <section
        aria-label="Trade fairness evaluator"
        className="mb-6 rounded-xl border border-slate-200 bg-white p-5"
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Offered Package */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 lg:col-span-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>You Send ({userTeam.shortCode})</span>
              <span className="font-mono text-slate-500 tabular-nums">
                {offeredIds.length}/{MAX_PLAYERS_PER_TRADE_SIDE}
              </span>
            </div>
            {offeredIds.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                Select up to {MAX_PLAYERS_PER_TRADE_SIDE} players from your roster below.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {offeredIds.map((id) => {
                  const p = playerMap.get(id);
                  if (!p) return null;
                  return (
                    <li
                      key={id}
                      className="flex items-center justify-between rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <span className="font-medium text-slate-900">
                        {p.name}{' '}
                        <span className="font-mono text-slate-500">({p.overallRating})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleOffered(id)}
                        className="text-[11px] font-medium text-slate-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Optional Cash Sweetener */}
            <div className="mt-3 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="trade-cash-input" className="font-medium text-slate-700">
                  Cash Adjustment
                </label>
                <span className="font-mono text-[11px] font-semibold text-slate-900 tabular-nums">
                  {cashAdjustmentL === 0
                    ? 'INR 0L'
                    : cashAdjustmentL > 0
                    ? `You pay INR ${cashAdjustmentL}L`
                    : `${partnerTeam.shortCode} pays INR ${Math.abs(cashAdjustmentL)}L`}
                </span>
              </div>
              <input
                id="trade-cash-input"
                type="range"
                min={-Math.min(MAX_CASH_ADJUSTMENT_L, partnerTeam.purseRemainingL)}
                max={Math.min(MAX_CASH_ADJUSTMENT_L, userTeam.purseRemainingL)}
                step={1}
                value={cashAdjustmentL}
                onChange={(e) => {
                  setLastTradeNotice(null);
                  setCashAdjustmentL(Number(e.target.value));
                }}
                className="mt-1.5 w-full accent-emerald-700"
              />
              <div className="mt-0.5 flex justify-between text-[10px] text-slate-500 tabular-nums">
                <span>Request cash</span>
                <span>1L = {CASH_VALUE_PER_LAKH} trade pts</span>
                <span>Add cash</span>
              </div>
            </div>
          </div>

          {/* Requested Package */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 lg:col-span-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>You Receive ({partnerTeam.shortCode})</span>
              <span className="font-mono text-slate-500 tabular-nums">
                {requestedIds.length}/{MAX_PLAYERS_PER_TRADE_SIDE}
              </span>
            </div>
            {requestedIds.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                Select up to {MAX_PLAYERS_PER_TRADE_SIDE} target players from {partnerTeam.name}.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {requestedIds.map((id) => {
                  const p = playerMap.get(id);
                  if (!p) return null;
                  return (
                    <li
                      key={id}
                      className="flex items-center justify-between rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <span className="font-medium text-slate-900">
                        {p.name}{' '}
                        <span className="font-mono text-slate-500">({p.overallRating})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleRequested(id)}
                        className="text-[11px] font-medium text-slate-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-3 border-t border-slate-200 pt-2.5 text-[11px] text-slate-600">
              <strong className="text-slate-800">{partnerTeam.name}</strong> ·{' '}
              {partnerPitch.surfaceSummary} ({partnerPitch.tacticalNote})
            </div>
          </div>

          {/* Fairness Verdict & Action */}
          <div className="flex flex-col justify-between rounded-lg border border-slate-200 p-3.5 lg:col-span-4">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Fairness Validator</span>
                <span className="font-mono text-slate-600 tabular-nums">
                  {offeredIds.length > 0 && requestedIds.length > 0
                    ? `${Math.round(evaluation.fairnessRatio * 100)}% Match`
                    : 'Awaiting Selection'}
                </span>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2 text-center tabular-nums">
                <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <div className="text-[10px] text-slate-500">Offered Value</div>
                  <div className="font-mono text-base font-bold text-slate-900">
                    {evaluation.offeredValue}
                  </div>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <div className="text-[10px] text-slate-500">Requested Value</div>
                  <div className="font-mono text-base font-bold text-slate-900">
                    {evaluation.requestedValue}
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-xs">
                <div
                  className={`flex items-start gap-1.5 font-semibold ${
                    offeredIds.length === 0 || requestedIds.length === 0
                      ? 'text-slate-600'
                      : evaluation.isValid && evaluation.isFair
                      ? 'text-emerald-700'
                      : 'text-amber-800'
                  }`}
                >
                  {offeredIds.length === 0 || requestedIds.length === 0 ? (
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  ) : evaluation.isValid && evaluation.isFair ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>{evaluation.verdictSummary}</span>
                </div>

                {evaluation.reasons.map((r) => (
                  <p key={r} className="text-[11px] leading-relaxed text-slate-600">
                    {r}
                  </p>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {tradeLockedReason && (
                <div className="rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
                  {tradeLockedReason}
                </div>
              )}
              {lastTradeNotice && (
                <div className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-800">
                  {lastTradeNotice}
                </div>
              )}
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmitTrade}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Propose &amp; Execute Trade
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Two-Column Rosters */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* User Roster */}
        <section aria-label="Your franchise roster" className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {userTeam.name} — Available to Offer
              </h2>
              <p className="text-[11px] text-slate-500">
                Valuations shown from {partnerTeam.shortCode}&apos;s pitch &amp; squad perspective
              </p>
            </div>
            <span className="font-mono text-xs text-slate-600 tabular-nums">
              {userRoster.length} Players
            </span>
          </div>

          <div className="max-h-[460px] divide-y divide-slate-100 overflow-y-auto">
            {userRoster.map((p) => {
              const selected = offeredIds.includes(p.id);
              const valForPartner = computePlayerTradeValue(p, partnerTeam.id);
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 text-xs ${
                    selected ? 'bg-amber-50/60' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={!selected && offeredIds.length >= MAX_PLAYERS_PER_TRADE_SIDE}
                      aria-label={`Offer ${p.name} in trade`}
                      onChange={() => toggleOffered(p.id)}
                      className="h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                    />
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onInspectPlayer(p)}
                        className="truncate font-semibold text-slate-900 hover:text-emerald-700 hover:underline"
                      >
                        {p.name}
                      </button>
                      <div className="text-[11px] text-slate-500">
                        {catTag(p)} · {p.role.replace('_', ' ')} · BAT {p.batRating} / BOWL{' '}
                        {p.bowlRating}
                        {p.injuredMatchesRemaining > 0 && (
                          <span className="ml-1.5 font-semibold text-red-700">
                            · INJ ({p.injuredMatchesRemaining}M)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-4 text-right tabular-nums">
                    <div>
                      <div className="text-[10px] text-slate-400">OVR</div>
                      <div className="font-mono font-bold text-slate-900">{p.overallRating}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">VAL</div>
                      <div className="font-mono font-semibold text-emerald-700">{valForPartner}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Partner Roster */}
        <section
          aria-label="Partner franchise roster"
          className="rounded-xl border border-slate-200 bg-white"
        >
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {partnerTeam.name} — Target Players
                </h2>
                <p className="text-[11px] text-slate-500">
                  {partnerTeam.shortCode} valuation reflects {partnerTeam.city} pitch fit &amp; U19
                  scarcity
                </p>
              </div>
              <span className="font-mono text-xs text-slate-600 tabular-nums">
                {partnerRoster.length} Shown
              </span>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={partnerSearch}
                  onChange={(e) => setPartnerSearch(e.target.value)}
                  placeholder="Search player, style, nation..."
                  aria-label="Search partner roster"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:bg-white focus:outline-none"
                />
              </div>
              <select
                value={partnerRoleFilter}
                onChange={(e) => setPartnerRoleFilter(e.target.value as RoleFilter)}
                aria-label="Filter partner roster by role"
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-700 focus:outline-none"
              >
                <option value="ALL">All Roles</option>
                <option value="BATTER">Batters</option>
                <option value="BOWLER">Bowlers</option>
                <option value="ALL_ROUNDER">All-Rounders</option>
                <option value="WICKETKEEPER">Wicketkeepers</option>
              </select>
            </div>
          </div>

          <div className="max-h-[410px] divide-y divide-slate-100 overflow-y-auto">
            {partnerRoster.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No players match your filter on {partnerTeam.shortCode}.
              </div>
            ) : (
              partnerRoster.map((p) => {
                const selected = requestedIds.includes(p.id);
                const valForPartner = computePlayerTradeValue(p, partnerTeam.id);
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 text-xs ${
                      selected ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={!selected && requestedIds.length >= MAX_PLAYERS_PER_TRADE_SIDE}
                        aria-label={`Request ${p.name} in trade`}
                        onChange={() => toggleRequested(p.id)}
                        className="h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                      />
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onInspectPlayer(p)}
                          className="truncate font-semibold text-slate-900 hover:text-emerald-700 hover:underline"
                        >
                          {p.name}
                        </button>
                        <div className="text-[11px] text-slate-500">
                          {catTag(p)} · {p.role.replace('_', ' ')} · BAT {p.batRating} / BOWL{' '}
                          {p.bowlRating}
                          {p.injuredMatchesRemaining > 0 && (
                            <span className="ml-1.5 font-semibold text-red-700">
                              · INJ ({p.injuredMatchesRemaining}M)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-4 text-right tabular-nums">
                      <div>
                        <div className="text-[10px] text-slate-400">OVR</div>
                        <div className="font-mono font-bold text-slate-900">{p.overallRating}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">VAL</div>
                        <div className="font-mono font-semibold text-slate-800">{valForPartner}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Season Trade Log */}
      {tradeHistory.length > 0 && (
        <section
          aria-label="Completed season trades"
          className="mt-6 rounded-xl border border-slate-200 bg-white p-4"
        >
          <h3 className="text-sm font-bold text-slate-900">Completed Trades This Season</h3>
          <div className="mt-2.5 divide-y divide-slate-100 text-xs">
            {tradeHistory.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 tabular-nums"
              >
                <div className="text-slate-800">
                  <strong className="font-mono text-slate-900">
                    {userTeam.shortCode} ↔ {entry.partnerShortCode}:
                  </strong>{' '}
                  Sent <strong>{entry.offeredPlayerNames.join(', ')}</strong>
                  {entry.cashAdjustmentL > 0 && ` (+ INR ${entry.cashAdjustmentL}L)`} for{' '}
                  <strong>{entry.requestedPlayerNames.join(', ')}</strong>
                  {entry.cashAdjustmentL < 0 && ` (+ INR ${Math.abs(entry.cashAdjustmentL)}L)`}
                </div>
                <span className="text-[11px] font-medium text-emerald-700">
                  {entry.verdictSummary}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

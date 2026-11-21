import React, { useEffect } from 'react';
import { Download, Play, RotateCcw, Trash2 } from 'lucide-react';
import { CITY_LIST } from '../engine/cities';
import { SaveGameSummary } from '../engine/storage';
import { CityId } from '../engine/types';

interface TitleScreenProps {
  selectedCityId: CityId;
  savedGameSummary: SaveGameSummary | null;
  onSelectCity: (cityId: CityId) => void;
  onStartNewGame: () => void;
  onResumeSavedGame: () => void;
  onDeleteSavedGame: () => void;
  showInstallButton?: boolean;
  onOpenInstall?: () => void;
}

function formatSavedTimestamp(iso: string): string {
  try {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return iso;
    return dt.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedCityId,
  savedGameSummary,
  onSelectCity,
  onStartNewGame,
  onResumeSavedGame,
  onDeleteSavedGame,
  showInstallButton = false,
  onOpenInstall,
}) => {
  const selectedPitch = CITY_LIST.find((c) => c.id === selectedCityId) ?? CITY_LIST[0];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
        e.preventDefault();
        if (savedGameSummary) {
          onResumeSavedGame();
        } else {
          onStartNewGame();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onStartNewGame, onResumeSavedGame, savedGameSummary]);

  return (
    <div className="pt-safe pb-safe relative flex min-h-screen w-full flex-col justify-between overflow-x-hidden bg-slate-950 text-white">
      {/* Generated Stadium Backdrop with CSS Gradient Fallback */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950"
        aria-hidden="true"
      />
      <img
        src="/src/assets/images/cricket_stadium_title_1794632715954.jpg"
        alt="Floodlit Indian cricket stadium before a night T20 match"
        referrerPolicy="no-referrer"
        className="absolute inset-0 h-full w-full object-cover opacity-80"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/80"
        aria-hidden="true"
      />

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-between px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10">
        {/* Welcome Hero & Resume Saved Game Split */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="mb-4 flex items-center gap-3.5 sm:gap-4">
              <svg viewBox="0 0 48 48" className="h-11 w-11 shrink-0 sm:h-12 sm:w-12" aria-hidden="true">
                <path
                  d="M24 3L42 10V23C42 34.2 34.3 42.3 24 45C13.7 42.3 6 34.2 6 23V10L24 3Z"
                  fill="#064E3B"
                  stroke="#F59E0B"
                  strokeWidth="2.2"
                />
                <path d="M18 33L28 14" stroke="#F8FAFC" strokeWidth="3" strokeLinecap="round" />
                <circle cx="30" cy="30" r="4.5" fill="#DC2626" stroke="#F8FAFC" strokeWidth="1.2" />
              </svg>
              <div className="text-xs font-medium tracking-wide text-amber-300 sm:text-sm">
                Welcome · Indian T20 Premier Franchise Simulation
              </div>
            </div>

            <h1
              className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl"
              style={{ fontFamily: 'var(--font-display)', textWrap: 'balance' }}
            >
              T20 Manager
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-200 sm:text-base">
              Take charge of an Indian city franchise across 8 distinct home pitches. Manage your
              matchday XI, track player fatigue and season stats, and guide your squad with live
              tactical calls through the league and playoffs.
            </p>

            {showInstallButton && onOpenInstall && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={onOpenInstall}
                  className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg border border-emerald-400/50 bg-emerald-950/75 px-4 py-2 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-900/90"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Install Android App
                </button>
              </div>
            )}
          </div>

          {/* Resume Saved Game Panel (Local Device Storage) */}
          <section
            aria-label="Resume saved game"
            className="rounded-xl border border-slate-700/85 bg-slate-900/90 p-5 lg:col-span-5"
          >
            <div className="flex items-baseline justify-between gap-2 border-b border-slate-800 pb-3">
              <h2 className="text-base font-semibold text-white">Resume Saved Game</h2>
              <span className="text-xs text-slate-400">Saved locally on device</span>
            </div>

            {savedGameSummary ? (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-lg font-bold text-white">
                      {savedGameSummary.franchiseName}
                    </span>
                    <span className="font-mono text-xs font-semibold text-amber-300">
                      {savedGameSummary.shortCode}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-300 tabular-nums">
                    <span>{savedGameSummary.phaseLabel}</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span>Record {savedGameSummary.userRecord}</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span>
                      League {savedGameSummary.matchesCompleted}/{savedGameSummary.totalLeagueMatches}
                    </span>
                  </div>
                  <div className="mt-1.5 text-[11px] text-slate-400 tabular-nums">
                    Last saved: {formatSavedTimestamp(savedGameSummary.savedAtIso)}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onResumeSavedGame}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Resume Saved Game
                  </button>
                  <button
                    type="button"
                    onClick={onDeleteSavedGame}
                    aria-label="Delete saved game"
                    title="Delete local saved game"
                    className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-950/60 px-3.5 py-2.5 text-xs font-medium text-slate-300 transition-colors hover:border-red-500/60 hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <p className="text-xs leading-relaxed text-slate-300">
                  No local save found on this device yet. Start a New Game below and select{' '}
                  <strong className="text-white">Save Progress</strong> during any stage to store your
                  season locally.
                </p>
                <button
                  type="button"
                  disabled
                  className="inline-flex min-h-[44px] w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-sm font-semibold text-slate-500"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  No Saved Game Available
                </button>
              </div>
            )}
          </section>
        </div>

        {/* Start New Game: Franchise & Home Pitch Selector */}
        <section aria-label="Start a new game" className="mt-8 w-full">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-white">
              Start New Game — Choose Your Franchise &amp; Home Pitch
            </h2>
            <span className="text-xs text-slate-300 tabular-nums">
              8 Cities · 25-Player Pitch-Tailored Squads · Season Stats · League &amp; Playoffs
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
            {CITY_LIST.map((city) => {
              const isSelected = city.id === selectedCityId;
              return (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => onSelectCity(city.id)}
                  className={`flex min-h-[84px] flex-col items-start rounded-lg border px-3.5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-950/90 text-white'
                      : 'border-slate-700/80 bg-slate-900/75 text-slate-200 hover:border-slate-500 hover:bg-slate-900/95'
                  }`}
                >
                  <span className="font-mono text-xs font-semibold text-amber-300">
                    {city.shortCode}
                  </span>
                  <span className="mt-1 text-sm font-semibold leading-tight text-white">
                    {city.city}
                  </span>
                  <span className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-300">
                    {city.surfaceSummary}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected Pitch Brief + Start New Game CTA */}
          <div className="mt-5 flex flex-col items-stretch justify-between gap-5 rounded-xl border border-slate-700/80 bg-slate-900/85 p-4 sm:p-5 md:flex-row md:items-center">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                <span>{selectedPitch.franchiseName}</span>
                <span className="text-slate-400" aria-hidden="true">·</span>
                <span className="text-emerald-300">{selectedPitch.stadium}</span>
              </div>
              <p className="text-sm text-slate-300">
                {selectedPitch.surfaceSummary}. {selectedPitch.tacticalNote}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-400 tabular-nums">
                <span>Boundaries: {selectedPitch.boundarySize}</span>
                <span aria-hidden="true">·</span>
                <span>Pace Index: {selectedPitch.paceFactor.toFixed(2)}</span>
                <span aria-hidden="true">·</span>
                <span>Spin Index: {selectedPitch.spinFactor.toFixed(2)}</span>
                <span aria-hidden="true">·</span>
                <span>Evening Dew: {Math.round(selectedPitch.dewFactor * 100)}%</span>
              </div>
            </div>

            <button
              type="button"
              data-start="true"
              onClick={onStartNewGame}
              className={`inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-6 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                savedGameSummary
                  ? 'border border-slate-500 bg-white text-slate-950 hover:bg-slate-100'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500'
              }`}
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              Start New Game
            </button>
          </div>
        </section>

        <div className="mt-6 flex items-center justify-between text-xs text-slate-400">
          <span>
            {savedGameSummary
              ? `Press Enter to resume ${savedGameSummary.franchiseName} or choose a city to start fresh`
              : `Press Enter to start a New Game with ${selectedPitch.franchiseName}`}
          </span>
          <span className="hidden sm:inline">Matchday XI Rules: Min 1 U19 · Max 4 Overseas</span>
        </div>
      </main>
    </div>
  );
};

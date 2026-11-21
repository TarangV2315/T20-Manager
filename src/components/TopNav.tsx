import React from 'react';
import { ArrowRight, Check, Download, Home, Save } from 'lucide-react';
import { ProgressActionDescriptor, getAllowedTabsForPhase } from '../engine/seasonPhase';
import { AppTab, FranchiseTeam, SeasonPhase } from '../engine/types';

export type { AppTab };

interface TopNavProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  seasonPhase: SeasonPhase;
  progressAction: ProgressActionDescriptor;
  onProgress: () => void;
  userTeam: FranchiseTeam;
  justSaved: boolean;
  onSaveGame: () => void;
  onReturnToWelcome: () => void;
  showInstallButton?: boolean;
  onOpenInstall?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  onSelectTab,
  seasonPhase,
  progressAction,
  onProgress,
  userTeam,
  justSaved,
  onSaveGame,
  onReturnToWelcome,
  showInstallButton = false,
  onOpenInstall,
}) => {
  const allowedTabs = getAllowedTabsForPhase(seasonPhase);
  const tabs: { id: AppTab; label: string; disabled: boolean }[] = [
    { id: 'SQUAD', label: 'Squad & XI', disabled: !allowedTabs.SQUAD },
    { id: 'STANDINGS', label: 'Season Stats', disabled: !allowedTabs.STANDINGS },
    { id: 'MATCH', label: 'Match Center', disabled: !allowedTabs.MATCH },
  ];

  const handleWordmarkClick = () => {
    if (seasonPhase === 'MATCH_LIVE') return;
    if (allowedTabs.STANDINGS) {
      onSelectTab('STANDINGS');
    } else if (allowedTabs.SQUAD) {
      onSelectTab('SQUAD');
    }
  };

  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md md:static md:bg-white">
      <div className="mx-auto flex h-[52px] max-w-[1400px] items-center justify-between gap-3 px-4 md:h-auto md:gap-8 md:px-6 md:py-3.5">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={handleWordmarkClick}
          className="shrink-0 whitespace-nowrap text-xl font-bold tracking-tight text-slate-900"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          T20 Manager
        </button>

        {/* Zone 2: Desktop single-line navigation links */}
        <nav
          aria-label="Primary tournament phases"
          className="hidden items-center gap-6 overflow-x-auto md:flex"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                disabled={tab.disabled}
                onClick={() => onSelectTab(tab.id)}
                className={`shrink-0 whitespace-nowrap border-b-2 py-1 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-emerald-700 text-emerald-800'
                    : tab.disabled
                    ? 'cursor-not-allowed border-transparent text-slate-300'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Mobile compact utility controls + Desktop full action group */}
        <div className="flex shrink-0 items-center gap-2 md:gap-2.5">
          <div className="hidden text-right text-xs text-slate-600 xl:block tabular-nums">
            <span className="font-semibold text-slate-900">{userTeam.shortCode}</span>
            <span className="mx-1.5 text-slate-300" aria-hidden="true">·</span>
            <span>INR {userTeam.purseRemainingL}L</span>
            <span className="mx-1.5 text-slate-300" aria-hidden="true">·</span>
            <span>{progressAction.currentPhaseLabel}</span>
          </div>

          <button
            type="button"
            onClick={onSaveGame}
            title="Save current progress locally on this device"
            className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors md:min-h-0 md:px-3 ${
              justSaved
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            {justSaved ? (
              <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
            ) : (
              <Save className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
            )}
            <span>{justSaved ? 'Saved' : 'Save'}</span>
            <span className="hidden sm:inline">{justSaved ? '' : 'Progress'}</span>
          </button>

          {showInstallButton && onOpenInstall && (
            <button
              type="button"
              onClick={onOpenInstall}
              aria-label="Install Android App"
              title="Install T20 Manager on Android"
              className="inline-flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 md:hidden"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            disabled={progressAction.disabled}
            onClick={onProgress}
            title={
              progressAction.disabled
                ? 'Complete the current match to unlock Post-Game progression'
                : progressAction.buttonLabel
            }
            className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300 md:inline-flex"
          >
            <span>{progressAction.buttonLabel}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onReturnToWelcome}
            aria-label="Return to Welcome screen"
            className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 md:min-h-0 md:px-3"
          >
            <Home className="h-3.5 w-3.5 md:hidden" aria-hidden="true" />
            <span className="hidden md:inline">Welcome</span>
          </button>
        </div>
      </div>
    </header>
  );
};

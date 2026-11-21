import React from 'react';
import { ArrowRight, BarChart3, PlayCircle, Users } from 'lucide-react';
import { ProgressActionDescriptor, getAllowedTabsForPhase } from '../engine/seasonPhase';
import { AppTab, SeasonPhase } from '../engine/types';

interface MobileBottomNavProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  seasonPhase: SeasonPhase;
  progressAction: ProgressActionDescriptor;
  onProgress: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  seasonPhase,
  progressAction,
  onProgress,
}) => {
  const allowedTabs = getAllowedTabsForPhase(seasonPhase);

  const navItems: {
    id: AppTab;
    label: string;
    disabled: boolean;
    Icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'SQUAD', label: 'Squad & XI', disabled: !allowedTabs.SQUAD, Icon: Users },
    { id: 'STANDINGS', label: 'Stats', disabled: !allowedTabs.STANDINGS, Icon: BarChart3 },
    { id: 'MATCH', label: 'Match', disabled: !allowedTabs.MATCH, Icon: PlayCircle },
  ];

  const rawLabel = progressAction.buttonLabel.replace(/^Progress:\s*/i, '');
  const compactProgressLabel =
    rawLabel.startsWith('Pre-Gameweek')
      ? rawLabel.replace('Pre-Gameweek ', 'GW ')
      : rawLabel === 'Match Center'
      ? 'Match'
      : rawLabel === 'Sim Playoffs'
      ? 'Playoffs'
      : rawLabel === 'Post-Game'
      ? 'Finish'
      : rawLabel === 'End Season'
      ? 'Results'
      : rawLabel === 'New Season'
      ? 'Reset'
      : rawLabel;

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="pb-safe fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden"
    >
      <div className="grid h-16 grid-cols-4 items-center gap-1 px-2">
        {navItems.map(({ id, label, disabled, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectTab(id)}
              className={`flex min-h-[48px] flex-col items-center justify-center rounded-lg px-1 transition-colors active:scale-[0.98] ${
                isActive
                  ? 'text-emerald-800'
                  : disabled
                  ? 'cursor-not-allowed text-slate-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`h-5 w-5 ${isActive ? 'text-emerald-700' : ''}`}
                aria-hidden="true"
              />
              <span
                className={`mt-1 whitespace-nowrap text-[11px] leading-none tracking-tight ${
                  isActive ? 'font-bold' : 'font-medium'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}

        <div className="flex items-center justify-center px-1">
          <button
            type="button"
            disabled={progressAction.disabled}
            onClick={onProgress}
            title={progressAction.buttonLabel}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-1 whitespace-nowrap rounded-xl bg-emerald-700 px-2.5 text-[11px] font-semibold text-white transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <span className="truncate">{compactProgressLabel}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </div>
    </nav>
  );
};

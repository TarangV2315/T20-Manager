import { AppTab, CityId, Fixture, SeasonPhase } from './types';

export interface ProgressActionDescriptor {
  currentPhaseLabel: string;
  buttonLabel: string;
  targetPhase: SeasonPhase;
  disabled: boolean;
}

export function formatFixtureStageShort(fixture: Fixture | null): string | null {
  if (!fixture) return null;
  switch (fixture.stage) {
    case 'LEAGUE':
      return `Gameweek ${fixture.roundNumber}`;
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

export function getAllowedTabsForPhase(phase: SeasonPhase): Record<AppTab, boolean> {
  // Rule: Once on Match Centre, user cannot visit any other pages.
  if (phase === 'MATCH_LIVE') {
    return {
      SQUAD: false,
      TRADE: false,
      STANDINGS: false,
      MATCH: true,
    };
  }

  // Rule: Match Centre opens up ONLY for the active matchup. Trade Market is currently disabled.
  return {
    SQUAD: true,
    TRADE: false,
    STANDINGS: true,
    MATCH: false,
  };
}

export function getProgressAction(
  phase: SeasonPhase,
  opts: {
    matchCompleted: boolean;
    nextUserFixture: Fixture | null;
    championId: CityId | null;
  }
): ProgressActionDescriptor {
  const nextLabel = formatFixtureStageShort(opts.nextUserFixture);

  switch (phase) {
    case 'SEASON_PREP':
      return {
        currentPhaseLabel: 'Season Prep',
        buttonLabel: 'Progress: Pre-Gameweek 1',
        targetPhase: 'PRE_GAMEWEEK',
        disabled: false,
      };
    case 'PRE_GAMEWEEK':
      if (opts.nextUserFixture) {
        return {
          currentPhaseLabel: `Pre-${nextLabel ?? 'Gameweek'}`,
          buttonLabel: 'Progress: Match Center',
          targetPhase: 'MATCH_LIVE',
          disabled: false,
        };
      }
      return {
        currentPhaseLabel: 'Playoffs',
        buttonLabel: 'Progress: Sim Playoffs',
        targetPhase: 'SEASON_END',
        disabled: false,
      };
    case 'MATCH_LIVE':
      return {
        currentPhaseLabel: 'Match Center',
        buttonLabel: 'Progress: Post-Game',
        targetPhase: 'POST_GAME',
        disabled: !opts.matchCompleted,
      };
    case 'POST_GAME':
      if (opts.championId) {
        return {
          currentPhaseLabel: 'Post-Game',
          buttonLabel: 'Progress: End Season',
          targetPhase: 'SEASON_END',
          disabled: false,
        };
      }
      if (nextLabel) {
        return {
          currentPhaseLabel: 'Post-Game',
          buttonLabel: `Progress: Pre-${nextLabel}`,
          targetPhase: 'PRE_GAMEWEEK',
          disabled: false,
        };
      }
      return {
        currentPhaseLabel: 'Post-Game',
        buttonLabel: 'Progress: Sim Playoffs',
        targetPhase: 'SEASON_END',
        disabled: false,
      };
    case 'SEASON_END':
      return {
        currentPhaseLabel: 'Season Complete',
        buttonLabel: 'Progress: New Season',
        targetPhase: 'SEASON_PREP',
        disabled: false,
      };
  }
}

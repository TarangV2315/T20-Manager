import { PITCH_PROFILES } from './cities';
import { AppTab, CityId, Fixture, FranchiseTeam, MatchState, Player, SeasonPhase, TradeLogEntry } from './types';

export const SAVE_STORAGE_KEY = 't20_manager_save_v1';
export const SAVE_FORMAT_VERSION = 1;

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface SavedGameState {
  version: number;
  savedAtIso: string;
  selectedCityId: CityId;
  seasonPhase: SeasonPhase;
  activeTab: AppTab;
  players: Player[];
  teams: FranchiseTeam[];
  fixtures: Fixture[];
  activeMatch: MatchState | null;
  championId: CityId | null;
  tradeHistory: TradeLogEntry[];
}

export interface SaveGameSummary {
  savedAtIso: string;
  cityId: CityId;
  city: string;
  franchiseName: string;
  shortCode: string;
  seasonPhase: SeasonPhase;
  phaseLabel: string;
  matchesCompleted: number;
  totalLeagueMatches: number;
  userRecord: string;
  championName: string | null;
  hasActiveMatch: boolean;
}

function getDefaultStorage(): StorageLike | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

function formatPhaseLabel(phase: SeasonPhase, fixtures: Fixture[], userTeamId: CityId, championId: CityId | null): string {
  if (championId || phase === 'SEASON_END') return 'Season Complete';
  if (phase === 'MATCH_LIVE') return 'Live Match in Progress';
  if (phase === 'SEASON_PREP') return 'Season Prep';
  const nextFixture = fixtures.find(
    (f) => !f.completed && (f.homeTeamId === userTeamId || f.awayTeamId === userTeamId)
  );
  if (phase === 'POST_GAME') return 'Post-Game Review';
  if (nextFixture) {
    return nextFixture.stage === 'LEAGUE'
      ? `Pre-Gameweek ${nextFixture.roundNumber}`
      : `Pre-${nextFixture.stage.replace('_', ' ')}`;
  }
  return 'Playoffs';
}

function isValidSavedGameShape(raw: unknown): raw is SavedGameState {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Partial<SavedGameState>;
  if (obj.version !== SAVE_FORMAT_VERSION) return false;
  if (typeof obj.savedAtIso !== 'string') return false;
  if (typeof obj.selectedCityId !== 'string' || !(obj.selectedCityId in PITCH_PROFILES)) return false;
  if (typeof obj.seasonPhase !== 'string') return false;
  if (typeof obj.activeTab !== 'string') return false;
  if (!Array.isArray(obj.players) || obj.players.length === 0) return false;
  if (!Array.isArray(obj.teams) || obj.teams.length !== 8) return false;
  if (!Array.isArray(obj.fixtures) || obj.fixtures.length === 0) return false;
  if (!Array.isArray(obj.tradeHistory)) return false;
  return true;
}

export function buildSaveGameSummary(state: SavedGameState): SaveGameSummary {
  const userTeam = state.teams.find((t) => t.isUser) ?? state.teams[0];
  const pitch = PITCH_PROFILES[userTeam.id];
  const userFixtures = state.fixtures.filter(
    (f) => f.completed && (f.homeTeamId === userTeam.id || f.awayTeamId === userTeam.id)
  );
  const wins = userFixtures.filter((f) => f.winnerId === userTeam.id).length;
  const losses = userFixtures.length - wins;
  const leagueMatches = state.fixtures.filter((f) => f.stage === 'LEAGUE');
  const completedLeague = leagueMatches.filter((f) => f.completed).length;

  return {
    savedAtIso: state.savedAtIso,
    cityId: userTeam.id,
    city: pitch.city,
    franchiseName: userTeam.name,
    shortCode: userTeam.shortCode,
    seasonPhase: state.seasonPhase,
    phaseLabel: formatPhaseLabel(state.seasonPhase, state.fixtures, userTeam.id, state.championId),
    matchesCompleted: completedLeague,
    totalLeagueMatches: leagueMatches.length,
    userRecord: `${wins}W - ${losses}L`,
    championName: state.championId ? PITCH_PROFILES[state.championId].franchiseName : null,
    hasActiveMatch: state.activeMatch !== null,
  };
}

export function saveGameState(
  state: Omit<SavedGameState, 'version' | 'savedAtIso'>,
  storage: StorageLike | null = getDefaultStorage(),
  nowIso: string = new Date().toISOString()
): { ok: boolean; savedAtIso: string; summary: SaveGameSummary | null; error?: string } {
  if (!storage) {
    return {
      ok: false,
      savedAtIso: nowIso,
      summary: null,
      error: 'Local device storage is unavailable in this environment.',
    };
  }

  const payload: SavedGameState = {
    version: SAVE_FORMAT_VERSION,
    savedAtIso: nowIso,
    ...state,
  };

  try {
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
    return {
      ok: true,
      savedAtIso: nowIso,
      summary: buildSaveGameSummary(payload),
    };
  } catch (err) {
    return {
      ok: false,
      savedAtIso: nowIso,
      summary: null,
      error: err instanceof Error ? err.message : 'Failed to save progress locally.',
    };
  }
}

export function loadGameState(
  storage: StorageLike | null = getDefaultStorage()
): SavedGameState | null {
  if (!storage) return null;
  try {
    const rawText = storage.getItem(SAVE_STORAGE_KEY);
    if (!rawText) return null;
    const parsed: unknown = JSON.parse(rawText);
    if (!isValidSavedGameShape(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getSaveGameSummary(
  storage: StorageLike | null = getDefaultStorage()
): SaveGameSummary | null {
  const saved = loadGameState(storage);
  return saved ? buildSaveGameSummary(saved) : null;
}

export function clearSavedGame(storage: StorageLike | null = getDefaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // Ignore storage removal error
  }
}

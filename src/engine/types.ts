export type CityId =
  | 'mumbai'
  | 'chennai'
  | 'bengaluru'
  | 'kolkata'
  | 'delhi'
  | 'hyderabad'
  | 'ahmedabad'
  | 'jaipur';

export interface PitchProfile {
  id: CityId;
  city: string;
  franchiseName: string;
  shortCode: string;
  stadium: string;
  primaryColor: string;
  accentColor: string;
  surfaceSummary: string;
  tacticalNote: string;
  /** Modifiers in range roughly 0.75 to 1.30 */
  paceFactor: number;
  spinFactor: number;
  battingBounce: number;
  boundarySize: 'small' | 'medium' | 'large';
  dewFactor: number; // 0..1 chasing advantage in 2nd innings
  variableBounce: number; // 0..1
  wearRate: number; // how fast it slows down over 40 overs
}

export type WeatherCondition = 'CLEAR' | 'OVERCAST' | 'HUMID_DEW' | 'DRY_HEAT' | 'BREEZY';

export interface WeatherProfile {
  id: WeatherCondition;
  label: string;
  summary: string;
  paceMod: number;
  swingBonus: number;
  spinMod: number;
  dewMod: number;
  battingBounceMod: number;
  wearMod: number;
}

export interface WeatherForecastDay {
  dayOffset: -2 | -1 | 0;
  dayLabel: string;
  relativeLabel: string;
  condition: WeatherCondition;
  conditionLabel: string;
  tempHighC: number;
  humidityPct: number;
  windKmh: number;
  dewRisk: 'Low' | 'Moderate' | 'High';
  movementTag: string;
  ballMovementNote: string;
}

export interface ThreeDayWeatherForecast {
  cityId: CityId;
  matchCondition: WeatherCondition;
  days: [WeatherForecastDay, WeatherForecastDay, WeatherForecastDay];
  trendSummary: string;
}

export type PlayerCategory = 'INDIAN_SENIOR' | 'INDIAN_U19' | 'FOREIGN';

export type PlayerRole = 'BATTER' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKETKEEPER';

export type BowlingStyle =
  | 'Right-Arm Express Pace'
  | 'Right-Arm Swing'
  | 'Left-Arm Pace'
  | 'Right-Arm Off-Spin'
  | 'Left-Arm Orthodox'
  | 'Right-Arm Wrist-Spin'
  | 'Left-Arm Wrist-Spin'
  | 'Part-Time';

export type BattingHand = 'RHB' | 'LHB';

export interface PhysicalAttributes {
  stamina: number; // 30-99
  sprintSpeed: number;
  strength: number;
  agilityReflexes: number;
  injuryProneness: number; // Hidden/Scoutable: higher = more injury prone (10-95)
}

export interface MindsetAttributes {
  aggression: number;
  adaptability: number;
  consistency: number;
  leadership: number;
  tacticalAwareness: number;
}

export interface SituationalRoles {
  powerplaySpecialist: number; // 0-25 bonus rating
  middleOversAnchor: number;
  finisher: number;
}

export interface BattingAttributes {
  timingPlacement: number;
  powerHitting: number;
  techniqueVsSpin: number;
  techniqueVsPace: number;
  runningBetweenWickets: number;
  clutchFactor: number; // Hidden/Scoutable
  situational: SituationalRoles;
}

export interface BowlingAttributes {
  paceOrRevolution: number;
  lineLengthAccuracy: number;
  movement: number;
  variations: number;
  controlUnderAssault: number; // Hidden/Scoutable
}

export interface FieldingAttributes {
  catchingOutfield: number;
  catchingCloseIn: number;
  groundFielding: number;
  throwingAccuracyArm: number;
  wicketkeeping: number;
  fieldingSetup: number; // Hidden/Scoutable
}

export interface PlayerMatchPerformance {
  fixtureId: string;
  roundNumber: number;
  stage: Fixture['stage'];
  opponentTeamId: CityId;
  opponentShortCode: string;
  venueCityId: CityId;
  won: boolean;
  batting: {
    didBat: boolean;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    isOut: boolean;
    dismissalText: string;
  };
  bowling: {
    ballsBowled: number;
    runsConceded: number;
    wickets: number;
    dots: number;
  };
}

export interface Player {
  id: string;
  name: string;
  age: number;
  category: PlayerCategory;
  nationality: string;
  homeLocation: string;
  role: PlayerRole;
  battingHand: BattingHand;
  bowlingStyle: BowlingStyle;
  isPaceBowler: boolean;
  isSpinBowler: boolean;
  heightCm: number;
  basePriceL: number; // Always 1 (INR 1L)
  overallRating: number;
  batRating: number;
  bowlRating: number;
  fieldRating: number;
  physical: PhysicalAttributes;
  mindset: MindsetAttributes;
  batting: BattingAttributes;
  bowling: BowlingAttributes;
  fielding: FieldingAttributes;
  soldToTeamId: CityId | null;
  soldPriceL: number | null;
  fatigue: number; // 0-100 accumulated across tournament
  injuredMatchesRemaining: number;
  careerHistory: PlayerMatchPerformance[];
}


export interface FranchiseTeam {
  id: CityId;
  city: string;
  name: string;
  shortCode: string;
  isUser: boolean;
  purseRemainingL: number; // Starts at 100 (INR 1 Cr)
  rosterIds: string[]; // Max 25
  selectedXIIds: string[]; // Exactly 11 when valid
  captainId: string | null;
  wicketkeeperId: string | null;
}


export type TacticalCheckpoint =
  | 'MATCH_START'
  | 'POWERPLAY_1_END'
  | 'INNINGS_BREAK'
  | 'POWERPLAY_2_END';

export interface TacticalDirectives {
  battingTempoBoost: number; // -15 to +18
  boundaryAggression: number; // -12 to +15
  rotateStrikeFocus: number; // 0 to +15
  spinFocus: number; // -10 to +15
  paceFocus: number; // -10 to +15
  deathYorkerFocus: number; // 0 to +15
  targetShortBoundary: boolean;
  composureBoost: number; // 0 to +12
  summaryTags: string[];
}

export interface TacticalBriefingLog {
  checkpoint: TacticalCheckpoint;
  innings: 1 | 2;
  overNumber: number;
  managerPlanText: string;
  directives: TacticalDirectives;
  captainReply: string;
}

export interface BatterMatchStats {
  playerId: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  dismissalText: string;
  battingOrder: number;
}

export interface BowlerMatchStats {
  playerId: string;
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  dots: number;
  wides: number;
  noBalls: number;
  tiltLevel: number; // Consecutive boundaries conceded tracker
}

export interface OverProgressPoint {
  over: number;
  runs: number;
  wickets: number;
  balls: number;
  runRate: number;
}

export interface InningsState {
  battingTeamId: CityId;
  bowlingTeamId: CityId;
  runs: number;
  wickets: number;
  ballsCompleted: number; // 0 to 120
  extras: number;
  strikerId: string;
  nonStrikerId: string;
  nextBatterIndex: number;
  battingOrderIds: string[];
  currentBowlerId: string;
  lastBowlerId: string | null;
  batterStats: Record<string, BatterMatchStats>;
  bowlerStats: Record<string, BowlerMatchStats>;
  recentBalls: BallOutcome[];
  overProgress: OverProgressPoint[];
}

export interface BallOutcome {
  innings: 1 | 2;
  over: number;
  ballInOver: number;
  batterId: string;
  bowlerId: string;
  runsScored: number;
  extraRuns: number;
  extraType: 'NONE' | 'WIDE' | 'NOBALL' | 'BYE';
  isBoundaryFour: boolean;
  isBoundarySix: boolean;
  isWicket: boolean;
  isNearMiss?: boolean;
  nearMissReason?: string;
  wicketKind?: 'BOWLED' | 'CAUGHT' | 'LBW' | 'RUN_OUT' | 'STUMPED';
  fielderId?: string;
  commentary: string;
  shotAngleDeg: number; // For SVG wagon wheel
  shotDistanceRatio: number; // 0.1 to 1.0
}

export interface OpponentScoutingReport {
  venueCity: PitchProfile;
  weather: WeatherProfile;
  opponentTeam: FranchiseTeam;
  opponentXI: Player[];
  pitchSummary: string;
  playersToWatch: {
    player: Player;
    threatLabel: string;
    scoutingAdvice: string;
  }[];
}

export interface Fixture {
  id: string;
  roundNumber: number;
  stage: 'LEAGUE' | 'QUALIFIER_1' | 'ELIMINATOR' | 'QUALIFIER_2' | 'FINAL';
  homeTeamId: CityId;
  awayTeamId: CityId;
  venueCityId: CityId;
  weather: WeatherCondition;
  completed: boolean;
  winnerId: CityId | null;
  resultText: string;
  homeScoreText?: string;
  awayScoreText?: string;
  homeRuns?: number;
  homeBallsFaced?: number;
  awayRuns?: number;
  awayBallsFaced?: number;
}

export interface RivalryDefinition {
  id: string;
  teamA: CityId;
  teamB: CityId;
  name: string;
  narrative: string;
  baseWinsA: number;
  baseWinsB: number;
  lastWinnerId: CityId | null;
  streakTeamId: CityId | null;
  streakCount: number;
}

export interface HeadToHeadSummary {
  teamA: CityId;
  teamB: CityId;
  teamAWins: number;
  teamBWins: number;
  totalPlayed: number;
  seasonMatchesPlayed: number;
  lastWinnerId: CityId | null;
  currentStreakTeamId: CityId | null;
  currentStreakCount: number;
}

export interface MatchRivalryContext {
  rivalryId: string;
  rivalryName: string;
  narrative: string;
  homeTeamId: CityId;
  awayTeamId: CityId;
  homeWins: number;
  awayWins: number;
  seasonMatchesPlayed: number;
  lastWinnerId: CityId | null;
  currentStreakTeamId: CityId | null;
  currentStreakCount: number;
  homeMorale: number; // -5 to +5
  awayMorale: number; // -5 to +5
  homeSummary: string;
  awaySummary: string;
}

export interface TeamRivalryLedgerEntry {
  rivalryId: string;
  rivalryName: string;
  opponentId: CityId;
  userWins: number;
  opponentWins: number;
  lastWinnerId: CityId | null;
  userMorale: number;
  moraleLabel: string;
}

export interface MatchState {
  fixtureId: string;
  roundNumber: number;
  stage: Fixture['stage'];
  venueCityId: CityId;
  weather: WeatherCondition;
  homeTeamId: CityId;
  awayTeamId: CityId;
  tossWinnerId: CityId;
  tossDecision: 'BAT' | 'BOWL';
  currentInnings: 1 | 2;
  innings1: InningsState;
  innings2: InningsState | null;
  targetRuns: number | null;
  phase: 'PRE_MATCH_SCOUTING' | 'CHECKPOINT_TACTICS' | 'LIVE' | 'COMPLETED';
  activeCheckpoint: TacticalCheckpoint | null;
  tacticsLog: TacticalBriefingLog[];
  userDirectives: TacticalDirectives;
  aiDirectives: TacticalDirectives;
  rivalry: MatchRivalryContext | null;
  commentaryFeed: BallOutcome[];
  winnerId: CityId | null;
  resultText: string;
}

export interface StandingsRow {
  teamId: CityId;
  played: number;
  won: number;
  lost: number;
  points: number;
  runsFor: number;
  oversFacedDecimal: number; // Effective overs (20 if all out)
  runsAgainst: number;
  oversBowledDecimal: number;
  nrr: number;
}

export interface TradeProposal {
  userTeamId: CityId;
  partnerTeamId: CityId;
  offeredPlayerIds: string[];
  requestedPlayerIds: string[];
  /** Positive = user pays partner in INR Lakhs; negative = partner pays user */
  cashAdjustmentL: number;
}

export interface TradeEvaluationResult {
  isValid: boolean;
  isFair: boolean;
  offeredValue: number;
  requestedValue: number;
  valueDelta: number;
  fairnessRatio: number;
  verdictSummary: string;
  reasons: string[];
}

export interface TradeLogEntry {
  id: string;
  partnerTeamId: CityId;
  partnerShortCode: string;
  offeredPlayerNames: string[];
  requestedPlayerNames: string[];
  cashAdjustmentL: number;
  verdictSummary: string;
}

export type AppTab = 'SQUAD' | 'TRADE' | 'STANDINGS' | 'MATCH';

export type SeasonPhase =
  | 'SEASON_PREP'
  | 'PRE_GAMEWEEK'
  | 'MATCH_LIVE'
  | 'POST_GAME'
  | 'SEASON_END';



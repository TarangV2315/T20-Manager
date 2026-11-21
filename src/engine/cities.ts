import {
  CityId,
  PitchProfile,
  ThreeDayWeatherForecast,
  WeatherCondition,
  WeatherForecastDay,
  WeatherProfile,
} from './types';

export const PITCH_PROFILES: Record<CityId, PitchProfile> = {
  mumbai: {
    id: 'mumbai',
    city: 'Mumbai',
    franchiseName: 'Mumbai Mavericks',
    shortCode: 'MUM',
    stadium: 'Wankhede Marine Arena',
    primaryColor: '#1D4ED8',
    accentColor: '#F59E0B',
    surfaceSummary: 'High-scoring, true bounce',
    tacticalNote: 'Favors express pace bowlers with bounce and aggressive stroke-makers.',
    paceFactor: 1.22,
    spinFactor: 0.84,
    battingBounce: 1.24,
    boundarySize: 'medium',
    dewFactor: 0.55,
    variableBounce: 0.08,
    wearRate: 0.12,
  },
  chennai: {
    id: 'chennai',
    city: 'Chennai',
    franchiseName: 'Chennai Chepauk XI',
    shortCode: 'CHE',
    stadium: 'Chepauk Marina Ground',
    primaryColor: '#CA8A04',
    accentColor: '#1E293B',
    surfaceSummary: 'Slow, low, turning track',
    tacticalNote: 'Favors spin-heavy attacks and batters with high Technique vs. Spin.',
    paceFactor: 0.85,
    spinFactor: 1.28,
    battingBounce: 0.88,
    boundarySize: 'medium',
    dewFactor: 0.25,
    variableBounce: 0.35,
    wearRate: 0.35,
  },
  bengaluru: {
    id: 'bengaluru',
    city: 'Bengaluru',
    franchiseName: 'Bengaluru Blasters',
    shortCode: 'BLR',
    stadium: 'Chinnaswamy Garden Oval',
    primaryColor: '#B91C1C',
    accentColor: '#111827',
    surfaceSummary: 'Flat deck, small boundaries',
    tacticalNote: 'Batting paradise; demands elite Death Bowling Variations and Power Hitters.',
    paceFactor: 0.92,
    spinFactor: 0.82,
    battingBounce: 1.28,
    boundarySize: 'small',
    dewFactor: 0.45,
    variableBounce: 0.05,
    wearRate: 0.08,
  },
  kolkata: {
    id: 'kolkata',
    city: 'Kolkata',
    franchiseName: 'Kolkata Royal Knights',
    shortCode: 'KOL',
    stadium: 'Eden Riverfront Stadium',
    primaryColor: '#6D28D9',
    accentColor: '#D97706',
    surfaceSummary: 'Balanced surface with evening dew',
    tacticalNote: 'Favors swing bowlers early with the new ball and chasing teams later under dew.',
    paceFactor: 1.14,
    spinFactor: 0.98,
    battingBounce: 1.08,
    boundarySize: 'medium',
    dewFactor: 0.88,
    variableBounce: 0.14,
    wearRate: 0.15,
  },
  delhi: {
    id: 'delhi',
    city: 'Delhi',
    franchiseName: 'Delhi Capitals XI',
    shortCode: 'DEL',
    stadium: 'Kotla Heritage Ground',
    primaryColor: '#0369A1',
    accentColor: '#DC2626',
    surfaceSummary: 'Two-paced, tacky surface',
    tacticalNote: 'Rewards bowling variations, cutters, and tactical batters who read pace off the pitch.',
    paceFactor: 0.98,
    spinFactor: 1.12,
    battingBounce: 0.92,
    boundarySize: 'small',
    dewFactor: 0.35,
    variableBounce: 0.42,
    wearRate: 0.28,
  },
  hyderabad: {
    id: 'hyderabad',
    city: 'Hyderabad',
    franchiseName: 'Hyderabad Sunchargers',
    shortCode: 'HYD',
    stadium: 'Uppal Deccan Stadium',
    primaryColor: '#EA580C',
    accentColor: '#0F172A',
    surfaceSummary: 'Good batting track, slows later',
    tacticalNote: 'Balanced all-rounders thrive as the deck grips in the second half.',
    paceFactor: 1.04,
    spinFactor: 1.08,
    battingBounce: 1.08,
    boundarySize: 'medium',
    dewFactor: 0.30,
    variableBounce: 0.20,
    wearRate: 0.42,
  },
  ahmedabad: {
    id: 'ahmedabad',
    city: 'Ahmedabad',
    franchiseName: 'Ahmedabad Titans',
    shortCode: 'AMD',
    stadium: 'Motera Sabarmati Bowl',
    primaryColor: '#0F766E',
    accentColor: '#F59E0B',
    surfaceSummary: 'Large boundaries, true bounce',
    tacticalNote: 'Rewards Sprint Speed, Timing & Placement, and Stamina over pure slogging.',
    paceFactor: 1.10,
    spinFactor: 0.96,
    battingBounce: 1.12,
    boundarySize: 'large',
    dewFactor: 0.50,
    variableBounce: 0.10,
    wearRate: 0.14,
  },
  jaipur: {
    id: 'jaipur',
    city: 'Jaipur',
    franchiseName: 'Jaipur Pink Royals',
    shortCode: 'JAI',
    stadium: 'Sawai Mansingh Fort',
    primaryColor: '#BE185D',
    accentColor: '#1E3A8A',
    surfaceSummary: 'Dry surface with variable bounce',
    tacticalNote: 'Favors wrist-spinners and tall fast bowlers extracting awkward bounce.',
    paceFactor: 1.12,
    spinFactor: 1.18,
    battingBounce: 0.96,
    boundarySize: 'large',
    dewFactor: 0.28,
    variableBounce: 0.52,
    wearRate: 0.30,
  },
};

export const CITY_LIST: PitchProfile[] = Object.values(PITCH_PROFILES);

export const WEATHER_PROFILES: Record<WeatherCondition, WeatherProfile> = {
  CLEAR: {
    id: 'CLEAR',
    label: 'Clear & Sunny',
    summary: 'True baseline conditions; standard swing, spin, and bounce.',
    paceMod: 1.0,
    swingBonus: 0,
    spinMod: 1.0,
    dewMod: 0,
    battingBounceMod: 1.0,
    wearMod: 0,
  },
  OVERCAST: {
    id: 'OVERCAST',
    label: 'Overcast',
    summary: 'Heavy cloud cover boosts swing & seam bowling movement.',
    paceMod: 1.14,
    swingBonus: 18,
    spinMod: 0.94,
    dewMod: -0.1,
    battingBounceMod: 0.96,
    wearMod: -0.04,
  },
  HUMID_DEW: {
    id: 'HUMID_DEW',
    label: 'Humid Evening Dew',
    summary: 'Heavy dew eases chasing in the 2nd innings and softens spin grip.',
    paceMod: 1.02,
    swingBonus: 6,
    spinMod: 0.9,
    dewMod: 0.3,
    battingBounceMod: 1.03,
    wearMod: -0.05,
  },
  DRY_HEAT: {
    id: 'DRY_HEAT',
    label: 'Dry Heat',
    summary: 'Accelerated surface wear sharpens spin turn and variable bounce.',
    paceMod: 0.94,
    swingBonus: -4,
    spinMod: 1.16,
    dewMod: -0.12,
    battingBounceMod: 0.95,
    wearMod: 0.14,
  },
  BREEZY: {
    id: 'BREEZY',
    label: 'Crosswind Breeze',
    summary: 'Steady crosswind aids aerial drift for swing and spin bowlers.',
    paceMod: 1.06,
    swingBonus: 9,
    spinMod: 1.06,
    dewMod: 0,
    battingBounceMod: 1.0,
    wearMod: 0,
  },
};

export function applyWeatherToPitch(
  pitch: PitchProfile,
  weather: WeatherCondition
): PitchProfile {
  const w = WEATHER_PROFILES[weather];
  const clamp = (val: number, min: number, max: number) =>
    Number(Math.max(min, Math.min(max, val)).toFixed(3));
  return {
    ...pitch,
    paceFactor: clamp(pitch.paceFactor * w.paceMod, 0.72, 1.42),
    spinFactor: clamp(pitch.spinFactor * w.spinMod, 0.72, 1.45),
    battingBounce: clamp(pitch.battingBounce * w.battingBounceMod, 0.78, 1.38),
    dewFactor: clamp(pitch.dewFactor + w.dewMod, 0, 0.98),
    wearRate: clamp(pitch.wearRate + w.wearMod, 0.04, 0.65),
    variableBounce: clamp(
      pitch.variableBounce + (weather === 'DRY_HEAT' ? 0.06 : 0),
      0,
      0.7
    ),
  };
}

export function pickMatchWeather(
  cityId: CityId,
  roundNumber: number,
  matchIndex = 0
): WeatherCondition {
  const cityPool: Record<CityId, WeatherCondition[]> = {
    mumbai: ['OVERCAST', 'HUMID_DEW', 'BREEZY', 'CLEAR'],
    chennai: ['DRY_HEAT', 'HUMID_DEW', 'CLEAR', 'BREEZY'],
    bengaluru: ['OVERCAST', 'CLEAR', 'BREEZY', 'HUMID_DEW'],
    kolkata: ['HUMID_DEW', 'OVERCAST', 'BREEZY', 'CLEAR'],
    delhi: ['DRY_HEAT', 'CLEAR', 'OVERCAST', 'BREEZY'],
    hyderabad: ['DRY_HEAT', 'CLEAR', 'BREEZY', 'HUMID_DEW'],
    ahmedabad: ['CLEAR', 'BREEZY', 'DRY_HEAT', 'HUMID_DEW'],
    jaipur: ['DRY_HEAT', 'BREEZY', 'CLEAR', 'OVERCAST'],
  };
  const pool = cityPool[cityId];
  const idx = (roundNumber + matchIndex) % pool.length;
  return pool[idx];
}

const CITY_CLIMATE_BASE: Record<
  CityId,
  { tempC: number; humidityPct: number; windKmh: number }
> = {
  mumbai: { tempC: 32, humidityPct: 72, windKmh: 16 },
  chennai: { tempC: 35, humidityPct: 68, windKmh: 15 },
  bengaluru: { tempC: 28, humidityPct: 55, windKmh: 14 },
  kolkata: { tempC: 33, humidityPct: 74, windKmh: 12 },
  delhi: { tempC: 36, humidityPct: 44, windKmh: 13 },
  hyderabad: { tempC: 34, humidityPct: 49, windKmh: 14 },
  ahmedabad: { tempC: 37, humidityPct: 42, windKmh: 16 },
  jaipur: { tempC: 38, humidityPct: 36, windKmh: 15 },
};

const CONDITION_METRIC_OFFSETS: Record<
  WeatherCondition,
  {
    tempDelta: number;
    humidityDelta: number;
    windDelta: number;
    movementTag: string;
    ballMovementNote: string;
  }
> = {
  CLEAR: {
    tempDelta: 0,
    humidityDelta: 0,
    windDelta: 0,
    movementTag: 'Baseline Carry',
    ballMovementNote: 'Steady air keeps new-ball swing and spin turn close to pitch norms.',
  },
  OVERCAST: {
    tempDelta: -3,
    humidityDelta: 14,
    windDelta: 4,
    movementTag: '+Swing & Seam',
    ballMovementNote: 'Cloud cover and damp air amplify lateral swing and early seam movement.',
  },
  HUMID_DEW: {
    tempDelta: -1,
    humidityDelta: 18,
    windDelta: -2,
    movementTag: '+Evening Dew · Skid',
    ballMovementNote: 'Heavy evening humidity brings dew; ball skids onto the bat and reduces spin grip.',
  },
  DRY_HEAT: {
    tempDelta: 4,
    humidityDelta: -16,
    windDelta: -1,
    movementTag: '+Spin Turn · Wear',
    ballMovementNote: 'High heat dries out top soil, increasing surface wear, grip, and turn.',
  },
  BREEZY: {
    tempDelta: -1,
    humidityDelta: 2,
    windDelta: 10,
    movementTag: '+Drift & Late Swing',
    ballMovementNote: 'Crosswinds assist aerial drift for spinners and late movement for pacers.',
  },
};

function buildForecastDay(
  cityId: CityId,
  dayOffset: -2 | -1 | 0,
  dayLabel: string,
  relativeLabel: string,
  condition: WeatherCondition,
  roundNumber: number
): WeatherForecastDay {
  const base = CITY_CLIMATE_BASE[cityId];
  const pitch = PITCH_PROFILES[cityId];
  const mod = CONDITION_METRIC_OFFSETS[condition];
  const jitter = ((roundNumber + Math.abs(dayOffset) * 3) % 3) - 1; // -1, 0, +1

  const clampNum = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, Math.round(v)));

  const tempHighC = clampNum(base.tempC + mod.tempDelta + jitter, 23, 44);
  const humidityPct = clampNum(base.humidityPct + mod.humidityDelta + jitter * 2, 22, 94);
  const windKmh = clampNum(base.windKmh + mod.windDelta + jitter * 2, 6, 32);

  const effectiveDew =
    pitch.dewFactor + WEATHER_PROFILES[condition].dewMod + (humidityPct >= 75 ? 0.12 : 0);
  const dewRisk: WeatherForecastDay['dewRisk'] =
    effectiveDew >= 0.65 ? 'High' : effectiveDew >= 0.4 ? 'Moderate' : 'Low';

  return {
    dayOffset,
    dayLabel,
    relativeLabel,
    condition,
    conditionLabel: WEATHER_PROFILES[condition].label,
    tempHighC,
    humidityPct,
    windKmh,
    dewRisk,
    movementTag: mod.movementTag,
    ballMovementNote: mod.ballMovementNote,
  };
}

export function generateThreeDayWeatherForecast(
  cityId: CityId,
  matchWeather: WeatherCondition,
  roundNumber = 1
): ThreeDayWeatherForecast {
  const leadUpMap: Record<WeatherCondition, [WeatherCondition, WeatherCondition]> = {
    CLEAR: ['BREEZY', 'CLEAR'],
    OVERCAST: ['CLEAR', 'BREEZY'],
    HUMID_DEW: ['CLEAR', 'OVERCAST'],
    DRY_HEAT: ['CLEAR', 'DRY_HEAT'],
    BREEZY: ['CLEAR', 'BREEZY'],
  };

  // Vary Day 1 slightly on odd/even rounds for city flavor while preserving realistic lead-up
  const [d1Base, d2] = leadUpMap[matchWeather];
  const d1 =
    matchWeather === 'OVERCAST' && (cityId === 'mumbai' || cityId === 'kolkata')
      ? 'HUMID_DEW'
      : matchWeather === 'HUMID_DEW' && roundNumber % 2 === 0
      ? 'BREEZY'
      : d1Base;

  const day1 = buildForecastDay(cityId, -2, 'Day 1', '48h Out', d1, roundNumber);
  const day2 = buildForecastDay(cityId, -1, 'Day 2', 'Match Eve', d2, roundNumber);
  const day3 = buildForecastDay(cityId, 0, 'Day 3', 'Match Day', matchWeather, roundNumber);

  let trendSummary = '';
  const humidityDelta = day3.humidityPct - day1.humidityPct;
  const tempDelta = day3.tempHighC - day1.tempHighC;

  if (matchWeather === 'HUMID_DEW') {
    trendSummary = `Humidity climbs ${humidityDelta >= 0 ? `+${humidityDelta}%` : `${humidityDelta}%`} to ${day3.humidityPct}% by Match Day — expect evening dew to help chasing batters and soften spin grip.`;
  } else if (matchWeather === 'OVERCAST') {
    trendSummary = `Cloud cover thickens with ${day3.humidityPct}% humidity on Match Day — ideal conditions for new-ball swing and seam movement.`;
  } else if (matchWeather === 'DRY_HEAT') {
    trendSummary = `Sustained ${day3.tempHighC}°C dry heat (${day3.humidityPct}% humidity) bakes the strip over 48h — prepare for extra spin turn and variable bounce.`;
  } else if (matchWeather === 'BREEZY') {
    trendSummary = `Crosswinds build to ${day3.windKmh} km/h on Match Day — bowlers can exploit late drift and air movement across the ground.`;
  } else {
    trendSummary = `Temperatures hold steady near ${day3.tempHighC}°C (${tempDelta >= 0 ? `+${tempDelta}` : tempDelta}°C over 3 days) with balanced ball carry on Match Day.`;
  }

  return {
    cityId,
    matchCondition: matchWeather,
    days: [day1, day2, day3],
    trendSummary,
  };
}


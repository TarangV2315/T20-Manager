import {
  BattingAttributes,
  BattingHand,
  BowlingAttributes,
  BowlingStyle,
  FieldingAttributes,
  MindsetAttributes,
  PhysicalAttributes,
  Player,
  PlayerCategory,
  PlayerRole,
} from './types';

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const clamp = (val: number, min = 25, max = 99) => Math.max(min, Math.min(max, Math.round(val)));

const INDIAN_LOCATIONS = [
  'Mumbai',
  'Chennai',
  'Delhi',
  'Bengaluru',
  'Kolkata',
  'Hyderabad',
  'Ahmedabad',
  'Jaipur',
  'Pune',
  'Chandigarh',
  'Lucknow',
  'Nagpur',
  'Indore',
  'Rajkot',
  'Kochi',
  'Ranchi',
  'Baroda',
  'Kanpur',
];

const INDIAN_FIRST_NAMES = [
  'Aarav', 'Rohan', 'Vikram', 'Siddharth', 'Karan', 'Arjun', 'Pranav', 'Nikhil',
  'Ishaan', 'Varun', 'Shubham', 'Aditya', 'Manish', 'Dev', 'Harsh', 'Kunal',
  'Yash', 'Rishabh', 'Tanmay', 'Abhishek', 'Mayank', 'Prithvi', 'Akash', 'Deepak',
  'Surya', 'Kartik', 'Nitin', 'Rahul', 'Gaurav', 'Tushar', 'Aniket', 'Vikas',
  'Sandeep', 'Mohit', 'Chetan', 'Rajat', 'Piyush', 'Dinesh', 'Shreyas', 'Tarun',
  'Aryan', 'Dhruv', 'Vansh', 'Kabir', 'Reyansh', 'Samarth', 'Lakshya', 'Omkar',
  'Prashant', 'Umesh', 'Bhuvan', 'Naveen', 'Saurabh', 'Harpreet', 'Gurpreet', 'Jaspreet',
  'Venkatesh', 'Sai', 'Karthik', 'Ashwin', 'Murugan', 'Anirudh', 'Raghav', 'Tejas',
  'Parth', 'Hardik', 'Krunal', 'Jaydev', 'Wriddhiman', 'Shahbaz', 'Mukesh', 'Avesh',
];

const INDIAN_LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Reddy', 'Nair', 'Iyer', 'Deshmukh', 'Kulkarni',
  'Chauhan', 'Rathore', 'Singh', 'Gill', 'Kaur', 'Choudhary', 'Pandey', 'Tiwari',
  'Mishra', 'Joshi', 'Mehta', 'Shah', 'Bhatia', 'Kapoor', 'Malhotra', 'Khanna',
  'Saxena', 'Gupta', 'Agarwal', 'Yadav', 'Thakur', 'Bisht', 'Rawat', 'Negi',
  'Srinivasan', 'Subramanian', 'Sundar', 'Krishnan', 'Rao', 'Prasad', 'Menon', 'Pillai',
  'Das', 'Ghosh', 'Chatterjee', 'Banerjee', 'Sen', 'Bose', 'Dutta', 'Mondal',
  'Solanki', 'Jadeja', 'Chavda', 'Gohil', 'Pathan', 'Khan', 'Qureshi', 'Shaikh',
];

const FOREIGN_POOLS: {
  nationality: string;
  locations: string[];
  first: string[];
  last: string[];
}[] = [
  {
    nationality: 'Australia',
    locations: ['Sydney', 'Melbourne', 'Perth', 'Brisbane', 'Adelaide'],
    first: ['Mitchell', 'Marcus', 'Josh', 'Liam', 'Travis', 'Glenn', 'Cameron', 'Pat', 'Nathan', 'Jake', 'Adam', 'Alex'],
    last: ['Marsh', 'Head', 'Starc', 'Cummins', 'Hazlewood', 'Maxwell', 'Stoinis', 'Green', 'Zampa', 'Carey', 'Ellis', 'Inglis'],
  },
  {
    nationality: 'England',
    locations: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Nottingham'],
    first: ['Jos', 'Phil', 'Harry', 'Liam', 'Sam', 'Jofra', 'Mark', 'Ben', 'Will', 'Adil', 'Reece', 'Jonny'],
    last: ['Buttler', 'Salt', 'Brook', 'Livingstone', 'Curran', 'Archer', 'Wood', 'Stokes', 'Jacks', 'Rashid', 'Topley', 'Bairstow'],
  },
  {
    nationality: 'South Africa',
    locations: ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Gqeberha'],
    first: ['Kagiso', 'Quinton', 'Heinrich', 'Aiden', 'David', 'Marco', 'Anrich', 'Tristan', 'Tabraiz', 'Gerald', 'Lungi'],
    last: ['Rabada', 'de Kock', 'Klaasen', 'Markram', 'Miller', 'Jansen', 'Nortje', 'Stubbs', 'Shamsi', 'Coetzee', 'Ngidi'],
  },
  {
    nationality: 'New Zealand',
    locations: ['Auckland', 'Wellington', 'Christchurch', 'Hamilton'],
    first: ['Kane', 'Trent', 'Rachin', 'Daryl', 'Glenn', 'Lockie', 'Mitchell', 'Devon', 'Matt', 'Tim'],
    last: ['Williamson', 'Boult', 'Ravindra', 'Mitchell', 'Phillips', 'Ferguson', 'Santner', 'Conway', 'Henry', 'Southee'],
  },
  {
    nationality: 'West Indies',
    locations: ['Kingston', 'Bridgetown', 'Port of Spain', 'Georgetown'],
    first: ['Nicholas', 'Andre', 'Sunil', 'Rovman', 'Shimron', 'Alzarri', 'Akeal', 'Jason', 'Romario', 'Shai'],
    last: ['Pooran', 'Russell', 'Narine', 'Powell', 'Hetmyer', 'Joseph', 'Hosein', 'Holder', 'Shepherd', 'Hope'],
  },
  {
    nationality: 'Afghanistan',
    locations: ['Kabul', 'Jalalabad', 'Kandahar'],
    first: ['Rashid', 'Rahmanullah', 'Noor', 'Fazalhaq', 'Azmatullah', 'Mohammad', 'Naveen', 'Mujeeb'],
    last: ['Khan', 'Gurbaz', 'Ahmad', 'Farooqi', 'Omarzai', 'Nabi', 'ul-Haq', 'Ur Rahman'],
  },
  {
    nationality: 'Sri Lanka',
    locations: ['Colombo', 'Kandy', 'Galle'],
    first: ['Wanindu', 'Matheesha', 'Maheesh', 'Pathum', 'Charith', 'Dushmantha', 'Kusal'],
    last: ['Hasaranga', 'Pathirana', 'Theekshana', 'Nissanka', 'Asalanka', 'Chameera', 'Mendis'],
  },
];

const PACE_STYLES: BowlingStyle[] = [
  'Right-Arm Express Pace',
  'Right-Arm Swing',
  'Left-Arm Pace',
];

const SPIN_STYLES: BowlingStyle[] = [
  'Right-Arm Off-Spin',
  'Left-Arm Orthodox',
  'Right-Arm Wrist-Spin',
  'Left-Arm Wrist-Spin',
];

function buildPlayerStats(
  rng: () => number,
  role: PlayerRole,
  category: PlayerCategory,
  tierBoost: number,
  bowlingStyle: BowlingStyle
): {
  physical: PhysicalAttributes;
  mindset: MindsetAttributes;
  batting: BattingAttributes;
  bowling: BowlingAttributes;
  fielding: FieldingAttributes;
  heightCm: number;
} {
  const isU19 = category === 'INDIAN_U19';
  const isForeign = category === 'FOREIGN';
  const baseQuality = (isForeign ? 68 : isU19 ? 54 : 60) + tierBoost + (rng() * 14 - 5);

  const isPace = PACE_STYLES.includes(bowlingStyle);
  const isSpin = SPIN_STYLES.includes(bowlingStyle);
  const isWristSpin = bowlingStyle === 'Right-Arm Wrist-Spin' || bowlingStyle === 'Left-Arm Wrist-Spin';

  const heightCm = isPace
    ? Math.round(178 + rng() * 18)
    : Math.round(168 + rng() * 16);

  const physical: PhysicalAttributes = {
    stamina: clamp(baseQuality + (isU19 ? 6 : 0) + (role === 'ALL_ROUNDER' ? 6 : 0) + (rng() * 18 - 9)),
    sprintSpeed: clamp(baseQuality + (isU19 ? 10 : -2) + (rng() * 20 - 10)),
    strength: clamp(baseQuality + (isPace ? 7 : 0) + (isU19 ? -8 : 3) + (rng() * 20 - 10)),
    agilityReflexes: clamp(
      baseQuality + (role === 'WICKETKEEPER' ? 14 : 0) + (isU19 ? 8 : 0) + (rng() * 16 - 8)
    ),
    injuryProneness: clamp(
      (isPace ? 48 : 30) + (isU19 ? -6 : 4) + (rng() * 34 - 12),
      12,
      92
    ),
  };

  const mindset: MindsetAttributes = {
    aggression: clamp(50 + (rng() * 44 - 18)),
    adaptability: clamp(baseQuality + (isForeign ? 6 : 0) + (isU19 ? -8 : 4) + (rng() * 18 - 9)),
    consistency: clamp(baseQuality + (isU19 ? -12 : 4) + (rng() * 22 - 11)),
    leadership: clamp((isU19 ? 35 : 52) + (isForeign ? 6 : 0) + (rng() * 38 - 18)),
    tacticalAwareness: clamp(baseQuality + (isU19 ? -10 : 5) + (rng() * 20 - 10)),
  };

  const batBase =
    role === 'BATTER'
      ? baseQuality + 12
      : role === 'WICKETKEEPER'
      ? baseQuality + 8
      : role === 'ALL_ROUNDER'
      ? baseQuality + 4
      : baseQuality - 26;

  const ppFocus = rng() > 0.62 ? Math.round(8 + rng() * 16) : Math.round(rng() * 6);
  const anchorFocus = rng() > 0.62 ? Math.round(8 + rng() * 16) : Math.round(rng() * 6);
  const finisherFocus = rng() > 0.62 ? Math.round(8 + rng() * 16) : Math.round(rng() * 6);

  const batting: BattingAttributes = {
    timingPlacement: clamp(batBase + (rng() * 18 - 9)),
    powerHitting: clamp(batBase + (physical.strength - 65) * 0.35 + (rng() * 20 - 10)),
    techniqueVsSpin: clamp(batBase + (category !== 'FOREIGN' ? 5 : -3) + (rng() * 20 - 10)),
    techniqueVsPace: clamp(batBase + (category === 'FOREIGN' ? 5 : 0) + (rng() * 20 - 10)),
    runningBetweenWickets: clamp(batBase * 0.6 + physical.sprintSpeed * 0.4 + (rng() * 14 - 7)),
    clutchFactor: clamp(baseQuality + (isU19 ? -6 : 4) + (rng() * 26 - 13)),
    situational: {
      powerplaySpecialist: role === 'BOWLER' ? Math.round(rng() * 4) : ppFocus,
      middleOversAnchor: role === 'BOWLER' ? Math.round(rng() * 4) : anchorFocus,
      finisher: role === 'BOWLER' ? Math.round(rng() * 5) : finisherFocus,
    },
  };

  const bowlBase =
    role === 'BOWLER'
      ? baseQuality + 13
      : role === 'ALL_ROUNDER'
      ? baseQuality + 3
      : 28;

  const bowling: BowlingAttributes = {
    paceOrRevolution: clamp(
      bowlBase + (isWristSpin ? 6 : 0) + (isPace ? (physical.strength - 65) * 0.25 : 0) + (rng() * 18 - 9),
      20,
      99
    ),
    lineLengthAccuracy: clamp(bowlBase + (isU19 ? -6 : 4) + (rng() * 18 - 9), 20, 99),
    movement: clamp(
      bowlBase + (bowlingStyle === 'Right-Arm Swing' || bowlingStyle === 'Left-Arm Pace' ? 9 : 0) + (rng() * 20 - 10),
      20,
      99
    ),
    variations: clamp(
      bowlBase + (isSpin ? 5 : 0) + (isU19 ? -4 : 3) + (rng() * 22 - 11),
      20,
      99
    ),
    controlUnderAssault: clamp(
      bowlBase + (isU19 ? -9 : 5) + (rng() * 24 - 12),
      20,
      99
    ),
  };

  const fieldBase = baseQuality + (isU19 ? 5 : 0);
  const fielding: FieldingAttributes = {
    catchingOutfield: clamp(fieldBase + (rng() * 18 - 9)),
    catchingCloseIn: clamp(fieldBase + (physical.agilityReflexes - 65) * 0.3 + (rng() * 16 - 8)),
    groundFielding: clamp(fieldBase + (physical.sprintSpeed - 65) * 0.25 + (rng() * 16 - 8)),
    throwingAccuracyArm: clamp(fieldBase + (physical.strength - 65) * 0.25 + (rng() * 18 - 9)),
    wicketkeeping:
      role === 'WICKETKEEPER'
        ? clamp(74 + tierBoost * 0.7 + (rng() * 16 - 6))
        : clamp(22 + rng() * 18, 15, 45),
    fieldingSetup: clamp(mindset.tacticalAwareness * 0.7 + baseQuality * 0.3 + (rng() * 18 - 9)),
  };

  return { physical, mindset, batting, bowling, fielding, heightCm };
}

function pickRole(rng: () => number): PlayerRole {
  const r = rng();
  if (r < 0.33) return 'BATTER';
  if (r < 0.67) return 'BOWLER';
  if (r < 0.87) return 'ALL_ROUNDER';
  return 'WICKETKEEPER';
}

function pickBowlingStyle(rng: () => number, role: PlayerRole): BowlingStyle {
  if (role === 'BATTER' || role === 'WICKETKEEPER') {
    if (rng() < 0.78) return 'Part-Time';
    return rng() < 0.5 ? 'Right-Arm Off-Spin' : 'Right-Arm Swing';
  }
  if (rng() < 0.54) {
    return PACE_STYLES[Math.floor(rng() * PACE_STYLES.length)];
  }
  return SPIN_STYLES[Math.floor(rng() * SPIN_STYLES.length)];
}

export function generatePlayerPool(seed = 202611): Player[] {
  const rng = createRng(seed);
  const players: Player[] = [];
  const usedNames = new Set<string>();

  const uniqueIndianName = () => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const f = INDIAN_FIRST_NAMES[Math.floor(rng() * INDIAN_FIRST_NAMES.length)];
      const l = INDIAN_LAST_NAMES[Math.floor(rng() * INDIAN_LAST_NAMES.length)];
      const name = `${f} ${l}`;
      if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
      }
    }
    const fallback = `R. ${INDIAN_LAST_NAMES[Math.floor(rng() * INDIAN_LAST_NAMES.length)]} ${players.length + 1}`;
    usedNames.add(fallback);
    return fallback;
  };

  const uniqueForeignName = (poolIdx: number) => {
    const pool = FOREIGN_POOLS[poolIdx % FOREIGN_POOLS.length];
    for (let attempt = 0; attempt < 30; attempt++) {
      const f = pool.first[Math.floor(rng() * pool.first.length)];
      const l = pool.last[Math.floor(rng() * pool.last.length)];
      const name = `${f} ${l}`;
      if (!usedNames.has(name)) {
        usedNames.add(name);
        return { name, pool };
      }
    }
    const f = pool.first[Math.floor(rng() * pool.first.length)];
    const l = pool.last[Math.floor(rng() * pool.last.length)];
    const name = `${f} ${l[0]}. ${players.length + 1}`;
    usedNames.add(name);
    return { name, pool };
  };

  const pushPlayer = (
    id: string,
    name: string,
    age: number,
    category: PlayerCategory,
    nationality: string,
    homeLocation: string,
    tierBoost: number,
    forcedRole?: PlayerRole
  ) => {
    const role = forcedRole ?? pickRole(rng);
    const bowlingStyle = pickBowlingStyle(rng, role);
    const isPaceBowler = PACE_STYLES.includes(bowlingStyle);
    const isSpinBowler = SPIN_STYLES.includes(bowlingStyle);
    const battingHand: BattingHand = rng() < 0.71 ? 'RHB' : 'LHB';
    const { physical, mindset, batting, bowling, fielding, heightCm } = buildPlayerStats(
      rng,
      role,
      category,
      tierBoost,
      bowlingStyle
    );

    const batRating = Math.round(
      (batting.timingPlacement * 0.25 +
        batting.powerHitting * 0.22 +
        batting.techniqueVsPace * 0.22 +
        batting.techniqueVsSpin * 0.21 +
        batting.runningBetweenWickets * 0.1) +
        (batting.situational.powerplaySpecialist +
          batting.situational.middleOversAnchor +
          batting.situational.finisher) *
          0.12
    );

    const bowlRating = Math.round(
      bowling.paceOrRevolution * 0.28 +
        bowling.lineLengthAccuracy * 0.28 +
        bowling.movement * 0.22 +
        bowling.variations * 0.22
    );

    const fieldRating = Math.round(
      fielding.catchingOutfield * 0.25 +
        fielding.catchingCloseIn * 0.22 +
        fielding.groundFielding * 0.25 +
        fielding.throwingAccuracyArm * 0.2 +
        (role === 'WICKETKEEPER' ? fielding.wicketkeeping * 0.15 : 0)
    );

    let overallRating = 60;
    if (role === 'BATTER') {
      overallRating = Math.round(batRating * 0.72 + fieldRating * 0.16 + mindset.consistency * 0.12);
    } else if (role === 'BOWLER') {
      overallRating = Math.round(bowlRating * 0.74 + fieldRating * 0.14 + mindset.tacticalAwareness * 0.12);
    } else if (role === 'ALL_ROUNDER') {
      overallRating = Math.round(batRating * 0.44 + bowlRating * 0.44 + fieldRating * 0.12);
    } else {
      overallRating = Math.round(batRating * 0.56 + fielding.wicketkeeping * 0.32 + mindset.tacticalAwareness * 0.12);
    }

    players.push({
      id,
      name,
      age,
      category,
      nationality,
      homeLocation,
      role,
      battingHand,
      bowlingStyle,
      isPaceBowler,
      isSpinBowler,
      heightCm,
      basePriceL: 1, // INR 1L
      overallRating: clamp(overallRating, 35, 97),
      batRating: clamp(batRating, 25, 99),
      bowlRating: clamp(bowlRating, 20, 99),
      fieldRating: clamp(fieldRating, 30, 98),
      physical,
      mindset,
      batting,
      bowling,
      fielding,
      soldToTeamId: null,
      soldPriceL: null,
      fatigue: 0,
      injuredMatchesRemaining: 0,
      careerHistory: [],
    });
  };

  // 1. 150 Indian Senior Players (ages 20-36)
  for (let i = 0; i < 150; i++) {
    const name = uniqueIndianName();
    const age = 20 + Math.floor(rng() * 17);
    const homeLocation = INDIAN_LOCATIONS[i % INDIAN_LOCATIONS.length];
    const tierBoost = i < 24 ? 14 : i < 70 ? 6 : -2;
    const forcedRole = i < 12 ? (i % 4 === 0 ? 'WICKETKEEPER' : i % 3 === 0 ? 'ALL_ROUNDER' : i % 2 === 0 ? 'BATTER' : 'BOWLER') : undefined;
    pushPlayer(`ind-sr-${i + 1}`, name, age, 'INDIAN_SENIOR', 'India', homeLocation, tierBoost, forcedRole);
  }

  // 2. 50 Indian Youngsters U19 (ages 16-19)
  for (let i = 0; i < 50; i++) {
    const name = uniqueIndianName();
    const age = 16 + Math.floor(rng() * 4); // 16, 17, 18, or 19
    const homeLocation = INDIAN_LOCATIONS[i % INDIAN_LOCATIONS.length];
    const tierBoost = i < 10 ? 11 : i < 25 ? 4 : -3;
    pushPlayer(`ind-u19-${i + 1}`, name, age, 'INDIAN_U19', 'India', homeLocation, tierBoost);
  }

  // 3. 75 Foreign Internationals (ages 21-35)
  for (let i = 0; i < 75; i++) {
    const { name, pool } = uniqueForeignName(i);
    const age = 21 + Math.floor(rng() * 15);
    const homeLocation = pool.locations[Math.floor(rng() * pool.locations.length)];
    const tierBoost = i < 20 ? 13 : i < 48 ? 6 : 0;
    pushPlayer(`for-${i + 1}`, name, age, 'FOREIGN', pool.nationality, homeLocation, tierBoost);
  }

  return players;
}

# T20 Manager — Indian T20 Premier Franchise Sim

**T20 Manager** is a franchise cricket management game inspired by the Indian Premier League (IPL). You take charge of one of 8 Indian city franchises—starting directly with varied, pitch-tailored 25-player squads, managing matchday XI selection and fitness rotation, tracking league points and Orange/Purple Cap season stats, saving progress locally on your device, issuing in-match tactical instructions at key checkpoints, and chasing the championship through the league stage and playoffs.

---

## Core Gameplay Loop

### 1. Welcome Page & Local Save Slots
- **Start New Game**: Choose any of the 8 Indian cricketing franchises and launch directly into Season Prep with varied 25-player pitch- and weather-tailored squads (5 Indian U19, 6 foreign nationals, and 14 Indian seniors).
- **Resume Saved Game**: Load your most recent locally saved season (stored in `localStorage`) from any phase—including mid-match progress—or delete the local save slot to start fresh.
- **Save Progress Anytime**: Use **Save Progress** in the top bar during any stage of gameplay to store your season locally on your device.

### 2. 8 Franchise Hubs & Home Pitch Profiles
Pick one of 8 Indian cricketing hubs, each with distinct pitch physics and boundary dimensions that shape your lineup, trades, and match tactics:

| City | Franchise | Stadium | Pitch Profile | Tactical Advantage |
| --- | --- | --- | --- | --- |
| **Mumbai** (`MUM`) | Mumbai Mavericks | Wankhede Marine Arena | High-scoring, true bounce | Express pace & aggressive stroke-makers |
| **Chennai** (`CHE`) | Chennai Chepauk XI | Chepauk Marina Ground | Slow, low, turning track | Spin-heavy attacks & high Technique vs. Spin |
| **Bengaluru** (`BLR`) | Bengaluru Blasters | Chinnaswamy Garden Oval | Flat deck, small boundaries | Power hitters & elite Death Bowling Variations |
| **Kolkata** (`KOL`) | Kolkata Royal Knights | Eden Riverfront Stadium | Balanced surface with evening dew | New-ball swing early, chasing teams under dew |
| **Delhi** (`DEL`) | Delhi Capitals XI | Kotla Heritage Ground | Two-paced, tacky surface | Cutters, variations & tactical batters |
| **Hyderabad** (`HYD`) | Hyderabad Sunchargers | Uppal Deccan Stadium | Good batting track, slows later | Balanced all-rounders |
| **Ahmedabad** (`AMD`) | Ahmedabad Titans | Motera Sabarmati Bowl | Large boundaries, true bounce | Sprint Speed, Timing & Placement, Stamina |
| **Jaipur** (`JAI`) | Jaipur Pink Royals | Sawai Mansingh Fort | Dry surface with variable bounce | Wrist-spinners & tall fast bowlers |

### 3. 5-Pillar Player Attribute Framework
Every player is modeled across 5 skill pillars (`Physical`, `Mindset`, `Batting`, `Bowling`, `Fielding`):
1. **Physical**: Stamina, Sprint Speed, Strength, Agility & Reflexes, and Injury Proneness.
2. **Mindset**: Aggression, Adaptability, Consistency, Leadership, and Tactical Awareness.
3. **Batting**: Timing & Placement, Power Hitting, Technique (vs. Spin), Technique (vs. Pace), Running Between Wickets, Clutch Factor, plus Situational Roles (`Powerplay Specialist`, `Middle-Overs Anchor`, `Finisher`).
4. **Bowling**: Pace / Revolution Speed, Line & Length Accuracy, Movement (Swing/Seam/Drift), Variations, and Control Under Assault.
5. **Fielding**: Catching (Outfield), Catching (Close-In / Slip), Ground Fielding, Throwing Accuracy & Arm, Wicketkeeping, and Fielding Setup.

### 4. Squad Management, Season Stats & Match Center
- **Matchday XI Rules**: Select **11 fit players**, including **at least 1 Indian U19 player** and **at most 4 overseas internationals**, plus assign a Captain (`C`) and Wicketkeeper (`WK`).
- **Season Stats**: Track the League Points Table, Franchise Rivalry Ledger, Playoff Bracket, and individual leaderboards for **Most Runs Scored** and **Most Wickets Taken**.
- **Match Center**: Review Pre-Match Scouting Dossiers, 3-Day Weather Forecasts, Rivalry morale modifiers, live Run Rate graphs, ball-by-ball checkpoints, and Post-Match Performance Reports.

---

## Development & Verification

```bash
# Install dependencies
npm install

# Start the development server on port 3000
npm run dev

# TypeScript type-check / lint
npm run lint

# Production build
npm run build

# Run engine unit tests
npx tsx --test src/engine/engine.test.ts
```

---

## Project Structure

```text
src/
├── App.tsx                     # Root tournament state, local save/resume & phase flow
├── components/
│   ├── TitleScreen.tsx         # Welcome Page (Start New Game / Resume Saved Game)
│   ├── TopNav.tsx              # Phase navigation, Save Progress & Progress controls
│   ├── SquadManager.tsx        # Player rotation cards, fatigue meters & XI validator
│   ├── TradeMarket.tsx         # Franchise trade evaluator & swap execution
│   ├── PlayerModal.tsx         # 5-pillar profile & tournament Career History
│   ├── MatchCenter.tsx         # Pre-match report, weather, live sim & performance reports
│   └── TournamentView.tsx      # Season Stats (Points table, Runs & Wickets leaders, playoffs)
└── engine/
    ├── types.ts                # Core TypeScript domain models
    ├── cities.ts               # 8 Indian franchise, pitch & weather profiles
    ├── playerGenerator.ts      # Deterministic 275-player pool generator
    ├── squadSetup.ts           # Pitch-tailored initial squad assignment
    ├── storage.ts              # Local device save/resume serialization
    ├── seasonPhase.ts          # Phase transitions & Match Center isolation
    ├── scouting.ts             # Opponent pre-match scouting reports
    ├── trade.ts                # Trade fairness & roster rule engine
    ├── tactics.ts              # Tactical plan parser & captain responses
    ├── rivalry.ts              # Historical H2H rivalry morale engine
    ├── reports.ts              # Post-match milestone & MVP reports
    ├── matchEngine.ts          # Ball-by-ball T20 simulation & XI validation
    ├── tournament.ts           # League/playoff scheduling, NRR, career logs & fitness
    └── engine.test.ts          # Node unit test suite (node:test)
```

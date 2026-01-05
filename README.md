# chess-com-node-scrapper

Scripts to download and visualize chess.com games.

## Features

### 1. Game Download (`download-chesscom.js`)

Downloads chess.com games in JSON format with all PGN information.

**Features:**
- Downloads games from any chess.com user
- Filter by months back from today
- Filter by time control category (bullet, blitz, rapid, daily, classical)
- Limit to the last N games
- Automatic sorting by date in descending order (most recent first)
- Saves all PGN information (headers, moves, comments)
- Automatically handles missing "Rated" header in some PGNs
- Automatic game deduplication

**Usage:**
```bash
node download-chesscom.js --user <username> [options]
```

**Options:**
- `--user` (required): chess.com username
- `--months <number>`: Number of months back from today (optional)
- `--time-control <category>`: Filter by time control category: `bullet`, `blitz`, `rapid`, `daily`, `classical` (optional)
- `--tail <number>`: Only download the last N games (optional)
- `--out <file>`: Output file. Default: `games.json`

**Examples:**
```bash
# Download all games from a user
node download-chesscom.js --user magnuscarlsen

# Download games from the last 3 months
node download-chesscom.js --user username --months 3

# Download only blitz games
node download-chesscom.js --user username --time-control blitz

# Download only the last 50 games
node download-chesscom.js --user username --tail 50

# Combine filters: last 20 blitz games from the last 2 months
node download-chesscom.js --user username --months 2 --time-control blitz --tail 20

# Save to a specific file
node download-chesscom.js --user username --out partidas.json
```

**Note:** Games are automatically sorted by date in descending order (most recent first) before applying the `--tail` limit.

### 2. Game Visualization (`display-games.js`)

Visualizes downloaded games in table format with advanced filtering options.

**Features:**
- Displays games in readable table format
- Support for multiple JSON file formats (direct array or object with "games" property)
- Automatic time control categorization (Bullet, Blitz, Rapid, Daily, Classical)
- Filter by game type and time control category
- Summary statistics (results, game types, time controls)
- Rated/unrated game identification

**Usage:**
```bash
node display-games.js [options]
```

**Options:**
- `--file <file>`: JSON file to read. Default: `partidas.json`
- `--type <type>`: Filter by game type (e.g., "Live Chess", "Let's Play!")
- `--limit <number>`: Limit number of games displayed. Default: 100

**Time Control Categories:**
- **Bullet**: ≤ 3 minutes
- **Blitz**: 3-10 minutes
- **Rapid**: 10-60 minutes
- **Classical**: 60-180 minutes
- **Daily**: Correspondence games (day-based format)

**Examples:**
```bash
# Display all games from default file (partidas.json)
node display-games.js

# Display games from a specific file
node display-games.js --file partidas-enero-2026.json

# Display only "Live Chess" games
node display-games.js --file partidas.json --type "Live Chess"

# Limit to 50 games
node display-games.js --file partidas.json --limit 50

# Combine filters: "Live Chess" games limited to 30
node display-games.js --file partidas.json --type "Live Chess" --limit 30
```

**Information shown in the table:**
- Date
- Game type (Live Chess, Let's Play!, etc.)
- Rated (Yes/No)
- Time Control Category
- White player
- Black player
- Result
- Exact Time Control
- Termination (checkmate, resignation, timeout, etc.)

**Statistics included:**
- Total games
- White/Black wins
- Draws
- Rated/unrated games
- Distribution by time control categories
- Distribution by game types

## Installation

```bash
npm install
```

## Running Locally

You have two options to run the web application locally:

### Option 1: Using Vercel CLI (Recommended)

This simulates the Vercel environment:

```bash
# Install Vercel CLI globally (if not already installed)
npm install -g vercel

# Run the development server
npm run dev
# or
vercel dev
```

The application will be available at `http://localhost:3000`

### Option 2: Using Simple Node.js Server

```bash
npm start
```

The application will be available at `http://localhost:3000`

## Dependencies

- `node-fetch`: For making HTTP requests
- `pgn-parser`: For parsing PGN files
- `yargs`: For command-line argument handling

## Important Notes

### About Rated/Unrated Games

Chess.com doesn't always include the "Rated" header in PGN files. When this header is missing:
- The download script assumes `rated: true` by default (most games on chess.com are rated)
- The visualization script uses the value stored in the downloaded data
- If you need to identify specific unrated games, you may need to verify manually on chess.com

### About Game Sorting

- Downloaded games are automatically sorted by date in descending order (most recent first)
- The `--tail` parameter takes the first N games after sorting, which correspond to the most recent ones
- The visualization script respects the order in the JSON file

### Data Format

Games are saved in JSON format with the following structure:
```json
{
  "schema_version": "1.1",
  "source": "chess.com API",
  "player": "username",
  "generated_at": "2026-01-05T08:40:34.999Z",
  "total_raw_games": 89,
  "total_parsed_games": 89,
  "deduplicated": true,
  "duplicates": [],
  "games": [
    {
      "game_id": "147414081266",
      "url": "https://www.chess.com/game/live/147414081266",
      "date": "2025-12-31",
      "white": "WhiteUser",
      "black": "BlackUser",
      "color": "white",
      "result": "1-0",
      "termination": "checkmate",
      "moves": 70,
      "rated": true,
      "time_control": "600",
      "status": "completed",
      "flags": [],
      "pgn": "[Event \"Live Chess\"]\n[Site \"Chess.com\"]\n..."
    }
  ]
}
```

**Note:** Games within the `games` array are sorted by date in descending order (most recent first).

## Requirements

- Node.js 18+ (for native `fetch` support)
- Internet access to download games from chess.com

## Deployment to Vercel

This application is ready to deploy to Vercel. See [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md) for detailed deployment instructions.

### Quick Deploy

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Deploy to production**:
   ```bash
   vercel --prod
   ```

### Deploy via GitHub

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Vercel will auto-detect the configuration
5. Click "Deploy"

The application will be live at `https://your-project-name.vercel.app`

// download-chesscom.ts
import fs from "fs";
import pgnParser from "pgn-parser";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type {
  DownloadGamesOptions,
  GamesOutput,
  Game,
  ArchivesResponse,
  PGNObject,
  TimeControlCategory,
  TerminationType,
  GameStatus
} from "./types.js";

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) {
      // Extract username from URL for better error message
      const match = url.match(/\/player\/([^\/]+)\//);
      const username = match ? match[1] : 'user';
      throw new Error(`User "${username}" not found or has no public games. Please check the username is correct.`);
    }
    throw new Error(`Failed to fetch: ${res.status} ${res.statusText} (${url})`);
  }
  return res.json() as Promise<T>;
}

async function fetchText(url: string): Promise<string | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.text();
}

function withinMonths(archiveUrl: string, months?: number): boolean {
  if (!months) return true;

  const [year, month] = archiveUrl.split("/").slice(-2).map(Number);
  // Create date for the first day of the archive month
  const archiveDate = new Date(year, month - 1, 1);
  
  // Calculate the cutoff date (first day of the month that is 'months' months ago)
  const now = new Date();
  const limitYear = now.getFullYear();
  const limitMonth = now.getMonth() + 1; // 1-12
  
  // Calculate target month and year
  let targetMonth = limitMonth - months;
  let targetYear = limitYear;
  
  // Handle year rollover
  while (targetMonth <= 0) {
    targetMonth += 12;
    targetYear -= 1;
  }
  
  const limit = new Date(targetYear, targetMonth - 1, 1);

  return archiveDate >= limit;
}

// Function to categorize time control
function getTimeControlCategory(timeControl: string | undefined): TimeControlCategory {
  if (!timeControl) return "Unknown";
  
  // Daily/correspondence games: format like "1/259200" (1 day = 259200 seconds)
  if (timeControl.includes("/")) {
    return "Daily";
  }
  
  // Parse time control (format: "600" or "600+5" for seconds + increment)
  const parts = timeControl.split("+");
  const totalSeconds = parseInt(parts[0], 10);
  
  if (isNaN(totalSeconds)) return "Unknown";
  
  const totalMinutes = totalSeconds / 60;
  
  // Categorize based on total time
  if (totalMinutes <= 3) return "Bullet";
  if (totalMinutes <= 10) return "Blitz";
  if (totalMinutes <= 60) return "Rapid";
  if (totalMinutes <= 180) return "Classical";
  return "Daily"; // Very long time controls
}

// Convert date from YYYY.MM.DD to YYYY-MM-DD
function normalizeDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  return dateStr.replace(/\./g, "-");
}

// Extract game ID from URL
function extractGameId(link: string): string | null {
  if (!link) return null;
  const match = link.match(/\/(\d+)$/);
  return match ? match[1] : null;
}

// Determine player's color
function getPlayerColor(white: string, black: string, player: string): "white" | "black" | null {
  const playerLower = player.toLowerCase();
  if (white?.toLowerCase() === playerLower) return "white";
  if (black?.toLowerCase() === playerLower) return "black";
  return null;
}

// Normalize termination string
function normalizeTermination(termination: string | undefined): TerminationType {
  if (!termination) return "unknown";
  
  const term = termination.toLowerCase();
  
  if (term.includes("checkmate")) return "checkmate";
  if (term.includes("resignation") || term.includes("resigned")) return "resigned";
  if (term.includes("time") && !term.includes("timeout")) return "timeout";
  if (term.includes("timeout")) return "timeout";
  if (term.includes("abandoned")) return "abandoned";
  if (term.includes("agreement")) return "agreement";
  if (term.includes("stalemate")) return "stalemate";
  if (term.includes("insufficient")) return "insufficient";
  if (term.includes("repetition")) return "repetition";
  if (term.includes("50")) return "fifty_move";
  
  return "unknown";
}

// Determine game status
function getGameStatus(result: string, termination: string | undefined): GameStatus {
  if (result === "*") return "unfinished";
  
  const term = termination?.toLowerCase() || "";
  
  if (term.includes("abandoned")) return "aborted";
  if (term.includes("timeout")) return "timeout";
  if (term.includes("resignation") || term.includes("resigned")) return "resigned";
  if (result === "1-0" || result === "0-1" || result === "1/2-1/2") return "completed";
  
  return "unknown";
}

// Count moves from PGN
function countMoves(pgnObj: PGNObject | null | undefined): number {
  if (!pgnObj || !pgnObj.moves) return 0;
  
  let count = 0;
  for (const move of pgnObj.moves) {
    if (move.move) count++;
    if (move.variations) {
      for (const variation of move.variations) {
        count += countMoves({ moves: variation, headers: [] });
      }
    }
  }
  return count;
}

// Convert PGN object to string
function pgnToString(pgnObj: PGNObject | null | undefined): string {
  if (!pgnObj) return "";
  
  let pgn = "";
  
  // Headers
  if (pgnObj.headers) {
    for (const header of pgnObj.headers) {
      pgn += `[${header.name} "${header.value}"]\n`;
    }
  }
  
  pgn += "\n";
  
  // Moves
  if (pgnObj.moves) {
    let moveNumber = 1;
    for (let i = 0; i < pgnObj.moves.length; i++) {
      const move = pgnObj.moves[i];
      
      if (i % 2 === 0) {
        pgn += `${moveNumber}. `;
        moveNumber++;
      }
      
      if (move.move) {
        pgn += move.move + " ";
      }
      
      if (move.comment) {
        pgn += `{${move.comment}} `;
      }
      
      if (move.variations) {
        for (const variation of move.variations) {
          pgn += "(";
          for (const vMove of variation) {
            if (vMove.move) pgn += vMove.move + " ";
          }
          pgn += ") ";
        }
      }
    }
  }
  
  // Result
  if (pgnObj.result) {
    pgn += pgnObj.result;
  }
  
  return pgn.trim();
}

// Main function to download games
export async function downloadGames(options: DownloadGamesOptions): Promise<GamesOutput> {
  const {
    user,
    months,
    timeControl,
    tail,
    logProgress = false
  } = options;

  if (!user) {
    throw new Error("User is required");
  }

  if (logProgress) {
    console.log(`♟ Downloading games from ${user}`);
  }

  const archivesUrl = `https://api.chess.com/pub/player/${user}/games/archives`;
  let archives: string[];
  try {
    const data = await fetchJSON<ArchivesResponse>(archivesUrl);
    archives = data.archives || [];
  } catch (error) {
    const err = error as Error;
    // Re-throw with more context
    if (err.message.includes('not found')) {
      throw err;
    }
    throw new Error(`Failed to fetch archives for user "${user}": ${err.message}`);
  }

  if (!archives || archives.length === 0) {
    throw new Error(`User "${user}" has no game archives available. This could mean the user doesn't exist, has no games, or games are private.`);
  }

  const validArchives = archives.filter(archiveUrl => withinMonths(archiveUrl, months));

  if (logProgress) {
    console.log(`→ Found ${validArchives.length} archives`);
  }

  const rawGames: PGNObject[] = [];
  const parsedGames: Game[] = [];
  const gameIds = new Set<string>();

  for (const archive of validArchives) {
    if (logProgress) {
      console.log(`→ ${archive}`);
    }
    const pgnText = await fetchText(`${archive}/pgn`);
    if (!pgnText) continue;

    const parsed = pgnParser.parse(pgnText) as PGNObject[];
    rawGames.push(...parsed);

    for (const g of parsed) {
      const headers = Object.fromEntries(
        g.headers.map(h => [h.name, h.value])
      ) as Record<string, string>;

      const isRated = headers.Rated !== undefined 
        ? headers.Rated === "True" 
        : true;

      const tc = headers.TimeControl;
      
      if (timeControl) {
        const tcCategory = getTimeControlCategory(tc);
        if (tcCategory.toLowerCase() !== timeControl.toLowerCase()) {
          continue;
        }
      }

      const link = headers.Link || "";
      const gameId = extractGameId(link);
      
      if (gameId && gameIds.has(gameId)) {
        continue;
      }
      if (gameId) {
        gameIds.add(gameId);
      }

      const white = headers.White || "";
      const black = headers.Black || "";
      const result = headers.Result || "*";
      const termination = normalizeTermination(headers.Termination);
      const status = getGameStatus(result, headers.Termination);
      const color = getPlayerColor(white, black, user);
      const moves = countMoves(g);
      const pgn = pgnToString(g);

      parsedGames.push({
        game_id: gameId,
        url: link,
        date: normalizeDate(headers.Date),
        white: white,
        black: black,
        color: color,
        result: result,
        termination: termination,
        moves: moves,
        rated: isRated,
        time_control: tc,
        status: status,
        flags: [],
        pgn: pgn,
      });
    }
  }

  // Sort games by date in descending order (most recent first)
  parsedGames.sort((a, b) => {
    const dateA = a.date || "";
    const dateB = b.date || "";
    return dateB.localeCompare(dateA);
  });

  // Apply tail limit if specified
  let finalGames = parsedGames;
  if (tail && tail > 0) {
    finalGames = parsedGames.slice(0, tail);
    if (logProgress) {
      console.log(`→ Limiting to last ${tail} games (of ${parsedGames.length} total)`);
    }
  }

  const output: GamesOutput = {
    schema_version: "1.1",
    source: "chess.com API",
    player: user,
    generated_at: new Date().toISOString(),
    total_raw_games: rawGames.length,
    total_parsed_games: finalGames.length,
    deduplicated: true,
    duplicates: [],
    games: finalGames,
  };

  return output;
}

// CLI functionality - only run if executed directly
// Check if this file is being run directly (not imported as a module)
const isCLI = process.argv[1] && (
  process.argv[1].endsWith('download-chesscom.ts') ||
  process.argv[1].endsWith('download-chesscom.js') ||
  process.argv[1].includes('download-chesscom')
);

if (isCLI) {
  const argv = yargs(hideBin(process.argv))
    .option("user", {
      type: "string",
      demandOption: true,
    })
    .option("months", {
      type: "number",
      describe: "Number of months back from today (optional)",
    })
    .option("time-control", {
      type: "string",
      describe: "Filter by time control category: bullet, blitz, rapid, daily, classical",
    })
    .option("tail", {
      type: "number",
      describe: "Only download the last N games",
    })
    .option("out", {
      type: "string",
      default: "games.json",
    })
    .parseSync();

  const { user, months, out, tail } = argv;
  const timeControl = argv["time-control"] as string | undefined;

  (async () => {
    try {
      const output = await downloadGames({
        user: user as string,
        months: months as number | undefined,
        timeControl,
        tail: tail as number | undefined,
        logProgress: true
      });

      fs.writeFileSync(out as string, JSON.stringify(output, null, 2));
      console.log(`✅ ${output.total_parsed_games} games saved to ${out}`);
    } catch (error) {
      const err = error as Error;
      console.error("Error:", err.message);
      process.exit(1);
    }
  })();
}


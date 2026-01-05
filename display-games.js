import fs from "fs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const argv = yargs(hideBin(process.argv))
  .option("file", {
    type: "string",
    default: "partidas.json",
    describe: "JSON file to read games from",
  })
  .option("type", {
    type: "string",
    describe: "Filter by game type (e.g., 'Live Chess', \"Let's Play!\")",
  })
  .option("limit", {
    type: "number",
    default: 100,
    describe: "Maximum number of games to display",
  })
  .parse();

const data = JSON.parse(fs.readFileSync(argv.file, "utf-8"));
// Support both formats: direct array or object with "games" property
let games = Array.isArray(data) ? data : (data.games || []);

// Normalize field names (support both snake_case and camelCase)
games = games.map(g => ({
  ...g,
  timeControl: g.timeControl || g.time_control || null,
}));

// Function to categorize time control
function getTimeControlCategory(timeControl) {
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

// Function to extract game type from PGN headers
function getGameType(game) {
  if (!game.pgn || !game.pgn.headers) return "Unknown";
  
  const headers = game.pgn.headers;
  const event = headers.find(h => h.name === "Event");
  const tournament = headers.find(h => h.name === "Tournament");
  
  let type = event ? event.value : "";
  
  // Add tournament info if available
  if (tournament) {
    const tournamentUrl = tournament.value;
    // Extract tournament name from URL if it's a URL
    if (tournamentUrl.includes("tournament")) {
      type += " (Tournament)";
    } else {
      type += ` (${tournament.value})`;
    }
  }
  
  return type || "Unknown";
}

// Filter games based on options
let filteredGames = games;

if (argv.type) {
  filteredGames = filteredGames.filter(g => {
    const gameType = getGameType(g);
    return gameType.toLowerCase().includes(argv.type.toLowerCase());
  });
}

console.log(`\n📊 Total games: ${filteredGames.length}${filteredGames.length !== games.length ? ` (filtered from ${games.length})` : ""}\n`);

// Function to format table cell
function pad(str, width) {
  const s = String(str || "");
  return s.length > width ? s.substring(0, width - 3) + "..." : s.padEnd(width);
}

// Table header
const header = [
  pad("Date", 12),
  pad("Type", 15),
  pad("Rated", 7),
  pad("TC Category", 12),
  pad("White", 16),
  pad("Black", 16),
  pad("Result", 8),
  pad("Time Control", 15),
  pad("Termination", 30),
].join(" | ");

console.log(header);
console.log("-".repeat(header.length));

// Display games
const displayLimit = Math.min(filteredGames.length, argv.limit);
for (let i = 0; i < displayLimit; i++) {
  const g = filteredGames[i];
  const gameType = getGameType(g);
  const tcCategory = getTimeControlCategory(g.timeControl);
  
  const row = [
    pad(g.date, 12),
    pad(gameType, 15),
    pad(g.rated ? "Yes" : "No", 7),
    pad(tcCategory, 12),
    pad(g.white, 16),
    pad(g.black, 16),
    pad(g.result, 8),
    pad(g.timeControl, 15),
    pad(g.termination, 30),
  ].join(" | ");
  console.log(row);
}

if (filteredGames.length > displayLimit) {
  console.log(`\n... and ${filteredGames.length - displayLimit} more games`);
}

// Summary statistics
console.log("\n📈 Summary:");
console.log(`   Total games: ${filteredGames.length}`);
const results = filteredGames.reduce((acc, g) => {
  if (g.result === "1-0") acc.whiteWins++;
  else if (g.result === "0-1") acc.blackWins++;
  else if (g.result === "1/2-1/2") acc.draws++;
  return acc;
}, { whiteWins: 0, blackWins: 0, draws: 0 });

console.log(`   White wins: ${results.whiteWins}`);
console.log(`   Black wins: ${results.blackWins}`);
console.log(`   Draws: ${results.draws}`);
console.log(`   Rated games: ${filteredGames.filter(g => g.rated).length}`);
console.log(`   Unrated games: ${filteredGames.filter(g => !g.rated).length}`);

// Time control category distribution
const tcCategories = {};
filteredGames.forEach(g => {
  const category = getTimeControlCategory(g.timeControl);
  tcCategories[category] = (tcCategories[category] || 0) + 1;
});
console.log(`\n⏱️  Time control categories:`);
Object.entries(tcCategories)
  .sort((a, b) => b[1] - a[1])
  .forEach(([category, count]) => {
    console.log(`   ${category}: ${count} games`);
  });

// Game type distribution
const gameTypes = {};
filteredGames.forEach(g => {
  const type = getGameType(g);
  gameTypes[type] = (gameTypes[type] || 0) + 1;
});
console.log(`\n🎮 Game types:`);
Object.entries(gameTypes)
  .sort((a, b) => b[1] - a[1])
  .forEach(([type, count]) => {
    console.log(`   ${type}: ${count} games`);
  });

// Show available filters if no filters applied
if (filteredGames.length === games.length && games.length > 0) {
  console.log(`\n💡 Filter options:`);
  console.log(`   --file <filename>            JSON file to read games from (default: partidas.json)`);
  console.log(`   --type "Live Chess"          Filter by game type`);
  console.log(`   --limit 50                   Limit number of games displayed`);
}

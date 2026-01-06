// Type definitions for the chess.com scrapper

export interface DownloadGamesOptions {
  user: string;
  months?: number;
  timeControl?: string;
  tail?: number;
  logProgress?: boolean;
}

export interface Game {
  game_id: string | null;
  url: string;
  date: string | null;
  white: string;
  black: string;
  color: "white" | "black" | null;
  result: string;
  termination: string;
  moves: number;
  rated: boolean;
  time_control: string | undefined;
  status: string;
  flags: string[];
  pgn: string;
}

export interface GamesOutput {
  schema_version: string;
  source: string;
  player: string;
  generated_at: string;
  total_raw_games: number;
  total_parsed_games: number;
  deduplicated: boolean;
  duplicates: string[];
  games: Game[];
}

export interface ArchivesResponse {
  archives: string[];
}

export interface PGNHeader {
  name: string;
  value: string;
}

export interface PGNMove {
  move?: string;
  comment?: string;
  variations?: PGNMove[][];
}

export interface PGNObject {
  headers: PGNHeader[];
  moves: PGNMove[];
  result?: string;
}

export type TimeControlCategory = "Bullet" | "Blitz" | "Rapid" | "Classical" | "Daily" | "Unknown";

export type TerminationType = 
  | "checkmate" 
  | "resigned" 
  | "timeout" 
  | "abandoned" 
  | "agreement" 
  | "stalemate" 
  | "insufficient" 
  | "repetition" 
  | "fifty_move" 
  | "unknown";

export type GameStatus = "completed" | "unfinished" | "aborted" | "timeout" | "resigned" | "unknown";


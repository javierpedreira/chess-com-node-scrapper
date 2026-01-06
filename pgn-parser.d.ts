// Type declarations for pgn-parser
declare module 'pgn-parser' {
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

  export function parse(pgn: string): PGNObject[];
}


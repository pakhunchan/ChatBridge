import type { PluginManifest } from '../types'

export const chessManifest: PluginManifest = {
  id: 'chess',
  name: 'Chess',
  description: 'Play chess against the user. The chess board is rendered in an embedded app. Use these tools to start games, make moves, and query game state.',
  iframeUrl: 'http://localhost:5173',
  authType: 'none',
  tools: [
    {
      name: 'chess_start_game',
      description:
        'Start a new chess game. Call this when the user wants to play chess. Returns the initial board state.',
      inputSchema: {
        type: 'object',
        properties: {
          playerColor: {
            type: 'string',
            enum: ['white', 'black'],
            description: 'The color the human player will play as. Defaults to white.',
          },
        },
      },
    },
    {
      name: 'chess_get_board',
      description:
        'Get the current board state including FEN string, whose turn it is, and game status. Use this to understand the current position before suggesting moves.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'chess_make_move',
      description:
        'Make a chess move using standard algebraic notation (e.g. "e4", "Nf3", "O-O") or UCI notation (e.g. "e2e4"). Returns the updated board state.',
      inputSchema: {
        type: 'object',
        properties: {
          move: {
            type: 'string',
            description: 'The move in algebraic notation (e.g. "e4", "Nf3", "Bxc6") or UCI notation (e.g. "e2e4").',
          },
        },
        required: ['move'],
      },
    },
    {
      name: 'chess_get_moves',
      description:
        'Get all legal moves for the current position. Optionally filter by a specific square. Returns an array of move strings.',
      inputSchema: {
        type: 'object',
        properties: {
          square: {
            type: 'string',
            description: 'Optional square to get moves for (e.g. "e2"). If omitted, returns all legal moves.',
          },
        },
      },
    },
    {
      name: 'chess_resign',
      description: 'Resign the current game. Use when the user or LLM wants to concede.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ],
}

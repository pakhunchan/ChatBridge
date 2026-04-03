import type { PluginManifest } from '../types'

export const chessManifest: PluginManifest = {
  id: 'chess',
  name: 'Chess',
  description:
    'The user is playing chess against a built-in engine in an embedded app. You are a chess coach/advisor. Use these tools to start games, set difficulty, and query the board state so you can offer advice. The engine plays the opponent automatically — do NOT try to make moves for either side unless the user explicitly asks.',
  iframeUrl: 'http://localhost:5173',
  authType: 'none',
  tools: [
    {
      name: 'chess_start_game',
      description: 'Start a new chess game. The user plays against a built-in engine. Returns the initial board state.',
      inputSchema: {
        type: 'object',
        properties: {
          playerColor: {
            type: 'string',
            enum: ['white', 'black'],
            description: 'The color the human player will play as. Defaults to white.',
          },
          difficulty: {
            type: 'string',
            enum: ['easy', 'medium', 'hard'],
            description: 'Engine difficulty level. Defaults to medium.',
          },
        },
      },
    },
    {
      name: 'chess_get_board',
      description:
        'Get the current board state including FEN string, whose turn it is, and game status. Use this to understand the current position before offering advice.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'chess_get_moves',
      description:
        'Get all legal moves for the current position. Optionally filter by a specific square. Use this to help advise the user on their options.',
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
      name: 'chess_set_difficulty',
      description: 'Change the engine difficulty level for the current game.',
      inputSchema: {
        type: 'object',
        properties: {
          difficulty: {
            type: 'string',
            enum: ['easy', 'medium', 'hard'],
            description: 'Engine difficulty level.',
          },
        },
        required: ['difficulty'],
      },
    },
    {
      name: 'chess_make_move',
      description:
        'Make a chess move. Only use this if the user explicitly asks you to make a specific move for them. The engine handles the opponent side automatically.',
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
      name: 'chess_resign',
      description: 'Resign the current game.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'chess_close',
      description: 'Close the chess app and remove it from the chat. Use when the user is done playing.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ],
}

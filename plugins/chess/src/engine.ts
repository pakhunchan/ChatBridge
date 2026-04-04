import { Chess } from 'chess.js'
import { type Difficulty, findBestMove } from './ai'

export interface GameState {
  fen: string
  turn: 'white' | 'black'
  moveNumber: number
  inCheck: boolean
  isCheckmate: boolean
  isStalemate: boolean
  isDraw: boolean
  isGameOver: boolean
  lastMove?: string
  difficulty: Difficulty
  summary: string
}

export interface MoveResult extends GameState {
  success: true
  move: string
  message: string
}

export interface StartResult extends GameState {
  success: true
  playerColor: 'white' | 'black'
  message: string
}

let game = new Chess()
let playerColor: 'white' | 'black' = 'white'
let difficulty: Difficulty = 'medium'

export function getState(): GameState {
  const turn = game.turn() === 'w' ? 'white' : 'black' as const
  const moveNumber = Math.ceil(game.moveNumber())
  const inCheck = game.inCheck()
  const isCheckmate = game.isCheckmate()
  const isStalemate = game.isStalemate()
  const isDraw = game.isDraw()

  let summary = `${turn} to move, move ${moveNumber}, ${difficulty}`
  if (isCheckmate) summary = `Checkmate! ${turn === 'white' ? 'Black' : 'White'} wins.`
  else if (isStalemate) summary = 'Stalemate - draw.'
  else if (isDraw) summary = 'Draw.'
  else if (inCheck) summary = `${turn} to move - in check! Move ${moveNumber}`

  return {
    fen: game.fen(),
    turn,
    moveNumber,
    inCheck,
    isCheckmate,
    isStalemate,
    isDraw,
    isGameOver: game.isGameOver(),
    difficulty,
    summary,
  }
}

export function startGame(args: { playerColor?: string; difficulty?: string }): StartResult {
  game = new Chess()
  playerColor = (args.playerColor === 'black' ? 'black' : 'white')
  if (args.difficulty && ['easy', 'medium', 'hard'].includes(args.difficulty)) {
    difficulty = args.difficulty as Difficulty
  }
  return {
    success: true,
    playerColor,
    message: `Game started on ${difficulty} difficulty! You are playing ${playerColor}.`,
    ...getState(),
  }
}

export function setDifficulty(args: { difficulty: string }): { success: true; difficulty: Difficulty; message: string } {
  if (['easy', 'medium', 'hard'].includes(args.difficulty)) {
    difficulty = args.difficulty as Difficulty
  }
  return { success: true, difficulty, message: `Difficulty set to ${difficulty}.` }
}

export function getBoard(): GameState {
  return getState()
}

export function makeMove(args: { move: string }): MoveResult {
  const result = game.move(args.move)
  if (!result) {
    throw new Error(`Illegal move: ${args.move}`)
  }
  const state = getState()
  let message = `Move ${result.san} played.`
  if (state.isCheckmate) message = `${result.san}# Checkmate!`
  else if (state.inCheck) message = `${result.san}+ Check!`
  else if (state.isStalemate) message = 'Stalemate! Game drawn.'
  else if (state.isDraw) message = 'Game drawn.'
  return { success: true, move: result.san, message, ...state, lastMove: result.san }
}

export function getMoves(args: { square?: string }): { square: string | null; moves: string[] } {
  const moves = args.square
    ? game.moves({ square: args.square as never })
    : game.moves()
  return { square: args.square ?? null, moves }
}

export function resign(): { success: true; message: string; isGameOver: true } {
  game = new Chess()
  return { success: true, message: 'Game resigned.', isGameOver: true }
}

// Expose for App.tsx to use directly
export function getGame(): Chess {
  return game
}

export function getPlayerColor(): 'white' | 'black' {
  return playerColor
}

export function getDifficulty(): Difficulty {
  return difficulty
}

// Make a move by source/target squares (for drag-and-drop)
export function movePiece(sourceSquare: string, targetSquare: string, piece: string): boolean {
  try {
    const promotion = piece[1] === 'P' &&
      ((piece[0] === 'w' && targetSquare[1] === '8') || (piece[0] === 'b' && targetSquare[1] === '1'))
        ? 'q'
        : undefined
    const result = game.move({ from: sourceSquare, to: targetSquare, promotion })
    return !!result
  } catch {
    return false
  }
}

/**
 * Play the engine's move (for the non-player side).
 * Returns the move result, or null if it's not the engine's turn or game is over.
 */
export function playEngineMove(): MoveResult | null {
  if (game.isGameOver()) return null
  const engineColor = playerColor === 'white' ? 'b' : 'w'
  if (game.turn() !== engineColor) return null

  const bestMove = findBestMove(game, difficulty)
  if (!bestMove) return null

  return makeMove({ move: bestMove })
}

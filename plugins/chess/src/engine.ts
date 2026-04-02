import { Chess } from 'chess.js'

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

export function getState(): GameState {
  return {
    fen: game.fen(),
    turn: game.turn() === 'w' ? 'white' : 'black',
    moveNumber: Math.ceil(game.moveNumber()),
    inCheck: game.inCheck(),
    isCheckmate: game.isCheckmate(),
    isStalemate: game.isStalemate(),
    isDraw: game.isDraw(),
    isGameOver: game.isGameOver(),
  }
}

export function startGame(args: { playerColor?: string }): StartResult {
  game = new Chess()
  playerColor = (args.playerColor === 'black' ? 'black' : 'white')
  return {
    success: true,
    playerColor,
    message: `Game started! ${playerColor === 'white' ? 'White' : 'Black'} to move.`,
    ...getState(),
  }
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

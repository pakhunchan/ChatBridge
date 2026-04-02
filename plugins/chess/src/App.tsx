import { useCallback, useEffect, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { initBridge, sendStateUpdate } from './bridge'
import { getGame, getPlayerColor, getState, movePiece, startGame } from './engine'
import type { GameState } from './engine'

const PLUGIN_ID = 'chess'

// Initialize a game on load
startGame({ playerColor: 'white' })

export default function App() {
  const [gameState, setGameState] = useState<GameState>(getState())
  const [boardWidth, setBoardWidth] = useState(
    Math.min(window.innerWidth, window.innerHeight - 60, 560)
  )

  // Initialize the postMessage bridge once
  useEffect(() => {
    initBridge(PLUGIN_ID)
  }, [])

  // Listen for tool-invoke results that change game state (e.g., LLM calls chess_start_game)
  useEffect(() => {
    const handler = () => setGameState(getState())
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'tool-invoke') {
        // State will change after bridge handles the invoke — refresh on next tick
        setTimeout(handler, 0)
      }
    })
  }, [])

  const onDrop = useCallback((sourceSquare: string, targetSquare: string, piece: string) => {
    // In standalone mode (no parent iframe), allow both sides for testing.
    // When embedded, the LLM plays the opposite side via tool calls.
    const isEmbedded = window.parent !== window
    if (isEmbedded) {
      const playerTurn = getPlayerColor() === 'white' ? 'w' : 'b'
      if (getGame().turn() !== playerTurn) return false
    }

    const success = movePiece(sourceSquare, targetSquare, piece)
    if (success) {
      setGameState(getState())
      sendStateUpdate(PLUGIN_ID)
    }
    return success
  }, [])

  // Responsive board size
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Leave room for the status text (~40px) and padding
        const available = Math.min(entry.contentRect.width, entry.contentRect.height - 60)
        setBoardWidth(Math.max(Math.min(available, 560), 200))
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const statusText = gameState.isCheckmate
    ? `Checkmate! ${gameState.turn === 'white' ? 'Black' : 'White'} wins!`
    : gameState.isStalemate
      ? 'Stalemate! Draw.'
      : gameState.isDraw
        ? 'Draw!'
        : gameState.inCheck
          ? `${gameState.turn === 'white' ? 'White' : 'Black'} is in check!`
          : `${gameState.turn === 'white' ? 'White' : 'Black'} to move`

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: 8,
        width: '100%',
        height: '100vh',
        justifyContent: 'center',
      }}
    >
      <div style={{ color: '#e0e0e0', fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>
        {statusText}
        {gameState.moveNumber > 1 && ` • Move ${gameState.moveNumber}`}
      </div>
      <Chessboard
        id="chess-board"
        boardWidth={boardWidth}
        position={gameState.fen}
        onPieceDrop={onDrop}
        boardOrientation={getPlayerColor()}
        animationDuration={200}
        customBoardStyle={{
          borderRadius: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}
        customDarkSquareStyle={{ backgroundColor: '#779952' }}
        customLightSquareStyle={{ backgroundColor: '#edeed1' }}
      />
    </div>
  )
}

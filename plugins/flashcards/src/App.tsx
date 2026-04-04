import { useEffect, useState } from 'react'
import { initBridge, sendStateUpdate } from './bridge'
import { flip, getState, rate } from './engine'
import type { FlashcardState } from './engine'

const PLUGIN_ID = 'flashcards'

export default function App() {
  const [state, setState] = useState<FlashcardState>(getState())

  useEffect(() => {
    initBridge(PLUGIN_ID)
  }, [])

  // Listen for tool-invoke results that change state
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'tool-invoke') {
        setTimeout(() => setState(getState()), 0)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const handleFlip = () => {
    if (!state.session || state.session.isFlipped || state.session.isComplete) return
    try {
      flip()
      setState(getState())
      sendStateUpdate(PLUGIN_ID)
    } catch { /* ignore */ }
  }

  const handleRate = (rating: 'easy' | 'medium' | 'hard') => {
    if (!state.session || !state.session.isFlipped) return
    try {
      rate({ rating })
      setState(getState())
      sendStateUpdate(PLUGIN_ID)
    } catch { /* ignore */ }
  }

  const { session } = state

  // Empty state
  if (state.decks.length === 0 && !session) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📚</div>
          <div style={styles.emptyText}>No decks yet</div>
          <div style={styles.emptySubtext}>Ask the AI to create a flashcard deck!</div>
        </div>
      </div>
    )
  }

  // Deck list (no active session)
  if (!session) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>Your Decks</div>
        <div style={styles.deckList}>
          {state.decks.map((deck) => (
            <div key={deck.name} style={styles.deckItem}>
              <span style={styles.deckName}>{deck.name}</span>
              <span style={styles.deckCount}>{deck.cardCount} cards</span>
            </div>
          ))}
        </div>
        <div style={styles.hint}>Ask the AI to study a deck!</div>
      </div>
    )
  }

  // Study complete
  if (session.isComplete) {
    const easy = session.ratings.filter((r) => r === 'easy').length
    const medium = session.ratings.filter((r) => r === 'medium').length
    const hard = session.ratings.filter((r) => r === 'hard').length
    return (
      <div style={styles.container}>
        <div style={styles.header}>Session Complete!</div>
        <div style={styles.completeCard}>
          <div style={styles.completeDeck}>{session.deckName}</div>
          <div style={styles.statsRow}>
            <div style={{ ...styles.statBadge, background: '#2d8a4e' }}>{easy} Easy</div>
            <div style={{ ...styles.statBadge, background: '#b8860b' }}>{medium} Medium</div>
            <div style={{ ...styles.statBadge, background: '#c0392b' }}>{hard} Hard</div>
          </div>
          <div style={styles.scoreText}>
            {session.totalCards} cards studied
          </div>
        </div>
      </div>
    )
  }

  // Active study session
  const card = session.currentCard
  const progress = `${session.currentIndex + 1} / ${session.totalCards}`

  return (
    <div style={styles.container}>
      <div style={styles.studyHeader}>
        <span style={styles.deckLabel}>{session.deckName}</span>
        <span style={styles.progress}>{progress}</span>
      </div>

      {/* Progress bar */}
      <div style={styles.progressBar}>
        <div
          style={{
            ...styles.progressFill,
            width: `${((session.currentIndex) / session.totalCards) * 100}%`,
          }}
        />
      </div>

      {/* Card */}
      <div
        style={styles.cardWrapper}
        onClick={!session.isFlipped ? handleFlip : undefined}
      >
        <div
          style={{
            ...styles.cardInner,
            transform: session.isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front */}
          <div style={{ ...styles.cardFace, ...styles.cardFront }}>
            <div style={styles.cardLabel}>QUESTION</div>
            <div style={styles.cardText}>{card?.front}</div>
            <div style={styles.tapHint}>Tap to flip</div>
          </div>

          {/* Back */}
          <div style={{ ...styles.cardFace, ...styles.cardBack }}>
            <div style={styles.cardLabel}>ANSWER</div>
            <div style={styles.cardText}>{card?.back}</div>
          </div>
        </div>
      </div>

      {/* Rating buttons (only when flipped) */}
      {session.isFlipped && (
        <div style={styles.ratingRow}>
          <button type="button" style={{ ...styles.rateBtn, ...styles.rateBtnHard }} onClick={() => handleRate('hard')}>
            Hard
          </button>
          <button type="button" style={{ ...styles.rateBtn, ...styles.rateBtnMedium }} onClick={() => handleRate('medium')}>
            Medium
          </button>
          <button type="button" style={{ ...styles.rateBtn, ...styles.rateBtnEasy }} onClick={() => handleRate('easy')}>
            Easy
          </button>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100vh',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#e0e0e0',
    padding: 16,
    gap: 16,
  },

  // Empty state
  emptyState: { textAlign: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 20, fontWeight: 600, marginBottom: 4 },
  emptySubtext: { fontSize: 14, color: '#888' },

  // Deck list
  header: { fontSize: 20, fontWeight: 600, marginBottom: 8 },
  deckList: { display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 360 },
  deckItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#2a2a2a',
    borderRadius: 8,
  },
  deckName: { fontWeight: 500 },
  deckCount: { color: '#888', fontSize: 13 },
  hint: { color: '#666', fontSize: 13, marginTop: 8 },

  // Study header
  studyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 360,
    fontSize: 14,
  },
  deckLabel: { fontWeight: 500 },
  progress: { color: '#888' },

  // Progress bar
  progressBar: {
    width: '100%',
    maxWidth: 360,
    height: 4,
    background: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#6c63ff',
    borderRadius: 2,
    transition: 'width 0.3s ease',
  },

  // Card
  cardWrapper: {
    width: '100%',
    maxWidth: 360,
    height: 220,
    perspective: '1000px',
    cursor: 'pointer',
  },
  cardInner: {
    position: 'relative',
    width: '100%',
    height: '100%',
    transition: 'transform 0.5s ease',
    transformStyle: 'preserve-3d',
  },
  cardFace: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 24,
    gap: 12,
  },
  cardFront: {
    background: '#2a2a2a',
    border: '1px solid #3a3a3a',
  },
  cardBack: {
    background: '#1e3a5f',
    border: '1px solid #2a5a8f',
    transform: 'rotateY(180deg)',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 1.5,
    color: '#888',
    textTransform: 'uppercase' as const,
  },
  cardText: {
    fontSize: 18,
    fontWeight: 500,
    textAlign: 'center',
    lineHeight: 1.4,
  },
  tapHint: {
    fontSize: 12,
    color: '#555',
    position: 'absolute',
    bottom: 12,
  },

  // Rating buttons
  ratingRow: {
    display: 'flex',
    gap: 12,
    width: '100%',
    maxWidth: 360,
  },
  rateBtn: {
    flex: 1,
    padding: '10px 0',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    color: '#fff',
    transition: 'opacity 0.2s',
  },
  rateBtnHard: { background: '#c0392b' },
  rateBtnMedium: { background: '#b8860b' },
  rateBtnEasy: { background: '#2d8a4e' },

  // Complete
  completeCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    padding: 32,
    background: '#2a2a2a',
    borderRadius: 12,
    width: '100%',
    maxWidth: 360,
  },
  completeDeck: { fontSize: 18, fontWeight: 600 },
  statsRow: { display: 'flex', gap: 12 },
  statBadge: {
    padding: '6px 16px',
    borderRadius: 20,
    fontSize: 14,
    fontWeight: 500,
  },
  scoreText: { color: '#888', fontSize: 13 },
}

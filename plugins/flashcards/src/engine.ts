export interface Card {
  front: string
  back: string
  score: number
  timesStudied: number
}

export interface Deck {
  name: string
  cards: Card[]
  createdAt: number
}

export interface StudySession {
  deckName: string
  cards: Card[]
  currentIndex: number
  isFlipped: boolean
  ratings: Array<'easy' | 'medium' | 'hard'>
}

export interface FlashcardState {
  decks: Array<{ name: string; cardCount: number }>
  session: {
    deckName: string
    currentIndex: number
    totalCards: number
    isFlipped: boolean
    currentCard: { front: string; back: string } | null
    isComplete: boolean
    ratings: Array<'easy' | 'medium' | 'hard'>
  } | null
  summary: string
}

const decks = new Map<string, Deck>()
let currentSession: StudySession | null = null

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i]!, shuffled[j]!] = [shuffled[j]!, shuffled[i]!]
  }
  return shuffled
}

export function createDeck(args: { name: string; cards: Array<{ front: string; back: string }> }) {
  const cards: Card[] = args.cards.map((c) => ({
    front: c.front,
    back: c.back,
    score: 0,
    timesStudied: 0,
  }))
  decks.set(args.name, { name: args.name, cards, createdAt: Date.now() })
  return { success: true, message: `Deck "${args.name}" created with ${cards.length} cards.`, deckName: args.name, cardCount: cards.length }
}

export function listDecks() {
  const list = Array.from(decks.values()).map((d) => ({ name: d.name, cardCount: d.cards.length }))
  return { decks: list, message: list.length === 0 ? 'No decks yet.' : `${list.length} deck(s) available.` }
}

export function study(args: { deckName: string }) {
  const deck = decks.get(args.deckName)
  if (!deck) throw new Error(`Deck "${args.deckName}" not found.`)
  if (deck.cards.length === 0) throw new Error(`Deck "${args.deckName}" has no cards.`)

  const shuffled = shuffleArray(deck.cards)
  currentSession = {
    deckName: args.deckName,
    cards: shuffled,
    currentIndex: 0,
    isFlipped: false,
    ratings: [],
  }

  const card = shuffled[0]!
  return {
    success: true,
    message: `Studying "${args.deckName}" — ${shuffled.length} cards. Here's the first card.`,
    card: { front: card.front },
    totalCards: shuffled.length,
  }
}

export function flip() {
  if (!currentSession) throw new Error('No active study session.')
  if (currentSession.currentIndex >= currentSession.cards.length) throw new Error('Study session is complete.')

  currentSession.isFlipped = true
  const card = currentSession.cards[currentSession.currentIndex]!
  return {
    success: true,
    message: `Answer: ${card.back}`,
    card: { front: card.front, back: card.back },
  }
}

export function rate(args: { rating: string }) {
  if (!currentSession) throw new Error('No active study session.')
  if (!currentSession.isFlipped) throw new Error('Flip the card first before rating.')

  const rating = args.rating as 'easy' | 'medium' | 'hard'
  const card = currentSession.cards[currentSession.currentIndex]!
  card.timesStudied++
  if (rating === 'easy') card.score += 3
  else if (rating === 'medium') card.score += 1
  else card.score -= 1

  currentSession.ratings.push(rating)
  currentSession.currentIndex++
  currentSession.isFlipped = false

  if (currentSession.currentIndex >= currentSession.cards.length) {
    const easy = currentSession.ratings.filter((r) => r === 'easy').length
    const medium = currentSession.ratings.filter((r) => r === 'medium').length
    const hard = currentSession.ratings.filter((r) => r === 'hard').length
    const deckName = currentSession.deckName
    currentSession = null
    return {
      success: true,
      complete: true,
      message: `Study complete! "${deckName}" — ${easy} easy, ${medium} medium, ${hard} hard.`,
      stats: { easy, medium, hard },
    }
  }

  const nextCard = currentSession.cards[currentSession.currentIndex]!
  return {
    success: true,
    complete: false,
    message: `Rated ${rating}. Next card (${currentSession.currentIndex + 1}/${currentSession.cards.length}).`,
    card: { front: nextCard.front },
  }
}

export function getStats(args: { deckName?: string }) {
  if (args.deckName) {
    const deck = decks.get(args.deckName)
    if (!deck) throw new Error(`Deck "${args.deckName}" not found.`)
    const totalStudied = deck.cards.reduce((sum, c) => sum + c.timesStudied, 0)
    const avgScore = deck.cards.length > 0 ? deck.cards.reduce((sum, c) => sum + c.score, 0) / deck.cards.length : 0
    return {
      deckName: deck.name,
      cardCount: deck.cards.length,
      totalStudied,
      averageScore: Math.round(avgScore * 10) / 10,
    }
  }

  const allStats = Array.from(decks.values()).map((deck) => ({
    deckName: deck.name,
    cardCount: deck.cards.length,
    totalStudied: deck.cards.reduce((sum, c) => sum + c.timesStudied, 0),
  }))
  return { decks: allStats, totalDecks: allStats.length }
}

export function getState(): FlashcardState {
  const deckList = Array.from(decks.values()).map((d) => ({ name: d.name, cardCount: d.cards.length }))

  let session: FlashcardState['session'] = null
  if (currentSession) {
    const isComplete = currentSession.currentIndex >= currentSession.cards.length
    const card = isComplete ? null : currentSession.cards[currentSession.currentIndex]!
    session = {
      deckName: currentSession.deckName,
      currentIndex: currentSession.currentIndex,
      totalCards: currentSession.cards.length,
      isFlipped: currentSession.isFlipped,
      currentCard: card ? { front: card.front, back: card.back } : null,
      isComplete,
      ratings: [...currentSession.ratings],
    }
  }

  let summary: string
  if (currentSession) {
    const isComplete = currentSession.currentIndex >= currentSession.cards.length
    if (isComplete) {
      const easy = currentSession.ratings.filter((r) => r === 'easy').length
      const medium = currentSession.ratings.filter((r) => r === 'medium').length
      const hard = currentSession.ratings.filter((r) => r === 'hard').length
      summary = `Study complete! "${currentSession.deckName}" — ${easy} easy, ${medium} medium, ${hard} hard`
    } else if (currentSession.isFlipped) {
      summary = `Studying "${currentSession.deckName}" — card ${currentSession.currentIndex + 1}/${currentSession.cards.length}, answer showing`
    } else {
      summary = `Studying "${currentSession.deckName}" — card ${currentSession.currentIndex + 1}/${currentSession.cards.length}, front showing`
    }
  } else if (decks.size > 0) {
    summary = `No active study session. ${decks.size} deck(s) available.`
  } else {
    summary = 'No decks yet.'
  }

  return { decks: deckList, session, summary }
}

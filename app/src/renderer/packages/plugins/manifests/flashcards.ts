import type { PluginManifest } from '../types'

export const flashcardsManifest: PluginManifest = {
  id: 'flashcards',
  name: 'Flashcards',
  description:
    'A persistent flashcard app with spaced repetition (Leitner system). Use tools to create decks with cards, add cards to existing decks, list decks, view deck details, and check study stats. The user handles quizzing and study sessions directly in the iframe UI — do not try to quiz them via chat. Auth is self-contained: if a tool returns an auth error, tell the user to sign in within the Flashcards panel.',
  iframeUrl: import.meta.env.DEV ? 'http://localhost:3000' : 'https://flashcards.pakhunchan.com',
  authType: 'none',
  tools: [
    {
      name: 'flashcards_create_deck',
      description:
        'Create a new flashcard deck and bulk-add cards to it. Each card has a front (question/prompt) and back (answer).',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the deck (e.g. "Biology Chapter 5").',
          },
          description: {
            type: 'string',
            description: 'Optional description of the deck.',
          },
          cards: {
            type: 'array',
            description: 'Array of cards to add. Each has a front and back. Max 200 cards per call.',
            items: {
              type: 'object',
              properties: {
                front: { type: 'string', description: 'The question or prompt side of the card.' },
                back: { type: 'string', description: 'The answer side of the card.' },
              },
              required: ['front', 'back'],
            },
          },
        },
        required: ['name', 'cards'],
      },
    },
    {
      name: 'flashcards_add_cards',
      description: 'Add cards to an existing deck. Max 200 cards per call.',
      inputSchema: {
        type: 'object',
        properties: {
          deckId: {
            type: 'string',
            description: 'ID of the deck to add cards to.',
          },
          cards: {
            type: 'array',
            description: 'Array of cards to add.',
            items: {
              type: 'object',
              properties: {
                front: { type: 'string', description: 'The question or prompt side of the card.' },
                back: { type: 'string', description: 'The answer side of the card.' },
              },
              required: ['front', 'back'],
            },
          },
        },
        required: ['deckId', 'cards'],
      },
    },
    {
      name: 'flashcards_list_decks',
      description: 'List all flashcard decks with their card counts.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'flashcards_get_deck',
      description: 'Get a deck\'s details and all its cards.',
      inputSchema: {
        type: 'object',
        properties: {
          deckId: {
            type: 'string',
            description: 'ID of the deck.',
          },
        },
        required: ['deckId'],
      },
    },
    {
      name: 'flashcards_get_stats',
      description:
        'Get study statistics. Pass a deckId for deck-specific stats, or omit for an overview of all decks.',
      inputSchema: {
        type: 'object',
        properties: {
          deckId: {
            type: 'string',
            description: 'Optional deck ID. If omitted, returns overview stats for all decks.',
          },
        },
      },
    },
    {
      name: 'flashcards_delete_deck',
      description: 'Delete a deck and all its cards. Confirm with the user before calling this.',
      inputSchema: {
        type: 'object',
        properties: {
          deckId: {
            type: 'string',
            description: 'ID of the deck to delete.',
          },
        },
        required: ['deckId'],
      },
    },
    {
      name: 'flashcards_close',
      description: 'Close the Flashcards plugin and remove it from the chat.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ],
}

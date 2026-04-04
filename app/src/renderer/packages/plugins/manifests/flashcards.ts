import type { PluginManifest } from '../types'

export const flashcardsManifest: PluginManifest = {
  id: 'flashcards',
  name: 'Flashcards',
  description:
    'The user is studying flashcards. Help them create decks and study. Use tools to create decks, start study sessions, flip cards, and rate recall.',
  iframeUrl: import.meta.env.DEV ? 'http://localhost:5174' : 'https://chatbridge-flashcards.pakhunchan.com',
  authType: 'none',
  tools: [
    {
      name: 'flashcards_create_deck',
      description: 'Create a new flashcard deck with a name and cards. Each card has a front (question) and back (answer).',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the deck (e.g. "Biology Chapter 5").',
          },
          cards: {
            type: 'array',
            description: 'Array of cards, each with a front and back.',
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
      name: 'flashcards_list_decks',
      description: 'List all available flashcard decks with their card counts.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'flashcards_study',
      description: 'Start studying a deck. Shows the first card.',
      inputSchema: {
        type: 'object',
        properties: {
          deckName: {
            type: 'string',
            description: 'Name of the deck to study.',
          },
        },
        required: ['deckName'],
      },
    },
    {
      name: 'flashcards_flip',
      description: 'Flip the current flashcard to reveal the answer.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'flashcards_rate',
      description: 'Rate how well you recalled the current card and advance to the next one.',
      inputSchema: {
        type: 'object',
        properties: {
          rating: {
            type: 'string',
            enum: ['easy', 'medium', 'hard'],
            description: 'How well the user recalled the answer.',
          },
        },
        required: ['rating'],
      },
    },
    {
      name: 'flashcards_get_stats',
      description: 'Get study statistics for a specific deck or all decks.',
      inputSchema: {
        type: 'object',
        properties: {
          deckName: {
            type: 'string',
            description: 'Optional deck name. If omitted, returns stats for all decks.',
          },
        },
      },
    },
    {
      name: 'flashcards_close',
      description: 'Close the flashcard app and remove it from the chat.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ],
}

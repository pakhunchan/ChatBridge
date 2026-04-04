# ChatBridge

ChatBridge is a fork of [chatboxai/chatbox](https://github.com/chatboxai/chatbox) — an Electron + React desktop AI chat client. The goal is to add **third-party app integration** via iframes + postMessage, allowing plugins (chess, weather, Spotify, etc.) to register tools, render UI inside the chat, and communicate bidirectionally with the chatbot.

## Tech Stack

| Layer       | Technology                                                  |
|-------------|-------------------------------------------------------------|
| Runtime     | Electron, Node >=20                                         |
| UI          | React 18, TypeScript                                        |
| Build       | electron-vite, pnpm (required — no npm/yarn)                |
| Linter      | **Biome 2.0** (not ESLint/Prettier)                         |
| Test        | Vitest                                                      |
| Routing     | TanStack Router (file-based, auto-generated route tree)     |
| State       | Zustand, Jotai, TanStack Query                              |
| AI SDK      | Vercel AI SDK (`ai` package), Zod schemas throughout        |

## Project Layout

```
ChatBridge/
├── app/                      # Chatbox fork (the Electron app — all upstream code)
│   ├── src/                  # See "App Structure" below
│   ├── package.json
│   └── electron.vite.config.ts
├── plugins/                  # Third-party plugin apps (each is an independent web app loaded via iframe)
│   └── example-plugin/       # Reference implementation
├── sdk/                      # Shared types & helpers for plugin developers
│                             #   postMessage protocol, plugin manifest schema, tool registration types
├── docs/                     # Architecture docs, integration guides
├── CLAUDE.md                 # This file (root-level)
├── generate_checklist.py
└── misc/
```

## App Structure

```
app/src/
│   ├── main/                          # Electron main process
│   │   ├── main.ts                    # Entry — BrowserWindow, IPC handlers
│   │   ├── mcp/                       # MCP stdio transport (main-side)
│   │   ├── knowledge-base/            # KB indexing & search
│   │   └── store-node.ts              # Persistent storage (electron-store)
│   │
│   ├── preload/
│   │   └── index.ts                   # Context bridge — exposes IPC to renderer
│   │
│   ├── renderer/                      # React app (the UI)
│   │   ├── index.tsx                  # React entry point
│   │   ├── router.tsx                 # TanStack Router setup
│   │   ├── routeTree.gen.ts           # AUTO-GENERATED — never edit manually
│   │   ├── routes/                    # File-based route definitions
│   │   ├── components/
│   │   │   ├── Artifact.tsx           # ★ Existing iframe + postMessage pattern
│   │   │   ├── InputBox/InputBox.tsx  # Chat input component
│   │   │   └── mcp/MCPMenu.tsx        # MCP server management UI
│   │   ├── stores/
│   │   │   ├── chatStore.ts           # Session CRUD (react-query backed)
│   │   │   ├── settingsStore.ts       # User settings (Zustand, persisted)
│   │   │   ├── uiStore.ts             # UI state (Zustand)
│   │   │   └── atoms/                 # Jotai atoms (session, settings, UI)
│   │   ├── packages/
│   │   │   ├── model-calls/
│   │   │   │   ├── stream-text.ts     # ★ Where tool schemas get injected into LLM calls
│   │   │   │   └── toolsets/          # web-search, knowledge-base, file tools
│   │   │   ├── mcp/
│   │   │   │   ├── controller.ts      # MCPServer class & mcpController singleton
│   │   │   │   └── ipc-stdio-transport.ts
│   │   │   ├── context-management/    # Message compaction / context window mgmt
│   │   │   └── token-estimation/      # Token counting
│   │   ├── platform/
│   │   │   ├── interfaces.ts          # ★ Platform abstraction — add new IPC channels here first
│   │   │   ├── desktop_platform.ts    # Electron implementation
│   │   │   └── web_platform.ts        # Browser implementation
│   │   └── setup/
│   │       └── mcp_bootstrap.ts       # MCP initialization on app start
│   │
│   └── shared/                        # Shared between main/renderer/preload
│       ├── types/
│       │   ├── session.ts             # ★ Core data model (Session, Message, MessageContentPart)
│       │   └── settings.ts            # SessionSettings schema
│       ├── models/                    # Model provider interfaces
│       └── providers/                 # AI provider definitions
│
```

## Build Commands

All commands run from `app/`:

```bash
pnpm install              # Install deps (pnpm only!)
pnpm run dev              # Start Electron dev server (HMR)
pnpm run dev:web          # Start web-only dev server (no Electron)
pnpm run build            # Production build
pnpm run test             # Run Vitest
pnpm run lint             # Biome lint
pnpm run lint:fix         # Biome lint + auto-fix
pnpm run check            # TypeScript type-check (tsc --noEmit)
pnpm run format           # Biome format
```

## Core Data Model

All types in `app/src/shared/types/session.ts` use **Zod schemas** with inferred TypeScript types.

```
Session
├── id, name, type ('chat' | 'picture')
├── messages: Message[]
├── settings?: SessionSettings
├── threads?: SessionThread[]
├── compactionPoints?: CompactionPoint[]
└── messageForksHash?: Record<string, MessageFork>

Message
├── id, role ('system' | 'user' | 'assistant' | 'tool')
├── contentParts: MessageContentPart[]    # discriminated union on `type`
│   ├── { type: 'text', text }
│   ├── { type: 'image', storageKey }
│   ├── { type: 'info', text, values? }
│   ├── { type: 'reasoning', text, startTime?, duration? }
│   └── { type: 'tool-call', state, toolCallId, toolName, args, result? }
├── files?: MessageFile[]
├── links?: MessageLink[]
├── generating?, error?, status?, usage?
└── tokenCountMap?, timestamp?, finishReason?
```

## Message Send Flow

The critical path for sending a message:

```
InputBox (components/InputBox/InputBox.tsx)
  → submitNewUserMessage() (stores/session/messages.ts)
    → inserts user message + empty assistant message into store
    → generate() (stores/session/generation.ts)
      → builds context from session messages
      → streamText() (packages/model-calls/stream-text.ts)
        → assembles ToolSet:
            mcpController.getAvailableTools()  // MCP tools
            + web_search, parse_link           // Built-in tools
            + knowledge-base tools
            + file tools
        → model.chat(messages, { tools, ... })
        → streams result back via OnResultChangeWithCancel callback
```

**To add third-party app tools:** inject them into the `tools` object in `app/src/renderer/packages/model-calls/stream-text.ts` alongside the existing MCP/web-search/KB tools.

## State Management

| Store            | Library        | Purpose                                    |
|------------------|----------------|--------------------------------------------|
| `settingsStore`  | Zustand        | User settings (persisted)                  |
| `uiStore`        | Zustand        | UI state (sidebar, dialogs)                |
| `chatStore`      | Zustand + TanStack Query | Session CRUD, query keys: `['chat-sessions-list']`, `['chat-session', id]` |
| `atoms/`         | Jotai          | Fine-grained reactive state (current session ID, settings, UI flags) |

## Existing iframe Pattern — Artifact.tsx

`app/src/renderer/components/Artifact.tsx` already implements a sandboxed iframe with postMessage. **Study this before building the plugin iframe system.**

Key details:
- iframe src: external preview URL (`https://artifact-preview.chatboxai.app/preview`)
- Sandbox: `allow-scripts allow-forms`
- Parent → Child message: `iframe.contentWindow.postMessage({ type: 'html', code }, '*')`
- Parses markdown code blocks into HTML/CSS/JS, sends to iframe for rendering

## MCP (Model Context Protocol) System

Chatbox has a tool/extension system via MCP:
- **Controller:** `app/src/renderer/packages/mcp/controller.ts` — `mcpController` singleton, manages servers, exposes `getAvailableTools()`
- **Transport:** `app/src/main/mcp/ipc-stdio-transport.ts` — IPC transport for stdio-based MCP servers
- **Bootstrap:** `app/src/renderer/setup/mcp_bootstrap.ts` — initializes MCP on app start
- **UI:** `app/src/renderer/components/mcp/MCPMenu.tsx`

Third-party app tools should integrate with or alongside this system.

## Routing

TanStack Router with **file-based routing**:
- Route files: `app/src/renderer/routes/`
- Generated tree: `app/src/renderer/routeTree.gen.ts` — **auto-generated, never edit manually**
- Plugin: `TanStackRouterVite` in `app/electron.vite.config.ts`
- Desktop uses hash history; web uses browser history

## Path Aliases

Defined in `app/electron.vite.config.ts`:

| Alias    | Resolves to        | Available in          |
|----------|--------------------|-----------------------|
| `@`      | `src/renderer/`    | renderer, preload     |
| `@shared`| `src/shared/`      | renderer only         |

## Deployment

Both the host app and plugins deploy to **Vercel**, triggered by pushing to `origin` (labs.gauntletai.com).

| Component | Production URL | Vercel Project | Source |
|-----------|---------------|----------------|--------|
| Host app  | `chatbridge.pakhunchan.com` | [chatbridge-app](https://vercel.com/pakhunchan-3528s-projects/chatbridge-app) | `app/` |
| Spotify plugin | `chatbridge-spotify.pakhunchan.com` | [chatbridge-spotify](https://vercel.com/pakhunchan-3528s-projects/chatbridge-spotify) | `plugins/spotify/` |
| Chess plugin | — | [chatbridge-chess](https://vercel.com/pakhunchan-3528s-projects/chatbridge-chess) | `plugins/chess/` |
| Flashcards plugin | `flashcards.pakhunchan.com` | — | `../Flashcards` (external repo) |

To deploy: commit changes and `git push origin main`.

**Git remotes:**
- `origin` — `ssh://git@labs.gauntletai.com:22022/pakchan/chatbridge.git` (primary, triggers Vercel)
- `old-origin` — `https://github.com/pakhunchan/ChatBridge.git` (GitHub mirror)

## Gotchas

- **pnpm only** — `engines` field enforces `pnpm >=10.17.0`. npm/yarn will fail.
- **Biome, not ESLint** — run `pnpm run lint` (Biome). No `.eslintrc`. Formatting: 2-space indent, single quotes, 120 char line width, LF line endings.
- **`webSecurity: false`** — set in `app/src/main/main.ts` line 266 to allow cross-origin requests. Relevant for iframe communication.
- **`routeTree.gen.ts` is auto-generated** — add new routes by creating files in `app/src/renderer/routes/`, not by editing the generated tree.
- **Settings migrations** — user settings are persisted and migrated; be careful when changing settings schemas.
- **`@` alias is renderer-scoped** — don't use `@` imports in `app/src/main/` or `app/src/shared/` code.
- **All types use Zod schemas** — types are inferred via `z.infer<>`, not hand-written interfaces. Follow this pattern.
- **Platform interface first** — any new IPC channels must be added to `app/src/renderer/platform/interfaces.ts` before implementing in desktop/web platform files.
- **Flashcards plugin is external** — unlike chess/spotify which live in `plugins/`, the Flashcards bridge lives in the external `../Flashcards` Next.js app. Auth is self-contained (Firebase in-iframe), not managed by ChatBridge.

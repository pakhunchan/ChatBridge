-- ChatBridge Supabase Schema
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/lneemsqczcdttkjgqcrv/sql)

-- Users table (synced from Firebase Auth)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                -- Firebase uid
  email TEXT NOT NULL DEFAULT '',
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own data" ON users;
CREATE POLICY "Users can read own data" ON users
  FOR SELECT TO authenticated
  USING (id = current_setting('request.jwt.claims', true)::json->>'sub');

DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE TO authenticated
  USING (id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (id = current_setting('request.jwt.claims', true)::json->>'sub');

DROP POLICY IF EXISTS "Users can insert own data" ON users;
CREATE POLICY "Users can insert own data" ON users
  FOR INSERT TO authenticated
  WITH CHECK (id = current_setting('request.jwt.claims', true)::json->>'sub');

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,              -- 'openai', 'anthropic', etc.
  api_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own API keys" ON api_keys;
CREATE POLICY "Users can manage own API keys" ON api_keys
  FOR ALL TO authenticated
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Chat sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'New Chat',
  type TEXT NOT NULL DEFAULT 'chat',   -- 'chat' | 'picture'
  settings JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own sessions" ON sessions;
CREATE POLICY "Users can manage own sessions" ON sessions
  FOR ALL TO authenticated
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                   -- 'system' | 'user' | 'assistant' | 'tool'
  content_parts JSONB NOT NULL DEFAULT '[]',
  files JSONB,
  links JSONB,
  usage JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own messages" ON messages;
CREATE POLICY "Users can manage own messages" ON messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = messages.session_id
        AND s.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = messages.session_id
        AND s.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

-- Index for fast message loading by session
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id, sort_order);

-- Index for fast session listing by user
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id, updated_at DESC);

-- Seed demo user API key (for "Login as User123" button)
-- Note: The demo user's Firebase UID will be set after first login.
-- You can manually insert it after the demo user signs in for the first time:
--
-- INSERT INTO api_keys (user_id, provider, api_key)
-- VALUES ('<demo-user-firebase-uid>', 'openai', 'sk-proj-...')
-- ON CONFLICT (user_id, provider) DO UPDATE SET api_key = EXCLUDED.api_key;

-- =============================================
-- Plugin Registrations table
-- =============================================

CREATE TABLE IF NOT EXISTS plugin_registrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL CHECK (char_length(description) <= 2000),
  iframe_url TEXT NOT NULL CHECK (iframe_url LIKE 'https://%'),
  auth_type TEXT NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none', 'api-key', 'oauth')),
  tools JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  child_safety_self_certified BOOLEAN NOT NULL DEFAULT false,
  child_safety_description TEXT NOT NULL DEFAULT '' CHECK (char_length(child_safety_description) <= 1000),
  submitted_by TEXT REFERENCES users(id),
  reviewer_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE plugin_registrations ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated) can read approved plugins
DROP POLICY IF EXISTS "Anon can read approved plugins" ON plugin_registrations;
CREATE POLICY "Anon can read approved plugins" ON plugin_registrations
  FOR SELECT TO anon
  USING (status = 'approved');

-- Authenticated users can also read approved plugins
DROP POLICY IF EXISTS "Anyone can read approved plugins" ON plugin_registrations;
CREATE POLICY "Anyone can read approved plugins" ON plugin_registrations
  FOR SELECT TO authenticated
  USING (status = 'approved');

-- Users can read their own submissions (any status)
DROP POLICY IF EXISTS "Users can read own submissions" ON plugin_registrations;
CREATE POLICY "Users can read own submissions" ON plugin_registrations
  FOR SELECT TO authenticated
  USING (submitted_by = current_setting('request.jwt.claims', true)::json->>'sub');

-- Users can insert (submit) new plugins
DROP POLICY IF EXISTS "Users can submit plugins" ON plugin_registrations;
CREATE POLICY "Users can submit plugins" ON plugin_registrations
  FOR INSERT TO authenticated
  WITH CHECK (submitted_by = current_setting('request.jwt.claims', true)::json->>'sub');

-- Index for fast lookup of approved plugins
CREATE INDEX IF NOT EXISTS idx_plugin_registrations_status ON plugin_registrations(status);

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_plugin_registrations_updated_at ON plugin_registrations;
CREATE TRIGGER update_plugin_registrations_updated_at
  BEFORE UPDATE ON plugin_registrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed existing plugins as pre-approved
INSERT INTO plugin_registrations (id, name, description, iframe_url, auth_type, tools, status, child_safety_self_certified, child_safety_description, reviewed_by, reviewed_at)
VALUES
  (
    'chess',
    'Chess',
    'The user is playing chess against a built-in engine in an embedded app. You are a chess coach/advisor. Use these tools to start games, set difficulty, and query the board state so you can offer advice. The engine plays the opponent automatically — do NOT try to make moves for either side unless the user explicitly asks.',
    'https://chatbridge-chess.pakhunchan.com',
    'none',
    '[{"name":"chess_start_game","description":"Start a new chess game. The user plays against a built-in engine. Returns the initial board state.","inputSchema":{"type":"object","properties":{"playerColor":{"type":"string","enum":["white","black"],"description":"The color the human player will play as. Defaults to white."},"difficulty":{"type":"string","enum":["easy","medium","hard"],"description":"Engine difficulty level. Defaults to medium."}}}},{"name":"chess_get_board","description":"Get the current board state including FEN string, whose turn it is, and game status.","inputSchema":{"type":"object","properties":{}}},{"name":"chess_get_moves","description":"Get all legal moves for the current position. Optionally filter by a specific square.","inputSchema":{"type":"object","properties":{"square":{"type":"string","description":"Optional square to get moves for (e.g. \"e2\"). If omitted, returns all legal moves."}}}},{"name":"chess_set_difficulty","description":"Change the engine difficulty level for the current game.","inputSchema":{"type":"object","properties":{"difficulty":{"type":"string","enum":["easy","medium","hard"],"description":"Engine difficulty level."}},"required":["difficulty"]}},{"name":"chess_make_move","description":"Make a chess move. Only use this if the user explicitly asks you to make a specific move for them.","inputSchema":{"type":"object","properties":{"move":{"type":"string","description":"The move in algebraic notation (e.g. \"e4\", \"Nf3\") or UCI notation (e.g. \"e2e4\")."}},"required":["move"]}},{"name":"chess_resign","description":"Resign the current game.","inputSchema":{"type":"object","properties":{}}},{"name":"chess_close","description":"Close the chess app and remove it from the chat.","inputSchema":{"type":"object","properties":{}}}]'::jsonb,
    'approved',
    true,
    'No external content, no user data collection',
    'seed',
    now()
  ),
  (
    'spotify',
    'Spotify',
    'The user wants to listen to music. Help them search for and play songs, albums, and playlists via Spotify. Use tools to search, control playback, and open tracks in the Spotify app.',
    'https://chatbridge-spotify.pakhunchan.com',
    'oauth',
    '[{"name":"spotify_search","description":"Search the Spotify catalog for tracks, albums, playlists, or artists.","inputSchema":{"type":"object","properties":{"query":{"type":"string","description":"Search query."},"type":{"type":"string","enum":["track","album","playlist","artist"],"description":"Type of result to search for. Defaults to \"track\"."},"limit":{"type":"number","description":"Max number of results (1-20). Defaults to 5."}},"required":["query"]}},{"name":"spotify_play","description":"Load a track, album, or playlist into the embedded Spotify player by URI or URL.","inputSchema":{"type":"object","properties":{"uri":{"type":"string","description":"Spotify URI or URL."}},"required":["uri"]}},{"name":"spotify_pause","description":"Pause the embedded Spotify player.","inputSchema":{"type":"object","properties":{}}},{"name":"spotify_resume","description":"Resume playback in the embedded Spotify player.","inputSchema":{"type":"object","properties":{}}},{"name":"spotify_get_state","description":"Get current playback state.","inputSchema":{"type":"object","properties":{}}},{"name":"spotify_open_in_app","description":"Open the current or a specified track in the native Spotify app.","inputSchema":{"type":"object","properties":{"uri":{"type":"string","description":"Optional Spotify URI."}}}},{"name":"spotify_set_size","description":"Change the player display size.","inputSchema":{"type":"object","properties":{"size":{"type":"string","enum":["compact","list","full"],"description":"Player size preset."}},"required":["size"]}},{"name":"spotify_close","description":"Close the Spotify player and remove it from the chat.","inputSchema":{"type":"object","properties":{}}}]'::jsonb,
    'approved',
    true,
    'Uses Spotify content filtering; no explicit content by default',
    'seed',
    now()
  ),
  (
    'flashcards',
    'Flashcards',
    'A persistent flashcard app with spaced repetition (Leitner system). Use tools to create decks with cards, add cards to existing decks, list decks, view deck details, and check study stats.',
    'https://flashcards.pakhunchan.com',
    'none',
    '[{"name":"flashcards_create_deck","description":"Create a new flashcard deck and bulk-add cards to it.","inputSchema":{"type":"object","properties":{"name":{"type":"string","description":"Name of the deck."},"description":{"type":"string","description":"Optional description."},"cards":{"type":"array","description":"Array of cards to add. Max 200 per call.","items":{"type":"object","properties":{"front":{"type":"string"},"back":{"type":"string"}},"required":["front","back"]}}},"required":["name","cards"]}},{"name":"flashcards_add_cards","description":"Add cards to an existing deck. Max 200 per call.","inputSchema":{"type":"object","properties":{"deckId":{"type":"string","description":"ID of the deck."},"cards":{"type":"array","description":"Array of cards.","items":{"type":"object","properties":{"front":{"type":"string"},"back":{"type":"string"}},"required":["front","back"]}}},"required":["deckId","cards"]}},{"name":"flashcards_list_decks","description":"List all flashcard decks with their card counts.","inputSchema":{"type":"object","properties":{}}},{"name":"flashcards_get_deck","description":"Get a deck details and all its cards.","inputSchema":{"type":"object","properties":{"deckId":{"type":"string","description":"ID of the deck."}},"required":["deckId"]}},{"name":"flashcards_get_stats","description":"Get study statistics.","inputSchema":{"type":"object","properties":{"deckId":{"type":"string","description":"Optional deck ID."}}}},{"name":"flashcards_delete_deck","description":"Delete a deck and all its cards.","inputSchema":{"type":"object","properties":{"deckId":{"type":"string","description":"ID of the deck."}},"required":["deckId"]}},{"name":"flashcards_close","description":"Close the Flashcards plugin and remove it from the chat.","inputSchema":{"type":"object","properties":{}}}]'::jsonb,
    'approved',
    true,
    'Educational content only, user-generated decks',
    'seed',
    now()
  )
ON CONFLICT (id) DO NOTHING;

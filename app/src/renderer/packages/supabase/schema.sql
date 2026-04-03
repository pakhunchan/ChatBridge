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

CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert own data" ON users
  FOR INSERT WITH CHECK (true);

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

CREATE POLICY "Users can manage own API keys" ON api_keys
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

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

CREATE POLICY "Users can manage own sessions" ON sessions
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

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

CREATE POLICY "Users can manage own messages" ON messages
  FOR ALL USING (
    session_id IN (
      SELECT id FROM sessions
      WHERE user_id = current_setting('request.jwt.claims', true)::json->>'sub'
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

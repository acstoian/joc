-- ─── 0001_init_schema.sql ────────────────────────────────────────────────────
-- Five-table schema for the Joc live wedding game-show.
--
-- Circular FK resolution:
--   games.current_question_id → questions(id)   [but questions.game_id → games(id)]
-- Strategy: create `games` first WITHOUT the current_question_id FK, create
-- `questions`, then ALTER TABLE games to add the FK after questions exists.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── games ───────────────────────────────────────────────────────────────────
-- One row per game session.  The phase column is the canonical state machine.
CREATE TABLE IF NOT EXISTS games (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  phase               TEXT NOT NULL DEFAULT 'lobby'
                      CHECK (phase IN ('lobby','question','locked','revealed','ended')),
  current_question_id UUID,          -- FK added below after questions table exists
  started_at          TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ
);

-- ─── questions ───────────────────────────────────────────────────────────────
-- Authored by host; display_order makes the sequence explicit.
-- correct_option is NULL until the host reveals (D-12 answer-secrecy).
CREATE TABLE IF NOT EXISTS questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id        UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  body           TEXT NOT NULL,
  option_a       TEXT NOT NULL,
  option_b       TEXT NOT NULL,
  correct_option TEXT CHECK (correct_option IN ('A','B')),  -- NULL until revealed
  display_order  INT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Resolve circular FK: games.current_question_id → questions(id) ──────────
ALTER TABLE games
  ADD CONSTRAINT games_current_question_fk
  FOREIGN KEY (current_question_id)
  REFERENCES questions(id)
  ON DELETE SET NULL;

-- ─── players ─────────────────────────────────────────────────────────────────
-- Guest identity.  device_token (persisted in localStorage) enables idempotent
-- reconnect via upsert on (game_id, device_token).
CREATE TABLE IF NOT EXISTS players (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id      UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  device_token UUID NOT NULL,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, device_token)   -- one player record per device per game (D-08)
);

-- ─── answers ─────────────────────────────────────────────────────────────────
-- One row per player per question.
-- UNIQUE (player_id, question_id) is the SCOR-03 anti-cheat: DB rejects any
-- second submission with SQLSTATE 23505 regardless of application logic.
CREATE TABLE IF NOT EXISTS answers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  question_id  UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  choice       TEXT NOT NULL CHECK (choice IN ('A','B')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, question_id)  -- hard dedup: DB rejects second submission (SCOR-03)
);

-- ─── scores ──────────────────────────────────────────────────────────────────
-- Denormalised running total updated by the server after each reveal.
-- Avoids full answer-recount on every leaderboard request (D-09).
CREATE TABLE IF NOT EXISTS scores (
  player_id     UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  correct_count INT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
-- Answer lookups for scoring after reveal
CREATE INDEX IF NOT EXISTS answers_question_id_idx  ON answers(question_id);
-- Leaderboard sort (DESC so the top scorer is first in an index scan)
CREATE INDEX IF NOT EXISTS scores_correct_count_idx ON scores(correct_count DESC);
-- Player lookup on reconnect (device_token is searched globally per game)
CREATE INDEX IF NOT EXISTS players_device_token_idx ON players(device_token);

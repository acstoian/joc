-- ─── 0003_reset_function.sql ─────────────────────────────────────────────────
-- reset_game(p_game_id uuid) — D-10 reset routine.
--
-- Clears all player answers and zeroes scores for the given game,
-- resets the game row to lobby state.  KEEPS questions intact so the
-- host does not need to re-enter them for a dry-run → event re-run.
--
-- SECURITY DEFINER: runs with the privileges of the function owner (postgres),
-- not the calling role.  NOT granted to anon — host-only, called via the
-- service_role server client which bypasses RLS.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION reset_game(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Delete all answers for questions belonging to this game
  DELETE FROM answers
  WHERE question_id IN (
    SELECT id FROM questions WHERE game_id = p_game_id
  );

  -- 2. Zero out scores for all players in this game
  UPDATE scores
  SET correct_count = 0,
      updated_at    = now()
  WHERE player_id IN (
    SELECT id FROM players WHERE game_id = p_game_id
  );

  -- 3. Reset the game row: back to lobby, no current question
  UPDATE games
  SET phase               = 'lobby',
      current_question_id = NULL,
      started_at          = NULL,
      ended_at            = NULL
  WHERE id = p_game_id;
END;
$$;

-- Explicitly revoke execute from public and anon (defense in depth — D-12 / T-01-08)
REVOKE EXECUTE ON FUNCTION reset_game(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION reset_game(uuid) FROM anon;

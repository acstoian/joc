-- ─── 0005_both_correct.sql ───────────────────────────────────────────────────
-- Extend recompute_scores to handle correct_option = 'AB' (both answers correct).
--
-- When the host picks "Ambii" (both), correct_option is stored as 'AB'.
-- The previous exact-match logic (a.choice = q.correct_option) would give
-- zero points to everyone since no player answer is literally 'AB'.
--
-- Fix: treat 'AB' as "any answer is correct" — a player's answer counts as
-- correct if correct_option = 'AB' (regardless of what they picked) OR if
-- their choice exactly matches a single correct_option value ('A' or 'B').
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION recompute_scores(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Recompute each player's correct_count from scratch:
  --   * LEFT JOINs ensure players with zero answers get a 0 row (not skipped)
  --   * FILTER now handles three correct_option values:
  --       'A'  — only A answers score
  --       'B'  — only B answers score
  --       'AB' — ALL answers score (both Andrei and Cristina were correct)
  --   * ON CONFLICT DO UPDATE replaces (never increments) — reset-safe (D-09)
  INSERT INTO scores (player_id, correct_count, updated_at)
  SELECT
    p.id AS player_id,
    COUNT(a.id) FILTER (
      WHERE q.correct_option IS NOT NULL
        AND (
          q.correct_option = 'AB'          -- both correct: any answer scores
          OR a.choice = q.correct_option   -- single correct: exact match
        )
    ) AS correct_count,
    now()
  FROM players p
  LEFT JOIN answers  a ON a.player_id  = p.id
  LEFT JOIN questions q ON q.id        = a.question_id
  WHERE p.game_id = p_game_id
  GROUP BY p.id
  ON CONFLICT (player_id) DO UPDATE
    SET correct_count = EXCLUDED.correct_count,
        updated_at    = now();
END;
$$;

-- Re-apply revoke (idempotent — defense in depth, T-03-01 / ASVS V4)
REVOKE EXECUTE ON FUNCTION recompute_scores(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION recompute_scores(uuid) FROM anon;

-- ─── 0004_recompute_scores.sql ─────────────────────────────────────────────────
-- recompute_scores(p_game_id uuid) — D-09 idempotent score recompute.
--
-- Called by POST /api/host/reveal after setting questions.correct_option.
-- Counts correct answers from scratch (never increments) → reset-safe and
-- re-reveal-safe.  Distinct from reset_game() (0003) — that is the full-wipe
-- path; this only recomputes scores for revealed questions.
--
-- SECURITY DEFINER: runs with the privileges of the function owner (postgres),
-- not the calling role.  NOT granted to anon — host-only, called via the
-- service_role server client which bypasses RLS.
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
  --   * FILTER (WHERE correct_option IS NOT NULL AND choice = correct_option)
  --     counts only answers to revealed questions (correct_option set by host)
  --   * ON CONFLICT DO UPDATE SET correct_count = EXCLUDED.correct_count
  --     replaces the stored count — never increments — so reset+re-reveal
  --     can never double-count (D-09, Pitfall 4)
  INSERT INTO scores (player_id, correct_count, updated_at)
  SELECT
    p.id AS player_id,
    COUNT(a.id) FILTER (
      WHERE q.correct_option IS NOT NULL
        AND a.choice = q.correct_option
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

-- Explicitly revoke execute from public and anon (defense in depth — T-03-01 / ASVS V4)
REVOKE EXECUTE ON FUNCTION recompute_scores(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION recompute_scores(uuid) FROM anon;

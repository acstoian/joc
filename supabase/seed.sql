-- ─── seed.sql ────────────────────────────────────────────────────────────────
-- Sample data for the Joc wedding game-show (D-11).
-- Inserts one games row and 5 sample A/B questions.
-- Idempotent: ON CONFLICT DO NOTHING so re-running the seed is safe.
-- ─────────────────────────────────────────────────────────────────────────────

-- Use a fixed UUID for the seed game so the seed is fully idempotent.
-- This UUID is reserved for dev/test only; production games are created via the host UI.
DO $$
DECLARE
  v_game_id UUID := 'a0000000-0000-4000-8000-000000000001';
BEGIN

  -- ── Insert seed game ──────────────────────────────────────────────────────
  INSERT INTO games (id, phase, created_at)
  VALUES (v_game_id, 'lobby', now())
  ON CONFLICT (id) DO NOTHING;

  -- ── Insert sample A/B questions ───────────────────────────────────────────
  -- correct_option is set so Phase-3 reveal is testable end-to-end.

  INSERT INTO questions (id, game_id, body, option_a, option_b, correct_option, display_order)
  VALUES
    (
      'b0000000-0000-4000-8000-000000000001',
      v_game_id,
      'Câți ani au împreună Cristina și Andrei la nunta lor?',
      '5 ani',
      '7 ani',
      'B',
      1
    ),
    (
      'b0000000-0000-4000-8000-000000000002',
      v_game_id,
      'Unde și-au petrecut prima vacanță împreună?',
      'Paris',
      'Roma',
      'A',
      2
    ),
    (
      'b0000000-0000-4000-8000-000000000003',
      v_game_id,
      'Ce culoare a rochiei de mireasă a ales Cristina?',
      'Ivory',
      'Albă',
      'A',
      3
    ),
    (
      'b0000000-0000-4000-8000-000000000004',
      v_game_id,
      'În ce lună s-au cunoscut Cristina și Andrei?',
      'Martie',
      'Mai',
      'B',
      4
    ),
    (
      'b0000000-0000-4000-8000-000000000005',
      v_game_id,
      'Care este mâncarea preferată a lui Andrei?',
      'Pizza',
      'Sarmale',
      'B',
      5
    )
  ON CONFLICT (id) DO NOTHING;

END $$;

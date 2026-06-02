-- ─── 0002_rls_policies.sql ───────────────────────────────────────────────────
-- Row Level Security for all five tables.
--
-- Security model:
--   • anon role — unauthenticated guests (phone browsers using the anon key)
--   • service_role — server-only admin client; bypasses RLS by design
--
-- Key invariant (D-12 / T-01-05):
--   anon MUST NOT read questions.correct_option before reveal.
--   Implemented via a column-masking VIEW `public.questions_public` that omits
--   correct_option.  anon SELECT on the base questions table is explicitly
--   denied; anon reads only from the view.
--
-- PITFALLS #11 compliance: explicit SELECT/INSERT/UPDATE/DELETE policies for
-- the anon role on every table — even if the policy body is USING(false) —
-- so no table is left at implicit-deny-all-but-unclear state.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enable RLS on all five tables ─────────────────────────────────────────────
ALTER TABLE games     ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE players   ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores    ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- games  (public read; no anon writes — host uses service_role)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "anon_games_select"
  ON games FOR SELECT TO anon USING (true);

CREATE POLICY "anon_games_insert"
  ON games FOR INSERT TO anon WITH CHECK (false);

CREATE POLICY "anon_games_update"
  ON games FOR UPDATE TO anon USING (false);

CREATE POLICY "anon_games_delete"
  ON games FOR DELETE TO anon USING (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- questions  (anon SELECT DENIED on base table — reads via questions_public view)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "anon_questions_select"
  ON questions FOR SELECT TO anon USING (false);  -- use questions_public view instead

CREATE POLICY "anon_questions_insert"
  ON questions FOR INSERT TO anon WITH CHECK (false);

CREATE POLICY "anon_questions_update"
  ON questions FOR UPDATE TO anon USING (false);

CREATE POLICY "anon_questions_delete"
  ON questions FOR DELETE TO anon USING (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- questions_public VIEW  (column-masking — omits correct_option)
-- anon SELECT is granted on this view; service_role can still read all columns
-- on the base questions table (bypasses RLS).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.questions_public AS
  SELECT
    id,
    game_id,
    body,
    option_a,
    option_b,
    display_order,
    created_at
  FROM questions;

-- Grant anon SELECT on the view (base table SELECT denied above)
GRANT SELECT ON public.questions_public TO anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- players  (public read; anon INSERT allowed for guest join)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "anon_players_select"
  ON players FOR SELECT TO anon USING (true);

-- Guest JOIN upsert goes through the API route (service_role server client)
-- so anon INSERT is set to deny here; the server-side route handles joining.
CREATE POLICY "anon_players_insert"
  ON players FOR INSERT TO anon WITH CHECK (false);

CREATE POLICY "anon_players_update"
  ON players FOR UPDATE TO anon USING (false);

CREATE POLICY "anon_players_delete"
  ON players FOR DELETE TO anon USING (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- answers  (T-01-06, T-01-08)
--   anon INSERT allowed — guests submit answers via API route with anon key.
--   anon SELECT denied — reading other players' answers is blocked.
--   anon UPDATE/DELETE denied — no client-side modification.
--
-- Note: The API route (Phase 3) uses the service_role client for the actual
-- INSERT, which bypasses RLS.  If future phases allow anon-key direct insert,
-- the WITH CHECK(true) policy covers that path too.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "anon_answers_select"
  ON answers FOR SELECT TO anon USING (false);

CREATE POLICY "anon_answers_insert"
  ON answers FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_answers_update"
  ON answers FOR UPDATE TO anon USING (false);

CREATE POLICY "anon_answers_delete"
  ON answers FOR DELETE TO anon USING (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- scores  (public leaderboard read; no anon writes)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "anon_scores_select"
  ON scores FOR SELECT TO anon USING (true);

CREATE POLICY "anon_scores_insert"
  ON scores FOR INSERT TO anon WITH CHECK (false);

CREATE POLICY "anon_scores_update"
  ON scores FOR UPDATE TO anon USING (false);

CREATE POLICY "anon_scores_delete"
  ON scores FOR DELETE TO anon USING (false);

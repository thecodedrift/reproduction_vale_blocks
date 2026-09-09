import { join } from "node:path";

/** Where generated fixtures live. Git-ignored: they are large and derived. */
export const FIXTURE_DIR = "fixtures";

/**
 * One sentence, carrying exactly one match for the `Repro.Hedging` rule
 * ("simply"). Both large fixtures repeat it the same number of times, so they
 * produce the same alert count and differ only in block structure.
 */
export const SENTENCE =
  "This is simply a sentence of prose that a writer might reasonably produce.";

/** Repetitions in each large fixture. ~3 MB at this sentence length. */
export const REPEAT = 42_500;

export const FIXTURES = {
  smallA: join(FIXTURE_DIR, "small-a.md"),
  smallB: join(FIXTURE_DIR, "small-b.md"),
  huge: join(FIXTURE_DIR, "huge.md"),
  wrapped: join(FIXTURE_DIR, "wrapped.md"),
};

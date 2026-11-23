const VERDICT_RANK = { "Clear edge": 0, "Some edge": 1, "Weak or unproven": 2, "No edge": 3, "Not enough data": 4 };

/** Best verdict first, then the highest skill in the test years. */
export const byVerdict = (a, b) =>
  (VERDICT_RANK[a.verdict] ?? 9) - (VERDICT_RANK[b.verdict] ?? 9) || (b.test?.skill ?? -9) - (a.test?.skill ?? -9);

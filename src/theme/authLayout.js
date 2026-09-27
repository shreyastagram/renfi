/**
 * The shared vertical scale for the auth screens.
 *
 * WHY THIS EXISTS
 *
 * Eleven auth screens each invented their own rhythm for the same three
 * elements. Measured across them:
 *
 *   brand -> title gap    10, 14, 18, 20      four values
 *   title size            21, 22, 24          three values
 *   subtitle size         13, 14              two values
 *   header -> body gap    8, 20, 24, 28, 32   five values
 *
 * Nothing was wrong on any single screen, which is exactly why it drifted —
 * each was edited alone and each looked fine alone. Moving between them is
 * where it reads as ill-organised: the title changes size, the gaps breathe
 * differently, and the eye has to re-find the same three things every time.
 *
 * Same failure as the wordmark (§48): fourteen copies of one idea, owned by
 * nobody. The answer is the same — one definition, and a test that fails if a
 * screen goes back to inventing numbers.
 *
 * THE SCALE
 *
 * Tight at the top, looser toward the body, so the header reads as one block
 * rather than three floating lines. Values are chosen to hold on a 320pt
 * screen at the largest accessible font scale without pushing the primary
 * action below the fold.
 */

export const AUTH = {
  /** Logo mark -> wordmark. They are one lockup, so this is deliberately small. */
  logoGap: 12,

  /** Wordmark -> title. */
  brandGap: 12,

  /** Title -> subtitle. Within a sentence, so tighter than the gaps around it. */
  titleGap: 6,

  /** The whole header block -> the first field or card. */
  headerGap: 26,

  /** Screen side padding. */
  gutter: 20,

  /** Between stacked cards or fields. */
  stackGap: 12,

  type: {
    /** The screen's question. One size everywhere, so it stops moving. */
    title: 23,
    titleWeight: '700',
    /** Negative tracking on a large bold face — it reads as set, not spaced. */
    titleTracking: -0.4,

    /** The supporting line under it. */
    subtitle: 14,
    subtitleLine: 20,
  },
};

export default AUTH;

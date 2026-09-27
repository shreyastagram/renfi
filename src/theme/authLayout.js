/**
 * The shared vertical scale for the auth screens.
 *
 * WHY THIS EXISTS
 *
 * Eleven auth screens each invented their own rhythm for the same three
 * elements — four different gaps below the brand, three title sizes, five gaps
 * above the form. No screen was wrong alone, which is why it drifted; it only
 * reads as disorganised when you move between them.
 *
 * WHY THE NUMBERS CHANGED (second pass)
 *
 * The first version of this scale was too tight — 6pt between title and
 * subtitle, 12pt below the brand — and it clustered every screen's content
 * against the top while the lower half sat empty. That is denser, not clearer.
 *
 * > Optimised does not mean compact. It means the eye finds each thing in the
 * > order it needs them, with enough room to separate them.
 *
 * These values now come from published guidance rather than taste:
 *
 *   - Material 3 builds on an 8dp grid, with 4dp for fine alignment. Every
 *     value here is a multiple of 4, most of 8.
 *   - Form elements want 16–24dp of separation — enough to read as distinct
 *     without breaking the group apart.
 *   - Touch targets are 48dp minimum (Material) / 44dp (Apple HIG), with 8dp
 *     or more between adjacent targets.
 *
 * VERTICAL DISTRIBUTION
 *
 * Spacing alone does not fix a clustered screen. A short form pinned to the
 * top of a tall phone leaves a dead lower half, so the auth scroll containers
 * use `flexGrow: 1` with the content centred: the form sits where the eye
 * lands, and on a small screen or with the keyboard up it falls back to
 * scrolling from the top with nothing clipped. See `contentContainer` below.
 *
 * Sources:
 *   https://m3.material.io/styles/spacing/overview
 *   https://m3.material.io/foundations/designing/structure
 *   https://www.smashingmagazine.com/2018/08/best-practices-for-mobile-form-design/
 */

export const AUTH = {
  /** Logo mark -> wordmark. One lockup, so the tightest gap on the screen. */
  logoGap: 16,

  /** Wordmark -> title. */
  brandGap: 16,

  /** Title -> subtitle. Within one thought, so half the gap around it. */
  titleGap: 8,

  /** The header block -> the first field. The largest gap: it separates
   *  "who we are" from "what we need from you". */
  headerGap: 32,

  /** Screen side padding. */
  gutter: 24,

  /** Between stacked fields — the 16–24 band from the form guidance. */
  stackGap: 16,

  /** Between labelled groups, or a field and the action below it. */
  fieldGap: 20,

  /** Above the primary action, so it is never mistaken for another field. */
  actionGap: 24,

  /** Minimum interactive height. Material says 48, Apple 44; take the larger
   *  so one number satisfies both. */
  touchTarget: 48,

  type: {
    /** The screen's question. One size everywhere, so it stops moving. */
    title: 24,
    titleWeight: '700',
    /** Negative tracking on a large bold face reads as set, not spaced. */
    titleTracking: -0.4,

    subtitle: 14.5,
    subtitleLine: 21,
  },

  /**
   * For the auth ScrollView's contentContainerStyle.
   *
   * flexGrow only — NOT justifyContent: 'center'.
   *
   * Centring was tried and was wrong. It squeezed every screen into a band in
   * the middle with dead space above AND below, and floated the back arrow to
   * the vertical centre, which is nowhere. An auth screen is read top-down: a
   * back control, a brand, a question, then the field that answers it. Those
   * belong at the top, and empty space below a short form is correct, not a
   * defect.
   *
   * The clustering the owner originally reported was a SPACING problem, and
   * the scale above fixes it. Centring was treating the symptom in the
   * opposite direction.
   */
  contentContainer: {
    flexGrow: 1,
  },
};

export default AUTH;

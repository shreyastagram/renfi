/**
 * Safe-area edge defaults for <Screen>.
 *
 * Kept in its own dependency-free module for the same reason resolveThemeName
 * and createStyleCache are: Screen.jsx reaches AsyncStorage through the theme
 * context, so importing it in a test needs native mocks. The constant with the
 * actual contract does not need any of that.
 */

export const ALL_EDGES = ['top', 'right', 'bottom', 'left'];

export default ALL_EDGES;

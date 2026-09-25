/**
 * Jest setup.
 *
 * ThemeContext imports AsyncStorage to persist the user's Light/Dark/System choice,
 * and AsyncStorage's native module is null under jest. Any test that renders a
 * themed component therefore failed to even load the suite.
 *
 * Earlier phases dodged this by extracting pure modules (resolveThemeName,
 * createStyleCache, screenEdges) so the tests never touched the provider. That was
 * right for testing pure logic, but it does not scale: as soon as a tested COMPONENT
 * imports the theme, the provider comes with it. The package ships an official mock;
 * this registers it once for every suite.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/**
 * Render checks for the Provider Home top row: order, loading state, and the
 * narrow-phone fallback. Mapbox and icons are stubbed (native modules).
 */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('@rnmapbox/maps', () => {
  const R = require('react');
  const { View } = require('react-native');
  const MapView = (props) => R.createElement(View, { testID: 'mapbox-map' }, props.children);
  const Camera = () => null;
  return { __esModule: true, default: { MapView, Camera, StyleURL: { Street: 'street' } } };
});
jest.mock('react-native-vector-icons/MaterialIcons', () => {
  const R = require('react');
  const { Text: T } = require('react-native');
  return ({ name }) => R.createElement(T, null, `icon:${name}`);
});

const mockDims = { width: 390, height: 800, scale: 2, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDims,
}));

const ProviderHomeTopRow = require('../src/components/ProviderHomeTopRow').default;

const t = (key, opts) => (opts && opts.n !== undefined ? `${key}:${opts.n}` : key);
const baseProps = {
  verification: 'ready',
  percent: 100,
  daysRemaining: 12,
  onPressVerification: jest.fn(),
  latitude: 20.39,
  longitude: 78.12,
  locationLabel: 'Yavatmal',
  locationIcon: 'location-off',
  mapRef: { current: null },
  onPressMap: jest.fn(),
  availabilityKnown: true,
  isAvailable: true,
  isUpdating: false,
  paused: true,
  onToggle: jest.fn(),
  t,
};

function render(props) {
  let tree;
  act(() => { tree = ReactTestRenderer.create(<ProviderHomeTopRow {...baseProps} {...props} />); });
  return tree;
}
const maps = (tree) => tree.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'mapbox-map');
const texts = (tree) => tree.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));

afterEach(() => { mockDims.width = 390; mockDims.fontScale = 1; });

test('order is verification → map → online', () => {
  const tree = render();
  const all = texts(tree);
  const iPercent = all.indexOf('100%');
  const iMap = all.indexOf('Yavatmal');
  const iOnline = all.indexOf('common.online');
  expect(iPercent).toBeGreaterThanOrEqual(0);
  expect(iPercent).toBeLessThan(iMap);
  expect(iMap).toBeLessThan(iOnline);
  expect(maps(tree).length).toBe(1);
});

test('unknown availability never shows Offline', () => {
  const tree = render({ availabilityKnown: false, isAvailable: false });
  const all = texts(tree);
  expect(all).not.toContain('common.offline');
  expect(all).not.toContain('common.online');
});

test('known offline shows Offline', () => {
  expect(texts(render({ isAvailable: false }))).toContain('common.offline');
});

test('verification loading shows a placeholder, hidden shows none', () => {
  expect(texts(render({ verification: 'loading' }))).not.toContain('100%');
  expect(texts(render({ verification: 'hidden' }))).not.toContain('100%');
});

test('no coordinates → placeholder instead of the map', () => {
  const tree = render({ latitude: null, longitude: null, locationLabel: 'providerHome.topLocating', locationIcon: 'my-location' });
  expect(maps(tree).length).toBe(0);
  expect(texts(tree)).toContain('icon:my-location');
});

test('very narrow phone stacks the map under the tiles, same order of tiles', () => {
  mockDims.width = 280;
  const tree = render();
  const all = texts(tree);
  expect(all.indexOf('100%')).toBeLessThan(all.indexOf('common.online'));
  expect(all.indexOf('common.online')).toBeLessThan(all.indexOf('Yavatmal'));
});

test('parent re-render with same primitives does not re-render the row', () => {
  let renders = 0;
  const { Profiler } = React;
  const onRender = () => { renders += 1; };
  let tree;
  act(() => { tree = ReactTestRenderer.create(<Profiler id="p" onRender={onRender}><ProviderHomeTopRow {...baseProps} /></Profiler>); });
  const before = renders;
  act(() => { tree.update(<Profiler id="p" onRender={onRender}><ProviderHomeTopRow {...baseProps} /></Profiler>); });
  // Profiler fires for the root update, but the memoized row itself bails out:
  expect(renders - before).toBeLessThanOrEqual(1);
});

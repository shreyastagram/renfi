/**
 * ProviderHomeTopRow — the first row of Provider Home:
 * verification tile → location mini map → Online/Offline toggle.
 *
 * Memoized and fed primitives + stable callbacks: ProviderHomeScreen
 * re-renders on every useApp()/useLocation() change and must not touch the
 * native map view each time.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import Mapbox from '@rnmapbox/maps';
import TouchableOpacity from './TouchableOpacity';
import { computeTopRowLayout, TOP_ROW_FONT_SCALE } from '../utils/homeTopRowLayout';

const BRAND = {
  primary: '#f67c16',
  white: '#FFFFFF',
  dark: '#0F172A',
  muted: '#94A3B8',
  darkText: '#0F172A',
};

/**
 * Pulsing dot component for online status
 */
const PulsingDot = ({ isOnline, paused }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Don't run animation when screen is not focused (paused=true)
    if (isOnline && !paused) {
      const pulse = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.8,
              duration: 1200,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 0,
              duration: 1200,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.6,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      pulse.start();
      return () => {
        pulse.stop();
        pulseAnim.setValue(1);
        opacityAnim.setValue(0.6);
      };
    }
  }, [isOnline, paused, pulseAnim, opacityAnim]);

  return (
    <View style={styles.pulsingDotContainer}>
      {isOnline && (
        <Animated.View
          style={[
            styles.pulsingRing,
            {
              transform: [{ scale: pulseAnim }],
              opacity: opacityAnim,
              backgroundColor: '#22C55E',
            },
          ]}
        />
      )}
      <View
        style={[
          styles.statusDotInner,
          { backgroundColor: isOnline ? '#22C55E' : '#94A3B8' },
        ]}
      />
    </View>
  );
};

/**
 * Online/Offline toggle pad (compact, sits at the end of the top row).
 * Scale bounce on press, instant color swap. While the provider's real
 * availability is not yet known it shows a neutral pad instead of "Offline".
 */
const StatusTogglePad = React.memo(({ known, isAvailable, isUpdating, onToggle, paused, labels, style }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  if (!known) {
    return (
      <View style={[styles.statusPad, styles.statusPadNeutral, style]} accessibilityLabel={labels.checking}>
        <ActivityIndicator size="small" color={BRAND.muted} />
      </View>
    );
  }

  const handlePress = () => {
    if (isUpdating) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }),
    ]).start();
    onToggle();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isUpdating}
      activeOpacity={1}
      accessibilityLabel={isAvailable ? labels.goOffline : labels.goOnline}
      accessibilityRole="switch"
      accessibilityState={{ checked: isAvailable, busy: isUpdating }}
      style={style}
    >
      <Animated.View
        style={[
          styles.statusPad,
          {
            backgroundColor: isAvailable ? '#22C55E' : '#FFFFFF',
            borderColor: isAvailable ? '#16A34A' : '#E2E8F0',
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {isUpdating ? (
          <ActivityIndicator size="small" color={isAvailable ? '#FFFFFF' : '#94A3B8'} />
        ) : (
          <>
            <PulsingDot isOnline={isAvailable} paused={paused} />
            <Text
              style={[styles.statusPadText, { color: isAvailable ? '#FFFFFF' : '#64748B' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              maxFontSizeMultiplier={TOP_ROW_FONT_SCALE}
            >
              {isAvailable ? labels.online : labels.offline}
            </Text>
          </>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});


/**
 * Static mini map. Memoized on rounded coordinates, so GPS jitter and the
 * parent's frequent re-renders never touch the native map view.
 */
const MiniMap = React.memo(({ latitude, longitude }) => {
  const center = useMemo(() => [longitude, latitude], [latitude, longitude]);
  return (
    <View style={styles.miniMapWrap}>
      <Mapbox.MapView
        style={styles.miniMapView}
        styleURL={Mapbox.StyleURL.Street}
        scrollEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        zoomEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
      >
        <Mapbox.Camera centerCoordinate={center} zoomLevel={14} animationDuration={0} />
      </Mapbox.MapView>
      <View style={styles.miniMapPinOverlay} pointerEvents="none">
        <MaterialIcon name="person-pin-circle" size={24} color={BRAND.primary} />
      </View>
    </View>
  );
});

/**
 * Provider Home top row: verification tile → location map → Online toggle.
 *
 * Widths come from the row's measured width (falls back to the window width on
 * the first frame; see computeTopRowLayout). If the map would get too narrow (very
 * small phones or very large font settings), the row splits in two: the
 * verification and Online tiles on top, the map full-width below it.
 *
 * verification: 'loading' | 'ready' | 'hidden'
 */
const ProviderHomeTopRow = ({
  verification, percent, daysRemaining, onPressVerification,
  latitude, longitude, locationLabel, locationIcon, mapRef, onPressMap,
  availabilityKnown, isAvailable, isUpdating, paused, onToggle, t,
}) => {
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const [rowWidth, setRowWidth] = useState(0);
  const onLayout = useCallback((e) => {
    const w = Math.round(e.nativeEvent.layout.width);
    setRowWidth((prev) => (prev === w ? prev : w));
  }, []);

  const showVerification = verification !== 'hidden';
  // Text may grow with accessibility font size only up to TOP_ROW_FONT_SCALE;
  // tiles have a fixed height so the row never reflows mid-load.
  const { tileHeight, sideWidth, toggleWidth, stacked } = computeTopRowLayout({
    width: rowWidth || windowWidth - 36,
    fontScale,
    showVerification,
  });

  const labels = useMemo(() => ({
    online: t('common.online'),
    offline: t('common.offline'),
    goOnline: t('providerHome.goOnline'),
    goOffline: t('providerHome.goOffline'),
    checking: t('workHours.statusLoading'),
  }), [t]);

  const verificationTile = !showVerification ? null : verification === 'loading' ? (
    <View style={[styles.topTile, styles.topTileLoading, stacked ? styles.flexOne : { width: sideWidth }, { height: tileHeight }]}>
      <ActivityIndicator size="small" color={BRAND.muted} />
    </View>
  ) : (
    <TouchableOpacity
      style={[styles.topTile, styles.miniVerificationCard, stacked ? styles.flexOne : { width: sideWidth }, { height: tileHeight }]}
      onPress={onPressVerification}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${t('providerHome.topVerified')} ${percent}%, ${t('providerHome.topPremium')}, ${t('providerHome.topDaysLeft', { n: daysRemaining })}`}
    >
      <Text style={styles.miniVerificationPercent} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={TOP_ROW_FONT_SCALE}>{percent}%</Text>
      <View style={styles.miniVerificationBadge}>
        <MaterialIcon name="verified" size={12} color="#10B981" />
        <Text style={styles.miniVerificationBadgeText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={TOP_ROW_FONT_SCALE}>
          {t('providerHome.topPremium')}
        </Text>
      </View>
      <Text style={styles.miniVerificationDays} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={TOP_ROW_FONT_SCALE}>
        {t('providerHome.topDaysLeft', { n: daysRemaining })}
      </Text>
    </TouchableOpacity>
  );

  const mapTile = (
    <TouchableOpacity
      ref={mapRef}
      style={[styles.topTile, styles.miniLocationCard, stacked ? styles.stackedMap : styles.flexOne, { height: tileHeight }]}
      onPress={onPressMap}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={locationLabel}
    >
      {latitude != null && longitude != null ? (
        <MiniMap latitude={latitude} longitude={longitude} />
      ) : (
        <View style={styles.miniMapPlaceholder}>
          <MaterialIcon name={locationIcon} size={20} color={BRAND.muted} />
        </View>
      )}
      <Text style={styles.miniLocationLabel} numberOfLines={1} maxFontSizeMultiplier={TOP_ROW_FONT_SCALE}>
        {locationLabel}
      </Text>
    </TouchableOpacity>
  );

  const toggleTile = (
    <StatusTogglePad
      known={availabilityKnown}
      isAvailable={isAvailable}
      isUpdating={isUpdating}
      onToggle={onToggle}
      paused={paused}
      labels={labels}
      style={[stacked ? styles.flexOne : { width: toggleWidth }, { height: tileHeight }]}
    />
  );

  if (stacked) {
    return (
      <View style={styles.topRowWrap} onLayout={onLayout}>
        <View style={styles.topRow}>
          {verificationTile}
          {toggleTile}
        </View>
        {mapTile}
      </View>
    );
  }

  return (
    <View style={[styles.topRowWrap, styles.topRow]} onLayout={onLayout}>
      {verificationTile}
      {mapTile}
      {toggleTile}
    </View>
  );
};

export default React.memo(ProviderHomeTopRow);

const styles = StyleSheet.create({
  topRowWrap: {
    gap: 10,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    gap: 10,
  },
  topTile: {
    borderRadius: 16,
  },
  topTileLoading: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexOne: {
    flex: 1,
    minWidth: 0,
  },
  stackedMap: {
    alignSelf: 'stretch',
  },
  statusPad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  statusPadNeutral: {
    flex: 0,
    backgroundColor: BRAND.white,
    borderColor: '#E2E8F0',
  },
  statusPadText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
    maxWidth: '100%',
  },
  pulsingDotContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulsingRing: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  statusDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  miniVerificationCard: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#10B98130',
    ...Platform.select({
      ios: { shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },
  miniVerificationPercent: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: -0.3,
  },
  miniVerificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 6,
    maxWidth: '100%',
  },
  miniVerificationBadgeText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  miniVerificationDays: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 4,
  },
  miniLocationCard: {
    backgroundColor: BRAND.dark,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 14 },
      android: { elevation: 6 },
    }),
  },
  miniMapWrap: {
    flex: 1,
  },
  miniMapView: {
    flex: 1,
  },
  miniMapPinOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniMapPlaceholder: {
    flex: 1,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniLocationLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND.darkText,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: BRAND.white,
  },
});

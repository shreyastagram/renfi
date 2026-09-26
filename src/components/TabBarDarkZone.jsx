/**
 * TabBarDarkZone — wrap any DARK surface that can scroll under the floating
 * tab bar. The bar's material flips to its dark variant (smoked glass,
 * white labels) while this zone covers it, mirroring iOS Liquid Glass's
 * automatic light/dark adaptation.
 *
 *   <TabBarDarkZone>
 *     <View style={styles.darkPremiumCard}>…</View>
 *   </TabBarDarkZone>
 *
 * Implementation: measures itself in window coords on a short interval
 * while mounted (a single lightweight UIManager call — no ScrollView
 * wiring, works with any scroll container on both platforms) and reports
 * its coverage fraction of the bar. Screens without zones cost nothing.
 *
 * The poll is GATED on focus and foreground. Seven screens use a zone, and an
 * ungated 150ms timer per zone is a native round trip about seven times a
 * second, for the whole session, including while the screen sits behind
 * another one or the app is in the background. That is invisible on a current
 * handset and is exactly the kind of idle cost that hurts the older devices
 * most providers are on. A zone that is not on screen cannot be covering the
 * bar, so there is nothing to measure — it reports 0 and stops.
 */

import React, { useEffect, useRef } from 'react';
import { View, AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { getBarRect, setZoneFraction, clearZone } from './tabBarTone';

let zoneCounter = 0;

const TabBarDarkZone = ({ children, style }) => {
  const ref = useRef(null);
  const idRef = useRef(`zone_${++zoneCounter}`);
  const isFocused = useIsFocused();

  useEffect(() => {
    const id = idRef.current;

    if (!isFocused) {
      // Off screen: it cannot be covering the bar, so say so and stop paying.
      setZoneFraction(id, 0);
      return undefined;
    }

    let timer = null;
    const measure = () => {
      const bar = getBarRect();
      const node = ref.current;
      if (!bar || !node) return;
      node.measureInWindow((x, y, w, h) => {
        if (typeof y !== 'number' || typeof h !== 'number') return;
        const overlap = Math.max(0, Math.min(y + h, bar.bottom) - Math.max(y, bar.top));
        setZoneFraction(id, overlap / Math.max(bar.bottom - bar.top, 1));
      });
    };
    const start = () => {
      if (timer) return;
      measure();                       // don't wait 150ms for the first reading
      timer = setInterval(measure, 150);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') start();
      else stop();
    });

    return () => {
      stop();
      sub.remove();
      clearZone(id);
    };
  }, [isFocused]);

  // collapsable={false} keeps the native view alive for measureInWindow (Android)
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
};

export default TabBarDarkZone;

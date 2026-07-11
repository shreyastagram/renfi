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
 */

import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { getBarRect, setZoneFraction, clearZone } from './tabBarTone';

let zoneCounter = 0;

const TabBarDarkZone = ({ children, style }) => {
  const ref = useRef(null);
  const idRef = useRef(`zone_${++zoneCounter}`);

  useEffect(() => {
    const id = idRef.current;
    const timer = setInterval(() => {
      const bar = getBarRect();
      const node = ref.current;
      if (!bar || !node) return;
      node.measureInWindow((x, y, w, h) => {
        if (typeof y !== 'number' || typeof h !== 'number') return;
        const overlap = Math.max(0, Math.min(y + h, bar.bottom) - Math.max(y, bar.top));
        setZoneFraction(id, overlap / Math.max(bar.bottom - bar.top, 1));
      });
    }, 150);
    return () => {
      clearInterval(timer);
      clearZone(id);
    };
  }, []);

  // collapsable={false} keeps the native view alive for measureInWindow (Android)
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
};

export default TabBarDarkZone;

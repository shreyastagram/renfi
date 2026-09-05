/**
 * HelpSupportButton — a support-agent icon that opens the shared, iconized
 * Help & Support bottom-sheet (SupportSheet). Self-contained: pulls userType
 * from context and the opener from SupportContext, so each placement is a
 * one-liner and every screen shows the identical sheet.
 *
 * color defaults to the Fixhomi brand orange; pass a light color on
 * coloured/orange headers where orange wouldn't read.
 */
import React from 'react';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import TouchableOpacity from './TouchableOpacity';
import { useApp } from '../context/AppContext';
import { useSupport } from '../context/SupportContext';

const BRAND_ORANGE = '#f67c16';

const HelpSupportButton = ({ size = 24, color = BRAND_ORANGE, style }) => {
  const { userType } = useApp();
  const { openSupport } = useSupport();

  return (
    <TouchableOpacity
      onPress={() => openSupport(userType)}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Help and support"
      style={style}
    >
      <MaterialIcon name="support-agent" size={size} color={color} />
    </TouchableOpacity>
  );
};

export default React.memo(HelpSupportButton);

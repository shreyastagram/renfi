/**
 * HelpSupportButton — a support-agent icon that opens the shared, iconized
 * Help & Support bottom-sheet (SupportSheet). Self-contained: pulls userType
 * from context and the opener from SupportContext, so each placement is a
 * one-liner and every screen shows the identical sheet.
 *
 * ON THE COLOUR
 *
 * Brand orange is 2.69:1 on the white circular button this sits in — under the
 * 3:1 WCAG 1.4.11 requires of the parts of a control you need to see to identify
 * it. The default is now `brandOrangeInk`, which deepens to #C2610B in light
 * (4.19:1) and stays true brand orange in dark, where it is already 7.17:1.
 *
 * Deliberately NOT a filled chip. On UserHomeScreen this button and the address
 * button share one style and read as a matched pair; filling one of them would
 * break that pair to fix a number, and the deepened glyph fixes it without
 * touching the layout.
 *
 * Pass `color` on coloured/dark headers where neither orange reads — the
 * provider hero does, with white.
 */
import React from 'react';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import TouchableOpacity from './TouchableOpacity';
import { useApp } from '../context/AppContext';
import { useSupport } from '../context/SupportContext';
import { useThemeColors } from '../theme';

const HelpSupportButton = ({ size = 24, color, style }) => {
  const { userType } = useApp();
  const { openSupport } = useSupport();
  const colors = useThemeColors();

  return (
    <TouchableOpacity
      onPress={() => openSupport(userType)}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Help and support"
      style={style}
    >
      <MaterialIcon
        name="support-agent"
        size={size}
        color={color || colors.brandOrangeInk}
      />
    </TouchableOpacity>
  );
};

export default React.memo(HelpSupportButton);

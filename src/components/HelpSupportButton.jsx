/**
 * HelpSupportButton — a support-agent icon that opens the shared Help &
 * Support dialog (same one as Settings). Self-contained: pulls dialog +
 * userType from context, so each placement is a one-liner.
 *
 * color defaults to the Fixhomi brand orange; pass a light color on
 * coloured/orange headers where orange wouldn't read.
 */
import React from 'react';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import TouchableOpacity from './TouchableOpacity';
import { useDialog } from '../context/DialogContext';
import { useApp } from '../context/AppContext';
import { showHelpSupport } from '../utils/helpSupport';

const BRAND_ORANGE = '#f67c16';

const HelpSupportButton = ({ size = 24, color = BRAND_ORANGE, style }) => {
  const { dialog } = useDialog();
  const { userType } = useApp();

  return (
    <TouchableOpacity
      onPress={() => showHelpSupport(dialog, userType)}
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

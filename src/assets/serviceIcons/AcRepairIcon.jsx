import React from 'react';
import Svg, { G, Path, Rect, Circle, Line } from 'react-native-svg';

const AcRepairIcon = ({ size = 52 }) => (
  <Svg viewBox="0 0 200 200" width={size} height={size}>

    {/* WALL BACKGROUND */}
    <Rect x="8" y="8" width="184" height="184" rx="10" fill="#EFEBE9" stroke="#455A64" strokeWidth="2" />
    <G stroke="#D7CCC8" strokeWidth="0.8" opacity="0.4">
      <Line x1="8" y1="70" x2="192" y2="70" />
      <Line x1="8" y1="132" x2="192" y2="132" />
    </G>

    {/* AC UNIT */}
    <Rect x="26" y="38" width="152" height="56" rx="10" fill="#455A64" opacity="0.1" />
    <Rect x="22" y="32" width="156" height="56" rx="10" fill="#F5F5F5" stroke="#455A64" strokeWidth="2.5" />
    <Rect x="22" y="32" width="156" height="20" rx="10" fill="#EEEEEE" stroke="#455A64" strokeWidth="2.5" />
    <Line x1="22" y1="52" x2="178" y2="52" stroke="#455A64" strokeWidth="2" />

    {/* Brand area */}
    <Rect x="82" y="38" width="36" height="8" rx="3" fill="#E0E0E0" stroke="#BDBDBD" strokeWidth="0.8" />
    <Line x1="88" y1="42" x2="112" y2="42" stroke="#BDBDBD" strokeWidth="1.5" strokeLinecap="round" />

    {/* LED */}
    <Circle cx="164" cy="42" r="3" fill="#4CAF50" stroke="#455A64" strokeWidth="1" />
    <Circle cx="164" cy="42" r="5" fill="#4CAF50" opacity="0.15" />

    {/* Air vent louvers */}
    <G>
      <Path d="M30,76 L170,76 L174,88 Q176,92 170,92 L30,92 Q24,92 26,88 Z" fill="#E0E0E0" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
      <G stroke="#BDBDBD" strokeWidth="1.5">
        <Line x1="34" y1="80" x2="166" y2="80" />
        <Line x1="36" y1="84" x2="168" y2="84" />
        <Line x1="38" y1="88" x2="170" y2="88" />
      </G>
      <Line x1="34" y1="78" x2="166" y2="78" stroke="white" strokeWidth="1" opacity="0.3" />
    </G>

    {/* Side vents */}
    <G stroke="#D0D0D0" strokeWidth="1" opacity="0.5">
      <Line x1="26" y1="56" x2="26" y2="74" />
      <Line x1="174" y1="56" x2="174" y2="74" />
    </G>

    {/* Unit shine */}
    <Path d="M30,36 L168,36" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.3" />

    {/* COLD AIR FLOW */}
    <G fill="none" stroke="#42A5F5" strokeWidth="2" strokeLinecap="round" opacity="0.5">
      <Path d="M50,94 Q46,106 50,118 Q54,130 50,140" />
      <Path d="M75,94 Q71,108 75,122 Q79,134 75,146" />
      <Path d="M100,94 Q96,110 100,126 Q104,138 100,150" />
      <Path d="M125,94 Q121,108 125,122 Q129,134 125,146" />
      <Path d="M150,94 Q146,106 150,118 Q154,130 150,140" />
    </G>

    {/* Snowflake 1 */}
    <G stroke="#42A5F5" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" translate="62,118">
      <Line x1="0" y1="-5" x2="0" y2="5" />
      <Line x1="-4.3" y1="-2.5" x2="4.3" y2="2.5" />
      <Line x1="-4.3" y1="2.5" x2="4.3" y2="-2.5" />
      <Line x1="0" y1="-5" x2="-1.5" y2="-3.5" />
      <Line x1="0" y1="-5" x2="1.5" y2="-3.5" />
      <Line x1="0" y1="5" x2="-1.5" y2="3.5" />
      <Line x1="0" y1="5" x2="1.5" y2="3.5" />
    </G>

    {/* Snowflake 2 */}
    <G stroke="#42A5F5" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" translate="112,130">
      <Line x1="0" y1="-4" x2="0" y2="4" />
      <Line x1="-3.5" y1="-2" x2="3.5" y2="2" />
      <Line x1="-3.5" y1="2" x2="3.5" y2="-2" />
      <Line x1="0" y1="-4" x2="-1.2" y2="-2.8" />
      <Line x1="0" y1="-4" x2="1.2" y2="-2.8" />
      <Line x1="0" y1="4" x2="-1.2" y2="2.8" />
      <Line x1="0" y1="4" x2="1.2" y2="2.8" />
    </G>

    {/* Snowflake 3 */}
    <G stroke="#42A5F5" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" translate="140,112">
      <Line x1="0" y1="-3.5" x2="0" y2="3.5" />
      <Line x1="-3" y1="-1.8" x2="3" y2="1.8" />
      <Line x1="-3" y1="1.8" x2="3" y2="-1.8" />
    </G>

    {/* PIPE */}
    <Path d="M174,64 L186,64 L186,192" fill="none" stroke="#BDBDBD" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M174,64 L186,64 L186,192" fill="none" stroke="#E0E0E0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />

    {/* Pipe brackets */}
    <Rect x="182" y="100" width="8" height="6" rx="1" fill="#9E9E9E" stroke="#455A64" strokeWidth="1.2" />
    <Rect x="182" y="140" width="8" height="6" rx="1" fill="#9E9E9E" stroke="#455A64" strokeWidth="1.2" />
  </Svg>
);

export default AcRepairIcon;

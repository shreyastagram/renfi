import React from 'react';
import Svg, { G, Path, Rect, Circle, Ellipse, Line } from 'react-native-svg';

const MortuaryVanIcon = ({ size = 52 }) => (
  <Svg viewBox="0 0 200 200" width={size} height={size}>
    {/* Ground */}
    <Line x1="4" y1="162" x2="196" y2="162" stroke="#455A64" strokeWidth="2" />
    <Ellipse cx="100" cy="164" rx="78" ry="3.5" fill="#455A64" opacity="0.07" />

    {/* Van body */}
    <Path d="M10,72 L10,148 Q10,154 16,154 L34,154 Q34,144 46,144 Q58,144 58,154 L134,154 Q134,144 146,144 Q158,144 158,154 L176,154 Q182,154 182,148 L182,72 Q182,66 176,66 L16,66 Q10,66 10,72 Z" fill="#37474F" stroke="#455A64" strokeWidth="2.5" strokeLinejoin="round" />

    {/* Cab section */}
    <Path d="M148,66 L182,66 Q190,66 192,72 L196,92 Q198,98 194,102 L182,102 L182,66" fill="#2E3B42" stroke="#455A64" strokeWidth="2.5" strokeLinejoin="round" />

    {/* Windshield */}
    <Path d="M184,70 L194,92 Q196,96 192,98 L184,98 Z" fill="#546E7A" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
    <Path d="M186,74 L192,90" stroke="#78909C" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />

    {/* Cab window */}
    <Rect x="158" y="72" width="20" height="16" rx="3" fill="#546E7A" stroke="#455A64" strokeWidth="1.5" />
    <Rect x="160" y="74" width="8" height="5" rx="1" fill="#78909C" opacity="0.15" />

    {/* Headlight */}
    <Rect x="194" y="100" width="4" height="7" rx="2" fill="#FFF9C4" stroke="#455A64" strokeWidth="1.2" />

    {/* Body details */}
    <Line x1="10" y1="102" x2="182" y2="102" stroke="#546E7A" strokeWidth="1.5" opacity="0.4" />
    <Line x1="10" y1="66" x2="10" y2="154" stroke="#455A64" strokeWidth="2.5" />
    <Line x1="10" y1="110" x2="28" y2="110" stroke="#546E7A" strokeWidth="1.2" />
    <Rect x="14" y="116" width="7" height="3" rx="1.5" fill="#607D8B" stroke="#455A64" strokeWidth="1" />
    <Line x1="148" y1="66" x2="148" y2="102" stroke="#546E7A" strokeWidth="1.2" opacity="0.4" />

    {/* Front bumper */}
    <Path d="M182,142 L198,142 L198,150 Q198,154 194,154 L182,154 Z" fill="#546E7A" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />

    {/* MORTUARY text */}
    <G fill="none" stroke="#90A4AE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M36,82 L36,96 M36,82 L42,90 L48,82 L48,96" />
      <Ellipse cx="56" cy="89" rx="5" ry="7" />
      <Path d="M64,96 L64,82 L70,82 Q74,82 74,86 Q74,89 70,89 L64,89 L74,96" />
      <Path d="M78,82 L88,82 M83,82 L83,96" />
      <Path d="M92,82 L92,92 Q92,96 97,96 Q102,96 102,92 L102,82" />
      <Path d="M106,96 L112,82 L118,96 M108.5,91 L115.5,91" />
      <Path d="M122,96 L122,82 L128,82 Q132,82 132,86 Q132,89 128,89 L122,89 L132,96" />
      <Path d="M136,82 L140,89 L144,82 M140,89 L140,96" />
    </G>

    {/* Cross symbol */}
    <Rect x="80" y="108" width="5" height="14" rx="1" fill="#607D8B" />
    <Rect x="76" y="112" width="14" height="5" rx="1" fill="#607D8B" />

    {/* Body stripe */}
    <Rect x="10" y="134" width="172" height="3" fill="#546E7A" opacity="0.3" />

    {/* Rear wheel */}
    <Circle cx="46" cy="154" r="13" fill="#1A1A1A" stroke="#455A64" strokeWidth="2" />
    <Circle cx="46" cy="154" r="8.5" fill="#616161" />
    <G stroke="#4A4A4A" strokeWidth="1.8" strokeLinecap="round">
      <Line x1="46" y1="147" x2="46" y2="149.5" />
      <Line x1="52" y1="151.5" x2="50.5" y2="152.5" />
      <Line x1="50.5" y1="159" x2="49" y2="157.5" />
      <Line x1="41.5" y1="159" x2="43" y2="157.5" />
      <Line x1="40" y1="151.5" x2="41.5" y2="152.5" />
    </G>
    <Circle cx="46" cy="154" r="3" fill="#888" />
    <Circle cx="46" cy="154" r="1" fill="#AAA" />

    {/* Front wheel */}
    <Circle cx="146" cy="154" r="13" fill="#1A1A1A" stroke="#455A64" strokeWidth="2" />
    <Circle cx="146" cy="154" r="8.5" fill="#616161" />
    <G stroke="#4A4A4A" strokeWidth="1.8" strokeLinecap="round">
      <Line x1="146" y1="147" x2="146" y2="149.5" />
      <Line x1="152" y1="151.5" x2="150.5" y2="152.5" />
      <Line x1="150.5" y1="159" x2="149" y2="157.5" />
      <Line x1="141.5" y1="159" x2="143" y2="157.5" />
      <Line x1="140" y1="151.5" x2="141.5" y2="152.5" />
    </G>
    <Circle cx="146" cy="154" r="3" fill="#888" />
    <Circle cx="146" cy="154" r="1" fill="#AAA" />
  </Svg>
);

export default MortuaryVanIcon;

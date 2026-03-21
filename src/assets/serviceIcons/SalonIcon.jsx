import React from 'react';
import Svg, { Defs, LinearGradient, Stop, G, Path, Rect, Circle, Line } from 'react-native-svg';

const SalonIcon = ({ size = 52 }) => (
  <Svg viewBox="0 0 200 200" width={size} height={size}>
    <Defs>
      <LinearGradient id="combG" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#D4A76A" />
        <Stop offset="50%" stopColor="#B8894E" />
        <Stop offset="100%" stopColor="#9C7040" />
      </LinearGradient>
      <LinearGradient id="bladeG" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0%" stopColor="#7EA8D4" />
        <Stop offset="30%" stopColor="#A4C4E4" />
        <Stop offset="50%" stopColor="#C0D8F4" />
        <Stop offset="70%" stopColor="#A4C4E4" />
        <Stop offset="100%" stopColor="#7EA8D4" />
      </LinearGradient>
      <LinearGradient id="ringG" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#6B94C4" />
        <Stop offset="50%" stopColor="#92B8E0" />
        <Stop offset="100%" stopColor="#6B94C4" />
      </LinearGradient>
    </Defs>

    {/* COMB */}
    <G transform="rotate(-30, 95, 60)">
      <Rect x="20" y="38" width="150" height="18" rx="4" fill="url(#combG)" stroke="#7A5830" strokeWidth="1" />
      <Line x1="28" y1="42" x2="162" y2="42" stroke="#DEB87A" strokeWidth="1.2" opacity="0.4" strokeLinecap="round" />
      <Rect x="28" y="56" width="8" height="30" rx="2.5" fill="url(#combG)" stroke="#7A5830" strokeWidth="0.6" />
      <Rect x="41" y="56" width="8" height="30" rx="2.5" fill="url(#combG)" stroke="#7A5830" strokeWidth="0.6" />
      <Rect x="54" y="56" width="8" height="30" rx="2.5" fill="url(#combG)" stroke="#7A5830" strokeWidth="0.6" />
      <Rect x="67" y="56" width="8" height="30" rx="2.5" fill="url(#combG)" stroke="#7A5830" strokeWidth="0.6" />
      <Rect x="80" y="56" width="8" height="30" rx="2.5" fill="url(#combG)" stroke="#7A5830" strokeWidth="0.6" />
      <Rect x="93" y="56" width="8" height="30" rx="2.5" fill="url(#combG)" stroke="#7A5830" strokeWidth="0.6" />
      <Rect x="106" y="56" width="8" height="30" rx="2.5" fill="url(#combG)" stroke="#7A5830" strokeWidth="0.6" />
      <Rect x="119" y="56" width="8" height="30" rx="2.5" fill="url(#combG)" stroke="#7A5830" strokeWidth="0.6" />
      <Rect x="132" y="56" width="8" height="30" rx="2.5" fill="url(#combG)" stroke="#7A5830" strokeWidth="0.6" />
      <Rect x="145" y="56" width="8" height="30" rx="2.5" fill="url(#combG)" stroke="#7A5830" strokeWidth="0.6" />
      <Rect x="158" y="56" width="8" height="30" rx="2.5" fill="url(#combG)" stroke="#7A5830" strokeWidth="0.6" />
    </G>

    {/* SCISSORS */}
    <G>
      {/* TOP HALF */}
      <G>
        <Path d="M108,134 L110,130 L170,100 Q176,98 176,102 L112,134 Z" fill="url(#bladeG)" stroke="#5A80B4" strokeWidth="0.8" />
        <Line x1="114" y1="131" x2="172" y2="101" stroke="#C8DDF0" strokeWidth="1" opacity="0.35" strokeLinecap="round" />
        <Path d="M108,134 L106,130 L80,118 Q72,114 72,122 Q72,130 80,132 L106,134" fill="url(#ringG)" stroke="#5A80B4" strokeWidth="1" />
        <Circle cx="74" cy="122" r="10" fill="none" stroke="#5A80B4" strokeWidth="3.5" />
        <Circle cx="74" cy="122" r="10" fill="#7EA8D4" opacity="0.1" />
        <Circle cx="74" cy="122" r="6.5" fill="none" stroke="#5A80B4" strokeWidth="0.5" opacity="0.3" />
      </G>

      {/* BOTTOM HALF (mirror) */}
      <G transform="scale(1,-1) translate(0,-268)">
        <Path d="M108,134 L110,130 L170,100 Q176,98 176,102 L112,134 Z" fill="url(#bladeG)" stroke="#5A80B4" strokeWidth="0.8" />
        <Line x1="114" y1="131" x2="172" y2="101" stroke="#C8DDF0" strokeWidth="1" opacity="0.35" strokeLinecap="round" />
        <Path d="M108,134 L106,130 L80,118 Q72,114 72,122 Q72,130 80,132 L106,134" fill="url(#ringG)" stroke="#5A80B4" strokeWidth="1" />
        <Circle cx="74" cy="122" r="10" fill="none" stroke="#5A80B4" strokeWidth="3.5" />
        <Circle cx="74" cy="122" r="10" fill="#7EA8D4" opacity="0.1" />
        <Circle cx="74" cy="122" r="6.5" fill="none" stroke="#5A80B4" strokeWidth="0.5" opacity="0.3" />
      </G>

      {/* Pivot screw */}
      <Circle cx="108" cy="134" r="5" fill="#92B8E0" stroke="#5A80B4" strokeWidth="1.2" />
      <Circle cx="107" cy="133" r="1.8" fill="#C0D8F4" opacity="0.6" />
    </G>
  </Svg>
);

export default SalonIcon;

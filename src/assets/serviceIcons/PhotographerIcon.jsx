import React from 'react';
import Svg, { G, Path, Rect, Circle, Ellipse, Line } from 'react-native-svg';

const PhotographerIcon = ({ size = 52 }) => (
  <Svg viewBox="0 0 200 200" width={size} height={size}>
    <Line x1="4" y1="192" x2="196" y2="192" stroke="#455A64" strokeWidth="2" />

    {/* CAMERA ON TRIPOD */}
    <Line x1="72" y1="138" x2="40" y2="192" stroke="#455A64" strokeWidth="4" strokeLinecap="round" />
    <Line x1="72" y1="138" x2="72" y2="192" stroke="#455A64" strokeWidth="4" strokeLinecap="round" />
    <Line x1="72" y1="138" x2="104" y2="192" stroke="#455A64" strokeWidth="4" strokeLinecap="round" />
    <Line x1="72" y1="138" x2="40" y2="192" stroke="#616161" strokeWidth="2.5" strokeLinecap="round" />
    <Line x1="72" y1="138" x2="72" y2="192" stroke="#616161" strokeWidth="2.5" strokeLinecap="round" />
    <Line x1="72" y1="138" x2="104" y2="192" stroke="#616161" strokeWidth="2.5" strokeLinecap="round" />
    <Circle cx="40" cy="192" r="2.5" fill="#455A64" />
    <Circle cx="72" cy="192" r="2.5" fill="#455A64" />
    <Circle cx="104" cy="192" r="2.5" fill="#455A64" />
    <Line x1="50" y1="174" x2="94" y2="174" stroke="#455A64" strokeWidth="2.5" strokeLinecap="round" />
    <Rect x="68" y="102" width="8" height="38" rx="2" fill="#455A64" stroke="#37474F" strokeWidth="1" />
    <Line x1="70" y1="106" x2="70" y2="136" stroke="#546E7A" strokeWidth="1.2" opacity="0.4" strokeLinecap="round" />
    <Circle cx="80" cy="126" r="3.5" fill="#455A64" stroke="#37474F" strokeWidth="1" />
    <Rect x="60" y="96" width="24" height="10" rx="3" fill="#37474F" stroke="#455A64" strokeWidth="1.5" />
    <Line x1="84" y1="100" x2="96" y2="96" stroke="#455A64" strokeWidth="3" strokeLinecap="round" />
    <Circle cx="96" cy="96" r="2.5" fill="#455A64" />
    <Rect x="62" y="92" width="20" height="6" rx="1.5" fill="#455A64" stroke="#37474F" strokeWidth="1" />

    {/* Camera body */}
    <Rect x="46" y="56" width="52" height="36" rx="5" fill="#1A1A1A" stroke="#455A64" strokeWidth="2.5" />
    <Rect x="46" y="56" width="52" height="10" rx="5" fill="#2A2A2A" stroke="#455A64" strokeWidth="2" />
    <Rect x="70" y="46" width="20" height="14" rx="3" fill="#1A1A1A" stroke="#455A64" strokeWidth="2" />
    <Rect x="86" y="50" width="6" height="8" rx="2" fill="#37474F" stroke="#455A64" strokeWidth="1.2" />
    <Rect x="60" y="50" width="12" height="4" rx="1" fill="#37474F" stroke="#455A64" strokeWidth="1" />

    {/* Flash */}
    <Rect x="56" y="24" width="20" height="26" rx="3" fill="#1A1A1A" stroke="#455A64" strokeWidth="2" />
    <Rect x="54" y="18" width="24" height="10" rx="2" fill="#2A2A2A" stroke="#455A64" strokeWidth="2" />
    <Rect x="58" y="20" width="16" height="6" rx="1" fill="#FFF9C4" stroke="#FFB300" strokeWidth="0.8" opacity="0.7" />
    <Rect x="58" y="20" width="16" height="6" rx="1" fill="#FFF9C4" opacity="0.15" />

    <Circle cx="56" cy="54" r="4.5" fill="#2A2A2A" stroke="#455A64" strokeWidth="1.2" />
    <Line x1="56" y1="50" x2="56" y2="52" stroke="#888" strokeWidth="1" strokeLinecap="round" />
    <Circle cx="56" cy="48" r="3" fill="#37474F" stroke="#455A64" strokeWidth="1.2" />
    <Circle cx="56" cy="48" r="1.5" fill="#546E7A" />

    <Rect x="46" y="62" width="10" height="26" rx="3" fill="#2A2A2A" stroke="#37474F" strokeWidth="0.8" />
    <G stroke="#333" strokeWidth="0.7" opacity="0.4">
      <Line x1="48" y1="66" x2="54" y2="66" />
      <Line x1="48" y1="70" x2="54" y2="70" />
      <Line x1="48" y1="74" x2="54" y2="74" />
      <Line x1="48" y1="78" x2="54" y2="78" />
      <Line x1="48" y1="82" x2="54" y2="82" />
    </G>

    {/* Lens */}
    <Circle cx="72" cy="76" r="14" fill="#2A2A2A" stroke="#455A64" strokeWidth="2.5" />
    <Circle cx="72" cy="76" r="11" fill="#0D1B2A" stroke="#1A1A1A" strokeWidth="1" />
    <Circle cx="72" cy="76" r="7.5" fill="none" stroke="#1A2A3A" strokeWidth="0.6" opacity="0.5" />
    <Circle cx="72" cy="76" r="3" fill="#050A14" />
    <Ellipse cx="68" cy="72" rx="3.5" ry="2.5" fill="#42A5F5" opacity="0.12" />
    <Ellipse cx="67" cy="71" rx="1.5" ry="1" fill="white" opacity="0.15" />

    {/* MAN */}
    {/* Legs */}
    <Path d="M140,140 L136,180 Q136,186 140,186 L146,186 Q148,186 148,182 L146,140 Z" fill="#455A64" stroke="#37474F" strokeWidth="2" strokeLinejoin="round" />
    <Path d="M154,140 L152,180 Q152,186 156,186 L162,186 Q164,186 164,182 L160,140 Z" fill="#455A64" stroke="#37474F" strokeWidth="2" strokeLinejoin="round" />
    <Path d="M134,184 L132,188 Q130,192 136,192 L148,192 Q150,192 150,190 L148,186" fill="#263238" stroke="#1A1A1A" strokeWidth="1.8" strokeLinejoin="round" />
    <Path d="M150,184 L148,188 Q146,192 152,192 L164,192 Q168,192 168,190 L164,186" fill="#263238" stroke="#1A1A1A" strokeWidth="1.8" strokeLinejoin="round" />

    {/* Torso */}
    <Path d="M132,96 Q130,100 132,108 L134,140 L164,140 L166,108 Q168,100 166,96 Z" fill="#1E88E5" stroke="#455A64" strokeWidth="2.5" strokeLinejoin="round" />
    <Path d="M142,96 Q149,92 156,96" fill="none" stroke="#1565C0" strokeWidth="1.5" opacity="0.5" />
    <Path d="M138,112 Q148,116 158,112" fill="none" stroke="#1565C0" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
    <Path d="M136,126 Q148,130 160,126" fill="none" stroke="#1565C0" strokeWidth="1.2" strokeLinecap="round" opacity="0.3" />
    <Rect x="134" y="136" width="30" height="6" rx="1" fill="#37474F" stroke="#263238" strokeWidth="1" />
    <Rect x="146" y="135" width="6" height="8" rx="1" fill="#455A64" stroke="#37474F" strokeWidth="0.8" />

    {/* Arms */}
    <Path d="M132,98 L124,116 L130,120 L138,102 Z" fill="#1E88E5" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
    <Path d="M124,116 L120,138 L126,140 L130,120 Z" fill="#FFAB91" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
    <Ellipse cx="122" cy="140" rx="5" ry="4" fill="#FFAB91" stroke="#455A64" strokeWidth="1.5" />
    <Path d="M122,136 Q108,120 98,92" fill="none" stroke="#455A64" strokeWidth="2.5" strokeLinecap="round" />
    <Path d="M122,136 Q108,120 98,92" fill="none" stroke="#37474F" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4,4" />
    <Path d="M166,98 L174,116 L168,120 L160,102 Z" fill="#1E88E5" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
    <Path d="M174,116 L176,138 L170,140 L168,120 Z" fill="#FFAB91" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
    <Ellipse cx="174" cy="140" rx="5" ry="4" fill="#FFAB91" stroke="#455A64" strokeWidth="1.5" />

    {/* Neck */}
    <Rect x="142" y="84" width="14" height="14" rx="5" fill="#FFAB91" stroke="#455A64" strokeWidth="1.5" />

    {/* Head */}
    <Ellipse cx="149" cy="62" rx="20" ry="24" fill="#FFAB91" stroke="#455A64" strokeWidth="2.5" />
    <Path d="M129,54 Q129,32 149,26 Q169,32 169,54 L169,58 Q167,54 160,52 L149,50 L138,52 Q131,54 129,58 Z" fill="#3E2723" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
    <Path d="M136,34 Q149,28 162,34" fill="none" stroke="#2C1A12" strokeWidth="1.5" opacity="0.3" />
    <Ellipse cx="129" cy="64" rx="4" ry="6" fill="#FFAB91" stroke="#455A64" strokeWidth="1.5" />

    {/* Eyes */}
    <Circle cx="142" cy="62" r="2.5" fill="#455A64" />
    <Circle cx="156" cy="62" r="2.5" fill="#455A64" />
    <Circle cx="143" cy="61" r="0.8" fill="white" />
    <Circle cx="157" cy="61" r="0.8" fill="white" />
    <Path d="M138,57 Q142,55 146,57" fill="none" stroke="#3E2723" strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M152,57 Q156,55 160,57" fill="none" stroke="#3E2723" strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M149,64 Q147,70 149,72" fill="none" stroke="#E09070" strokeWidth="1.2" strokeLinecap="round" />
    <Path d="M143,76 Q149,80 155,76" fill="none" stroke="#455A64" strokeWidth="1.5" strokeLinecap="round" />

    {/* Cap */}
    <Path d="M127,52 Q127,36 149,30 Q171,36 171,52 L171,54 L127,54 Z" fill="#37474F" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
    <Path d="M125,54 L175,54 L178,58 L122,58 Z" fill="#263238" stroke="#455A64" strokeWidth="1.5" strokeLinejoin="round" />
    <Circle cx="149" cy="30" r="2" fill="#455A64" stroke="#37474F" strokeWidth="0.8" />
  </Svg>
);

export default PhotographerIcon;

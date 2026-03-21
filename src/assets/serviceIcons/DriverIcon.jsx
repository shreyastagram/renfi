import React from 'react';
import Svg, { G, Path, Rect, Circle, Ellipse, Line } from 'react-native-svg';

const DriverIcon = ({ size = 52 }) => (
  <Svg viewBox="0 0 200 200" width={size} height={size}>

    {/* WINDSHIELD FRAME */}
    <Path d="M10,30 Q10,16 24,12 L176,12 Q190,16 190,30 L190,140 Q190,150 180,150 L20,150 Q10,150 10,140 Z" fill="#E3F2FD" stroke="#455A64" strokeWidth="2.5" strokeLinejoin="round" />

    {/* Sky */}
    <Path d="M18,32 Q18,22 28,18 L172,18 Q182,22 182,32 L182,100 L18,100 Z" fill="#81D4FA" stroke="none" />

    {/* Road */}
    <Path d="M18,100 L182,100 L182,142 Q182,146 178,146 L22,146 Q18,146 18,142 Z" fill="#78909C" stroke="none" />

    {/* Road markings */}
    <Line x1="100" y1="105" x2="100" y2="118" stroke="#FFE082" strokeWidth="2.5" strokeLinecap="round" />
    <Line x1="100" y1="124" x2="100" y2="137" stroke="#FFE082" strokeWidth="2.5" strokeLinecap="round" />
    <Line x1="30" y1="108" x2="22" y2="142" stroke="white" strokeWidth="1.5" opacity="0.4" />
    <Line x1="170" y1="108" x2="178" y2="142" stroke="white" strokeWidth="1.5" opacity="0.4" />

    {/* Buildings silhouette */}
    <Path d="M18,100 L18,92 L30,92 L30,86 L38,86 L38,90 L48,90 L48,80 L56,80 L56,88 L68,88 L68,78 L74,78 L74,84 L82,84 L82,76 L88,76 L88,86 L100,86 L100,80 L108,80 L108,88 L118,88 L118,78 L126,78 L126,86 L136,86 L136,82 L144,82 L144,90 L156,90 L156,84 L164,84 L164,92 L174,92 L174,96 L182,96 L182,100 Z" fill="#546E7A" opacity="0.4" />

    {/* Clouds */}
    <Ellipse cx="50" cy="42" rx="20" ry="8" fill="white" opacity="0.5" />
    <Ellipse cx="140" cy="36" rx="16" ry="6" fill="white" opacity="0.4" />
    <Ellipse cx="90" cy="50" rx="12" ry="5" fill="white" opacity="0.3" />

    {/* Windshield pillars */}
    <Path d="M10,30 Q10,16 24,12 L28,18 Q18,22 18,32 L18,142 Q18,146 22,146 L20,150 Q10,150 10,140 Z" fill="#37474F" stroke="#263238" strokeWidth="1" />
    <Path d="M190,30 Q190,16 176,12 L172,18 Q182,22 182,32 L182,142 Q182,146 178,146 L180,150 Q190,150 190,140 Z" fill="#37474F" stroke="#263238" strokeWidth="1" />
    <Path d="M24,12 L176,12 L172,18 L28,18 Z" fill="#37474F" stroke="#263238" strokeWidth="1" />

    {/* Rearview mirror */}
    <G>
      <Line x1="100" y1="18" x2="100" y2="30" stroke="#455A64" strokeWidth="2.5" />
      <Rect x="84" y="28" width="32" height="14" rx="4" fill="#263238" stroke="#455A64" strokeWidth="2" />
      <Rect x="87" y="30.5" width="26" height="9" rx="2.5" fill="#546E7A" />
      <Rect x="89" y="32" width="10" height="4" rx="1" fill="#78909C" opacity="0.4" />
    </G>

    {/* STEERING WHEEL */}
    <G>
      <Path d="M88,190 L88,174 Q88,168 94,166 L106,166 Q112,168 112,174 L112,190" fill="#37474F" stroke="#263238" strokeWidth="2" />
      <Circle cx="100" cy="166" r="38" fill="none" stroke="#263238" strokeWidth="9" />
      <Circle cx="100" cy="166" r="38" fill="none" stroke="#37474F" strokeWidth="6.5" />
      <Path d="M66,152 Q68,142 80,134" fill="none" stroke="#546E7A" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
      <Path d="M134,152 Q132,142 120,134" fill="none" stroke="#546E7A" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />

      {/* Spokes */}
      <Path d="M68,166 L90,166" stroke="#263238" strokeWidth="7" strokeLinecap="round" />
      <Path d="M68,166 L90,166" stroke="#37474F" strokeWidth="4.5" strokeLinecap="round" />
      <Path d="M110,166 L132,166" stroke="#263238" strokeWidth="7" strokeLinecap="round" />
      <Path d="M110,166 L132,166" stroke="#37474F" strokeWidth="4.5" strokeLinecap="round" />
      <Path d="M100,176 L100,196" stroke="#263238" strokeWidth="7" strokeLinecap="round" />
      <Path d="M100,176 L100,196" stroke="#37474F" strokeWidth="4.5" strokeLinecap="round" />

      {/* Center hub */}
      <Circle cx="100" cy="166" r="14" fill="#37474F" stroke="#263238" strokeWidth="2" />
      <Circle cx="100" cy="166" r="10" fill="#455A64" stroke="#37474F" strokeWidth="1" />
      <Circle cx="100" cy="166" r="6" fill="none" stroke="#607D8B" strokeWidth="1.2" />
      <Circle cx="100" cy="166" r="2.5" fill="#607D8B" />
      <Ellipse cx="97" cy="163" rx="5" ry="3.5" fill="white" opacity="0.08" />
    </G>

    {/* HANDS */}
    <G>
      <Path d="M62,150 Q56,148 56,154 L56,164 Q56,170 62,170 L70,170 L72,160 L70,150 Z" fill="#FFAB91" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
      <Path d="M70,152 Q74,148 76,152 Q78,156 74,158 L72,158" fill="#FFAB91" stroke="#455A64" strokeWidth="1.8" strokeLinejoin="round" />
      <Path d="M58,156 Q56,158 58,160" fill="none" stroke="#E09070" strokeWidth="1" strokeLinecap="round" />
      <Path d="M58,160 Q56,162 58,164" fill="none" stroke="#E09070" strokeWidth="1" strokeLinecap="round" />
      <Path d="M54,148 L52,138 Q50,132 46,130" fill="none" stroke="#37474F" strokeWidth="6" strokeLinecap="round" opacity="0.3" />
    </G>
    <G>
      <Path d="M138,150 Q144,148 144,154 L144,164 Q144,170 138,170 L130,170 L128,160 L130,150 Z" fill="#FFAB91" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
      <Path d="M130,152 Q126,148 124,152 Q122,156 126,158 L128,158" fill="#FFAB91" stroke="#455A64" strokeWidth="1.8" strokeLinejoin="round" />
      <Path d="M142,156 Q144,158 142,160" fill="none" stroke="#E09070" strokeWidth="1" strokeLinecap="round" />
      <Path d="M142,160 Q144,162 142,164" fill="none" stroke="#E09070" strokeWidth="1" strokeLinecap="round" />
      <Path d="M146,148 L148,138 Q150,132 154,130" fill="none" stroke="#37474F" strokeWidth="6" strokeLinecap="round" opacity="0.3" />
    </G>

    {/* DASHBOARD */}
    <Path d="M6,150 L194,150 L194,156 Q194,158 192,158 L8,158 Q6,158 6,156 Z" fill="#455A64" stroke="#37474F" strokeWidth="1" />

    {/* Speed gauge */}
    <Circle cx="36" cy="178" r="12" fill="#263238" stroke="#37474F" strokeWidth="1.5" />
    <Circle cx="36" cy="178" r="8" fill="none" stroke="#4CAF50" strokeWidth="1" opacity="0.5" />
    <Line x1="36" y1="178" x2="30" y2="172" stroke="#4CAF50" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    <Circle cx="36" cy="178" r="1.5" fill="#4CAF50" opacity="0.5" />

    {/* RPM gauge */}
    <Circle cx="164" cy="178" r="12" fill="#263238" stroke="#37474F" strokeWidth="1.5" />
    <Circle cx="164" cy="178" r="8" fill="none" stroke="#42A5F5" strokeWidth="1" opacity="0.5" />
    <Line x1="164" y1="178" x2="158" y2="174" stroke="#42A5F5" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    <Circle cx="164" cy="178" r="1.5" fill="#42A5F5" opacity="0.5" />
  </Svg>
);

export default DriverIcon;

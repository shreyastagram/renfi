import React from 'react';
import Svg, { G, Path, Rect, Ellipse, Line } from 'react-native-svg';

const MasonTilerIcon = ({ size = 52 }) => (
  <Svg viewBox="0 0 200 200" width={size} height={size}>

    {/* FLOOR TILE GRID */}
    <G stroke="#455A64" strokeWidth="2.5" fill="#F5F5F5" strokeLinejoin="round">
      <Path d="M10,160 L40,145 L70,160 L40,175 Z" />
      <Path d="M70,160 L100,145 L130,160 L100,175 Z" />
      <Path d="M40,175 L70,160 L100,175 L70,190 Z" />
      <Path d="M100,175 L130,160 L160,175 L130,190 Z" />
      <Path d="M70,190 L100,175 L130,190 L100,205 Z" />
    </G>

    {/* CEMENT / BARE AREA */}
    <Path d="M130,160 L160,145 L190,160 L190,190 L160,175 Z" fill="#BCAAA4" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
    <G stroke="#A1887F" strokeWidth="1.2" opacity="0.4">
      <Line x1="136" y1="158" x2="158" y2="148" />
      <Line x1="138" y1="162" x2="162" y2="151" />
      <Line x1="140" y1="166" x2="166" y2="155" />
      <Line x1="142" y1="170" x2="168" y2="159" />
    </G>

    {/* TILE BEING PLACED */}
    <G>
      <Path d="M108,138 L138,123 L162,136 L132,151 Z" fill="#455A64" opacity="0.15" />
      <Path d="M106,134 L136,119 L160,132 L130,147 Z" fill="#EEEEEE" stroke="#455A64" strokeWidth="2.5" strokeLinejoin="round" />
      <Path d="M130,147 L160,132 L160,136 L130,151 Z" fill="#D0D0D0" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
      <Path d="M106,134 L130,147 L130,151 L106,138 Z" fill="#DCDCDC" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
    </G>

    {/* STACKED TILES */}
    <G>
      <Path d="M152,152 L176,140 L194,150 L170,162 Z" fill="#E0E0E0" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
      <Path d="M152,149 L176,137 L194,147 L170,159 Z" fill="#E8E8E8" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
      <Path d="M152,146 L176,134 L194,144 L170,156 Z" fill="#EEEEEE" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
      <Path d="M152,143 L176,131 L194,141 L170,153 Z" fill="#F5F5F5" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
    </G>

    {/* TROWEL */}
    <G>
      <Path d="M160,172 L182,164 L190,170 L168,178 Z" fill="#78909C" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
      <Path d="M182,164 L192,160 Q196,158 196,162 L196,168 Q196,172 192,170 L190,170 L182,164 Z" fill="#8D6E63" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
    </G>

    {/* CEMENT BAG */}
    <Ellipse cx="72" cy="142" rx="34" ry="6" fill="#455A64" opacity="0.12" />

    {/* Bag body */}
    <Path d="M38,60 Q34,60 32,66 L28,126 Q26,136 36,138 L104,138 Q114,136 112,126 L108,66 Q106,60 102,60 Z" fill="#E8D5B0" stroke="#455A64" strokeWidth="2.5" strokeLinejoin="round" />

    {/* Bag bulge shading */}
    <Path d="M36,68 L32,124 Q32,130 38,132" fill="none" stroke="#D4BA88" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
    <Path d="M104,68 L108,124 Q108,130 102,132" fill="none" stroke="#C4A870" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />

    {/* Bag top fold */}
    <Path d="M42,60 Q44,50 54,48 L86,48 Q96,50 98,60" fill="#DCC89C" stroke="#455A64" strokeWidth="2.5" strokeLinejoin="round" />
    <Path d="M50,54 Q58,50 66,54" fill="none" stroke="#C4A870" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    <Path d="M72,52 Q80,48 88,52" fill="none" stroke="#C4A870" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />

    {/* Bag tie */}
    <Ellipse cx="70" cy="46" rx="8" ry="4" fill="#B8A07A" stroke="#455A64" strokeWidth="2" />
    <Path d="M64,44 L58,36 Q56,32 60,34 L66,40" fill="none" stroke="#455A64" strokeWidth="2.5" strokeLinecap="round" />
    <Path d="M76,44 L82,36 Q84,32 80,34 L74,40" fill="none" stroke="#455A64" strokeWidth="2.5" strokeLinecap="round" />

    {/* Wrinkle lines */}
    <G stroke="#C4A870" strokeWidth="1.2" strokeLinecap="round" opacity="0.35">
      <Path d="M42,72 Q54,76 66,72 Q78,68 90,72 Q98,74 104,72" fill="none" />
      <Path d="M38,100 Q52,104 66,100 Q80,96 94,100 Q102,102 108,100" fill="none" />
      <Path d="M36,118 Q50,122 64,118 Q78,114 92,118 Q102,120 110,118" fill="none" />
    </G>

    {/* CEMENT LABEL */}
    <Rect x="44" y="78" width="52" height="30" rx="3" fill="#D32F2F" stroke="#455A64" strokeWidth="2" />

    {/* CEMENT text */}
    <G fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M50,84 Q46,84 46,90 Q46,96 50,96" />
      <Path d="M56,84 L53,84 L53,90 L55.5,90 M53,90 L53,96 L56,96" />
      <Path d="M59,96 L59,84 L63,90 L67,84 L67,96" />
      <Path d="M74,84 L71,84 L71,90 L73.5,90 M71,90 L71,96 L74,96" />
      <Path d="M77,96 L77,84 L83,96 L83,84" />
      <Path d="M86,84 L92,84 M89,84 L89,96" />
    </G>

    {/* 50 KG text */}
    <G fill="none" stroke="#FFCDD2" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.8">
      <Path d="M58,100 L55,100 L55,103 Q58,102 58,104 Q58,106 55,106" />
      <Ellipse cx="62" cy="103" rx="2.5" ry="3" fill="none" />
      <Path d="M68,100 L68,106 M72,100 L68,103 L72,106" />
      <Path d="M77,100 Q73,100 73,103 Q73,106 77,106 L77,103.5 L75.5,103.5" />
    </G>

    {/* Bag bottom */}
    <Path d="M36,138 Q70,142 104,138" fill="none" stroke="#B8A07A" strokeWidth="1.5" opacity="0.4" />
  </Svg>
);

export default MasonTilerIcon;

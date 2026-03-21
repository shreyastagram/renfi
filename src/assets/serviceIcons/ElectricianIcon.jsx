import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Filter, FeDropShadow, G, Path, Circle, Polygon, Line } from 'react-native-svg';

const ElectricianIcon = ({ size = 52 }) => (
  <Svg viewBox="0 0 200 200" width={size} height={size}>
    <Defs>
      <LinearGradient id="hatMain" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#FFD600" />
        <Stop offset="50%" stopColor="#FFC107" />
        <Stop offset="100%" stopColor="#FFA000" />
      </LinearGradient>
      <LinearGradient id="hatTop" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#FFE24D" />
        <Stop offset="100%" stopColor="#FFD600" />
      </LinearGradient>
      <LinearGradient id="brim" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#FFA000" />
        <Stop offset="100%" stopColor="#FF8F00" />
      </LinearGradient>
      <LinearGradient id="bolt" x1="0" y1="0" x2="0.3" y2="1">
        <Stop offset="0%" stopColor="#FFFFFF" />
        <Stop offset="40%" stopColor="#E3F2FD" />
        <Stop offset="100%" stopColor="#90CAF9" />
      </LinearGradient>
      <LinearGradient id="boltStroke" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#1565C0" />
        <Stop offset="100%" stopColor="#0D47A1" />
      </LinearGradient>
    </Defs>

    {/* Hard Hat */}
    <G>
      <Path
        d="M44,108 Q44,42 100,34 Q156,42 156,108 Z"
        fill="url(#hatMain)"
        stroke="#F57F17"
        strokeWidth="1.5"
      />
      <Path
        d="M68,68 Q68,48 100,42 Q132,48 132,68"
        fill="none"
        stroke="#FFE24D"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.7"
      />
      <Path
        d="M62,80 Q62,52 100,44 Q118,48 126,58"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.35"
      />
      <Path
        d="M30,108 Q30,100 44,100 L156,100 Q170,100 170,108 L170,114 Q170,120 156,120 L44,120 Q30,120 30,114 Z"
        fill="url(#brim)"
        stroke="#E65100"
        strokeWidth="1"
      />
      <Path d="M38,104 L162,104" stroke="#FFB300" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <Path d="M36,112 L164,112" stroke="#E65100" strokeWidth="0.8" opacity="0.3" />
      <Circle cx="100" cy="78" r="10" fill="#F57F17" opacity="0.5" />
      <Circle cx="100" cy="78" r="7" fill="#FFE24D" opacity="0.4" />
      <Polygon points="101,71 97,78 100,78 96,85 104,77 101,77" fill="#F57F17" opacity="0.7" />
    </G>

    {/* Lightning Bolt */}
    <G transform="translate(2, 0)">
      <Polygon
        points="112,120 90,154 102,154 80,190 126,148 112,148 136,120"
        fill="url(#bolt)"
        stroke="url(#boltStroke)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <Polygon
        points="118,126 100,150 108,150 94,176 120,152 112,152 130,126"
        fill="white"
        opacity="0.3"
      />
    </G>

    {/* Spark accents */}
    <G stroke="#1565C0" strokeWidth="2" strokeLinecap="round" opacity="0.5">
      <Line x1="72" y1="162" x2="66" y2="158" />
      <Line x1="68" y1="170" x2="60" y2="170" />
      <Line x1="138" y1="132" x2="146" y2="128" />
      <Line x1="142" y1="140" x2="150" y2="140" />
    </G>
    <G fill="#1976D2" opacity="0.4">
      <Circle cx="58" cy="164" r="2" />
      <Circle cx="152" cy="134" r="2" />
    </G>
  </Svg>
);

export default ElectricianIcon;

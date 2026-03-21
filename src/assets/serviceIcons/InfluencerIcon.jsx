import React from 'react';
import Svg, { Defs, ClipPath, G, Path, Rect, Circle, Ellipse, Line } from 'react-native-svg';

const InfluencerIcon = ({ size = 52 }) => (
  <Svg viewBox="0 0 200 200" width={size} height={size}>
    <Defs>
      <ClipPath id="inf_profileClip">
        <Circle cx="100" cy="92" r="73" />
      </ClipPath>
    </Defs>

    {/* Instagram-style gradient ring */}
    <Circle cx="100" cy="92" r="82" fill="none" stroke="#E040FB" strokeWidth="4" />
    <Circle cx="100" cy="92" r="82" fill="none" stroke="#FF5252" strokeWidth="4" strokeDasharray="130,400" strokeDashoffset="-40" />
    <Circle cx="100" cy="92" r="82" fill="none" stroke="#FF9100" strokeWidth="4" strokeDasharray="130,400" strokeDashoffset="-180" />
    <Circle cx="100" cy="92" r="82" fill="none" stroke="#E040FB" strokeWidth="4" strokeDasharray="130,400" strokeDashoffset="-310" />

    {/* White gap */}
    <Circle cx="100" cy="92" r="77" fill="white" stroke="white" strokeWidth="4" />

    {/* Background */}
    <Circle cx="100" cy="92" r="73" fill="#E3F2FD" />

    {/* Face inside circle */}
    <G clipPath="url(#inf_profileClip)">
      {/* Shoulders */}
      <Path d="M40,150 Q40,132 60,124 L80,118 Q100,114 120,118 L140,124 Q160,132 160,150 L160,180 L40,180 Z" fill="#1E88E5" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
      <Path d="M80,118 Q100,110 120,118" fill="none" stroke="#1565C0" strokeWidth="2" opacity="0.5" />
      <Path d="M86,118 Q100,126 114,118" fill="#FFAB91" stroke="#455A64" strokeWidth="1" />

      {/* Neck */}
      <Rect x="90" y="100" width="20" height="20" rx="8" fill="#FFAB91" stroke="#455A64" strokeWidth="1.5" />

      {/* Head */}
      <Ellipse cx="100" cy="72" rx="34" ry="38" fill="#FFAB91" stroke="#455A64" strokeWidth="2.5" />

      {/* Hair */}
      <Path d="M66,62 Q66,30 100,20 Q134,30 134,62 L134,68 Q130,62 120,58 L100,56 L80,58 Q70,62 66,68 Z" fill="#3E2723" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
      <Path d="M76,28 Q100,18 124,28" fill="none" stroke="#2C1A12" strokeWidth="2" opacity="0.3" />
      <Path d="M72,42 Q66,30 80,24 Q94,18 100,22" fill="#3E2723" stroke="#455A64" strokeWidth="1.5" />

      {/* Ears */}
      <Ellipse cx="66" cy="74" rx="5" ry="8" fill="#FFAB91" stroke="#455A64" strokeWidth="1.5" />
      <Ellipse cx="134" cy="74" rx="5" ry="8" fill="#FFAB91" stroke="#455A64" strokeWidth="1.5" />

      {/* Eyebrows */}
      <Path d="M82,60 Q88,56 94,60" fill="none" stroke="#3E2723" strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M106,60 Q112,56 118,60" fill="none" stroke="#3E2723" strokeWidth="2.5" strokeLinecap="round" />

      {/* Eyes */}
      <Ellipse cx="88" cy="68" rx="5" ry="4.5" fill="white" stroke="#455A64" strokeWidth="1.2" />
      <Circle cx="89" cy="68" r="3" fill="#3E2723" />
      <Circle cx="90" cy="67" r="1" fill="white" />
      <Ellipse cx="112" cy="68" rx="5" ry="4.5" fill="white" stroke="#455A64" strokeWidth="1.2" />
      <Circle cx="111" cy="68" r="3" fill="#3E2723" />
      <Circle cx="112" cy="67" r="1" fill="white" />

      {/* Nose */}
      <Path d="M100,72 Q97,80 100,82 Q103,80 100,72" fill="none" stroke="#E09070" strokeWidth="1.2" strokeLinecap="round" />

      {/* Smile */}
      <Path d="M86,88 Q100,98 114,88" fill="none" stroke="#455A64" strokeWidth="2" strokeLinecap="round" />
      <Path d="M90,90 Q100,96 110,90" fill="white" stroke="none" opacity="0.5" />

      {/* Jawline */}
      <Path d="M72,92 Q80,108 100,112 Q120,108 128,92" fill="none" stroke="#E09070" strokeWidth="0.8" opacity="0.3" />

      {/* Sunglasses on head */}
      <Path d="M70,48 Q74,52 84,52 Q90,52 90,48 Q90,44 84,44 Q78,44 74,44 Q70,44 70,48 Z" fill="#37474F" stroke="#455A64" strokeWidth="1.2" strokeLinejoin="round" opacity="0.6" />
      <Path d="M110,48 Q114,52 124,52 Q130,52 130,48 Q130,44 124,44 Q118,44 114,44 Q110,44 110,48 Z" fill="#37474F" stroke="#455A64" strokeWidth="1.2" strokeLinejoin="round" opacity="0.6" />
      <Line x1="90" y1="48" x2="110" y2="48" stroke="#455A64" strokeWidth="1.2" opacity="0.5" />
    </G>

    {/* Circle border */}
    <Circle cx="100" cy="92" r="73" fill="none" stroke="#455A64" strokeWidth="2" />

    {/* Verified badge */}
    <G transform="translate(148, 140)">
      <Path d="M16,0 L19,6 L26,4 L24,11 L30,16 L24,21 L26,28 L19,26 L16,32 L13,26 L6,28 L8,21 L2,16 L8,11 L6,4 L13,6 Z" fill="#1E88E5" stroke="#455A64" strokeWidth="2" strokeLinejoin="round" />
      <Path d="M10,16 L14,20 L22,10" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </G>
  </Svg>
);

export default InfluencerIcon;

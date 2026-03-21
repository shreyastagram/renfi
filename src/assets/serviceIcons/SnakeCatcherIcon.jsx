import React from 'react';
import Svg, { G, Path, Circle, Ellipse } from 'react-native-svg';

const SnakeCatcherIcon = ({ size = 52 }) => (
  <Svg viewBox="0 0 200 200" width={size} height={size}>
    {/* Snake body */}
    <Path d="M130,165 Q155,165 160,148 Q166,128 148,118 Q128,108 112,118 Q92,130 86,116 Q80,100 96,88 Q114,74 106,56 Q100,42 84,40 Q66,38 58,50 Q50,62 58,74" fill="none" stroke="#4CAF50" strokeWidth="16" strokeLinecap="round" />
    {/* Pattern */}
    <Path d="M130,165 Q155,165 160,148 Q166,128 148,118 Q128,108 112,118 Q92,130 86,116 Q80,100 96,88 Q114,74 106,56 Q100,42 84,40 Q66,38 58,50 Q50,62 58,74" fill="none" stroke="#388E3C" strokeWidth="16" strokeLinecap="round" strokeDasharray="4,8" opacity="0.35" />
    {/* Outline */}
    <Path d="M130,165 Q155,165 160,148 Q166,128 148,118 Q128,108 112,118 Q92,130 86,116 Q80,100 96,88 Q114,74 106,56 Q100,42 84,40 Q66,38 58,50 Q50,62 58,74" fill="none" stroke="#455A64" strokeWidth="2.5" strokeLinecap="round" />
    {/* Belly stripe */}
    <Path d="M130,167 Q152,167 158,152 Q164,134 146,122 Q130,112 114,122 Q96,132 88,120 Q82,106 98,94 Q112,80 108,62 Q104,48 88,44 Q72,42 62,52 Q54,62 60,72" fill="none" stroke="#A5D6A7" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
    {/* Tail */}
    <Path d="M130,165 Q140,174 146,170 Q150,166 146,162" fill="none" stroke="#4CAF50" strokeWidth="8" strokeLinecap="round" />
    <Path d="M130,165 Q140,174 146,170 Q150,166 146,162" fill="none" stroke="#455A64" strokeWidth="1.5" strokeLinecap="round" />
    {/* Head */}
    <Path d="M58,74 Q48,78 44,72 Q38,64 44,56 Q50,50 58,54 Q64,58 62,64 Z" fill="#4CAF50" stroke="#455A64" strokeWidth="2.5" strokeLinejoin="round" />
    <Path d="M48,58 Q54,54 60,58" fill="none" stroke="#2E7D32" strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />
    {/* Eye */}
    <Circle cx="50" cy="64" r="3.5" fill="#FFF9C4" stroke="#455A64" strokeWidth="1.8" />
    <Ellipse cx="50" cy="64" rx="1" ry="3" fill="#455A64" />
    {/* Tongue */}
    <Path d="M42,70 L32,76 L28,73 M32,76 L28,79" fill="none" stroke="#E53935" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export default SnakeCatcherIcon;

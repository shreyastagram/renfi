import React from 'react';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, G, Path, Rect, Circle, Ellipse, Line } from 'react-native-svg';

const EmergencyIcon = ({ size = 52 }) => (
  <Svg viewBox="0 0 200 200" width={size} height={size}>
    <Defs>
      <RadialGradient id="em_coreG" cx="0.5" cy="0.45" r="0.4">
        <Stop offset="0%" stopColor="#FFFFFF" />
        <Stop offset="20%" stopColor="#FF8A80" />
        <Stop offset="50%" stopColor="#E53935" />
        <Stop offset="100%" stopColor="#B71C1C" />
      </RadialGradient>
      <RadialGradient id="em_glowG1" cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0%" stopColor="#E53935" stopOpacity="0.5" />
        <Stop offset="50%" stopColor="#E53935" stopOpacity="0.15" />
        <Stop offset="100%" stopColor="#E53935" stopOpacity="0" />
      </RadialGradient>
      <RadialGradient id="em_glowG2" cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0%" stopColor="#FF5252" stopOpacity="0.3" />
        <Stop offset="60%" stopColor="#FF5252" stopOpacity="0.08" />
        <Stop offset="100%" stopColor="#FF5252" stopOpacity="0" />
      </RadialGradient>
      <RadialGradient id="em_glowG3" cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0%" stopColor="#FF8A80" stopOpacity="0.15" />
        <Stop offset="70%" stopColor="#FF8A80" stopOpacity="0.03" />
        <Stop offset="100%" stopColor="#FF8A80" stopOpacity="0" />
      </RadialGradient>
      <RadialGradient id="em_domeG" cx="0.4" cy="0.35" r="0.55">
        <Stop offset="0%" stopColor="#FF8A80" />
        <Stop offset="30%" stopColor="#E53935" />
        <Stop offset="70%" stopColor="#C62828" />
        <Stop offset="100%" stopColor="#8B1A1A" />
      </RadialGradient>
      <LinearGradient id="em_baseG" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#455A64" />
        <Stop offset="100%" stopColor="#263238" />
      </LinearGradient>
    </Defs>

    {/* GLOW RINGS */}
    <Circle cx="100" cy="88" r="96" fill="url(#em_glowG3)" />
    <Circle cx="100" cy="88" r="72" fill="url(#em_glowG2)" />
    <Circle cx="100" cy="88" r="52" fill="url(#em_glowG1)" />

    {/* LIGHT RAYS */}
    <G opacity="0.15">
      <Line x1="100" y1="88" x2="100" y2="4" stroke="#FF5252" strokeWidth="3" strokeLinecap="round" />
      <Line x1="100" y1="88" x2="100" y2="172" stroke="#FF5252" strokeWidth="3" strokeLinecap="round" />
      <Line x1="100" y1="88" x2="16" y2="88" stroke="#FF5252" strokeWidth="3" strokeLinecap="round" />
      <Line x1="100" y1="88" x2="184" y2="88" stroke="#FF5252" strokeWidth="3" strokeLinecap="round" />
      <Line x1="100" y1="88" x2="40" y2="28" stroke="#FF5252" strokeWidth="2.5" strokeLinecap="round" />
      <Line x1="100" y1="88" x2="160" y2="28" stroke="#FF5252" strokeWidth="2.5" strokeLinecap="round" />
      <Line x1="100" y1="88" x2="40" y2="148" stroke="#FF5252" strokeWidth="2.5" strokeLinecap="round" />
      <Line x1="100" y1="88" x2="160" y2="148" stroke="#FF5252" strokeWidth="2.5" strokeLinecap="round" />
    </G>

    {/* SIREN BASE */}
    <Rect x="58" y="120" width="84" height="14" rx="4" fill="url(#em_baseG)" stroke="#1A1A1A" strokeWidth="1.5" />
    <Line x1="64" y1="123" x2="136" y2="123" stroke="#546E7A" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    <Circle cx="68" cy="127" r="2" fill="#37474F" stroke="#263238" strokeWidth="0.6" />
    <Circle cx="132" cy="127" r="2" fill="#37474F" stroke="#263238" strokeWidth="0.6" />

    {/* Neck */}
    <Rect x="88" y="110" width="24" height="12" rx="3" fill="#37474F" stroke="#263238" strokeWidth="1.2" />
    <Line x1="91" y1="113" x2="109" y2="113" stroke="#455A64" strokeWidth="0.8" opacity="0.4" />

    {/* SIREN DOME */}
    <Ellipse cx="100" cy="82" rx="42" ry="38" fill="#E53935" opacity="0.25" />

    <Path d="M62,110 Q58,110 58,104 L58,78 Q58,46 100,38 Q142,46 142,78 L142,104 Q142,110 138,110 Z" fill="url(#em_domeG)" stroke="#8B1A1A" strokeWidth="1.5" />

    {/* Dome ridges */}
    <G stroke="#B71C1C" strokeWidth="1" opacity="0.35">
      <Path d="M62,102 L138,102" />
      <Path d="M60,94 L140,94" />
      <Path d="M60,86 L140,86" />
      <Path d="M62,78 L138,78" />
      <Path d="M66,70 L134,70" />
      <Path d="M72,62 L128,62" />
      <Path d="M80,54 L120,54" />
    </G>

    {/* Dome highlights */}
    <Ellipse cx="90" cy="72" rx="18" ry="14" fill="white" opacity="0.15" />
    <Ellipse cx="86" cy="66" rx="10" ry="8" fill="white" opacity="0.2" />
    <Path d="M78,48 Q100,40 122,48" fill="none" stroke="#FF8A80" strokeWidth="2.5" strokeLinecap="round" opacity="0.4" />

    {/* Bright core */}
    <Circle cx="100" cy="78" r="14" fill="url(#em_coreG)" />

    {/* Dome rim */}
    <Path d="M62,110 L138,110" stroke="#8B1A1A" strokeWidth="2.5" strokeLinecap="round" />
    <Path d="M62,108 L138,108" stroke="#C62828" strokeWidth="1" opacity="0.3" />

    {/* SOS 112 TEXT */}
    <G fill="none" stroke="#E53935" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
      <Path d="M56,152 Q62,148 62,153 Q62,158 56,158 Q50,158 50,163 Q50,168 56,168" />
      <Ellipse cx="68" cy="160" rx="5" ry="8" />
      <Path d="M80,152 Q86,148 86,153 Q86,158 80,158 Q74,158 74,163 Q74,168 80,168" />
      <Line x1="100" y1="152" x2="100" y2="168" />
      <Line x1="97" y1="155" x2="100" y2="152" />
      <Line x1="108" y1="152" x2="108" y2="168" />
      <Line x1="105" y1="155" x2="108" y2="152" />
      <Path d="M116,152 Q122,152 122,157 Q122,160 116,162 L122,168" />
    </G>

    {/* Flashing dots */}
    <Circle cx="30" cy="50" r="2" fill="#FF5252" opacity="0.3" />
    <Circle cx="170" cy="50" r="2" fill="#FF5252" opacity="0.2" />
    <Circle cx="24" cy="100" r="1.5" fill="#FF5252" opacity="0.15" />
    <Circle cx="176" cy="100" r="1.5" fill="#FF5252" opacity="0.15" />
  </Svg>
);

export default EmergencyIcon;

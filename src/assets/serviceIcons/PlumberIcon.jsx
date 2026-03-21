import React from 'react';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, G, Path, Rect, Ellipse, Circle, Line } from 'react-native-svg';

const PlumberIcon = ({ size = 52 }) => (
  <Svg viewBox="0 0 200 200" width={size} height={size}>
    <Defs>
      <LinearGradient id="chromeBody" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0%" stopColor="#78909C" />
        <Stop offset="15%" stopColor="#B0BEC5" />
        <Stop offset="35%" stopColor="#ECEFF1" />
        <Stop offset="55%" stopColor="#CFD8DC" />
        <Stop offset="80%" stopColor="#90A4AE" />
        <Stop offset="100%" stopColor="#607D8B" />
      </LinearGradient>
      <LinearGradient id="chromeVert" x1="0" y1="0" x2="1" y2="0.3">
        <Stop offset="0%" stopColor="#78909C" />
        <Stop offset="20%" stopColor="#CFD8DC" />
        <Stop offset="45%" stopColor="#ECEFF1" />
        <Stop offset="65%" stopColor="#B0BEC5" />
        <Stop offset="100%" stopColor="#607D8B" />
      </LinearGradient>
      <LinearGradient id="spoutG" x1="0" y1="0" x2="0.2" y2="1">
        <Stop offset="0%" stopColor="#90A4AE" />
        <Stop offset="30%" stopColor="#CFD8DC" />
        <Stop offset="50%" stopColor="#ECEFF1" />
        <Stop offset="70%" stopColor="#B0BEC5" />
        <Stop offset="100%" stopColor="#78909C" />
      </LinearGradient>
      <LinearGradient id="handleG" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0%" stopColor="#1565C0" />
        <Stop offset="35%" stopColor="#1E88E5" />
        <Stop offset="55%" stopColor="#42A5F5" />
        <Stop offset="100%" stopColor="#1565C0" />
      </LinearGradient>
      <LinearGradient id="baseG" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#B0BEC5" />
        <Stop offset="100%" stopColor="#78909C" />
      </LinearGradient>
      <LinearGradient id="dropG" x1="0.2" y1="0" x2="0.8" y2="1">
        <Stop offset="0%" stopColor="#E3F2FD" />
        <Stop offset="35%" stopColor="#42A5F5" />
        <Stop offset="75%" stopColor="#1E88E5" />
        <Stop offset="100%" stopColor="#1565C0" />
      </LinearGradient>
      <RadialGradient id="dropHL" cx="0.35" cy="0.3" r="0.3">
        <Stop offset="0%" stopColor="white" stopOpacity="0.85" />
        <Stop offset="100%" stopColor="white" stopOpacity="0" />
      </RadialGradient>
    </Defs>

    {/* TAP / FAUCET */}
    <G>
      {/* Base plate */}
      <Ellipse cx="70" cy="148" rx="36" ry="8" fill="url(#baseG)" stroke="#607D8B" strokeWidth="1" />
      <Ellipse cx="70" cy="146" rx="36" ry="8" fill="#B0BEC5" stroke="#607D8B" strokeWidth="1" />
      <Ellipse cx="70" cy="144" rx="30" ry="5" fill="none" stroke="#ECEFF1" strokeWidth="1" opacity="0.4" />

      {/* Vertical body column */}
      <Rect x="56" y="68" width="28" height="80" rx="5" fill="url(#chromeVert)" stroke="#607D8B" strokeWidth="1" />
      <Line x1="62" y1="74" x2="62" y2="142" stroke="#ECEFF1" strokeWidth="2.5" opacity="0.4" strokeLinecap="round" />
      <Rect x="54" y="98" width="32" height="5" rx="2.5" fill="#90A4AE" stroke="#78909C" strokeWidth="0.6" />
      <Line x1="56" y1="99.5" x2="84" y2="99.5" stroke="#CFD8DC" strokeWidth="0.8" opacity="0.5" />

      {/* Spout connection ring */}
      <Rect x="54" y="66" width="32" height="7" rx="3" fill="#90A4AE" stroke="#78909C" strokeWidth="0.8" />
      <Line x1="56" y1="68" x2="84" y2="68" stroke="#CFD8DC" strokeWidth="0.8" opacity="0.5" />

      {/* Curved spout */}
      <Path
        d="M82,70 C100,70 130,68 140,74 C154,82 156,96 156,110 L156,120"
        fill="none"
        stroke="url(#spoutG)"
        strokeWidth="18"
        strokeLinecap="round"
      />
      <Path
        d="M82,61 C104,61 135,59 147,67 C163,77 165,94 165,110 L165,120"
        fill="none"
        stroke="#607D8B"
        strokeWidth="1"
      />
      <Path
        d="M82,79 C100,79 127,78 135,82 C147,89 147,100 147,110 L147,120"
        fill="none"
        stroke="#607D8B"
        strokeWidth="1"
      />
      <Path
        d="M86,64 C106,64 133,63 144,70 C158,78 160,94 160,108"
        fill="none"
        stroke="#ECEFF1"
        strokeWidth="2"
        opacity="0.35"
        strokeLinecap="round"
      />

      {/* Spout tip / nozzle */}
      <Rect x="144" y="118" width="24" height="10" rx="4" fill="#90A4AE" stroke="#78909C" strokeWidth="0.8" />
      <Line x1="146" y1="121" x2="166" y2="121" stroke="#CFD8DC" strokeWidth="1" opacity="0.45" />
      <Rect x="150" y="128" width="12" height="3" rx="1.5" fill="#546E7A" />

      {/* Handle */}
      <G>
        <Rect x="64" y="50" width="12" height="20" rx="3" fill="#90A4AE" stroke="#78909C" strokeWidth="0.8" />
        <Line x1="67" y1="54" x2="67" y2="66" stroke="#CFD8DC" strokeWidth="1.2" opacity="0.45" strokeLinecap="round" />
        <Rect x="40" y="30" width="60" height="14" rx="7" fill="url(#handleG)" stroke="#0D47A1" strokeWidth="1.2" transform="rotate(-12, 70, 37)" />
        <Line x1="48" y1="33" x2="92" y2="28" stroke="#64B5F6" strokeWidth="1.5" opacity="0.45" strokeLinecap="round" />
        <Circle cx="96" cy="28" r="5" fill="#1565C0" stroke="#0D47A1" strokeWidth="0.8" />
        <Circle cx="95" cy="27" r="1.8" fill="#42A5F5" opacity="0.5" />
      </G>

      {/* Crack on spout */}
      <G>
        <Path d="M160,96 L157,102 L162,107 L158,113 L161,118" fill="none" stroke="#37474F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M157,102 L154,100" fill="none" stroke="#455A64" strokeWidth="0.8" strokeLinecap="round" />
        <Path d="M162,107 L165,106" fill="none" stroke="#455A64" strokeWidth="0.8" strokeLinecap="round" />
        <Path d="M158,113 L155,115" fill="none" stroke="#455A64" strokeWidth="0.8" strokeLinecap="round" />
        <Circle cx="154" cy="102" r="1.5" fill="#42A5F5" opacity="0.4" />
        <Circle cx="155" cy="117" r="1.2" fill="#42A5F5" opacity="0.35" />
      </G>
    </G>

    {/* WATER DROP from nozzle */}
    <G>
      <Path d="M156,131 Q156,140 155,148" fill="none" stroke="#42A5F5" strokeWidth="2" opacity="0.35" strokeLinecap="round" />
      <Path
        d="M156,148 Q156,148 148,164 Q142,174 142,180 Q142,192 156,192 Q170,192 170,180 Q170,174 164,164 Q156,148 156,148 Z"
        fill="url(#dropG)"
        stroke="#1565C0"
        strokeWidth="1.2"
      />
      <Ellipse cx="151" cy="174" rx="4" ry="6" fill="white" opacity="0.5" transform="rotate(-10, 151, 174)" />
      <Ellipse cx="150" cy="171" rx="2" ry="3.5" fill="white" opacity="0.7" transform="rotate(-10, 150, 171)" />
    </G>

    {/* Splash accents */}
    <G stroke="#1E88E5" strokeWidth="1.8" strokeLinecap="round" opacity="0.4">
      <Line x1="134" y1="184" x2="128" y2="180" />
      <Line x1="130" y1="190" x2="124" y2="190" />
      <Line x1="178" y1="182" x2="184" y2="178" />
      <Line x1="182" y1="190" x2="188" y2="190" />
    </G>
    <G fill="#42A5F5" opacity="0.3">
      <Circle cx="125" cy="186" r="1.8" />
      <Circle cx="190" cy="185" r="1.8" />
    </G>
  </Svg>
);

export default PlumberIcon;

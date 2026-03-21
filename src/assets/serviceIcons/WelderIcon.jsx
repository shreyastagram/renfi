import React from 'react';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, G, Path, Rect, Circle, Ellipse, Line } from 'react-native-svg';

const WelderIcon = ({ size = 52 }) => (
  <Svg viewBox="0 0 200 200" width={size} height={size}>
    <Defs>
      <LinearGradient id="metalG" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#78909C" />
        <Stop offset="20%" stopColor="#90A4AE" />
        <Stop offset="45%" stopColor="#B0BEC5" />
        <Stop offset="60%" stopColor="#90A4AE" />
        <Stop offset="80%" stopColor="#78909C" />
        <Stop offset="100%" stopColor="#607D8B" />
      </LinearGradient>
      <LinearGradient id="metalTop" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#B0BEC5" />
        <Stop offset="100%" stopColor="#90A4AE" />
      </LinearGradient>
      <LinearGradient id="torchBody" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0%" stopColor="#37474F" />
        <Stop offset="20%" stopColor="#455A64" />
        <Stop offset="50%" stopColor="#546E7A" />
        <Stop offset="75%" stopColor="#455A64" />
        <Stop offset="100%" stopColor="#37474F" />
      </LinearGradient>
      <LinearGradient id="torchTip" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#8D6E63" />
        <Stop offset="50%" stopColor="#A1887F" />
        <Stop offset="100%" stopColor="#6D4C41" />
      </LinearGradient>
      <LinearGradient id="torchGrip" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0%" stopColor="#E65100" />
        <Stop offset="30%" stopColor="#F4511E" />
        <Stop offset="60%" stopColor="#FF6E40" />
        <Stop offset="100%" stopColor="#E65100" />
      </LinearGradient>
      <RadialGradient id="sparkCenter" cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0%" stopColor="#FFFFFF" />
        <Stop offset="30%" stopColor="#FFF9C4" />
        <Stop offset="60%" stopColor="#FFD54F" />
        <Stop offset="100%" stopColor="#FF8F00" stopOpacity="0" />
      </RadialGradient>
      <RadialGradient id="sparkGlow" cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0%" stopColor="#FFD54F" stopOpacity="0.6" />
        <Stop offset="50%" stopColor="#FF8F00" stopOpacity="0.2" />
        <Stop offset="100%" stopColor="#FF6F00" stopOpacity="0" />
      </RadialGradient>
      <LinearGradient id="weldHot" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0%" stopColor="#FF6F00" stopOpacity="0" />
        <Stop offset="30%" stopColor="#FF8F00" />
        <Stop offset="50%" stopColor="#FFC107" />
        <Stop offset="70%" stopColor="#FF8F00" />
        <Stop offset="100%" stopColor="#FF6F00" stopOpacity="0" />
      </LinearGradient>
    </Defs>

    {/* METAL PIECES */}
    <G>
      {/* Left metal plate */}
      <Path d="M10,128 L90,118 L90,128 L10,138 Z" fill="url(#metalTop)" stroke="#607D8B" strokeWidth="0.8" />
      <Path d="M10,138 L90,128 L90,172 L10,182 Z" fill="url(#metalG)" stroke="#607D8B" strokeWidth="0.8" />
      <Line x1="18" y1="142" x2="18" y2="178" stroke="#CFD8DC" strokeWidth="2" opacity="0.25" strokeLinecap="round" />
      <Line x1="12" y1="138" x2="88" y2="128" stroke="#CFD8DC" strokeWidth="1" opacity="0.3" strokeLinecap="round" />

      {/* Right metal plate */}
      <Path d="M94,117 L190,108 L190,118 L94,127 Z" fill="url(#metalTop)" stroke="#607D8B" strokeWidth="0.8" />
      <Path d="M94,127 L190,118 L190,162 L94,171 Z" fill="url(#metalG)" stroke="#607D8B" strokeWidth="0.8" />
      <Line x1="180" y1="122" x2="180" y2="158" stroke="#CFD8DC" strokeWidth="2" opacity="0.25" strokeLinecap="round" />
      <Line x1="96" y1="127" x2="188" y2="118" stroke="#CFD8DC" strokeWidth="1" opacity="0.3" strokeLinecap="round" />

      {/* Seam */}
      <Line x1="92" y1="118" x2="92" y2="172" stroke="#37474F" strokeWidth="2.5" opacity="0.5" />
    </G>

    {/* WELD SEAM */}
    <G>
      <Line x1="92" y1="140" x2="92" y2="172" stroke="url(#weldHot)" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      <Path d="M90.5,160 Q92,158 93.5,160 Q92,162 90.5,160" fill="#78909C" opacity="0.4" />
      <Path d="M90.5,166 Q92,164 93.5,166 Q92,168 90.5,166" fill="#78909C" opacity="0.4" />
      <Path d="M90.5,154 Q92,152 93.5,154 Q92,156 90.5,154" fill="#90A4AE" opacity="0.35" />
    </G>

    {/* WELDING TORCH */}
    <G>
      <G transform="rotate(-50, 92, 132)">
        <Rect x="82" y="46" width="20" height="86" rx="4" fill="url(#torchBody)" stroke="#263238" strokeWidth="0.8" />
        <Line x1="86" y1="52" x2="86" y2="126" stroke="#607D8B" strokeWidth="2" opacity="0.3" strokeLinecap="round" />
        <Rect x="80" y="56" width="24" height="36" rx="5" fill="url(#torchGrip)" stroke="#BF360C" strokeWidth="0.8" />
        <G stroke="#BF360C" strokeWidth="0.6" opacity="0.35">
          <Line x1="83" y1="62" x2="101" y2="62" />
          <Line x1="83" y1="66" x2="101" y2="66" />
          <Line x1="83" y1="70" x2="101" y2="70" />
          <Line x1="83" y1="74" x2="101" y2="74" />
          <Line x1="83" y1="78" x2="101" y2="78" />
          <Line x1="83" y1="82" x2="101" y2="82" />
          <Line x1="83" y1="86" x2="101" y2="86" />
        </G>
        <Line x1="83" y1="60" x2="83" y2="88" stroke="#FF8A65" strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />
        <Path d="M80,72 L74,76 L74,82 L80,80" fill="#455A64" stroke="#37474F" strokeWidth="0.5" />
        <Rect x="80" y="118" width="24" height="8" rx="2" fill="#546E7A" stroke="#37474F" strokeWidth="0.6" />
        <Line x1="82" y1="120" x2="102" y2="120" stroke="#78909C" strokeWidth="0.6" opacity="0.4" />
        <Line x1="82" y1="124" x2="102" y2="124" stroke="#78909C" strokeWidth="0.6" opacity="0.4" />
        <Path d="M86,126 L84,140 Q84,144 92,144 Q100,144 100,140 L98,126 Z" fill="url(#torchTip)" stroke="#5D4037" strokeWidth="0.6" />
        <Line x1="88" y1="128" x2="87" y2="140" stroke="#BCAAA4" strokeWidth="1.2" opacity="0.3" strokeLinecap="round" />
        <Line x1="92" y1="144" x2="92" y2="152" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round" />
        <Path d="M92,46 Q92,36 86,30 Q78,22 72,16" fill="none" stroke="#37474F" strokeWidth="6" strokeLinecap="round" />
        <Path d="M92,46 Q92,36 86,30 Q78,22 72,16" fill="none" stroke="#455A64" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      </G>
    </G>

    {/* SPARKS */}
    <G>
      <Circle cx="92" cy="132" r="8" fill="url(#sparkGlow)" />
      <Circle cx="92" cy="132" r="4" fill="url(#sparkCenter)" />

      <G stroke="#FFD54F" strokeWidth="1.5" strokeLinecap="round">
        <Line x1="88" y1="130" x2="62" y2="110" opacity="0.7" />
        <Line x1="86" y1="132" x2="54" y2="124" opacity="0.6" />
        <Line x1="86" y1="134" x2="58" y2="142" opacity="0.5" />
        <Line x1="84" y1="128" x2="64" y2="104" opacity="0.5" />
        <Line x1="88" y1="136" x2="66" y2="150" opacity="0.4" />
        <Line x1="96" y1="130" x2="122" y2="108" opacity="0.7" />
        <Line x1="98" y1="132" x2="130" y2="120" opacity="0.6" />
        <Line x1="96" y1="136" x2="124" y2="148" opacity="0.5" />
        <Line x1="98" y1="128" x2="126" y2="104" opacity="0.5" />
        <Line x1="90" y1="128" x2="76" y2="100" opacity="0.55" />
        <Line x1="94" y1="128" x2="108" y2="98" opacity="0.55" />
        <Line x1="92" y1="128" x2="92" y2="102" opacity="0.4" />
        <Line x1="90" y1="136" x2="78" y2="158" opacity="0.35" />
        <Line x1="94" y1="136" x2="106" y2="156" opacity="0.35" />
      </G>

      <G fill="#FFF9C4">
        <Circle cx="62" cy="110" r="2" opacity="0.8" />
        <Circle cx="54" cy="124" r="1.8" opacity="0.7" />
        <Circle cx="58" cy="142" r="1.5" opacity="0.6" />
        <Circle cx="64" cy="104" r="1.5" opacity="0.6" />
        <Circle cx="66" cy="150" r="1.2" opacity="0.5" />
        <Circle cx="122" cy="108" r="2" opacity="0.8" />
        <Circle cx="130" cy="120" r="1.8" opacity="0.7" />
        <Circle cx="124" cy="148" r="1.5" opacity="0.6" />
        <Circle cx="126" cy="104" r="1.5" opacity="0.6" />
        <Circle cx="76" cy="100" r="1.8" opacity="0.65" />
        <Circle cx="108" cy="98" r="1.8" opacity="0.65" />
        <Circle cx="92" cy="102" r="1.2" opacity="0.5" />
        <Circle cx="78" cy="158" r="1.2" opacity="0.4" />
        <Circle cx="106" cy="156" r="1.2" opacity="0.4" />
      </G>

      <G fill="#FFB300" opacity="0.4">
        <Circle cx="50" cy="136" r="1" />
        <Circle cx="44" cy="148" r="0.8" />
        <Circle cx="70" cy="154" r="0.9" />
        <Circle cx="136" cy="132" r="1" />
        <Circle cx="140" cy="144" r="0.8" />
        <Circle cx="114" cy="152" r="0.7" />
        <Circle cx="68" cy="98" r="0.8" />
        <Circle cx="116" cy="96" r="0.8" />
      </G>
    </G>

    {/* Heat glow */}
    <G opacity="0.12">
      <Ellipse cx="82" cy="136" rx="12" ry="8" fill="#FF6F00" />
      <Ellipse cx="102" cy="134" rx="12" ry="8" fill="#FF6F00" />
    </G>
  </Svg>
);

export default WelderIcon;

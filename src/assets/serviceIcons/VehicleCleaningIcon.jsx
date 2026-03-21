import React from 'react';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, G, Path, Circle, Ellipse, Line } from 'react-native-svg';

const VehicleCleaningIcon = ({ size = 52 }) => (
  <Svg viewBox="0 0 200 200" width={size} height={size}>
    <Defs>
      <RadialGradient id="vc_tireOuter" cx="0.48" cy="0.46" r="0.52">
        <Stop offset="0%" stopColor="#2E2E2E" />
        <Stop offset="40%" stopColor="#1A1A1A" />
        <Stop offset="70%" stopColor="#0F0F0F" />
        <Stop offset="90%" stopColor="#080808" />
        <Stop offset="100%" stopColor="#040404" />
      </RadialGradient>
      <RadialGradient id="vc_sidewall" cx="0.46" cy="0.44" r="0.48">
        <Stop offset="0%" stopColor="#2A2A2A" />
        <Stop offset="50%" stopColor="#1C1C1C" />
        <Stop offset="100%" stopColor="#111111" />
      </RadialGradient>
      <RadialGradient id="vc_rimFace" cx="0.42" cy="0.4" r="0.55">
        <Stop offset="0%" stopColor="#E8E8E8" />
        <Stop offset="20%" stopColor="#D0D0D0" />
        <Stop offset="45%" stopColor="#B0B0B0" />
        <Stop offset="70%" stopColor="#909090" />
        <Stop offset="100%" stopColor="#606060" />
      </RadialGradient>
      <RadialGradient id="vc_rimLip" cx="0.45" cy="0.43" r="0.5">
        <Stop offset="0%" stopColor="#D8D8D8" />
        <Stop offset="50%" stopColor="#A8A8A8" />
        <Stop offset="100%" stopColor="#787878" />
      </RadialGradient>
      <LinearGradient id="vc_spoke" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#D0D0D0" />
        <Stop offset="40%" stopColor="#B8B8B8" />
        <Stop offset="100%" stopColor="#808080" />
      </LinearGradient>
      <RadialGradient id="vc_cap" cx="0.4" cy="0.38" r="0.5">
        <Stop offset="0%" stopColor="#E0E0E0" />
        <Stop offset="40%" stopColor="#C8C8C8" />
        <Stop offset="80%" stopColor="#A0A0A0" />
        <Stop offset="100%" stopColor="#707070" />
      </RadialGradient>
      <RadialGradient id="vc_capRing" cx="0.4" cy="0.38" r="0.5">
        <Stop offset="0%" stopColor="#F0F0F0" />
        <Stop offset="50%" stopColor="#C0C0C0" />
        <Stop offset="100%" stopColor="#888888" />
      </RadialGradient>
    </Defs>

    {/* TIRE */}
    <Circle cx="100" cy="100" r="92" fill="url(#vc_tireOuter)" stroke="#050505" strokeWidth="1" />
    <Circle cx="100" cy="100" r="92" fill="none" stroke="#181818" strokeWidth="3" />

    {/* Tread grooves — each in its own rotated G */}
    {[0,10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180,190,200,210,220,230,240,250,260,270,280,290,300,310,320,330,340,350].map(deg => (
      <G key={deg} rotation={deg} origin="100,100">
        <Line x1="100" y1="6" x2="100" y2="16" stroke="#0A0A0A" strokeWidth="2.5" opacity="0.7" />
      </G>
    ))}

    {/* Sidewall */}
    <Circle cx="100" cy="100" r="78" fill="url(#vc_sidewall)" stroke="#151515" strokeWidth="0.5" />
    <Circle cx="100" cy="100" r="76" fill="none" stroke="#222" strokeWidth="0.8" />
    <Circle cx="100" cy="100" r="72" fill="none" stroke="#1E1E1E" strokeWidth="0.5" />
    <Circle cx="100" cy="100" r="82" fill="none" stroke="#1A1A1A" strokeWidth="0.6" />

    {/* Tire highlight */}
    <Path d="M36,56 Q60,22 120,28" fill="none" stroke="#3A3A3A" strokeWidth="3" strokeLinecap="round" opacity="0.5" />

    {/* RIM LIP */}
    <Circle cx="100" cy="100" r="66" fill="url(#vc_rimLip)" stroke="#606060" strokeWidth="1" />
    <Path d="M40,82 Q60,58 100,54 Q130,58 148,74" fill="none" stroke="#E8E8E8" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    <Circle cx="100" cy="100" r="62" fill="none" stroke="#888" strokeWidth="0.6" />

    {/* RIM FACE */}
    <Circle cx="100" cy="100" r="60" fill="url(#vc_rimFace)" stroke="#707070" strokeWidth="0.5" />

    {/* Spoke recesses */}
    <G fill="#404040" opacity="0.6">
      <Path d="M100,100 L88,50 Q94,44 100,44 Q106,44 112,50 Z" />
      <Path d="M100,100 L142,72 Q148,80 148,88 Q146,96 140,100 Z" />
      <Path d="M100,100 L130,144 Q124,152 116,154 Q108,154 104,148 Z" />
      <Path d="M100,100 L70,144 Q64,140 60,132 Q58,124 62,116 Z" />
      <Path d="M100,100 L52,78 Q54,68 60,62 Q68,56 76,56 Z" />
    </G>

    {/* 5 spokes */}
    <G fill="url(#vc_spoke)" stroke="#808080" strokeWidth="0.5">
      <Path d="M92,46 L100,76 L108,46 Q104,42 100,42 Q96,42 92,46 Z" />
      <Path d="M140,70 L108,92 L146,96 Q148,88 146,80 Q144,74 140,70 Z" />
      <Path d="M132,142 L106,106 L110,150 Q118,152 126,148 Q130,146 132,142 Z" />
      <Path d="M68,142 L94,106 L62,118 Q58,126 60,134 Q64,140 68,142 Z" />
      <Path d="M54,76 L90,94 L76,54 Q68,56 62,62 Q56,68 54,76 Z" />
    </G>

    {/* Spoke highlights */}
    <G stroke="#D0D0D0" strokeWidth="0.7" strokeLinecap="round" opacity="0.4">
      <Line x1="94" y1="46" x2="100" y2="76" />
      <Line x1="140" y1="72" x2="108" y2="92" />
      <Line x1="130" y1="142" x2="106" y2="106" />
      <Line x1="68" y1="140" x2="94" y2="106" />
      <Line x1="56" y1="76" x2="90" y2="94" />
    </G>

    {/* Spoke shadows */}
    <G stroke="#555" strokeWidth="0.5" strokeLinecap="round" opacity="0.4">
      <Line x1="106" y1="46" x2="100" y2="76" />
      <Line x1="146" y1="94" x2="108" y2="92" />
      <Line x1="108" y1="150" x2="106" y2="106" />
      <Line x1="62" y1="120" x2="94" y2="106" />
      <Line x1="76" y1="56" x2="90" y2="94" />
    </G>

    {/* CENTER CAP */}
    <Circle cx="100" cy="100" r="18" fill="url(#vc_capRing)" stroke="#707070" strokeWidth="0.8" />
    <Path d="M86,92 Q92,84 106,86" fill="none" stroke="#F0F0F0" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
    <Circle cx="100" cy="100" r="14" fill="url(#vc_cap)" stroke="#808080" strokeWidth="0.5" />
    <Circle cx="100" cy="100" r="11" fill="none" stroke="#999" strokeWidth="0.4" />

    {/* S Logo */}
    <Path d="M106,92 Q112,90 112,94 Q112,98 106,98 Q100,98 100,96 L100,96 Q100,98 94,98 Q88,98 88,102 Q88,106 94,108 Q100,110 106,108" fill="none" stroke="#444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

    <Ellipse cx="96" cy="95" rx="6" ry="4" fill="white" opacity="0.15" transform="rotate(-20,96,95)" />

    {/* Overall shine */}
    <Path d="M56,68 Q72,50 104,54 Q120,58 132,72" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.12" />
  </Svg>
);

export default VehicleCleaningIcon;

import React from 'react';
import Svg, { Defs, LinearGradient, Stop, G, Path, Rect, Circle, Ellipse, Line } from 'react-native-svg';

const CarpenterIcon = ({ size = 52 }) => (
  <Svg viewBox="0 0 200 200" width={size} height={size}>
    <Defs>
      <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#FFF8E1" />
        <Stop offset="100%" stopColor="#FFECB3" />
      </LinearGradient>
      <LinearGradient id="bladeG" x1="0" y1="0" x2="0.5" y2="1">
        <Stop offset="0%" stopColor="#B0BEC5" />
        <Stop offset="20%" stopColor="#CFD8DC" />
        <Stop offset="45%" stopColor="#ECEFF1" />
        <Stop offset="65%" stopColor="#CFD8DC" />
        <Stop offset="100%" stopColor="#90A4AE" />
      </LinearGradient>
      <LinearGradient id="handleG" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#E65100" />
        <Stop offset="35%" stopColor="#D84315" />
        <Stop offset="100%" stopColor="#8D2C0B" />
      </LinearGradient>
      <LinearGradient id="handleHole" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#4E342E" />
        <Stop offset="100%" stopColor="#3E2723" />
      </LinearGradient>
      <LinearGradient id="logG" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#DEB887" />
        <Stop offset="25%" stopColor="#D2A870" />
        <Stop offset="50%" stopColor="#C49A5C" />
        <Stop offset="75%" stopColor="#B8925A" />
        <Stop offset="100%" stopColor="#A67C52" />
      </LinearGradient>
      <LinearGradient id="logEnd" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0%" stopColor="#FFD8A8" />
        <Stop offset="50%" stopColor="#F0C88C" />
        <Stop offset="100%" stopColor="#E0B878" />
      </LinearGradient>
      <LinearGradient id="bark" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#6D4C41" />
        <Stop offset="50%" stopColor="#5D4037" />
        <Stop offset="100%" stopColor="#4E342E" />
      </LinearGradient>
    </Defs>


    {/* WOODEN LOG */}
    <G>
      <Rect x="20" y="108" width="160" height="52" rx="6" fill="url(#logG)" stroke="#8D6E63" strokeWidth="1.2" />
      <Path d="M26,108 L174,108 Q180,108 180,114 L180,114 L20,114 Q20,108 26,108 Z" fill="url(#bark)" opacity="0.35" />
      <Path d="M20,152 L180,152 Q180,160 174,160 L26,160 Q20,160 20,152 Z" fill="url(#bark)" opacity="0.25" />
      <G stroke="#A67C52" strokeWidth="0.7" opacity="0.4" fill="none">
        <Path d="M30,118 Q44,126 30,140" />
        <Path d="M52,116 Q64,128 50,144" />
        <Path d="M74,115 Q86,127 74,143" />
        <Path d="M130,116 Q142,128 130,142" />
        <Path d="M152,117 Q162,127 152,141" />
      </G>
      <G stroke="#C49A5C" strokeWidth="0.4" opacity="0.3">
        <Line x1="26" y1="126" x2="174" y2="126" />
        <Line x1="26" y1="134" x2="174" y2="134" />
        <Line x1="26" y1="142" x2="174" y2="142" />
      </G>
      <Line x1="30" y1="112" x2="170" y2="112" stroke="#E8D4A8" strokeWidth="1.5" opacity="0.4" strokeLinecap="round" />
      <Ellipse cx="20" cy="134" rx="8" ry="26" fill="url(#logEnd)" stroke="#A67C52" strokeWidth="0.8" />
      <Ellipse cx="20" cy="134" rx="5" ry="18" fill="none" stroke="#C49A5C" strokeWidth="0.5" opacity="0.5" />
      <Ellipse cx="20" cy="134" rx="3" ry="11" fill="none" stroke="#C49A5C" strokeWidth="0.4" opacity="0.4" />
      <Ellipse cx="20" cy="134" rx="1.2" ry="5" fill="none" stroke="#B8925A" strokeWidth="0.4" opacity="0.45" />
      <Circle cx="20" cy="134" r="1.5" fill="#B8925A" opacity="0.4" />

      {/* Fixhomi brand burned into wood */}
      <G transform="translate(100, 126)">
        <Rect x="-4" y="-6" width="82" height="20" rx="3" fill="#5D4037" opacity="0.08" />
        <Path d="M0,0 L0,12 M0,0 L7,0 M0,5.5 L5,5.5" fill="none" stroke="#4E342E" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
        <Path d="M11,3 L11,12" fill="none" stroke="#4E342E" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
        <Circle cx="11" cy="0" r="1" fill="#4E342E" opacity="0.6" />
        <Path d="M16,3 L22,12 M22,3 L16,12" fill="none" stroke="#4E342E" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
        <Path d="M26,0 L26,12 M26,6 Q30,3 33,6 L33,12" fill="none" stroke="#4E342E" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
        <Ellipse cx="40" cy="7.5" rx="4" ry="4.5" fill="none" stroke="#4E342E" strokeWidth="1.8" opacity="0.65" />
        <Path d="M48,12 L48,5 Q51,3 53,5 L53,12 M53,5 Q56,3 58,5 L58,12" fill="none" stroke="#4E342E" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
        <Path d="M63,3 L63,12" fill="none" stroke="#4E342E" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
        <Circle cx="63" cy="0" r="1" fill="#4E342E" opacity="0.6" />
        <Rect x="-6" y="-8" width="86" height="24" rx="4" fill="#5D4037" opacity="0.04" />
      </G>
    </G>

    {/* SAW */}
    <G transform="rotate(-38, 120, 110)">
      <Path d="M42,78 L42,108 L192,108 L196,94 L196,92 L192,78 Z" fill="url(#bladeG)" stroke="#78909C" strokeWidth="1" />
      <Line x1="50" y1="84" x2="188" y2="84" stroke="#ECEFF1" strokeWidth="2.2" opacity="0.45" strokeLinecap="round" />
      <Line x1="50" y1="98" x2="188" y2="98" stroke="#B0BEC5" strokeWidth="0.5" opacity="0.2" />
      <Rect x="90" y="88" width="40" height="8" rx="2" fill="#B0BEC5" opacity="0.1" />
      <Path d="M42,108 L46,104 L50,108 L54,104 L58,108 L62,104 L66,108 L70,104 L74,108 L78,104 L82,108 L86,104 L90,108 L94,104 L98,108 L102,104 L106,108 L110,104 L114,108 L118,104 L122,108 L126,104 L130,108 L134,104 L138,108 L142,104 L146,108 L150,104 L154,108 L158,104 L162,108 L166,104 L170,108 L174,104 L178,108 L182,104 L186,108 L190,104 L192,108" fill="url(#bladeG)" stroke="#607D8B" strokeWidth="0.5" />
      <Line x1="194" y1="86" x2="194" y2="106" stroke="#ECEFF1" strokeWidth="1" opacity="0.25" strokeLinecap="round" />
      <Path d="M18,64 Q12,66 10,72 L8,82 Q8,88 10,92 L16,104 Q20,110 24,114 L30,120 Q34,124 38,124 L46,124 L46,108 L42,108 L42,78 L32,72 Q26,68 18,64 Z" fill="url(#handleG)" stroke="#7F1D00" strokeWidth="1" />
      <Path d="M16,74 Q14,80 16,88 L22,100 Q24,106 28,110 L34,116 L42,116 L42,92 L34,84 Q28,78 22,74 Z" fill="url(#handleHole)" stroke="#3E2723" strokeWidth="0.5" />
      <G stroke="#7F1D00" strokeWidth="0.5" opacity="0.3">
        <Line x1="14" y1="76" x2="22" y2="80" />
        <Line x1="12" y1="82" x2="24" y2="90" />
        <Line x1="12" y1="88" x2="26" y2="96" />
        <Line x1="14" y1="94" x2="28" y2="104" />
        <Line x1="16" y1="100" x2="30" y2="110" />
        <Line x1="20" y1="106" x2="34" y2="116" />
      </G>
      <Path d="M16,68 Q14,78 16,90" fill="none" stroke="#FF8F00" strokeWidth="1.2" opacity="0.3" strokeLinecap="round" />
      <Circle cx="38" cy="88" r="3.5" fill="#78909C" stroke="#546E7A" strokeWidth="0.8" />
      <Circle cx="37.5" cy="87.5" r="1.2" fill="#CFD8DC" opacity="0.5" />
      <Circle cx="42" cy="104" r="3" fill="#78909C" stroke="#546E7A" strokeWidth="0.8" />
      <Circle cx="41.5" cy="103.5" r="1" fill="#CFD8DC" opacity="0.5" />
    </G>

    {/* Cut line */}
    <Line x1="112" y1="108" x2="128" y2="160" stroke="#8D6E63" strokeWidth="1.5" opacity="0.3" />

    {/* Sawdust */}
    <G fill="#D7A96B" opacity="0.5">
      <Circle cx="118" cy="165" r="1.5" />
      <Circle cx="122" cy="168" r="1.1" />
      <Circle cx="114" cy="167" r="0.9" />
      <Circle cx="126" cy="166" r="1.3" />
      <Circle cx="120" cy="170" r="0.8" />
      <Circle cx="116" cy="172" r="0.7" />
      <Circle cx="128" cy="170" r="1" />
      <Circle cx="112" cy="170" r="0.6" />
      <Circle cx="124" cy="173" r="0.5" />
    </G>
  </Svg>
);

export default CarpenterIcon;

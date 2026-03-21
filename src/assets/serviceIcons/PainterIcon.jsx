import React from 'react';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, G, Path, Rect, Circle, Ellipse, Line } from 'react-native-svg';

const PainterIcon = ({ size = 52 }) => (
  <Svg viewBox="0 0 200 200" width={size} height={size}>
    <Defs>
      <LinearGradient id="bucketBody" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0%" stopColor="#00695C" />
        <Stop offset="15%" stopColor="#00796B" />
        <Stop offset="38%" stopColor="#00897B" />
        <Stop offset="52%" stopColor="#26A69A" />
        <Stop offset="68%" stopColor="#00897B" />
        <Stop offset="85%" stopColor="#00796B" />
        <Stop offset="100%" stopColor="#00695C" />
      </LinearGradient>
      <LinearGradient id="rimG" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#90A4AE" />
        <Stop offset="30%" stopColor="#CFD8DC" />
        <Stop offset="50%" stopColor="#ECEFF1" />
        <Stop offset="70%" stopColor="#CFD8DC" />
        <Stop offset="100%" stopColor="#90A4AE" />
      </LinearGradient>
      <LinearGradient id="innerG" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#004D40" />
        <Stop offset="100%" stopColor="#00332C" />
      </LinearGradient>
      <LinearGradient id="paintG" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#FFFDE7" />
        <Stop offset="40%" stopColor="#FFF9C4" />
        <Stop offset="100%" stopColor="#F5F0D0" />
      </LinearGradient>
      <RadialGradient id="paintSheen" cx="0.35" cy="0.35" r="0.4">
        <Stop offset="0%" stopColor="white" stopOpacity="0.45" />
        <Stop offset="100%" stopColor="white" stopOpacity="0" />
      </RadialGradient>
      <LinearGradient id="metalH" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0%" stopColor="#78909C" />
        <Stop offset="25%" stopColor="#B0BEC5" />
        <Stop offset="50%" stopColor="#ECEFF1" />
        <Stop offset="75%" stopColor="#B0BEC5" />
        <Stop offset="100%" stopColor="#78909C" />
      </LinearGradient>
      <LinearGradient id="dripG" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#FFFDE7" />
        <Stop offset="100%" stopColor="#F0E8C0" />
      </LinearGradient>
      <LinearGradient id="rollerSleeve" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#E8E0D4" />
        <Stop offset="12%" stopColor="#F5EFE6" />
        <Stop offset="30%" stopColor="#FAF6F0" />
        <Stop offset="50%" stopColor="#F5EFE6" />
        <Stop offset="70%" stopColor="#E8E0D4" />
        <Stop offset="88%" stopColor="#DDD4C6" />
        <Stop offset="100%" stopColor="#D0C5B4" />
      </LinearGradient>
      <LinearGradient id="rollerPaint" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#FFF9C4" />
        <Stop offset="20%" stopColor="#FFFDE7" />
        <Stop offset="50%" stopColor="#FFF9C4" />
        <Stop offset="80%" stopColor="#FFFDE7" />
        <Stop offset="100%" stopColor="#F5F0D0" />
      </LinearGradient>
      <LinearGradient id="rollerFrame" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0%" stopColor="#757575" />
        <Stop offset="30%" stopColor="#9E9E9E" />
        <Stop offset="50%" stopColor="#BDBDBD" />
        <Stop offset="70%" stopColor="#9E9E9E" />
        <Stop offset="100%" stopColor="#757575" />
      </LinearGradient>
      <LinearGradient id="gripG" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0%" stopColor="#1565C0" />
        <Stop offset="25%" stopColor="#1976D2" />
        <Stop offset="50%" stopColor="#1E88E5" />
        <Stop offset="75%" stopColor="#1976D2" />
        <Stop offset="100%" stopColor="#1565C0" />
      </LinearGradient>
      <LinearGradient id="rollerEnd" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0%" stopColor="#616161" />
        <Stop offset="50%" stopColor="#9E9E9E" />
        <Stop offset="100%" stopColor="#616161" />
      </LinearGradient>
    </Defs>

    {/* PAINT BUCKET */}
    <G>
      <Path d="M22,66 L18,162 Q18,172 30,172 L122,172 Q134,172 134,162 L130,66 Z" fill="url(#bucketBody)" stroke="#004D40" strokeWidth="1.2" />
      <Path d="M32,72 L30,162" stroke="#26A69A" strokeWidth="5" opacity="0.3" strokeLinecap="round" />
      <Path d="M42,70 L40,164" stroke="#4DB6AC" strokeWidth="2.5" opacity="0.2" strokeLinecap="round" />
      <Path d="M122,72 L120,162" stroke="#004D40" strokeWidth="4" opacity="0.2" strokeLinecap="round" />
      <Path d="M24,100 L128,100" stroke="#00695C" strokeWidth="2.5" opacity="0.3" />
      <Path d="M24,102 L128,102" stroke="#26A69A" strokeWidth="0.7" opacity="0.2" />
      <Path d="M22,136 L130,136" stroke="#00695C" strokeWidth="2" opacity="0.25" />
      <Rect x="44" y="108" width="64" height="20" rx="3" fill="#004D40" opacity="0.15" />
      <Rect x="50" y="114" width="34" height="3" rx="1.5" fill="#004D40" opacity="0.12" />
      <Rect x="50" y="120" width="48" height="2.5" rx="1" fill="#004D40" opacity="0.08" />
      <Ellipse cx="76" cy="66" rx="58" ry="9" fill="url(#rimG)" stroke="#78909C" strokeWidth="0.8" />
      <Ellipse cx="76" cy="64" rx="50" ry="5.5" fill="none" stroke="#ECEFF1" strokeWidth="0.8" opacity="0.4" />
      <Ellipse cx="76" cy="66" rx="52" ry="6" fill="url(#innerG)" />
      <Ellipse cx="76" cy="64" rx="48" ry="5" fill="url(#paintG)" />
      <Ellipse cx="76" cy="64" rx="48" ry="5" fill="url(#paintSheen)" />
      <Ellipse cx="62" cy="62.5" rx="16" ry="2" fill="white" opacity="0.28" />
      <Path d="M38,60 Q38,22 76,16 Q114,22 114,60" fill="none" stroke="url(#metalH)" strokeWidth="5" strokeLinecap="round" />
      <Circle cx="38" cy="62" r="4" fill="#90A4AE" stroke="#607D8B" strokeWidth="0.8" />
      <Circle cx="37" cy="61" r="1.4" fill="#CFD8DC" opacity="0.5" />
      <Circle cx="114" cy="62" r="4" fill="#90A4AE" stroke="#607D8B" strokeWidth="0.8" />
      <Circle cx="113" cy="61" r="1.4" fill="#CFD8DC" opacity="0.5" />
      <Path d="M100,66 Q102,66 102,72 L102,96 Q102,102 98,103 Q94,104 94,98 L94,76 Q94,70 96,66" fill="url(#dripG)" stroke="#E0D8B0" strokeWidth="0.4" opacity="0.85" />
      <Line x1="97" y1="70" x2="97" y2="94" stroke="white" strokeWidth="0.8" opacity="0.2" strokeLinecap="round" />
      <Path d="M54,66 Q56,66 56,70 L56,80 Q56,84 54,85 Q52,86 52,82 L52,72 Q52,68 54,66" fill="url(#dripG)" stroke="#E0D8B0" strokeWidth="0.3" opacity="0.6" />
      <Ellipse cx="76" cy="176" rx="50" ry="4" fill="#1B3530" opacity="0.08" />
    </G>

    {/* PAINT ROLLER */}
    <G>
      <G transform="rotate(-15, 155, 140)">
        <Rect x="144" y="110" width="22" height="68" rx="7" fill="url(#gripG)" stroke="#0D47A1" strokeWidth="0.8" />
        <G stroke="#0D47A1" strokeWidth="0.6" opacity="0.3">
          <Line x1="148" y1="120" x2="162" y2="120" />
          <Line x1="148" y1="125" x2="162" y2="125" />
          <Line x1="148" y1="130" x2="162" y2="130" />
          <Line x1="148" y1="135" x2="162" y2="135" />
          <Line x1="148" y1="140" x2="162" y2="140" />
          <Line x1="148" y1="145" x2="162" y2="145" />
          <Line x1="148" y1="150" x2="162" y2="150" />
          <Line x1="148" y1="155" x2="162" y2="155" />
          <Line x1="148" y1="160" x2="162" y2="160" />
          <Line x1="148" y1="165" x2="162" y2="165" />
        </G>
        <Line x1="148" y1="114" x2="148" y2="172" stroke="#42A5F5" strokeWidth="2" opacity="0.25" strokeLinecap="round" />
        <Ellipse cx="155" cy="178" rx="11" ry="4" fill="#1565C0" stroke="#0D47A1" strokeWidth="0.5" />
        <Ellipse cx="155" cy="110" rx="11" ry="3.5" fill="#1976D2" stroke="#0D47A1" strokeWidth="0.5" />
      </G>

      <Path d="M152,96 L152,54 L186,54" fill="none" stroke="url(#rollerFrame)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M150,94 L150,56 L184,56" fill="none" stroke="#BDBDBD" strokeWidth="1" opacity="0.35" strokeLinecap="round" strokeLinejoin="round" />
      <Ellipse cx="152" cy="97" rx="4" ry="3" fill="#9E9E9E" stroke="#757575" strokeWidth="0.5" />

      <Rect x="160" y="28" width="52" height="52" rx="8" fill="url(#rollerSleeve)" stroke="#C0B8A8" strokeWidth="0.8" transform="rotate(90, 186, 54)" />
      <Ellipse cx="160" cy="54" rx="5" ry="14" fill="url(#rollerEnd)" stroke="#616161" strokeWidth="0.6" />
      <Ellipse cx="196" cy="54" rx="5" ry="14" fill="url(#rollerEnd)" stroke="#616161" strokeWidth="0.6" />
      <Ellipse cx="197" cy="54" rx="3" ry="10" fill="#757575" opacity="0.3" />
      <Rect x="160" y="40" width="36" height="28" rx="6" fill="url(#rollerSleeve)" stroke="#C0B8A8" strokeWidth="0.6" />
      <G opacity="0.15">
        <Line x1="163" y1="44" x2="163" y2="64" stroke="#A09888" strokeWidth="0.8" />
        <Line x1="167" y1="42" x2="167" y2="66" stroke="#A09888" strokeWidth="0.8" />
        <Line x1="171" y1="41" x2="171" y2="67" stroke="#A09888" strokeWidth="0.8" />
        <Line x1="175" y1="40" x2="175" y2="68" stroke="#A09888" strokeWidth="0.8" />
        <Line x1="179" y1="40" x2="179" y2="68" stroke="#A09888" strokeWidth="0.8" />
        <Line x1="183" y1="41" x2="183" y2="67" stroke="#A09888" strokeWidth="0.8" />
        <Line x1="187" y1="42" x2="187" y2="66" stroke="#A09888" strokeWidth="0.8" />
        <Line x1="191" y1="44" x2="191" y2="64" stroke="#A09888" strokeWidth="0.8" />
      </G>
      <Rect x="160" y="42" width="36" height="24" rx="5" fill="url(#rollerPaint)" opacity="0.5" />
      <Rect x="162" y="43" width="32" height="6" rx="3" fill="white" opacity="0.15" />
      <Line x1="164" y1="42" x2="192" y2="42" stroke="white" strokeWidth="1.2" opacity="0.2" strokeLinecap="round" />
      <Path d="M172,68 L172,72 Q172,76 174,76 Q176,76 176,72 L176,69" fill="url(#dripG)" stroke="#E8E0C0" strokeWidth="0.3" opacity="0.5" />
      <Ellipse cx="174" cy="78" rx="2.5" ry="3" fill="#FFF9C4" opacity="0.35" />
      <Path d="M184,68 L184,70" stroke="#FFF9C4" strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />
      <Ellipse cx="184" cy="72" rx="1.5" ry="2" fill="#FFF9C4" opacity="0.25" />
    </G>

    {/* Paint splatter */}
    <G fill="#FFF9C4" opacity="0.15">
      <Circle cx="14" cy="174" r="2" />
      <Circle cx="170" cy="180" r="1.8" />
      <Circle cx="176" cy="184" r="1.2" />
      <Circle cx="164" cy="182" r="1" />
    </G>
  </Svg>
);

export default PainterIcon;

import React from 'react';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, G, Path, Rect, Circle, Ellipse, Line } from 'react-native-svg';

const SolarIcon = ({ size = 52 }) => (
  <Svg viewBox="0 0 200 200" width={size} height={size}>
    <Defs>
      <LinearGradient id="panelG" x1="0" y1="0" x2="0.5" y2="1">
        <Stop offset="0%" stopColor="#1A237E" />
        <Stop offset="30%" stopColor="#1565C0" />
        <Stop offset="50%" stopColor="#1E88E5" />
        <Stop offset="70%" stopColor="#1565C0" />
        <Stop offset="100%" stopColor="#0D47A1" />
      </LinearGradient>
      <LinearGradient id="cellG" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#1565C0" />
        <Stop offset="35%" stopColor="#1E88E5" />
        <Stop offset="60%" stopColor="#2196F3" />
        <Stop offset="100%" stopColor="#1565C0" />
      </LinearGradient>
      <LinearGradient id="cellShine" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="white" stopOpacity="0.12" />
        <Stop offset="100%" stopColor="white" stopOpacity="0" />
      </LinearGradient>
      <LinearGradient id="frameG" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#90A4AE" />
        <Stop offset="30%" stopColor="#B0BEC5" />
        <Stop offset="50%" stopColor="#CFD8DC" />
        <Stop offset="70%" stopColor="#B0BEC5" />
        <Stop offset="100%" stopColor="#78909C" />
      </LinearGradient>
      <LinearGradient id="standG" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0%" stopColor="#78909C" />
        <Stop offset="30%" stopColor="#90A4AE" />
        <Stop offset="50%" stopColor="#B0BEC5" />
        <Stop offset="70%" stopColor="#90A4AE" />
        <Stop offset="100%" stopColor="#78909C" />
      </LinearGradient>
      <RadialGradient id="sunCore" cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0%" stopColor="#FFF9C4" />
        <Stop offset="40%" stopColor="#FFD54F" />
        <Stop offset="100%" stopColor="#FFC107" />
      </RadialGradient>
      <RadialGradient id="sunGlow" cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0%" stopColor="#FFE082" stopOpacity="0.5" />
        <Stop offset="50%" stopColor="#FFE082" stopOpacity="0.15" />
        <Stop offset="100%" stopColor="#FFE082" stopOpacity="0" />
      </RadialGradient>
    </Defs>

    {/* SUN */}
    <G>
      <Circle cx="36" cy="36" r="34" fill="url(#sunGlow)" />
      <G stroke="#FFC107" strokeWidth="2.5" strokeLinecap="round" opacity="0.55">
        <Line x1="36" y1="4" x2="36" y2="14" />
        <Line x1="58" y1="14" x2="53" y2="21" />
        <Line x1="68" y1="36" x2="58" y2="36" />
        <Line x1="58" y1="58" x2="53" y2="51" />
        <Line x1="36" y1="68" x2="36" y2="58" />
        <Line x1="14" y1="58" x2="19" y2="51" />
        <Line x1="4" y1="36" x2="14" y2="36" />
        <Line x1="14" y1="14" x2="19" y2="21" />
      </G>
      <Circle cx="36" cy="36" r="16" fill="url(#sunCore)" stroke="#FFB300" strokeWidth="1" />
      <Ellipse cx="32" cy="30" rx="6" ry="5" fill="white" opacity="0.35" />
    </G>

    {/* SOLAR PANEL */}
    <G>
      <Path d="M28,78 L172,68 L182,158 L18,168 Z" fill="url(#frameG)" stroke="#607D8B" strokeWidth="1.5" />
      <Path d="M34,82 L166,73 L176,154 L24,163 Z" fill="url(#panelG)" stroke="#0D47A1" strokeWidth="0.8" />

      {/* Row 1 */}
      <Path d="M38,84 L72,81 L73,91 L39,94 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />
      <Path d="M38,84 L72,81 L73,91 L39,94 Z" fill="url(#cellShine)" />
      <Path d="M76,80 L110,77.5 L111,87.5 L77,90 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />
      <Path d="M76,80 L110,77.5 L111,87.5 L77,90 Z" fill="url(#cellShine)" />
      <Path d="M114,77 L148,74.5 L149,84.5 L115,87 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />
      <Path d="M114,77 L148,74.5 L149,84.5 L115,87 Z" fill="url(#cellShine)" />
      <Path d="M152,74 L164,73 L165,83 L153,84 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />

      {/* Row 2 */}
      <Path d="M39,97 L73,94 L74,104 L40,107 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />
      <Path d="M39,97 L73,94 L74,104 L40,107 Z" fill="url(#cellShine)" />
      <Path d="M77,93 L111,90 L112,100 L78,103 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />
      <Path d="M77,93 L111,90 L112,100 L78,103 Z" fill="url(#cellShine)" />
      <Path d="M115,89.5 L149,87 L150,97 L116,99.5 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />
      <Path d="M115,89.5 L149,87 L150,97 L116,99.5 Z" fill="url(#cellShine)" />
      <Path d="M153,86.5 L165,85.5 L166,95.5 L154,96.5 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />

      {/* Row 3 */}
      <Path d="M40,110 L74,107 L75,117 L41,120 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />
      <Path d="M40,110 L74,107 L75,117 L41,120 Z" fill="url(#cellShine)" />
      <Path d="M78,106 L112,103 L113,113 L79,116 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />
      <Path d="M78,106 L112,103 L113,113 L79,116 Z" fill="url(#cellShine)" />
      <Path d="M116,102 L150,99.5 L151,109.5 L117,112 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />
      <Path d="M116,102 L150,99.5 L151,109.5 L117,112 Z" fill="url(#cellShine)" />
      <Path d="M154,99 L166,98 L167,108 L155,109 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />

      {/* Row 4 */}
      <Path d="M41,123 L75,120 L76,130 L42,133 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />
      <Path d="M41,123 L75,120 L76,130 L42,133 Z" fill="url(#cellShine)" />
      <Path d="M79,119 L113,116 L114,126 L80,129 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />
      <Path d="M79,119 L113,116 L114,126 L80,129 Z" fill="url(#cellShine)" />
      <Path d="M117,115 L151,112 L152,122 L118,125 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />
      <Path d="M117,115 L151,112 L152,122 L118,125 Z" fill="url(#cellShine)" />
      <Path d="M155,111.5 L167,110.5 L168,120.5 L156,121.5 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />

      {/* Row 5 */}
      <Path d="M42,136 L76,133 L77,143 L43,146 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />
      <Path d="M42,136 L76,133 L77,143 L43,146 Z" fill="url(#cellShine)" />
      <Path d="M80,132 L114,129 L115,139 L81,142 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />
      <Path d="M80,132 L114,129 L115,139 L81,142 Z" fill="url(#cellShine)" />
      <Path d="M118,128 L152,125 L153,135 L119,138 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />
      <Path d="M118,128 L152,125 L153,135 L119,138 Z" fill="url(#cellShine)" />
      <Path d="M156,124.5 L168,123.5 L169,133.5 L157,134.5 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />

      {/* Row 6 */}
      <Path d="M43,149 L77,146 L78,154 L44,157 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />
      <Path d="M43,149 L77,146 L78,154 L44,157 Z" fill="url(#cellShine)" />
      <Path d="M81,145 L115,142 L116,150 L82,153 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />
      <Path d="M81,145 L115,142 L116,150 L82,153 Z" fill="url(#cellShine)" />
      <Path d="M119,141 L153,138 L154,146 L120,149 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />
      <Path d="M119,141 L153,138 L154,146 L120,149 Z" fill="url(#cellShine)" />
      <Path d="M157,137.5 L169,136.5 L170,144.5 L158,145.5 Z" fill="url(#cellG)" stroke="#0D47A1" strokeWidth="0.5" />

      {/* Grid wires */}
      <G stroke="#90CAF9" strokeWidth="0.3" opacity="0.2">
        <Line x1="36" y1="88" x2="168" y2="79" />
        <Line x1="37" y1="101" x2="169" y2="92" />
        <Line x1="38" y1="114" x2="170" y2="105" />
        <Line x1="39" y1="127" x2="171" y2="118" />
        <Line x1="40" y1="140" x2="172" y2="131" />
        <Line x1="41" y1="153" x2="173" y2="144" />
      </G>

      <Path d="M34,82 L166,73 L168,88 Q100,84 34,98 Z" fill="white" opacity="0.05" />
    </G>

    {/* STAND */}
    <Path d="M90,162 L80,192" stroke="url(#standG)" strokeWidth="5" strokeLinecap="round" />
    <Path d="M110,160 L120,192" stroke="url(#standG)" strokeWidth="5" strokeLinecap="round" />
    <Path d="M84,180 L116,178" stroke="url(#standG)" strokeWidth="3" strokeLinecap="round" />
    <Ellipse cx="79" cy="192" rx="4" ry="2" fill="#78909C" stroke="#607D8B" strokeWidth="0.5" />
    <Ellipse cx="121" cy="192" rx="4" ry="2" fill="#78909C" stroke="#607D8B" strokeWidth="0.5" />

    {/* Sun rays hitting panel */}
    <G stroke="#FFD54F" strokeWidth="1" strokeLinecap="round" opacity="0.2" strokeDasharray="3,4">
      <Line x1="52" y1="52" x2="70" y2="90" />
      <Line x1="58" y1="48" x2="90" y2="84" />
      <Line x1="64" y1="46" x2="110" y2="80" />
      <Line x1="56" y1="56" x2="50" y2="110" />
    </G>
  </Svg>
);

export default SolarIcon;

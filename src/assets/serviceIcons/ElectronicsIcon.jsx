import React from 'react';
import Svg, { Defs, LinearGradient, Stop, G, Path, Rect, Circle, Polygon, Line } from 'react-native-svg';

const ElectronicsIcon = ({ size = 52 }) => (
  <Svg viewBox="0 0 200 200" width={size} height={size}>
    <Defs>
      <LinearGradient id="tvBody" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#37474F" />
        <Stop offset="100%" stopColor="#263238" />
      </LinearGradient>
      <LinearGradient id="screen" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#1565C0" />
        <Stop offset="30%" stopColor="#1E88E5" />
        <Stop offset="60%" stopColor="#42A5F5" />
        <Stop offset="100%" stopColor="#1565C0" />
      </LinearGradient>
      <LinearGradient id="screenShine" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="white" stopOpacity="0.15" />
        <Stop offset="50%" stopColor="white" stopOpacity="0.03" />
        <Stop offset="100%" stopColor="white" stopOpacity="0" />
      </LinearGradient>
      <LinearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#8D6E63" />
        <Stop offset="100%" stopColor="#6D4C41" />
      </LinearGradient>
      <LinearGradient id="woodFront" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#6D4C41" />
        <Stop offset="100%" stopColor="#5D4037" />
      </LinearGradient>
    </Defs>

    {/* TV */}
    <G>
      <Rect x="22" y="18" width="156" height="100" rx="5" fill="url(#tvBody)" stroke="#1a1a2e" strokeWidth="1.2" />
      <Rect x="30" y="24" width="140" height="82" rx="3" fill="url(#screen)" />
      <Path d="M30,24 L170,24 L170,50 Q100,42 30,66 Z" fill="url(#screenShine)" />
      <Polygon points="30,90 60,56 90,90" fill="#0D47A1" opacity="0.4" />
      <Polygon points="70,90 110,48 150,90" fill="#1565C0" opacity="0.35" />
      <Polygon points="120,90 152,60 170,90" fill="#0D47A1" opacity="0.3" />
      <Circle cx="145" cy="40" r="10" fill="#FFD54F" opacity="0.5" />
      <Rect x="30" y="88" width="140" height="18" rx="0" fill="#0D47A1" opacity="0.25" />
      <Rect x="90" y="110" width="20" height="2.5" rx="1.2" fill="#455A64" opacity="0.5" />
      <Circle cx="160" cy="112" r="1.5" fill="#4CAF50" opacity="0.7" />
    </G>

    {/* Wall mount bracket */}
    <Rect x="88" y="118" width="24" height="4" rx="1" fill="#546E7A" stroke="#455A64" strokeWidth="0.5" />
    <Rect x="96" y="122" width="8" height="10" rx="1" fill="#546E7A" stroke="#455A64" strokeWidth="0.5" />

    {/* TV Unit */}
    <G>
      <Rect x="42" y="132" width="116" height="6" rx="2" fill="url(#wood)" stroke="#5D4037" strokeWidth="0.8" />
      <Line x1="48" y1="134" x2="152" y2="134" stroke="#8D6E63" strokeWidth="0.8" opacity="0.4" strokeLinecap="round" />
      <Rect x="44" y="138" width="112" height="30" rx="2" fill="url(#woodFront)" stroke="#4E342E" strokeWidth="0.8" />
      <Rect x="48" y="142" width="34" height="22" rx="1.5" fill="#795548" stroke="#4E342E" strokeWidth="0.5" />
      <Circle cx="76" cy="153" r="1.8" fill="#8D6E63" stroke="#4E342E" strokeWidth="0.4" />
      <Rect x="86" y="142" width="28" height="22" rx="1" fill="#3E2723" />
      <Rect x="90" y="155" width="20" height="6" rx="1" fill="#37474F" stroke="#455A64" strokeWidth="0.4" />
      <Circle cx="94" cy="158" r="0.8" fill="#4CAF50" opacity="0.6" />
      <Rect x="118" y="142" width="34" height="22" rx="1.5" fill="#795548" stroke="#4E342E" strokeWidth="0.5" />
      <Circle cx="124" cy="153" r="1.8" fill="#8D6E63" stroke="#4E342E" strokeWidth="0.4" />
      <Rect x="48" y="168" width="4" height="8" rx="1" fill="#5D4037" />
      <Rect x="148" y="168" width="4" height="8" rx="1" fill="#5D4037" />
    </G>
  </Svg>
);

export default ElectronicsIcon;

import React from 'react';
import Svg, { G, Path, Rect, Circle, Ellipse, Line } from 'react-native-svg';

const EventsIcon = ({ size = 52 }) => (
  <Svg viewBox="0 0 200 200" width={size} height={size}>
    {/* Ground */}
    <Line x1="4" y1="192" x2="196" y2="192" stroke="#455A64" strokeWidth="2" />

    {/* RING LIGHT ON STAND */}
    <Line x1="56" y1="90" x2="56" y2="180" stroke="#455A64" strokeWidth="4" strokeLinecap="round" />
    <Line x1="56" y1="90" x2="56" y2="180" stroke="#616161" strokeWidth="2.5" strokeLinecap="round" />

    {/* Tripod legs */}
    <Line x1="56" y1="180" x2="32" y2="192" stroke="#455A64" strokeWidth="3.5" strokeLinecap="round" />
    <Line x1="56" y1="180" x2="56" y2="192" stroke="#455A64" strokeWidth="3.5" strokeLinecap="round" />
    <Line x1="56" y1="180" x2="80" y2="192" stroke="#455A64" strokeWidth="3.5" strokeLinecap="round" />
    <Line x1="56" y1="180" x2="32" y2="192" stroke="#616161" strokeWidth="2" strokeLinecap="round" />
    <Line x1="56" y1="180" x2="56" y2="192" stroke="#616161" strokeWidth="2" strokeLinecap="round" />
    <Line x1="56" y1="180" x2="80" y2="192" stroke="#616161" strokeWidth="2" strokeLinecap="round" />

    <Circle cx="56" cy="140" r="3" fill="#455A64" stroke="#37474F" strokeWidth="1" />
    <Rect x="50" y="86" width="12" height="8" rx="2" fill="#455A64" stroke="#37474F" strokeWidth="1.2" />

    {/* Ring light */}
    <Circle cx="56" cy="52" r="36" fill="none" stroke="#455A64" strokeWidth="6" />
    <Circle cx="56" cy="52" r="36" fill="none" stroke="#E0E0E0" strokeWidth="4" />
    <Circle cx="56" cy="52" r="36" fill="none" stroke="white" strokeWidth="3" opacity="0.7" />
    <Circle cx="56" cy="52" r="40" fill="none" stroke="#FFF9C4" strokeWidth="2" opacity="0.25" />
    <Circle cx="56" cy="52" r="44" fill="none" stroke="#FFF9C4" strokeWidth="1" opacity="0.12" />

    {/* LED segments */}
    <G fill="white" opacity="0.8">
      <Circle cx="56" cy="16" r="2" />
      <Circle cx="56" cy="88" r="2" />
      <Circle cx="20" cy="52" r="2" />
      <Circle cx="92" cy="52" r="2" />
      <Circle cx="30" cy="26" r="1.8" />
      <Circle cx="82" cy="26" r="1.8" />
      <Circle cx="30" cy="78" r="1.8" />
      <Circle cx="82" cy="78" r="1.8" />
      <Circle cx="24" cy="38" r="1.5" />
      <Circle cx="88" cy="38" r="1.5" />
      <Circle cx="24" cy="66" r="1.5" />
      <Circle cx="88" cy="66" r="1.5" />
      <Circle cx="36" cy="20" r="1.5" />
      <Circle cx="76" cy="20" r="1.5" />
      <Circle cx="36" cy="84" r="1.5" />
      <Circle cx="76" cy="84" r="1.5" />
      <Circle cx="44" cy="18" r="1.5" />
      <Circle cx="68" cy="18" r="1.5" />
      <Circle cx="44" cy="86" r="1.5" />
      <Circle cx="68" cy="86" r="1.5" />
    </G>

    <Circle cx="56" cy="52" r="30" fill="none" stroke="#BDBDBD" strokeWidth="0.8" />

    {/* Phone mount */}
    <Rect x="50" y="40" width="12" height="24" rx="2" fill="#37474F" stroke="#455A64" strokeWidth="1.2" />
    <Rect x="52" y="42" width="8" height="18" rx="1" fill="#263238" />
    <Circle cx="56" cy="41" r="1" fill="#455A64" />
    <Rect x="52" y="64" width="8" height="24" rx="1.5" fill="#455A64" stroke="#37474F" strokeWidth="0.8" />

    {/* CAMERA ON TRIPOD */}
    <Line x1="140" y1="146" x2="108" y2="192" stroke="#455A64" strokeWidth="4" strokeLinecap="round" />
    <Line x1="140" y1="146" x2="140" y2="192" stroke="#455A64" strokeWidth="4" strokeLinecap="round" />
    <Line x1="140" y1="146" x2="172" y2="192" stroke="#455A64" strokeWidth="4" strokeLinecap="round" />
    <Line x1="140" y1="146" x2="108" y2="192" stroke="#616161" strokeWidth="2.5" strokeLinecap="round" />
    <Line x1="140" y1="146" x2="140" y2="192" stroke="#616161" strokeWidth="2.5" strokeLinecap="round" />
    <Line x1="140" y1="146" x2="172" y2="192" stroke="#616161" strokeWidth="2.5" strokeLinecap="round" />

    <Circle cx="108" cy="192" r="2.5" fill="#455A64" />
    <Circle cx="140" cy="192" r="2.5" fill="#455A64" />
    <Circle cx="172" cy="192" r="2.5" fill="#455A64" />

    <Line x1="118" y1="176" x2="162" y2="176" stroke="#455A64" strokeWidth="2.5" strokeLinecap="round" />
    <Line x1="118" y1="176" x2="162" y2="176" stroke="#616161" strokeWidth="1.5" strokeLinecap="round" />

    {/* Center column */}
    <Rect x="136" y="110" width="8" height="38" rx="2" fill="#455A64" stroke="#37474F" strokeWidth="1" />
    <Line x1="138" y1="114" x2="138" y2="144" stroke="#546E7A" strokeWidth="1.2" opacity="0.4" strokeLinecap="round" />
    <Circle cx="148" cy="134" r="3.5" fill="#455A64" stroke="#37474F" strokeWidth="1" />

    {/* Tripod head */}
    <Rect x="128" y="104" width="24" height="10" rx="3" fill="#37474F" stroke="#455A64" strokeWidth="1.5" />
    <Line x1="152" y1="108" x2="164" y2="104" stroke="#455A64" strokeWidth="3" strokeLinecap="round" />
    <Line x1="152" y1="108" x2="164" y2="104" stroke="#546E7A" strokeWidth="1.8" strokeLinecap="round" />
    <Circle cx="164" cy="104" r="2.5" fill="#455A64" stroke="#37474F" strokeWidth="0.8" />
    <Rect x="130" y="100" width="20" height="6" rx="1.5" fill="#455A64" stroke="#37474F" strokeWidth="1" />

    {/* Camera body */}
    <Rect x="112" y="62" width="56" height="38" rx="5" fill="#1A1A1A" stroke="#455A64" strokeWidth="2.5" />
    <Rect x="112" y="62" width="56" height="10" rx="5" fill="#2A2A2A" stroke="#455A64" strokeWidth="2" />

    {/* Viewfinder */}
    <Rect x="138" y="52" width="22" height="14" rx="3" fill="#1A1A1A" stroke="#455A64" strokeWidth="2" />
    <Rect x="156" y="56" width="6" height="8" rx="2" fill="#37474F" stroke="#455A64" strokeWidth="1.2" />
    <Rect x="128" y="56" width="14" height="4" rx="1" fill="#37474F" stroke="#455A64" strokeWidth="1" />

    {/* Mode dial */}
    <Circle cx="124" cy="60" r="5" fill="#2A2A2A" stroke="#455A64" strokeWidth="1.5" />
    <Circle cx="124" cy="60" r="3" fill="none" stroke="#555" strokeWidth="0.5" />
    <Line x1="124" y1="56" x2="124" y2="58" stroke="#888" strokeWidth="1" strokeLinecap="round" />

    {/* Shutter button */}
    <Circle cx="124" cy="54" r="3" fill="#37474F" stroke="#455A64" strokeWidth="1.2" />
    <Circle cx="124" cy="54" r="1.5" fill="#546E7A" />

    {/* Grip */}
    <Rect x="112" y="68" width="10" height="28" rx="3" fill="#2A2A2A" stroke="#37474F" strokeWidth="0.8" />
    <G stroke="#333" strokeWidth="0.8" opacity="0.4">
      <Line x1="114" y1="72" x2="120" y2="72" />
      <Line x1="114" y1="76" x2="120" y2="76" />
      <Line x1="114" y1="80" x2="120" y2="80" />
      <Line x1="114" y1="84" x2="120" y2="84" />
      <Line x1="114" y1="88" x2="120" y2="88" />
      <Line x1="114" y1="92" x2="120" y2="92" />
    </G>

    {/* LCD screen */}
    <Rect x="128" y="74" width="34" height="22" rx="2" fill="#263238" stroke="#37474F" strokeWidth="1" />
    <Rect x="130" y="76" width="30" height="18" rx="1" fill="#1A1A1A" />
    <Line x1="145" y1="78" x2="145" y2="92" stroke="#4CAF50" strokeWidth="0.5" opacity="0.4" />
    <Line x1="132" y1="85" x2="158" y2="85" stroke="#4CAF50" strokeWidth="0.5" opacity="0.4" />
    <Circle cx="157" cy="78" r="1.5" fill="#E53935" opacity="0.6" />

    {/* Lens */}
    <Circle cx="140" cy="82" r="16" fill="#2A2A2A" stroke="#455A64" strokeWidth="2.5" />
    <Circle cx="140" cy="82" r="14" fill="none" stroke="#333" strokeWidth="1.5" />
    <Circle cx="140" cy="82" r="11" fill="#0D1B2A" stroke="#1A1A1A" strokeWidth="1" />
    <Circle cx="140" cy="82" r="8" fill="none" stroke="#1A2A3A" strokeWidth="0.8" opacity="0.6" />
    <Circle cx="140" cy="82" r="5" fill="none" stroke="#1A2A3A" strokeWidth="0.5" opacity="0.4" />
    <Ellipse cx="136" cy="77" rx="4" ry="3" fill="#42A5F5" opacity="0.15" />
    <Ellipse cx="134" cy="76" rx="2" ry="1.5" fill="white" opacity="0.15" />
    <Circle cx="140" cy="82" r="3" fill="#050A14" />

    {/* Strap lugs */}
    <Circle cx="112" cy="68" r="2" fill="#37474F" stroke="#455A64" strokeWidth="0.8" />
    <Circle cx="168" cy="68" r="2" fill="#37474F" stroke="#455A64" strokeWidth="0.8" />
  </Svg>
);

export default EventsIcon;

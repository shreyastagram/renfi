import React from 'react';
import Svg, { Circle, Rect, Ellipse } from 'react-native-svg';

const AmbulanceIcon = ({ size = 52 }) => (
  <Svg viewBox="0 0 200 200" width={size} height={size}>
    <Circle cx="100" cy="100" r="88" fill="white" stroke="#E53935" strokeWidth="4" />
    <Circle cx="100" cy="100" r="80" fill="none" stroke="#E53935" strokeWidth="2" opacity="0.3" />
    <Rect x="76" y="36" width="48" height="128" rx="8" fill="#E53935" stroke="#C62828" strokeWidth="1.5" />
    <Rect x="36" y="76" width="128" height="48" rx="8" fill="#E53935" stroke="#C62828" strokeWidth="1.5" />
    <Rect x="82" y="42" width="14" height="116" rx="4" fill="#EF5350" opacity="0.3" />
    <Rect x="42" y="82" width="116" height="14" rx="4" fill="#EF5350" opacity="0.3" />
    <Rect x="82" y="82" width="36" height="36" rx="4" fill="#E53935" />
    <Ellipse cx="94" cy="92" rx="10" ry="8" fill="white" opacity="0.08" />
  </Svg>
);

export default AmbulanceIcon;

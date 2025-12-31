import React from 'react';
import './Silk.css';

type SilkProps = {
  speed?: number;
  scale?: number;
  color?: string;
  noiseIntensity?: number;
  rotation?: number;
};

const Silk: React.FC<SilkProps> = ({
  speed = 5,
  scale = 1,
  color = '#7B7481',
  noiseIntensity = 1.5,
  rotation = 0,
}) => {
  // Convert hex to RGB for CSS
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 123, g: 116, b: 129 };
  };

  const rgb = hexToRgb(color);
  const animationDuration = `${20 / speed}s`;

  return (
    <div className="silk-container" style={{ backgroundColor: color }}>
      <div
        className="silk-animation"
        style={{
          '--silk-color': `${rgb.r}, ${rgb.g}, ${rgb.b}`,
          '--animation-duration': animationDuration,
          '--scale': scale,
          '--noise-intensity': noiseIntensity,
        } as React.CSSProperties}
      >
        <div className="silk-layer silk-layer-1" />
        <div className="silk-layer silk-layer-2" />
        <div className="silk-layer silk-layer-3" />
        <div className="silk-layer silk-layer-4" />
      </div>
    </div>
  );
};

export default Silk;

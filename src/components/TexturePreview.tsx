import React, { useEffect, useRef } from 'react';
import { decodeTIMToCanvas } from '../lib/parser';

interface TexturePreviewProps {
  texture?: any;
}

export const TexturePreview: React.FC<TexturePreviewProps> = ({ texture }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = decodeTIMToCanvas(texture);
    const display = canvasRef.current;
    if (!display || !canvas) return;

    display.width = canvas.width;
    display.height = canvas.height;
    const ctx = display.getContext('2d');
    ctx?.drawImage(canvas, 0, 0);
  }, [texture]);

  if (!texture) {
    return (
      <div className="panel-content texture-preview" id="texture-panel">
        <div className="placeholder">No texture loaded</div>
      </div>
    );
  }

  return (
    <div className="panel-content texture-preview" id="texture-panel">
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      <div className="texture-info">
        {texture.image.width} × {texture.image.height} • {texture.bpp}bpp •{' '}
        {texture.clut ? texture.clut.colors.length : 0} colors
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { decodeTIMToCanvas } from '../lib/parser';

interface TexturePreviewProps {
  texture?: any;
}

export const TexturePreview: React.FC<TexturePreviewProps> = ({ texture }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedPalette, setSelectedPalette] = useState(0);

  const numPalettes = texture?.clut?.height ?? 0;

  useEffect(() => {
    setSelectedPalette(0);
  }, [texture]);

  useEffect(() => {
    if (!texture) return;
    
    const canvas = decodeTIMToCanvas(texture, selectedPalette);
    const display = canvasRef.current;
    if (!display || !canvas) return;

    display.width = canvas.width;
    display.height = canvas.height;
    const ctx = display.getContext('2d');
    ctx?.drawImage(canvas, 0, 0);
  }, [texture, selectedPalette]);

  if (!texture) {
    return (
      <>
        <div className="panel-header">
          <h2>Texture Preview</h2>
        </div>
        <div className="panel-content texture-preview" id="texture-panel" style={{ padding: '16px', minHeight: 'auto' }}>
          <div style={{ color: '#555566', fontSize: '0.9rem', textAlign: 'center' }}>No texture loaded</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <h2>Texture Preview</h2>
        {numPalettes > 1 && (
          <select
            value={selectedPalette}
            onChange={(e) => setSelectedPalette(Number(e.target.value))}
            style={{
              padding: '4px 8px',
              background: '#1b2a3a',
              border: '1px solid #3a5a8a',
              borderRadius: '4px',
              color: '#a0a0c0',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            {Array.from({ length: numPalettes }, (_, i) => (
              <option key={i} value={i}>
                Palette {i}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="panel-content texture-preview" id="texture-panel" style={{ padding: '12px', minHeight: 'auto' }}>
        <canvas ref={canvasRef} style={{ display: 'block' }} />
        <div className="texture-info">
          {texture.image.width} × {texture.image.height} • {texture.bpp}bpp •{' '}
          {texture.clut ? texture.clut.colors.length : 0} colors
        </div>
      </div>
    </>
  );
};

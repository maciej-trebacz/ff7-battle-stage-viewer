import React from 'react';
import { PaletteState } from '../types';

interface PaletteDebugProps {
  data?: any;
  paletteState: PaletteState;
  onPaletteChange: (state: PaletteState) => void;
  onApply: () => void;
}

export const PaletteDebug: React.FC<PaletteDebugProps> = ({ data, paletteState, onPaletteChange, onApply }) => {
  const numPalettes = data?.texture?.clut?.height ?? 0;
  const geometry3D = data?.geometry3D ?? [];

  if (!data || !data.texture || !data.texture.clut) {
    return (
      <div className="panel-content" id="palette-debug-panel">
        <div className="placeholder">No palette data</div>
      </div>
    );
  }

  const updateSection = (sectionNum: number, value: number) => {
    const next = { ...paletteState.sections };
    if (value >= 0) {
      next[sectionNum] = value;
    } else {
      delete next[sectionNum];
    }
    onPaletteChange({ ...paletteState, sections: next });
  };

  return (
    <div className="panel-content" id="palette-debug-panel">
      <div style={{ fontSize: '0.7rem', marginBottom: 8, color: '#888' }}>TIM has {numPalettes} palette(s)</div>

      <div style={{ marginBottom: 8, padding: 6, background: '#1a1a25', borderRadius: 4 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem' }}>
          <span style={{ flex: 1 }}>Ground Plane</span>
          <select
            style={{ padding: '2px 4px', fontSize: '0.7rem' }}
            value={paletteState.ground}
            onChange={(e) => onPaletteChange({ ...paletteState, ground: parseInt(e.target.value, 10) })}
          >
            {Array.from({ length: numPalettes }, (_, i) => (
              <option key={i} value={i}>
                Palette {i}
              </option>
            ))}
          </select>
        </label>
      </div>

      {geometry3D.map((geom: any, idx: number) => {
        const sectionNum = idx + 2;
        const sectionName = idx < 3 ? `Sky Section ${idx}` : `Object Section ${idx - 3}`;
        const triCount = geom.triangles?.length || 0;
        const quadCount = geom.quads?.length || 0;
        const detectedPalettes = new Set<number>();
        geom.triangles?.forEach((tri: any) => detectedPalettes.add(tri.paletteIndex || 0));
        geom.quads?.forEach((quad: any) => detectedPalettes.add(quad.paletteIndex || 0));
        const detectedStr = Array.from(detectedPalettes).sort().join(', ');

        return (
          <div key={sectionNum} style={{ marginBottom: 8, padding: 6, background: '#1a1a25', borderRadius: 4 }}>
            <div style={{ fontSize: '0.65rem', color: '#666', marginBottom: 4 }}>
              Section {sectionNum}: {triCount} tris, {quadCount} quads
              {detectedStr ? <br /> : null}
              {detectedStr ? `Detected: pal ${detectedStr}` : ''}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem' }}>
              <span style={{ flex: 1 }}>{sectionName}</span>
              <select
                data-section={sectionNum}
                style={{ padding: '2px 4px', fontSize: '0.7rem' }}
                value={paletteState.sections[sectionNum] ?? -1}
                onChange={(e) => updateSection(sectionNum, parseInt(e.target.value, 10))}
              >
                <option value={-1}>Auto</option>
                {Array.from({ length: numPalettes }, (_, i) => (
                  <option key={i} value={i}>
                    Palette {i}
                  </option>
                ))}
              </select>
            </label>
          </div>
        );
      })}

      <button
        style={{
          width: '100%',
          padding: 8,
          marginTop: 8,
          background: '#3a5a8a',
          border: 'none',
          borderRadius: 4,
          color: 'white',
          cursor: 'pointer',
          fontSize: '0.75rem'
        }}
        onClick={onApply}
      >
        Apply Palette Changes
      </button>
    </div>
  );
};

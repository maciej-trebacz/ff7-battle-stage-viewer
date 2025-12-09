import React from 'react';
import { PaletteState, SectionVisibility } from '../types';
import { formatBytes } from '../utils/format';

interface StageSectionsProps {
  data?: any;
  visibility: SectionVisibility;
  paletteState: PaletteState;
  onVisibilityChange: (index: number, visible: boolean) => void;
  onPaletteChange: (state: PaletteState) => void;
  onApplyPalettes: () => void;
}

export const StageSections: React.FC<StageSectionsProps> = ({
  data,
  visibility,
  paletteState,
  onVisibilityChange,
  onPaletteChange,
  onApplyPalettes
}) => {
  const numPalettes = data?.texture?.clut?.height ?? 0;
  const meshes = data?.meshes ?? [];
  const sections = data?.sections ?? [];

  if (!data) {
    return (
      <div className="panel-content" id="stage-sections-panel">
        <div className="placeholder">Load a scene file to view sections</div>
      </div>
    );
  }

  const updateSectionPalette = (sectionNum: number, value: number) => {
    const next = { ...paletteState.sections };
    if (value >= 0) {
      next[sectionNum] = value;
    } else {
      delete next[sectionNum];
    }
    onPaletteChange({ ...paletteState, sections: next });
    setTimeout(() => onApplyPalettes(), 0);
  };

  const detectPalettes = (geom: any) => {
    const detected = new Set<number>();
    geom.triangles?.forEach((tri: any) => detected.add(tri.paletteIndex || 0));
    geom.quads?.forEach((quad: any) => detected.add(quad.paletteIndex || 0));
    return Array.from(detected).sort();
  };

  const getFileDataForSection = (sectionIndex: number) => {
    if (sectionIndex >= 0 && sectionIndex < sections.length) {
      const section = sections[sectionIndex];
      return {
        size: section.size,
        offset: section.offset
      };
    }
    return null;
  };

  return (
    <div className="panel-content" id="stage-sections-panel">
      {/* All Mesh Sections */}
      {meshes.map((geom: any, idx: number) => {
        const sectionNum = idx + 1;
        const isGround = idx === 0;
        const isSky = idx >= 1 && idx <= 3;
        const sectionName = isGround 
          ? 'Ground Plane' 
          : isSky 
            ? `Sky Section ${idx - 1}` 
            : `Object Section ${idx - 4}`;
        const triCount = geom.triangles?.length || 0;
        const quadCount = geom.quads?.length || 0;
        const detected = detectPalettes(geom);
        const fileData = getFileDataForSection(sectionNum);
        const isVisible = visibility.sections[idx] ?? true;
        const color = isGround ? '#4ad474' : isSky ? '#8888ff' : '#88ff88';

        return (
          <div
            key={idx}
            style={{
              marginBottom: 8,
              padding: 8,
              background: '#1a1a25',
              borderRadius: 4,
              border: '1px solid #2a2a35'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={isVisible}
                onChange={(e) => onVisibilityChange(idx, e.target.checked)}
                style={{ cursor: 'pointer' }}
                title="Toggle visibility"
              />
              <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 'bold', color }}>
                {sectionName}
              </span>
            </div>

            <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: 6, paddingLeft: 20 }}>
              <div>
                Section {sectionNum} • {geom.vertexCount} vertices • {triCount} triangles • {quadCount} quads
              </div>
              {fileData && (
                <div>
                  {formatBytes(fileData.size)} @ 0x{fileData.offset.toString(16).toUpperCase()}
                </div>
              )}
              {detected.length > 0 && <div>Detected palette: {detected.join(', ')}</div>}
            </div>

            {numPalettes > 0 && (
              <div style={{ paddingLeft: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem' }}>
                  <span style={{ minWidth: 60 }}>Palette:</span>
                  <select
                    style={{
                      padding: '4px 8px',
                      background: '#1b2a3a',
                      border: '1px solid #3a5a8a',
                      borderRadius: '4px',
                      color: '#a0a0c0',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      flex: 1
                    }}
                    value={paletteState.sections[sectionNum] ?? -1}
                    onChange={(e) => updateSectionPalette(sectionNum, parseInt(e.target.value, 10))}
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
            )}
          </div>
        );
      })}
    </div>
  );
};


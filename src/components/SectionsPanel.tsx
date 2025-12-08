import React from 'react';
import { formatBytes } from '../utils/format';

interface SectionsPanelProps {
  sections?: any[];
}

const getSectionTypeLabel = (section: any) => {
  switch (section.type) {
    case 'metadata':
      return 'Metadata';
    case '3d_geometry':
      return '3D Geometry';
    case 'tim_texture':
      return 'TIM Texture';
    default:
      return 'Unknown';
  }
};

const getSectionDetails = (section: any) => {
  const data = section.data;
  switch (section.type) {
    case 'metadata':
      return (
        <div className="debug-row">
          <span className="debug-label">Flags</span>
          <span className="debug-value hex">0x{data.flags.toString(16).padStart(8, '0')}</span>
        </div>
      );
    case '3d_geometry':
      return (
        <>
          <div className="debug-row">
            <span className="debug-label">Vertices</span>
            <span className="debug-value">{data.vertexCount}</span>
          </div>
          <div className="debug-row">
            <span className="debug-label">Triangles</span>
            <span className="debug-value">
              {data.validTriangles} / {data.triangleCount}
            </span>
          </div>
        </>
      );
    case 'tim_texture':
      return (
        <>
          <div className="debug-row">
            <span className="debug-label">Size</span>
            <span className="debug-value">
              {data.image.width} × {data.image.height}
            </span>
          </div>
          <div className="debug-row">
            <span className="debug-label">BPP</span>
            <span className="debug-value">{data.bpp}</span>
          </div>
          <div className="debug-row">
            <span className="debug-label">Palettes</span>
            <span className="debug-value">{data.clut ? data.clut.height : 0}</span>
          </div>
        </>
      );
    default:
      return <div className="debug-row">No details available</div>;
  }
};

export const SectionsPanel: React.FC<SectionsPanelProps> = ({ sections }) => {
  if (!sections || !sections.length) {
    return (
      <div className="panel-content" id="sections-panel">
        <div className="placeholder">No sections loaded</div>
      </div>
    );
  }

  return (
    <div className="panel-content" id="sections-panel">
      {sections.map((section, idx) => (
        <details className="section-item" key={idx} open={false}>
          <summary className="section-header">
            <div className="section-index">{idx}</div>
            <div className="section-info">
              <div className="section-type">{getSectionTypeLabel(section)}</div>
              <div className="section-size">
                {formatBytes(section.size)} @ 0x{section.offset.toString(16).toUpperCase()}
              </div>
            </div>
          </summary>
          <div className="section-details">{getSectionDetails(section)}</div>
        </details>
      ))}
    </div>
  );
};

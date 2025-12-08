import React from 'react';
import { formatBytes } from '../utils/format';

interface DebugPanelProps {
  data?: any;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ data }) => {
  if (!data) {
    return (
      <div className="panel-content" id="debug-panel">
        <div className="placeholder">Load a scene file to view debug information</div>
      </div>
    );
  }

  const header = data.header;
  const sections = data.sections || [];
  const groundPlane = data.groundPlane;
  const geometry3D = data.geometry3D || [];
  const texture = data.texture;

  const renderGroundDebug = () => {
    if (!groundPlane) return null;
    const gp = groundPlane;
    const debugQuads = gp.quads.slice(0, 2);
    const verts = gp.vertices;
    const texW = data.texture?.image?.width || 512;
    const texH = data.texture?.image?.height || 256;

    return (
      <div className="debug-section">
        <div className="debug-section-header">Ground Plane (Section 1)</div>
        <div className="debug-section-content">
          <div className="debug-row">
            <span className="debug-label">Vertices</span>
            <span className="debug-value number">{gp.vertexCount}</span>
          </div>
          <div className="debug-row">
            <span className="debug-label">Quads</span>
            <span className="debug-value number">{gp.quadCount}</span>
          </div>
          <div className="debug-row">
            <span className="debug-label">Vertex Data</span>
            <span className="debug-value">{formatBytes(gp.vertexDataSize)}</span>
          </div>
          <div style={{ marginTop: 8, color: '#4ad474', fontSize: '0.75rem' }}>UV Debug (first 3 quads):</div>
          {debugQuads.map((quad: any, i: number) => {
            const stored = quad.storedUVs || [];
            const tpx = quad.tpx || 0;
            const v0 = verts[quad.vertices[0]] || { x: 0, y: 0 };
            const v1 = verts[quad.vertices[1]] || { x: 0, y: 0 };
            const v2 = verts[quad.vertices[2]] || { x: 0, y: 0 };
            const v3 = verts[quad.vertices[3]] || { x: 0, y: 0 };
            return (
              <div key={i} style={{ fontSize: '0.65rem', marginTop: 6, fontFamily: 'monospace', lineHeight: 1.4 }}>
                <b>Quad {i}:</b> TPX={tpx}px (tex {texW}x{texH})
                <br />
                <span style={{ color: '#aaa' }}>Raw: [{stored.map((s: any) => `(${s.u},${s.v})`).join(' ')}]</span>
                <br />
                <span style={{ color: '#ff8888' }}>
                  V0({v0.x},{v0.y})
                </span>{' '}
                <span style={{ color: '#88ff88' }}>
                  V1({v1.x},{v1.y})
                </span>
                <br />
                <span style={{ color: '#8888ff' }}>
                  V2({v2.x},{v2.y})
                </span>{' '}
                <span style={{ color: '#ffff88' }}>
                  V3({v3.x},{v3.y})
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderGeometrySummary = () => {
    if (!geometry3D.length) return null;
    let totalVerts = 0;
    let totalTris = 0;
    geometry3D.forEach((g: any) => {
      totalVerts += g.vertexCount;
      totalTris += g.validTriangles;
    });

    return (
      <div className="debug-section">
        <div className="debug-section-header">3D Geometry ({geometry3D.length} sections)</div>
        <div className="debug-section-content">
          <div className="debug-row">
            <span className="debug-label">Total Vertices</span>
            <span className="debug-value number">{totalVerts}</span>
          </div>
          <div className="debug-row">
            <span className="debug-label">Total Triangles</span>
            <span className="debug-value number">{totalTris}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderTextureInfo = () => {
    if (!texture) return null;
    return (
      <div className="debug-section">
        <div className="debug-section-header">Texture (TIM)</div>
        <div className="debug-section-content">
          <div className="debug-row">
            <span className="debug-label">Dimensions</span>
            <span className="debug-value">
              {texture.image.width} × {texture.image.height}
            </span>
          </div>
          <div className="debug-row">
            <span className="debug-label">BPP</span>
            <span className="debug-value number">{texture.bpp}</span>
          </div>
          <div className="debug-row">
            <span className="debug-label">CLUT Colors</span>
            <span className="debug-value number">{texture.clut ? texture.clut.colors.length : 0}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="panel-content" id="debug-panel">
      <div className="debug-section">
        <div className="debug-section-header">File Header</div>
        <div className="debug-section-content">
          <div className="debug-row">
            <span className="debug-label">Section Count</span>
            <span className="debug-value number">{header.sectionCount}</span>
          </div>
          <div className="debug-row">
            <span className="debug-label">File Size</span>
            <span className="debug-value number">{formatBytes(sections.reduce((sum: number, s: any) => sum + s.size, 0) + 4 + header.sectionCount * 4)}</span>
          </div>
        </div>
      </div>

      {data.metadata && (
        <div className="debug-section">
          <div className="debug-section-header">Metadata (Section 0)</div>
          <div className="debug-section-content">
            <div className="debug-row">
              <span className="debug-label">Flags</span>
              <span className="debug-value hex">0x{data.metadata.flags.toString(16).padStart(8, '0').toUpperCase()}</span>
            </div>
          </div>
        </div>
      )}

      {renderGroundDebug()}
      {renderGeometrySummary()}
      {renderTextureInfo()}
    </div>
  );
};

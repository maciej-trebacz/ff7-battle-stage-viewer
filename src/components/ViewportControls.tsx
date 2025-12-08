import React from 'react';

interface ViewportControlsProps {
  showGround: boolean;
  showSky: boolean;
  showObjects: boolean;
  wireframe: boolean;
  debugUV: boolean;
  uvMappingMode: number;
  triUvMappingMode: number;
  uvShiftOffset: number;
  onShowGroundChange: (value: boolean) => void;
  onShowSkyChange: (value: boolean) => void;
  onShowObjectsChange: (value: boolean) => void;
  onWireframeChange: (value: boolean) => void;
  onDebugUVChange: (value: boolean) => void;
  onUvMappingChange: (mode: number) => void;
  onTriUvMappingChange: (mode: number) => void;
  onUvShiftChange: (shift: number) => void;
  onResetCamera: () => void;
}

export const ViewportControls: React.FC<ViewportControlsProps> = ({
  showGround,
  showSky,
  showObjects,
  wireframe,
  debugUV,
  uvMappingMode,
  triUvMappingMode,
  uvShiftOffset,
  onShowGroundChange,
  onShowSkyChange,
  onShowObjectsChange,
  onWireframeChange,
  onDebugUVChange,
  onUvMappingChange,
  onTriUvMappingChange,
  onUvShiftChange,
  onResetCamera
}) => (
  <div className="viewport-controls">
    <label>
      <input type="checkbox" checked={showGround} onChange={(e) => onShowGroundChange(e.target.checked)} />
      Ground Plane
    </label>
    <label>
      <input type="checkbox" checked={showSky} onChange={(e) => onShowSkyChange(e.target.checked)} />
      Sky Dome
    </label>
    <label>
      <input type="checkbox" checked={showObjects} onChange={(e) => onShowObjectsChange(e.target.checked)} />
      Objects
    </label>
    <label>
      <input type="checkbox" checked={wireframe} onChange={(e) => onWireframeChange(e.target.checked)} />
      Wireframe
    </label>
    <label>
      <input type="checkbox" checked={debugUV} onChange={(e) => onDebugUVChange(e.target.checked)} />
      Debug UVs
    </label>
    <select
      value={uvMappingMode}
      onChange={(e) => onUvMappingChange(parseInt(e.target.value, 10))}
      style={{ marginLeft: 8, padding: '2px 4px' }}
    >
      <option value="0">Quad UVs: 2,0,3,1</option>
      <option value="1">Quad UVs: 0,1,2,3</option>
      <option value="2">Quad UVs: 1,0,3,2</option>
      <option value="3">Quad UVs: 0,2,1,3</option>
      <option value="4">Quad UVs: 3,2,1,0</option>
      <option value="5">Quad UVs: 2,3,0,1</option>
    </select>
    <select
      value={triUvMappingMode}
      onChange={(e) => onTriUvMappingChange(parseInt(e.target.value, 10))}
      style={{ marginLeft: 8, padding: '2px 4px' }}
    >
      <option value="0">Tri UVs: 0,1,2</option>
      <option value="1">Tri UVs: 0,2,1</option>
      <option value="2">Tri UVs: 1,0,2</option>
      <option value="3">Tri UVs: 1,2,0</option>
      <option value="4">Tri UVs: 2,0,1</option>
      <option value="5">Tri UVs: 2,1,0</option>
    </select>
    <label style={{ marginLeft: 8 }}>
      UV Shift:
      <input
        type="number"
        value={uvShiftOffset}
        onChange={(e) => onUvShiftChange(parseInt(e.target.value, 10) || 0)}
        style={{ width: 50, padding: '2px 4px', marginLeft: 4 }}
      />
    </label>
    <button id="reset-camera" onClick={onResetCamera}>
      Reset Camera
    </button>
  </div>
);

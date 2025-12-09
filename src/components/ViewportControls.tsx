import React from 'react';

interface ViewportControlsProps {
  wireframe: boolean;
  onWireframeChange: (value: boolean) => void;
  onResetCamera: () => void;
}

export const ViewportControls: React.FC<ViewportControlsProps> = ({
  wireframe,
  onWireframeChange,
  onResetCamera
}) => (
  <div className="viewport-controls">
    <label>
      <input type="checkbox" checked={wireframe} onChange={(e) => onWireframeChange(e.target.checked)} />
      Wireframe
    </label>
    <button id="reset-camera" onClick={onResetCamera}>
      Reset Camera
    </button>
  </div>
);

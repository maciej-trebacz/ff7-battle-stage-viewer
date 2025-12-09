import React from 'react';

interface HeaderProps {
  fileName: string;
  onFileChange: (file: File) => void;
  onExport: () => void;
  exportDisabled: boolean;
}

export const Header: React.FC<HeaderProps> = ({ fileName, onFileChange, onExport, exportDisabled }) => {
  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onFileChange(files[0]);
    }
  };

  return (
    <header className="app-header">
      <h1>FF7 PSX Battle Stage Viewer</h1>
      <div className="file-controls">
        <input type="file" id="file-input" accept="*" onChange={handleFileInput} />
        <label htmlFor="file-input" className="file-label">
          <span className="file-icon">📂</span>
          <span className="file-text">{fileName || 'Select Stage File'}</span>
        </label>
        <button
          id="export-btn"
          style={{
            marginLeft: '12px',
            padding: '8px 16px',
            background: exportDisabled ? '#1b2a3a' : '#2a4a6a',
            border: '1px solid #3a5a8a',
            borderRadius: '4px',
            color: exportDisabled ? '#6a7a8a' : '#a0a0c0',
            cursor: exportDisabled ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem'
          }}
          disabled={exportDisabled}
          onClick={onExport}
        >
          Export to PC
        </button>
      </div>
    </header>
  );
};

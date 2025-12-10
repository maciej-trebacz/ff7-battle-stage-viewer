import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { Header } from './components/Header';
import { TexturePreview } from './components/TexturePreview';
import { StageSections } from './components/StageSections';
import { ViewportControls } from './components/ViewportControls';
import { ExportWizard } from './lib/ExportWizard';
import { FF7SceneParser } from './lib/parser';
import { FF7SceneRenderer } from './lib/renderer';
import { Lzss } from './lib/lzss';
import { PaletteState, SectionVisibility, Stats } from './types';

const App: React.FC = () => {
  const rendererRef = useRef<FF7SceneRenderer | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const [parsedData, setParsedData] = useState<any | null>(null);
  const [lastArrayBuffer, setLastArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState('No file selected');
  const [exportDisabled, setExportDisabled] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  const [wireframe, setWireframe] = useState(false);

  const [paletteState, setPaletteState] = useState<PaletteState>({ sections: {} });
  const [sectionVisibility, setSectionVisibility] = useState<SectionVisibility>({ sections: {} });
  
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPrefix, setExportPrefix] = useState('AB');

  useEffect(() => {
    if (!rendererRef.current && viewportRef.current) {
      rendererRef.current = new FF7SceneRenderer(viewportRef.current);
    }
  }, []);

  useEffect(() => {
    rendererRef.current?.setWireframe(wireframe);
  }, [wireframe]);

  const parseAndDisplay = useCallback(
    (arrayBuffer: ArrayBuffer, name: string) => {
      if (!rendererRef.current) return;
      setLastArrayBuffer(arrayBuffer);
      setFileName(name);
      try {
        const parser = new FF7SceneParser(arrayBuffer);
        const data = parser.parse();
        setParsedData(data);
        rendererRef.current.loadScene(data);
        const newVisibility = rendererRef.current.getSectionVisibility();
        setSectionVisibility(newVisibility);
        setExportDisabled(false);
      } catch (error: any) {
        console.error('Error parsing or rendering scene:', error);
      }
    },
    []
  );

  const reparseIfLoaded = useCallback(() => {
    if (lastArrayBuffer && fileName !== 'No file selected') {
      parseAndDisplay(lastArrayBuffer, fileName);
    }
  }, [lastArrayBuffer, fileName, parseAndDisplay]);

  const handleFile = useCallback(
    async (file: File) => {
      try {
        let buffer = await file.arrayBuffer();
        let displayName = file.name;
        
        if (file.name.toUpperCase().endsWith('.LZS')) {
          const lzss = new Lzss();
          const compressed = new Uint8Array(buffer);
          const compressedData = compressed.slice(4);
          const decompressed = lzss.decompress(compressedData);
          buffer = decompressed.buffer.slice(decompressed.byteOffset, decompressed.byteOffset + decompressed.byteLength);
          displayName = file.name.slice(0, -4);
        }
        
        parseAndDisplay(buffer, displayName);
      } catch (error: any) {
        console.error('Error loading file:', error);
      }
    },
    [parseAndDisplay]
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const preventDefaults = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const handleDragOver = (event: DragEvent) => {
      preventDefaults(event);
      setDragOver(true);
    };

    const handleDragLeave = (event: DragEvent) => {
      preventDefaults(event);
      setDragOver(false);
    };

    const handleDrop = (event: DragEvent) => {
      preventDefaults(event);
      setDragOver(false);
      if (event.dataTransfer?.files?.length) {
        handleFile(event.dataTransfer.files[0]);
      }
    };

    viewport.addEventListener('dragover', handleDragOver as EventListener);
    viewport.addEventListener('dragleave', handleDragLeave as EventListener);
    viewport.addEventListener('drop', handleDrop as EventListener);

    return () => {
      viewport.removeEventListener('dragover', handleDragOver as EventListener);
      viewport.removeEventListener('dragleave', handleDragLeave as EventListener);
      viewport.removeEventListener('drop', handleDrop as EventListener);
    };
  }, [handleFile]);

  const applyPalettes = () => {
    rendererRef.current?.setPaletteOverrides(paletteState.sections);
    if (parsedData) {
      rendererRef.current?.loadScene(parsedData, true);
      const newVisibility = rendererRef.current.getSectionVisibility();
      setSectionVisibility(newVisibility);
    }
  };

  const handleVisibilityChange = (index: number, visible: boolean) => {
    rendererRef.current?.setSectionVisible(index, visible);
    setSectionVisibility(rendererRef.current?.getSectionVisibility() || { sections: {} });
  };

  const handleExport = () => {
    if (!parsedData) return;
    setShowExportModal(true);
  };

  const executeExport = async () => {
    setShowExportModal(false);
    
    const cleanPrefix = exportPrefix.trim().toUpperCase().substring(0, 2).padEnd(2, 'A');

    try {
      const wizard = new ExportWizard({ renderer: rendererRef.current });
      const files = await wizard.start(parsedData, cleanPrefix);
      if (!files) return;

      const zip = new JSZip();
      const folder = zip.folder(`${cleanPrefix}_battle_location`);
      files.forEach((file) => folder?.file(file.name, file.data));

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanPrefix}_battle_location.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Export error:', error);
    }
  };

  useEffect(() => {
    setPaletteState({ sections: {} });
    if (rendererRef.current) {
      const newVisibility = rendererRef.current.getSectionVisibility();
      setSectionVisibility(newVisibility);
    }
  }, [parsedData]);

  const controls = useMemo(
    () => (
      <ViewportControls
        wireframe={wireframe}
        onWireframeChange={setWireframe}
        onResetCamera={() => rendererRef.current?.resetCamera()}
      />
    ),
    [wireframe]
  );

  return (
    <div className="app-container">
      <Header fileName={fileName} onFileChange={handleFile} onExport={handleExport} exportDisabled={exportDisabled} />

      {showExportModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
          onClick={() => setShowExportModal(false)}
        >
          <div
            style={{
              background: '#1a2332',
              border: '2px solid #3a5a8a',
              borderRadius: '8px',
              padding: '24px',
              minWidth: '400px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', color: '#4ad474' }}>Export Battle Location</h3>
            <p style={{ margin: '0 0 16px 0', color: '#a0a0c0', fontSize: '0.9rem' }}>
              Enter 2-letter prefix for battle location (e.g., RJ, AB, XY):
            </p>
            <input
              type="text"
              value={exportPrefix}
              onChange={(e) => setExportPrefix(e.target.value)}
              maxLength={2}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#0a1220',
                border: '1px solid #3a5a8a',
                borderRadius: '4px',
                color: '#ffffff',
                fontSize: '1rem',
                fontFamily: 'monospace',
                textTransform: 'uppercase'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  executeExport();
                } else if (e.key === 'Escape') {
                  setShowExportModal(false);
                }
              }}
              autoFocus
            />
            <div style={{ marginTop: '20px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowExportModal(false)}
                style={{
                  padding: '8px 16px',
                  background: '#1b2a3a',
                  border: '1px solid #3a5a8a',
                  borderRadius: '4px',
                  color: '#a0a0c0',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Cancel
              </button>
              <button
                onClick={executeExport}
                style={{
                  padding: '8px 16px',
                  background: '#2a4a6a',
                  border: '1px solid #3a5a8a',
                  borderRadius: '4px',
                  color: '#4ad474',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 'bold'
                }}
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="app-main">
        <section className="viewport-container">
          <div id="viewport" className="viewport" ref={viewportRef}>
            {!parsedData && (
              <div className={`viewport-overlay ${dragOver ? 'drag-over' : ''}`}>
                <div className="drop-zone">
                  <div className="drop-icon">⬇️</div>
                  <div className="drop-text">Drop scene file here</div>
                  <div className="drop-hint">or use the file picker above</div>
                </div>
              </div>
            )}
          </div>
          {controls}
        </section>

        <aside className="panel panel-right">
          <div className="panel-section" style={{ flex: '0 0 auto' }}>
            <TexturePreview texture={parsedData?.texture} />
          </div>

          <div className="panel-section" style={{ flex: 1 }}>
            <div className="panel-header">
              <h2>Stage Sections</h2>
            </div>
            <StageSections
              data={parsedData}
              visibility={sectionVisibility}
              paletteState={paletteState}
              onVisibilityChange={handleVisibilityChange}
              onPaletteChange={setPaletteState}
              onApplyPalettes={applyPalettes}
            />
          </div>
        </aside>
      </main>
    </div>
  );
};

export default App;

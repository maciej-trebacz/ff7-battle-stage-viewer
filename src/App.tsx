import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { Header } from './components/Header';
import { TexturePreview } from './components/TexturePreview';
import { DebugPanel } from './components/DebugPanel';
import { SectionsPanel } from './components/SectionsPanel';
import { PaletteDebug } from './components/PaletteDebug';
import { ViewportControls } from './components/ViewportControls';
import { StatusBar } from './components/StatusBar';
import { ExportWizard } from './lib/ExportWizard';
import { FF7SceneParser } from './lib/parser';
import { FF7SceneRenderer } from './lib/renderer';
import { formatStats } from './utils/format';
import { PaletteState, Stats } from './types';

const App: React.FC = () => {
  const rendererRef = useRef<FF7SceneRenderer | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const [parsedData, setParsedData] = useState<any | null>(null);
  const [lastArrayBuffer, setLastArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState('No file selected');
  const [status, setStatus] = useState('Ready');
  const [stats, setStats] = useState<string>('');
  const [exportDisabled, setExportDisabled] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  const [showGround, setShowGround] = useState(true);
  const [showSky, setShowSky] = useState(true);
  const [showObjects, setShowObjects] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [debugUV, setDebugUV] = useState(false);

  const [uvMappingMode, setUvMappingMode] = useState(1);
  const [triUvMappingMode, setTriUvMappingMode] = useState(0);
  const [uvShiftOffset, setUvShiftOffset] = useState(0);

  const [paletteState, setPaletteState] = useState<PaletteState>({ ground: 0, sections: {} });

  useEffect(() => {
    (window as any).uvMappingMode = uvMappingMode;
    (window as any).triUvMappingMode = triUvMappingMode;
    (window as any).uvShiftOffset = uvShiftOffset;
  }, [uvMappingMode, triUvMappingMode, uvShiftOffset]);

  useEffect(() => {
    if (!rendererRef.current && viewportRef.current) {
      rendererRef.current = new FF7SceneRenderer(viewportRef.current);
    }
  }, []);

  useEffect(() => {
    rendererRef.current?.setShowGround(showGround);
  }, [showGround]);

  useEffect(() => {
    rendererRef.current?.setShowSky(showSky);
  }, [showSky]);

  useEffect(() => {
    rendererRef.current?.setShowObjects(showObjects);
  }, [showObjects]);

  useEffect(() => {
    rendererRef.current?.setWireframe(wireframe);
  }, [wireframe]);

  useEffect(() => {
    rendererRef.current?.setDebugUVMode(debugUV);
  }, [debugUV]);

  const parseAndDisplay = useCallback(
    (arrayBuffer: ArrayBuffer, name: string) => {
      if (!rendererRef.current) return;
      setStatus('Parsing scene data...');
      setLastArrayBuffer(arrayBuffer);
      setFileName(name);
      try {
        const parser = new FF7SceneParser(arrayBuffer);
        const data = parser.parse();
        setParsedData(data);
        setStatus('Building 3D scene...');
        const statsResult = rendererRef.current.loadScene(data) as Stats;
        setStats(formatStats(statsResult));
        setStatus('Ready');
        setExportDisabled(false);
      } catch (error: any) {
        console.error('Error parsing or rendering scene:', error);
        setStatus(`Error: ${error?.message ?? 'Unknown error'}`);
        setStats('');
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
      setStatus(`Loading ${file.name}...`);
      try {
        const buffer = await file.arrayBuffer();
        parseAndDisplay(buffer, file.name);
      } catch (error: any) {
        setStatus(`Error loading file: ${error?.message ?? 'Unknown error'}`);
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
    rendererRef.current?.setPaletteOverrides(paletteState.ground, paletteState.sections);
    if (parsedData) {
      rendererRef.current?.loadScene(parsedData);
    }
  };

  const handleExport = async () => {
    if (!parsedData) {
      setStatus('No scene loaded to export');
      return;
    }

    const prefix = prompt('Enter 2-letter prefix for battle location (e.g., RJ, AB, XY):');
    if (!prefix) {
      setStatus('Export cancelled');
      return;
    }

    const cleanPrefix = prefix.trim().toUpperCase().substring(0, 2).padEnd(2, 'A');
    setStatus(`Starting export wizard for ${cleanPrefix}...`);

    try {
      const wizard = new ExportWizard({ renderer: rendererRef.current });
      const files = await wizard.start(parsedData, cleanPrefix);
      if (!files) {
        setStatus('Export cancelled');
        return;
      }

      setStatus(`Packaging ${files.length} files...`);
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

      setStatus(`Exported ${cleanPrefix} battle location successfully (${files.length} files)`);
    } catch (error: any) {
      console.error('Export error:', error);
      setStatus(`Export failed: ${error?.message ?? 'Unknown error'}`);
    }
  };

  useEffect(() => {
    setPaletteState({ ground: 0, sections: {} });
  }, [parsedData]);

  const controls = useMemo(
    () => (
      <ViewportControls
        showGround={showGround}
        showSky={showSky}
        showObjects={showObjects}
        wireframe={wireframe}
        debugUV={debugUV}
        uvMappingMode={uvMappingMode}
        triUvMappingMode={triUvMappingMode}
        uvShiftOffset={uvShiftOffset}
        onShowGroundChange={setShowGround}
        onShowSkyChange={setShowSky}
        onShowObjectsChange={setShowObjects}
        onWireframeChange={setWireframe}
        onDebugUVChange={setDebugUV}
        onUvMappingChange={(mode) => {
          setUvMappingMode(mode);
          reparseIfLoaded();
        }}
        onTriUvMappingChange={(mode) => {
          setTriUvMappingMode(mode);
          reparseIfLoaded();
        }}
        onUvShiftChange={(shift) => {
          setUvShiftOffset(shift);
          reparseIfLoaded();
        }}
        onResetCamera={() => rendererRef.current?.resetCamera()}
      />
    ),
    [debugUV, reparseIfLoaded, showGround, showObjects, showSky, triUvMappingMode, uvMappingMode, uvShiftOffset, wireframe]
  );

  return (
    <div className="app-container">
      <Header fileName={fileName} onFileChange={handleFile} onExport={handleExport} exportDisabled={exportDisabled} />

      <main className="app-main">
        <aside className="panel panel-left">
          <div className="panel-header">
            <h2>Debug Info</h2>
          </div>
          <DebugPanel data={parsedData} />
        </aside>

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
          <div className="panel-section">
            <div className="panel-header">
              <h2>Texture Preview</h2>
            </div>
            <TexturePreview texture={parsedData?.texture} />
          </div>

          <div className="panel-section">
            <div className="panel-header">
              <h2>Palette Debug</h2>
            </div>
            <PaletteDebug data={parsedData} paletteState={paletteState} onPaletteChange={setPaletteState} onApply={applyPalettes} />
          </div>

          <div className="panel-section">
            <div className="panel-header">
              <h2>Sections</h2>
            </div>
            <SectionsPanel sections={parsedData?.sections} />
          </div>
        </aside>
      </main>

      <StatusBar status={status} stats={stats} />
    </div>
  );
};

export default App;

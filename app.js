/**
 * FF7 Battle Scene Viewer - Main Application
 */

class FF7ViewerApp {
    constructor() {
        this.renderer = null;
        this.parsedData = null;
        this.lastLoadedFile = null;
        this.lastArrayBuffer = null;
        
        this.initElements();
        this.initRenderer();
        this.initEventListeners();
    }

    initElements() {
        this.fileInput = document.getElementById('file-input');
        this.fileName = document.getElementById('file-name');
        this.dropZone = document.getElementById('drop-zone');
        this.viewportOverlay = document.getElementById('viewport-overlay');
        this.viewport = document.getElementById('viewport');
        
        this.debugPanel = document.getElementById('debug-panel');
        this.sectionsPanel = document.getElementById('sections-panel');
        this.paletteDebugPanel = document.getElementById('palette-debug-panel');
        this.texturePanel = document.getElementById('texture-panel');
        this.textureCanvas = document.getElementById('texture-canvas');
        
        this.statusText = document.getElementById('status-text');
        this.statsText = document.getElementById('stats-text');
        
        this.showGround = document.getElementById('show-ground');
        this.showSky = document.getElementById('show-sky');
        this.showObjects = document.getElementById('show-objects');
        this.wireframeMode = document.getElementById('wireframe-mode');
        this.resetCamera = document.getElementById('reset-camera');
        
        this.sectionPaletteOverrides = {};
        this.exportBtn = document.getElementById('export-btn');
    }

    initRenderer() {
        this.renderer = new FF7SceneRenderer(this.viewport);
    }

    initEventListeners() {
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        this.viewport.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.viewport.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.viewport.addEventListener('drop', (e) => this.handleDrop(e));
        
        this.showGround.addEventListener('change', (e) => {
            this.renderer.setShowGround(e.target.checked);
        });
        
        this.showSky.addEventListener('change', (e) => {
            this.renderer.setShowSky(e.target.checked);
        });
        
        this.showObjects.addEventListener('change', (e) => {
            this.renderer.setShowObjects(e.target.checked);
        });
        
        this.wireframeMode.addEventListener('change', (e) => {
            this.renderer.setWireframe(e.target.checked);
        });
        
        const debugUVMode = document.getElementById('debug-uv-mode');
        if (debugUVMode) {
            debugUVMode.addEventListener('change', (e) => {
                this.renderer.setDebugUVMode(e.target.checked);
            });
        }
        
        const uvMappingSelect = document.getElementById('uv-mapping-select');
        console.log('uvMappingSelect element:', uvMappingSelect);
        if (uvMappingSelect) {
            uvMappingSelect.addEventListener('change', (e) => {
                window.uvMappingMode = parseInt(e.target.value, 10);
                console.log('Quad UV mapping mode changed to:', window.uvMappingMode);
                console.log('lastArrayBuffer exists:', !!this.lastArrayBuffer);
                // Re-parse and display if we have data loaded
                if (this.lastArrayBuffer) {
                    console.log('Calling parseAndDisplay...');
                    this.parseAndDisplay(this.lastArrayBuffer, this.fileName.textContent);
                }
            });
        }
        
        window.uvMappingMode = 1;  // Mode 1 [0,1,2,3]: Direct mapping
        uvMappingSelect.value = '1';  // Update dropdown to match
        
        const triUvMappingSelect = document.getElementById('tri-uv-mapping-select');
        console.log('triUvMappingSelect element:', triUvMappingSelect);
        if (triUvMappingSelect) {
            triUvMappingSelect.addEventListener('change', (e) => {
                window.triUvMappingMode = parseInt(e.target.value, 10);
                console.log('Tri UV mapping mode changed to:', window.triUvMappingMode);
                console.log('lastArrayBuffer exists:', !!this.lastArrayBuffer);
                // Re-parse and display if we have data loaded
                if (this.lastArrayBuffer) {
                    console.log('Calling parseAndDisplay...');
                    this.parseAndDisplay(this.lastArrayBuffer, this.fileName.textContent);
                }
            });
        }
        
        window.triUvMappingMode = 0;  // Mode 0 [0,1,2]: Direct mapping
        triUvMappingSelect.value = '0';  // Update dropdown to match
        
        const uvShiftInput = document.getElementById('uv-shift-input');
        if (uvShiftInput) {
            uvShiftInput.addEventListener('change', (e) => {
                window.uvShiftOffset = parseInt(e.target.value, 10) || 0;
                console.log('UV shift offset changed to:', window.uvShiftOffset);
                if (this.lastArrayBuffer) {
                    this.parseAndDisplay(this.lastArrayBuffer, this.fileName.textContent);
                }
            });
        }
        window.uvShiftOffset = 0;
        
        this.resetCamera.addEventListener('click', () => {
            this.renderer.resetCamera();
        });
        
        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', () => this.handleExport());
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        this.dropZone.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        this.dropZone.classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.dropZone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.loadFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.loadFile(files[0]);
        }
    }

    async loadFile(file) {
        this.setStatus(`Loading ${file.name}...`);
        this.fileName.textContent = file.name;
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            this.parseAndDisplay(arrayBuffer, file.name);
        } catch (error) {
            this.setStatus(`Error loading file: ${error.message}`);
            console.error('File load error:', error);
        }
    }

    parseAndDisplay(arrayBuffer, filename) {
        this.setStatus('Parsing scene data...');
        this.lastArrayBuffer = arrayBuffer;
        
        const parser = new FF7SceneParser(arrayBuffer);
        this.parsedData = parser.parse();
        
        if (this.parsedData.errors.length > 0) {
            console.warn('Parse errors:', this.parsedData.errors);
        }
        
        // this.debugUVMapping();
        
        this.updateDebugPanel();
        this.updateSectionsPanel();
        this.updatePaletteDebugPanel();
        this.updateTexturePreview();
        
        this.setStatus('Building 3D scene...');
        
        console.log('About to call renderer.loadScene, renderer exists:', !!this.renderer);
        
        try {
            const stats = this.renderer.loadScene(this.parsedData);
            console.log('loadScene completed, stats:', stats);
            this.setStats(stats);
        } catch (error) {
            console.error('Render ERROR:', error.message, error.stack);
            this.setStats({ vertices: 0, triangles: 0, groundMesh: 0, skyMeshes: 0, objectMeshes: 0 });
        }
        
        this.viewportOverlay.style.display = 'none';
        this.setStatus('Ready');
        
        if (this.exportBtn) {
            this.exportBtn.disabled = false;
            this.exportBtn.style.background = '#3a6a4a';
            this.exportBtn.style.color = '#c0e0c0';
        }
    }
    
    debugUVMapping() {
        const data = this.parsedData;
        if (!data.groundPlane) return;
        
        const gp = data.groundPlane;
        const verts = gp.vertices;
        const texW = data.texture?.image?.width || 512;
        const texH = data.texture?.image?.height || 256;
        
        console.log('%c=== UV MAPPING DEBUG ===', 'color: cyan; font-weight: bold');
        console.log(`Texture: ${texW}x${texH}, UV Mode: ${window.uvMappingMode}`);
        
        gp.quads.slice(0, 4).forEach((quad, i) => {
            const stored = quad.storedUVs || [];
            const tpx = quad.tpx || 0;
            const v = quad.vertices.map(vi => verts[vi] || {x:0, y:0});
            
            const xs = v.map(p => p.x);
            const ys = v.map(p => p.y);
            const minX = Math.min(...xs), maxX = Math.max(...xs);
            const minY = Math.min(...ys), maxY = Math.max(...ys);
            
            const getCorner = (p) => {
                const lr = p.x === minX ? 'L' : 'R';
                const tb = p.y === minY ? 'B' : 'T';
                return tb + lr;
            };
            
            console.log(`%cQuad ${i}: TPX=${tpx}`, 'color: yellow');
            console.log(`  Stored UVs: ${stored.map((s,i) => `UV${i}=(${s.u},${s.v})`).join(' ')}`);
            console.log(`  Final U range with TPX: ${stored[0]?.u + tpx} to ${stored[2]?.u + tpx} (of ${texW})`);
            console.log(`  Vertices:`);
            v.forEach((p, idx) => {
                const corner = getCorner(p);
                console.log(`    V[${idx}] pos=(${p.x},${p.y}) corner=${corner}`);
            });
        });
        
        const mappingNames = ['[2,0,3,1]', '[0,1,2,3]', '[1,0,3,2]', '[0,2,1,3]', '[3,2,1,0]', '[2,3,0,1]'];
        console.log(`%cActive UV mapping: Mode ${window.uvMappingMode} = ${mappingNames[window.uvMappingMode || 0]}`, 'color: orange');
    }

    updateDebugPanel() {
        const data = this.parsedData;
        const header = data.header;
        
        let html = `
            <div class="debug-section">
                <div class="debug-section-header">File Header</div>
                <div class="debug-section-content">
                    <div class="debug-row">
                        <span class="debug-label">Section Count</span>
                        <span class="debug-value number">${header.sectionCount}</span>
                    </div>
                    <div class="debug-row">
                        <span class="debug-label">File Size</span>
                        <span class="debug-value number">${this.formatBytes(this.parsedData.sections.reduce((sum, s) => sum + s.size, 0) + 4 + header.sectionCount * 4)}</span>
                    </div>
                </div>
            </div>
        `;
        
        if (data.metadata) {
            html += `
                <div class="debug-section">
                    <div class="debug-section-header">Metadata (Section 0)</div>
                    <div class="debug-section-content">
                        <div class="debug-row">
                            <span class="debug-label">Flags</span>
                            <span class="debug-value hex">0x${data.metadata.flags.toString(16).padStart(8, '0').toUpperCase()}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (data.groundPlane) {
            const gp = data.groundPlane;
            
            // Get first few quads for UV debugging
            let uvDebugHtml = '';
            const debugQuads = gp.quads.slice(0, 2);
            const verts = gp.vertices;
            const texW = data.texture?.image?.width || 512;
            const texH = data.texture?.image?.height || 256;
            
            debugQuads.forEach((quad, i) => {
                const stored = quad.storedUVs || [];
                const tpx = quad.tpx || 0;
                
                // Get vertex positions
                const v0 = verts[quad.vertices[0]] || {x:0, y:0};
                const v1 = verts[quad.vertices[1]] || {x:0, y:0};
                const v2 = verts[quad.vertices[2]] || {x:0, y:0};
                const v3 = verts[quad.vertices[3]] || {x:0, y:0};
                
                uvDebugHtml += `<div style="font-size: 0.65rem; margin-top: 6px; font-family: monospace; line-height: 1.4;">
                    <b>Quad ${i}:</b> TPX=${tpx}px (tex ${texW}x${texH})<br>
                    <span style="color:#aaa">Raw: [${stored.map(s => `(${s.u},${s.v})`).join(' ')}]</span><br>
                    <span style="color:#ff8888">V0(${v0.x},${v0.y})</span>
                    <span style="color:#88ff88">V1(${v1.x},${v1.y})</span><br>
                    <span style="color:#8888ff">V2(${v2.x},${v2.y})</span>
                    <span style="color:#ffff88">V3(${v3.x},${v3.y})</span>
                </div>`;
            });
            
            html += `
                <div class="debug-section">
                    <div class="debug-section-header">Ground Plane (Section 1)</div>
                    <div class="debug-section-content">
                        <div class="debug-row">
                            <span class="debug-label">Vertices</span>
                            <span class="debug-value number">${gp.vertexCount}</span>
                        </div>
                        <div class="debug-row">
                            <span class="debug-label">Quads</span>
                            <span class="debug-value number">${gp.quadCount}</span>
                        </div>
                        <div class="debug-row">
                            <span class="debug-label">Vertex Data</span>
                            <span class="debug-value">${this.formatBytes(gp.vertexDataSize)}</span>
                        </div>
                        <div style="margin-top: 8px; color: #4ad474; font-size: 0.75rem;">UV Debug (first 3 quads):</div>
                        ${uvDebugHtml}
                    </div>
                </div>
            `;
        }
        
        if (data.geometry3D.length > 0) {
            let totalVerts = 0;
            let totalTris = 0;
            data.geometry3D.forEach(g => {
                totalVerts += g.vertexCount;
                totalTris += g.validTriangles;
            });
            
            html += `
                <div class="debug-section">
                    <div class="debug-section-header">3D Geometry (${data.geometry3D.length} sections)</div>
                    <div class="debug-section-content">
                        <div class="debug-row">
                            <span class="debug-label">Total Vertices</span>
                            <span class="debug-value number">${totalVerts}</span>
                        </div>
                        <div class="debug-row">
                            <span class="debug-label">Total Triangles</span>
                            <span class="debug-value number">${totalTris}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (data.texture) {
            const tex = data.texture;
            html += `
                <div class="debug-section">
                    <div class="debug-section-header">Texture (TIM)</div>
                    <div class="debug-section-content">
                        <div class="debug-row">
                            <span class="debug-label">Dimensions</span>
                            <span class="debug-value">${tex.image.width} × ${tex.image.height}</span>
                        </div>
                        <div class="debug-row">
                            <span class="debug-label">BPP</span>
                            <span class="debug-value number">${tex.bpp}</span>
                        </div>
                        <div class="debug-row">
                            <span class="debug-label">CLUT Colors</span>
                            <span class="debug-value number">${tex.clut ? tex.clut.colors.length : 0}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        this.debugPanel.innerHTML = html;
    }

    updateSectionsPanel() {
        const sections = this.parsedData.sections;
        
        let html = '';
        sections.forEach((section, idx) => {
            const typeLabel = this.getSectionTypeLabel(section);
            const details = this.getSectionDetails(section);
            
            html += `
                <div class="section-item" onclick="this.classList.toggle('expanded')">
                    <div class="section-header">
                        <div class="section-index">${idx}</div>
                        <div class="section-info">
                            <div class="section-type">${typeLabel}</div>
                            <div class="section-size">${this.formatBytes(section.size)} @ 0x${section.offset.toString(16).toUpperCase()}</div>
                        </div>
                    </div>
                    <div class="section-details">
                        ${details}
                    </div>
                </div>
            `;
        });
        
        this.sectionsPanel.innerHTML = html;
    }

    getSectionTypeLabel(section) {
        switch (section.type) {
            case 'metadata': return 'Metadata';
            case '3d_geometry': return '3D Geometry';
            case 'tim_texture': return 'TIM Texture';
            default: return 'Unknown';
        }
    }

    getSectionDetails(section) {
        const data = section.data;
        
        switch (section.type) {
            case 'metadata':
                return `
                    <div class="debug-row">
                        <span class="debug-label">Flags</span>
                        <span class="debug-value hex">0x${data.flags.toString(16).padStart(8, '0')}</span>
                    </div>
                `;
                
            case '3d_geometry':
                return `
                    <div class="debug-row">
                        <span class="debug-label">Vertices</span>
                        <span class="debug-value">${data.vertexCount}</span>
                    </div>
                    <div class="debug-row">
                        <span class="debug-label">Triangles</span>
                        <span class="debug-value">${data.validTriangles} / ${data.triangleCount}</span>
                    </div>
                `;
                
            case 'tim_texture':
                return `
                    <div class="debug-row">
                        <span class="debug-label">Size</span>
                        <span class="debug-value">${data.image.width} × ${data.image.height}</span>
                    </div>
                    <div class="debug-row">
                        <span class="debug-label">BPP</span>
                        <span class="debug-value">${data.bpp}</span>
                    </div>
                    <div class="debug-row">
                        <span class="debug-label">Palettes</span>
                        <span class="debug-value">${data.clut ? data.clut.height : 0}</span>
                    </div>
                `;
                
            default:
                return '<div class="debug-row">No details available</div>';
        }
    }

    updateTexturePreview() {
        const texture = this.parsedData.texture;
        
        if (!texture) {
            this.texturePanel.innerHTML = '<div class="placeholder">No texture found</div>';
            return;
        }
        
        const canvas = decodeTIMToCanvas(texture);
        
        if (canvas) {
            const displayCanvas = this.textureCanvas;
            displayCanvas.width = canvas.width;
            displayCanvas.height = canvas.height;
            const ctx = displayCanvas.getContext('2d');
            ctx.drawImage(canvas, 0, 0);
            
            displayCanvas.style.display = 'block';
            
            this.texturePanel.innerHTML = '';
            this.texturePanel.appendChild(displayCanvas);
            
            const info = document.createElement('div');
            info.className = 'texture-info';
            info.textContent = `${texture.image.width} × ${texture.image.height} • ${texture.bpp}bpp • ${texture.clut ? texture.clut.colors.length : 0} colors`;
            this.texturePanel.appendChild(info);
        } else {
            this.texturePanel.innerHTML = '<div class="placeholder">Failed to decode texture</div>';
        }
    }
    
    updatePaletteDebugPanel() {
        const data = this.parsedData;
        if (!data || !data.texture || !data.texture.clut) {
            this.paletteDebugPanel.innerHTML = '<div class="placeholder">No palette data</div>';
            return;
        }
        
        const numPalettes = data.texture.clut.height;
        const geometry3D = data.geometry3D || [];
        
        let html = `<div style="font-size: 0.7rem; margin-bottom: 8px; color: #888;">
            TIM has ${numPalettes} palette(s)
        </div>`;
        
        // Ground plane palette override
        html += `
            <div style="margin-bottom: 8px; padding: 6px; background: #1a1a25; border-radius: 4px;">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.75rem;">
                    <span style="flex: 1;">Ground Plane</span>
                    <select id="palette-ground" style="padding: 2px 4px; font-size: 0.7rem;">
                        ${Array.from({length: numPalettes}, (_, i) => 
                            `<option value="${i}" ${i === 0 ? 'selected' : ''}>Palette ${i}</option>`
                        ).join('')}
                    </select>
                </label>
            </div>
        `;
        
        // Per-section palette overrides
        geometry3D.forEach((geom, idx) => {
            const sectionNum = idx + 2;
            const sectionName = idx < 3 ? `Sky Section ${idx}` : `Object Section ${idx - 3}`;
            const triCount = geom.triangles?.length || 0;
            const quadCount = geom.quads?.length || 0;
            
            // Get detected palettes from parsed data
            const detectedPalettes = new Set();
            if (geom.triangles) {
                geom.triangles.forEach(tri => {
                    detectedPalettes.add(tri.paletteIndex || 0);
                });
            }
            if (geom.quads) {
                geom.quads.forEach(quad => {
                    detectedPalettes.add(quad.paletteIndex || 0);
                });
            }
            const detectedStr = Array.from(detectedPalettes).sort().join(', ');
            
            html += `
                <div style="margin-bottom: 8px; padding: 6px; background: #1a1a25; border-radius: 4px;">
                    <div style="font-size: 0.65rem; color: #666; margin-bottom: 4px;">
                        Section ${sectionNum}: ${triCount} tris, ${quadCount} quads
                        ${detectedStr ? `<br>Detected: pal ${detectedStr}` : ''}
                    </div>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 0.75rem;">
                        <span style="flex: 1;">${sectionName}</span>
                        <select id="palette-section-${sectionNum}" data-section="${sectionNum}" style="padding: 2px 4px; font-size: 0.7rem;">
                            <option value="-1">Auto</option>
                            ${Array.from({length: numPalettes}, (_, i) => 
                                `<option value="${i}">Palette ${i}</option>`
                            ).join('')}
                        </select>
                    </label>
                </div>
            `;
        });
        
        // Apply button
        html += `
            <button id="apply-palettes" style="width: 100%; padding: 8px; margin-top: 8px; background: #3a5a8a; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 0.75rem;">
                Apply Palette Changes
            </button>
        `;
        
        this.paletteDebugPanel.innerHTML = html;
        
        // Add event listener
        document.getElementById('apply-palettes').addEventListener('click', () => {
            this.applyPaletteOverrides();
        });
    }
    
    applyPaletteOverrides() {
        // Collect palette overrides
        const groundPalette = parseInt(document.getElementById('palette-ground').value, 10);
        
        const sectionOverrides = {};
        const selects = this.paletteDebugPanel.querySelectorAll('select[data-section]');
        selects.forEach(sel => {
            const sectionNum = parseInt(sel.dataset.section, 10);
            const palValue = parseInt(sel.value, 10);
            if (palValue >= 0) {
                sectionOverrides[sectionNum] = palValue;
            }
        });
        
        console.log('Applying palette overrides:', { groundPalette, sectionOverrides });
        
        // Pass to renderer
        this.renderer.setPaletteOverrides(groundPalette, sectionOverrides);
        
        // Reload the scene
        if (this.parsedData) {
            this.renderer.loadScene(this.parsedData);
        }
    }
    
    async handleExport() {
        if (!this.parsedData) {
            this.setStatus('No scene loaded to export');
            return;
        }
        
        const prefix = prompt('Enter 2-letter prefix for battle location (e.g., RJ, AB, XY):');
        
        if (!prefix) {
            this.setStatus('Export cancelled');
            return;
        }
        
        const cleanPrefix = prefix.trim().toUpperCase().substring(0, 2).padEnd(2, 'A');
        
        this.setStatus(`Starting export wizard for ${cleanPrefix}...`);
        
        try {
            const wizard = new ExportWizard(this);
            const files = await wizard.start(this.parsedData, cleanPrefix);
            
            if (!files) {
                this.setStatus('Export cancelled');
                return;
            }
            
            this.setStatus(`Packaging ${files.length} files...`);
            
            if (typeof JSZip === 'undefined') {
                console.error('JSZip library not loaded');
                this.setStatus('Export failed: JSZip not loaded');
                return;
            }
            
            const zip = new JSZip();
            const folder = zip.folder(cleanPrefix + '_battle_location');
            
            files.forEach(file => {
                folder.file(file.name, file.data);
            });
            
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${cleanPrefix}_battle_location.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.setStatus(`Exported ${cleanPrefix} battle location successfully (${files.length} files)`);
        } catch (error) {
            console.error('Export error:', error);
            this.setStatus(`Export failed: ${error.message}`);
        }
    }

    setStatus(text) {
        this.statusText.textContent = text;
    }

    setStats(stats) {
        this.statsText.textContent = `${stats.vertices.toLocaleString()} vertices • ${stats.triangles.toLocaleString()} triangles • ${stats.groundMesh + stats.skyMeshes + stats.objectMeshes} meshes`;
    }

    formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new FF7ViewerApp();
});


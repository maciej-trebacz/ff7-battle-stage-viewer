/**
 * ExportWizard - Orchestrates the multi-step export process
 * Coordinates between renderer, texture region selector, and exporter
 */

class ExportWizard {
    constructor(app) {
        this.app = app;
        this.renderer = app.renderer;
        this.parsedData = null;
        this.prefix = '';
        this.regionSelector = null;
        this.regionConfigs = [];
        this.currentSectionIndex = 0;
        this.sections = [];
        this.duplicateSections = [];
        this.cancelled = false;
        this.createdTextures = [];
        this.nextTexIndex = 0;
    }
    
    async start(parsedData, prefix) {
        this.parsedData = parsedData;
        this.prefix = prefix;
        this.regionConfigs = [];
        this.currentSectionIndex = 0;
        this.cancelled = false;
        this.createdTextures = [];
        this.nextTexIndex = 0;
        this.duplicateSections = [];
        
        this.buildSectionList();
        
        if (this.sections.length === 0) {
            console.warn('No sections to export');
            return null;
        }
        
        if (!this.regionSelector) {
            this.regionSelector = new TextureRegionSelector();
        }
        
        try {
            for (let i = 0; i < this.sections.length; i++) {
                if (this.cancelled) return null;
                
                this.currentSectionIndex = i;
                const section = this.sections[i];
                
                this.renderer.isolateSection(section.type, section.index);
                
                const result = await this.promptForRegion(section);
                
                if (result === 'cancelled') {
                    this.cancelled = true;
                    this.renderer.restoreAllSections();
                    return null;
                }
                
                let baseConfig;

                if (result.reuseTexIndex !== undefined) {
                    baseConfig = {
                        sectionId: section.sectionId,
                        sectionType: section.type,
                        sectionIndex: section.index,
                        name: section.name,
                        palette: section.palette,
                        region: null,
                        texIndex: result.reuseTexIndex,
                        isReuse: true
                    };
                    this.regionConfigs.push(baseConfig);
                } else {
                    const texIndex = this.nextTexIndex++;

                    this.createdTextures.push({
                        texIndex: texIndex,
                        name: section.name,
                        region: result.region,
                        palette: section.palette
                    });

                    baseConfig = {
                        sectionId: section.sectionId,
                        sectionType: section.type,
                        sectionIndex: section.index,
                        name: section.name,
                        palette: section.palette,
                        region: result.region,
                        texIndex: texIndex,
                        isReuse: false
                    };
                    this.regionConfigs.push(baseConfig);
                }

                if (result.duplicateAtEnd) {
                    const duplicateSectionId = `${section.sectionId}-dup-${this.duplicateSections.length + 1}`;
                    const duplicateSection = {
                        ...section,
                        sectionId: duplicateSectionId,
                        name: `${section.name} (Duplicate)`
                    };

                    const duplicateConfig = {
                        ...baseConfig,
                        sectionId: duplicateSectionId,
                        isDuplicate: true,
                        originalSectionId: section.sectionId
                    };

                    this.duplicateSections.push(duplicateSection);
                    this.regionConfigs.push(duplicateConfig);
                }
            }
            
            this.renderer.restoreAllSections();
            
            return this.generateExport();
            
        } catch (error) {
            console.error('Export wizard error:', error);
            this.renderer.restoreAllSections();
            throw error;
        }
    }
    
    buildSectionList() {
        this.sections = [];
        
        if (this.parsedData.groundPlane) {
            const palette = this.detectPalette(this.parsedData.groundPlane);
            this.sections.push({
                sectionId: 'ground-0',
                type: 'ground',
                index: 0,
                name: 'Ground Plane',
                data: this.parsedData.groundPlane,
                palette: palette
            });
        }
        
        this.parsedData.geometry3D.forEach((geom, idx) => {
            const palette = this.detectPalette(geom);
            const isSky = idx < 3;
            const name = isSky ? `Sky Section ${idx}` : `Object Section ${idx - 3}`;

            this.sections.push({
                sectionId: `3d-${idx}`,
                type: '3d',
                index: idx,
                name: name,
                data: geom,
                palette: palette
            });
        });
    }
    
    detectPalette(geomData) {
        const paletteCounts = {};
        
        if (geomData.triangles) {
            geomData.triangles.forEach(tri => {
                const p = tri.paletteIndex || 0;
                paletteCounts[p] = (paletteCounts[p] || 0) + 1;
            });
        }
        
        if (geomData.quads) {
            geomData.quads.forEach(quad => {
                const p = quad.paletteIndex || 0;
                paletteCounts[p] = (paletteCounts[p] || 0) + 1;
            });
        }
        
        let maxCount = 0;
        let dominantPalette = 0;
        for (const [palette, count] of Object.entries(paletteCounts)) {
            if (count > maxCount) {
                maxCount = count;
                dominantPalette = parseInt(palette);
            }
        }
        
        return dominantPalette;
    }
    
    extractUVPolygons(geomData) {
        const polygons = [];
        const textureWidth = this.parsedData.texture?.image?.width || 256;
        const textureHeight = this.parsedData.texture?.image?.height || 256;
        
        const basePageX = 6;
        const texturePageX = geomData.texturePageX || basePageX;
        const textureXOffset = (texturePageX - basePageX) * 128;
        
        if (geomData.triangles) {
            geomData.triangles.forEach(tri => {
                if (tri.storedUVs && tri.storedUVs.length >= 3) {
                    polygons.push(tri.storedUVs.slice(0, 3).map(uv => ({
                        u: (uv.u || 0) + textureXOffset,
                        v: uv.v || 0
                    })));
                }
            });
        }
        
        if (geomData.quads) {
            geomData.quads.forEach(quad => {
                if (quad.storedUVs && quad.storedUVs.length >= 4) {
                    const uvs = quad.storedUVs.slice(0, 4).map(uv => ({
                        u: (uv.u || 0) + textureXOffset,
                        v: uv.v || 0
                    }));
                    polygons.push([uvs[0], uvs[1], uvs[3], uvs[2]]);
                }
            });
        }
        
        return polygons;
    }
    
    computeUVBounds(uvPolygons) {
        let minU = Infinity, minV = Infinity;
        let maxU = -Infinity, maxV = -Infinity;
        
        uvPolygons.forEach(poly => {
            poly.forEach(uv => {
                minU = Math.min(minU, uv.u);
                minV = Math.min(minV, uv.v);
                maxU = Math.max(maxU, uv.u);
                maxV = Math.max(maxV, uv.v);
            });
        });
        
        if (minU === Infinity) {
            return null;
        }
        
        const snapToGrid = (v) => Math.floor(v / 32) * 32;
        const snapToGridCeil = (v) => Math.ceil(v / 32) * 32;
        
        return {
            x: snapToGrid(minU),
            y: snapToGrid(minV),
            width: Math.max(64, snapToGridCeil(maxU) - snapToGrid(minU)),
            height: Math.max(64, snapToGridCeil(maxV) - snapToGrid(minV))
        };
    }
    
    promptForRegion(section) {
        return new Promise((resolve) => {
            const uvPolygons = this.extractUVPolygons(section.data);
            const suggestedRegion = this.computeUVBounds(uvPolygons);
            
            const textureCanvas = decodeTIMToCanvas(
                this.parsedData.texture, 
                section.palette
            );
            
            if (!textureCanvas) {
                console.warn('Failed to decode texture for section:', section.name);
                resolve({ region: null });
                return;
            }
            
            this.regionSelector.setCallbacks(
                (region, duplicateAtEnd) => {
                    this.regionSelector.hide();
                    resolve({ region: region, duplicateAtEnd });
                },
                () => {
                    this.regionSelector.hide();
                    resolve({ region: null });
                },
                () => {
                    this.regionSelector.hide();
                    resolve('cancelled');
                },
                (reuseTexIndex, duplicateAtEnd) => {
                    this.regionSelector.hide();
                    resolve({ reuseTexIndex: reuseTexIndex, duplicateAtEnd });
                }
            );
            
            const progressText = `(${this.currentSectionIndex + 1}/${this.sections.length})`;
            const texCount = this.createdTextures.length;
            const limitWarning = texCount >= 8 ? ` [${texCount}/10 textures]` : '';
            
            this.regionSelector.show(
                `${section.name} ${progressText}${limitWarning}`,
                textureCanvas,
                uvPolygons,
                suggestedRegion,
                this.createdTextures
            );
        });
    }
    
    generateExport() {
        const exporter = new FF7Exporter(this.parsedData, this.prefix);
        const sectionsToExport = [...this.sections, ...this.duplicateSections];
        return exporter.exportAllWithRegions(
            this.regionConfigs,
            this.createdTextures,
            sectionsToExport
        );
    }
}

window.ExportWizard = ExportWizard;

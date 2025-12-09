// @ts-nocheck
import { FF7Exporter } from './exporter';
import { TextureRegionSelector } from './TextureRegionSelector';
import { decodeTIMToCanvas } from './parser';

/**
 * ExportWizard - Orchestrates the multi-step export process
 * Coordinates between renderer, texture region selector, and exporter
 */

export class ExportWizard {
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
                
                this.renderer.isolateSection(section.index);
                
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
        
        this.parsedData.meshes.forEach((geom, idx) => {
            const palette = this.detectPalette(geom);
            const isGround = idx === 0;
            const isSky = idx >= 1 && idx <= 3;
            const name = isGround 
                ? 'Ground Plane' 
                : isSky 
                    ? `Sky Section ${idx - 1}` 
                    : `Object Section ${idx - 4}`;

            this.sections.push({
                sectionId: `mesh-${idx}`,
                type: 'mesh',
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

        const texW = this.parsedData.texture?.image?.width || 256;
        const texH = this.parsedData.texture?.image?.height || 256;
        const blockSize = 256;

        const clampStart = (value, maxStart) => Math.max(0, Math.min(value, maxStart));
        const coversRange = (start, min, max, size) => min >= start && max <= start + size;

        const maxXStart = Math.max(0, texW - blockSize);
        const maxYStart = Math.max(0, texH - blockSize);

        const xFromMin = clampStart(Math.floor(minU / blockSize) * blockSize, maxXStart);
        const xFromMax = clampStart(Math.floor((maxU - blockSize) / blockSize) * blockSize, maxXStart);

        const chooseStart = (candidateA, candidateB, min, max, size) => {
            const candidates = [candidateA, candidateB];
            const exact = candidates.find(c => coversRange(c, min, max, size));
            if (exact !== undefined) return exact;

            return candidates.reduce((best, current) => {
                const bestOverflow = Math.max(0, min - best) + Math.max(0, max - (best + size));
                const currentOverflow = Math.max(0, min - current) + Math.max(0, max - (current + size));
                return currentOverflow < bestOverflow ? current : best;
            });
        };

        const xStart = chooseStart(xFromMin, xFromMax, minU, maxU, blockSize);

        const yFromMin = clampStart(Math.floor(minV / blockSize) * blockSize, maxYStart);
        const yFromMax = clampStart(Math.floor((maxV - blockSize) / blockSize) * blockSize, maxYStart);
        const yStart = chooseStart(yFromMin, yFromMax, minV, maxV, blockSize);

        return {
            x: xStart,
            y: yStart,
            width: blockSize,
            height: blockSize
        };
    }
    
    promptForRegion(section) {
        return new Promise((resolve) => {
            const uvPolygons = this.extractUVPolygons(section.data);
            const suggestedRegion = this.computeUVBounds(uvPolygons);
            const matchingTexture = this.findMatchingTexture(suggestedRegion, section.palette);
            
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
                this.createdTextures,
                matchingTexture
            );
        });
    }

    findMatchingTexture(region, palette) {
        if (!region) return null;

        return this.createdTextures.find(tex => {
            if (!tex.region) return false;
            const samePalette = tex.palette === palette;
            const sameRegion =
                tex.region.x === region.x &&
                tex.region.y === region.y &&
                tex.region.width === region.width &&
                tex.region.height === region.height;

            return samePalette && sameRegion;
        })?.texIndex ?? null;
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

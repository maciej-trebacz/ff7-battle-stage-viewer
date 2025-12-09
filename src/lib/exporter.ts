// @ts-nocheck
import JSZip from 'jszip';

/**
 * FF7 PC Battle Location Exporter
 * Converts PSX battle scene data to PC FF7 battle location format
 * Based on Kimera's FF7BattleSkeleton.cs and FF7PModel.cs
 */

export class FF7Exporter {
    constructor(parsedData, prefix) {
        this.parsedData = parsedData;
        this.prefix = (prefix || 'XX').toUpperCase().substring(0, 2).padEnd(2, 'A');
    }

    getModelFileName(index) {
        let suffix1 = 'A'.charCodeAt(0);
        let suffix2 = 'M'.charCodeAt(0) + index;
        
        while (suffix2 > 'Z'.charCodeAt(0)) {
            suffix2 = suffix2 - 26;
            suffix1++;
        }
        
        return (this.prefix + String.fromCharCode(suffix1) + String.fromCharCode(suffix2)).toLowerCase();
    }

    getTextureFileName(index) {
        const suffix2 = 'C'.charCodeAt(0) + index;
        return (this.prefix + 'A' + String.fromCharCode(suffix2)).toLowerCase();
    }

    exportAll() {
        const files = [];
        const modelPieces = [];

        if (this.parsedData.groundPlane) {
            modelPieces.push(this.parsedData.groundPlane);
        }

        this.parsedData.geometry3D.forEach(geom => {
            modelPieces.push(geom);
        });

        const numTextures = this.parsedData.texture?.clut?.height || 1;
        
        // Get texture dimensions for UV normalization
        const textureWidth = this.parsedData.texture?.image?.width || 256;
        const textureHeight = this.parsedData.texture?.image?.height || 256;

        const skeletonData = this.buildSkeletonFile(modelPieces.length, numTextures);
        files.push({
            name: (this.prefix + 'AA').toLowerCase(),
            data: skeletonData
        });

        if (this.parsedData.texture) {
            const textures = this.buildTEXFiles(this.parsedData.texture);
            textures.forEach((texData, idx) => {
                files.push({
                    name: this.getTextureFileName(idx),
                    data: texData
                });
            });
        }

        modelPieces.forEach((geom, idx) => {
            const pData = this.buildPFileData(geom, textureWidth, textureHeight);
            files.push({
                name: this.getModelFileName(idx),
                data: pData
            });
        });

        return files;
    }
    
    exportAllWithRegions(regionConfigs, createdTextures, exportSections = null) {
        const files = [];
        const modelPieces = exportSections ? [...exportSections] : [];

        if (!exportSections) {
            if (this.parsedData.groundPlane) {
                modelPieces.push({ data: this.parsedData.groundPlane, type: 'ground', index: 0, sectionId: 'ground-0' });
            }

            this.parsedData.geometry3D.forEach((geom, idx) => {
                modelPieces.push({ data: geom, type: '3d', index: idx, sectionId: `3d-${idx}` });
            });
        }

        const numTextures = createdTextures.length;
        const skeletonData = this.buildSkeletonFile(modelPieces.length, numTextures);
        files.push({
            name: (this.prefix + 'AA').toLowerCase(),
            data: skeletonData
        });

        createdTextures.forEach((tex) => {
            if (this.parsedData.texture) {
                const texData = this.buildTEXFileWithRegion(
                    this.parsedData.texture,
                    tex.palette,
                    tex.region
                );
                files.push({
                    name: this.getTextureFileName(tex.texIndex),
                    data: texData
                });
            }
        });

        modelPieces.forEach((piece, idx) => {
            const regionConfig = regionConfigs.find(rc => {
                if (piece.sectionId) return rc.sectionId === piece.sectionId;
                return rc.sectionType === piece.type && rc.sectionIndex === piece.index;
            });
            
            const texIndex = regionConfig?.texIndex ?? idx;
            
            let region = null;
            if (regionConfig) {
                if (regionConfig.isReuse) {
                    const reusedTex = createdTextures.find(t => t.texIndex === texIndex);
                    region = reusedTex?.region || null;
                } else {
                    region = regionConfig.region;
                }
            }
            
            const pData = this.buildPFileDataWithRegion(piece.data, region, texIndex);
            files.push({
                name: this.getModelFileName(idx),
                data: pData
            });
        });

        return files;
    }
    
    buildTEXFileWithRegion(timData, paletteIndex, region) {
        const { bpp, clut, image, pixelData } = timData;
        
        const texWidth = 256;
        const texHeight = 256;
        const colorsPerPalette = clut ? clut.width : 256;
        
        const headerSize = 0xEC;
        const paletteDataSize = colorsPerPalette * 4;
        const pixelDataSize = texWidth * texHeight;
        const totalSize = headerSize + paletteDataSize + pixelDataSize;
        
        const buffer = new ArrayBuffer(totalSize);
        const view = new DataView(buffer);
        
        view.setUint32(0x00, 1, true);
        view.setUint32(0x04, 0, true);
        view.setUint32(0x08, 0, true);
        view.setUint32(0x0C, 0, true);
        view.setUint32(0x10, 3, true);
        view.setUint32(0x14, 4, true);
        view.setUint32(0x18, 8, true);
        view.setUint32(0x1C, 0, true);
        view.setUint32(0x20, 8, true);
        view.setUint32(0x24, 8, true);
        view.setUint32(0x28, 0x20, true);
        view.setUint32(0x2C, 0, true);
        view.setUint32(0x30, 1, true);
        view.setUint32(0x34, colorsPerPalette, true);
        view.setUint32(0x38, 8, true);
        view.setUint32(0x3C, texWidth, true);
        view.setUint32(0x40, texHeight, true);
        view.setUint32(0x44, 0, true);
        view.setUint32(0x48, 0, true);
        view.setUint32(0x4C, 1, true);
        view.setUint32(0x50, 8, true);
        view.setUint32(0x54, 0, true);
        view.setUint32(0x58, colorsPerPalette, true);
        view.setUint32(0x5C, colorsPerPalette, true);
        view.setUint32(0x60, 0, true);
        view.setUint32(0x64, 8, true);
        view.setUint32(0x68, 1, true);
        
        for (let i = 0x6C; i <= 0xB8; i += 4) {
            view.setUint32(i, 0, true);
        }
        
        view.setUint32(0xBC, 0, true);
        view.setUint32(0xC0, 0, true);
        view.setUint32(0xC4, 0xFF, true);
        view.setUint32(0xC8, 4, true);
        view.setUint32(0xCC, 1, true);
        view.setUint32(0xD0, 0, true);
        view.setUint32(0xD4, 0, true);
        view.setUint32(0xD8, 0, true);
        view.setUint32(0xDC, 0, true);
        view.setUint32(0xE0, 0, true);
        view.setUint32(0xE4, 0, true);
        view.setUint32(0xE8, 0, true);
        
        let offset = headerSize;
        if (clut && clut.colors) {
            const paletteStart = paletteIndex * colorsPerPalette;
            for (let i = 0; i < colorsPerPalette; i++) {
                const color = clut.colors[paletteStart + i] || { r: 0, g: 0, b: 0, a: 255 };
                view.setUint8(offset++, color.b);
                view.setUint8(offset++, color.g);
                view.setUint8(offset++, color.r);
                view.setUint8(offset++, color.a);
            }
        } else {
            for (let i = 0; i < colorsPerPalette * 4; i++) {
                view.setUint8(offset++, 0);
            }
        }
        
        const pixelArray = new Uint8Array(buffer, offset, pixelDataSize);
        const srcRawWidth = image.rawWidth * 2;
        const srcWidth = image.width;
        const srcHeight = image.height;
        
        if (region) {
            const regionX = region.x;
            const regionY = region.y;
            const regionW = region.width;
            const regionH = region.height;
            
            for (let y = 0; y < texHeight; y++) {
                for (let x = 0; x < texWidth; x++) {
                    const dstIdx = y * texWidth + x;
                    
                    let srcX, srcY;
                    
                    if (x < regionW && y < regionH) {
                        srcX = regionX + x;
                        srcY = regionY + y;
                    } else if (x >= regionW && y < regionH) {
                        srcX = regionX + regionW - 1;
                        srcY = regionY + y;
                    } else if (x < regionW && y >= regionH) {
                        srcX = regionX + x;
                        srcY = regionY + regionH - 1;
                    } else {
                        srcX = regionX + regionW - 1;
                        srcY = regionY + regionH - 1;
                    }
                    
                    if (srcX >= 0 && srcX < srcWidth && srcY >= 0 && srcY < srcHeight) {
                        const srcIdx = srcY * srcRawWidth + srcX;
                        if (srcIdx < pixelData.length) {
                            pixelArray[dstIdx] = pixelData[srcIdx];
                        }
                    }
                }
            }
        } else {
            for (let y = 0; y < texHeight; y++) {
                for (let x = 0; x < texWidth; x++) {
                    if (x < srcWidth && y < srcHeight) {
                        const srcIdx = y * srcRawWidth + x;
                        const dstIdx = y * texWidth + x;
                        if (srcIdx < pixelData.length) {
                            pixelArray[dstIdx] = pixelData[srcIdx];
                        }
                    }
                }
            }
        }
        
        return buffer;
    }
    
    buildPFileDataWithRegion(geomData, region, texIndex) {
        const { vertices, triangles, quads, texturePageX } = geomData;
        
        const basePageX = 6;
        const textureXOffset = ((texturePageX || basePageX) - basePageX) * 128;
        
        let regionX = 0, regionY = 0, regionW = 256, regionH = 256;
        if (region) {
            regionX = region.x;
            regionY = region.y;
            regionW = region.width;
            regionH = region.height;
        }
        
        const uniqueVerts = [];
        const vertexMap = new Map();
        
        const getOrCreateVertex = (srcIndex, uv) => {
            const srcVert = vertices[srcIndex];
            if (!srcVert) return 0;
            
            const x = srcVert.x;
            const y = srcVert.z;
            const z = srcVert.y;
            
            const rawU = (uv?.u || 0) + textureXOffset;
            const rawV = uv?.v || 0;
            
            const u = (rawU - regionX) / regionW;
            const v = (rawV - regionY) / regionH;
            
            const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)},${u.toFixed(4)},${v.toFixed(4)}`;
            
            if (vertexMap.has(key)) {
                return vertexMap.get(key);
            }
            
            const newIndex = uniqueVerts.length;
            uniqueVerts.push({ x, y, z, u, v });
            vertexMap.set(key, newIndex);
            return newIndex;
        };

        const allPolygons = [];
        const edges = [];
        const edgeMap = new Map();

        const getOrCreateEdge = (v1, v2) => {
            const key = v1 < v2 ? `${v1}_${v2}` : `${v2}_${v1}`;
            if (!edgeMap.has(key)) {
                edgeMap.set(key, edges.length);
                edges.push([v1, v2]);
            }
            return edgeMap.get(key);
        };

        if (triangles) {
            triangles.forEach(tri => {
                const srcVerts = tri.vertices;
                const uvs = tri.storedUVs || [{ u: 0, v: 0 }, { u: 0, v: 0 }, { u: 0, v: 0 }];

                const v0 = getOrCreateVertex(srcVerts[0], uvs[0]);
                const v1 = getOrCreateVertex(srcVerts[1], uvs[1]);
                const v2 = getOrCreateVertex(srcVerts[2], uvs[2]);

                const e0 = getOrCreateEdge(v0, v1);
                const e1 = getOrCreateEdge(v1, v2);
                const e2 = getOrCreateEdge(v2, v0);

                allPolygons.push({
                    vertices: [v0, v1, v2],
                    normals: [0, 0, 0],
                    edges: [e0, e1, e2],
                    paletteIndex: 0
                });
            });
        }

        if (quads) {
            quads.forEach(quad => {
                const srcVerts = quad.vertices;
                const uvs = quad.storedUVs || [
                    { u: 0, v: 0 }, { u: 255, v: 0 },
                    { u: 0, v: 255 }, { u: 255, v: 255 }
                ];

                const v0 = getOrCreateVertex(srcVerts[0], uvs[0]);
                const v1 = getOrCreateVertex(srcVerts[1], uvs[1]);
                const v2 = getOrCreateVertex(srcVerts[2], uvs[2]);
                const v3 = getOrCreateVertex(srcVerts[3], uvs[3]);

                const e0_1 = getOrCreateEdge(v0, v1);
                const e1_1 = getOrCreateEdge(v1, v2);
                const e2_1 = getOrCreateEdge(v2, v0);

                allPolygons.push({
                    vertices: [v0, v1, v2],
                    normals: [0, 0, 0],
                    edges: [e0_1, e1_1, e2_1],
                    paletteIndex: 0
                });

                const e0_2 = getOrCreateEdge(v1, v3);
                const e1_2 = getOrCreateEdge(v3, v2);
                const e2_2 = getOrCreateEdge(v2, v1);

                allPolygons.push({
                    vertices: [v1, v3, v2],
                    normals: [0, 0, 0],
                    edges: [e0_2, e1_2, e2_2],
                    paletteIndex: 0
                });
            });
        }

        const convertedVerts = uniqueVerts.map(v => ({ x: v.x, y: v.y, z: v.z }));
        const texCoords = uniqueVerts.map(v => ({ u: v.u, v: v.v }));
        
        const groups = this.buildGroupsWithSingleTex(allPolygons, convertedVerts.length, texCoords.length, edges.length, texIndex);
        const bbox = this.computeBoundingBox(convertedVerts);

        const vertexColors = convertedVerts.map(() => ({ r: 255, g: 255, b: 255, a: 255 }));
        const polygonColors = allPolygons.map(() => ({ r: 128, g: 128, b: 128, a: 255 }));

        return this.assemblePFile({
            vertices: convertedVerts,
            texCoords,
            vertexColors,
            polygonColors,
            edges,
            polygons: allPolygons,
            groups,
            boundingBox: bbox
        });
    }
    
    buildGroupsWithSingleTex(polygons, numVertices, numTexCoords, numEdges, texIndex) {
        return [{
            polyType: 3,
            offsetPoly: 0,
            numPoly: polygons.length,
            offsetVert: 0,
            numVert: numVertices,
            offsetEdge: 0,
            numEdge: numEdges,
            offsetTex: 0,
            texFlag: 1,
            texID: texIndex
        }];
    }

    buildSkeletonFile(nJoints, nTextures) {
        const buffer = new ArrayBuffer(52);
        const view = new DataView(buffer);

        view.setInt32(0, 1, true);         // skeletonType (1 = battle location)
        view.setInt32(4, 1, true);         // unk1 (always 1)
        view.setInt32(8, 0, true);         // unk2 (0 for battle locations)
        view.setInt32(12, 0, true);        // nBones (0 for locations)
        view.setInt32(16, 0, true);        // unk3 (always 0)
        view.setInt32(20, nJoints, true);  // nJoints (number of model pieces)
        view.setInt32(24, nTextures, true);// nTextures (one per palette)
        view.setInt32(28, 0, true);        // nsSkeletonAnims (0 - no animations)
        view.setInt32(32, 0, true);        // unk4
        view.setInt32(36, 0, true);        // nWeapons
        view.setInt32(40, 0, true);        // nsWeaponsAnims
        view.setInt32(44, 0, true);        // unk5
        view.setInt32(48, 0, true);        // unk6

        return buffer;
    }

    buildPFileData(geomData, textureWidth = 256, textureHeight = 256) {
        const { vertices, triangles, quads, texturePageX } = geomData;

        // Calculate texture offset based on texture page X
        // PSX uses texture pages (each 128 pixels wide in 8bpp mode)
        // basePageX is typically 6 for battle scenes
        const basePageX = 6;
        const textureXOffset = ((texturePageX || basePageX) - basePageX) * 128;

        // PC format: each vertex has exactly one texture coordinate at the same index
        // We need to create unique (position, UV) pairs - duplicating vertices when they have different UVs
        const uniqueVerts = [];  // { x, y, z, u, v }
        const vertexMap = new Map();  // "x,y,z,u,v" -> index
        
        const getOrCreateVertex = (srcIndex, uv) => {
            const srcVert = vertices[srcIndex];
            if (!srcVert) return 0;
            
            // PSX to PC coordinate conversion
            const x = srcVert.x;
            const y = srcVert.z;  // PSX Z -> PC Y
            const z = srcVert.y;  // PSX Y -> PC Z
            
            // Normalize UVs to 0-1 range for PC format
            // Apply texture page offset then normalize
            const rawU = (uv?.u || 0) + textureXOffset;
            const rawV = uv?.v || 0;
            const u = rawU / textureWidth;
            const v = rawV / textureHeight;
            
            const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)},${u.toFixed(4)},${v.toFixed(4)}`;
            
            if (vertexMap.has(key)) {
                return vertexMap.get(key);
            }
            
            const newIndex = uniqueVerts.length;
            uniqueVerts.push({ x, y, z, u, v });
            vertexMap.set(key, newIndex);
            return newIndex;
        };

        const allPolygons = [];
        const edges = [];
        const edgeMap = new Map();

        const getOrCreateEdge = (v1, v2) => {
            const key = v1 < v2 ? `${v1}_${v2}` : `${v2}_${v1}`;
            if (!edgeMap.has(key)) {
                edgeMap.set(key, edges.length);
                edges.push([v1, v2]);
            }
            return edgeMap.get(key);
        };

        if (triangles) {
            triangles.forEach(tri => {
                const srcVerts = tri.vertices;
                const uvs = tri.storedUVs || [{ u: 0, v: 0 }, { u: 0, v: 0 }, { u: 0, v: 0 }];

                const v0 = getOrCreateVertex(srcVerts[0], uvs[0]);
                const v1 = getOrCreateVertex(srcVerts[1], uvs[1]);
                const v2 = getOrCreateVertex(srcVerts[2], uvs[2]);

                const e0 = getOrCreateEdge(v0, v1);
                const e1 = getOrCreateEdge(v1, v2);
                const e2 = getOrCreateEdge(v2, v0);

                allPolygons.push({
                    vertices: [v0, v1, v2],
                    normals: [0, 0, 0],
                    edges: [e0, e1, e2],
                    paletteIndex: tri.paletteIndex || 0
                });
            });
        }

        if (quads) {
            quads.forEach(quad => {
                const srcVerts = quad.vertices;
                const uvs = quad.storedUVs || [
                    { u: 0, v: 0 }, { u: 255, v: 0 },
                    { u: 0, v: 255 }, { u: 255, v: 255 }
                ];

                // Split quad into two triangles
                const v0 = getOrCreateVertex(srcVerts[0], uvs[0]);
                const v1 = getOrCreateVertex(srcVerts[1], uvs[1]);
                const v2 = getOrCreateVertex(srcVerts[2], uvs[2]);
                const v3 = getOrCreateVertex(srcVerts[3], uvs[3]);

                // Triangle 1: v0, v1, v2
                const e0_1 = getOrCreateEdge(v0, v1);
                const e1_1 = getOrCreateEdge(v1, v2);
                const e2_1 = getOrCreateEdge(v2, v0);

                allPolygons.push({
                    vertices: [v0, v1, v2],
                    normals: [0, 0, 0],
                    edges: [e0_1, e1_1, e2_1],
                    paletteIndex: quad.paletteIndex || 0
                });

                // Triangle 2: v1, v3, v2
                const e0_2 = getOrCreateEdge(v1, v3);
                const e1_2 = getOrCreateEdge(v3, v2);
                const e2_2 = getOrCreateEdge(v2, v1);

                allPolygons.push({
                    vertices: [v1, v3, v2],
                    normals: [0, 0, 0],
                    edges: [e0_2, e1_2, e2_2],
                    paletteIndex: quad.paletteIndex || 0
                });
            });
        }

        // Extract vertex positions and texture coords from uniqueVerts
        const convertedVerts = uniqueVerts.map(v => ({ x: v.x, y: v.y, z: v.z }));
        const texCoords = uniqueVerts.map(v => ({ u: v.u, v: v.v }));
        
        const groups = this.buildGroups(allPolygons, convertedVerts.length, texCoords.length, edges.length);
        const bbox = this.computeBoundingBox(convertedVerts);

        const vertexColors = convertedVerts.map(() => ({ r: 255, g: 255, b: 255, a: 255 }));
        const polygonColors = allPolygons.map(() => ({ r: 128, g: 128, b: 128, a: 255 }));

        return this.assemblePFile({
            vertices: convertedVerts,
            texCoords,
            vertexColors,
            polygonColors,
            edges,
            polygons: allPolygons,
            groups,
            boundingBox: bbox
        });
    }

    computeNormals(vertices, polygons) {
        const vertexNormals = vertices.map(() => ({ x: 0, y: 0, z: 0 }));

        polygons.forEach(poly => {
            const v0 = vertices[poly.vertices[0]];
            const v1 = vertices[poly.vertices[1]];
            const v2 = vertices[poly.vertices[2]];

            if (!v0 || !v1 || !v2) return;

            const ax = v1.x - v0.x;
            const ay = v1.y - v0.y;
            const az = v1.z - v0.z;
            const bx = v2.x - v0.x;
            const by = v2.y - v0.y;
            const bz = v2.z - v0.z;

            const nx = ay * bz - az * by;
            const ny = az * bx - ax * bz;
            const nz = ax * by - ay * bx;

            poly.vertices.forEach(vi => {
                if (vi < vertexNormals.length) {
                    vertexNormals[vi].x += nx;
                    vertexNormals[vi].y += ny;
                    vertexNormals[vi].z += nz;
                }
            });

            poly.normals = [poly.vertices[0], poly.vertices[1], poly.vertices[2]];
        });

        vertexNormals.forEach(n => {
            const len = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
            if (len > 0) {
                n.x /= len;
                n.y /= len;
                n.z /= len;
            } else {
                n.y = 1;
            }
        });

        return vertexNormals;
    }

    buildGroups(polygons, numVertices, numTexCoords, numEdges) {
        const groupsByPalette = new Map();

        polygons.forEach((poly, idx) => {
            const paletteIdx = poly.paletteIndex || 0;
            if (!groupsByPalette.has(paletteIdx)) {
                groupsByPalette.set(paletteIdx, []);
            }
            groupsByPalette.get(paletteIdx).push(idx);
        });

        const groups = [];

        if (groupsByPalette.size === 0) {
            groups.push({
                polyType: 3,
                offsetPoly: 0,
                numPoly: polygons.length,
                offsetVert: 0,
                numVert: numVertices,
                offsetEdge: 0,
                numEdge: numEdges,
                offsetTex: 0,
                texFlag: 1,
                texID: 0
            });
        } else {
            groupsByPalette.forEach((polyIndices, paletteIdx) => {
                groups.push({
                    polyType: 3,
                    offsetPoly: polyIndices[0],
                    numPoly: polyIndices.length,
                    offsetVert: 0,
                    numVert: numVertices,
                    offsetEdge: 0,
                    numEdge: numEdges,
                    offsetTex: 0,
                    texFlag: 1,
                    texID: paletteIdx
                });
            });
        }

        return groups;
    }

    computeBoundingBox(vertices) {
        if (vertices.length === 0) {
            return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
        }

        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        vertices.forEach(v => {
            minX = Math.min(minX, v.x);
            minY = Math.min(minY, v.y);
            minZ = Math.min(minZ, v.z);
            maxX = Math.max(maxX, v.x);
            maxY = Math.max(maxY, v.y);
            maxZ = Math.max(maxZ, v.z);
        });

        return { minX, minY, minZ, maxX, maxY, maxZ };
    }

    assemblePFile(data) {
        const { vertices, texCoords, vertexColors, polygonColors, edges, polygons, groups, boundingBox } = data;

        const numVerts = vertices.length;
        const numNormals = 0;  // PC files don't store normals - computed at runtime
        const numTexCs = texCoords.length;
        const numEdges = edges.length;
        const numPolys = polygons.length;
        const numGroups = groups.length;

        const headerSize = 128;
        const verticesSize = numVerts * 12;
        const normalsSize = 0;  // No normals stored
        const texCoordsSize = numTexCs * 8;
        const vertexColorsSize = numVerts * 4;
        const polygonColorsSize = numPolys * 4;
        const edgesSize = numEdges * 4;
        const polygonsSize = numPolys * 24;
        const hundredsSize = numGroups * 100;
        const groupsSize = numGroups * 56;
        const boundingBoxSize = 28;
        const normalIndexSize = numVerts * 4;

        const totalSize = headerSize + verticesSize + normalsSize + texCoordsSize +
            vertexColorsSize + polygonColorsSize + edgesSize + polygonsSize +
            hundredsSize + groupsSize + boundingBoxSize + normalIndexSize;

        const buffer = new ArrayBuffer(totalSize);
        const view = new DataView(buffer);
        let offset = 0;

        // Header (128 bytes) - matches FF7PModel.cs ReadPHeader/WriteGlobalPModel
        view.setInt32(offset, 1, true); offset += 4;           // version (must be 1)
        view.setInt32(offset, 1, true); offset += 4;           // off04 (must be 1)
        view.setInt32(offset, 1, true); offset += 4;           // vertexColor
        view.setInt32(offset, numVerts, true); offset += 4;    // numVerts
        view.setInt32(offset, numNormals, true); offset += 4;  // numNormals (0 - computed at runtime)
        view.setInt32(offset, 0, true); offset += 4;           // numXYZ (unused)
        view.setInt32(offset, numTexCs, true); offset += 4;    // numTexCs
        view.setInt32(offset, numVerts, true); offset += 4;    // numNormIdx (same as numVerts)
        view.setInt32(offset, numEdges, true); offset += 4;    // numEdges
        view.setInt32(offset, numPolys, true); offset += 4;    // numPolys
        view.setInt32(offset, 0, true); offset += 4;           // off28
        view.setInt32(offset, 0, true); offset += 4;           // off2C
        view.setInt32(offset, numGroups, true); offset += 4;   // mirex_h (numHundrets)
        view.setInt32(offset, numGroups, true); offset += 4;   // numGroups
        view.setInt32(offset, numGroups, true); offset += 4;   // mirex_g
        view.setInt32(offset, 1, true); offset += 4;           // off3C (1 in PC files)

        // unknown[16] - runtime data, zeros
        for (let i = 0; i < 16; i++) {
            view.setInt32(offset, 0, true);
            offset += 4;
        }

        // Vertices (float x, y, z)
        vertices.forEach(v => {
            view.setFloat32(offset, v.x, true); offset += 4;
            view.setFloat32(offset, v.y, true); offset += 4;
            view.setFloat32(offset, v.z, true); offset += 4;
        });

        // Texture coordinates (float u, v)
        texCoords.forEach(tc => {
            view.setFloat32(offset, tc.u, true); offset += 4;
            view.setFloat32(offset, tc.v, true); offset += 4;
        });

        // Vertex colors (BGRA)
        vertexColors.forEach(c => {
            view.setUint8(offset++, c.b);
            view.setUint8(offset++, c.g);
            view.setUint8(offset++, c.r);
            view.setUint8(offset++, c.a);
        });

        // Polygon colors (BGRA)
        polygonColors.forEach(c => {
            view.setUint8(offset++, c.b);
            view.setUint8(offset++, c.g);
            view.setUint8(offset++, c.r);
            view.setUint8(offset++, c.a);
        });

        // Edges (2 × uint16)
        edges.forEach(e => {
            view.setUint16(offset, e[0], true); offset += 2;
            view.setUint16(offset, e[1], true); offset += 2;
        });

        // Polygons (24 bytes each) - matches PPolygon struct
        // PC format: tag2 is a constant value 0x00EAFC0C, texture coords indexed by vertex index
        const PPOLY_TAG2 = 0x00EAFC0C;
        polygons.forEach(poly => {
            view.setInt16(offset, 0, true); offset += 2;              // tag1
            view.setUint16(offset, poly.vertices[0], true); offset += 2;
            view.setUint16(offset, poly.vertices[1], true); offset += 2;
            view.setUint16(offset, poly.vertices[2], true); offset += 2;
            view.setUint16(offset, 0, true); offset += 2;             // normal[0] - zeros (computed at runtime)
            view.setUint16(offset, 0, true); offset += 2;             // normal[1]
            view.setUint16(offset, 0, true); offset += 2;             // normal[2]
            view.setUint16(offset, poly.edges[0], true); offset += 2;
            view.setUint16(offset, poly.edges[1], true); offset += 2;
            view.setUint16(offset, poly.edges[2], true); offset += 2;
            view.setInt32(offset, PPOLY_TAG2, true); offset += 4;     // tag2 - constant value in PC format
        });

        // Hundrets (100 bytes each) - matches PHundret struct (25 × int32)
        // Values from actual PC battle location files - field_8/field_C are render state flags
        groups.forEach((g, idx) => {
            view.setInt32(offset, 1, true); offset += 4;       // field_0 
            view.setInt32(offset, 1, true); offset += 4;       // field_4
            view.setInt32(offset, 0x0003860E, true); offset += 4; // field_8 (render state: texture, filter, perspective, etc.)
            view.setInt32(offset, 0x00020402, true); offset += 4; // field_C (render state mask)
            view.setInt32(offset, g.texID, true); offset += 4; // texID
            view.setInt32(offset, 0, true); offset += 4;       // texture_set_ptr (runtime)
            view.setInt32(offset, 1, true); offset += 4;       // field_18
            view.setInt32(offset, g.numVert + 1, true); offset += 4; // field_1C (numVerts + 1)
            view.setInt32(offset, 0, true); offset += 4;       // field_20 (runtime pointer)
            view.setInt32(offset, 1, true); offset += 4;       // shademode
            view.setInt32(offset, 0xFFFFFFFF, true); offset += 4; // lightstate_ambient (-1)
            view.setInt32(offset, 0, true); offset += 4;       // field_2C
            view.setInt32(offset, 0, true); offset += 4;       // lightstate_material_ptr
            view.setInt32(offset, 5, true); offset += 4;       // srcblend
            view.setInt32(offset, 6, true); offset += 4;       // destblend
            view.setInt32(offset, 2, true); offset += 4;       // field_3C
            view.setInt32(offset, 0, true); offset += 4;       // alpharef
            view.setInt32(offset, 0, true); offset += 4;       // blend_mode
            view.setInt32(offset, 0, true); offset += 4;       // zSort (runtime)
            view.setInt32(offset, 0, true); offset += 4;       // field_4C
            view.setInt32(offset, 0, true); offset += 4;       // field_50
            view.setInt32(offset, 0, true); offset += 4;       // field_54
            view.setInt32(offset, 0, true); offset += 4;       // field_58
            view.setInt32(offset, 0x80, true); offset += 4;    // vertex_alpha (128)
            view.setInt32(offset, 0, true); offset += 4;       // field_60
        });

        // Groups (56 bytes each) - matches PGroup struct (14 × int32)
        groups.forEach(g => {
            view.setInt32(offset, g.polyType, true); offset += 4;    // polyType
            view.setInt32(offset, g.offsetPoly, true); offset += 4;  // offsetPoly
            view.setInt32(offset, g.numPoly, true); offset += 4;     // numPoly
            view.setInt32(offset, g.offsetVert, true); offset += 4;  // offsetVert
            view.setInt32(offset, g.numVert, true); offset += 4;     // numVert
            view.setInt32(offset, 0, true); offset += 4;             // offsetEdge (0 in PC files)
            view.setInt32(offset, 0, true); offset += 4;             // numEdge (0 in PC files)
            view.setInt32(offset, 0, true); offset += 4;             // off1C
            view.setInt32(offset, 0, true); offset += 4;             // off20
            view.setInt32(offset, 0, true); offset += 4;             // off24
            view.setInt32(offset, 0, true); offset += 4;             // off28
            view.setInt32(offset, g.offsetTex, true); offset += 4;   // offsetTex
            view.setInt32(offset, g.texFlag, true); offset += 4;     // texFlag
            view.setInt32(offset, g.texID, true); offset += 4;       // texID
        });

        // BoundingBox (28 bytes) - unknown4bytes + max + min
        view.setInt32(offset, 0, true); offset += 4;                  // unknown4bytes
        view.setFloat32(offset, boundingBox.maxX, true); offset += 4;
        view.setFloat32(offset, boundingBox.maxY, true); offset += 4;
        view.setFloat32(offset, boundingBox.maxZ, true); offset += 4;
        view.setFloat32(offset, boundingBox.minX, true); offset += 4;
        view.setFloat32(offset, boundingBox.minY, true); offset += 4;
        view.setFloat32(offset, boundingBox.minZ, true); offset += 4;

        // NormalIndex (int32 per vertex)
        for (let i = 0; i < numVerts; i++) {
            view.setInt32(offset, i, true); offset += 4;
        }

        return buffer;
    }

    buildTEXFiles(timData) {
        const { bpp, clut, image, pixelData } = timData;

        if (bpp !== 8) {
            console.warn('TEX export currently optimized for 8bpp textures');
        }

        const numPalettes = clut ? clut.height : 1;
        const colorsPerPalette = clut ? clut.width : 256;
        const textures = [];

        const texWidth = 256;
        const texHeight = 128;
        const headerSize = 0xEC;
        const paletteDataSize = colorsPerPalette * 4;
        const pixelDataSize = texWidth * texHeight;
        const totalSize = headerSize + paletteDataSize + pixelDataSize;

        for (let paletteIdx = 0; paletteIdx < numPalettes; paletteIdx++) {
            const buffer = new ArrayBuffer(totalSize);
            const view = new DataView(buffer);

            view.setUint32(0x00, 1, true);              // version
            view.setUint32(0x04, 0, true);              // unknown
            view.setUint32(0x08, 0, true);              // color key flag (0 in PC)
            view.setUint32(0x0C, 0, true);
            view.setUint32(0x10, 3, true);              // unknown10 (3 in PC)
            view.setUint32(0x14, 4, true);              // min bits per color (4 in PC)
            view.setUint32(0x18, 8, true);              // max bits per color
            view.setUint32(0x1C, 0, true);              // min alpha bits
            view.setUint32(0x20, 8, true);              // max alpha bits
            view.setUint32(0x24, 8, true);              // min bpp
            view.setUint32(0x28, 0x20, true);           // max bpp (32 in PC)
            view.setUint32(0x2C, 0, true);
            view.setUint32(0x30, numPalettes, true);    // num palettes (total, for reference)
            view.setUint32(0x34, colorsPerPalette, true);// colors per palette
            view.setUint32(0x38, 8, true);              // bit depth
            view.setUint32(0x3C, texWidth, true);       // width
            view.setUint32(0x40, texHeight, true);      // height
            view.setUint32(0x44, 0, true);              // pitch (0 in PC)
            view.setUint32(0x48, 0, true);
            view.setUint32(0x4C, 1, true);              // palette flag
            view.setUint32(0x50, 8, true);              // bits per index
            view.setUint32(0x54, 0, true);              // indexed to 8bit flag
            view.setUint32(0x58, colorsPerPalette, true); // palette size (256)
            view.setUint32(0x5C, colorsPerPalette, true);
            view.setUint32(0x60, 0, true);              // runtime
            view.setUint32(0x64, 8, true);              // bits per pixel
            view.setUint32(0x68, 1, true);              // bytes per pixel

            for (let i = 0x6C; i <= 0xB8; i += 4) {
                view.setUint32(i, 0, true);
            }

            view.setUint32(0xBC, 0, true);              // color key array flag
            view.setUint32(0xC0, 0, true);              // runtime
            view.setUint32(0xC4, 0xFF, true);           // reference alpha (0xFF in PC)
            view.setUint32(0xC8, 4, true);              // unknown (4 in PC)
            view.setUint32(0xCC, 1, true);              // unknown (1 in PC)
            view.setUint32(0xD0, 0, true);              // palette index (runtime)
            view.setUint32(0xD4, 0, true);
            view.setUint32(0xD8, 0, true);
            view.setUint32(0xDC, 0, true);
            view.setUint32(0xE0, 0, true);
            view.setUint32(0xE4, 0, true);
            view.setUint32(0xE8, 0, true);

            let offset = headerSize;
            if (clut && clut.colors) {
                const paletteStart = paletteIdx * colorsPerPalette;
                for (let i = 0; i < colorsPerPalette; i++) {
                    const color = clut.colors[paletteStart + i] || { r: 0, g: 0, b: 0, a: 255 };
                    view.setUint8(offset++, color.b);
                    view.setUint8(offset++, color.g);
                    view.setUint8(offset++, color.r);
                    view.setUint8(offset++, color.a);
                }
            } else {
                for (let i = 0; i < colorsPerPalette * 4; i++) {
                    view.setUint8(offset++, 0);
                }
            }

            const pixelArray = new Uint8Array(buffer, offset, pixelDataSize);
            const srcRawWidth = image.rawWidth * 2;

            for (let y = 0; y < texHeight; y++) {
                for (let x = 0; x < texWidth; x++) {
                    if (x < image.width && y < image.height) {
                        const srcIdx = y * srcRawWidth + x;
                        const dstIdx = y * texWidth + x;
                        if (srcIdx < pixelData.length) {
                            pixelArray[dstIdx] = pixelData[srcIdx];
                        }
                    }
                }
            }

            textures.push(buffer);
        }

        return textures;
    }

    async downloadAsZip(filename) {
        const files = this.exportAll();

        if (typeof JSZip === 'undefined') {
            console.error('JSZip library not loaded');
            return;
        }

        const zip = new JSZip();
        const folder = zip.folder(this.prefix + '_battle_location');

        files.forEach(file => {
            folder.file(file.name, file.data);
        });

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `${this.prefix}_battle_location.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// @ts-nocheck
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { decodeTIMAllPalettes } from './parser';

/**
 * FF7 Battle Scene Renderer
 * Three.js-based 3D visualization of parsed scene data
 */

export class FF7SceneRenderer {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        this.meshes = {
            sky: [],
            objects: []
        };
        
        this.texture = null;
        this.paletteTextures = [];
        this.sceneData = null;
        this.quadLabels = [];
        
        this.sectionPaletteOverrides = {};
        
        this.settings = {
            showGround: true,
            showSky: true,
            showObjects: true,
            wireframe: false
        };
        
        this.sectionVisibility = {
            sections: {}
        };
        
        this.init();
    }

    init() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        this.camera = new THREE.PerspectiveCamera(60, width / height, 10, 100000);
        this.camera.position.set(0, 8000, 15000);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 1000;
        this.controls.maxDistance = 50000;
        this.controls.target.set(0, 0, 0);

        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambientLight);

        window.addEventListener('resize', () => this.onResize());

        this.animate();
    }

    onResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    loadScene(parsedData, preserveCamera = false) {
        console.log('%c=== LOADING SCENE ===', 'color: lime; font-weight: bold', 
            `triUvMode=${window.triUvMappingMode}, quadUvMode=${window.uvMappingMode}`);
        
        let savedCameraPosition = null;
        let savedControlsTarget = null;
        
        if (preserveCamera && this.camera && this.controls) {
            savedCameraPosition = this.camera.position.clone();
            savedControlsTarget = this.controls.target.clone();
        }
        
        this.clearScene();
        this.sceneData = parsedData;

        if (parsedData.texture) {
            const canvases = decodeTIMAllPalettes(parsedData.texture);
            this.paletteTextures = canvases.map(canvas => {
                if (!canvas) return null;
                const tex = new THREE.CanvasTexture(canvas);
                tex.magFilter = THREE.NearestFilter;
                tex.minFilter = THREE.NearestFilter;
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                return tex;
            });
            this.texture = this.paletteTextures[0] || null;
        }

        parsedData.meshes.forEach((geom, idx) => {
            this.create3DMesh(geom, idx);
        });

        this.initializeSectionVisibility();
        this.updateVisibility();
        
        if (preserveCamera && savedCameraPosition && savedControlsTarget) {
            this.camera.position.copy(savedCameraPosition);
            this.controls.target.copy(savedControlsTarget);
            this.controls.update();
        } else {
            this.fitCameraToScene();
        }

        return this.getStats();
    }

    clearScene() {
        this.meshes.sky.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
        this.meshes.sky = [];

        this.meshes.objects.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
        this.meshes.objects = [];

        if (this.quadLabels) {
            this.quadLabels.forEach(label => {
                this.scene.remove(label);
                if (label.material.map) label.material.map.dispose();
                label.material.dispose();
            });
            this.quadLabels = [];
        }

        if (this.texture) {
            this.texture.dispose();
            this.texture = null;
        }
        
        this.paletteTextures.forEach(tex => {
            if (tex) tex.dispose();
        });
        this.paletteTextures = [];
    }

    createGroundPlaneMesh(groundData, textureWidth = 512, textureHeight = 256) {
        const { vertices, quads, triangles, texturePageX, textureOffsetY } = groundData;
        const basePageX = window.textureBasePageX || 6;
        const textureXOffset = ((texturePageX || basePageX) - basePageX) * 128;
        const textureYOffset = textureOffsetY || 0;

        const quadCenters = [];
        
        const mappings = [
            [2, 0, 3, 1], 
            [0, 1, 2, 3], 
            [1, 0, 3, 2], 
            [0, 2, 1, 3], 
            [3, 2, 1, 0], 
            [2, 3, 0, 1], 
        ];
        const mapping = mappings[window.uvMappingMode !== undefined ? window.uvMappingMode : 1];
        const uvShift = window.uvShiftOffset || 0;
        
        const triMappings = [
            [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]
        ];
        const triMapping = triMappings[window.triUvMappingMode || 0];
        
        const sectionPaletteOverride = this.sectionPaletteOverrides[1];
        const hasOverride = sectionPaletteOverride !== undefined;
        
        const trianglesByPalette = {};
        const quadsByPalette = {};

        if (triangles && triangles.length > 0) {
            triangles.forEach((tri) => {
                const paletteIdx = hasOverride ? sectionPaletteOverride : (tri.paletteIndex || 0);
                if (!trianglesByPalette[paletteIdx]) {
                    trianglesByPalette[paletteIdx] = [];
                }
                trianglesByPalette[paletteIdx].push(tri);
            });
        }

        if (quads && quads.length > 0) {
            quads.forEach((quad, quadIdx) => {
                const paletteIdx = hasOverride ? sectionPaletteOverride : (quad.paletteIndex || 0);
                if (!quadsByPalette[paletteIdx]) {
                    quadsByPalette[paletteIdx] = [];
                }
                quadsByPalette[paletteIdx].push({ quad, quadIdx });
            });
        }

        const allPalettes = new Set([
            ...Object.keys(trianglesByPalette),
            ...Object.keys(quadsByPalette)
        ]);

        allPalettes.forEach(paletteIdxStr => {
            const paletteIdx = parseInt(paletteIdxStr);
            const positions = [];
            const uvs = [];
            
            const paletteTris = trianglesByPalette[paletteIdx] || [];
            paletteTris.forEach((tri, triIdx) => {
                const triVertices = tri.vertices.map(vIdx => {
                    if (vIdx >= 0 && vIdx < vertices.length && vertices[vIdx]) {
                        return vertices[vIdx];
                    }
                    return { x: 0, y: 0, z: 0 };
                });

                if (triVertices.some(v => v === null || v === undefined)) {
                    return;
                }

                const uvSourceIdx = (triIdx + uvShift + triangles.length) % triangles.length;
                const uvSourceTri = triangles[uvSourceIdx];
                const stored = uvSourceTri?.storedUVs || tri.storedUVs || [{ u: 0, v: 0 }, { u: 0, v: 0 }, { u: 0, v: 0 }];
                
                triVertices.forEach((v, i) => {
                    positions.push(v.x || 0, v.z || 0, -(v.y || 0));
                    const uvIdx = triMapping[i];
                    const adjustedU = (stored[uvIdx].u + textureXOffset) / textureWidth;
                    const adjustedV = 1 - ((stored[uvIdx].v + textureYOffset) / textureHeight);
                    uvs.push(adjustedU, adjustedV);
                });
            });

            const paletteQuads = quadsByPalette[paletteIdx] || [];
            paletteQuads.forEach(({ quad, quadIdx }) => {
                const quadVertices = quad.vertices.map(vIdx => {
                    if (vIdx >= 0 && vIdx < vertices.length && vertices[vIdx]) {
                        return vertices[vIdx];
                    }
                    return { x: 0, y: 0, z: 0 };
                });

                if (quadVertices.some(v => v === null || v === undefined)) {
                    return;
                }

                const uvSourceIdx = (quadIdx + uvShift + quads.length) % quads.length;
                const uvSourceQuad = quads[uvSourceIdx];
                const stored = uvSourceQuad?.storedUVs || quad.storedUVs || [
                    { u: 0, v: 0 }, { u: 0, v: 255 }, { u: 255, v: 0 }, { u: 255, v: 255 }
                ];
                
                const quadUVs = mapping.map(idx => ({
                    u: (stored[idx].u + textureXOffset) / textureWidth,
                    v: 1 - ((stored[idx].v + textureYOffset) / textureHeight)
                }));

                const v0 = quadVertices[0];
                const v1 = quadVertices[1];
                const v2 = quadVertices[2];
                const v3 = quadVertices[3];

                const centerX = (v0.x + v1.x + v2.x + v3.x) / 4;
                const centerY = (v0.y + v1.y + v2.y + v3.y) / 4;
                const centerZ = (v0.z + v1.z + v2.z + v3.z) / 4;
                quadCenters.push({ x: centerX, y: centerY, z: centerZ, index: quadIdx });

                positions.push(v0.x || 0, v0.z || 0, -(v0.y || 0));
                positions.push(v1.x || 0, v1.z || 0, -(v1.y || 0));
                positions.push(v2.x || 0, v2.z || 0, -(v2.y || 0));
                
                uvs.push(quadUVs[0].u, quadUVs[0].v);
                uvs.push(quadUVs[1].u, quadUVs[1].v);
                uvs.push(quadUVs[2].u, quadUVs[2].v);

                positions.push(v1.x || 0, v1.z || 0, -(v1.y || 0));
                positions.push(v3.x || 0, v3.z || 0, -(v3.y || 0));
                positions.push(v2.x || 0, v2.z || 0, -(v2.y || 0));
                
                uvs.push(quadUVs[1].u, quadUVs[1].v);
                uvs.push(quadUVs[3].u, quadUVs[3].v);
                uvs.push(quadUVs[2].u, quadUVs[2].v);
            });

            if (positions.length === 0) return;

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            geometry.computeVertexNormals();

            const material = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                side: THREE.DoubleSide,
                wireframe: this.settings.wireframe,
                flatShading: true,
                transparent: true,
                alphaTest: 0.5
            });

            if (this.debugUVMode) {
                material.map = this.createUVDebugTexture();
            } else {
                const paletteTexture = this.paletteTextures[paletteIdx] || this.texture;
                if (paletteTexture) {
                    material.map = paletteTexture;
                }
            }

            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = `section_1_palette_${paletteIdx}`;
            this.meshes.objects.push(mesh);
            this.scene.add(mesh);
        });

        if (this.debugUVMode) {
            this.addQuadLabels(quadCenters);
        }
    }

    createUVDebugTexture() {
        const width = 512;
        const height = 256;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        const imageData = ctx.createImageData(width, height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                imageData.data[idx] = (x / 2) % 256;
                imageData.data[idx + 1] = y;
                imageData.data[idx + 2] = x < 256 ? 50 : 150;
                imageData.data[idx + 3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        for (let x = 0; x <= width; x += 64) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += 64) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(256, 0);
        ctx.lineTo(256, height);
        ctx.stroke();
        
        ctx.fillStyle = 'white';
        ctx.font = '14px monospace';
        ctx.fillText('LEFT (0-255)', 80, 20);
        ctx.fillText('RIGHT (256-511)', 330, 20);
        ctx.fillText('TPX=0', 10, height - 10);
        ctx.fillText('TPX=256', 266, height - 10);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        return texture;
    }

    addQuadLabels(quadCenters) {
        if (this.quadLabels) {
            this.quadLabels.forEach(label => {
                this.scene.remove(label);
                if (label.material.map) label.material.map.dispose();
                label.material.dispose();
            });
        }
        this.quadLabels = [];

        quadCenters.forEach(center => {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, 128, 128);
            
            ctx.fillStyle = 'white';
            ctx.font = 'bold 48px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(center.index.toString(), 64, 64);
            
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(material);
            
            sprite.position.set(center.x, center.z + 200, -center.y);
            sprite.scale.set(500, 500, 1);
            
            this.quadLabels.push(sprite);
            this.scene.add(sprite);
        });
    }

    setDebugUVMode(enabled) {
        this.debugUVMode = enabled;
        if (this.sceneData) {
            this.loadScene(this.sceneData);
        }
    }

    create3DMesh(geomData, sectionIdx) {
        const { vertices, triangles, quads, isQuadFormat, texturePageX, textureOffsetY } = geomData;

        console.log(`Section ${sectionIdx}: isQuadFormat=${isQuadFormat}, triangles=${triangles?.length || 0}, quads=${quads?.length || 0}, triUvMode=${window.triUvMappingMode}`);

        if (triangles.length === 0 && (!quads || quads.length === 0)) return;

        const isGroundPlane = sectionIdx === 0;
        
        if (isGroundPlane) {
            const texW = this.sceneData.texture?.image?.width || 512;
            const texH = this.sceneData.texture?.image?.height || 256;
            this.createGroundPlaneMesh(geomData, texW, texH);
            return;
        }

        const texW = window.textureWidth || 512;
        const texH = window.textureHeight || 256;
        const basePageX = window.textureBasePageX || 6;
        const isSkySection = sectionIdx >= 1 && sectionIdx <= 3;
        const actualSectionNum = sectionIdx + 1;
        
        const textureXOffset = ((texturePageX || basePageX) - basePageX) * 128;
        const textureYOffset = textureOffsetY || 0;
        
        const sectionPaletteOverride = this.sectionPaletteOverrides[actualSectionNum];
        const hasOverride = sectionPaletteOverride !== undefined;

        const trianglesByPalette = {};
        
        triangles.forEach(tri => {
            const paletteIdx = hasOverride ? sectionPaletteOverride : (tri.paletteIndex || 0);
            if (!trianglesByPalette[paletteIdx]) {
                trianglesByPalette[paletteIdx] = [];
            }
            trianglesByPalette[paletteIdx].push(tri);
        });

        Object.entries(trianglesByPalette).forEach(([paletteIdxStr, paletteTris]) => {
            const paletteIdx = parseInt(paletteIdxStr);
            const positions = [];
            const uvs = [];
            const colors = [];

            const addVertex = (v, uv) => {
                positions.push(v.x || 0, -(v.z || 0), -(v.y || 0));
                uvs.push(uv?.u || 0, uv?.v || 0);
                
                const height = -(v.z || 0);
                const normalized = Math.min(1, Math.max(0, (height + 20000) / 40000));
                const r = 0.3 + normalized * 0.4;
                const g = 0.3 + normalized * 0.5;
                const b = 0.5 + normalized * 0.5;
                colors.push(r, g, b);
            };

            const uvShift = window.uvShiftOffset || 0;
            
            paletteTris.forEach((tri, triIdx) => {
                const triVertices = tri.vertices.map(vIdx => {
                    if (vIdx >= 0 && vIdx < vertices.length && vertices[vIdx]) {
                        return vertices[vIdx];
                    }
                    return null;
                });

                if (triVertices.some(v => v === null)) return;

                const uvSourceIdx = (triIdx + uvShift + triangles.length) % triangles.length;
                const uvSourceTri = triangles[uvSourceIdx];
                const stored = uvSourceTri?.storedUVs || tri.storedUVs || [{ u: 0, v: 0 }, { u: 0, v: 0 }, { u: 0, v: 0 }];
                
                const triMappings = [
                    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]
                ];
                const triMapping = triMappings[window.triUvMappingMode || 0];
                
                if (paletteTris.indexOf(tri) === 0) {
                    console.log(`  First tri UVs: stored=[${stored.map(s => `(${s.u},${s.v})`).join(',')}], mapping=${triMapping}, mode=${window.triUvMappingMode}`);
                }
                
                triVertices.forEach((v, i) => {
                    const uvIdx = triMapping[i];
                    const rawU = stored[uvIdx]?.u || 0;
                    const rawV = stored[uvIdx]?.v || 0;
                    const adjustedU = (rawU + textureXOffset) / texW;
                    const adjustedV = 1 - ((rawV + textureYOffset) / texH);
                    addVertex(v, { u: adjustedU, v: adjustedV });
                });
            });

            if (positions.length === 0) return;

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            geometry.computeVertexNormals();

                    const material = new THREE.MeshStandardMaterial({
                        side: THREE.DoubleSide,
                        wireframe: this.settings.wireframe,
                        flatShading: true,
                        transparent: true,
                        alphaTest: 0.5,
                        opacity: isSkySection ? 0.9 : 1.0
                    });

                    const paletteTexture = this.paletteTextures[paletteIdx] || this.texture;
                    if (paletteTexture) {
                        material.map = paletteTexture;
                        material.color.setHex(0xffffff);
                    } else {
                        material.vertexColors = true;
                    }

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.name = `section_${actualSectionNum}_palette_${paletteIdx}`;

            if (isSkySection) {
                this.meshes.sky.push(mesh);
            } else {
                this.meshes.objects.push(mesh);
            }

            this.scene.add(mesh);
        });

        if (quads && quads.length > 0) {
            const quadsByPalette = {};
            
            quads.forEach(quad => {
                const paletteIdx = hasOverride ? sectionPaletteOverride : (quad.paletteIndex || 0);
                if (!quadsByPalette[paletteIdx]) {
                    quadsByPalette[paletteIdx] = [];
                }
                quadsByPalette[paletteIdx].push(quad);
            });

            Object.entries(quadsByPalette).forEach(([paletteIdxStr, paletteQuads]) => {
                const paletteIdx = parseInt(paletteIdxStr);
                const positions = [];
                const uvs = [];
                const colors = [];

                const addVertex = (v, uv) => {
                    positions.push(v.x || 0, -(v.z || 0), -(v.y || 0));
                    uvs.push(uv?.u || 0, uv?.v || 0);
                    
                    const height = -(v.z || 0);
                    const normalized = Math.min(1, Math.max(0, (height + 20000) / 40000));
                    const r = 0.3 + normalized * 0.4;
                    const g = 0.3 + normalized * 0.5;
                    const b = 0.5 + normalized * 0.5;
                    colors.push(r, g, b);
                };

                // Quad UV mappings (same as ground plane)
                const quadMappings = [
                    [2, 0, 3, 1], [0, 1, 2, 3], [1, 0, 3, 2], [0, 2, 1, 3], [3, 2, 1, 0], [2, 3, 0, 1]
                ];
                const quadMapping = quadMappings[window.uvMappingMode !== undefined ? window.uvMappingMode : 1];
                const uvShift = window.uvShiftOffset || 0;
                
                console.log(`  Rendering ${paletteQuads.length} quads with mapping mode ${window.uvMappingMode} = [${quadMapping}]`);

                paletteQuads.forEach((quad, quadIdx) => {
                    const quadVertices = quad.vertices.map(vIdx => {
                        if (vIdx >= 0 && vIdx < vertices.length && vertices[vIdx]) {
                            return vertices[vIdx];
                        }
                        return null;
                    });

                    if (quadVertices.some(v => v === null)) return;

                    const uvSourceIdx = (quadIdx + uvShift + quads.length) % quads.length;
                    const uvSourceQuad = quads[uvSourceIdx];
                    const stored = uvSourceQuad?.storedUVs || quad.storedUVs || [
                        { u: 0, v: 0 }, { u: 0, v: 0 }, { u: 0, v: 0 }, { u: 0, v: 0 }
                    ];
                    const quadUVs = quadMapping.map(idx => ({
                        u: (stored[idx].u + textureXOffset) / texW,
                        v: 1 - ((stored[idx].v + textureYOffset) / texH)
                    }));

                    const [v0, v1, v2, v3] = quadVertices;

                    addVertex(v0, quadUVs[0]);
                    addVertex(v1, quadUVs[1]);
                    addVertex(v2, quadUVs[2]);

                    addVertex(v1, quadUVs[1]);
                    addVertex(v3, quadUVs[3]);
                    addVertex(v2, quadUVs[2]);
                });

                if (positions.length > 0) {
                    const geometry = new THREE.BufferGeometry();
                    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
                    geometry.computeVertexNormals();

                    const material = new THREE.MeshStandardMaterial({
                        side: THREE.DoubleSide,
                        wireframe: this.settings.wireframe,
                        flatShading: true,
                        transparent: true,
                        alphaTest: 0.5,
                        opacity: isSkySection ? 0.9 : 1.0
                    });

                    const paletteTexture = this.paletteTextures[paletteIdx] || this.texture;
                    if (paletteTexture) {
                        material.map = paletteTexture;
                        material.color.setHex(0xffffff);
                    } else {
                        material.vertexColors = true;
                    }

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.name = `section_${actualSectionNum}_quads_palette_${paletteIdx}`;

                    if (isSkySection) {
                        this.meshes.sky.push(mesh);
                    } else {
                        this.meshes.objects.push(mesh);
                    }

                    this.scene.add(mesh);
                }
            });
        }
    }

    fitCameraToScene() {
        const box = new THREE.Box3();

        this.meshes.objects.forEach(mesh => {
            box.expandByObject(mesh);
        });

        if (box.isEmpty()) {
            this.meshes.sky.forEach(mesh => {
                box.expandByObject(mesh);
            });
        }

        if (!box.isEmpty()) {
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);

            this.camera.position.set(
                center.x + maxDim * 0.8,
                center.y + maxDim * 0.6,
                center.z + maxDim * 0.8
            );
            this.controls.target.copy(center);
            this.controls.update();
        }
    }

    resetCamera() {
        this.fitCameraToScene();
    }

    initializeSectionVisibility() {
        this.sectionVisibility.sections = {};
        
        if (this.sceneData && this.sceneData.meshes) {
            this.sceneData.meshes.forEach((geom, idx) => {
                const isGround = idx === 0;
                const isSky = idx >= 1 && idx <= 3;
                this.sectionVisibility.sections[idx] = isGround ? this.settings.showGround : (isSky ? this.settings.showSky : this.settings.showObjects);
            });
        }
    }

    updateVisibility() {
        this.meshes.sky.forEach(mesh => {
            const match = mesh.name.match(/section_(\d+)/);
            if (match) {
                const sectionNum = parseInt(match[1]);
                const idx = sectionNum - 1;
                mesh.visible = this.sectionVisibility.sections[idx] ?? true;
            } else {
                mesh.visible = this.settings.showSky;
            }
        });

        this.meshes.objects.forEach(mesh => {
            const match = mesh.name.match(/section_(\d+)/);
            if (match) {
                const sectionNum = parseInt(match[1]);
                const idx = sectionNum - 1;
                mesh.visible = this.sectionVisibility.sections[idx] ?? true;
            } else {
                mesh.visible = this.settings.showObjects;
            }
        });
    }

    setWireframe(enabled) {
        this.settings.wireframe = enabled;

        const updateMaterial = (mesh) => {
            if (mesh && mesh.material) {
                if (enabled) {
                    mesh.userData.originalMaterial = mesh.material;
                    mesh.material = new THREE.MeshBasicMaterial({
                        color: 0xffffff,
                        wireframe: true,
                        side: THREE.DoubleSide
                    });
                } else if (mesh.userData.originalMaterial) {
                    mesh.material.dispose();
                    mesh.material = mesh.userData.originalMaterial;
                    delete mesh.userData.originalMaterial;
                }
            }
        };

        this.meshes.sky.forEach(updateMaterial);
        this.meshes.objects.forEach(updateMaterial);
    }

    setShowGround(visible) {
        this.settings.showGround = visible;
        if (this.sceneData && this.sceneData.meshes && this.sceneData.meshes.length > 0) {
            this.sectionVisibility.sections[0] = visible;
            this.meshes.objects.forEach(mesh => {
                if (mesh.name && mesh.name.includes('section_1_')) {
                    mesh.visible = visible;
                }
            });
        }
    }

    setShowSky(visible) {
        this.settings.showSky = visible;
        if (this.sceneData && this.sceneData.meshes) {
            this.sceneData.meshes.forEach((geom, idx) => {
                if (idx >= 1 && idx <= 3) {
                    this.sectionVisibility.sections[idx] = visible;
                }
            });
        }
        this.meshes.sky.forEach(mesh => {
            mesh.visible = visible;
        });
    }

    setShowObjects(visible) {
        this.settings.showObjects = visible;
        if (this.sceneData && this.sceneData.meshes) {
            this.sceneData.meshes.forEach((geom, idx) => {
                if (idx >= 4) {
                    this.sectionVisibility.sections[idx] = visible;
                }
            });
        }
        this.meshes.objects.forEach(mesh => {
            const match = mesh.name.match(/section_(\d+)/);
            if (match) {
                const sectionNum = parseInt(match[1]);
                if (sectionNum >= 5) {
                    mesh.visible = visible;
                }
            }
        });
    }
    
    setSectionVisible(index, visible) {
        this.sectionVisibility.sections[index] = visible;
        const isSky = index >= 1 && index <= 3;
        const sectionNum = index + 1;
        
        const meshArray = isSky ? this.meshes.sky : this.meshes.objects;
        meshArray.forEach(mesh => {
            if (mesh.name && mesh.name.includes(`section_${sectionNum}_`)) {
                mesh.visible = visible;
            }
        });
    }
    
    getSectionVisibility() {
        return {
            sections: { ...this.sectionVisibility.sections }
        };
    }
    
    setPaletteOverrides(sectionOverrides) {
        this.sectionPaletteOverrides = sectionOverrides || {};
    }
    
    isolateSection(index) {
        if (!this.savedVisibility) {
            this.savedVisibility = {
                sky: this.meshes.sky.map(m => m.visible),
                objects: this.meshes.objects.map(m => m.visible)
            };
        }
        
        this.meshes.sky.forEach(mesh => mesh.visible = false);
        this.meshes.objects.forEach(mesh => mesh.visible = false);
        
        const isSky = index >= 1 && index <= 3;
        const sectionNum = index + 1;
        const meshArray = isSky ? this.meshes.sky : this.meshes.objects;
        
        meshArray.forEach(mesh => {
            if (mesh.name && mesh.name.includes(`section_${sectionNum}_`)) {
                mesh.visible = true;
            }
        });
    }
    
    restoreAllSections() {
        if (this.savedVisibility) {
            this.meshes.sky.forEach((mesh, i) => {
                if (this.savedVisibility.sky[i] !== undefined) {
                    mesh.visible = this.savedVisibility.sky[i];
                }
            });
            this.meshes.objects.forEach((mesh, i) => {
                if (this.savedVisibility.objects[i] !== undefined) {
                    mesh.visible = this.savedVisibility.objects[i];
                }
            });
            this.savedVisibility = null;
        } else {
            this.updateVisibility();
        }
    }

    getStats() {
        let totalVertices = 0;
        let totalTriangles = 0;

        const countMesh = (mesh) => {
            if (mesh && mesh.geometry) {
                const pos = mesh.geometry.getAttribute('position');
                if (pos) totalVertices += pos.count;
                const idx = mesh.geometry.getIndex();
                if (idx) totalTriangles += idx.count / 3;
                else totalTriangles += pos.count / 3;
            }
        };

        this.meshes.sky.forEach(countMesh);
        this.meshes.objects.forEach(countMesh);

        const groundMeshCount = this.meshes.objects.filter(mesh => 
            mesh.name && mesh.name.includes('section_1_')
        ).length;

        return {
            vertices: totalVertices,
            triangles: Math.floor(totalTriangles),
            groundMesh: groundMeshCount,
            skyMeshes: this.meshes.sky.length,
            objectMeshes: this.meshes.objects.length
        };
    }
}

window.FF7SceneRenderer = FF7SceneRenderer;

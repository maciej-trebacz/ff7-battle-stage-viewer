/**
 * FF7 PSX Battle Scene Parser
 * Parses binary scene files according to the reverse-engineered format spec
 */

class FF7SceneParser {
  constructor(arrayBuffer) {
      this.buffer = arrayBuffer;
      this.view = new DataView(arrayBuffer);
      this.offset = 0;
  }

  readUint8() {
      const val = this.view.getUint8(this.offset);
      this.offset += 1;
      return val;
  }

  readInt16() {
      const val = this.view.getInt16(this.offset, true);
      this.offset += 2;
      return val;
  }

  readUint16() {
      const val = this.view.getUint16(this.offset, true);
      this.offset += 2;
      return val;
  }

  readUint32() {
      const val = this.view.getUint32(this.offset, true);
      this.offset += 4;
      return val;
  }

  seek(offset) {
      this.offset = offset;
  }

  parse() {
      const result = {
          header: null,
          sections: [],
          metadata: null,
          groundPlane: null,
          geometry3D: [],
          texture: null,
          errors: []
      };

      try {
          result.header = this.parseHeader();
          
          for (let i = 0; i < result.header.sectionCount; i++) {
              const section = this.parseSection(i, result.header.pointers[i], result.header.sizes[i]);
              result.sections.push(section);
          }

          if (result.sections[0]) {
              result.metadata = result.sections[0].data;
          }

          if (result.sections[1] && result.sections[1].type === '3d_geometry') {
              result.groundPlane = result.sections[1].data;
          }

          for (let i = 2; i < result.sections.length; i++) {
              const section = result.sections[i];
              if (section.type === '3d_geometry') {
                  result.geometry3D.push(section.data);
              } else if (section.type === 'tim_texture') {
                  result.texture = section.data;
              }
          }

      } catch (e) {
          result.errors.push(e.message);
          console.error('Parse error:', e);
      }

      return result;
  }

  parseHeader() {
      this.seek(0);
      const sectionCount = this.readUint32();

      const pointers = [];
      for (let i = 0; i < sectionCount; i++) {
          pointers.push(this.readUint32());
      }

      const sizes = [];
      for (let i = 0; i < sectionCount; i++) {
          const nextPtr = (i < sectionCount - 1) ? pointers[i + 1] : this.buffer.byteLength;
          sizes.push(nextPtr - pointers[i]);
      }

      return { sectionCount, pointers, sizes };
  }

  parseSection(index, offset, size) {
      this.seek(offset);

      if (index === 0) {
          return this.parseMetadataSection(index, offset, size);
      }

      const magic = this.view.getUint32(offset, true);
      if (magic === 0x10) {
          return this.parseTIMSection(index, offset, size);
      }

      return this.parse3DGeometrySection(index, offset, size);
  }

  parseMetadataSection(index, offset, size) {
      this.seek(offset);
      const flags = this.readUint32();
      const reserved = this.readUint32();

      return {
          index,
          offset,
          size,
          type: 'metadata',
          data: { flags, reserved }
      };
  }

  parse3DGeometrySection(index, offset, size) {
      this.seek(offset);
      const vertexDataSize = this.readUint32();
      const vertexCount = Math.floor(vertexDataSize / 8);

      const vertices = [];
      for (let i = 0; i < vertexCount; i++) {
          const x = this.readInt16();
          const z = this.readInt16();
          const y = this.readInt16();
          this.readUint16();
          vertices.push({ x, y, z });
      }

      const triangles = [];
      const quads = [];

      const triCount = this.readUint16();
      const triTpage = this.readUint16();
      const texturePageX = triTpage & 0x0F;
      
      if (triCount > 0) {
          for (let i = 0; i < triCount; i++) {
              const vert0 = this.readUint16() / 8;
              const vert1 = this.readUint16() / 8;
              const vert2 = this.readUint16() / 8;

              this.readUint16();
              const u0 = this.readUint8();
              const v0 = this.readUint8();
              const clutWord = this.readUint16();
              const u1 = this.readUint8();
              const v1 = this.readUint8();
              const u2 = this.readUint8();
              const v2 = this.readUint8();

              if (vert0 < vertexCount && vert1 < vertexCount && vert2 < vertexCount) {
                  const clutY = (clutWord >> 6) & 0x1FF;
                  const paletteIndex = clutY >= 504 ? clutY - 504 : 0;
                  
                  triangles.push({
                      vertices: [vert0, vert1, vert2],
                      clutWord,
                      paletteIndex,
                      storedUVs: [
                          { u: u0, v: v0 },
                          { u: u1, v: v1 },
                          { u: u2, v: v2 }
                      ]
                  });
              }
          }
      }

      const quadCount = this.readUint16();
      this.readUint16();

      if (quadCount > 0) {
          const headerV0 = this.readUint16() / 8;
          const headerV1 = this.readUint16() / 8;
          const headerV2 = this.readUint16() / 8;
          const headerV3 = this.readUint16() / 8;

          const records = [];
          for (let i = 0; i < quadCount; i++) {
              const uvData = [];
              for (let j = 0; j < 12; j++) {
                  uvData.push(this.readUint8());
              }
              const v0 = this.readUint16() / 8;
              const v1 = this.readUint16() / 8;
              const v2 = this.readUint16() / 8;
              const v3 = this.readUint16() / 8;
              
              const storedUVs = [
                  { u: uvData[0], v: uvData[1] },
                  { u: uvData[4], v: uvData[5] },
                  { u: uvData[6], v: uvData[7] },
                  { u: uvData[8], v: uvData[9] }
              ];
              const clutWord = (uvData[3] << 8) | uvData[2];
              const flags = (uvData[11] << 8) | uvData[10];
              const clutY = (clutWord >> 6) & 0x1FF;
              const paletteIndex = clutY >= 504 ? clutY - 504 : 0;
              
              records.push({ uvData, storedUVs, clutWord, flags, paletteIndex, vertices: [v0, v1, v2, v3] });
          }

          if (records.length > 0 &&
              headerV0 < vertexCount && headerV1 < vertexCount && 
              headerV2 < vertexCount && headerV3 < vertexCount &&
              !(headerV0 === 0 && headerV1 === 0 && headerV2 === 0 && headerV3 === 0)) {
              const uv = records[0];
              quads.push({
                  uvData: uv.uvData, clutWord: uv.clutWord, flags: uv.flags,
                  paletteIndex: uv.paletteIndex,
                  vertices: [headerV0, headerV1, headerV2, headerV3],
                  storedUVs: uv.storedUVs
              });
          }

          for (let i = 0; i < records.length - 1; i++) {
              const verts = records[i].vertices;
              const uv = records[i + 1];
              
              if (verts[0] === 0 && verts[1] === 0 && verts[2] === 0 && verts[3] === 0) {
                  continue;
              }
              
              if (verts[0] < vertexCount && verts[1] < vertexCount &&
                  verts[2] < vertexCount && verts[3] < vertexCount) {
                  quads.push({
                      uvData: uv.uvData, clutWord: uv.clutWord, flags: uv.flags,
                      paletteIndex: uv.paletteIndex,
                      vertices: verts,
                      storedUVs: uv.storedUVs
                  });
              }
          }
      }

      return {
          index, offset, size,
          type: '3d_geometry',
          data: {
              vertexDataSize, vertexCount, vertices,
              texturePageX,
              triangleCount: triangles.length,
              triangles,
              quadCount: quads.length,
              quads
          }
      };
  }

  parseTIMSection(index, offset, size) {
      this.seek(offset);
      const magic = this.readUint32();
      const flags = this.readUint32();

      const bppMode = flags & 0x3;
      const bppMap = { 0: 4, 1: 8, 2: 16, 3: 24 };
      const bpp = bppMap[bppMode];
      const hasClut = (flags >> 3) & 1;

      let clut = null;
      if (hasClut) {
          const clutSize = this.readUint32();
          const clutX = this.readUint16();
          const clutY = this.readUint16();
          const clutWidth = this.readUint16();
          const clutHeight = this.readUint16();

          const colorCount = clutWidth * clutHeight;
          const colors = [];
          for (let i = 0; i < colorCount; i++) {
              const color16 = this.readUint16();
              const r = (color16 & 0x1F) << 3;
              const g = ((color16 >> 5) & 0x1F) << 3;
              const b = ((color16 >> 10) & 0x1F) << 3;
              const a = (r === 0 && g === 0 && b === 0) ? 0 : 255;
              colors.push({ r, g, b, a });
          }

          clut = {
              size: clutSize,
              x: clutX,
              y: clutY,
              width: clutWidth,
              height: clutHeight,
              colors
          };
      }

      const imgSize = this.readUint32();
      const imgX = this.readUint16();
      const imgY = this.readUint16();
      const imgWidth = this.readUint16();
      const imgHeight = this.readUint16();

      let actualWidth = imgWidth;
      if (bpp === 4) actualWidth = imgWidth * 4;
      else if (bpp === 8) actualWidth = imgWidth * 2;

      const pixelDataSize = imgSize - 12;
      const pixelData = new Uint8Array(this.buffer, this.offset, pixelDataSize);

      window.textureWidth = actualWidth;
      window.textureHeight = imgHeight;
      window.textureBasePageX = Math.floor(imgX / 64);
      
      return {
          index,
          offset,
          size,
          type: 'tim_texture',
          data: {
              magic,
              flags,
              bpp,
              hasClut,
              clut,
              image: {
                  size: imgSize,
                  x: imgX,
                  y: imgY,
                  rawWidth: imgWidth,
                  rawHeight: imgHeight,
                  width: actualWidth,
                  height: imgHeight
              },
              pixelData
          }
      };
  }
}

function decodeTIMToCanvas(timData, paletteIndex = 0) {
  if (!timData || !timData.clut || !timData.pixelData) {
      console.error('Invalid TIM data');
      return null;
  }

  const { bpp, clut, image, pixelData } = timData;
  const { width, height } = image;
  
  const colorsPerPalette = clut.width;
  const numPalettes = clut.height;
  const safePaletteIndex = Math.min(paletteIndex, numPalettes - 1);
  const paletteStart = safePaletteIndex * colorsPerPalette;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);

  if (bpp === 8) {
      for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
              const srcIdx = y * image.rawWidth * 2 + x;
              if (srcIdx >= pixelData.length) continue;

              const colorIndex = pixelData[srcIdx];
              const clutIdx = paletteStart + (colorIndex % colorsPerPalette);
              const color = clut.colors[clutIdx] || { r: 255, g: 0, b: 255, a: 255 };

              const dstIdx = (y * width + x) * 4;
              imageData.data[dstIdx] = color.r;
              imageData.data[dstIdx + 1] = color.g;
              imageData.data[dstIdx + 2] = color.b;
              imageData.data[dstIdx + 3] = color.a;
          }
      }
  } else if (bpp === 4) {
      for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
              const srcByteIdx = y * image.rawWidth * 2 + Math.floor(x / 2);
              if (srcByteIdx >= pixelData.length) continue;

              const byte = pixelData[srcByteIdx];
              const colorIndex = (x % 2 === 0) ? (byte & 0x0F) : ((byte >> 4) & 0x0F);
              const clutIdx = paletteStart + (colorIndex % colorsPerPalette);
              const color = clut.colors[clutIdx] || { r: 255, g: 0, b: 255, a: 255 };

              const dstIdx = (y * width + x) * 4;
              imageData.data[dstIdx] = color.r;
              imageData.data[dstIdx + 1] = color.g;
              imageData.data[dstIdx + 2] = color.b;
              imageData.data[dstIdx + 3] = color.a;
          }
      }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function decodeTIMAllPalettes(timData) {
  if (!timData || !timData.clut) {
      return [decodeTIMToCanvas(timData)];
  }
  
  const numPalettes = timData.clut.height;
  const canvases = [];
  
  for (let i = 0; i < numPalettes; i++) {
      canvases.push(decodeTIMToCanvas(timData, i));
  }
  
  return canvases;
}

window.FF7SceneParser = FF7SceneParser;
window.decodeTIMToCanvas = decodeTIMToCanvas;
window.decodeTIMAllPalettes = decodeTIMAllPalettes;

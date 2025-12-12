// FF7 PSX Battle Stage File Format
// ImHex Pattern Language definition
// Based on reverse-engineered format specification

#pragma endian little

// ============================================================================
// Helper Functions
// ============================================================================

fn extract_palette_index(u16 clut_word) {
    u16 clut_y = (clut_word >> 6) & 0x1FF;
    if (clut_y >= 504) {
        return clut_y - 504;
    }
    return 0;
};

fn extract_tpage_x(u16 tpage) {
    return tpage & 0x0F;
};

fn get_bpp(u32 flags) {
    u8 mode = flags & 0x3;
    if (mode == 0) return 4;
    if (mode == 1) return 8;
    if (mode == 2) return 16;
    return 24;
};

// ============================================================================
// Section 0: Metadata
// ============================================================================

struct Metadata {
    u32 flags [[comment("Scene configuration flags")]];
    u32 reserved [[comment("Always 0")]];
};

// ============================================================================
// 3D Geometry Structures
// ============================================================================

struct Vertex {
    s16 x [[comment("X coordinate (left/right)")]];
    s16 z [[comment("Z coordinate (height, typically 0 for ground)")]];
    s16 y [[comment("Y coordinate (forward/back)")]];
    u16 pad;
};

struct PolyCount {
    u16 count [[comment("Number of polygons")]];
    u16 tpage [[comment("Texture page (low 4 bits = page X)")]];
};

bitfield CLUTAttribute {
    clut_x : 6 [[comment("CLUT X position / 16")]];
    clut_y : 9 [[comment("CLUT Y position (504 + palette index)")]];
    reserved : 1;
};

struct Triangle {
    u16 vert0_offset [[comment("Vertex 0 byte offset (divide by 8 for index)")]];
    u16 vert1_offset [[comment("Vertex 1 byte offset")]];
    u16 vert2_offset [[comment("Vertex 2 byte offset")]];
    u16 unknown [[comment("Unknown/flags")]];
    u8 u0;
    u8 v0;
    u16 clut [[comment("CLUT attribute (palette selector)")]];
    u8 u1;
    u8 v1;
    u8 u2;
    u8 v2;
};

struct Quad {
    u16 vert0_offset [[comment("Vertex 0 byte offset (divide by 8 for index)")]];
    u16 vert1_offset [[comment("Vertex 1 byte offset")]];
    u16 vert2_offset [[comment("Vertex 2 byte offset")]];
    u16 vert3_offset [[comment("Vertex 3 byte offset")]];
    u8 u0;
    u8 v0;
    u16 clut [[comment("CLUT attribute (palette selector)")]];
    u8 u1;
    u8 v1;
    u8 u2;
    u8 v2;
    u8 u3;
    u8 v3;
    u16 flags [[comment("Typically 0x007F")]];
};

struct GeometrySection {
    u32 vertexDataSize [[comment("Size of vertex data in bytes")]];
    Vertex vertices[vertexDataSize / 8];
    
    PolyCount trianglePolyCount [[comment("Triangle count and texture page")]];
    
    if (trianglePolyCount.count > 0) {
        Triangle triangles[trianglePolyCount.count];
    }
    
    PolyCount quadPolyCount [[comment("Quad count and texture page")]];
    
    if (quadPolyCount.count > 0) {
        Quad quads[quadPolyCount.count];
    }
    u64 unknown [[comment("Padding? (always 8 zero bytes)")]];
};

// ============================================================================
// TIM Texture Structures
// ============================================================================

bitfield TIMColor {
    r : 5 [[comment("Red (0-31)")]];
    g : 5 [[comment("Green (0-31)")]];
    b : 5 [[comment("Blue (0-31)")]];
    stp : 1 [[comment("Semi-Transparency Processing bit")]];
};

struct CLUTHeader {
    u32 blockSize [[comment("Size of CLUT block including header")]];
    u16 x [[comment("VRAM X position")]];
    u16 y [[comment("VRAM Y position")]];
    u16 width [[comment("Number of colors per palette")]];
    u16 height [[comment("Number of palettes")]];
};

struct ImageHeader {
    u32 blockSize [[comment("Size of image block including header")]];
    u16 x [[comment("VRAM X position")]];
    u16 y [[comment("VRAM Y position")]];
    u16 width [[comment("Width in VRAM words (multiply by 2 for 8bpp pixels)")]];
    u16 height [[comment("Height in pixels")]];
};

struct TIMTexture {
    u32 magic [[comment("Always 0x10 for TIM")]];
    u32 flags [[comment("Bits 0-1: BPP mode, Bit 3: CLUT present")]];
    
    if ((flags >> 3) & 1) {
        CLUTHeader clutHeader;
        TIMColor colors[clutHeader.width * clutHeader.height];
    }
    
    ImageHeader imageHeader;
    u8 pixelData[imageHeader.blockSize - 12];
};

// ============================================================================
// File Header
// ============================================================================

struct Header {
    u32 sectionCount [[comment("Number of sections in file")]];
    u32 sectionOffsets[sectionCount] [[comment("Byte offsets from file start")]];
};

// ============================================================================
// Main Pattern
// ============================================================================

Header header @ 0x00;

Metadata metadata @ header.sectionOffsets[0];

// Parse geometry sections (sections 1 to N-2)
// Due to Pattern Language limitations with dynamic section detection,
// we define individual section variables

    GeometrySection geometry1 @ header.sectionOffsets[1];
    GeometrySection geometry2 @ header.sectionOffsets[2];
    GeometrySection geometry3 @ header.sectionOffsets[3];
    GeometrySection geometry4 @ header.sectionOffsets[4];
    GeometrySection geometry5 @ header.sectionOffsets[5];
    GeometrySection geometry6 @ header.sectionOffsets[6];
GeometrySection geometry7 @ header.sectionOffsets[7];
GeometrySection geometry8 @ header.sectionOffsets[8];
GeometrySection geometry9 @ header.sectionOffsets[9];




// Last section is always TIM texture
TIMTexture texture @ header.sectionOffsets[header.sectionCount - 1];
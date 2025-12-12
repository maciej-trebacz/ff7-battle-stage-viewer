# FF7 PSX Battle Scene Format

Reverse-engineered documentation for Final Fantasy VII PlayStation battle scene files.

This repo also contains a viewer for the PSX files and an exporter to the PC formats.

## Overview

Battle scene files contain all the 3D geometry and texture data needed to render a battle environment. These files are typically LZS-compressed and must be decompressed before parsing.

## File Structure

```
┌─────────────────────────────────────┐
│ Header                              │
│   [4 bytes]  Section count (N)      │
│   [N×4 bytes] Section pointers      │
├─────────────────────────────────────┤
│ Section 0: Metadata                 │
├─────────────────────────────────────┤
│ Sections 1 to N-2: 3D Geometry      │
│   Section 1: Ground plane           │
│   Section 2+: Sky, environment, etc │
├─────────────────────────────────────┤
│ Section N-1: TIM Texture            │
└─────────────────────────────────────┘
```

All multi-byte integers are **little-endian**.

## Header

| Offset | Size | Description |
|--------|------|-------------|
| 0x00 | 4 bytes | Section count (N) |
| 0x04 | N×4 bytes | Array of section offsets from file start |

## Section 0: Metadata

8 bytes containing scene configuration flags.

| Offset | Size | Description |
|--------|------|-------------|
| 0x00 | 4 bytes | Flags (purpose TBD) |
| 0x04 | 4 bytes | Reserved (always 0) |

**Known flag values:**
- STAGE00: `0x00000501`
- STAGE60: `0x00000C01`

## Sections 1 to N-2: 3D Geometry

All geometry sections (including the ground plane at section 1) use the same unified format. This matches the [FF7 Battle Model Format](https://wiki.ffrtt.ru/index.php/FF7/Battle_model_format_(PSX)) where polygon data uses explicit `PolyCount` structures.

### Structure

```
┌────────────────────────────────────┐
│ [4 bytes] Vertex data byte size    │
├────────────────────────────────────┤
│ [variable] Vertex array            │
├────────────────────────────────────┤
│ [4 bytes] Triangle PolyCount       │
│   [2 bytes] count                  │
│   [2 bytes] tpage                  │
├────────────────────────────────────┤
│ [count × 16 bytes] Triangle data   │
│   (if count > 0)                   │
├────────────────────────────────────┤
│ [4 bytes] Quad PolyCount           │
│   [2 bytes] count                  │
│   [2 bytes] tpage                  │
├────────────────────────────────────┤
│ [count × 20 bytes] Quad data       │
│   (if count > 0)                   │
├────────────────────────────────────┤
│ [8 bytes] Unknown/padding          │
│   (almost always 0)                │
└────────────────────────────────────┘
```

The format is self-describing: explicit counts determine how many triangles and quads are present. No heuristics needed.

### Vertex Format (8 bytes)

| Offset | Size | Type | Description |
|--------|------|------|-------------|
| 0x00 | 2 bytes | int16 | X coordinate |
| 0x02 | 2 bytes | int16 | Z coordinate (height/depth, 0 for ground plane) |
| 0x04 | 2 bytes | int16 | Y coordinate |
| 0x06 | 2 bytes | uint16 | Padding (0) |

Ground plane vertices typically have Z=0 (flat surface). Typical coordinate range: -6000 to +6000 units.

### PolyCount Structure (4 bytes)

| Offset | Size | Description |
|--------|------|-------------|
| 0x00 | 2 bytes | Polygon count |
| 0x02 | 2 bytes | Texture page (tpage) |

**Note:** The texture page X for the entire section comes from the **first** PolyCount's tpage field (triangle PolyCount), even when triangle count is 0. Use `tpage & 0x0F` to extract the texture page X base.

### Textured Triangle Record (16 bytes)

| Offset | Size | Description |
|--------|------|-------------|
| 0x00 | 6 bytes | 3× vertex byte offsets (uint16, divide by 8) |
| 0x06 | 2 bytes | Unknown/flags |
| 0x08 | 1 byte | U0 coordinate |
| 0x09 | 1 byte | V0 coordinate |
| 0x0A | 2 bytes | CLUT attribute (palette selector) |
| 0x0C | 1 byte | U1 coordinate |
| 0x0D | 1 byte | V1 coordinate |
| 0x0E | 1 byte | U2 coordinate |
| 0x0F | 1 byte | V2 coordinate |

Each vertex has its own UV coordinates: (U0,V0), (U1,V1), (U2,V2).

### Textured Quad Record (20 bytes)

| Offset | Size | Description |
|--------|------|-------------|
| 0x00 | 8 bytes | 4× vertex byte offsets (uint16, divide by 8) |
| 0x08 | 1 byte | U0 coordinate |
| 0x09 | 1 byte | V0 coordinate |
| 0x0A | 2 bytes | CLUT attribute (palette selector) |
| 0x0C | 1 byte | U1 coordinate |
| 0x0D | 1 byte | V1 coordinate |
| 0x0E | 1 byte | U2 coordinate |
| 0x0F | 1 byte | V2 coordinate |
| 0x10 | 1 byte | U3 coordinate |
| 0x11 | 1 byte | V3 coordinate |
| 0x12 | 2 bytes | Flags (typically 0x007F) |

Each vertex has its own UV coordinates: (U0,V0), (U1,V1), (U2,V2), (U3,V3).

### CLUT Attribute

Standard PSX CLUT format encoding palette row:
- Bits 0-5: CLUT X position ÷ 16 (typically 0x14 = 320)
- Bits 6-14: CLUT Y position (504 + palette_index)
- Formula: `palette_index = ((clut_word >> 6) & 0x1FF) - 504`
- Example: 0x7E14 = palette 0, 0x7E54 = palette 1, 0x7E94 = palette 2

### Vertex Offsets

All vertex references are byte offsets into the vertex array. Divide by 8 to get the vertex index.

### Texture Page X Calculation

- For 8bpp textures: `texture_x_offset = (tpage_x - base_tpage_x) × 128` pixels
- Base tpage X = TIM image VRAM X ÷ 64
- Example: Ground (tpage 6) = offset 0, Sky (tpage 8) = offset 256px

### Common Section Contents

| Section | Typical Content | Notes |
|---------|-----------------|-------|
| 1 | Ground plane | Usually quads only, Z=0 |
| 2 | Sky dome (upper) | Often triangles |
| 3 | Sky ring (middle) | Horizon band |
| 4 | Sky ring (lower) | Near-ground atmosphere |
| 5+ | Scene objects | Buildings, structures, props |

## Section N-1: TIM Texture

Standard PlayStation TIM format texture containing all scene textures in an atlas.

### TIM Structure

```
┌────────────────────────────────────┐
│ [4 bytes] Magic (0x10)             │
│ [4 bytes] Flags                    │
├────────────────────────────────────┤
│ CLUT Block (if present)            │
│   [4 bytes] Block size             │
│   [2 bytes] X position in VRAM     │
│   [2 bytes] Y position in VRAM     │
│   [2 bytes] Width (colors)         │
│   [2 bytes] Height (palettes)      │
│   [variable] Color data            │
├────────────────────────────────────┤
│ Image Block                        │
│   [4 bytes] Block size             │
│   [2 bytes] X position in VRAM     │
│   [2 bytes] Y position in VRAM     │
│   [2 bytes] Width (in VRAM words)  │
│   [2 bytes] Height (pixels)        │
│   [variable] Pixel data            │
└────────────────────────────────────┘
```

**Flags:**
- Bits 0-1: BPP mode (0=4bpp, 1=8bpp, 2=16bpp, 3=24bpp)
- Bit 3: CLUT present

**Typical values:**
- 8bpp with CLUT (flags = 0x09)
- CLUT position: (320, 504)
- Image position: (384, 0)

## Example File Analysis

### STAGE00 (147,820 bytes)

| Section | Offset | Size | Content | Texture Page | Palette |
|---------|--------|------|---------|--------------|---------|
| 0 | 0x001C | 8 | Metadata | - | - |
| 1 | 0x0024 | 10,836 | Ground plane (832 verts, 0 tris, 208 quads) | 6 (0-255px) | 0 |
| 2 | 0x2A78 | 3,020 | Sky dome (225 verts, 76 tris, 0 quads) | 8 (256-511px) | 1 |
| 3 | 0x3644 | 852 | Sky ring mid (64 verts, 0 tris, 16 quads) | 8 (256-511px) | 1 |
| 4 | 0x3998 | 436 | Sky ring low (32 verts, 0 tris, 8 quads) | 8 (256-511px) | 2 |
| 5 | 0x3B4C | 132,640 | TIM texture (512×256, 8bpp, 3 palettes) | - | - |

### STAGE60 (226,348 bytes)

| Section | Offset | Size | Content | Texture Page | Palette |
|---------|--------|------|---------|--------------|---------|
| 0 | 0x0048 | 8 | Metadata | - | - |
| 1 | 0x0050 | 7,788 | Ground plane (596 verts, 20 tris, 134 quads) | 10 (512-639px) | 4 |
| 2 | 0x1EBC | 3,020 | Sky dome (225 verts, 76 tris, 0 quads) | 6 (0-127px) | 0 |
| 3 | 0x2A88 | 436 | Sky ring (32 verts, 0 tris, 8 quads) | 6 (0-127px) | 0 |
| 4 | 0x2C3C | 852 | Sky ring (64 verts, 0 tris, 16 quads) | 6 (0-127px) | 0 |
| 5-15 | various | various | Environmental objects | 6,8,10 | 0-6 |
| 16 | 0x640C | 200,736 | TIM texture (768×256, 8bpp, 7+ palettes) | - | - |

**Note:** STAGE60 demonstrates mixed geometry (triangles + quads in same section) and complex texture atlas usage with multiple texture pages and palettes.

## Coordinate System

All geometry sections use the same 3D coordinate format (X, Z, Y):
- **X:** Left/right
- **Z:** Height (stored as negative in PSX format, positive = down; ground plane typically has Z=0)
- **Y:** Forward/back

Typical ranges:
- **Ground plane:** X, Y from -6000 to +6000, Z=0
- **Sky dome:** Large coordinates (~30000) forming a hemisphere
- **Unit scale:** Approximately 1 unit = 1 game unit (character height ~2000-3000 units)

**Important:** PSX uses positive Z as downward. When rendering in standard 3D systems (positive Y = up), negate the Z coordinate: `render_y = -psx_z`

## Related Formats

- [Battle Model Format (PSX)](https://wiki.ffrtt.ru/index.php/FF7/Battle_model_format_(PSX)) - Similar polygon structures
- [TIM Format](https://wiki.ffrtt.ru/index.php/PSX/TIM_format) - Texture format specification
- [HRC Format](https://wiki.ffrtt.ru/index.php/PSX/HRC) - Hierarchy/skeleton format (PC version)

## Palette and Texture Page System

### CLUT (Color Lookup Table)
The TIM texture contains multiple palettes stored sequentially in VRAM:
- **Location:** VRAM (320, 504) for STAGE00
- **Format:** 256 colors × N palettes (e.g., 3 palettes for STAGE00)
- **Palette rows:** Y=504 (palette 0), Y=505 (palette 1), Y=506 (palette 2), etc.

### Palette Selection
Each polygon (quad or triangle) specifies which palette to use via its CLUT attribute:
- **Quads:** CLUT word at UV data bytes 0x02-0x03
- **Triangles:** CLUT word at bytes 0x0E-0x0F
- **Decoding:** `palette_index = ((clut_word >> 6) & 0x1FF) - 504`

### Texture Page System
The texture atlas is divided into 128-pixel-wide pages for 8bpp images:
- **Page width:** 128 pixels (64 VRAM units)
- **Encoding:** Low nibble of polygon header word 1 (bytes 0x02-0x03)
- **Offset calculation:** `texture_x_offset = (tpage_x - base_tpage_x) × 128`
- **Example (STAGE00):**
  - Ground plane: tpage 6 → offset 0px (left half)
  - Sky sections: tpage 8 → offset 256px (right half)

## Unknown/TBD

- Exact meaning of Section 0 flags (scene configuration)
- Meaning of UV data flags field (bytes 0x0A-0x0B in quads, typically 0x007F)
- Exact UV coordinate winding order variations

## Tools

Sample Python code to parse the header:

```python
import struct

def parse_battle_scene(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()
    
    section_count = struct.unpack('<I', data[0:4])[0]
    
    pointers = []
    for i in range(section_count):
        ptr = struct.unpack('<I', data[4 + i*4:8 + i*4])[0]
        pointers.append(ptr)
    
    # Calculate section sizes
    sizes = []
    for i, ptr in enumerate(pointers):
        next_ptr = pointers[i+1] if i < len(pointers)-1 else len(data)
        sizes.append(next_ptr - ptr)
    
    return {
        'section_count': section_count,
        'sections': [
            {'offset': ptr, 'size': size}
            for ptr, size in zip(pointers, sizes)
        ]
    }
```

## References

- [Qhimm Forums](http://forums.qhimm.com/) - FF7 modding community
- [FF7 Technical Wiki](https://wiki.ffrtt.ru/) - Comprehensive FF7 format documentation


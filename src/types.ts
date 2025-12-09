export interface Stats {
  vertices: number;
  triangles: number;
  groundMesh: number;
  skyMeshes: number;
  objectMeshes: number;
}

export interface PaletteState {
  sections: Record<number, number>;
}

export interface SectionVisibility {
  sections: Record<number, boolean>;
}

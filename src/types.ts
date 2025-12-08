export interface Stats {
  vertices: number;
  triangles: number;
  groundMesh: number;
  skyMeshes: number;
  objectMeshes: number;
}

export interface PaletteState {
  ground: number;
  sections: Record<number, number>;
}

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatStats = (stats?: {
  vertices: number;
  triangles: number;
  groundMesh: number;
  skyMeshes: number;
  objectMeshes: number;
}) => {
  if (!stats) return '';
  return `${stats.vertices.toLocaleString()} vertices • ${stats.triangles.toLocaleString()} triangles • ${
    stats.groundMesh + stats.skyMeshes + stats.objectMeshes
  } meshes`;
};

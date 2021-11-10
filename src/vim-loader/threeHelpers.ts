import * as THREE from 'three'

export function createBufferGeometryFromArrays (
  vertices: Float32Array,
  indices: Int32Array,
  vertexColors: Float32Array | undefined = undefined
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()

  // Vertices
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))

  // Indices
  geometry.setIndex(new THREE.Uint32BufferAttribute(indices, 1))

  // Colors
  if (vertexColors) {
    geometry.setAttribute('color', new THREE.BufferAttribute(vertexColors, 3))
  }

  return geometry
}

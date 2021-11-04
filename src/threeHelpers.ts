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

// eslint-disable-next-line no-unused-vars
export function drawSphere (sphere: THREE.Sphere) {
  const s = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.SphereBufferGeometry(sphere.radius)),
    new THREE.LineBasicMaterial({
      depthTest: false,
      opacity: 0.5,
      color: new THREE.Color(0x0000ff),
      transparent: true
    })
  )
  s.position.copy(sphere.center)
  s.updateMatrix()
  s.applyMatrix4(this.getViewMatrix())
  this.scene.add(s)
}

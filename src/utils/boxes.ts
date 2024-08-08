/**
 * @module utils
 */

import * as THREE from 'three'

export function createBoxes (boxes: THREE.Box3[]) {
  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()

  const matrices = boxes.map((b) => {
    b.getCenter(center)
    b.getSize(size)
    return new THREE.Matrix4().compose(center, quaternion, size)
  })

  const cube = new THREE.BoxBufferGeometry(1, 1, 1)
  const mat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.2,
    color: new THREE.Color(0x00ffff),
    depthTest: false
  })
  const mesh = new THREE.InstancedMesh(cube, mat, matrices.length)
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m))

  return mesh
}

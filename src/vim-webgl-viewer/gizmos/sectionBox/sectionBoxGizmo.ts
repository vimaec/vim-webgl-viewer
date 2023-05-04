/**
 * @module viw-webgl-viewer/gizmos/sectionBox
 */

import * as THREE from 'three'

/**
 * Defines the thin outline on the edges of the section box.
 */
export class BoxOutline extends THREE.LineSegments {
  constructor () {
    // prettier-ignore
    const vertices = new Float32Array([
      -0.5, -0.5, -0.5,
      0.5, -0.5, -0.5,
      0.5, 0.5, -0.5,
      -0.5, 0.5, -0.5,
      -0.5, -0.5, 0.5,
      0.5, -0.5, 0.5,
      0.5, 0.5, 0.5,
      -0.5, 0.5, 0.5
    ])
    // prettier-ignore
    const indices = [

      0.5, 1,
      1, 2,
      2, 3,
      3, 0,

      4, 5,
      5, 6,
      6, 7,
      7, 4,

      0, 4,
      1, 5,
      2, 6,
      3, 7
    ]
    const geo = new THREE.BufferGeometry()
    const mat = new THREE.LineBasicMaterial()
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
    geo.setIndex(indices)
    super(geo, mat)
  }

  /**
   * Resize the outline to the given box.
   */
  fitBox (box: THREE.Box3) {
    this.scale.set(
      box.max.x - box.min.x,
      box.max.y - box.min.y,
      box.max.z - box.min.z
    )
    this.position.set(
      (box.max.x + box.min.x) / 2,
      (box.max.y + box.min.y) / 2,
      (box.max.z + box.min.z) / 2
    )
  }

  /**
   * Disposes of all resources.
   */
  dispose () {
    this.geometry.dispose()
    ;(this.material as THREE.Material).dispose()
  }
}

/**
 * Defines the box mesh for the section box.
 */
export class BoxMesh extends THREE.Mesh {
  constructor () {
    const geo = new THREE.BoxGeometry()
    const mat = new THREE.MeshBasicMaterial({
      opacity: 0.1,
      transparent: true,
      color: new THREE.Color(0, 0.5, 1),
      depthTest: false
    })

    super(geo, mat)
  }

  /**
   * Resize the mesh to the given box.
   */
  fitBox (box: THREE.Box3) {
    this.scale.set(
      box.max.x - box.min.x,
      box.max.y - box.min.y,
      box.max.z - box.min.z
    )
    this.position.set(
      (box.max.x + box.min.x) / 2,
      (box.max.y + box.min.y) / 2,
      (box.max.z + box.min.z) / 2
    )
  }

  /**
   * Disposes of all resources.
   */
  dispose () {
    this.geometry.dispose()
    ;(this.material as THREE.Material).dispose()
  }
}

/**
 * Defines the face highlight on hover for the section box.
 */
export class BoxHighlight extends THREE.Mesh {
  constructor () {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(12), 3)
    )
    geo.setIndex([0, 1, 2, 0, 2, 3])

    const mat = new THREE.MeshBasicMaterial({
      opacity: 0.5,
      transparent: true,
      depthTest: false,
      side: THREE.DoubleSide
    })
    super(geo, mat)
    // Because position is always (0,0,0)
    this.frustumCulled = false
  }

  /**
   * Sets the face to highlight
   * @param normal a direction vector from theses options (X,-X, Y,-Y, Z,-Z)
   */
  highlight (box: THREE.Box3, normal: THREE.Vector3) {
    this.visible = false
    const positions = this.geometry.getAttribute('position')

    if (normal.x > 0.1) {
      positions.setXYZ(0, box.max.x, box.max.y, box.max.z)
      positions.setXYZ(1, box.max.x, box.min.y, box.max.z)
      positions.setXYZ(2, box.max.x, box.min.y, box.min.z)
      positions.setXYZ(3, box.max.x, box.max.y, box.min.z)
      this.visible = true
    }
    if (normal.x < -0.1) {
      positions.setXYZ(0, box.min.x, box.max.y, box.max.z)
      positions.setXYZ(1, box.min.x, box.min.y, box.max.z)
      positions.setXYZ(2, box.min.x, box.min.y, box.min.z)
      positions.setXYZ(3, box.min.x, box.max.y, box.min.z)
      this.visible = true
    }
    if (normal.y > 0.1) {
      positions.setXYZ(0, box.max.x, box.max.y, box.max.z)
      positions.setXYZ(1, box.min.x, box.max.y, box.max.z)
      positions.setXYZ(2, box.min.x, box.max.y, box.min.z)
      positions.setXYZ(3, box.max.x, box.max.y, box.min.z)
      this.visible = true
    }
    if (normal.y < -0.1) {
      positions.setXYZ(0, box.max.x, box.min.y, box.max.z)
      positions.setXYZ(1, box.min.x, box.min.y, box.max.z)
      positions.setXYZ(2, box.min.x, box.min.y, box.min.z)
      positions.setXYZ(3, box.max.x, box.min.y, box.min.z)
      this.visible = true
    }
    if (normal.z > 0.1) {
      positions.setXYZ(0, box.max.x, box.max.y, box.max.z)
      positions.setXYZ(1, box.min.x, box.max.y, box.max.z)
      positions.setXYZ(2, box.min.x, box.min.y, box.max.z)
      positions.setXYZ(3, box.max.x, box.min.y, box.max.z)
      this.visible = true
    }
    if (normal.z < -0.1) {
      positions.setXYZ(0, box.max.x, box.max.y, box.min.z)
      positions.setXYZ(1, box.min.x, box.max.y, box.min.z)
      positions.setXYZ(2, box.min.x, box.min.y, box.min.z)
      positions.setXYZ(3, box.max.x, box.min.y, box.min.z)
      this.visible = true
    }
    positions.needsUpdate = true
  }

  /**
   * Disposes all resources.
   */
  dispose () {
    this.geometry.dispose()
    ;(this.material as THREE.Material).dispose()
  }
}

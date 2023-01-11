import { Color, Float32BufferAttribute, Raycaster } from 'three'
import * as THREE from 'three'
import { createGridMaterial } from '../../vim-loader/materials/gridMaterial'
export class Grid {
  size: THREE.Vector3
  center: THREE.Vector3
  box: THREE.Box3
  mesh: THREE.Mesh

  private _scale: THREE.Vector3
  private _colors: Map<number, THREE.Color> = new Map<number, THREE.Color>()
  private _material: THREE.Material

  constructor (size: THREE.Vector3, scale: THREE.Vector3) {
    this.size = size
    this.box = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(0, 0, 0),
      size.clone().multiply(scale)
    )
    this._scale = scale
    this.build()
  }

  static createFromBox (box: THREE.Box3, scale: THREE.Vector3) {
    const size = box.getSize(new THREE.Vector3()).divide(scale).ceil()
    const g = new Grid(size, scale)
    const center = box.getCenter(new THREE.Vector3())
    g.mesh.position.copy(center)
    g.box.translate(center)
    return g
  }

  getIndex (x: number, y: number, z: number) {
    return x * this.size.y * this.size.z + y * this.size.z + z
  }

  getCellFromIndex (index: number) {
    let r: number = index
    const x = Math.trunc(r / (this.size.y * this.size.z))
    r = r % (this.size.y * this.size.z)
    const y = Math.trunc(r / this.size.z)
    r = r % this.size.z
    const z = r
    return new THREE.Vector3(x, y, z)
  }

  getCellFromPosition (position: THREE.Vector3) {
    if (!this.box.containsPoint(position)) return
    return position.clone().sub(this.box.min).divide(this._scale).floor()
  }

  getCellBox (cell: THREE.Vector3) {
    const min = this.box.min.clone().add(cell.multiply(this._scale))
    const max = min.clone().add(this._scale)
    return new THREE.Box3(min, max)
  }

  raycast (raycaster: Raycaster) {
    const hits = raycaster.intersectObject(this.mesh)
    // push the hit a bit deeper so it is correctly inside the cell.
    const position = raycaster.ray.at(
      hits[0].distance + 0.1,
      new THREE.Vector3()
    )
    if (!hits[0]) return
    return this.getCellFromPosition(position)
  }

  color (cell: THREE.Vector3, color: THREE.Color) {
    const index = this.getIndex(cell.x, cell.y, cell.z)
    this._colors.set(index, color)
    const colors = this.mesh.geometry.getAttribute('color')
    const c = index * 8
    for (let i = 0; i < 8; i++) {
      colors.setXYZ(c + i, color.r, color.g, color.b)
    }
    colors.needsUpdate = true
  }

  getColor (cell: THREE.Vector3) {
    const index = this.getIndex(cell.x, cell.y, cell.z)
    return this._colors.get(index)
  }

  private build () {
    const cellCount = this.size.x * this.size.y * this.size.z
    const vertices = new Float32Array(cellCount * 24)
    const indices = new Int32Array(cellCount * 36)

    for (let x = 0; x < this.size.x; x++) {
      for (let y = 0; y < this.size.y; y++) {
        for (let z = 0; z < this.size.z; z++) {
          const cell = this.getIndex(x, y, z)
          const vertex = cell * 8
          const v = vertex * 3
          vertices[v] = (0 + x) * this._scale.x + this.box.min.x
          vertices[v + 1] = (0 + y) * this._scale.y + this.box.min.y
          vertices[v + 2] = (0 + z) * this._scale.z + this.box.min.z

          vertices[v + 3] = (0 + x) * this._scale.x + this.box.min.x
          vertices[v + 4] = (0 + y) * this._scale.y + this.box.min.y
          vertices[v + 5] = (1 + z) * this._scale.z + this.box.min.z

          vertices[v + 6] = (0 + x) * this._scale.x + this.box.min.x
          vertices[v + 7] = (1 + y) * this._scale.y + this.box.min.y
          vertices[v + 8] = (0 + z) * this._scale.z + this.box.min.z

          vertices[v + 9] = (0 + x) * this._scale.x + this.box.min.x
          vertices[v + 10] = (1 + y) * this._scale.y + this.box.min.y
          vertices[v + 11] = (1 + z) * this._scale.z + this.box.min.z

          vertices[v + 12] = (1 + x) * this._scale.x + this.box.min.x
          vertices[v + 13] = (0 + y) * this._scale.y + this.box.min.y
          vertices[v + 14] = (0 + z) * this._scale.z + this.box.min.z

          vertices[v + 15] = (1 + x) * this._scale.x + this.box.min.x
          vertices[v + 16] = (0 + y) * this._scale.y + this.box.min.y
          vertices[v + 17] = (1 + z) * this._scale.z + this.box.min.z

          vertices[v + 18] = (1 + x) * this._scale.x + this.box.min.x
          vertices[v + 19] = (1 + y) * this._scale.y + this.box.min.y
          vertices[v + 20] = (0 + z) * this._scale.z + this.box.min.z

          vertices[v + 21] = (1 + x) * this._scale.x + this.box.min.x
          vertices[v + 22] = (1 + y) * this._scale.y + this.box.min.y
          vertices[v + 23] = (1 + z) * this._scale.z + this.box.min.z

          const i = cell * 36
          // 1
          indices[i] = vertex
          indices[i + 1] = vertex + 1
          indices[i + 2] = vertex + 2

          indices[i + 3] = vertex + 1
          indices[i + 4] = vertex + 3
          indices[i + 5] = vertex + 2

          // 2
          indices[i + 6] = vertex + 1
          indices[i + 7] = vertex + 5
          indices[i + 8] = vertex + 3

          indices[i + 9] = vertex + 3
          indices[i + 10] = vertex + 5
          indices[i + 11] = vertex + 7

          // 3
          indices[i + 12] = vertex + 5
          indices[i + 13] = vertex + 6
          indices[i + 14] = vertex + 7

          indices[i + 15] = vertex + 5
          indices[i + 16] = vertex + 4
          indices[i + 17] = vertex + 6

          // 4
          indices[i + 18] = vertex + 2
          indices[i + 19] = vertex + 6
          indices[i + 20] = vertex + 4

          indices[i + 21] = vertex + 0
          indices[i + 22] = vertex + 2
          indices[i + 23] = vertex + 4

          // 5
          indices[i + 24] = vertex + 2
          indices[i + 25] = vertex + 3
          indices[i + 26] = vertex + 6

          indices[i + 27] = vertex + 3
          indices[i + 28] = vertex + 7
          indices[i + 29] = vertex + 6

          // 6
          indices[i + 30] = vertex + 0
          indices[i + 31] = vertex + 4
          indices[i + 32] = vertex + 1

          indices[i + 33] = vertex + 1
          indices[i + 34] = vertex + 4
          indices[i + 35] = vertex + 5
        }
      }
    }

    this._material = createGridMaterial()

    const color = new Float32Array(cellCount * 24).fill(0.5)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3)
    )
    geometry.setIndex(new THREE.Uint32BufferAttribute(indices, 1))
    geometry.setAttribute('color', new Float32BufferAttribute(color, 3))

    this.mesh = new THREE.Mesh(geometry, this._material)
  }

  dispose () {
    this.mesh.geometry.dispose()
    this._material.dispose()
  }
}

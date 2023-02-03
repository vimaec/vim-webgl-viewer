import { Float32BufferAttribute, Raycaster } from 'three'
import * as THREE from 'three'
import { createGridMaterial } from '../../vim-loader/materials/gridMaterial'
import { Viewer } from '../viewer'
import { Renderer } from '../rendering/renderer'
import { Vim, VimMaterials } from '../../vim'
import { SectionBox } from './sectionBox/sectionBox'
import { BoxOutline } from './sectionBox/sectionBoxGizmo'

export class GizmoGrid {
  private _renderer: Renderer
  private _material: THREE.ShaderMaterial
  grid: Grid
  outline: BoxOutline

  constructor (renderer: Renderer, materials: VimMaterials) {
    this._renderer = renderer
    this._material = materials.grid
  }

  init (target: Vim | THREE.Box3, scale: THREE.Vector3) {
    this.dispose()

    const box = target instanceof Vim ? target.scene.getBoundingBox() : target
    this.grid = Grid.createFromBox(box, scale, this._material)

    this._renderer.add(this.grid.mesh)

    this.outline = new BoxOutline()
    this._renderer.add(this.outline)
    this.outline.visible = false
  }

  highlight (cell: number | THREE.Vector3 | undefined) {
    const box = this.grid.getBox(cell)
    if (!box) {
      this.outline.visible = false
      return
    }

    box.getCenter(this.outline.position)
    box.getSize(this.outline.scale)
    this.outline.visible = true
    this._renderer.needsUpdate = true
  }

  dispose () {
    if (this.grid) {
      this._renderer.remove(this.grid.mesh)
      this.grid.dispose()
      this.grid = undefined
    }
    if (this.outline) {
      this._renderer.remove(this.outline)
      this.outline?.dispose()
      this.outline = undefined
    }
  }
}

export class Grid {
  size: THREE.Vector3
  box: THREE.Box3
  mesh: THREE.Mesh
  private _cellCount: number

  private _scale: THREE.Vector3
  private _colors: Map<number, THREE.Color> = new Map<number, THREE.Color>()
  private _alpha: Map<number, number> = new Map<number, number>()
  private _material: THREE.Material
  private _ownedMaterial: boolean

  constructor (
    size: THREE.Vector3,
    scale: THREE.Vector3,
    material?: THREE.Material,
    color?: THREE.Color,
    opacity?: number
  ) {
    this.size = size
    this._scale = scale
    this.box = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(0, 0, 0),
      size.clone().multiply(scale)
    )

    this._cellCount = this.size.x * this.size.y * this.size.z
    this.build(color, opacity, material)
  }

  static createFromBox (
    box: THREE.Box3,
    scale: THREE.Vector3,
    material?: THREE.Material
  ) {
    const size = box.getSize(new THREE.Vector3()).divide(scale).ceil()
    const g = new Grid(size, scale, material)
    box.getCenter(g.mesh.position)
    g.box.translate(g.mesh.position)
    return g
  }

  get cellCount () {
    return this._cellCount
  }

  isCell (cell: THREE.Vector3) {
    if (!cell) return false
    if (
      !Number.isInteger(cell.x) ||
      !Number.isInteger(cell.y) ||
      !Number.isInteger(cell.z)
    ) {
      return false
    }
    if (cell.x < 0 || cell.y < 0 || cell.z < 0) {
      return false
    }
    if (
      cell.x >= this.size.x ||
      cell.y >= this.size.y ||
      cell.z >= this.size.z
    ) {
      return false
    }
    return true
  }

  isIndex (index: number) {
    return index !== undefined || index >= 0 || index <= this._cellCount
  }

  getIndex (cell: THREE.Vector3): number | undefined {
    if (!this.isCell(cell)) return
    return cell.x * this.size.y * this.size.z + cell.y * this.size.z + cell.z
  }

  getCell (index: number) {
    if (!this.isIndex(index)) return
    let r: number = index
    const x = Math.trunc(r / (this.size.y * this.size.z))
    r = r % (this.size.y * this.size.z)
    const y = Math.trunc(r / this.size.z)
    r = r % this.size.z
    const z = r
    return new THREE.Vector3(x, y, z)
  }

  getCellAtPosition (position: THREE.Vector3) {
    if (!this.box.containsPoint(position)) return
    return position.clone().sub(this.box.min).divide(this._scale).floor()
  }

  getBox (cell: number | THREE.Vector3) {
    const c = typeof cell === 'number' ? this.getCell(cell) : cell?.clone()
    if (!this.isCell(c)) return
    const min = c.multiply(this._scale).add(this.box.min)
    const max = min.clone().add(this._scale)
    return new THREE.Box3(min, max)
  }

  raycast (raycaster: Raycaster) {
    const hits = raycaster.intersectObject(this.mesh)
    for (let i = 0; i < hits.length; i++) {
      // push the hit a bit deeper so it is correctly inside the cell.
      const position = raycaster.ray.at(
        hits[i].distance + 0.1,
        new THREE.Vector3()
      )
      const cell = this.getCellAtPosition(position)
      if (cell !== undefined && this.getOpacity(cell) > 0) {
        return cell
      }
    }
    return undefined
  }

  getOpacity (cell: number | THREE.Vector3) {
    const index = typeof cell === 'number' ? cell : this.getIndex(cell)
    if (!this.isIndex(index)) return
    return this._alpha.get(index)
  }

  setOpacity (cell: number | THREE.Vector3, opacity: number) {
    const index = typeof cell === 'number' ? cell : this.getIndex(cell)
    if (!this.isIndex(index)) return
    const colors = this.mesh.geometry.getAttribute('color')

    this._alpha.set(index, opacity)
    const c = index * 8
    for (let i = 0; i < 8; i++) {
      colors.setW(c + i, opacity)
    }
    colors.needsUpdate = true
  }

  setColor (cell: number | THREE.Vector3, color: THREE.Color) {
    const index = typeof cell === 'number' ? cell : this.getIndex(cell)
    if (!this.isIndex(index)) return
    this._colors.set(index, color)
    const colors = this.mesh.geometry.getAttribute('color')
    const c = index * 8
    for (let i = 0; i < 8; i++) {
      colors.setXYZ(c + i, color.r, color.g, color.b)
    }
    colors.needsUpdate = true
  }

  getColor (cell: number | THREE.Vector3) {
    const index = typeof cell === 'number' ? cell : this.getIndex(cell)
    if (!this.isIndex(index)) return
    return this._colors.get(index)
  }

  private build (
    color: THREE.Color = new THREE.Color(0.25, 0.25, 0.25),
    opacity: number = 0.25,
    material: THREE.Material
  ) {
    const vertices = new Float32Array(this._cellCount * 24)
    const indices = new Int32Array(this._cellCount * 36)

    const cell = new THREE.Vector3()
    for (let x = 0; x < this.size.x; x++) {
      for (let y = 0; y < this.size.y; y++) {
        for (let z = 0; z < this.size.z; z++) {
          const index = this.getIndex(cell.set(x, y, z))
          const vertex = index * 8
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

          const i = index * 36
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

    ;[this._material, this._ownedMaterial] = material
      ? [material, false]
      : [createGridMaterial(), true]

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3)
    )
    geometry.setIndex(new THREE.Uint32BufferAttribute(indices, 1))

    geometry.setAttribute(
      'color',
      new Float32BufferAttribute(new Float32Array(this._cellCount * 32), 4)
    )

    this.mesh = new THREE.Mesh(geometry, this._material)

    for (let i = 0; i < this._cellCount; i++) {
      this.setOpacity(i, opacity)
      this.setColor(i, color)
    }
  }

  dispose () {
    this.mesh.geometry.dispose()
    if (this._ownedMaterial) {
      this._material.dispose()
    }
  }
}

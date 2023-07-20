import * as THREE from 'three'
import { G3d, G3dMesh, G3dMeshOffsets, G3dMaterial } from 'vim-format'
import { Vim, VimMaterials, VimSettings } from '../vim'
import { SignalDispatcher } from 'ste-signals'

export class InsertableMesh {
  offsets: G3dMeshOffsets
  mesh: THREE.Mesh
  vim: Vim

  private _onUpdate = new SignalDispatcher()
  get onUpdate () {
    return this._onUpdate.asEvent()
  }

  /**
   * Wether the mesh is merged or not.
   */
  merged: boolean

  /**
   * Wether the mesh is transparent or not.
   */
  transparent: boolean

  /**
   * Total bounding box for this mesh.
   */
  get boundingBox () {
    return this.geometry.boundingBox
  }

  /**
   * Set to true to ignore SetMaterial calls.
   */
  ignoreSceneMaterial: boolean

  /**
   * initial material.
   */
  private _material: THREE.Material | THREE.Material[] | undefined

  geometry: InsertableGeometry

  constructor (
    offsets: G3dMeshOffsets,
    materials: G3dMaterial,
    transparent: boolean
  ) {
    this.offsets = offsets
    this.transparent = transparent
    this.merged = true

    this.geometry = new InsertableGeometry(offsets, materials, transparent)

    this._material = transparent
      ? VimMaterials.getInstance().transparent.material
      : VimMaterials.getInstance().opaque.material

    this.mesh = new THREE.Mesh(this.geometry.geometry, this._material)
    this.mesh.userData.vim = this
  }

  applySettings (settings: VimSettings) {
    this.mesh.matrix.identity()
    this.mesh.applyMatrix4(settings.matrix)
  }

  insertAllMesh (g3d: G3dMesh, mesh: number) {
    this.geometry.insert(g3d, mesh)
  }

  update () {
    this.geometry.update()
    this._onUpdate.dispatch()
  }

  /**
   * Returns submesh corresponding to given face on a merged mesh.
   */
  getSubmeshFromFace (faceIndex: number) {
    // TODO: not iterate through all submeshes
    const hitIndex = faceIndex * 3
    for (const [instance, submesh] of this.geometry.submeshes.entries()) {
      if (hitIndex >= submesh.start && hitIndex < submesh.end) {
        return new InsertableSubmesh(this, instance)
      }
    }
  }

  /**
   *
   * @returns Returns all submeshes
   */
  getSubmeshes () {
    return [...this.geometry.submeshes.keys()].map(
      (i) => new InsertableSubmesh(this, i)
    )
  }

  /**
   *
   * @returns Returns submesh for given index.
   */
  getSubmesh (index: number) {
    return new InsertableSubmesh(this, index)
  }

  /**
   * Overrides mesh material, set to undefine to restore initial material.
   */
  setMaterial (value: THREE.Material) {
    if (this._material === value) return
    if (this.ignoreSceneMaterial) return

    if (value) {
      if (!this._material) {
        this._material = this.mesh.material
      }
      this.mesh.material = value
    } else {
      if (this._material) {
        this.mesh.material = this._material
        this._material = undefined
      }
    }
  }
}

// TODO Merge both submeshes class.
class GeometrySubmesh {
  geometry: InsertableGeometry
  instance: number
  start: number
  end: number
  boundingBox: THREE.Box3
}

class InsertableGeometry {
  materials: G3dMaterial
  offsets: G3dMeshOffsets
  geometry: THREE.BufferGeometry
  submeshes = new Map<number, GeometrySubmesh>()
  boundingBox: THREE.Box3

  private _indexAttribute: THREE.Uint32BufferAttribute
  private _vertexAttribute: THREE.BufferAttribute
  private _colorAttribute: THREE.BufferAttribute

  private _updatedMeshes = 0
  private _meshToUpdate = new Set<number>()

  // reusable objects to avoid allocs
  private _vector = new THREE.Vector3()
  private _matrix = new THREE.Matrix4()

  constructor (
    offsets: G3dMeshOffsets,
    materials: G3dMaterial,
    transparent: boolean
  ) {
    this.offsets = offsets
    this.materials = materials

    this._indexAttribute = new THREE.Uint32BufferAttribute(
      offsets.counts.indices,
      1
    )

    this._vertexAttribute = new THREE.Float32BufferAttribute(
      offsets.counts.vertices * G3d.POSITION_SIZE,
      G3d.POSITION_SIZE
    )

    const colorSize = transparent ? 4 : 3
    this._colorAttribute = new THREE.Float32BufferAttribute(
      offsets.counts.vertices * colorSize,
      colorSize
    )

    this._indexAttribute.count = 0
    this._vertexAttribute.count = 0
    this._colorAttribute.count = 0

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setIndex(this._indexAttribute)
    this.geometry.setAttribute('position', this._vertexAttribute)
    this.geometry.setAttribute('color', this._colorAttribute)
  }

  // TODO: remove the need for mesh argument.
  insert (g3d: G3dMesh, mesh: number) {
    const section = this.offsets.section
    const indexStart = g3d.getIndexStart(section)
    const indexEnd = g3d.getIndexEnd(section)
    if (indexStart === indexEnd) {
      this._meshToUpdate.add(mesh)
      return
    }

    const vertexStart = g3d.getVertexStart(section)
    const vertexEnd = g3d.getVertexEnd(section)
    const vertexCount = vertexEnd - vertexStart
    const sectionOffset = g3d.getVertexStart(section)

    const subStart = g3d.getSubmeshStart(section)
    const subEnd = g3d.getSubmeshEnd(section)

    const indexOffset = this.offsets.indexOffsets[mesh]
    const vertexOffset = this.offsets.vertexOffsets[mesh]

    const i = 0
    let v = 0
    let c = 0

    // TODO : Improve this when mesh param is removed
    const meshIndex = this.offsets.getMesh(mesh)
    const instanceCount = this.offsets.getInstanceCount(meshIndex)

    for (let i = 0; i < instanceCount; i++) {
      const index = this.offsets.getInstance(meshIndex, i)
      this._matrix.fromArray(g3d.getInstanceMatrix(index))

      // Sets the first point of the bounding boxes to avoid including (0,0,0)
      this._vector.fromArray(g3d.positions, vertexStart * G3d.POSITION_SIZE)
      this._vector.applyMatrix4(this._matrix)
      const box = new THREE.Box3().set(this._vector, this._vector)

      const submesh = new GeometrySubmesh()
      submesh.instance = g3d.instanceNodes[index]

      // Append indices
      submesh.start = indexOffset + i
      const vertexMergeOffset = vertexCount * i
      for (let index = indexStart; index < indexEnd; index++) {
        this._indexAttribute.setX(
          indexOffset + i,
          vertexOffset + vertexMergeOffset + g3d.indices[index] - sectionOffset
        )
        i++
      }
      submesh.end = indexOffset + i

      // Append vertices
      for (let vertex = vertexStart; vertex < vertexEnd; vertex++) {
        this._vector.fromArray(g3d.positions, vertex * G3d.POSITION_SIZE)
        this._vector.applyMatrix4(this._matrix)
        this._vertexAttribute.setXYZ(
          vertexOffset + v,
          this._vector.x,
          this._vector.y,
          this._vector.z
        )
        box.expandByPoint(this._vector)
        v++
      }

      // Append Colors
      for (let sub = subStart; sub < subEnd; sub++) {
        const color = this.materials.getMaterialColor(g3d.submeshMaterial[sub])
        const vCount = g3d.getSubmeshVertexCount(sub)
        for (let subV = 0; subV < vCount; subV++) {
          this._colorAttribute.setXYZ(
            vertexOffset + c,
            color[0],
            color[1],
            color[2]
          )

          if (this._colorAttribute.itemSize === 4) {
            this._colorAttribute.setW(vertexOffset + c, 0.25)
          }
          c++
        }
      }

      submesh.boundingBox = box
      this.boundingBox = this.boundingBox?.union(box) ?? box.clone()
      this.submeshes.set(submesh.instance, submesh)
      this._meshToUpdate.add(mesh)
    }
  }

  update () {
    // Compute mesh update range
    let meshEnd = this._updatedMeshes
    while (this._meshToUpdate.has(meshEnd)) {
      this._meshToUpdate.delete(meshEnd)
      meshEnd++
    }
    if (meshEnd === this._updatedMeshes) return

    // Compute index update range
    const indexStart = this.offsets.indexOffsets[this._updatedMeshes]
    const indexEnd =
      meshEnd < this.offsets.counts.meshes
        ? this.offsets.indexOffsets[meshEnd]
        : this.offsets.counts.indices

    // updated indices

    this._indexAttribute.updateRange.offset = indexStart
    this._indexAttribute.updateRange.count = indexEnd - indexStart

    this._indexAttribute.count = indexEnd
    this._indexAttribute.needsUpdate = true

    // Compute vertex update range
    const vertexStart = this.offsets.vertexOffsets[this._updatedMeshes]
    const vertexEnd =
      meshEnd < this.offsets.counts.meshes
        ? this.offsets.vertexOffsets[meshEnd]
        : this.offsets.counts.vertices

    // update vertices

    this._vertexAttribute.updateRange.offset =
      vertexStart * this._vertexAttribute.itemSize
    this._vertexAttribute.updateRange.count =
      (vertexEnd - vertexStart) * this._vertexAttribute.itemSize

    this._vertexAttribute.count = vertexEnd
    this._vertexAttribute.needsUpdate = true

    // update colors

    this._colorAttribute.updateRange.offset =
      vertexStart * this._colorAttribute.itemSize
    this._colorAttribute.updateRange.count =
      (vertexEnd - vertexStart) * this._colorAttribute.itemSize

    this._colorAttribute.count = vertexEnd
    this._colorAttribute.needsUpdate = true

    this._updatedMeshes = meshEnd
    this.geometry.computeBoundingBox()
    this.geometry.computeBoundingSphere()
  }
}

export class InsertableSubmesh {
  mesh: InsertableMesh
  index: number
  private _colors: Float32Array

  constructor (mesh: InsertableMesh, index: number) {
    this.mesh = mesh
    this.index = index
  }

  /**
   * Returns parent three mesh.
   */
  get three () {
    return this.mesh.mesh
  }

  /**
   * True if parent mesh is merged.
   */
  get merged () {
    return this.mesh.merged
  }

  /**
   * Returns vim instance associated with this submesh.
   */
  get instance () {
    return this.index
  }

  /**
   * Returns bounding box for this submesh.
   */
  get boundingBox () {
    return this.mesh.geometry.submeshes.get(this.index).boundingBox
  }

  /**
   * Returns starting position in parent mesh for merged mesh.
   */
  get meshStart () {
    return this.mesh.geometry.submeshes.get(this.index).start
  }

  /**
   * Returns ending position in parent mesh for merged mesh.
   */
  get meshEnd () {
    return this.mesh.geometry.submeshes.get(this.index).end
  }

  /**
   * Returns vim object for this submesh.
   */
  get object () {
    return this.mesh.vim.getObjectFromInstance(this.instance)
  }

  saveColors (colors: Float32Array) {
    if (this._colors) return
    this._colors = colors
  }

  popColors () {
    const result = this._colors
    this._colors = undefined
    return result
  }
}
